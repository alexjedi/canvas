import { collectSubtree } from "../doc/create";
import {
  ancestors,
  apply,
  contains,
  frameAt,
  hitTest,
  intersects,
  invert,
  isContainer,
  mat,
  reparent,
  setLocal,
  setWorld,
  topLevel,
  worldBounds,
  worldRotation,
} from "../doc/geometry";
import { abort, begin, edit, end, nodes } from "../doc/store";
import type { Rect, SceneNode } from "../doc/types";
import { camera, editor, select, setHover, setMarquee } from "../editor/state";
import { moved, type Pointer, type Tool } from "./types";

type Mode = "idle" | "pending" | "move" | "resize" | "marquee";

interface Handle {
  hx: number;
  hy: number;
}

interface MoveOrigin {
  id: string;
  wx: number;
  wy: number;
}

interface ScaleOrigin {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  strokeWidth: number;
}

const HANDLE_REACH = 6;
const CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

function handleAt(node: SceneNode, pointer: Pointer): Handle | null {
  const local = apply(invert(mat(), setWorld(mat(), node)), pointer.x, pointer.y);
  const reach = HANDLE_REACH / camera.zoom;
  const { width, height } = node;
  if (local.x < -reach || local.y < -reach || local.x > width + reach || local.y > height + reach) return null;
  const insetX = Math.min(reach, width / 4);
  const insetY = Math.min(reach, height / 4);
  const hx = local.x <= insetX ? -1 : local.x >= width - insetX ? 1 : 0;
  const hy = local.y <= insetY ? -1 : local.y >= height - insetY ? 1 : 0;
  return hx === 0 && hy === 0 ? null : { hx, hy };
}

function handleCursor(node: SceneNode, handle: Handle): string {
  const angle = (Math.atan2(handle.hy, handle.hx) * 180) / Math.PI + worldRotation(node);
  return CURSORS[((Math.round(angle / 45) % 4) + 4) % 4];
}

function resolveTarget(hit: SceneNode, deep: boolean): SceneNode {
  if (deep) return hit;
  const chain = [hit, ...ancestors(hit.id)];
  if (chain.length === 1) return hit;
  for (const id of editor.selection) {
    const parent = nodes.get(id)?.parent;
    const sibling = chain.find((node) => node.parent === parent);
    if (sibling && sibling !== chain[chain.length - 1]) return sibling;
  }
  return chain[chain.length - 2];
}

function drillTarget(hit: SceneNode): SceneNode {
  const chain = [hit, ...ancestors(hit.id)];
  for (const id of editor.selection) {
    const child = chain.find((node) => node.parent === id);
    if (child) return child;
  }
  return hit;
}

function marqueeHits(rect: Rect): string[] {
  const page = nodes.get(editor.page);
  if (!page) return [];
  const hits: string[] = [];
  const test = (id: string) => {
    const node = nodes.get(id);
    if (node && node.visible && !node.locked && intersects(rect, worldBounds(node))) hits.push(id);
  };
  for (const id of page.children) {
    const node = nodes.get(id);
    if (!node || !node.visible || node.locked) continue;
    if (node.kind === "frame" && node.children.length > 0 && !contains(rect, worldBounds(node))) node.children.forEach(test);
    else test(id);
  }
  return hits;
}

