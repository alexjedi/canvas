import { inFlow } from "./layout";
import { edit } from "./store";
import type { NodeProps, Paint, SceneNode, TextAlign, TextRun, TextStyle } from "./types";

export interface Fragment {
  text: string;
  run: number;
  x: number;
  width: number;
}

export interface RichLine {
  fragments: Fragment[];
  baseline: number;
}

export interface TextLayout {
  rich: RichLine[] | null;
  runs: TextRun[];
  lines: string[];
  widths: number[];
  width: number;
  height: number;
  lineHeight: number;
  baseline: number;
  font: string;
  spacing: string;
  align: TextAlign;
}

interface Entry {
  text: string;
  family: string;
  size: number;
  weight: number;
  leading: number;
  tracking: number;
  align: TextAlign;
  wrap: number;
  runs: TextRun[];
  layout: TextLayout;
}

interface Metrics {
  ascent: number;
  descent: number;
}

const GENERIC = new Set(["system-ui", "serif", "sans-serif", "monospace", "cursive", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded"]);
const CACHE_LIMIT = 20000;
const EPSILON = 1e-6;
const RAD = Math.PI / 180;

const entries = new WeakMap<SceneNode, Entry>();
const measured = new Map<string, Map<string, number>>();
let measuredCount = 0;
let context: CanvasRenderingContext2D | null = null;
let words: Map<string, number> = new Map();
let activeKey = "";
const metrics = new Map<string, Metrics>();

export const fontFamilyCss = (family: string) => (GENERIC.has(family) ? family : `"${family.replace(/["\\]/g, "")}", sans-serif`);

export const fontCss = (style: TextStyle) => `${style.fontWeight} ${style.fontSize}px ${fontFamilyCss(style.fontFamily)}`;

export const styleOf = (node: SceneNode): TextStyle => ({
  fontFamily: node.fontFamily,
  fontSize: node.fontSize,
  fontWeight: node.fontWeight,
  letterSpacing: node.letterSpacing,
  fill: node.fill,
});

export function maxFontSize(node: SceneNode): number {
  let size = node.runs.length > 0 ? 0 : node.fontSize;
  for (const run of node.runs) if (run.fontSize > size) size = run.fontSize;
  return size;
}

function useStyle(style: TextStyle): Metrics {
  const font = fontCss(style);
  const spacing = `${style.letterSpacing}px`;
  const key = font + "|" + spacing;
  let found = metrics.get(key);
  if (key === activeKey && found) return found;
  activeKey = key;
  let cache = measured.get(key);
  if (!cache) measured.set(key, (cache = new Map()));
  words = cache;
  found ??= { ascent: style.fontSize * 0.8, descent: style.fontSize * 0.2 };
  if (context) {
    context.font = font;
    context.letterSpacing = spacing;
    if (!metrics.has(key)) {
      const sample = context.measureText("Hg");
      found = { ascent: sample.fontBoundingBoxAscent ?? found.ascent, descent: sample.fontBoundingBoxDescent ?? found.descent };
    }
  }
  metrics.set(key, found);
  return found;
}

function widthOf(text: string): number {
  if (text === "" || !context) return 0;
  let width = words.get(text);
  if (width === undefined) {
    if (measuredCount++ > CACHE_LIMIT) {
      measured.clear();
      metrics.clear();
      words = new Map();
      activeKey = "";
      measuredCount = 0;
    }
    width = context.measureText(text).width;
    words.set(text, width);
  }
  return width;
}

function breakWord(word: string, max: number, lines: string[], widths: number[]): string {
  let rest = word;
  while (widthOf(rest) > max) {
    const glyphs = Array.from(rest);
    if (glyphs.length <= 1) break;
    let count = 0;
    let taken = 0;
    for (const glyph of glyphs) {
      const advance = widthOf(glyph);
      if (count > 0 && taken + advance > max) break;
      taken += advance;
      count++;
    }
    if (count === glyphs.length) break;
    const head = glyphs.slice(0, count).join("");
    lines.push(head);
    widths.push(widthOf(head));
    rest = glyphs.slice(count).join("");
  }
  return rest;
}

function breakParagraph(paragraph: string, max: number, lines: string[], widths: number[]) {
  const space = widthOf(" ");
  let line = "";
  let width = 0;
  let started = false;
  for (const word of paragraph.split(" ")) {
    const advance = widthOf(word);
    if (started && width + space + advance <= max) {
      line += " " + word;
      width += space + advance;
      continue;
    }
    if (started) {
      lines.push(line);
      widths.push(width);
    }
    line = advance > max ? breakWord(word, max, lines, widths) : word;
    width = widthOf(line);
    started = true;
  }
  lines.push(line);
  widths.push(width);
}

function compose(node: SceneNode, wrap: number): TextLayout {
  context ??= document.createElement("canvas").getContext("2d");
  const font = fontCss(node);
  const spacing = `${node.letterSpacing}px`;
  const { ascent, descent } = useStyle(node);
  const lines: string[] = [];
  const widths: number[] = [];
  for (const paragraph of node.text.split("\n")) {
    if (wrap < 0) {
      lines.push(paragraph);
      widths.push(widthOf(paragraph));
    } else {
      breakParagraph(paragraph, wrap, lines, widths);
    }
  }
  const lineHeight = node.fontSize * node.lineHeight;
  let width = 0;
  for (const value of widths) if (value > width) width = value;
  return {
    rich: null,
    runs: node.runs,
    lines,
    widths,
    width: Math.ceil(width),
    height: lines.length * lineHeight,
    lineHeight,
    baseline: (lineHeight - ascent - descent) / 2 + ascent,
    font,
    spacing,
    align: node.textAlign,
  };
}

function composeRich(node: SceneNode, wrap: number): TextLayout {
  context ??= document.createElement("canvas").getContext("2d");
  const { text, runs } = node;
  const starts: number[] = [];
  let total = 0;
  for (const run of runs) {
    starts.push(total);
    total += run.length;
  }
  let cursor = 0;
  const runAt = (offset: number) => {
    if (offset < starts[cursor]) cursor = 0;
    while (cursor < runs.length - 1 && offset >= starts[cursor] + runs[cursor].length) cursor++;
    return cursor;
  };
  const measure = (from: number, to: number) => {
    let width = 0;
    let at = from;
    while (at < to) {
      const index = runAt(at);
      const end = Math.min(to, starts[index] + runs[index].length);
      useStyle(runs[index]);
      width += widthOf(text.slice(at, end));
      at = end;
    }
    return width;
  };
  const rich: RichLine[] = [];
  const lines: string[] = [];
  const widths: number[] = [];
  let line: Fragment[] = [];
  let top = 0;
  const push = (from: number, to: number) => {
    let at = from;
    while (at < to) {
      const index = runAt(at);
      const end = Math.min(to, starts[index] + runs[index].length);
      const last = line[line.length - 1];
      if (last && last.run === index) last.text += text.slice(at, end);
      else line.push({ text: text.slice(at, end), run: index, x: 0, width: 0 });
      at = end;
    }
  };
  const flush = (offset: number) => {
    let x = 0;
    let size = 0;
    let lead = -1;
    let content = "";
    for (const fragment of line) {
      const style = runs[fragment.run];
      useStyle(style);
      fragment.x = x;
      fragment.width = widthOf(fragment.text);
      x += fragment.width;
      content += fragment.text;
      if (style.fontSize > size) {
        size = style.fontSize;
        lead = fragment.run;
      }
    }
    if (lead < 0) {
      lead = runAt(Math.max(0, Math.min(offset, text.length - 1)));
      size = runs[lead].fontSize;
    }
    const { ascent, descent } = useStyle(runs[lead]);
    const height = size * node.lineHeight;
    rich.push({ fragments: line, baseline: top + (height - ascent - descent) / 2 + ascent });
    lines.push(content);
    widths.push(x);
    top += height;
    line = [];
  };
  let paragraph = 0;
  while (paragraph <= text.length) {
    let close = text.indexOf("\n", paragraph);
    if (close < 0) close = text.length;
    let word = paragraph;
    let width = 0;
    let started = false;
    while (true) {
      let stop = text.indexOf(" ", word);
      if (stop < 0 || stop > close) stop = close;
      const advance = measure(word, stop);
      const space = started ? measure(word - 1, word) : 0;
      if (wrap >= 0 && started && width + space + advance > wrap) {
        flush(word);
        width = 0;
        started = false;
      }
      if (started) {
        push(word - 1, word);
        width += space;
      }
      if (wrap >= 0 && advance > wrap) {
        let from = word;
        let taken = width;
        let at = word;
        while (at < stop) {
          const step = (text.codePointAt(at) ?? 0) > 0xffff ? 2 : 1;
          const glyph = measure(at, at + step);
          if (at > from && taken + glyph > wrap) {
            push(from, at);
            flush(at);
            from = at;
            taken = 0;
          }
          taken += glyph;
          at += step;
        }
        push(from, stop);
        width = taken;
      } else {
        push(word, stop);
        width += advance;
      }
      started = true;
      if (stop >= close) break;
      word = stop + 1;
    }
    flush(close);
    paragraph = close + 1;
  }
  let width = 0;
  for (const value of widths) if (value > width) width = value;
  return {
    rich,
    runs,
    lines,
    widths,
    width: Math.ceil(width),
    height: top,
    lineHeight: 0,
    baseline: 0,
    font: "",
    spacing: "",
    align: node.textAlign,
  };
}

function runsFit(node: SceneNode): boolean {
  if (node.runs.length === 0) return false;
  let total = 0;
  for (const run of node.runs) total += run.length;
  return total === node.text.length && total > 0;
}

export function layoutText(node: SceneNode): TextLayout {
  const wrap = node.textSizing === "width" ? -1 : node.width;
  const entry = entries.get(node);
  if (
    entry &&
    entry.text === node.text &&
    entry.family === node.fontFamily &&
    entry.size === node.fontSize &&
    entry.weight === node.fontWeight &&
    entry.leading === node.lineHeight &&
    entry.tracking === node.letterSpacing &&
    entry.align === node.textAlign &&
    entry.runs === node.runs &&
    entry.wrap === wrap
  ) {
    return entry.layout;
  }
  const layout = runsFit(node) ? composeRich(node, wrap) : compose(node, wrap);
  entries.set(node, {
    text: node.text,
    family: node.fontFamily,
    size: node.fontSize,
    weight: node.fontWeight,
    leading: node.lineHeight,
    tracking: node.letterSpacing,
    align: node.textAlign,
    wrap,
    runs: node.runs,
    layout,
  });
  return layout;
}

export function fitText(node: SceneNode) {
  if (inFlow(node)) {
    const sizing = node.sizeY === "fill" ? "fixed" : node.sizeX === "fill" && node.textSizing === "width" ? "height" : node.textSizing;
    if (sizing !== node.textSizing) {
      const target = edit(node.id);
      if (target) target.textSizing = sizing;
    }
  }
  if (node.textSizing === "fixed") return;
  const layout = layoutText(node);
  const width = node.textSizing === "width" ? layout.width : node.width;
  if (Math.abs(width - node.width) < EPSILON && Math.abs(layout.height - node.height) < EPSILON) return;
  const target = edit(node.id);
  if (!target) return;
  if (node.textAlign !== "left" && width !== node.width) {
    const shift = (node.width - width) * (node.textAlign === "center" ? 0.5 : 1);
    target.x += Math.cos(node.rotation * RAD) * shift;
    target.y += Math.sin(node.rotation * RAD) * shift;
  }
  target.width = width;
  target.height = layout.height;
}

const samePaint = (a: Paint | null, b: Paint | null) => a === b || (!!a && !!b && a.color === b.color && a.opacity === b.opacity && a.gradient === b.gradient);

export const sameStyle = (a: TextStyle, b: TextStyle) =>
  a.fontFamily === b.fontFamily && a.fontSize === b.fontSize && a.fontWeight === b.fontWeight && a.letterSpacing === b.letterSpacing && samePaint(a.fill, b.fill);

export const explicitRuns = (node: SceneNode): TextRun[] => (runsFit(node) ? node.runs : [{ ...styleOf(node), length: node.text.length }]);

function settle(runs: TextRun[], fallback: TextStyle): Partial<NodeProps> {
  const merged: TextRun[] = [];
  for (const run of runs) {
    if (run.length <= 0) continue;
    const last = merged[merged.length - 1];
    if (last && sameStyle(last, run)) last.length += run.length;
    else merged.push({ ...run });
  }
  if (merged.length > 1) return { runs: merged };
  const style = merged[0] ?? fallback;
  return {
    runs: [],
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    fill: style.fill,
  };
}

function splitRuns(runs: TextRun[], offset: number): TextRun[] {
  const out: TextRun[] = [];
  let at = 0;
  for (const run of runs) {
    const end = at + run.length;
    if (offset > at && offset < end) out.push({ ...run, length: offset - at }, { ...run, length: end - offset });
    else out.push(run);
    at = end;
  }
  return out;
}

export function styleRange(node: SceneNode, start: number, end: number, change: (style: TextStyle) => Partial<TextStyle>): Partial<NodeProps> {
  const runs = splitRuns(splitRuns(explicitRuns(node), start), end);
  let at = 0;
  const next = runs.map((run) => {
    const inside = at >= start && at + run.length <= end;
    at += run.length;
    return inside ? { ...run, ...change(run) } : run;
  });
  return settle(next, { ...styleOf(node), ...change(styleOf(node)) });
}

export function spliceRuns(node: SceneNode, start: number, removed: number, inserted: number): Partial<NodeProps> {
  if (!runsFit(node)) return node.runs.length > 0 ? { runs: [] } : {};
  const runs = node.runs.map((run) => ({ ...run }));
  const stop = start + removed;
  let at = 0;
  let host = 0;
  for (let i = 0; i < runs.length; i++) {
    const end = at + runs[i].length;
    if (start > at && start <= end) host = i;
    runs[i].length -= Math.max(0, Math.min(end, stop) - Math.max(at, start));
    at = end;
  }
  runs[host].length += inserted;
  return settle(runs, node.runs[host]);
}

export function rangeValue<K extends keyof TextStyle>(node: SceneNode, key: K, start: number, end: number): { value: TextStyle[K]; mixed: boolean } {
  const runs = explicitRuns(node);
  let at = 0;
  let found = false;
  let value = runs[0][key];
  for (const run of runs) {
    const stop = at + run.length;
    const touches = start === end ? start > at && start <= stop : stop > start && at < end;
    at = stop;
    if (!touches) continue;
    if (found && (key === "fill" ? !samePaint(value as Paint | null, run.fill) : value !== run[key])) return { value, mixed: true };
    value = run[key];
    found = true;
  }
  return { value, mixed: false };
}
