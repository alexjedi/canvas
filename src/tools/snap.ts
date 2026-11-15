import { isContainer, worldBounds } from "../doc/geometry";
import { nodes } from "../doc/store";
import type { Point, Rect } from "../doc/types";
import { prefs } from "../editor/prefs";
import { camera, setGuides, type Guide } from "../editor/state";

interface Line {
  value: number;
  min: number;
  max: number;
}

const THRESHOLD = 5;
const EPSILON = 1e-4;

let scope = "";
let vertical: Line[] = [];
let horizontal: Line[] = [];

function add(bounds: Rect) {
  const { x, y, width, height } = bounds;
  for (const value of [x, x + width / 2, x + width]) vertical.push({ value, min: y, max: y + height });
  for (const value of [y, y + height / 2, y + height]) horizontal.push({ value, min: x, max: x + width });
}

export function prepareSnap(parentId: string, exclude: ReadonlySet<string>) {
  if (scope === parentId) return;
  scope = parentId;
  vertical = [];
  horizontal = [];
  const parent = nodes.get(parentId);
  if (!parent || !prefs.snapObjects) return;
  if (!isContainer(parent) && parent.kind !== "group") add(worldBounds(parent));
  for (const id of parent.children) {
    const node = nodes.get(id);
    if (node && node.visible && !exclude.has(id)) add(worldBounds(node));
  }
}

export function resetSnap() {
  scope = "";
  vertical = [];
  horizontal = [];
  setGuides([]);
}

function nearest(lines: Line[], values: number[]): number {
  const threshold = THRESHOLD / camera.zoom;
  let best = 0;
  let distance = threshold;
  for (const line of lines) {
    for (const value of values) {
      const delta = line.value - value;
      if (Math.abs(delta) < distance) {
        distance = Math.abs(delta);
        best = delta;
      }
    }
  }
  return best;
}

function span(lines: Line[], value: number, min: number, max: number): [number, number] | null {
  let found = false;
  for (const line of lines) {
    if (Math.abs(line.value - value) > EPSILON) continue;
    found = true;
    if (line.min < min) min = line.min;
    if (line.max > max) max = line.max;
  }
  return found ? [min, max] : null;
}

export function showGuides(xs: number[], ys: number[], bounds: Rect) {
  const guides: Guide[] = [];
  for (const x of xs) {
    const range = span(vertical, x, bounds.y, bounds.y + bounds.height);
    if (range) guides.push({ x0: x, y0: range[0], x1: x, y1: range[1] });
  }
  for (const y of ys) {
    const range = span(horizontal, y, bounds.x, bounds.x + bounds.width);
    if (range) guides.push({ x0: range[0], y0: y, x1: range[1], y1: y });
  }
  setGuides(guides);
}

export function snapOffsets(x: number | null, y: number | null): Point {
  return { x: x === null ? 0 : nearest(vertical, [x]), y: y === null ? 0 : nearest(horizontal, [y]) };
}

export function snapBounds(bounds: Rect): Point {
  if (vertical.length === 0 && horizontal.length === 0) return { x: 0, y: 0 };
  const dx = nearest(vertical, [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width]);
  const dy = nearest(horizontal, [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height]);
  const moved = { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height };
  showGuides(
    [moved.x, moved.x + moved.width / 2, moved.x + moved.width],
    [moved.y, moved.y + moved.height / 2, moved.y + moved.height],
    moved,
  );
  return { x: dx, y: dy };
}

export function snapPoint(x: number, y: number, alongX: boolean, alongY: boolean): Point {
  if (vertical.length === 0 && horizontal.length === 0) return { x, y };
  const sx = alongX ? x + nearest(vertical, [x]) : x;
  const sy = alongY ? y + nearest(horizontal, [y]) : y;
  showGuides(alongX ? [sx] : [], alongY ? [sy] : [], { x: sx, y: sy, width: 0, height: 0 });
  return { x: sx, y: sy };
}
