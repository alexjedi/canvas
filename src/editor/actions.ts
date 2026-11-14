import { addPage, cloneNodes, collectSubtree } from "../doc/create";
import { isContainer, reparent, sortByOrder, topLevel, unionBounds } from "../doc/geometry";
import { canRedo, canUndo, edit, insertNodes, moveNode, nodes, redo, removeNode, setProps, transact, undo } from "../doc/store";
import { ROOT, type NodeProps, type SceneNode } from "../doc/types";
import { camera, editor, sanitize, select, setCamera, setPage, viewport, type DropPosition } from "./state";

const FIT_PADDING = 64;
const DUPLICATE_GAP = 100;

let clipboard: SceneNode[][] = [];

const roots = () => sortByOrder(topLevel(editor.selection), editor.page);

export function undoAction() {
  if (!canUndo()) return;
  undo();
  sanitize();
}

export function redoAction() {
  if (!canRedo()) return;
  redo();
  sanitize();
}

export function setSelected<K extends keyof NodeProps>(key: K, value: NodeProps[K], mergeKey = "") {
  transact(() => {
    for (const id of editor.selection) setProps(id, { [key]: value } as Partial<NodeProps>);
  }, mergeKey && `${mergeKey}:${editor.selection.join()}`);
}

export function patchSelected<K extends "fill" | "stroke">(key: K, patch: Partial<NonNullable<NodeProps[K]>>, fallback: NonNullable<NodeProps[K]>) {
  transact(() => {
    for (const id of editor.selection) {
      const node = nodes.get(id);
      if (node) setProps(id, { [key]: { ...(node[key] ?? fallback), ...patch } } as Partial<NodeProps>);
    }
  }, `${key}:${editor.selection.join()}`);
}

export function deleteSelection() {
  const ids = roots();
  if (!ids.length) return;
  transact(() => ids.forEach(removeNode));
  select([]);
}

function snapshotTree(id: string): SceneNode[] {
  return collectSubtree(id).map((node) => ({ ...node, children: node.children.slice() }));
}

export function duplicateSelection() {
  const ids = roots();
  if (!ids.length) return;
  const created: string[] = [];
  transact(() => {
    for (const id of ids) {
      const source = nodes.get(id);
      const parent = nodes.get(source?.parent ?? "");
      if (!source || !parent) continue;
      const copy = cloneNodes(snapshotTree(id));
      if (source.kind === "frame" && parent.kind === "page") copy[0].x += source.width + DUPLICATE_GAP;
      insertNodes(copy, parent.id, parent.children.indexOf(id) + 1);
      created.push(copy[0].id);
    }
  });
  select(created);
}

export function copySelection() {
  const ids = roots();
  if (ids.length) clipboard = ids.map(snapshotTree);
}

export function pasteClipboard() {
  if (!clipboard.length) return;
  const created: string[] = [];
  transact(() => {
    for (const tree of clipboard) {
      const copy = cloneNodes(tree);
      const origin = nodes.get(tree[0].parent);
      const parent = origin && origin.kind !== "document" && pageOf(origin.id) === editor.page ? origin.id : editor.page;
      insertNodes(copy, parent);
      created.push(copy[0].id);
    }
  });
  select(created);
}

export function pageOf(id: string): string {
  let node = nodes.get(id);
  while (node && node.kind !== "page") node = nodes.get(node.parent);
  return node?.id ?? "";
}

export function selectAll() {
  const first = nodes.get(editor.selection[0] ?? "");
  const parent = nodes.get(first?.parent ?? editor.page);
  if (!parent) return;
  select(parent.children.filter((id) => {
    const node = nodes.get(id);
    return !!node && node.visible && !node.locked;
  }));
}

export function selectParent() {
  const first = nodes.get(editor.selection[0] ?? "");
  const parent = nodes.get(first?.parent ?? "");
  select(parent && !isContainer(parent) ? [parent.id] : []);
}

export function nudge(dx: number, dy: number) {
  const ids = roots();
  if (!ids.length) return;
  transact(() => {
    for (const id of ids) {
      const node = edit(id);
      if (!node || node.locked) continue;
      node.x += dx;
      node.y += dy;
    }
  }, "nudge");
}

export function reorder(mode: "front" | "back" | "forward" | "backward") {
  const ids = roots();
  if (!ids.length) return;
  const ordered = mode === "front" || mode === "backward" ? ids : ids.slice().reverse();
  transact(() => {
    for (const id of ordered) {
      const node = nodes.get(id);
      const parent = nodes.get(node?.parent ?? "");
      if (!node || !parent) continue;
      const at = parent.children.indexOf(id);
      const last = parent.children.length - 1;
      const target = mode === "front" ? last : mode === "back" ? 0 : mode === "forward" ? Math.min(last, at + 1) : Math.max(0, at - 1);
      if (target !== at) moveNode(id, parent.id, target);
    }
  });
}

export function dropLayers(targetId: string, position: DropPosition) {
  const target = nodes.get(targetId);
  if (!target) return;
  const ids = roots().filter((id) => id !== targetId);
  if (!ids.length) return;
  const ordered = position === "above" ? ids.slice().reverse() : ids;
  transact(() => {
    for (const id of ordered) {
      if (position === "inside") {
        reparent(id, targetId);
        continue;
      }
      const parent = nodes.get(target.parent);
      if (!parent) continue;
      const at = parent.children.indexOf(targetId);
      reparent(id, parent.id, position === "above" ? at + 1 : at);
    }
  });
  if (position === "inside") editor.expanded.add(targetId);
}

export function renameNode(id: string, name: string) {
  const next = name.trim();
  if (next && nodes.get(id)?.name !== next) setProps(id, { name: next });
}

export function toggleFlag(id: string, key: "visible" | "locked") {
  const node = nodes.get(id);
  if (!node) return;
  setProps(id, { [key]: !node[key] });
  if (key === "locked" && node.locked) select(editor.selection.filter((selected) => selected !== id));
}

export function createPage() {
  setPage(addPage());
}

export function deletePage(id: string) {
  const root = nodes.get(ROOT);
  if (!root || root.children.length < 2) return;
  removeNode(id);
  sanitize();
}

export function zoomAt(sx: number, sy: number, zoom: number) {
  const wx = (sx - camera.x) / camera.zoom;
  const wy = (sy - camera.y) / camera.zoom;
  setCamera(camera.x, camera.y, zoom);
  setCamera(sx - wx * camera.zoom, sy - wy * camera.zoom, camera.zoom);
}

export function zoomBy(factor: number) {
  zoomAt(viewport.width / 2, viewport.height / 2, camera.zoom * factor);
}

export function zoomToFit(ids?: readonly string[]) {
  const page = nodes.get(editor.page);
  if (!page || viewport.width === 0) return;
  const bounds = unionBounds(ids?.length ? ids : page.children);
  camera.fitted = true;
  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    setCamera(viewport.width / 2, viewport.height / 2, 1);
    return;
  }
  const zoom = Math.min(1, (viewport.width - FIT_PADDING * 2) / bounds.width, (viewport.height - FIT_PADDING * 2) / bounds.height);
  setCamera(0, 0, zoom);
  setCamera(
    viewport.width / 2 - (bounds.x + bounds.width / 2) * camera.zoom,
    viewport.height / 2 - (bounds.y + bounds.height / 2) * camera.zoom,
    camera.zoom,
  );
}

export function fitIfNeeded() {
  if (!camera.fitted && viewport.width > 0 && editor.page) zoomToFit();
}

export function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
  window.dispatchEvent(new Event("themechange"));
}