export function createSelectTool(proportional: boolean): Tool {
  let mode: Mode = "idle";
  let start: Pointer | null = null;
  let clicked = "";
  let pendingFrame = "";
  let wasSelected = false;
  let baseSelection: readonly string[] = [];
  let origins: MoveOrigin[] = [];
  let movingSet = new Set<string>();
  let handle: Handle = { hx: 0, hy: 0 };
  let resizeId = "";
  let initial = mat();
  let parentInverse = mat();
  let startWidth = 0;
  let startHeight = 0;
  let scaleOrigins: ScaleOrigin[] = [];

  function reset() {
    mode = "idle";
    start = null;
    clicked = "";
    pendingFrame = "";
    origins = [];
    scaleOrigins = [];
    setMarquee(null);
  }

  function startMove() {
    const ids = topLevel(editor.selection).filter((id) => !nodes.get(id)?.locked);
    movingSet = new Set(ids);
    origins = ids.map((id) => {
      const world = setWorld(mat(), nodes.get(id));
      return { id, wx: world[4], wy: world[5] };
    });
    begin();
    mode = "move";
  }

  function applyMove(pointer: Pointer) {
    if (!start) return;
    let dx = pointer.x - start.x;
    let dy = pointer.y - start.y;
    if (pointer.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const container = frameAt(editor.page, pointer.x, pointer.y, movingSet);
    const containerId = container?.id ?? editor.page;
    const inverse = mat();
    for (const origin of origins) {
      const node = nodes.get(origin.id);
      if (!node) continue;
      const fits = !container || (node.width <= container.width && node.height <= container.height);
      if (node.parent !== containerId && fits) reparent(node.id, containerId);
      invert(inverse, setWorld(inverse, nodes.get(node.parent)));
      const local = apply(inverse, origin.wx + dx, origin.wy + dy);
      const target = edit(node.id);
      if (!target) continue;
      target.x = Math.round(local.x);
      target.y = Math.round(local.y);
    }
  }

  function startResize(node: SceneNode, grabbed: Handle) {
    handle = grabbed;
    resizeId = node.id;
    setLocal(initial, node);
    const parent = nodes.get(node.parent);
    invert(parentInverse, setWorld(parentInverse, parent && !isContainer(parent) ? parent : undefined));
    startWidth = node.width;
    startHeight = node.height;
    scaleOrigins = proportional
      ? collectSubtree(node.id).map((item) => ({
          id: item.id,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          radius: item.radius,
          strokeWidth: item.stroke?.width ?? 0,
        }))
      : [];
    begin();
    mode = "resize";
  }

  function applyResize(pointer: Pointer) {
    const node = edit(resizeId);
    if (!node) return;
    const inParent = apply(parentInverse, pointer.x, pointer.y);
    const local = apply(invert(mat(), initial), inParent.x, inParent.y);
    const { hx, hy } = handle;
    const centered = pointer.alt;
    let left = 0, top = 0, right = startWidth, bottom = startHeight;
    if (hx < 0) left = local.x;
    if (hx > 0) right = local.x;
    if (hy < 0) top = local.y;
    if (hy > 0) bottom = local.y;
    if (centered) {
      if (hx < 0) right = startWidth - left;
      if (hx > 0) left = startWidth - right;
      if (hy < 0) bottom = startHeight - top;
      if (hy > 0) top = startHeight - bottom;
    }
    if ((pointer.shift || proportional) && startWidth > 0 && startHeight > 0) {
      const ratio = startWidth / startHeight;
      let width = right - left;
      let height = bottom - top;
      const byWidth = hy === 0 || (hx !== 0 && Math.abs(width) / startWidth > Math.abs(height) / startHeight);
      if (byWidth) height = (Math.abs(width) / ratio) * (height < 0 ? -1 : 1);
      else width = Math.abs(height) * ratio * (width < 0 ? -1 : 1);
      if (centered || hx === 0) {
        left = startWidth / 2 - width / 2;
        right = startWidth / 2 + width / 2;
      } else if (hx < 0) left = right - width;
      else right = left + width;
      if (centered || hy === 0) {
        top = startHeight / 2 - height / 2;
        bottom = startHeight / 2 + height / 2;
      } else if (hy < 0) top = bottom - height;
      else bottom = top + height;
    }
    if (left > right) [left, right] = [right, left];
    if (top > bottom) [top, bottom] = [bottom, top];
    const snap = node.rotation === 0 && !proportional;
    if (snap) {
      left = Math.round(initial[4] + left) - initial[4];
      right = Math.round(initial[4] + right) - initial[4];
      top = Math.round(initial[5] + top) - initial[5];
      bottom = Math.round(initial[5] + bottom) - initial[5];
    }
    const minimum = snap ? 1 : 0.01;
    const width = Math.max(minimum, right - left);
    const height = Math.max(minimum, bottom - top);
    const origin = apply(initial, left, top);
    node.x = origin.x;
    node.y = origin.y;
    node.width = width;
    node.height = height;
    if (!proportional || startWidth === 0) return;
    const factor = width / startWidth;
    for (const item of scaleOrigins) {
      const target = item.id === resizeId ? node : edit(item.id);
      if (!target) continue;
      if (item.id !== resizeId) {
        target.x = item.x * factor;
        target.y = item.y * factor;
        target.width = item.width * factor;
        target.height = item.height * factor;
      }
      target.radius = item.radius * factor;
      if (target.stroke && item.strokeWidth > 0) target.stroke = { ...target.stroke, width: item.strokeWidth * factor };
    }
  }

  function applyMarquee(pointer: Pointer) {
    if (!start) return;
    const rect = {
      x: Math.min(start.x, pointer.x),
      y: Math.min(start.y, pointer.y),
      width: Math.abs(pointer.x - start.x),
      height: Math.abs(pointer.y - start.y),
    };
    setMarquee(rect);
    const hits = marqueeHits(rect);
    select(baseSelection.length ? [...baseSelection, ...hits] : hits);
  }

  return {
    cursor: "default",

    hover(pointer) {
      const single = editor.selection.length === 1 ? nodes.get(editor.selection[0]) : undefined;
      const grabbed = single && !single.locked ? handleAt(single, pointer) : null;
      if (single && grabbed) {
        setHover("");
        return handleCursor(single, grabbed);
      }
      const hit = hitTest(editor.page, pointer.x, pointer.y);
      setHover(hit ? resolveTarget(hit, pointer.meta).id : "");
      return "default";
    },

    down(pointer) {
      start = pointer;
      setHover("");
      const single = editor.selection.length === 1 ? nodes.get(editor.selection[0]) : undefined;
      const grabbed = single && !single.locked ? handleAt(single, pointer) : null;
      if (single && grabbed) {
        startResize(single, grabbed);
        return;
      }
      const hit = hitTest(editor.page, pointer.x, pointer.y);
      const target = hit && (pointer.clicks > 1 ? drillTarget(hit) : resolveTarget(hit, pointer.meta));
      baseSelection = pointer.shift ? editor.selection : [];
      if (!target) {
        if (!pointer.shift) select([]);
        mode = "marquee";
        return;
      }
      wasSelected = editor.selected.has(target.id);
      const background = target.kind === "frame" && target.children.length > 0 && isContainer(nodes.get(target.parent));
      if (background && !wasSelected && !pointer.meta && pointer.clicks < 2) {
        pendingFrame = target.id;
        if (!pointer.shift) select([]);
        mode = "marquee";
        return;
      }
      clicked = target.id;
      if (pointer.shift) {
        select(wasSelected ? editor.selection.filter((id) => id !== target.id) : [...editor.selection, target.id]);
      } else if (!wasSelected) {
        select([target.id]);
      }
      mode = "pending";
    },

    drag(pointer) {
      if (!start) return;
      if (mode === "pending" && moved(start, pointer) && editor.selection.length > 0) startMove();
      if (mode === "move") applyMove(pointer);
      else if (mode === "resize") applyResize(pointer);
      else if (mode === "marquee" && (editor.marquee || moved(start, pointer))) applyMarquee(pointer);
    },

    up(pointer) {
      if (mode === "move" || mode === "resize") end();
      else if (mode === "marquee" && !editor.marquee && pendingFrame) {
        select(pointer.shift ? [...baseSelection, pendingFrame] : [pendingFrame]);
      } else if (mode === "pending" && clicked && wasSelected && !pointer.shift && editor.selection.length > 1) {
        select([clicked]);
      }
      reset();
    },

    cancel() {
      if (mode === "move" || mode === "resize") abort();
      reset();
    },
  };
}
