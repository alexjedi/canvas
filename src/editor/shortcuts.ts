import {
  copySelection,
  deleteSelection,
  duplicateSelection,
  nudge,
  pasteClipboard,
  redoAction,
  reorder,
  selectAll,
  selectParent,
  undoAction,
  zoomAt,
  zoomBy,
  zoomToFit,
} from "./actions";
import { editor, select, setTool, viewport, type ToolId } from "./state";

const TOOL_KEYS: Record<string, ToolId> = { v: "move", k: "scale", f: "frame", r: "rect", h: "hand" };
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function onKeyDown(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  let handled = true;
  if (mod && key === "z") event.shiftKey ? redoAction() : undoAction();
  else if (mod && key === "a") selectAll();
  else if (mod && key === "d") duplicateSelection();
  else if (mod && key === "c") copySelection();
  else if (mod && key === "v") pasteClipboard();
  else if (mod && key === "]") reorder("forward");
  else if (mod && key === "[") reorder("backward");
  else if (mod && (key === "=" || key === "+")) zoomBy(2);
  else if (mod && key === "-") zoomBy(0.5);
  else if (mod && key === "0") zoomAt(viewport.width / 2, viewport.height / 2, 1);
  else if (mod) handled = false;
  else if (key === "]") reorder("front");
  else if (key === "[") reorder("back");
  else if (event.code === "Digit1" && event.shiftKey) zoomToFit();
  else if (event.code === "Digit2" && event.shiftKey) zoomToFit(editor.selection);
  else if (key === "Backspace" || key === "Delete") deleteSelection();
  else if (key === "Escape") select([]);
  else if (key === "Enter" && event.shiftKey) selectParent();
  else if (ARROWS[key]) nudge(ARROWS[key][0] * (event.shiftKey ? 10 : 1), ARROWS[key][1] * (event.shiftKey ? 10 : 1));
  else if (TOOL_KEYS[key] && !event.shiftKey && !event.altKey) setTool(TOOL_KEYS[key]);
  else handled = false;
  if (handled) event.preventDefault();
}

export function attachShortcuts() {
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
