export type Rgb = [number, number, number];

let context: CanvasRenderingContext2D | null = null;

export function cssColor(variable: string, fallback: Rgb): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!value) return fallback;
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context) return fallback;
  context.canvas.width = 1;
  context.canvas.height = 1;
  context.fillStyle = "#000";
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
