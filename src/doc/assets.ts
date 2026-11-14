import { invalidate } from "../frame";
import { readAsset, writeAsset } from "./persist";

const bitmaps = new Map<string, ImageBitmap>();
const blobs = new Map<string, Blob>();
const loading = new Map<string, Promise<ImageBitmap | undefined>>();

async function load(id: string): Promise<ImageBitmap | undefined> {
  const stored = await readAsset(id);
  if (!stored) return undefined;
  const bitmap = await createImageBitmap(stored.blob);
  bitmaps.set(id, bitmap);
  blobs.set(id, stored.blob);
  invalidate();
  return bitmap;
}

export function ensureBitmap(id: string): Promise<ImageBitmap | undefined> {
  const ready = bitmaps.get(id);
  if (ready) return Promise.resolve(ready);
  let pending = loading.get(id);
  if (!pending) {
    pending = load(id).catch(() => undefined);
    loading.set(id, pending);
  }
  return pending;
}

export function getBitmap(id: string): ImageBitmap | undefined {
  if (!id) return undefined;
  const ready = bitmaps.get(id);
  if (!ready && !loading.has(id)) void ensureBitmap(id);
  return ready;
}

export const getBlob = (id: string) => blobs.get(id);

export async function importImage(file: Blob): Promise<{ id: string; width: number; height: number } | null> {
  try {
    const bytes = await file.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    let id = "";
    for (let i = 0; i < 16; i++) id += digest[i].toString(16).padStart(2, "0");
    const bitmap = bitmaps.get(id) ?? (await createImageBitmap(file));
    bitmaps.set(id, bitmap);
    blobs.set(id, file);
    void writeAsset({ id, blob: file, width: bitmap.width, height: bitmap.height });
    return { id, width: bitmap.width, height: bitmap.height };
  } catch {
    return null;
  }
}
