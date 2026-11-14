import { invalidate } from "../frame";

const KEY = "canvas:prefs";

export const prefs = { pixelGrid: true, snapObjects: true };

try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) ?? "{}"));
} catch {}

export function setPref(key: keyof typeof prefs, value: boolean) {
  prefs[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  invalidate();
}

export const grid = (value: number) => (prefs.pixelGrid ? Math.round(value) : value);
