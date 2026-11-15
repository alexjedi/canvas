export type Rgb = [number, number, number];
export type Rgba = [number, number, number, number];

const SENTINEL = "#010203";

let context: CanvasRenderingContext2D | null = null;

export function parseCss(value: string): Rgba | null {
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context || !value) return null;
  context.canvas.width = 1;
  context.canvas.height = 1;
  context.fillStyle = SENTINEL;
  context.fillStyle = value;
  if (context.fillStyle === SENTINEL && value.trim().toLowerCase() !== SENTINEL) return null;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
}

export function cssColor(variable: string, fallback: Rgb): Rgb {
  const parsed = parseCss(getComputedStyle(document.documentElement).getPropertyValue(variable).trim());
  return parsed ? [parsed[0], parsed[1], parsed[2]] : fallback;
}

export const toHex = (rgb: readonly number[]) =>
  "#" +
  [rgb[0], rgb[1], rgb[2]]
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
