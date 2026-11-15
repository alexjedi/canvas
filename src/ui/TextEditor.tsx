import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { worldOf } from "../doc/geometry";
import { nodes } from "../doc/store";
import { explicitRuns, fontFamilyCss } from "../doc/text";
import type { Paint, SceneNode, TextRun, TextStyle } from "../doc/types";
import { editText, redoAction, styleText, undoAction } from "../editor/actions";
import { camera, editor, setEditing, setRange, type TextRange } from "../editor/state";
import { stopColor } from "../render/paint";
import { useFrame, useNodeVersion } from "./hooks";

const SLACK = 4;
const HIGHLIGHT = "color-mix(in oklch, var(--color-bl) 32%, transparent)";
const BOLD = 700;
const REGULAR = 400;

interface Rendered {
  runs: TextRun[];
  family: string;
  size: number;
  weight: number;
  spacing: number;
  fill: Paint | null;
  highlight: string;
}

function colorOf(fill: Paint | null): string {
  if (!fill) return "transparent";
  const stop = fill.gradient?.stops[0];
  return stopColor(stop ? { ...stop, opacity: stop.opacity * fill.opacity } : { offset: 0, color: fill.color, opacity: fill.opacity });
}

function createSpan(style: TextStyle, text: string, highlighted: boolean): HTMLSpanElement {
  const span = document.createElement("span");
  span.style.fontFamily = fontFamilyCss(style.fontFamily);
  span.style.fontSize = `${style.fontSize}px`;
  span.style.fontWeight = String(style.fontWeight);
  span.style.letterSpacing = `${style.letterSpacing}px`;
  span.style.color = colorOf(style.fill);
  if (highlighted) span.style.backgroundColor = HIGHLIGHT;
  span.textContent = text;
  return span;
}

const needsBreak = (text: string) => text === "" || text.endsWith("\n");

function build(root: HTMLElement, node: SceneNode, highlight: TextRange | null) {
  root.textContent = "";
  const runs = explicitRuns(node);
  let offset = 0;
  let last: HTMLSpanElement | null = null;
  for (const run of runs) {
    const end = offset + run.length;
    const cuts = [offset];
    if (highlight) for (const cut of [highlight.start, highlight.end]) if (cut > offset && cut < end) cuts.push(cut);
    cuts.push(end);
    for (let i = 0; i + 1 < cuts.length; i++) {
      if (cuts[i] === cuts[i + 1] && node.text !== "") continue;
      const highlighted = !!highlight && cuts[i] >= highlight.start && cuts[i + 1] <= highlight.end && cuts[i] < cuts[i + 1];
      last = createSpan(run, node.text.slice(cuts[i], cuts[i + 1]), highlighted);
      root.append(last);
    }
    offset = end;
  }
  if (!last) {
    last = createSpan(runs[0], "", false);
    root.append(last);
  }
  if (needsBreak(node.text)) last.append(document.createElement("br"));
}

function isIntact(root: HTMLElement, text: string): boolean {
  if (root.textContent !== text) return false;
  const breaks = root.querySelectorAll("br").length;
  if (breaks !== (needsBreak(text) ? 1 : 0)) return false;
  if (root.querySelectorAll("*").length !== root.children.length + breaks) return false;
  for (const child of Array.from(root.children)) {
    if (child.localName !== "span" || (child.textContent === "" && text !== "")) return false;
  }
  return breaks === 0 || root.lastElementChild?.lastChild?.nodeName === "BR";
}

function offsetIn(root: HTMLElement, container: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);
  return range.toString().length;
}

function readRange(root: HTMLElement): TextRange | null {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  return { start: offsetIn(root, range.startContainer, range.startOffset), end: offsetIn(root, range.endContainer, range.endOffset) };
}

function locate(root: HTMLElement, offset: number): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let passed = 0;
  let last: Node | null = null;
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const length = text.nodeValue?.length ?? 0;
    if (offset <= passed + length) return [text, offset - passed];
    passed += length;
    last = text;
  }
  return last ? [last, last.nodeValue?.length ?? 0] : [root.lastElementChild ?? root, 0];
}

function writeRange(root: HTMLElement, range: TextRange) {
  const selection = document.getSelection();
  if (!selection) return;
  const [startNode, startOffset] = locate(root, range.start);
  const [endNode, endOffset] = locate(root, range.end);
  const next = document.createRange();
  next.setStart(startNode, startOffset);
  next.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(next);
}

