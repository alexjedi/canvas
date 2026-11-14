import { getBitmap } from "../doc/assets";
import type { SceneNode } from "../doc/types";

type Surface = OffscreenCanvas | HTMLCanvasElement;
export type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const PLACEHOLDER = "#8a8a8a";

let surface: Surface | null = null;
let context: Context | null = null;

function ensure(): Context | null {
  if (context) return context;
  surface = typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
  context = surface.getContext("2d") as Context | null;
  return context;
}

export function strokeOutset(node: SceneNode): number {
  const stroke = node.stroke;
  if (!stroke || stroke.width <= 0) return 0;
  return stroke.align === "outside" ? stroke.width : stroke.align === "center" ? stroke.width / 2 : 0;
}

export const cornerRadius = (node: SceneNode) => (node.kind === "ellipse" ? 0 : Math.max(0, Math.min(node.radius, node.width / 2, node.height / 2)));

export function tracePath(ctx: Context, node: SceneNode, offset = 0) {
  const { width, height } = node;
  ctx.beginPath();
  if (node.kind === "ellipse") {
    ctx.ellipse(width / 2, height / 2, Math.max(0, width / 2 + offset), Math.max(0, height / 2 + offset), 0, 0, Math.PI * 2);
    return;
  }
  const radius = cornerRadius(node);
  ctx.roundRect(-offset, -offset, width + offset * 2, height + offset * 2, radius > 0 ? Math.max(0, radius + offset) : 0);
}

function paintImage(ctx: Context, node: SceneNode, alpha: number) {
  const bitmap = getBitmap(node.asset);
  const { width, height } = node;
  ctx.save();
  tracePath(ctx, node);
  ctx.clip();
  ctx.globalAlpha = alpha;
  if (!bitmap) {
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = PLACEHOLDER;
    ctx.fillRect(0, 0, width, height);
  } else if (node.fit === "stretch") {
    ctx.drawImage(bitmap, 0, 0, width, height);
  } else if (node.fit === "tile") {
    const pattern = ctx.createPattern(bitmap, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const ratio = node.fit === "cover" ? Math.max(width / bitmap.width, height / bitmap.height) : Math.min(width / bitmap.width, height / bitmap.height);
    const drawWidth = bitmap.width * ratio;
    const drawHeight = bitmap.height * ratio;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  ctx.restore();
}

export function paintNode(ctx: Context, node: SceneNode, alpha = 1) {
  const { width, height, fill, stroke } = node;
  if (fill) {
    ctx.globalAlpha = alpha * fill.opacity;
    ctx.fillStyle = fill.color;
    tracePath(ctx, node);
    ctx.fill();
  }
  if (node.kind === "image") paintImage(ctx, node, alpha);
  if (!stroke || stroke.width <= 0) return;
  const offset = stroke.align === "inside" ? -stroke.width / 2 : stroke.align === "outside" ? stroke.width / 2 : 0;
  ctx.globalAlpha = alpha * stroke.opacity;
  if (width + offset * 2 <= 0 || height + offset * 2 <= 0) {
    ctx.fillStyle = stroke.color;
    tracePath(ctx, node);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  tracePath(ctx, node, offset);
  ctx.stroke();
}

export const isPaintable = (node: SceneNode) => node.kind !== "group" && (!!node.fill || !!node.stroke || node.kind === "image");

export function rasterize(node: SceneNode, x: number, y: number, scale: number, pixelWidth: number, pixelHeight: number): Surface | null {
  const ctx = ensure();
  if (!ctx || !surface) return null;
  surface.width = pixelWidth;
  surface.height = pixelHeight;
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  paintNode(ctx, node);
  return surface;
}
