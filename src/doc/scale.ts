import { collectSubtree } from "./create";
import { edit } from "./store";
import type { SceneNode, TextRun } from "./types";

export interface StyleOrigin {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  strokeWidth: number;
  gap: number;
  gapCross: number;
  padding: [number, number, number, number];
  fontSize: number;
  letterSpacing: number;
  runs: TextRun[];
}

export function captureStyles(id: string): StyleOrigin[] {
  return collectSubtree(id).map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    radius: item.radius,
    strokeWidth: item.stroke?.width ?? 0,
    gap: item.gap,
    gapCross: item.gapCross,
    padding: [item.paddingTop, item.paddingRight, item.paddingBottom, item.paddingLeft],
    fontSize: item.fontSize,
    letterSpacing: item.letterSpacing,
    runs: item.runs,
  }));
}

export function applyStyles(origins: readonly StyleOrigin[], root: SceneNode, factor: number) {
  for (const item of origins) {
    const scaled = item.id === root.id ? root : edit(item.id);
    if (!scaled) continue;
    if (item.id !== root.id) {
      scaled.x = item.x * factor;
      scaled.y = item.y * factor;
      scaled.width = item.width * factor;
      scaled.height = item.height * factor;
    }
    scaled.radius = item.radius * factor;
    scaled.gap = item.gap * factor;
    scaled.gapCross = item.gapCross * factor;
    scaled.paddingTop = item.padding[0] * factor;
    scaled.paddingRight = item.padding[1] * factor;
    scaled.paddingBottom = item.padding[2] * factor;
    scaled.paddingLeft = item.padding[3] * factor;
    scaled.fontSize = item.fontSize * factor;
    scaled.letterSpacing = item.letterSpacing * factor;
    if (item.runs.length > 0) {
      scaled.runs = item.runs.map((run) => ({ ...run, fontSize: run.fontSize * factor, letterSpacing: run.letterSpacing * factor }));
    }
    if (scaled.stroke && item.strokeWidth > 0) scaled.stroke = { ...scaled.stroke, width: item.strokeWidth * factor };
  }
}
