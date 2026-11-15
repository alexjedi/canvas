import {
  addAutoLayout,
  addImages,
  copySelection,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  nudge,
  pasteClipboard,
  pickImages,
  redoAction,
  reorder,
  selectAll,
  selectParent,
  startEditing,
  stopEditing,
  toggleSelected,
  undoAction,
  ungroupSelection,
  zoomAt,
  zoomBy,
  zoomToFit,
} from "./actions";
import { editor, select, setTool, viewport, type ToolId } from "./state";

const TOOL_KEYS: Record<string, ToolId> = { v: "move", k: "scale", f: "frame", r: "rect", o: "ellipse", h: "hand", p: "pen", t: "text" };

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest("input, textarea, select, [contenteditable]");
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function onKeyDown(event: KeyboardEvent) {
  if (isTyping(event.target)) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  let handled = true;
  if (mod && key === "z") event.shiftKey ? redoAction() : undoAction();
  else if (mod && key === "a") selectAll();
  else if (mod && key === "d") duplicateSelection();
  else if (mod && key === "g") event.shiftKey ? ungroupSelection() : groupSelection();
  else if (mod && event.shiftKey && key === "h") toggleSelected("visible");
  else if (mod && event.shiftKey && key === "l") toggleSelected("locked");
  else if (mod && event.shiftKey && key === "k") pickImages();
  else if (mod && key === "]") reorder("forward");
  else if (mod && key === "[") reorder("backward");
  else if (mod && (key === "=" || key === "+")) zoomBy(2);
  else if (mod && key === "-") zoomBy(0.5);
  else if (mod && key === "0") zoomAt(viewport.width / 2, viewport.height / 2, 1);
  else if (mod) handled = false;
  else if (key === "a" && event.shiftKey) addAutoLayout();
  else if (key === "]") reorder("front");
  else if (key === "[") reorder("back");
  else if (event.code === "Digit1" && event.shiftKey) zoomToFit();
  else if (event.code === "Digit2" && event.shiftKey) zoomToFit(editor.selection);
  else if (key === "Backspace" || key === "Delete") deleteSelection();
  else if (key === "Escape") editor.editing ? stopEditing() : select([]);
  else if (key === "Enter" && event.shiftKey) selectParent();
  else if (key === "Enter") editor.editing ? stopEditing() : editor.selection.length === 1 ? startEditing(editor.selection[0]) : (handled = false);
  else if (ARROWS[key]) nudge(ARROWS[key][0] * (event.shiftKey ? 10 : 1), ARROWS[key][1] * (event.shiftKey ? 10 : 1));
  else if (TOOL_KEYS[key] && !event.shiftKey && !event.altKey) setTool(TOOL_KEYS[key]);
  else handled = false;
  if (handled) event.preventDefault();
}

function onCopy(event: ClipboardEvent) {
  if (isTyping(event.target)) return;
  const text = copySelection();
  if (!text) return;
  event.clipboardData?.setData("text/plain", text);
  event.preventDefault();
}

function onPaste(event: ClipboardEvent) {
  if (isTyping(event.target)) return;
  event.preventDefault();
  const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (files.length) void addImages(files);
  else pasteClipboard();
}

export function attachShortcuts() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("copy", onCopy);
  window.addEventListener("paste", onPaste);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("copy", onCopy);
    window.removeEventListener("paste", onPaste);
  };
}
