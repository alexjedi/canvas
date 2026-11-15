import { discardEmpty } from "../doc/create";
import { ancestors } from "../doc/geometry";
import { nodes } from "../doc/store";
import { ROOT, type Point, type Rect } from "../doc/types";
import { setHitSlop } from "../doc/vector";
import { invalidate } from "../frame";

export type ToolId = "move" | "scale" | "frame" | "rect" | "ellipse" | "pen" | "text" | "hand";

export interface Guide {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type DropPosition = "above" | "below" | "inside";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const EMPTY: readonly string[] = Object.freeze([]);
const NO_GUIDES: readonly Guide[] = Object.freeze([]);
const NO_POINTS: readonly number[] = Object.freeze([]);
const HIT_REACH = 5;

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 256;

export const camera = { x: 0, y: 0, zoom: 1, zoomedAt: 0, fitted: false };
export const viewport = { width: 0, height: 0, dpr: 1 };

export const editor = {
  page: "",
  tool: "move" as ToolId,
  selection: EMPTY,
  selected: new Set<string>(),
  hover: "",
  marquee: null as Rect | null,
  guides: NO_GUIDES,
  eyedropper: null as ((color: string) => void) | null,
  expanded: new Set<string>(),
  drop: null as { id: string; position: DropPosition } | null,
  editing: "",
  points: NO_POINTS,
  pen: null as Point | null,
};

const cameras = new Map<string, Camera>();

export function setEditing(id: string) {
  if (editor.editing === id) return;
  const previous = editor.editing;
  editor.editing = id;
  editor.points = NO_POINTS;
  editor.pen = null;
  if (previous) discardEmpty(previous);
  invalidate();
}

export function setPoints(points: readonly number[]) {
  editor.points = points.length ? points : NO_POINTS;
  invalidate();
}

export function setPen(point: Point | null) {
  if (!point && !editor.pen) return;
  editor.pen = point;
  invalidate();
}

export function select(ids: readonly string[]) {
  const next = ids.filter((id, i) => nodes.has(id) && ids.indexOf(id) === i);
  if (editor.editing && (next.length !== 1 || next[0] !== editor.editing)) setEditing("");
  if (next.length === editor.selection.length && next.every((id, i) => id === editor.selection[i])) return;
  editor.selection = next.length ? next : EMPTY;
  editor.selected = new Set(next);
  for (const id of next) for (const parent of ancestors(id)) editor.expanded.add(parent.id);
  invalidate();
}

export function setHover(id: string) {
  if (editor.hover === id) return;
  editor.hover = id;
  invalidate();
}

export function setTool(tool: ToolId) {
  if (editor.tool === tool) return;
  editor.tool = tool;
  editor.pen = null;
  if (tool !== "move" && tool !== "pen" && tool !== "hand") setEditing("");
  invalidate();
}

export function setMarquee(rect: Rect | null) {
  editor.marquee = rect;
  invalidate();
}

export function setGuides(guides: readonly Guide[]) {
  if (guides.length === 0 && editor.guides.length === 0) return;
  editor.guides = guides.length ? guides : NO_GUIDES;
  invalidate();
}

export function setEyedropper(pick: ((color: string) => void) | null) {
  editor.eyedropper = pick;
  invalidate();
}

export function setDrop(id: string, position: DropPosition) {
  if (editor.drop?.id === id && editor.drop.position === position) return;
  editor.drop = { id, position };
  invalidate();
}

export function clearDrop() {
  if (!editor.drop) return;
  editor.drop = null;
  invalidate();
}

export function toggleExpanded(id: string) {
  if (!editor.expanded.delete(id)) editor.expanded.add(id);
  invalidate();
}

export function setCamera(x: number, y: number, zoom: number) {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  if (next !== camera.zoom) camera.zoomedAt = performance.now();
  camera.zoom = next;
  setHitSlop(HIT_REACH / next);
  camera.x = Math.round(x * viewport.dpr) / viewport.dpr;
  camera.y = Math.round(y * viewport.dpr) / viewport.dpr;
  invalidate();
}

export function setPage(id: string) {
  if (editor.page === id || nodes.get(id)?.kind !== "page") return;
  if (editor.page) cameras.set(editor.page, { x: camera.x, y: camera.y, zoom: camera.zoom });
  editor.page = id;
  editor.hover = "";
  select([]);
  const saved = cameras.get(id);
  camera.fitted = !!saved;
  if (saved) setCamera(saved.x, saved.y, saved.zoom);
  invalidate();
}

export function sanitize() {
  if (nodes.get(editor.page)?.kind !== "page") {
    editor.page = "";
    setPage(nodes.get(ROOT)?.children[0] ?? "");
  }
  if (editor.editing && !nodes.has(editor.editing)) setEditing("");
  select(editor.selection.filter((id) => nodes.has(id)));
  if (editor.hover && !nodes.has(editor.hover)) editor.hover = "";
}

export const toWorld = (sx: number, sy: number) => ({
  x: (sx - camera.x) / camera.zoom,
  y: (sy - camera.y) / camera.zoom,
});
