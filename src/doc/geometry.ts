import { edit, moveNode, nodes } from "./store";
import type { Point, Rect, SceneNode } from "./types";
import { hitVector } from "./vector";

export type Mat = Float64Array;

const RAD = Math.PI / 180;

export const mat = (): Mat => new Float64Array([1, 0, 0, 1, 0, 0]);

export function setIdentity(out: Mat): Mat {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  out[4] = 0;
  out[5] = 0;
  return out;
}

export function setLocal(out: Mat, node: SceneNode): Mat {
  if (node.rotation === 0) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
  } else {
    const cos = Math.cos(node.rotation * RAD);
    const sin = Math.sin(node.rotation * RAD);
    out[0] = cos;
    out[1] = sin;
    out[2] = -sin;
    out[3] = cos;
  }
  out[4] = node.x;
  out[5] = node.y;
  return out;
}

export function multiply(out: Mat, a: Mat, b: Mat): Mat {
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5];
  const b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];
  out[0] = a0 * b0 + a2 * b1;
  out[1] = a1 * b0 + a3 * b1;
  out[2] = a0 * b2 + a2 * b3;
  out[3] = a1 * b2 + a3 * b3;
  out[4] = a0 * b4 + a2 * b5 + a4;
  out[5] = a1 * b4 + a3 * b5 + a5;
  return out;
}

export function invert(out: Mat, m: Mat): Mat {
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
  const det = a * d - b * c || 1;
  out[0] = d / det;
  out[1] = -b / det;
  out[2] = -c / det;
  out[3] = a / det;
  out[4] = (c * f - d * e) / det;
  out[5] = (b * e - a * f) / det;
  return out;
}

export const apply = (m: Mat, x: number, y: number): Point => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

export const isContainer = (node: SceneNode | undefined) => !!node && (node.kind === "page" || node.kind === "document");

const scratch = mat();

export function setWorld(out: Mat, node: SceneNode | undefined): Mat {
  if (!node || isContainer(node)) return setIdentity(out);
  const parent = nodes.get(node.parent);
  if (!parent || isContainer(parent)) return setLocal(out, node);
  setWorld(out, parent);
  return multiply(out, out, setLocal(scratch, node));
}

export const worldOf = (id: string): Mat => setWorld(mat(), nodes.get(id));

export function worldBounds(node: SceneNode): Rect {
  const m = setWorld(mat(), node);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < 4; i++) {
    const lx = i === 1 || i === 2 ? node.width : 0;
    const ly = i >= 2 ? node.height : 0;
    const x = m[0] * lx + m[2] * ly + m[4];
    const y = m[1] * lx + m[3] * ly + m[5];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function unionBounds(ids: readonly string[]): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    const node = nodes.get(id);
    if (!node) continue;
    const b = worldBounds(node);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const intersects = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

function hitChildren(parent: SceneNode, x: number, y: number, framesOnly: boolean, exclude: ReadonlySet<string> | null): SceneNode | null {
  for (let i = parent.children.length - 1; i >= 0; i--) {
    const node = nodes.get(parent.children[i]);
    if (!node || !node.visible || node.locked) continue;
    const isGroup = node.kind === "group";
    if (framesOnly && node.kind !== "frame" && !isGroup) continue;
    if (exclude?.has(node.id)) continue;
    const dx = x - node.x;
    const dy = y - node.y;
    let lx = dx;
    let ly = dy;
    if (node.rotation !== 0) {
      const cos = Math.cos(node.rotation * RAD);
      const sin = Math.sin(node.rotation * RAD);
      lx = dx * cos + dy * sin;
      ly = dy * cos - dx * sin;
    }
    const inside = lx >= 0 && ly >= 0 && lx <= node.width && ly <= node.height;
    if (node.children.length > 0 && (inside || !node.clip)) {
      const hit = hitChildren(node, lx, ly, framesOnly, exclude);
      if (hit) return hit;
    }
    if (node.kind === "vector") {
      if (!framesOnly && hitVector(node, lx, ly)) return node;
      continue;
    }
    if (!inside || isGroup) continue;
    if (node.kind !== "ellipse") return node;
    const ex = (lx * 2) / node.width - 1;
    const ey = (ly * 2) / node.height - 1;
    if (ex * ex + ey * ey <= 1) return node;
  }
  return null;
}

export function hitTest(pageId: string, x: number, y: number): SceneNode | null {
  const page = nodes.get(pageId);
  return page ? hitChildren(page, x, y, false, null) : null;
}

export function frameAt(pageId: string, x: number, y: number, exclude: ReadonlySet<string> | null = null): SceneNode | null {
  const page = nodes.get(pageId);
  return page ? hitChildren(page, x, y, true, exclude) : null;
}

export function isDescendant(id: string, ancestorId: string): boolean {
  let node = nodes.get(id);
  while (node && node.parent) {
    if (node.parent === ancestorId) return true;
    node = nodes.get(node.parent);
  }
  return false;
}

export function ancestors(id: string): SceneNode[] {
  const chain: SceneNode[] = [];
  let node = nodes.get(nodes.get(id)?.parent ?? "");
  while (node && !isContainer(node)) {
    chain.push(node);
    node = nodes.get(node.parent);
  }
  return chain;
}

export function topLevel(ids: readonly string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    let node = nodes.get(id);
    if (!node) return false;
    while (node && node.parent) {
      if (set.has(node.parent)) return false;
      node = nodes.get(node.parent);
    }
    return true;
  });
}

