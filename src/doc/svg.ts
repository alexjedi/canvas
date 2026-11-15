import { parseCss, toHex } from "../render/color";
import { createNode, DEFAULT_STROKE } from "./create";
import type { Gradient, GradientStop, Paint, SceneNode, Stroke, StrokeCap, StrokeJoin, VectorPath } from "./types";
import { fitPaths } from "./vector";

type Matrix = [number, number, number, number, number, number];

interface Style {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  cap: StrokeCap;
  join: StrokeJoin;
  evenOdd: boolean;
}

interface Builder {
  paths: VectorPath[];
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  curveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  close(): void;
}

const KAPPA = 0.5522847498;
const RAD = Math.PI / 180;
const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;
const SKIPPED = new Set(["defs", "clipPath", "mask", "symbol", "pattern", "marker", "filter", "style", "title", "desc", "metadata", "text", "image", "use", "foreignObject", "linearGradient", "radialGradient"]);
const CONTAINERS = new Set(["g", "svg", "a", "switch"]);
const LABELS: Record<string, string> = { path: "Path", rect: "Rectangle", circle: "Ellipse", ellipse: "Ellipse", line: "Line", polyline: "Polyline", polygon: "Polygon" };
const INITIAL: Style = { fill: "#000000", stroke: "none", strokeWidth: 1, fillOpacity: 1, strokeOpacity: 1, cap: "butt", join: "miter", evenOdd: false };

const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

function parseTransform(value: string | null): Matrix | null {
  if (!value) return null;
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  for (const match of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = match[2].trim().split(/[\s,]+/).map(Number);
    let step: Matrix | null = null;
    if (match[1] === "matrix" && v.length >= 6) step = [v[0], v[1], v[2], v[3], v[4], v[5]];
    else if (match[1] === "translate") step = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (match[1] === "scale") step = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0];
    else if (match[1] === "rotate") {
      const cos = Math.cos(v[0] * RAD);
      const sin = Math.sin(v[0] * RAD);
      const cx = v[1] || 0;
      const cy = v[2] || 0;
      step = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
    } else if (match[1] === "skewX") step = [1, 0, Math.tan(v[0] * RAD), 1, 0, 0];
    else if (match[1] === "skewY") step = [1, Math.tan(v[0] * RAD), 0, 1, 0, 0];
    if (step && step.every(Number.isFinite)) m = multiply(m, step);
  }
  return m;
}

function read(element: Element, name: string): string | null {
  const inline = (element as SVGElement).style?.getPropertyValue(name);
  return inline || element.getAttribute(name);
}

const length = (element: Element, name: string) => parseFloat(element.getAttribute(name) ?? "") || 0;

function unit(value: string | null, fallback: number): number {
  if (value === null || value === "") return fallback;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return value.trim().endsWith("%") ? parsed / 100 : parsed;
}

function parseColor(value: string): { color: string; alpha: number } {
  const parsed = parseCss(value === "currentColor" ? "#000000" : value);
  return parsed ? { color: toHex(parsed), alpha: parsed[3] } : { color: "#000000", alpha: 1 };
}

function findStops(root: Document, element: Element, depth = 0): Element[] {
  const stops = Array.from(element.children).filter((child) => child.localName === "stop");
  if (stops.length > 0 || depth > 4) return stops;
  const link = element.getAttribute("href") ?? element.getAttribute("xlink:href");
  const target = link?.startsWith("#") ? root.querySelector(`[id="${link.slice(1)}"]`) : null;
  return target ? findStops(root, target, depth + 1) : [];
}

