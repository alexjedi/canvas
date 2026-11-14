import { mat, setLocal } from "./geometry";
import { edit, nodes, removeNode, setNormalizer } from "./store";
import type { SceneNode } from "./types";

export interface ScaleOrigin {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const EPSILON = 1e-6;
const MAX_PASSES = 64;
const RAD = Math.PI / 180;
const scratch = mat();

function refit(group: SceneNode) {
  if (group.children.length === 0) {
    removeNode(group.id);
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of group.children) {
    const child = nodes.get(id);
    if (!child) continue;
    const m = setLocal(scratch, child);
    for (let i = 0; i < 4; i++) {
      const lx = i === 1 || i === 2 ? child.width : 0;
      const ly = i >= 2 ? child.height : 0;
      const x = m[0] * lx + m[2] * ly + m[4];
      const y = m[1] * lx + m[3] * ly + m[5];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return;
  const width = maxX - minX;
  const height = maxY - minY;
  const shifted = Math.abs(minX) > EPSILON || Math.abs(minY) > EPSILON;
  if (!shifted && Math.abs(width - group.width) < EPSILON && Math.abs(height - group.height) < EPSILON) return;
  const target = edit(group.id);
  if (!target) return;
  if (shifted) {
    const m = setLocal(scratch, group);
    target.x = m[0] * minX + m[2] * minY + m[4];
    target.y = m[1] * minX + m[3] * minY + m[5];
    for (const id of group.children) {
      const child = edit(id);
      if (!child) continue;
      child.x -= minX;
      child.y -= minY;
    }
  }
  target.width = width;
  target.height = height;
}

function normalize(dirty: Set<string>) {
  for (let pass = 0; pass < MAX_PASSES && dirty.size > 0; pass++) {
    const ids = [...dirty];
    dirty.clear();
    const groups = new Set<SceneNode>();
    for (const id of ids) {
      const node = nodes.get(id);
      if (!node) continue;
      if (node.kind === "group") groups.add(node);
      const parent = nodes.get(node.parent);
      if (parent?.kind === "group") groups.add(parent);
    }
    for (const group of groups) if (nodes.has(group.id)) refit(group);
  }
}

export function installGroups() {
  setNormalizer(normalize);
}

export function captureGroup(id: string, out: ScaleOrigin[] = []): ScaleOrigin[] {
  const group = nodes.get(id);
  if (!group) return out;
  for (const childId of group.children) {
    const child = nodes.get(childId);
    if (!child) continue;
    out.push({ id: childId, x: child.x, y: child.y, width: child.width, height: child.height, rotation: child.rotation });
    if (child.kind === "group") captureGroup(childId, out);
  }
  return out;
}

export function applyGroupScale(origins: ScaleOrigin[], sx: number, sy: number) {
  for (const origin of origins) {
    const node = edit(origin.id);
    if (!node) continue;
    const cos = Math.cos(origin.rotation * RAD);
    const sin = Math.sin(origin.rotation * RAD);
    node.x = origin.x * sx;
    node.y = origin.y * sy;
    node.width = origin.width * Math.hypot(sx * cos, sy * sin);
    node.height = origin.height * Math.hypot(sx * sin, sy * cos);
  }
}

export function resizeNode(id: string, width: number, height: number) {
  const node = nodes.get(id);
  if (!node) return;
  if (node.kind === "group" && node.width > 0 && node.height > 0) {
    applyGroupScale(captureGroup(id), width / node.width, height / node.height);
    return;
  }
  const target = edit(id);
  if (!target) return;
  target.width = width;
  target.height = height;
}
