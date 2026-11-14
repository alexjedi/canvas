import { camera, setCamera } from "../editor/state";
import type { Pointer, Tool } from "./types";

let last: Pointer | null = null;

export const handTool: Tool = {
  cursor: "grab",
  down(pointer) {
    last = pointer;
  },
  drag(pointer) {
    if (!last) return;
    setCamera(camera.x + pointer.sx - last.sx, camera.y + pointer.sy - last.sy, camera.zoom);
    last = pointer;
  },
  up() {
    last = null;
  },
  cancel() {
    last = null;
  },
};