function parseGradient(root: Document, reference: string): Gradient | null {
  const id = reference.match(/url\(\s*["']?#([^"')\s]+)/)?.[1];
  const element = id ? root.querySelector(`[id="${id}"]`) : null;
  if (!element || (element.localName !== "linearGradient" && element.localName !== "radialGradient")) return null;
  const stops: GradientStop[] = findStops(root, element).map((stop) => {
    const parsed = parseColor(read(stop, "stop-color") ?? "#000000");
    return {
      offset: Math.min(1, Math.max(0, unit(stop.getAttribute("offset"), 0))),
      color: parsed.color,
      opacity: parsed.alpha * unit(read(stop, "stop-opacity"), 1),
    };
  });
  if (stops.length === 0) return null;
  if (element.localName === "radialGradient") return { type: "radial", angle: 0, stops };
  const dx = unit(element.getAttribute("x2"), 1) - unit(element.getAttribute("x1"), 0);
  const dy = unit(element.getAttribute("y2"), 0) - unit(element.getAttribute("y1"), 0);
  return { type: "linear", angle: Math.round(Math.atan2(dy, dx) / RAD), stops };
}

function parsePaint(root: Document, value: string, opacity: number): Paint | null {
  const trimmed = value.trim();
  if (trimmed === "none" || trimmed === "transparent") return null;
  if (trimmed.startsWith("url(")) {
    const gradient = parseGradient(root, trimmed);
    return gradient ? { color: gradient.stops[0].color, opacity, gradient } : null;
  }
  const parsed = parseColor(trimmed);
  return { color: parsed.color, opacity: parsed.alpha * opacity, gradient: null };
}

function inherit(element: Element, parent: Style): Style {
  const style = { ...parent };
  const fill = read(element, "fill");
  const stroke = read(element, "stroke");
  const width = read(element, "stroke-width");
  const fillOpacity = read(element, "fill-opacity");
  const strokeOpacity = read(element, "stroke-opacity");
  const cap = read(element, "stroke-linecap");
  const join = read(element, "stroke-linejoin");
  const rule = read(element, "fill-rule");
  if (fill) style.fill = fill;
  if (stroke) style.stroke = stroke;
  if (width) style.strokeWidth = unit(width, style.strokeWidth);
  if (fillOpacity) style.fillOpacity = unit(fillOpacity, 1);
  if (strokeOpacity) style.strokeOpacity = unit(strokeOpacity, 1);
  if (cap === "butt" || cap === "round" || cap === "square") style.cap = cap;
  if (join === "miter" || join === "round" || join === "bevel") style.join = join;
  if (rule) style.evenOdd = rule === "evenodd";
  return style;
}

function createBuilder(m: Matrix): Builder {
  const paths: VectorPath[] = [];
  let points: number[] | null = null;
  const tx = (x: number, y: number) => m[0] * x + m[2] * y + m[4];
  const ty = (x: number, y: number) => m[1] * x + m[3] * y + m[5];
  const anchor = (x: number, y: number) => {
    const px = tx(x, y);
    const py = ty(x, y);
    points?.push(px, py, px, py, px, py);
  };
  return {
    paths,
    moveTo(x, y) {
      points = [];
      paths.push({ closed: false, points });
      anchor(x, y);
    },
    lineTo(x, y) {
      if (!points) this.moveTo(x, y);
      else anchor(x, y);
    },
    curveTo(c1x, c1y, c2x, c2y, x, y) {
      if (!points) this.moveTo(x, y);
      if (!points) return;
      points[points.length - 2] = tx(c1x, c1y);
      points[points.length - 1] = ty(c1x, c1y);
      anchor(x, y);
      points[points.length - 4] = tx(c2x, c2y);
      points[points.length - 3] = ty(c2x, c2y);
    },
    close() {
      const path = paths[paths.length - 1];
      if (!path || !points) return;
      path.closed = true;
      const last = points.length - 6;
      if (last >= 12 && Math.abs(points[last] - points[0]) < 1e-6 && Math.abs(points[last + 1] - points[1]) < 1e-6) {
        points[2] = points[last + 2];
        points[3] = points[last + 3];
        points.length = last;
      }
      points = null;
    },
  };
}

function arcTo(builder: Builder, x0: number, y0: number, rx: number, ry: number, rotation: number, large: boolean, sweep: boolean, x: number, y: number) {
  if (rx === 0 || ry === 0) {
    builder.lineTo(x, y);
    return;
  }
  const cos = Math.cos(rotation * RAD);
  const sin = Math.sin(rotation * RAD);
  const hx = (x0 - x) / 2;
  const hy = (y0 - y) / 2;
  const px = cos * hx + sin * hy;
  const py = -sin * hx + cos * hy;
  let ax = Math.abs(rx);
  let ay = Math.abs(ry);
  const scale = (px * px) / (ax * ax) + (py * py) / (ay * ay);
  if (scale > 1) {
    ax *= Math.sqrt(scale);
    ay *= Math.sqrt(scale);
  }
  const numerator = ax * ax * ay * ay - ax * ax * py * py - ay * ay * px * px;
  const denominator = ax * ax * py * py + ay * ay * px * px;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / (denominator || 1)));
  const ccx = (factor * ax * py) / ay;
  const ccy = (-factor * ay * px) / ax;
  const cx = cos * ccx - sin * ccy + (x0 + x) / 2;
  const cy = sin * ccx + cos * ccy + (y0 + y) / 2;
  const start = Math.atan2((py - ccy) / ay, (px - ccx) / ax);
  let delta = Math.atan2((-py - ccy) / ay, (-px - ccx) / ax) - start;
  if (sweep && delta < 0) delta += Math.PI * 2;
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const span = delta / steps;
  const handle = (4 / 3) * Math.tan(span / 4);
  const at = (angle: number, dx: number, dy: number): [number, number] => {
    const ex = ax * (Math.cos(angle) + dx);
    const ey = ay * (Math.sin(angle) + dy);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey];
  };
  for (let i = 0; i < steps; i++) {
    const a = start + span * i;
    const b = a + span;
    const c1 = at(a, -handle * Math.sin(a), handle * Math.cos(a));
    const c2 = at(b, handle * Math.sin(b), -handle * Math.cos(b));
    const end = i === steps - 1 ? [x, y] : at(b, 0, 0);
    builder.curveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
  }
}

