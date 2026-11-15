import { nodes } from "../doc/store";
import { editor } from "../editor/state";
import { cssColor, hexToRgb, toHex, type Rgba } from "./color";

type Sampler = (x: number, y: number) => Rgba | null;

let sampler: Sampler | null = null;

export function setSampler(next: Sampler | null) {
  sampler = next;
}

export function pickColor(x: number, y: number): string | null {
  const pixel = sampler?.(x, y);
  if (!pixel) return null;
  const page = nodes.get(editor.page)?.fill?.color;
  const background = page ? hexToRgb(page) : cssColor("--color-stage", [0, 0, 0]);
  const rest = 1 - pixel[3];
  return toHex([pixel[0] + background[0] * rest, pixel[1] + background[1] * rest, pixel[2] + background[2] * rest]);
}
