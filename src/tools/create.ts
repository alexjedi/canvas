import { createNode, nextName } from "../doc/create";
import { apply, frameAt, invert, mat, setWorld, type Mat } from "../doc/geometry";
import { abort, begin, edit, end, insertNodes } from "../doc/store";
import type { NodeKind } from "../doc/types";
import { grid } from "../editor/prefs";
import { editor, select, setTool } from "../editor/state";
import { prepareSnap, resetSnap, snapPoint } from "./snap";
import { moved, type Pointer, type Tool } from "./types";

const DEFAULT_SIZE = 100;

export function createShapeTool(kind: NodeKind): Tool {
  let start: Pointer | null = null;
  let id = "";
  let toLocal: Mat = mat();
  let dragged = false;
  let origin = { x: 0, y: 0 };

  function finish() {
    resetSnap();
    start = null;
    id = "";
    dragged = false;
    setTool("move");
  }

  return {
    cursor: "crosshair",
    down(pointer) {
      const parent = frameAt(editor.page, pointer.x, pointer.y);
      toLocal = invert(mat(), setWorld(mat(), parent ?? undefined));
      prepareSnap(parent?.id ?? editor.page, new Set());
      const snapped = snapPoint(pointer.x, pointer.y, true, true);
      const local = apply(toLocal, snapped.x, snapped.y);
      origin = { x: grid(local.x), y: grid(local.y) };
      const node = createNode(kind, { name: nextName(kind), x: origin.x, y: origin.y, width: 1, height: 1 });
      begin();
      insertNodes([node], parent?.id ?? editor.page);
      start = pointer;
      id = node.id;
      select([id]);
    },
    drag(pointer) {
      if (!start) return;
      dragged ||= moved(start, pointer);
      if (!dragged) return;
      const node = edit(id);
      if (!node) return;
      const snapped = pointer.shift ? pointer : snapPoint(pointer.x, pointer.y, true, true);
      const corner = apply(toLocal, snapped.x, snapped.y);
      let width = grid(corner.x) - origin.x;
      let height = grid(corner.y) - origin.y;
      if (pointer.shift) {
        const side = Math.max(Math.abs(width), Math.abs(height));
        width = side * (width < 0 ? -1 : 1);
        height = side * (height < 0 ? -1 : 1);
      }
      node.x = origin.x + Math.min(0, width);
      node.y = origin.y + Math.min(0, height);
      node.width = Math.max(1, Math.abs(width));
      node.height = Math.max(1, Math.abs(height));
    },
    up() {
      if (!start) return;
      if (!dragged) {
        const node = edit(id);
        if (node) {
          node.width = DEFAULT_SIZE;
          node.height = DEFAULT_SIZE;
        }
      }
      end();
      finish();
    },
    cancel() {
      if (!start) return;
      abort();
      select([]);
      finish();
    },
  };
}
