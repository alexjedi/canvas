import { useSyncExternalStore } from "react";
import { nodes } from "../doc/store";
import type { NodeProps, Paint, SceneNode, Stroke } from "../doc/types";
import { editor } from "../editor/state";
import { subscribe } from "../frame";

export const MIXED = Symbol("mixed");
export type Mixed = typeof MIXED;

export function useFrame<T>(read: () => T): T {
  return useSyncExternalStore(subscribe, read);
}

export const useNodeVersion = (id: string) => useFrame(() => nodes.get(id)?.version ?? -1);

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Partial<Stroke>;
  const right = b as Partial<Stroke>;
  return left.color === right.color && left.opacity === right.opacity && left.width === right.width && left.align === right.align;
}

export function useSelected<K extends keyof NodeProps>(key: K): NodeProps[K] | Mixed | undefined {
  return useFrame(() => {
    const first = nodes.get(editor.selection[0] ?? "");
    if (!first) return undefined;
    const value = first[key];
    for (let i = 1; i < editor.selection.length; i++) {
      const node = nodes.get(editor.selection[i]);
      if (node && !same(node[key], value)) return MIXED;
    }
    return value;
  });
}

export function useSelectionEvery(test: (node: SceneNode) => boolean): boolean {
  return useFrame(() =>
    editor.selection.every((id) => {
      const node = nodes.get(id);
      return !!node && test(node);
    }),
  );
}

export const numberOf = (value: number | Mixed | undefined): number | null => (typeof value === "number" ? value : null);

export const paintOf = <T extends Paint>(value: T | null | Mixed | undefined): T | null => (value && value !== MIXED ? value : null);