function tracePathData(builder: Builder, data: string) {
  let at = 0;
  let command = "";
  let cx = 0, cy = 0, sx = 0, sy = 0, lx = 0, ly = 0;
  let previous = "";
  let open = false;
  const skip = () => {
    while (at < data.length && /[\s,]/.test(data[at])) at++;
  };
  const number = (): number => {
    skip();
    NUMBER.lastIndex = at;
    const match = NUMBER.exec(data);
    if (!match) {
      at = data.length;
      return NaN;
    }
    at = NUMBER.lastIndex;
    return Number(match[0]);
  };
  const flag = (): boolean => {
    skip();
    return data[at++] === "1";
  };
  while (at < data.length) {
    skip();
    if (at >= data.length) break;
    if (/[a-zA-Z]/.test(data[at])) command = data[at++];
    else if (!command) break;
    const relative = command === command.toLowerCase();
    const ox = relative ? cx : 0;
    const oy = relative ? cy : 0;
    const kind = command.toUpperCase();
    if (kind === "Z") {
      builder.close();
      open = false;
      cx = sx;
      cy = sy;
      previous = kind;
      command = "";
      continue;
    }
    if (kind !== "M" && !open) builder.moveTo(cx, cy);
    open = true;
    if (kind === "M" || kind === "L" || kind === "T") {
      const x = number() + ox;
      const y = number() + oy;
      if (Number.isNaN(x + y)) break;
      if (kind === "M") {
        builder.moveTo(x, y);
        sx = x;
        sy = y;
        command = relative ? "l" : "L";
      } else if (kind === "L") {
        builder.lineTo(x, y);
      } else {
        const qx = previous === "Q" || previous === "T" ? cx * 2 - lx : cx;
        const qy = previous === "Q" || previous === "T" ? cy * 2 - ly : cy;
        builder.curveTo(cx + ((qx - cx) * 2) / 3, cy + ((qy - cy) * 2) / 3, x + ((qx - x) * 2) / 3, y + ((qy - y) * 2) / 3, x, y);
        lx = qx;
        ly = qy;
      }
      cx = x;
      cy = y;
    } else if (kind === "H" || kind === "V") {
      const value = number();
      if (Number.isNaN(value)) break;
      if (kind === "H") cx = value + ox;
      else cy = value + oy;
      builder.lineTo(cx, cy);
    } else if (kind === "C" || kind === "S") {
      const mirrored = previous === "C" || previous === "S";
      const c1x = kind === "C" ? number() + ox : mirrored ? cx * 2 - lx : cx;
      const c1y = kind === "C" ? number() + oy : mirrored ? cy * 2 - ly : cy;
      const c2x = number() + ox;
      const c2y = number() + oy;
      const x = number() + ox;
      const y = number() + oy;
      if (Number.isNaN(c1x + c1y + c2x + c2y + x + y)) break;
      builder.curveTo(c1x, c1y, c2x, c2y, x, y);
      lx = c2x;
      ly = c2y;
      cx = x;
      cy = y;
    } else if (kind === "Q") {
      const qx = number() + ox;
      const qy = number() + oy;
      const x = number() + ox;
      const y = number() + oy;
      if (Number.isNaN(qx + qy + x + y)) break;
      builder.curveTo(cx + ((qx - cx) * 2) / 3, cy + ((qy - cy) * 2) / 3, x + ((qx - x) * 2) / 3, y + ((qy - y) * 2) / 3, x, y);
      lx = qx;
      ly = qy;
      cx = x;
      cy = y;
    } else if (kind === "A") {
      const rx = number();
      const ry = number();
      const rotation = number();
      const large = flag();
      const sweep = flag();
      const x = number() + ox;
      const y = number() + oy;
      if (Number.isNaN(rx + ry + rotation + x + y)) break;
      arcTo(builder, cx, cy, rx, ry, rotation, large, sweep, x, y);
      cx = x;
      cy = y;
    } else {
      break;
    }
    previous = kind;
  }
}

