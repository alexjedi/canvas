import { apply, invert, mat, setLocal } from "../doc/geometry";
import { nodes } from "../doc/store";
import type { SceneNode } from "../doc/types";
import { camera, editor } from "./state";

export const LABEL_SIZE = 11;
export const LABEL_HEIGHT = 16;
export const LABEL_GAP = 4;

const MIN_FRAME = 24;
const CACHE_LIMIT = 2000;

const widths = new Map<string, number>();
const inverse = mat();
let context: CanvasRenderingContext2D | null = null;

export const labelFont = (ratio: number) => `${LABEL_SIZE * ratio}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

export function labelWidth(name: string): number {
  let width = widths.get(name);
  if (width !== undefined) return width;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return name.length * LABEL_SIZE * 0.6;
  context.font = labelFont(1);
  width = Math.ceil(context.measureText(name).width);
  if (widths.size > CACHE_LIMIT) widths.clear();
  widths.set(name, width);
  return width;
}

export const hasLabel = (node: SceneNode) => node.kind === "frame" && node.visible && node.width * camera.zoom >= MIN_FRAME;

export function labelAt(x: number, y: number): string {
  const page = nodes.get(editor.page);
  if (!page) return "";
  const reach = (LABEL_HEIGHT + LABEL_GAP) / camera.zoom;
  for (let i = page.children.length - 1; i >= 0; i--) {
    const node = nodes.get(page.children[i]);
    if (!node || node.locked || !hasLabel(node)) continue;
    const local = apply(invert(inverse, setLocal(inverse, node)), x, y);
    if (local.y < 0 && local.y >= -reach && local.x >= 0 && local.x <= labelWidth(node.name) / camera.zoom) return node.id;
  }
  return "";
}