export function documentOrder(pageId: string): Map<string, number> {
  const order = new Map<string, number>();
  const walk = (id: string) => {
    const node = nodes.get(id);
    if (!node) return;
    order.set(id, order.size);
    node.children.forEach(walk);
  };
  walk(pageId);
  return order;
}

export function sortByOrder(ids: readonly string[], pageId: string): string[] {
  const order = documentOrder(pageId);
  return ids.slice().sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export function reparent(id: string, parentId: string, index = -1) {
  const node = nodes.get(id);
  const parent = nodes.get(parentId);
  if (!node || !parent || id === parentId || isDescendant(parentId, id)) return;
  let target = index;
  if (node.parent === parentId) {
    const current = parent.children.indexOf(id);
    if (target < 0) target = parent.children.length;
    if (current < target) target--;
    if (current === target) return;
  } else {
    const world = setWorld(mat(), node);
    const local = multiply(mat(), invert(mat(), setWorld(mat(), parent)), world);
    const moved = edit(id);
    if (moved) {
      moved.x = local[4];
      moved.y = local[5];
      moved.rotation = normalizeAngle(Math.atan2(local[1], local[0]) / RAD);
    }
  }
  moveNode(id, parentId, target);
}

export function normalizeAngle(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Math.abs(wrapped) < 1e-9 ? 0 : Math.round(wrapped * 100) / 100;
}

export function worldRotation(node: SceneNode): number {
  const m = setWorld(mat(), node);
  return Math.atan2(m[1], m[0]) / RAD;
}

export function rotateAroundCenter(id: string, rotation: number) {
  const node = edit(id);
  if (!node) return;
  const hw = node.width / 2;
  const hh = node.height / 2;
  const m = setLocal(mat(), node);
  const cx = m[0] * hw + m[2] * hh + m[4];
  const cy = m[1] * hw + m[3] * hh + m[5];
  node.rotation = normalizeAngle(rotation);
  setLocal(m, node);
  node.x = cx - (m[0] * hw + m[2] * hh);
  node.y = cy - (m[1] * hw + m[3] * hh);
}

export function nearestFrame(node: SceneNode): string {
  let parent = nodes.get(node.parent);
  while (parent && parent.kind === "group") parent = nodes.get(parent.parent);
  return parent?.id ?? "";
}

export function translateWorld(id: string, dx: number, dy: number) {
  const node = nodes.get(id);
  if (!node || (dx === 0 && dy === 0)) return;
  const inverse = invert(mat(), setWorld(mat(), nodes.get(node.parent)));
  const target = edit(id);
  if (!target) return;
  target.x += inverse[0] * dx + inverse[2] * dy;
  target.y += inverse[1] * dx + inverse[3] * dy;
}
