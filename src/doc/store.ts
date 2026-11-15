import { invalidate } from "../frame";
import type { NodeProps, SceneNode } from "./types";

type Snapshot = SceneNode | null;

interface Entry {
  before: Map<string, Snapshot>;
  after: Map<string, Snapshot>;
  mergeKey: string;
  time: number;
}

export const nodes = new Map<string, SceneNode>();
export const structure = { version: 0 };

const HISTORY_LIMIT = 200;
const MERGE_WINDOW = 600;

const past: Entry[] = [];
const future: Entry[] = [];
const commitListeners = new Set<(ids: Iterable<string>) => void>();

const dirty = new Set<string>();
let normalizer: ((ids: Set<string>) => void) | null = null;
let open: Map<string, Snapshot> | null = null;
let openKey = "";
let depth = 0;
let mergeable = false;

const snapshot = (node: SceneNode): SceneNode => ({ ...node, children: node.children.slice() });

function emit(ids: Iterable<string>) {
  commitListeners.forEach((fn) => fn(ids));
}

export function onCommit(fn: (ids: Iterable<string>) => void) {
  commitListeners.add(fn);
  return () => {
    commitListeners.delete(fn);
  };
}

export function edit(id: string): SceneNode | undefined {
  const node = nodes.get(id);
  if (open && !open.has(id)) open.set(id, node ? snapshot(node) : null);
  if (node) node.version++;
  dirty.add(id);
  invalidate();
  return node;
}

export function setNormalizer(fn: (ids: Set<string>) => void) {
  normalizer = fn;
}

export function flushDirty() {
  if (dirty.size === 0) return;
  if (normalizer && open) normalizer(dirty);
  dirty.clear();
}

export function begin(mergeKey = "") {
  if (depth++ > 0) return;
  open = new Map();
  openKey = mergeKey;
}

export function end() {
  if (depth === 0) return;
  if (depth === 1) flushDirty();
  if (--depth > 0 || !open) return;
  const before = open;
  open = null;
  if (before.size === 0) return;
  const after = new Map<string, Snapshot>();
  for (const id of before.keys()) {
    const node = nodes.get(id);
    after.set(id, node ? snapshot(node) : null);
  }
  const now = performance.now();
  const last = past[past.length - 1];
  if (mergeable && openKey && last && last.mergeKey === openKey && now - last.time < MERGE_WINDOW) {
    for (const [id, snap] of before) if (!last.before.has(id)) last.before.set(id, snap);
    for (const [id, snap] of after) last.after.set(id, snap);
    last.time = now;
  } else {
    past.push({ before, after, mergeKey: openKey, time: now });
    if (past.length > HISTORY_LIMIT) past.shift();
  }
  mergeable = true;
  future.length = 0;
  emit(before.keys());
}

export function transact<T>(fn: () => T, mergeKey = ""): T {
  begin(mergeKey);
  try {
    return fn();
  } finally {
    end();
  }
}

function restore(map: Map<string, Snapshot>) {
  structure.version++;
  for (const [id, snap] of map) {
    const node = nodes.get(id);
    if (!snap) {
      nodes.delete(id);
    } else if (node) {
      const version = node.version + 1;
      Object.assign(node, snap);
      node.children = snap.children.slice();
      node.version = version;
    } else {
      nodes.set(id, { ...snap, children: snap.children.slice(), version: snap.version + 1 });
    }
  }
  invalidate();
}

export function abort() {
  if (!open) return;
  const before = open;
  open = null;
  depth = 0;
  dirty.clear();
  restore(before);
}

export function undo() {
  if (depth > 0) return;
  const entry = past.pop();
  if (!entry) return;
  restore(entry.before);
  future.push(entry);
  mergeable = false;
  emit(entry.before.keys());
}

export function redo() {
  if (depth > 0) return;
  const entry = future.pop();
  if (!entry) return;
  restore(entry.after);
  past.push(entry);
  mergeable = false;
  emit(entry.after.keys());
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

export function setProps(id: string, props: Partial<NodeProps>) {
  begin();
  const node = edit(id);
  if (node) Object.assign(node, props);
  end();
}

export function insertNodes(list: SceneNode[], parentId: string, index = -1) {
  const root = list[0];
  if (!root) return;
  structure.version++;
  begin();
  const parent = edit(parentId);
  if (parent) {
    for (const node of list) {
      edit(node.id);
      nodes.set(node.id, node);
    }
    root.parent = parentId;
    const at = index < 0 || index > parent.children.length ? parent.children.length : index;
    parent.children.splice(at, 0, root.id);
  }
  end();
}

function drop(id: string) {
  const node = edit(id);
  if (!node) return;
  for (const child of node.children) drop(child);
  nodes.delete(id);
}

export function removeNode(id: string) {
  const node = nodes.get(id);
  if (!node) return;
  structure.version++;
  begin();
  const parent = edit(node.parent);
  if (parent) {
    const at = parent.children.indexOf(id);
    if (at >= 0) parent.children.splice(at, 1);
  }
  drop(id);
  end();
}

export function moveNode(id: string, parentId: string, index = -1) {
  const node = nodes.get(id);
  if (!node || !nodes.has(parentId)) return;
  structure.version++;
  begin();
  const from = edit(node.parent);
  const to = edit(parentId);
  edit(id);
  if (from && to) {
    const at = from.children.indexOf(id);
    if (at >= 0) from.children.splice(at, 1);
    const target = index < 0 || index > to.children.length ? to.children.length : index;
    to.children.splice(target, 0, id);
    node.parent = parentId;
  }
  end();
}

export function loadNodes(list: SceneNode[]) {
  nodes.clear();
  structure.version++;
  for (const node of list) nodes.set(node.id, node);
  past.length = 0;
  future.length = 0;
  open = null;
  depth = 0;
  invalidate();
}
