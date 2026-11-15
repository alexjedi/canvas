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
  normalizeAngle,
  reparent,
  setLocal,
  setWorld,
  topLevel,
  unionBounds,
  worldBounds,
  worldRotation,
} from "../doc/geometry";
import { applyGroupScale, captureGroup, type ScaleOrigin as GroupOrigin } from "../doc/groups";
import { inFlow, isLayout, placeInLayout } from "../doc/layout";
import { abort, begin, edit, end, nodes } from "../doc/store";
import type { Point, Rect, SceneNode, TextRun } from "../doc/types";
import { canEdit, startEditing } from "../editor/actions";
import { grid, prefs } from "../editor/prefs";
import { labelAt } from "../editor/labels";
import { camera, editor, select, setGuides, setHover, setLift, setMarquee, setRenaming } from "../editor/state";
import { prepareSnap, resetSnap, snapBounds, snapPoint } from "./snap";
import { moved, type Pointer, type Tool } from "./types";

type Mode = "idle" | "pending" | "move" | "resize" | "rotate" | "multi" | "marquee";

interface Handle {
  hx: number;
  hy: number;
  rotate: boolean;
}

interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface TurnOrigin {
  id: string;
  rotation: number;
  cx: number;
  cy: number;
}

interface SpanOrigin {
  id: string;
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
  group: GroupOrigin[] | null;
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
  runs: TextRun[];
}

const HANDLE_REACH = 6;
const ROTATE_REACH = 22;
const ROTATE_STEP = 15;
const RAD = Math.PI / 180;
const CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];
const ROTATE_ICON =
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
  "<g stroke='white' stroke-width='5'><path d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/></g>" +
  "<g stroke='black' stroke-width='2'><path d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/></g></svg>";
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROTATE_ICON)}") 12 12, crosshair`;

function zoneAt(local: Point, width: number, height: number): Handle | null {
  const reach = HANDLE_REACH / camera.zoom;
  const outside = local.x < -reach || local.y < -reach || local.x > width + reach || local.y > height + reach;
  if (outside) {
    const turn = ROTATE_REACH / camera.zoom;
    const hx = local.x < width / 2 ? -1 : 1;
    const hy = local.y < height / 2 ? -1 : 1;
    const distance = Math.hypot(local.x - (hx < 0 ? 0 : width), local.y - (hy < 0 ? 0 : height));
    return distance <= turn ? { hx, hy, rotate: true } : null;
  }
  const insetX = Math.min(reach, width / 4);
  const insetY = Math.min(reach, height / 4);
  const hx = local.x <= insetX ? -1 : local.x >= width - insetX ? 1 : 0;
  const hy = local.y <= insetY ? -1 : local.y >= height - insetY ? 1 : 0;
  return hx === 0 && hy === 0 ? null : { hx, hy, rotate: false };
}

function dragEdges(local: Point, hx: number, hy: number, startWidth: number, startHeight: number, centered: boolean, locked: boolean): Edges {
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
  return { left, top, right, bottom };
}

function placeCentre(node: SceneNode, cx: number, cy: number) {
  const centre = apply(invert(mat(), setWorld(mat(), nodes.get(node.parent))), cx, cy);
  const m = setLocal(mat(), node);
  node.x = centre.x - (m[0] * node.width + m[2] * node.height) / 2;
  node.y = centre.y - (m[1] * node.width + m[3] * node.height) / 2;
}

function handleAt(node: SceneNode, pointer: Pointer): Handle | null {
  return zoneAt(apply(invert(mat(), setWorld(mat(), node)), pointer.x, pointer.y), node.width, node.height);
}

function insideBox(node: SceneNode, pointer: Pointer): boolean {
  const local = apply(invert(mat(), setWorld(mat(), node)), pointer.x, pointer.y);
  return local.x >= 0 && local.y >= 0 && local.x <= node.width && local.y <= node.height;
}

