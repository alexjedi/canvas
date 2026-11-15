import { apply, invert, mat, setWorld } from "../doc/geometry";
import { abort, begin, end, nodes } from "../doc/store";
import type { VectorPath } from "../doc/types";
import { commitVector, globalPoint, locatePoint, nearestSegment, pixelPaths, splitSegment, STRIDE, toggleSmooth, type SegmentHit } from "../doc/vector";
import { grid } from "../editor/prefs";
import { camera, editor, setEditing, setHover, setPoints } from "../editor/state";
import { DRAG_THRESHOLD, type Tool } from "./types";

type Mode = "idle" | "points" | "handle" | "segment" | "pull";

interface Grab {
  path: number;
  index: number;
  side: number;
}

const REACH = 6;
const COLLINEAR = 0.02;

const clonePaths = (paths: readonly VectorPath[]): VectorPath[] => paths.map((path) => ({ closed: path.closed, points: path.points.slice() }));

export function createPointsTool(): Tool {
  let mode: Mode = "idle";
  let id = "";
  let base: VectorPath[] = [];
  let baseX = 0;
  let baseY = 0;
  let startX = 0;
  let startY = 0;
  let grab: Grab = { path: 0, index: 0, side: 2 };
  let mirrored = false;
  let segment: SegmentHit | null = null;
  let dragged = false;
  let startScreenX = 0;
  let startScreenY = 0;
  let reachOpposite = 0;
  const inverse = mat();

  function handleAt(x: number, y: number, reach: number): Grab | null {
    for (const global of editor.points) {
      const [path, index] = locatePoint(base, global);
      if (path < 0) continue;
      const p = base[path].points;
      const o = index * STRIDE;
      for (let side = 4; side >= 2; side -= 2) {
        if (p[o + side] === p[o] && p[o + side + 1] === p[o + 1]) continue;
        if (Math.hypot(p[o + side] - x, p[o + side + 1] - y) <= reach) return { path, index, side };
      }
    }
    return null;
  }

  function anchorAt(x: number, y: number, reach: number): Grab | null {
    let best: Grab | null = null;
    let nearest = reach;
    for (let path = 0; path < base.length; path++) {
      const p = base[path].points;
      for (let o = 0; o < p.length; o += STRIDE) {
        const distance = Math.hypot(p[o] - x, p[o + 1] - y);
        if (distance <= nearest) {
          nearest = distance;
          best = { path, index: o / STRIDE, side: 0 };
        }
      }
    }
    return best;
  }

  function startHandle(found: Grab) {
    grab = found;
    const p = base[found.path].points;
    const o = found.index * STRIDE;
    const other = found.side === 2 ? 4 : 2;
    const hx = p[o + found.side] - p[o];
    const hy = p[o + found.side + 1] - p[o + 1];
    const ox = p[o + other] - p[o];
    const oy = p[o + other + 1] - p[o + 1];
    reachOpposite = Math.hypot(ox, oy);
    const cross = Math.abs(hx * oy - hy * ox);
    mirrored = reachOpposite > 0 && hx * ox + hy * oy < 0 && cross <= COLLINEAR * Math.hypot(hx, hy) * reachOpposite;
    begin();
    mode = "handle";
  }

  function movePoints(dx: number, dy: number) {
    const next = clonePaths(base);
    for (const global of editor.points) {
      const [path, index] = locatePoint(next, global);
      if (path < 0) continue;
      const p = next[path].points;
      const o = index * STRIDE;
      for (let k = 0; k < STRIDE; k += 2) {
        p[o + k] += dx;
        p[o + k + 1] += dy;
      }
    }
    commitVector(id, next, baseX, baseY);
  }

  function moveHandle(x: number, y: number, free: boolean) {
    const next = clonePaths(base);
    const p = next[grab.path].points;
    const o = grab.index * STRIDE;
    const other = grab.side === 2 ? 4 : 2;
    p[o + grab.side] = x;
    p[o + grab.side + 1] = y;
    const length = Math.hypot(x - p[o], y - p[o + 1]);
    if (mirrored && !free && length > 0) {
      p[o + other] = p[o] - ((x - p[o]) / length) * reachOpposite;
      p[o + other + 1] = p[o + 1] - ((y - p[o + 1]) / length) * reachOpposite;
    }
    commitVector(id, next, baseX, baseY);
  }

  function bendSegment(dx: number, dy: number) {
    if (!segment) return;
    const next = clonePaths(base);
    const p = next[segment.path].points;
    const count = p.length / STRIDE;
    const a = segment.segment * STRIDE;
    const b = ((segment.segment + 1) % count) * STRIDE;
    const t = segment.t;
    const u = 1 - t;
    const weight = 3 * t * u * (u * u + t * t);
    p[a + 4] += (dx * u) / weight;
    p[a + 5] += (dy * u) / weight;
    p[b + 2] += (dx * t) / weight;
    p[b + 3] += (dy * t) / weight;
    commitVector(id, next, baseX, baseY);
  }

  function pullHandles(x: number, y: number) {
    const next = clonePaths(base);
    const p = next[grab.path].points;
    const o = grab.index * STRIDE;
    p[o + 4] = x;
    p[o + 5] = y;
    p[o + 2] = p[o] * 2 - x;
    p[o + 3] = p[o + 1] * 2 - y;
    commitVector(id, next, baseX, baseY);
  }

  return {
    cursor: "default",

    hover() {
      setHover("");
      return "default";
    },

    down(pointer) {
      const node = nodes.get(editor.editing);
      mode = "idle";
      if (!node || node.kind !== "vector") return;
      id = node.id;
      invert(inverse, setWorld(inverse, node));
      base = pixelPaths(node);
      baseX = node.x;
      baseY = node.y;
      const local = apply(inverse, pointer.x, pointer.y);
      startX = local.x;
      startY = local.y;
      const reach = REACH / camera.zoom;
      dragged = false;
      startScreenX = pointer.sx;
      startScreenY = pointer.sy;

      const handle = handleAt(local.x, local.y, reach);
      if (handle) {
        startHandle(handle);
        return;
      }

      const anchor = anchorAt(local.x, local.y, reach);
      if (anchor) {
        const global = globalPoint(base, anchor.path, anchor.index);
        if (pointer.alt) {
          grab = anchor;
          setPoints([global]);
          begin();
          mode = "pull";
          return;
        }
        const selected = editor.points.includes(global);
        if (pointer.shift) setPoints(selected ? editor.points.filter((other) => other !== global) : [...editor.points, global]);
        else if (!selected) setPoints([global]);
        begin();
        mode = "points";
        return;
      }

      const near = nearestSegment(base, local.x, local.y);
      if (near && near.distance <= reach) {
        segment = near;
        setPoints([]);
        begin();
        mode = "segment";
        return;
      }

      if (pointer.clicks > 1) setEditing("");
      else setPoints([]);
    },

    drag(pointer) {
      if (mode === "idle") return;
      if (!dragged && Math.hypot(pointer.sx - startScreenX, pointer.sy - startScreenY) <= DRAG_THRESHOLD) return;
      dragged = true;
      const local = apply(inverse, pointer.x, pointer.y);
      if (mode === "points") movePoints(grid(local.x - startX), grid(local.y - startY));
      else if (mode === "segment") bendSegment(local.x - startX, local.y - startY);
      else if (mode === "pull") pullHandles(local.x, local.y);
      else moveHandle(local.x, local.y, pointer.alt);
    },

    up() {
      if (mode === "segment" && !dragged && segment) {
        const index = splitSegment(base[segment.path], segment.segment, segment.t);
        commitVector(id, base, baseX, baseY);
        setPoints([globalPoint(base, segment.path, index)]);
      } else if (mode === "pull" && !dragged) {
        toggleSmooth(base[grab.path], grab.index);
        commitVector(id, base, baseX, baseY);
      }
      if (mode !== "idle") end();
      mode = "idle";
      segment = null;
    },

    cancel() {
      if (mode !== "idle") abort();
      mode = "idle";
    },
  };
}
