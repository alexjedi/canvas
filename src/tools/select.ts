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
  nearestFrame,
  reparent,
  setWorld,
  topLevel,
  unionBounds,
  worldBounds,
  worldRotation,
} from "../doc/geometry";
import { applyGroupScale, captureGroup, type ScaleOrigin as GroupOrigin } from "../doc/groups";
import { isLayout, placeInLayout } from "../doc/layout";
import { abort, begin, edit, end, nodes } from "../doc/store";
import type { Rect, SceneNode } from "../doc/types";
import { canEdit, startEditing } from "../editor/actions";
import { grid, prefs } from "../editor/prefs";
import { camera, editor, select, setGuides, setHover, setMarquee } from "../editor/state";
import { prepareSnap, resetSnap, snapBounds, snapPoint } from "./snap";
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
  gap: number;
  padding: [number, number, number, number];
  fontSize: number;
  letterSpacing: number;
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
  const top = chain[chain.length - 1];
  for (const id of editor.selection) {
    const parent = nodes.get(id)?.parent;
    const sibling = chain.find((node) => node.parent === parent);
    if (sibling && sibling !== top) return sibling;
  }
  return top.kind === "frame" && chain.length > 1 ? chain[chain.length - 2] : top;
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
  let startBounds: Rect | null = null;
  const initial = mat();
  const initialInverse = mat();
  const parentInverse = mat();
  let upright = true;
  let startWidth = 0;
  let startHeight = 0;
  let scaleOrigins: ScaleOrigin[] = [];
  let groupOrigins: GroupOrigin[] = [];

  function reset() {
    mode = "idle";
    start = null;
    clicked = "";
    pendingFrame = "";
    origins = [];
    scaleOrigins = [];
    groupOrigins = [];
    startBounds = null;
    resetSnap();
    setMarquee(null);
  }

  function startMove() {
    const ids = topLevel(editor.selection).filter((id) => !nodes.get(id)?.locked);
    movingSet = new Set(ids);
    origins = ids.map((id) => {
      const world = setWorld(mat(), nodes.get(id));
      return { id, wx: world[4], wy: world[5] };
    });
    startBounds = unionBounds(ids);
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
    for (const origin of origins) {
      const node = nodes.get(origin.id);
      if (!node || nearestFrame(node) === containerId) continue;
      if (!container || isLayout(container) || (node.width <= container.width && node.height <= container.height)) reparent(node.id, containerId);
    }
    const first = nodes.get(origins[0]?.id ?? "");
    const flowing = isLayout(nodes.get(first?.parent ?? ""));
    if (flowing) setGuides([]);
    if (first && startBounds && !flowing) {
      prepareSnap(first.parent, movingSet);
      const snap = snapBounds({ x: startBounds.x + dx, y: startBounds.y + dy, width: startBounds.width, height: startBounds.height });
      if (!pointer.shift || dx !== 0) dx += snap.x;
      if (!pointer.shift || dy !== 0) dy += snap.y;
    }
    const inverse = mat();
    for (const origin of origins) {
      const node = nodes.get(origin.id);
      if (!node) continue;
      const parent = nodes.get(node.parent);
      invert(inverse, setWorld(inverse, parent));
      if (parent && isLayout(parent)) {
        const at = apply(inverse, pointer.x, pointer.y);
        placeInLayout(node, parent, at.x, at.y, movingSet);
        continue;
      }
      const local = apply(inverse, origin.wx + dx, origin.wy + dy);
      const target = edit(node.id);
      if (!target) continue;
      target.x = grid(local.x);
      target.y = grid(local.y);
    }
  }

  function startResize(node: SceneNode, grabbed: Handle) {
    handle = grabbed;
    resizeId = node.id;
    setWorld(initial, node);
    invert(initialInverse, initial);
    upright = Math.abs(initial[1]) < 1e-9 && initial[0] > 0;
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
          gap: item.gap,
          padding: [item.paddingTop, item.paddingRight, item.paddingBottom, item.paddingLeft],
          fontSize: item.fontSize,
          letterSpacing: item.letterSpacing,
        }))
      : [];
    groupOrigins = !proportional && node.kind === "group" ? captureGroup(node.id) : [];
    prepareSnap(node.parent, new Set([node.id]));
    begin();
    mode = "resize";
  }

  function applyResize(pointer: Pointer) {
    const node = edit(resizeId);
    if (!node) return;
    const { hx, hy } = handle;
    const centered = pointer.alt;
    const locked = pointer.shift || proportional;
    let target = { x: pointer.x, y: pointer.y };
    if (upright && !locked) target = snapPoint(pointer.x, pointer.y, hx !== 0, hy !== 0);
    else setGuides([]);
    const local = apply(initialInverse, target.x, target.y);
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
    if (locked && startWidth > 0 && startHeight > 0) {
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
    const snap = upright && !proportional && prefs.pixelGrid;
    if (snap) {
      left = Math.round(initial[4] + left) - initial[4];
      right = Math.round(initial[4] + right) - initial[4];
      top = Math.round(initial[5] + top) - initial[5];
      bottom = Math.round(initial[5] + bottom) - initial[5];
    }
    const minimum = snap ? 1 : 0.01;
    const width = Math.max(minimum, right - left);
    const height = Math.max(minimum, bottom - top);
    const corner = apply(initial, left, top);
    invert(parentInverse, setWorld(parentInverse, nodes.get(node.parent)));
    const origin = apply(parentInverse, corner.x, corner.y);
    node.x = origin.x;
    node.y = origin.y;
    node.width = width;
    node.height = height;
    if (hx !== 0 || locked) node.sizeX = "fixed";
    if (hy !== 0 || locked) node.sizeY = "fixed";
    if (node.kind === "text" && !proportional) node.textSizing = hy !== 0 || locked || node.textSizing === "fixed" ? "fixed" : "height";
    if (groupOrigins.length > 0 && startWidth > 0 && startHeight > 0) applyGroupScale(groupOrigins, width / startWidth, height / startHeight);
    if (!proportional || startWidth === 0) return;
    const factor = width / startWidth;
    for (const item of scaleOrigins) {
      const scaled = item.id === resizeId ? node : edit(item.id);
      if (!scaled) continue;
      if (item.id !== resizeId) {
        scaled.x = item.x * factor;
        scaled.y = item.y * factor;
        scaled.width = item.width * factor;
        scaled.height = item.height * factor;
      }
      scaled.radius = item.radius * factor;
      scaled.gap = item.gap * factor;
      scaled.paddingTop = item.padding[0] * factor;
      scaled.paddingRight = item.padding[1] * factor;
      scaled.paddingBottom = item.padding[2] * factor;
      scaled.paddingLeft = item.padding[3] * factor;
      scaled.fontSize = item.fontSize * factor;
      scaled.letterSpacing = item.letterSpacing * factor;
      if (scaled.stroke && item.strokeWidth > 0) scaled.stroke = { ...scaled.stroke, width: item.strokeWidth * factor };
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
      if (pointer.clicks > 1 && wasSelected && canEdit(target)) {
        startEditing(target.id);
        reset();
        return;
      }
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
