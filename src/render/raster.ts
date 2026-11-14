import type { SceneNode } from "../doc/types";

type Surface = OffscreenCanvas | HTMLCanvasElement;
type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

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

function paintBox(ctx: Context, node: SceneNode) {
  const { width, height, fill, stroke } = node;
  const radius = Math.max(0, Math.min(node.radius, width / 2, height / 2));
  if (fill) {
    ctx.globalAlpha = fill.opacity;
    ctx.fillStyle = fill.color;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.fill();
  }
  if (!stroke || stroke.width <= 0) return;
  const offset = stroke.align === "inside" ? -stroke.width / 2 : stroke.align === "outside" ? stroke.width / 2 : 0;
  ctx.globalAlpha = stroke.opacity;
  if (width + offset * 2 <= 0 || height + offset * 2 <= 0) {
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  ctx.roundRect(-offset, -offset, width + offset * 2, height + offset * 2, radius > 0 ? Math.max(0, radius + offset) : 0);
  ctx.stroke();
}

export function rasterize(node: SceneNode, x: number, y: number, scale: number, pixelWidth: number, pixelHeight: number): Surface | null {
  const ctx = ensure();
  if (!ctx || !surface) return null;
  surface.width = pixelWidth;
  surface.height = pixelHeight;
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  paintBox(ctx, node);
  return surface;
}
