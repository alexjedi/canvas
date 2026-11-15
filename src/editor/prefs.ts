import { invalidate } from "../frame";

export type Notation = "hex" | "rgb" | "hsl" | "oklch";

const KEY = "canvas:prefs";

export const prefs = {
  pixelGrid: true,
  snapObjects: true,
  notation: "hex" as Notation,
  swatches: [] as readonly string[],
};

type Prefs = typeof prefs;

try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) ?? "{}"));
} catch {}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefs[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  invalidate();
}

export const grid = (value: number) => (prefs.pixelGrid ? Math.round(value) : value);
