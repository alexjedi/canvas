import { isLayout } from "./layout";
import { edit, nodes } from "./store";
import type { SceneNode, TextAlign } from "./types";

export interface TextLayout {
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
  layout: TextLayout;
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

export const fontFamilyCss = (family: string) => (GENERIC.has(family) ? family : `"${family.replace(/["\\]/g, "")}", sans-serif`);

export const fontCss = (node: SceneNode) => `${node.fontWeight} ${node.fontSize}px ${fontFamilyCss(node.fontFamily)}`;

function widthOf(text: string): number {
  if (text === "" || !context) return 0;
  let width = words.get(text);
  if (width === undefined) {
    if (measuredCount++ > CACHE_LIMIT) {
      measured.clear();
      words.clear();
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
  const key = font + "|" + spacing;
  let cache = measured.get(key);
  if (!cache) measured.set(key, (cache = new Map()));
  words = cache;
  const lines: string[] = [];
  const widths: number[] = [];
  let ascent = node.fontSize * 0.8;
  let descent = node.fontSize * 0.2;
  if (context) {
    context.font = font;
    context.letterSpacing = spacing;
    const metrics = context.measureText("Hg");
    ascent = metrics.fontBoundingBoxAscent ?? ascent;
    descent = metrics.fontBoundingBoxDescent ?? descent;
  }
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
    entry.wrap === wrap
  ) {
    return entry.layout;
  }
  const layout = compose(node, wrap);
  entries.set(node, {
    text: node.text,
    family: node.fontFamily,
    size: node.fontSize,
    weight: node.fontWeight,
    leading: node.lineHeight,
    tracking: node.letterSpacing,
    align: node.textAlign,
    wrap,
    layout,
  });
  return layout;
}

export function fitText(node: SceneNode) {
  if (isLayout(nodes.get(node.parent))) {
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
