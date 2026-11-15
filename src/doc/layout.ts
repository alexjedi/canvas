import { edit, moveNode, nodes } from "./store";
import type { SceneNode } from "./types";

const EPSILON = 1e-6;
const RAD = Math.PI / 180;

const box = { width: 0, height: 0, offsetX: 0, offsetY: 0 };

export const isLayout = (node: SceneNode | null | undefined): boolean => !!node && node.kind === "frame" && node.layout !== "none";

export const canFill = (node: SceneNode) => node.rotation === 0 && node.kind !== "group";

function measure(node: SceneNode) {
  if (node.rotation === 0) {
    box.width = node.width;
    box.height = node.height;
    box.offsetX = 0;
    box.offsetY = 0;
    return;
  }
  const cos = Math.cos(node.rotation * RAD);
  const sin = Math.sin(node.rotation * RAD);
  const xs = [0, node.width * cos, node.width * cos - node.height * sin, -node.height * sin];
  const ys = [0, node.width * sin, node.width * sin + node.height * cos, node.height * cos];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  box.width = Math.max(...xs) - minX;
  box.height = Math.max(...ys) - minY;
  box.offsetX = minX;
  box.offsetY = minY;
}

function assign(node: SceneNode, key: "x" | "y" | "width" | "height", value: number) {
  if (Math.abs(node[key] - value) < EPSILON) return;
  const target = edit(node.id);
  if (target) target[key] = value;
}

export function layoutFrame(frame: SceneNode) {
  const row = frame.layout === "row";
  const items: SceneNode[] = [];
  for (const id of frame.children) {
    const child = nodes.get(id);
    if (child && child.visible) items.push(child);
  }
  const mainStart = row ? frame.paddingLeft : frame.paddingTop;
  const mainEnd = row ? frame.paddingRight : frame.paddingBottom;
  const crossStart = row ? frame.paddingTop : frame.paddingLeft;
  const crossEnd = row ? frame.paddingBottom : frame.paddingRight;
  const hugMain = (row ? frame.sizeX : frame.sizeY) === "hug";
  const hugCross = (row ? frame.sizeY : frame.sizeX) === "hug";
  const fillsMain = (item: SceneNode) => !hugMain && canFill(item) && (row ? item.sizeX : item.sizeY) === "fill";
  const fillsCross = (item: SceneNode) => canFill(item) && (row ? item.sizeY : item.sizeX) === "fill";

  let fixedTotal = 0;
  let fillCount = 0;
  let maxCross = 0;
  let anyCross = false;
  for (const item of items) {
    measure(item);
    if (fillsMain(item)) fillCount++;
    else fixedTotal += row ? box.width : box.height;
    if (!fillsCross(item)) {
      maxCross = Math.max(maxCross, row ? box.height : box.width);
      anyCross = true;
    }
  }
  if (!anyCross) for (const item of items) maxCross = Math.max(maxCross, row ? item.height : item.width);

  const gaps = frame.gap * Math.max(0, items.length - 1);
  const frameMain = hugMain ? mainStart + fixedTotal + gaps + mainEnd : row ? frame.width : frame.height;
  const frameCross = hugCross ? crossStart + maxCross + crossEnd : row ? frame.height : frame.width;
  const innerMain = frameMain - mainStart - mainEnd;
  const innerCross = Math.max(0, frameCross - crossStart - crossEnd);
  const fillSize = fillCount > 0 ? Math.max(0, (innerMain - fixedTotal - gaps) / fillCount) : 0;
  const free = fillCount > 0 ? 0 : innerMain - fixedTotal - gaps;

  let cursor = mainStart;
  let spacing = frame.gap;
  if (frame.alignMain === "center") cursor += free / 2;
  else if (frame.alignMain === "end") cursor += free;
  else if (frame.alignMain === "between" && items.length > 1) spacing += free / (items.length - 1);

  for (const item of items) {
    if (fillsMain(item)) assign(item, row ? "width" : "height", fillSize);
    if (fillsCross(item)) assign(item, row ? "height" : "width", innerCross);
    measure(item);
    const mainSize = row ? box.width : box.height;
    const crossSize = row ? box.height : box.width;
    const crossOffset = frame.alignCross === "center" ? (innerCross - crossSize) / 2 : frame.alignCross === "end" ? innerCross - crossSize : 0;
    const main = cursor;
    const cross = crossStart + crossOffset;
    assign(item, "x", (row ? main : cross) - box.offsetX);
    assign(item, "y", (row ? cross : main) - box.offsetY);
    cursor += mainSize + spacing;
  }
  assign(frame, row ? "width" : "height", Math.max(0, frameMain));
  assign(frame, row ? "height" : "width", Math.max(0, frameCross));
}

export function placeInLayout(node: SceneNode, frame: SceneNode, localX: number, localY: number, moving: ReadonlySet<string>) {
  const row = frame.layout === "row";
  const along = row ? localX : localY;
  let before = "";
  for (const id of frame.children) {
    const sibling = nodes.get(id);
    if (!sibling || !sibling.visible || moving.has(id)) continue;
    measure(sibling);
    const centre = row ? sibling.x + box.offsetX + box.width / 2 : sibling.y + box.offsetY + box.height / 2;
    if (along < centre) {
      before = id;
      break;
    }
  }
  const current = frame.children.indexOf(node.id);
  let target = before ? frame.children.indexOf(before) : frame.children.length;
  if (current >= 0 && current < target) target--;
  if (current !== target) moveNode(node.id, frame.id, target);
}

export function inferLayout(frame: SceneNode): Partial<SceneNode> {
  const items = frame.children.map((id) => nodes.get(id)).filter((child): child is SceneNode => !!child && child.visible);
  if (items.length === 0) return { layout: "row", gap: 10, sizeX: "hug", sizeY: "hug" };
  const centre = (item: SceneNode, horizontal: boolean) => (horizontal ? item.x + item.width / 2 : item.y + item.height / 2);
  const spread = (horizontal: boolean) => {
    const values = items.map((item) => centre(item, horizontal));
    return Math.max(...values) - Math.min(...values);
  };
  const row = spread(true) >= spread(false);
  const sorted = items.slice().sort((a, b) => centre(a, row) - centre(b, row));
  let gapTotal = 0;
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    gapTotal += row ? sorted[i].x - previous.x - previous.width : sorted[i].y - previous.y - previous.height;
  }
  const centred = spread(!row) < 1 && items.length > 1;
  const pad = (value: number) => Math.max(0, Math.round(value));
  for (const item of sorted) moveNode(item.id, frame.id);
  return {
    layout: row ? "row" : "column",
    gap: sorted.length > 1 ? pad(gapTotal / (sorted.length - 1)) : 10,
    paddingLeft: pad(Math.min(...items.map((item) => item.x))),
    paddingTop: pad(Math.min(...items.map((item) => item.y))),
    paddingRight: pad(frame.width - Math.max(...items.map((item) => item.x + item.width))),
    paddingBottom: pad(frame.height - Math.max(...items.map((item) => item.y + item.height))),
    alignMain: "start",
    alignCross: centred ? "center" : "start",
    sizeX: "hug",
    sizeY: "hug",
  };
}
