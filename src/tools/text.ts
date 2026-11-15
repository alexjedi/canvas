import { createNode, nextName } from "../doc/create";
import { apply, frameAt, hitTest, invert, mat, setWorld } from "../doc/geometry";
import { insertNodes, transact } from "../doc/store";
import { grid } from "../editor/prefs";
import { editor, select, setEditing, setMarquee, setTool } from "../editor/state";
import { moved, type Pointer, type Tool } from "./types";

export function createTextTool(): Tool {
  let start: Pointer | null = null;

  function finish() {
    start = null;
    setMarquee(null);
    setTool("move");
  }

  return {
    cursor: "text",

    down(pointer) {
      start = pointer;
    },

    drag(pointer) {
      if (!start || (!editor.marquee && !moved(start, pointer))) return;
      setMarquee({
        x: Math.min(start.x, pointer.x),
        y: Math.min(start.y, pointer.y),
        width: Math.abs(pointer.x - start.x),
        height: Math.abs(pointer.y - start.y),
      });
    },

    up() {
      if (!start) return;
      const box = editor.marquee;
      const existing = box ? null : hitTest(editor.page, start.x, start.y);
      if (existing?.kind === "text") {
        select([existing.id]);
        setEditing(existing.id);
        finish();
        return;
      }
      const parent = frameAt(editor.page, start.x, start.y);
      const origin = apply(invert(mat(), setWorld(mat(), parent ?? undefined)), grid(box ? box.x : start.x), grid(box ? box.y : start.y));
      const node = createNode("text", {
        name: nextName("text"),
        x: origin.x,
        y: origin.y,
        width: box ? Math.max(1, grid(box.width)) : 0,
        height: box ? Math.max(1, grid(box.height)) : 0,
        textSizing: box ? "fixed" : "width",
      });
      transact(() => insertNodes([node], parent?.id ?? editor.page));
      select([node.id]);
      setEditing(node.id);
      finish();
    },

    cancel() {
      finish();
    },
  };
}
