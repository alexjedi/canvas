import { centerStroke, createNode, nextName } from "../doc/create";
import { apply, frameAt, invert, mat, setWorld } from "../doc/geometry";
import { abort, begin, end, insertNodes, nodes } from "../doc/store";
import type { SceneNode, VectorPath } from "../doc/types";
import { commitVector, pixelPaths, STRIDE } from "../doc/vector";
import { grid } from "../editor/prefs";
import { camera, editor, select, setEditing, setPen } from "../editor/state";
import { moved, type Pointer, type Tool } from "./types";

const CLOSE_REACH = 8;

export function createPenTool(): Tool {
  let id = "";
  let continuing = false;
  let start: Pointer | null = null;
  let base: VectorPath[] = [];
  let baseX = 0;
  let baseY = 0;
  let path = 0;
  let point = 0;
  let closing = false;
  const inverse = mat();

  function capture(node: SceneNode) {
    id = node.id;
    invert(inverse, setWorld(inverse, node));
    base = pixelPaths(node);
    baseX = node.x;
    baseY = node.y;
  }

  function create(pointer: Pointer): SceneNode {
    const parent = frameAt(editor.page, pointer.x, pointer.y);
    const origin = apply(invert(mat(), setWorld(mat(), parent ?? undefined)), grid(pointer.x), grid(pointer.y));
    const node = createNode("vector", {
      name: nextName("vector"),
      x: origin.x,
      y: origin.y,
      paths: [{ closed: false, points: [0, 0, 0, 0, 0, 0] }],
      stroke: centerStroke(),
    });
    insertNodes([node], parent?.id ?? editor.page);
    select([node.id]);
    setEditing(node.id);
    return node;
  }

  function extend(pointer: Pointer) {
    const exact = apply(inverse, pointer.x, pointer.y);
    const snapped = apply(inverse, grid(pointer.x), grid(pointer.y));
    const current = base[base.length - 1];
    if (!continuing || !current || current.closed) {
      base.push({ closed: false, points: [snapped.x, snapped.y, snapped.x, snapped.y, snapped.x, snapped.y] });
      path = base.length - 1;
      point = 0;
      continuing = true;
      return;
    }
    path = base.length - 1;
    const points = current.points;
    const reach = CLOSE_REACH / camera.zoom;
    if (points.length >= STRIDE * 2 && Math.hypot(points[0] - exact.x, points[1] - exact.y) <= reach) {
      current.closed = true;
      closing = true;
      continuing = false;
      point = 0;
      return;
    }
    points.push(snapped.x, snapped.y, snapped.x, snapped.y, snapped.x, snapped.y);
    point = points.length / STRIDE - 1;
  }

  return {
    cursor: "crosshair",

    hover(pointer) {
      setPen(continuing && editor.editing === id ? { x: pointer.x, y: pointer.y } : null);
      return "crosshair";
    },

    down(pointer) {
      const edited = nodes.get(editor.editing);
      const existing = edited?.kind === "vector" ? edited : undefined;
      if (!existing || existing.id !== id) continuing = false;
      start = pointer;
      closing = false;
      begin();
      if (!existing) {
        capture(create(pointer));
        path = 0;
        point = 0;
        continuing = true;
        return;
      }
      capture(existing);
      extend(pointer);
      commitVector(id, base, baseX, baseY);
    },

    drag(pointer) {
      if (!start || !moved(start, pointer)) return;
      const points = base[path]?.points;
      if (!points) return;
      const local = apply(inverse, pointer.x, pointer.y);
      const o = point * STRIDE;
      points[o + 2] = points[o] * 2 - local.x;
      points[o + 3] = points[o + 1] * 2 - local.y;
      if (!closing) {
        points[o + 4] = local.x;
        points[o + 5] = local.y;
      }
      commitVector(id, base, baseX, baseY);
    },

    up(pointer) {
      if (!start) return;
      start = null;
      end();
      setPen(continuing ? { x: pointer.x, y: pointer.y } : null);
    },

    cancel() {
      if (!start) return;
      start = null;
      continuing = false;
      abort();
      setPen(null);
    },
  };
}
