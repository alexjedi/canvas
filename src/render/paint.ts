import type { Gradient, GradientStop, Paint } from "../doc/types";

export type Surface = OffscreenCanvas | HTMLCanvasElement;
export type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const RAD = Math.PI / 180;
const FAR = 1e6;

let layer: Context | null = null;

export function stopColor(stop: GradientStop): string {
  const value = parseInt(stop.color.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${stop.opacity})`;
}

export function linearAxis(angle: number, width: number, height: number): [number, number, number, number] {
  const cos = Math.cos(angle * RAD);
  const sin = Math.sin(angle * RAD);
  const half = (Math.abs(width * cos) + Math.abs(height * sin)) / 2;
  return [width / 2 - cos * half, height / 2 - sin * half, width / 2 + cos * half, height / 2 + sin * half];
}

export const radialStretch = (paint: Paint, width: number, height: number) =>
  paint.gradient?.type === "radial" && width > 0 && height > 0 ? height / width : 1;

function createGradient(ctx: Context, gradient: Gradient, width: number, height: number): CanvasGradient {
  if (gradient.type === "linear") {
    const axis = linearAxis(gradient.angle, width, height);
    return ctx.createLinearGradient(axis[0], axis[1], axis[2], axis[3]);
  }
  if (width > 0 && height > 0) return ctx.createRadialGradient(width / 2, width / 2, 0, width / 2, width / 2, width / 2);
  return ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height, 1) / 2);
}

export function paintStyle(ctx: Context, paint: Paint, width: number, height: number): string | CanvasGradient {
  const gradient = paint.gradient;
  if (!gradient || gradient.stops.length === 0) return paint.color;
  const style = createGradient(ctx, gradient, width, height);
  for (const stop of gradient.stops) style.addColorStop(Math.min(1, Math.max(0, stop.offset)), stopColor(stop));
  return style;
}

export function paintThrough(ctx: Context, paint: Paint, width: number, height: number, alpha: number, draw: (target: Context) => void) {
  const stretch = radialStretch(paint, width, height);
  if (stretch === 1) {
    const style = paintStyle(ctx, paint, width, height);
    ctx.globalAlpha = alpha * paint.opacity;
    ctx.fillStyle = style;
    ctx.strokeStyle = style;
    draw(ctx);
    return;
  }
  const canvas = ctx.canvas;
  layer ??= (typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1)).getContext("2d") as Context | null;
  if (!layer) return;
  layer.canvas.width = canvas.width;
  layer.canvas.height = canvas.height;
  layer.setTransform(ctx.getTransform());
  draw(layer);
  layer.globalCompositeOperation = "source-in";
  layer.scale(1, stretch);
  layer.fillStyle = paintStyle(layer, paint, width, height);
  layer.fillRect(-FAR, -FAR, FAR * 2, FAR * 2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha * paint.opacity;
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}
