import { edit, nodes } from "./store";
import type { SceneNode, VectorPath } from "./types";

export const STRIDE = 6;

const RAD = Math.PI / 180;
const KAPPA = 0.5522847498;
const SAMPLES = 24;
const MIN_SLOP = 4;

export type PathSink = Pick<CanvasPath, "moveTo" | "bezierCurveTo" | "closePath">;

interface Outline {
  width: number;
  height: number;
  path: Path2D;
}

const bounds = new Float64Array(4);
const outlines = new WeakMap<VectorPath[], Outline>();
let probe: CanvasRenderingContext2D | null = null;
let slop = MIN_SLOP;

export function setHitSlop(value: number) {
  slop = value;
}

export function tracePaths(sink: PathSink, paths: readonly VectorPath[], sx: number, sy: number) {
  for (const path of paths) {
    const p = path.points;
    const length = p.length;
    if (length < STRIDE * 2) continue;
    sink.moveTo(p[0] * sx, p[1] * sy);
    for (let i = STRIDE; i < length; i += STRIDE) {
      sink.bezierCurveTo(p[i - 2] * sx, p[i - 1] * sy, p[i + 2] * sx, p[i + 3] * sy, p[i] * sx, p[i + 1] * sy);
    }
    if (!path.closed) continue;
    sink.bezierCurveTo(p[length - 2] * sx, p[length - 1] * sy, p[2] * sx, p[3] * sy, p[0] * sx, p[1] * sy);
    sink.closePath();
  }
}

export const segmentCount = (path: VectorPath) => {
  const count = path.points.length / STRIDE;
  return count < 2 ? 0 : path.closed ? count : count - 1;
};

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

function include(axis: number, value: number) {
  if (value < bounds[axis]) bounds[axis] = value;
  if (value > bounds[axis + 2]) bounds[axis + 2] = value;
}

function includeExtremum(axis: number, p0: number, p1: number, p2: number, p3: number, t: number) {
  if (t > 0 && t < 1) include(axis, cubic(p0, p1, p2, p3, t));
}

function includeCubic(axis: number, p0: number, p1: number, p2: number, p3: number) {
  include(axis, p0);
  include(axis, p3);
  const a = p3 - 3 * p2 + 3 * p1 - p0;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) includeExtremum(axis, p0, p1, p2, p3, -c / b);
    return;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return;
  const root = Math.sqrt(discriminant);
  includeExtremum(axis, p0, p1, p2, p3, (-b + root) / (2 * a));
  includeExtremum(axis, p0, p1, p2, p3, (-b - root) / (2 * a));
}

function measure(paths: readonly VectorPath[]) {
  bounds[0] = Infinity;
  bounds[1] = Infinity;
  bounds[2] = -Infinity;
  bounds[3] = -Infinity;
  for (const path of paths) {
    const p = path.points;
    const count = p.length / STRIDE;
    if (count === 1) {
      include(0, p[0]);
      include(1, p[1]);
    }
    const segments = segmentCount(path);
    for (let i = 0; i < segments; i++) {
      const a = i * STRIDE;
      const b = ((i + 1) % count) * STRIDE;
      includeCubic(0, p[a], p[a + 4], p[b + 2], p[b]);
      includeCubic(1, p[a + 1], p[a + 5], p[b + 3], p[b + 1]);
    }
  }
  if (bounds[0] === Infinity) bounds.fill(0);
}

export function pixelPaths(node: SceneNode): VectorPath[] {
  const { width, height } = node;
  return node.paths.map((path) => {
    const points = path.points.slice();
    for (let i = 0; i < points.length; i += 2) {
      points[i] *= width;
      points[i + 1] *= height;
    }
    return { closed: path.closed, points };
  });
}

export function commitVector(id: string, pixels: readonly VectorPath[], baseX: number, baseY: number) {
  const node = edit(id);
  if (!node) return;
  measure(pixels);
  const minX = bounds[0];
  const minY = bounds[1];
  const width = bounds[2] - minX;
  const height = bounds[3] - minY;
  node.paths = pixels.map((path) => {
    const points = path.points.slice();
    for (let i = 0; i < points.length; i += 2) {
      points[i] = width > 0 ? (points[i] - minX) / width : 0;
      points[i + 1] = height > 0 ? (points[i + 1] - minY) / height : 0;
    }
    return { closed: path.closed, points };
  });
  const cos = Math.cos(node.rotation * RAD);
  const sin = Math.sin(node.rotation * RAD);
  node.x = baseX + cos * minX - sin * minY;
  node.y = baseY + sin * minX + cos * minY;
  node.width = width;
  node.height = height;
}

