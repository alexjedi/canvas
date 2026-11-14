import { ensureBitmap, getBitmap, getBlob } from "../doc/assets";
import { collectSubtree } from "../doc/create";
import { nodes } from "../doc/store";
import type { SceneNode } from "../doc/types";
import { cornerRadius, paintNode, strokeOutset, tracePath, type Context } from "./raster";

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

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

function shape(node: SceneNode, offset: number, attributes: string): string {
  const { width, height } = node;
  if (node.kind === "ellipse") {
    return `<ellipse cx="${round(width / 2)}" cy="${round(height / 2)}" rx="${round(Math.max(0, width / 2 + offset))}" ry="${round(Math.max(0, height / 2 + offset))}"${attributes}/>`;
  }
  const radius = cornerRadius(node);
  const corner = radius > 0 ? ` rx="${round(Math.max(0, radius + offset))}"` : "";
  return `<rect x="${round(-offset)}" y="${round(-offset)}" width="${round(width + offset * 2)}" height="${round(height + offset * 2)}"${corner}${attributes}/>`;
}

function serialize(node: SceneNode, defs: string[], urls: Map<string, string>): string {
  const { fill, stroke } = node;
  const parts: string[] = [];
  if (fill) parts.push(shape(node, 0, ` fill="${fill.color}" fill-opacity="${round(fill.opacity)}"`));
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
    const offset = stroke.align === "inside" ? -stroke.width / 2 : stroke.align === "outside" ? stroke.width / 2 : 0;
    parts.push(
      shape(node, offset, ` fill="none" stroke="${stroke.color}" stroke-width="${round(stroke.width)}" stroke-opacity="${round(stroke.opacity)}"`),
    );
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

async function renderSvg(node: SceneNode, tree: SceneNode[]): Promise<Blob> {
  const urls = new Map<string, string>();
  for (const item of tree) {
    const blob = item.asset && !urls.has(item.asset) ? getBlob(item.asset) : undefined;
    if (blob) urls.set(item.asset, await readDataUrl(blob));
  }
  const outset = strokeOutset(node);
  const width = round(node.width + outset * 2);
  const height = round(node.height + outset * 2);
  const defs: string[] = [];
  const body = serialize(node, defs, urls);
  const opacity = node.opacity < 1 ? ` opacity="${round(node.opacity)}"` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${round(-outset)} ${round(-outset)} ${width} ${height}">` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    `<g${opacity}>${body}</g></svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
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
    if (!node || node.width <= 0 || node.height <= 0) continue;
    const tree = collectSubtree(id);
    await Promise.all(tree.filter((item) => item.asset).map((item) => ensureBitmap(item.asset)));
    const blob = format === "svg" ? await renderSvg(node, tree) : await renderBitmap(node, scale, format);
    if (!blob) continue;
    const suffix = format !== "svg" && scale !== 1 ? `@${scale}x` : "";
    download(blob, `${node.name.replace(/[\\/:*?"<>|]/g, "-")}${suffix}.${format}`);
  }
}
