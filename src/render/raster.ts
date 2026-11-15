import { getBitmap } from "../doc/assets";
import { layoutText, type TextLayout } from "../doc/text";
import type { Paint, SceneNode } from "../doc/types";
import { tracePaths } from "../doc/vector";
import { paintStyle, paintThrough, radialStretch, type Context, type Surface } from "./paint";

export type { Context } from "./paint";

const PLACEHOLDER = "#8a8a8a";
const VECTOR_MITER = 4;
const DEFAULT_MITER = 10;

let surface: Surface | null = null;
let context: Context | null = null;

function ensure(): Context | null {
  if (context) return context;
  surface = typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
  context = surface.getContext("2d") as Context | null;
  return context;
}

export const isFreeform = (node: SceneNode) => node.kind === "vector" || node.kind === "text";

export function strokeOutset(node: SceneNode): number {
  const stroke = node.stroke;
  if (!stroke || stroke.width <= 0) return 0;
  if (node.kind === "vector") return (stroke.width * VECTOR_MITER) / 2;
  if (node.kind === "text") return stroke.width / 2;
  return stroke.align === "outside" ? stroke.width : stroke.align === "center" ? stroke.width / 2 : 0;
}

const GLYPH_OVERHANG = 0.5;

export const paintOutset = (node: SceneNode) => strokeOutset(node) + (node.kind === "text" ? node.fontSize * GLYPH_OVERHANG : 0);

export const strokeOffset = (node: SceneNode) => {
  const stroke = node.stroke;
  if (!stroke || isFreeform(node)) return 0;
  return stroke.align === "inside" ? -stroke.width / 2 : stroke.align === "outside" ? stroke.width / 2 : 0;
};

export const cornerRadius = (node: SceneNode) =>
  node.kind === "ellipse" || isFreeform(node) ? 0 : Math.max(0, Math.min(node.radius, node.width / 2, node.height / 2));

export function tracePath(ctx: Context, node: SceneNode, offset = 0) {
  const { width, height } = node;
  ctx.beginPath();
  if (node.kind === "vector") {
    tracePaths(ctx, node.paths, width, height);
    return;
  }
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

function fillShape(ctx: Context, node: SceneNode, paint: Paint, alpha: number) {
  const stretch = radialStretch(paint, node.width, node.height);
  ctx.globalAlpha = alpha * paint.opacity;
  ctx.fillStyle = paintStyle(ctx, paint, node.width, node.height);
  tracePath(ctx, node);
  if (stretch === 1) {
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.scale(1, stretch);
  ctx.fill();
  ctx.restore();
}

export function lineOrigin(node: SceneNode, layout: TextLayout, index: number): number {
  if (layout.align === "left") return 0;
  const free = node.width - layout.widths[index];
  return layout.align === "center" ? free / 2 : free;
}

function drawText(target: Context, node: SceneNode, layout: TextLayout, outlined: boolean) {
  target.font = layout.font;
  target.letterSpacing = layout.spacing;
  target.textBaseline = "alphabetic";
  target.textAlign = "left";
  for (let i = 0; i < layout.lines.length; i++) {
    const x = lineOrigin(node, layout, i);
    const y = layout.baseline + i * layout.lineHeight;
    if (outlined) target.strokeText(layout.lines[i], x, y);
    else target.fillText(layout.lines[i], x, y);
  }
}

function paintText(ctx: Context, node: SceneNode, alpha: number) {
  const { width, height, fill, stroke } = node;
  const layout = layoutText(node);
  if (fill) paintThrough(ctx, fill, width, height, alpha, (target) => drawText(target, node, layout, false));
  if (!stroke || stroke.width <= 0) return;
  paintThrough(ctx, stroke, width, height, alpha, (target) => {
    target.lineWidth = stroke.width;
    target.lineJoin = "round";
    drawText(target, node, layout, true);
  });
}

export function paintNode(ctx: Context, node: SceneNode, alpha = 1) {
  if (node.kind === "text") {
    paintText(ctx, node, alpha);
    return;
  }
  const { width, height, fill, stroke } = node;
  if (fill) fillShape(ctx, node, fill, alpha);
  if (node.kind === "image") paintImage(ctx, node, alpha);
  if (!stroke || stroke.width <= 0) return;
  const offset = strokeOffset(node);
  if (offset < 0 && (width + offset * 2 <= 0 || height + offset * 2 <= 0)) {
    fillShape(ctx, node, stroke, alpha);
    return;
  }
  paintThrough(ctx, stroke, width, height, alpha, (target) => {
    target.lineWidth = stroke.width;
    target.lineJoin = "miter";
    target.miterLimit = node.kind === "vector" ? VECTOR_MITER : DEFAULT_MITER;
    tracePath(target, node, offset);
    target.stroke();
  });
}

export function isPaintable(node: SceneNode): boolean {
  if (node.kind === "group" || (!node.fill && !node.stroke && node.kind !== "image")) return false;
  if (node.kind === "vector") return node.paths.length > 0;
  if (node.kind === "text") return node.text !== "";
  return node.width > 0 && node.height > 0;
}

export function rasterize(node: SceneNode, x: number, y: number, scale: number, pixelWidth: number, pixelHeight: number): Surface | null {
  const ctx = ensure();
  if (!ctx || !surface) return null;
  surface.width = pixelWidth;
  surface.height = pixelHeight;
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  paintNode(ctx, node);
  return surface;
}