function traceEllipse(builder: Builder, cx: number, cy: number, rx: number, ry: number) {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  builder.moveTo(cx, cy - ry);
  builder.curveTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy);
  builder.curveTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry);
  builder.curveTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy);
  builder.curveTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry);
  builder.close();
}

function traceRect(builder: Builder, element: Element) {
  const x = length(element, "x");
  const y = length(element, "y");
  const w = length(element, "width");
  const h = length(element, "height");
  const rawX = element.hasAttribute("rx") ? length(element, "rx") : length(element, "ry");
  const rawY = element.hasAttribute("ry") ? length(element, "ry") : rawX;
  const rx = Math.min(rawX, w / 2);
  const ry = Math.min(rawY, h / 2);
  if (w <= 0 || h <= 0) return;
  if (rx <= 0 || ry <= 0) {
    builder.moveTo(x, y);
    builder.lineTo(x + w, y);
    builder.lineTo(x + w, y + h);
    builder.lineTo(x, y + h);
    builder.close();
    return;
  }
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  builder.moveTo(x + rx, y);
  builder.lineTo(x + w - rx, y);
  builder.curveTo(x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry);
  builder.lineTo(x + w, y + h - ry);
  builder.curveTo(x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h);
  builder.lineTo(x + rx, y + h);
  builder.curveTo(x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry);
  builder.lineTo(x, y + ry);
  builder.curveTo(x, y + ry - ky, x + rx - kx, y, x + rx, y);
  builder.close();
}

