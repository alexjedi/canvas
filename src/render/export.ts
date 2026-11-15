import { ensureBitmap, getBitmap, getBlob } from "../doc/assets";
import { collectSubtree } from "../doc/create";
import { mat, setWorld, unionBounds } from "../doc/geometry";
import { nodes } from "../doc/store";
import { fontFamilyCss, layoutText, type TextLayout } from "../doc/text";
import type { Paint, SceneNode } from "../doc/types";
import { tracePaths, type PathSink } from "../doc/vector";
import { linearAxis, radialStretch } from "./paint";
import { cornerRadius, lineOrigin, paintNode, strokeOffset, strokeOutset, tracePath, type Context } from "./raster";

export type ExportFormat = "png" | "jpg" | "svg";

const RAD = Math.PI / 180;
const MAX_PIXELS = 16384;

const round = (value: number) => Math.round(value * 1000) / 1000;

function drawTree(ctx: Context, node: SceneNode, alpha: number) {
  const opacity = alpha * node.opacity;
  paintNode(ctx, node, opacity);
  if (node.children.length === 0) return;
  ctx.save();
  if (node.clip) {
    tracePath(ctx, node);
    ctx.clip();
  }
  for (const id of node.children) {
    const child = nodes.get(id);
    if (!child || !child.visible) continue;
    ctx.save();
    ctx.translate(child.x, child.y);
    ctx.rotate(child.rotation * RAD);
    drawTree(ctx, child, opacity);
    ctx.restore();
  }
  ctx.restore();
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
}

async function renderBitmap(node: SceneNode, scale: number, format: "png" | "jpg"): Promise<Blob | null> {
  const outset = strokeOutset(node);
  const width = node.width + outset * 2;
  const height = node.height + outset * 2;
  const factor = Math.min(scale, MAX_PIXELS / width, MAX_PIXELS / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * factor));
  canvas.height = Math.max(1, Math.ceil(height * factor));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(factor, 0, 0, factor, outset * factor, outset * factor);
  drawTree(ctx, node, 1);
  return toBlob(canvas, format === "jpg" ? "image/jpeg" : "image/png");
}

export async function renderPng(id: string, scale: number): Promise<Blob | null> {
  const node = nodes.get(id);
  if (!node) return null;
  await Promise.all(
    collectSubtree(id)
      .filter((item) => item.asset)
      .map((item) => ensureBitmap(item.asset)),
  );
  return renderBitmap(node, scale, "png");
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pathData(node: SceneNode): string {
  const parts: string[] = [];
  const sink: PathSink = {
    moveTo: (x, y) => parts.push(`M${round(x)} ${round(y)}`),
    bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => parts.push(`C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(x)} ${round(y)}`),
    closePath: () => parts.push("Z"),
  };
  tracePaths(sink, node.paths, node.width, node.height);
  return parts.join("");
}

function paintAttributes(key: "fill" | "stroke", paint: Paint, node: SceneNode, defs: string[]): string {
  const opacity = ` ${key}-opacity="${round(paint.opacity)}"`;
  const gradient = paint.gradient;
  if (!gradient || gradient.stops.length === 0) return ` ${key}="${paint.color}"${opacity}`;
  const id = `paint${defs.length}`;
  const stops = gradient.stops
    .map((stop) => `<stop offset="${round(Math.min(1, Math.max(0, stop.offset)))}" stop-color="${stop.color}" stop-opacity="${round(stop.opacity)}"/>`)
    .join("");
  if (gradient.type === "linear") {
    const axis = linearAxis(gradient.angle, node.width, node.height);
    defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(axis[0])}" y1="${round(axis[1])}" x2="${round(axis[2])}" y2="${round(axis[3])}">${stops}</linearGradient>`,
    );
  } else {
    const stretch = radialStretch(paint, node.width, node.height);
    const radius = stretch === 1 ? Math.max(node.width, node.height, 1) / 2 : node.width / 2;
    const cy = stretch === 1 ? node.height / 2 : node.width / 2;
    const transform = stretch === 1 ? "" : ` gradientTransform="scale(1 ${round(stretch)})"`;
    defs.push(
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${round(node.width / 2)}" cy="${round(cy)}" r="${round(radius)}"${transform}>${stops}</radialGradient>`,
    );
  }
  return ` ${key}="url(#${id})"${opacity}`;
}

