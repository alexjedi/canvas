import { createDocument } from "./create";
import { loadNodes, nodes, onCommit } from "./store";
import { ROOT, type SceneNode } from "./types";

const DB_NAME = "canvas";
const STORE = "nodes";
const FLUSH_DELAY = 400;

const dirty = new Set<string>();
let db: IDBDatabase | null = null;
let timer = 0;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAll(database: IDBDatabase): Promise<SceneNode[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as SceneNode[]);
    request.onerror = () => reject(request.error);
  });
}

function isValid(list: SceneNode[]): boolean {
  const ids = new Set(list.map((node) => node.id));
  const root = list.find((node) => node.id === ROOT);
  if (!root || root.children.length === 0) return false;
  return list.every((node) => node.children.every((child) => ids.has(child)));
}

function flush() {
  window.clearTimeout(timer);
  timer = 0;
  if (!db || dirty.size === 0) return;
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    for (const id of dirty) {
      const node = nodes.get(id);
      if (node) store.put(node);
      else store.delete(id);
    }
    dirty.clear();
  } catch {
    db = null;
  }
}

function saveAll() {
  for (const id of nodes.keys()) dirty.add(id);
  flush();
}

export async function startPersistence() {
  let stored: SceneNode[] = [];
  try {
    db = await openDatabase();
    stored = await readAll(db);
  } catch {
    db = null;
  }
  if (isValid(stored)) {
    loadNodes(stored);
  } else {
    createDocument();
    if (db && stored.length > 0) db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    saveAll();
  }
  onCommit((ids) => {
    for (const id of ids) dirty.add(id);
    if (!timer) timer = window.setTimeout(flush, FLUSH_DELAY);
  });
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}
