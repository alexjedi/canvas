import { importImage } from "../doc/assets";
import { addPage, cloneNodes, collectSubtree, createNode, nextName } from "../doc/create";
import { apply, frameAt, invert, isContainer, mat, reparent, setWorld, sortByOrder, topLevel, translateWorld, unionBounds, worldBounds } from "../doc/geometry";
import { resizeNode } from "../doc/groups";
import { inferLayout, isLayout } from "../doc/layout";
import { canRedo, canUndo, edit, insertNodes, moveNode, nodes, redo, removeNode, setProps, transact, undo } from "../doc/store";
import { ROOT, type NodeProps, type Point, type SceneNode } from "../doc/types";
import { grid } from "./prefs";
import { camera, editor, sanitize, select, setCamera, setPage, toWorld, viewport, type DropPosition } from "./state";

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

export function copySelection(): string {
  const ids = roots();
  if (!ids.length) return "";
  clipboard = ids.map(snapshotTree);
  return ids.map((id) => nodes.get(id)?.name ?? "").join("\n");
}

export function copyToSystem() {
  const text = copySelection();
  if (text) navigator.clipboard?.writeText(text).catch(() => {});
}

export const hasClipboard = () => clipboard.length > 0;

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

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

export function alignSelection(mode: AlignMode) {
  const ids = roots();
  if (!ids.length) return;
  const single = nodes.get(ids[0]);
  const parent = nodes.get(single?.parent ?? "");
  const target = ids.length > 1 ? unionBounds(ids) : parent && !isContainer(parent) ? worldBounds(parent) : null;
  if (!target) return;
  transact(() => {
    for (const id of ids) {
      const node = nodes.get(id);
      if (!node) continue;
      const bounds = worldBounds(node);
      let dx = 0;
      let dy = 0;
      if (mode === "left") dx = target.x - bounds.x;
      else if (mode === "center") dx = target.x + target.width / 2 - bounds.x - bounds.width / 2;
      else if (mode === "right") dx = target.x + target.width - bounds.x - bounds.width;
      else if (mode === "top") dy = target.y - bounds.y;
      else if (mode === "middle") dy = target.y + target.height / 2 - bounds.y - bounds.height / 2;
      else dy = target.y + target.height - bounds.y - bounds.height;
      translateWorld(id, dx, dy);
    }
  });
}

export function distributeSelection(axis: "horizontal" | "vertical") {
  const items = roots()
    .map((id) => nodes.get(id))
    .filter((node): node is SceneNode => !!node)
    .map((node) => ({ id: node.id, bounds: worldBounds(node) }));
  if (items.length < 3) return;
  const horizontal = axis === "horizontal";
  const start = (item: (typeof items)[number]) => (horizontal ? item.bounds.x : item.bounds.y);
  const size = (item: (typeof items)[number]) => (horizontal ? item.bounds.width : item.bounds.height);
  items.sort((a, b) => start(a) - start(b));
  const last = items[items.length - 1];
  const total = items.reduce((sum, item) => sum + size(item), 0);
  const gap = (start(last) + size(last) - start(items[0]) - total) / (items.length - 1);
  transact(() => {
    let cursor = start(items[0]);
    for (const item of items) {
      const delta = cursor - start(item);
      translateWorld(item.id, horizontal ? delta : 0, horizontal ? 0 : delta);
      cursor += size(item) + gap;
    }
  });
}

export function groupSelection() {
  const ids = roots();
  const top = nodes.get(ids[ids.length - 1] ?? "");
  const parent = nodes.get(top?.parent ?? "");
  if (!top || !parent) return;
  const group = createNode("group", { name: nextName("group") });
  transact(() => {
    insertNodes([group], parent.id, parent.children.indexOf(top.id) + 1);
    for (const id of ids) reparent(id, group.id);
  });
  select([group.id]);
}

export function ungroupSelection() {
  const released: string[] = [];
  transact(() => {
    for (const id of roots()) {
      const group = nodes.get(id);
      const parent = nodes.get(group?.parent ?? "");
      if (!group || !parent || (group.kind !== "group" && group.kind !== "frame") || group.children.length === 0) continue;
      for (const child of group.children.slice()) {
        reparent(child, parent.id, parent.children.indexOf(id));
        released.push(child);
      }
      if (nodes.has(id)) removeNode(id);
    }
  });
  if (released.length) select(released);
}

export function addAutoLayout() {
  const ids = roots();
  const first = nodes.get(ids[0] ?? "");
  if (!first) return;
  transact(() => {
    let target = first;
    if (ids.length > 1 || first.kind !== "frame") {
      const top = nodes.get(ids[ids.length - 1]);
      const parent = nodes.get(top?.parent ?? "");
      const bounds = unionBounds(ids);
      if (!top || !parent || !bounds) return;
      const origin = apply(invert(mat(), setWorld(mat(), parent)), bounds.x, bounds.y);
      target = createNode("frame", {
        name: nextName("frame"),
        x: origin.x,
        y: origin.y,
        width: bounds.width,
        height: bounds.height,
        fill: null,
        clip: false,
      });
      insertNodes([target], parent.id, parent.children.indexOf(top.id) + 1);
      for (const id of ids) reparent(id, target.id);
    } else if (isLayout(first)) {
      return;
    }
    setProps(target.id, inferLayout(target));
    select([target.id]);
  });
}

export function removeAutoLayout() {
  transact(() => {
    for (const id of editor.selection) if (isLayout(nodes.get(id))) setProps(id, { layout: "none", sizeX: "fixed", sizeY: "fixed" });
  });
}

export function toggleSelected(key: "visible" | "locked") {
  const ids = editor.selection;
  if (!ids.length) return;
  const value = !ids.every((id) => nodes.get(id)?.[key]);
  transact(() => ids.forEach((id) => setProps(id, { [key]: value })));
  if (key === "locked" && value) select([]);
}

export function resizeSelected(key: "width" | "height", value: number) {
  transact(() => {
    for (const id of editor.selection) {
      const node = nodes.get(id);
      if (node) resizeNode(id, key === "width" ? value : node.width, key === "height" ? value : node.height);
    }
  }, `${key}:${editor.selection.join()}`);
}

export function setPageProps(props: Partial<NodeProps>, mergeKey = "") {
  transact(() => setProps(editor.page, props), mergeKey);
}

export async function addImages(files: Iterable<File>, at?: Point) {
  const center = at ?? toWorld(viewport.width / 2, viewport.height / 2);
  const created: string[] = [];
  let offset = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const asset = await importImage(file);
    if (!asset) continue;
    const container = frameAt(editor.page, center.x, center.y);
    const local = apply(invert(mat(), setWorld(mat(), container ?? undefined)), center.x + offset, center.y + offset);
    const name = file.name.replace(/\.[^.]+$/, "") || nextName("image");
    const node = createNode("image", {
      name,
      asset: asset.id,
      width: asset.width,
      height: asset.height,
      x: grid(local.x - asset.width / 2),
      y: grid(local.y - asset.height / 2),
    });
    insertNodes([node], container?.id ?? editor.page);
    created.push(node.id);
    offset += 24;
  }
  if (created.length) select(created);
}

export function pickImages() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.onchange = () => input.files && void addImages(Array.from(input.files));
  input.click();
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