function richMarkup(node: SceneNode, layout: TextLayout, defs: string[]): string {
  const stroke = node.stroke;
  const outline =
    stroke && stroke.width > 0 ? `${paintAttributes("stroke", stroke, node, defs)} stroke-width="${round(stroke.width)}" stroke-linejoin="round"` : "";
  let spans = "";
  (layout.rich ?? []).forEach((line, index) => {
    const origin = lineOrigin(node, layout, index);
    for (const fragment of line.fragments) {
      const style = layout.runs[fragment.run];
      const paint = style.fill ? paintAttributes("fill", style.fill, node, defs) : ` fill="none"`;
      const spacing = style.letterSpacing ? ` letter-spacing="${round(style.letterSpacing)}"` : "";
      spans += `<tspan x="${round(origin + fragment.x)}" y="${round(line.baseline)}" font-family="${escapeXml(fontFamilyCss(style.fontFamily))}" font-size="${round(style.fontSize)}" font-weight="${style.fontWeight}"${spacing}${paint}>${escapeXml(fragment.text)}</tspan>`;
    }
  });
  return `<text xml:space="preserve"${outline}>${spans}</text>`;
}

function textMarkup(node: SceneNode, defs: string[]): string {
  const layout = layoutText(node);
  if (layout.rich) return richMarkup(node, layout, defs);
  const { fill, stroke } = node;
  const anchor = layout.align === "left" ? "start" : layout.align === "center" ? "middle" : "end";
  const x = layout.align === "left" ? 0 : layout.align === "center" ? node.width / 2 : node.width;
  const spans = layout.lines
    .map((line, index) => `<tspan x="${round(x)}" y="${round(layout.baseline + index * layout.lineHeight)}">${escapeXml(line)}</tspan>`)
    .join("");
  const paint = fill ? paintAttributes("fill", fill, node, defs) : ` fill="none"`;
  const outline =
    stroke && stroke.width > 0 ? `${paintAttributes("stroke", stroke, node, defs)} stroke-width="${round(stroke.width)}" stroke-linejoin="round"` : "";
  const spacing = node.letterSpacing ? ` letter-spacing="${round(node.letterSpacing)}"` : "";
  return `<text xml:space="preserve" font-family="${escapeXml(fontFamilyCss(node.fontFamily))}" font-size="${round(node.fontSize)}" font-weight="${node.fontWeight}" text-anchor="${anchor}"${spacing}${paint}${outline}>${spans}</text>`;
}

function shape(node: SceneNode, offset: number, attributes: string): string {
  const { width, height } = node;
  if (node.kind === "vector") return `<path d="${pathData(node)}"${attributes}/>`;
  if (node.kind === "ellipse") {
    return `<ellipse cx="${round(width / 2)}" cy="${round(height / 2)}" rx="${round(Math.max(0, width / 2 + offset))}" ry="${round(Math.max(0, height / 2 + offset))}"${attributes}/>`;
  }
  const radius = cornerRadius(node);
  const corner = radius > 0 ? ` rx="${round(Math.max(0, radius + offset))}"` : "";
  return `<rect x="${round(-offset)}" y="${round(-offset)}" width="${round(width + offset * 2)}" height="${round(height + offset * 2)}"${corner}${attributes}/>`;
}