function TextField({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef<Rendered | null>(null);
  const composing = useRef(false);
  const [focused, setFocused] = useState(true);
  useNodeVersion(id);
  useFrame(() => `${camera.x},${camera.y},${camera.zoom}`);
  const range = useFrame(() => editor.range);
  const node = nodes.get(id);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !node || composing.current) return;
    const marked = !focused && range && range.start < range.end ? range : null;
    const highlight = marked ? `${marked.start}:${marked.end}` : "";
    const previous = rendered.current;
    const current =
      previous &&
      previous.runs === node.runs &&
      previous.family === node.fontFamily &&
      previous.size === node.fontSize &&
      previous.weight === node.fontWeight &&
      previous.spacing === node.letterSpacing &&
      previous.fill === node.fill &&
      previous.highlight === highlight &&
      isIntact(root, node.text);
    if (current) return;
    const caret = focused ? (readRange(root) ?? editor.range) : null;
    build(root, node, marked);
    rendered.current = {
      runs: node.runs,
      family: node.fontFamily,
      size: node.fontSize,
      weight: node.fontWeight,
      spacing: node.letterSpacing,
      fill: node.fill,
      highlight,
    };
    if (caret) writeRange(root, caret);
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.focus();
    const length = nodes.get(id)?.text.length ?? 0;
    writeRange(root, { start: 0, end: length });
    setRange({ start: 0, end: length });

    const sync = () => {
      const current = nodes.get(id);
      if (!current) return;
      const next = root.textContent ?? "";
      const before = current.text;
      if (next === before) return;
      const limit = Math.min(next.length, before.length);
      let prefix = 0;
      while (prefix < limit && next[prefix] === before[prefix]) prefix++;
      let suffix = 0;
      while (suffix < limit - prefix && next[next.length - 1 - suffix] === before[before.length - 1 - suffix]) suffix++;
      editText(id, next, prefix, before.length - prefix - suffix, next.length - prefix - suffix);
    };

    const replace = (inserted: string) => {
      const current = nodes.get(id);
      const at = readRange(root);
      if (!current || !at) return;
      const text = current.text.slice(0, at.start) + inserted + current.text.slice(at.end);
      const caret = at.start + inserted.length;
      editText(id, text, at.start, at.end - at.start, inserted.length);
      const updated = nodes.get(id);
      if (!updated) return;
      build(root, updated, null);
      rendered.current = null;
      writeRange(root, { start: caret, end: caret });
      setRange({ start: caret, end: caret });
    };

    const onBeforeInput = (event: InputEvent) => {
      if (event.isComposing) return;
      const type = event.inputType;
      if (type === "historyUndo" || type === "historyRedo") {
        event.preventDefault();
        if (type === "historyUndo") undoAction();
        else redoAction();
      } else if (type === "insertParagraph" || type === "insertLineBreak") {
        event.preventDefault();
        replace("\n");
      } else if (type === "insertFromPaste" || type === "insertFromDrop") {
        event.preventDefault();
        replace((event.dataTransfer?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n"));
      }
    };

    const onInput = (event: Event) => {
      if (!(event as InputEvent).isComposing) sync();
    };

    const onSelection = () => {
      if (document.activeElement !== root) return;
      const next = readRange(root);
      if (next) setRange(next);
    };

    root.addEventListener("beforeinput", onBeforeInput);
    root.addEventListener("input", onInput);
    const onCompositionStart = () => {
      composing.current = true;
    };
    const onCompositionEnd = () => {
      composing.current = false;
      sync();
    };
    root.addEventListener("compositionstart", onCompositionStart);
    root.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("selectionchange", onSelection);
    return () => {
      root.removeEventListener("beforeinput", onBeforeInput);
      root.removeEventListener("input", onInput);
      root.removeEventListener("compositionstart", onCompositionStart);
      root.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("selectionchange", onSelection);
    };
  }, [id]);

  if (!node) return null;
  const auto = node.textSizing === "width";
  let smallest = node.fontSize;
  let largest = node.fontSize;
  for (const run of node.runs) {
    smallest = Math.min(smallest, run.fontSize);
    largest = Math.max(largest, run.fontSize);
  }
  const slack = auto ? largest * SLACK : 0;
  const shift = node.textAlign === "left" ? 0 : node.textAlign === "center" ? -slack / 2 : -slack;
  const m = worldOf(id);
  const zoom = camera.zoom;

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label="Text"
      aria-multiline
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        const mod = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();
        if (event.key === "Escape" || (event.key === "Enter" && mod)) {
          event.preventDefault();
          setEditing("");
        } else if (mod && key === "z") {
          event.preventDefault();
          if (event.shiftKey) redoAction();
          else undoAction();
        } else if (mod && key === "b") {
          event.preventDefault();
          styleText((style) => ({ fontWeight: style.fontWeight >= 600 ? REGULAR : BOLD }));
        }
      }}
      style={{
        width: Math.max(1, node.width) + slack,
        minHeight: Math.max(node.height, smallest * node.lineHeight),
        transform: `matrix(${m[0] * zoom},${m[1] * zoom},${m[2] * zoom},${m[3] * zoom},${m[4] * zoom + camera.x},${m[5] * zoom + camera.y}) translate(${shift}px,0)`,
        fontSize: smallest,
        lineHeight: node.lineHeight,
        textAlign: node.textAlign,
        whiteSpace: auto ? "pre" : "pre-wrap",
      }}
      className="absolute top-0 left-0 m-0 block origin-top-left cursor-text overflow-visible border-0 bg-transparent p-0 wrap-break-word outline-none"
    />
  );
}

export function TextEditor() {
  const id = useFrame(() => (nodes.get(editor.editing)?.kind === "text" ? editor.editing : ""));
  return id ? <TextField key={id} id={id} /> : null;
}