function tracePoints(builder: Builder, element: Element, closed: boolean) {
  const values = (element.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  for (let i = 0; i + 1 < values.length; i += 2) {
    if (i === 0) builder.moveTo(values[0], values[1]);
    else builder.lineTo(values[i], values[i + 1]);
  }
  if (closed) builder.close();
}

function traceShape(builder: Builder, element: Element) {
  const tag = element.localName;
  if (tag === "path") tracePathData(builder, element.getAttribute("d") ?? "");
  else if (tag === "rect") traceRect(builder, element);
  else if (tag === "circle") traceEllipse(builder, length(element, "cx"), length(element, "cy"), length(element, "r"), length(element, "r"));
  else if (tag === "ellipse") traceEllipse(builder, length(element, "cx"), length(element, "cy"), length(element, "rx"), length(element, "ry"));
  else if (tag === "polyline") tracePoints(builder, element, false);
  else if (tag === "polygon") tracePoints(builder, element, true);
  else if (tag === "line") {
    builder.moveTo(length(element, "x1"), length(element, "y1"));
    builder.lineTo(length(element, "x2"), length(element, "y2"));
  }
}

function buildShape(root: Document, element: Element, m: Matrix, style: Style, opacity: number): SceneNode[] {
  const builder = createBuilder(m);
  traceShape(builder, element);
  const pixels = builder.paths.filter((path) => path.points.length >= 12);
  if (pixels.length === 0) return [];
  const fill = parsePaint(root, style.fill, style.fillOpacity);
  const paint = parsePaint(root, style.stroke, style.strokeOpacity);
  const width = style.strokeWidth * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const stroke: Stroke | null = paint && width > 0 ? { ...DEFAULT_STROKE, ...paint, width, align: "center", cap: style.cap, join: style.join } : null;
  if (!fill && !stroke) return [];
  const fitted = fitPaths(pixels);
  return [
    createNode("vector", {
      name: element.getAttribute("id") || LABELS[element.localName] || "Vector",
      x: fitted.x,
      y: fitted.y,
      width: fitted.width,
      height: fitted.height,
      paths: fitted.paths,
      fill,
      stroke,
      opacity,
      evenOdd: style.evenOdd,
    }),
  ];
}

function bundle(trees: SceneNode[][], name: string): SceneNode[] {
  if (trees.length === 0) return [];
  if (trees.length === 1) return trees[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const tree of trees) {
    const top = tree[0];
    minX = Math.min(minX, top.x);
    minY = Math.min(minY, top.y);
    maxX = Math.max(maxX, top.x + top.width);
    maxY = Math.max(maxY, top.y + top.height);
  }
  const group = createNode("group", { name, x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  const list: SceneNode[] = [group];
  for (const tree of trees) {
    const top = tree[0];
    top.x -= minX;
    top.y -= minY;
    top.parent = group.id;
    group.children.push(top.id);
    for (const node of tree) list.push(node);
  }
  return list;
}

function walk(root: Document, element: Element, parentMatrix: Matrix, parentStyle: Style, parentOpacity: number): SceneNode[] {
  const tag = element.localName;
  if (SKIPPED.has(tag) || read(element, "display") === "none" || read(element, "visibility") === "hidden") return [];
  const local = parseTransform(element.getAttribute("transform"));
  const m = local ? multiply(parentMatrix, local) : parentMatrix;
  const style = inherit(element, parentStyle);
  const opacity = parentOpacity * unit(read(element, "opacity"), 1);
  if (!CONTAINERS.has(tag)) return buildShape(root, element, m, style, opacity);
  const trees: SceneNode[][] = [];
  for (const child of Array.from(element.children)) {
    const tree = walk(root, child, m, style, opacity);
    if (tree.length > 0) trees.push(tree);
  }
  return bundle(trees, element.getAttribute("id") || "Group");
}

export function extractSvg(text: string): string {
  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  return start >= 0 && end > start ? text.slice(start, end + 6) : "";
}

export function importSvg(markup: string): SceneNode[] {
  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  } catch {
    return [];
  }
  const svg = parsed.documentElement;
  if (!svg || svg.localName !== "svg" || parsed.querySelector("parsererror")) return [];
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
    const width = svg.getAttribute("width");
    const height = svg.getAttribute("height");
    const sx = width && !width.includes("%") ? parseFloat(width) / box[2] : 0;
    const sy = height && !height.includes("%") ? parseFloat(height) / box[3] : 0;
    const scale = sx > 0 && sy > 0 ? Math.min(sx, sy) : sx > 0 ? sx : sy > 0 ? sy : 1;
    m = [scale, 0, 0, scale, -box[0] * scale, -box[1] * scale];
  }
  const list = walk(parsed, svg, m, INITIAL, 1);
  if (list.length === 0) return [];
  if (list[0].kind === "group" && list[0].name === "Group") list[0].name = "SVG";
  list[0].x = 0;
  list[0].y = 0;
  return list;
}