function serialize(node: SceneNode, defs: string[], urls: Map<string, string>): string {
  const { fill, stroke } = node;
  if (node.kind === "text") return textMarkup(node, defs);
  const parts: string[] = [];
  const rule = node.kind === "vector" && node.evenOdd ? ` fill-rule="evenodd"` : "";
  if (fill) parts.push(shape(node, 0, paintAttributes("fill", fill, node, defs) + rule));
  const bitmap = node.kind === "image" ? getBitmap(node.asset) : undefined;
  const url = urls.get(node.asset);
  if (bitmap && url) {
    const clip = `clip${defs.length}`;
    defs.push(`<clipPath id="${clip}">${shape(node, 0, "")}</clipPath>`);
    if (node.fit === "tile") {
      const pattern = `pattern${defs.length}`;
      defs.push(
        `<pattern id="${pattern}" patternUnits="userSpaceOnUse" width="${bitmap.width}" height="${bitmap.height}"><image href="${url}" width="${bitmap.width}" height="${bitmap.height}"/></pattern>`,
      );
      parts.push(shape(node, 0, ` fill="url(#${pattern})"`));
    } else {
      const aspect = node.fit === "stretch" ? "none" : node.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
      parts.push(
        `<image href="${url}" width="${round(node.width)}" height="${round(node.height)}" preserveAspectRatio="${aspect}" clip-path="url(#${clip})"/>`,
      );
    }
  }
  if (stroke && stroke.width > 0) {
    const limit = node.kind === "vector" ? ` stroke-miterlimit="4" stroke-linejoin="${stroke.join}" stroke-linecap="${stroke.cap}"` : "";
    parts.push(shape(node, strokeOffset(node), ` fill="none"${paintAttributes("stroke", stroke, node, defs)} stroke-width="${round(stroke.width)}"${limit}`));
  }
  const children: string[] = [];
  for (const id of node.children) {
    const child = nodes.get(id);
    if (!child || !child.visible) continue;
    const rotation = child.rotation ? ` rotate(${round(child.rotation)})` : "";
    const opacity = child.opacity < 1 ? ` opacity="${round(child.opacity)}"` : "";
    children.push(`<g transform="translate(${round(child.x)} ${round(child.y)})${rotation}"${opacity}>${serialize(child, defs, urls)}</g>`);
  }
  if (children.length > 0) {
    let attribute = "";
    if (node.clip) {
      const clip = `clip${defs.length}`;
      defs.push(`<clipPath id="${clip}">${shape(node, 0, "")}</clipPath>`);
      attribute = ` clip-path="url(#${clip})"`;
    }
    parts.push(`<g${attribute}>${children.join("")}</g>`);
  }
  return parts.join("");
}

async function assetUrls(ids: readonly string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const id of ids) {
    for (const item of collectSubtree(id)) {
      if (!item.asset || urls.has(item.asset)) continue;
      await ensureBitmap(item.asset);
      const blob = getBlob(item.asset);
      if (blob) urls.set(item.asset, await readDataUrl(blob));
    }
  }
  return urls;
}

function wrapSvg(x: number, y: number, width: number, height: number, defs: string[], body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="${round(x)} ${round(y)} ${round(width)} ${round(height)}">` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    `${body}</svg>`
  );
}

const opacityAttribute = (node: SceneNode) => (node.opacity < 1 ? ` opacity="${round(node.opacity)}"` : "");

export async function svgMarkup(ids: readonly string[]): Promise<string> {
  const list = ids.map((id) => nodes.get(id)).filter((node): node is SceneNode => !!node);
  if (list.length === 0) return "";
  const urls = await assetUrls(ids);
  const defs: string[] = [];
  if (list.length === 1) {
    const node = list[0];
    const outset = strokeOutset(node);
    const body = `<g${opacityAttribute(node)}>${serialize(node, defs, urls)}</g>`;
    return wrapSvg(-outset, -outset, node.width + outset * 2, node.height + outset * 2, defs, body);
  }
  const bounds = unionBounds(ids);
  if (!bounds) return "";
  let outset = 0;
  let body = "";
  for (const node of list) {
    outset = Math.max(outset, strokeOutset(node));
    const m = setWorld(mat(), node);
    const transform = `matrix(${round(m[0])} ${round(m[1])} ${round(m[2])} ${round(m[3])} ${round(m[4] - bounds.x)} ${round(m[5] - bounds.y)})`;
    body += `<g transform="${transform}"${opacityAttribute(node)}>${serialize(node, defs, urls)}</g>`;
  }
  return wrapSvg(-outset, -outset, bounds.width + outset * 2, bounds.height + outset * 2, defs, body);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportNodes(ids: readonly string[], format: ExportFormat, scale: number) {
  for (const id of ids) {
    const node = nodes.get(id);
    if (!node) continue;
    const reach = strokeOutset(node);
    if (node.width + reach <= 0 || node.height + reach <= 0) continue;
    const tree = collectSubtree(id);
    await Promise.all(tree.filter((item) => item.asset).map((item) => ensureBitmap(item.asset)));
    const blob = format === "svg" ? new Blob([await svgMarkup([id])], { type: "image/svg+xml" }) : await renderBitmap(node, scale, format);
    if (!blob) continue;
    const suffix = format !== "svg" && scale !== 1 ? `@${scale}x` : "";
    download(blob, `${node.name.replace(/[\\/:*?"<>|]/g, "-")}${suffix}.${format}`);
  }
}