export function shapePaths(node: SceneNode): VectorPath[] {
  const { width: w, height: h } = node;
  if (node.kind === "ellipse") {
    const kx = (w / 2) * KAPPA;
    const ky = (h / 2) * KAPPA;
    const cx = w / 2;
    const cy = h / 2;
    return [
      {
        closed: true,
        points: [cx, 0, cx - kx, 0, cx + kx, 0, w, cy, w, cy - ky, w, cy + ky, cx, h, cx + kx, h, cx - kx, h, 0, cy, 0, cy + ky, 0, cy - ky],
      },
    ];
  }
  const r = Math.max(0, Math.min(node.radius, w / 2, h / 2));
  if (r === 0) return [{ closed: true, points: [0, 0, 0, 0, 0, 0, w, 0, w, 0, w, 0, w, h, w, h, w, h, 0, h, 0, h, 0, h] }];
  const k = r * KAPPA;
  return [
    {
      closed: true,
      points: [
        r, 0, r - k, 0, r, 0,
        w - r, 0, w - r, 0, w - r + k, 0,
        w, r, w, r - k, w, r,
        w, h - r, w, h - r, w, h - r + k,
        w - r, h, w - r + k, h, w - r, h,
        r, h, r, h, r - k, h,
        0, h - r, 0, h - r + k, 0, h - r,
        0, r, 0, r, 0, r - k,
      ],
    },
  ];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function splitSegment(path: VectorPath, segment: number, t: number): number {
  const p = path.points;
  const count = p.length / STRIDE;
  const a = segment * STRIDE;
  const b = ((segment + 1) % count) * STRIDE;
  const inserted: number[] = [0, 0, 0, 0, 0, 0];
  for (let axis = 0; axis < 2; axis++) {
    const p0 = p[a + axis];
    const c1 = p[a + 4 + axis];
    const c2 = p[b + 2 + axis];
    const p3 = p[b + axis];
    const out = mix(p0, c1, t);
    const middle = mix(c1, c2, t);
    const into = mix(c2, p3, t);
    const before = mix(out, middle, t);
    const after = mix(middle, into, t);
    p[a + 4 + axis] = out;
    p[b + 2 + axis] = into;
    inserted[axis] = mix(before, after, t);
    inserted[2 + axis] = before;
    inserted[4 + axis] = after;
  }
  p.splice(a + STRIDE, 0, ...inserted);
  return segment + 1;
}

export interface SegmentHit {
  path: number;
  segment: number;
  t: number;
  distance: number;
}

export function nearestSegment(paths: readonly VectorPath[], x: number, y: number): SegmentHit | null {
  let best: SegmentHit | null = null;
  for (let index = 0; index < paths.length; index++) {
    const p = paths[index].points;
    const count = p.length / STRIDE;
    const segments = segmentCount(paths[index]);
    for (let segment = 0; segment < segments; segment++) {
      const a = segment * STRIDE;
      const b = ((segment + 1) % count) * STRIDE;
      for (let step = 1; step < SAMPLES; step++) {
        const t = step / SAMPLES;
        const distance = Math.hypot(cubic(p[a], p[a + 4], p[b + 2], p[b], t) - x, cubic(p[a + 1], p[a + 5], p[b + 3], p[b + 1], t) - y);
        if (!best || distance < best.distance) best = { path: index, segment, t, distance };
      }
    }
  }
  return best;
}

export function toggleSmooth(path: VectorPath, index: number) {
  const p = path.points;
  const count = p.length / STRIDE;
  const o = index * STRIDE;
  const ax = p[o];
  const ay = p[o + 1];
  if (p[o + 2] !== ax || p[o + 3] !== ay || p[o + 4] !== ax || p[o + 5] !== ay) {
    p[o + 2] = p[o + 4] = ax;
    p[o + 3] = p[o + 5] = ay;
    return;
  }
  const previous = index > 0 ? index - 1 : path.closed ? count - 1 : -1;
  const next = index < count - 1 ? index + 1 : path.closed ? 0 : -1;
  const px = previous < 0 ? ax : p[previous * STRIDE];
  const py = previous < 0 ? ay : p[previous * STRIDE + 1];
  const nx = next < 0 ? ax : p[next * STRIDE];
  const ny = next < 0 ? ay : p[next * STRIDE + 1];
  const length = Math.hypot(nx - px, ny - py);
  if (length === 0) return;
  const ux = (nx - px) / length;
  const uy = (ny - py) / length;
  const reachIn = Math.hypot(ax - px, ay - py) / 3;
  const reachOut = Math.hypot(nx - ax, ny - ay) / 3;
  p[o + 2] = ax - ux * reachIn;
  p[o + 3] = ay - uy * reachIn;
  p[o + 4] = ax + ux * reachOut;
  p[o + 5] = ay + uy * reachOut;
}

export function locatePoint(paths: readonly VectorPath[], global: number): [number, number] {
  let rest = global;
  for (let index = 0; index < paths.length; index++) {
    const count = paths[index].points.length / STRIDE;
    if (rest < count) return [index, rest];
    rest -= count;
  }
  return [-1, -1];
}

export function globalPoint(paths: readonly VectorPath[], path: number, index: number): number {
  let total = index;
  for (let i = 0; i < path; i++) total += paths[i].points.length / STRIDE;
  return total;
}

export function removePoints(id: string, selected: readonly number[]): boolean {
  const node = nodes.get(id);
  if (!node) return false;
  const doomed = new Set(selected);
  let global = 0;
  const kept: VectorPath[] = [];
  for (const path of pixelPaths(node)) {
    const points: number[] = [];
    for (let i = 0; i < path.points.length; i += STRIDE, global++) {
      if (!doomed.has(global)) for (let k = 0; k < STRIDE; k++) points.push(path.points[i + k]);
    }
    if (points.length >= STRIDE * 2) kept.push({ closed: path.closed && points.length >= STRIDE * 3, points });
  }
  if (kept.length === 0) return false;
  commitVector(id, kept, node.x, node.y);
  return true;
}

function outlineOf(node: SceneNode): Path2D {
  const cached = outlines.get(node.paths);
  if (cached && cached.width === node.width && cached.height === node.height) return cached.path;
  const path = new Path2D();
  tracePaths(path, node.paths, node.width, node.height);
  outlines.set(node.paths, { width: node.width, height: node.height, path });
  return path;
}

export function hitVector(node: SceneNode, x: number, y: number): boolean {
  const reach = Math.max(slop, (node.stroke?.width ?? 0) / 2);
  if (x < -reach || y < -reach || x > node.width + reach || y > node.height + reach) return false;
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) return true;
  const path = outlineOf(node);
  if (node.fill && probe.isPointInPath(path, x, y)) return true;
  probe.lineWidth = reach * 2;
  return probe.isPointInStroke(path, x, y);
}
