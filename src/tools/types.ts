export interface Pointer {
  x: number;
  y: number;
  sx: number;
  sy: number;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  clicks: number;
}

export interface Tool {
  cursor: string;
  down(pointer: Pointer): void;
  drag(pointer: Pointer): void;
  up(pointer: Pointer): void;
  hover?(pointer: Pointer): string;
  cancel?(): void;
}

export const DRAG_THRESHOLD = 3;

export const moved = (a: Pointer, b: Pointer) => Math.hypot(a.sx - b.sx, a.sy - b.sy) > DRAG_THRESHOLD;
