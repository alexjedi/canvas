import { createNode, nextName } from "../doc/create";
import { apply, frameAt, invert, mat, setWorld, type Mat } from "../doc/geometry";
import { abort, begin, edit, end, insertNodes } from "../doc/store";
import type { NodeKind } from "../doc/types";
import { editor, select, setTool } from "../editor/state";
import { moved, type Pointer, type Tool } from "./types";

const DEFAULT_SIZE = 100;

export function createShapeTool(kind: NodeKind): Tool {
  let start: Pointer | null = null;
  let id = "";
  let toLocal: Mat = mat();
  let dragged = false;

  function finish() {
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
      const origin = apply(toLocal, pointer.x, pointer.y);
      const node = createNode(kind, { name: nextName(kind), x: Math.round(origin.x), y: Math.round(origin.y), width: 1, height: 1 });
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
      const a = apply(toLocal, start.x, start.y);
      const b = apply(toLocal, pointer.x, pointer.y);
      let width = Math.round(b.x) - Math.round(a.x);
      let height = Math.round(b.y) - Math.round(a.y);
      if (pointer.shift) {
        const side = Math.max(Math.abs(width), Math.abs(height));
        width = side * (width < 0 ? -1 : 1);
        height = side * (height < 0 ? -1 : 1);
      }
      node.x = Math.round(a.x) + Math.min(0, width);
      node.y = Math.round(a.y) + Math.min(0, height);
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
