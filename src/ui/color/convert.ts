import type { Gradient, GradientStop, Paint } from "../../doc/types";
import type { Notation } from "../../editor/prefs";
import { hexToRgb, parseCss, toHex } from "../../render/color";
import { stopColor } from "../../render/paint";

const trim = (value: number, digits: number) => String(Math.round(value * 10 ** digits) / 10 ** digits);

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation, lightness];
}

const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

function toOklch(r: number, g: number, b: number): [number, number, number] {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, bb);
  const hue = chroma < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return [lightness, chroma, hue];
}

export function formatColor(paint: Paint, notation: Notation, alpha: boolean): string {
  const [r, g, b] = hexToRgb(paint.color);
  const opaque = !alpha || paint.opacity >= 1;
  const tail = opaque ? "" : ` / ${trim(paint.opacity, 2)}`;
  if (notation === "rgb") return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}${tail})`;
  if (notation === "hsl") {
    const [h, s, l] = toHsl(r, g, b);
    return `hsl(${trim(h, 0)} ${trim(s * 100, 0)}% ${trim(l * 100, 0)}%${tail})`;
  }
  if (notation === "oklch") {
    const [l, c, h] = toOklch(r, g, b);
    return `oklch(${trim(l, 3)} ${trim(c, 3)} ${trim(h, 1)}${tail})`;
  }
  const suffix = opaque
    ? ""
    : Math.round(paint.opacity * 255)
        .toString(16)
        .padStart(2, "0");
  return (paint.color + suffix).toUpperCase();
}

export function parseColor(text: string): Paint | null {
  const value = text.trim();
  const parsed = parseCss(/^[0-9a-f]{3,8}$/i.test(value) ? `#${value}` : value);
  return parsed ? { color: toHex(parsed), opacity: Math.round(parsed[3] * 100) / 100, gradient: null } : null;
}

export function cssGradient(gradient: Gradient): string {
  const stops = gradient.stops.map((stop) => `${stopColor(stop)} ${trim(stop.offset * 100, 2)}%`).join(", ");
  return gradient.type === "linear" ? `linear-gradient(${gradient.angle + 90}deg, ${stops})` : `radial-gradient(ellipse closest-side, ${stops})`;
}

export function defaultGradient(type: Gradient["type"], color: string): Gradient {
  return { type, angle: 90, stops: [{ offset: 0, color, opacity: 1 }, { offset: 1, color, opacity: 0 }] };
}

export function stopAt(stops: readonly GradientStop[], offset: number): GradientStop {
  let before = stops[0];
  let after = stops[stops.length - 1];
  for (const stop of stops) {
    if (stop.offset <= offset) before = stop;
    else {
      after = stop;
      break;
    }
  }
  if (before.offset > offset) before = after = stops[0];
  if (after.offset < offset) after = before;
  const span = after.offset - before.offset;
  const t = span > 0 ? (offset - before.offset) / span : 0;
  const from = hexToRgb(before.color);
  const to = hexToRgb(after.color);
  return {
    offset,
    color: toHex([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]),
    opacity: Math.round((before.opacity + (after.opacity - before.opacity) * t) * 100) / 100,
  };
}