function handleCursor(node: SceneNode | undefined, handle: Handle): string {
  if (handle.rotate) return ROTATE_CURSOR;
  const angle = (Math.atan2(handle.hy, handle.hx) * 180) / Math.PI + (node ? worldRotation(node) : 0);
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
  let handle: Handle = { hx: 0, hy: 0, rotate: false };
  let turnOrigins: TurnOrigin[] = [];
  let spanOrigins: SpanOrigin[] = [];
  let pivot: Point = { x: 0, y: 0 };
  let startAngle = 0;
  let spanBounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
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
    turnOrigins = [];
    spanOrigins = [];
    startBounds = null;
    resetSnap();
    setMarquee(null);
    setLift(null);
  }

  const unlocked = () => topLevel(editor.selection).filter((id) => !nodes.get(id)?.locked);

  function grip(pointer: Pointer): { node: SceneNode | undefined; handle: Handle } | null {
    if (editor.selection.length === 1) {
      const node = nodes.get(editor.selection[0]);
      const found = node && !node.locked ? handleAt(node, pointer) : null;
      return node && found ? { node, handle: found } : null;
    }
    if (editor.selection.length < 2) return null;
    const bounds = unionBounds(unlocked());
    const found = bounds ? zoneAt({ x: pointer.x - bounds.x, y: pointer.y - bounds.y }, bounds.width, bounds.height) : null;
    return found ? { node: undefined, handle: found } : null;
  }

  function startRotate(pointer: Pointer) {
    const ids = unlocked();
    const bounds = unionBounds(ids);
    if (!bounds) return;
    pivot = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    startAngle = Math.atan2(pointer.y - pivot.y, pointer.x - pivot.x);
    turnOrigins = [];
    for (const id of ids) {
      const node = nodes.get(id);
      if (!node) continue;
      const centre = apply(setWorld(mat(), node), node.width / 2, node.height / 2);
      turnOrigins.push({ id, rotation: node.rotation, cx: centre.x, cy: centre.y });
    }
    begin();
    mode = "rotate";
  }

  function applyRotate(pointer: Pointer) {
    let delta = (Math.atan2(pointer.y - pivot.y, pointer.x - pivot.x) - startAngle) / RAD;
    if (pointer.shift) {
      const base = turnOrigins.length === 1 ? turnOrigins[0].rotation : 0;
      delta = Math.round((base + delta) / ROTATE_STEP) * ROTATE_STEP - base;
    }
    const cos = Math.cos(delta * RAD);
    const sin = Math.sin(delta * RAD);
    for (const origin of turnOrigins) {
      const node = edit(origin.id);
      if (!node) continue;
      const dx = origin.cx - pivot.x;
      const dy = origin.cy - pivot.y;
      node.rotation = normalizeAngle(origin.rotation + delta);
      placeCentre(node, pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos);
    }
  }

  function startSpan(grabbed: Handle) {
    const ids = unlocked();
    const bounds = unionBounds(ids);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    handle = grabbed;
    spanBounds = bounds;
    spanOrigins = [];
    for (const id of ids) {
      const node = nodes.get(id);
      if (!node) continue;
      const centre = apply(setWorld(mat(), node), node.width / 2, node.height / 2);
      spanOrigins.push({
        id,
        cx: centre.x,
        cy: centre.y,
        width: node.width,
        height: node.height,
        rotation: worldRotation(node),
        group: node.kind === "group" ? captureGroup(id) : null,
      });
    }
    begin();
    mode = "multi";
  }

  function applySpan(pointer: Pointer) {
    const local = { x: grid(pointer.x) - spanBounds.x, y: grid(pointer.y) - spanBounds.y };
    const edges = dragEdges(local, handle.hx, handle.hy, spanBounds.width, spanBounds.height, pointer.alt, pointer.shift || proportional);
    const sx = Math.max(0.01, edges.right - edges.left) / spanBounds.width;
    const sy = Math.max(0.01, edges.bottom - edges.top) / spanBounds.height;
    for (const origin of spanOrigins) {
      const node = edit(origin.id);
      if (!node) continue;
      const cos = Math.cos(origin.rotation * RAD);
      const sin = Math.sin(origin.rotation * RAD);
      const fx = Math.hypot(sx * cos, sy * sin);
      const fy = Math.hypot(sx * sin, sy * cos);
      if (origin.group) applyGroupScale(origin.group, fx, fy);
      else {
        if (fx !== 1) node.sizeX = "fixed";
        if (fy !== 1) node.sizeY = "fixed";
        if (node.kind === "text") node.textSizing = "fixed";
      }
      node.width = origin.width * fx;
      node.height = origin.height * fy;
      placeCentre(
        node,
        spanBounds.x + edges.left + (origin.cx - spanBounds.x) * sx,
        spanBounds.y + edges.top + (origin.cy - spanBounds.y) * sy,
      );
    }
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
    const flowing = inFlow(first);
    const lifted = new Map<string, Point>();
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
      if (parent && inFlow(node)) {
        const at = apply(inverse, pointer.x, pointer.y);
        placeInLayout(node, parent, at.x, at.y, movingSet);
        lifted.set(node.id, { x: origin.wx + dx, y: origin.wy + dy });
        continue;
      }
      const local = apply(inverse, origin.wx + dx, origin.wy + dy);
      const target = edit(node.id);
      if (!target) continue;
      target.x = grid(local.x);
      target.y = grid(local.y);
    }
    setLift(lifted.size > 0 ? lifted : null);
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
          runs: item.runs,
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
    let { left, top, right, bottom } = dragEdges(local, hx, hy, startWidth, startHeight, centered, locked);
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
      if (item.runs.length > 0) {
        scaled.runs = item.runs.map((run) => ({ ...run, fontSize: run.fontSize * factor, letterSpacing: run.letterSpacing * factor }));
      }
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
      const grabbed = grip(pointer);
      if (grabbed) {
        setHover("");
        return handleCursor(grabbed.node, grabbed.handle);
      }
      const label = labelAt(pointer.x, pointer.y);
      const hit = label ? null : hitTest(editor.page, pointer.x, pointer.y);
      setHover(label || (hit ? resolveTarget(hit, pointer.meta).id : ""));
      return "default";
    },

    down(pointer) {
      start = pointer;
      setHover("");
      const single = editor.selection.length === 1 ? nodes.get(editor.selection[0]) : undefined;
      const grabbed = grip(pointer);
      if (grabbed?.handle.rotate) {
        startRotate(pointer);
        return;
      }
      if (grabbed) {
        if (grabbed.node) startResize(grabbed.node, grabbed.handle);
        else startSpan(grabbed.handle);
        return;
      }
      if (pointer.clicks > 1 && single && canEdit(single) && insideBox(single, pointer)) {
        startEditing(single.id);
        reset();
        return;
      }
      const label = nodes.get(labelAt(pointer.x, pointer.y));
      if (label && pointer.clicks > 1) {
        select([label.id]);
        setRenaming(label.id);
        reset();
        return;
      }
      const hit = label ? null : hitTest(editor.page, pointer.x, pointer.y);
      const target = label ?? (hit && (pointer.clicks > 1 ? drillTarget(hit) : resolveTarget(hit, pointer.meta)));
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
      const background = !label && target.kind === "frame" && target.children.length > 0 && isContainer(nodes.get(target.parent));
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
      else if (mode === "rotate") applyRotate(pointer);
      else if (mode === "multi") applySpan(pointer);
      else if (mode === "marquee" && (editor.marquee || moved(start, pointer))) applyMarquee(pointer);
    },

    up(pointer) {
      if (mode === "move" || mode === "resize" || mode === "rotate" || mode === "multi") end();
      else if (mode === "marquee" && !editor.marquee && pendingFrame) {
        select(pointer.shift ? [...baseSelection, pendingFrame] : [pendingFrame]);
      } else if (mode === "pending" && clicked && wasSelected && !pointer.shift && editor.selection.length > 1) {
        select([clicked]);
      }
      reset();
    },

    cancel() {
      if (mode === "move" || mode === "resize" || mode === "rotate" || mode === "multi") abort();
      reset();
    },
  };
}
