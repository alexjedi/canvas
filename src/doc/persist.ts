import { createDocument, normalizeNode } from "./create";
import { loadNodes, nodes, onCommit } from "./store";
import { ROOT, type SceneNode } from "./types";

const DB_NAME = "canvas";
const NODES = "nodes";
const ASSETS = "assets";
const FLUSH_DELAY = 400;

export interface StoredAsset {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

const dirty = new Set<string>();
let db: IDBDatabase | null = null;
let timer = 0;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(NODES)) database.createObjectStore(NODES, { keyPath: "id" });
      if (!database.objectStoreNames.contains(ASSETS)) database.createObjectStore(ASSETS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function request<T>(build: (database: IDBDatabase) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (!db) return resolve(undefined);
    try {
      const pending = build(db);
      pending.onsuccess = () => resolve(pending.result);
      pending.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export const readAsset = (id: string) => request<StoredAsset>((database) => database.transaction(ASSETS, "readonly").objectStore(ASSETS).get(id));

export const writeAsset = (asset: StoredAsset) => request((database) => database.transaction(ASSETS, "readwrite").objectStore(ASSETS).put(asset));

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
    const store = db.transaction(NODES, "readwrite").objectStore(NODES);
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

async function collectAssets() {
  const keys = await request((database) => database.transaction(ASSETS, "readonly").objectStore(ASSETS).getAllKeys());
  if (!keys || !db) return;
  const used = new Set<string>();
  for (const node of nodes.values()) if (node.asset) used.add(node.asset);
  const unused = keys.filter((key) => !used.has(String(key)));
  if (unused.length === 0) return;
  const store = db.transaction(ASSETS, "readwrite").objectStore(ASSETS);
  for (const key of unused) store.delete(key);
}

export async function startPersistence() {
  try {
    db = await openDatabase();
  } catch {
    db = null;
  }
  const stored = (await request<SceneNode[]>((database) => database.transaction(NODES, "readonly").objectStore(NODES).getAll())) ?? [];
  if (isValid(stored)) {
    loadNodes(stored.map(normalizeNode));
    void collectAssets();
  } else {
    createDocument();
    if (db && stored.length > 0) db.transaction(NODES, "readwrite").objectStore(NODES).clear();
    saveAll();
  }
  onCommit((ids) => {
    for (const id of ids) dirty.add(id);
    if (!timer) timer = window.setTimeout(flush, FLUSH_DELAY);
  });
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}
