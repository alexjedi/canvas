import { insertNodes, loadNodes, nodes, removeNode, transact } from "./store";
import { ROOT, type NodeKind, type Paint, type SceneNode, type Stroke } from "./types";
import { commitVector, pixelPaths, STRIDE } from "./vector";

const LABELS: Record<NodeKind, string> = {
  document: "Document",
  page: "Page",
  frame: "Frame",
  group: "Group",
  rect: "Rectangle",
  ellipse: "Ellipse",
  image: "Image",
  vector: "Vector",
  text: "Text",
};

const DEFAULTS: Omit<SceneNode, "id" | "kind"> = {
  name: "",
  parent: "",
  children: [],
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotation: 0,
  visible: true,
  locked: false,
  opacity: 1,
  fill: null,
  stroke: null,
  radius: 0,
  clip: false,
  asset: "",
  fit: "cover",
  layout: "none",
  gap: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  alignMain: "start",
  alignCross: "start",
  sizeX: "fixed",
  sizeY: "fixed",
  wrap: false,
  gapCross: 0,
  absolute: false,
  paths: [],
  evenOdd: false,
  text: "",
  runs: [],
  fontFamily: "system-ui",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.2,
  letterSpacing: 0,
  textAlign: "left",
  textSizing: "width",
  version: 0,
};

export const solid = (color: string): Paint => ({ color, opacity: 1, gradient: null });

export const DEFAULT_STROKE: Stroke = { color: "#000000", opacity: 1, gradient: null, width: 1, align: "inside", cap: "butt", join: "miter" };

export const centerStroke = (): Stroke => ({ ...DEFAULT_STROKE, align: "center" });

function defaultFill(kind: NodeKind): Paint | null {
  if (kind === "frame") return solid("#ffffff");
  if (kind === "rect" || kind === "ellipse") return solid("#d9d9d9");
  return kind === "text" ? solid("#000000") : null;
}

export function createId(): string {
  const parts = crypto.getRandomValues(new Uint32Array(2));
  return parts[0].toString(36) + parts[1].toString(36);
}

export function nextName(kind: NodeKind): string {
  let count = 1;
  for (const node of nodes.values()) if (node.kind === kind) count++;
  return `${LABELS[kind]} ${count}`;
}

export const normalizeNode = (node: SceneNode): SceneNode => ({
  ...DEFAULTS,
  ...node,
  stroke: node.stroke ? { ...DEFAULT_STROKE, ...node.stroke } : null,
});

export function createNode(kind: NodeKind, props: Partial<SceneNode> = {}): SceneNode {
  return {
    ...DEFAULTS,
    id: createId(),
    kind,
    name: LABELS[kind],
    children: [],
    fill: defaultFill(kind),
    clip: kind === "frame",
    ...props,
  };
}

export function createDocument() {
  const page = createNode("page", { name: "Page 1", parent: ROOT });
  const root = createNode("document", { id: ROOT, children: [page.id] });
  loadNodes([root, page]);
}

export function addPage(): string {
  const page = createNode("page", { name: nextName("page") });
  insertNodes([page], ROOT);
  return page.id;
}

export function collectSubtree(id: string, out: SceneNode[] = []): SceneNode[] {
  const node = nodes.get(id);
  if (!node) return out;
  out.push(node);
  for (const child of node.children) collectSubtree(child, out);
  return out;
}

export function cloneNodes(list: SceneNode[]): SceneNode[] {
  const ids = new Map<string, string>();
  for (const node of list) ids.set(node.id, createId());
  return list.map((node) => ({
    ...node,
    id: ids.get(node.id)!,
    parent: ids.get(node.parent) ?? node.parent,
    children: node.children.map((child) => ids.get(child)!).filter(Boolean),
    version: 0,
  }));
}

export function discardEmpty(id: string) {
  const node = nodes.get(id);
  if (!node) return;
  if (node.kind === "text") {
    if (node.text === "") removeNode(id);
    return;
  }
  if (node.kind !== "vector") return;
  const kept = pixelPaths(node).filter((path) => path.points.length >= STRIDE * 2);
  if (kept.length === node.paths.length) return;
  if (kept.length === 0) removeNode(id);
  else transact(() => commitVector(id, kept, node.x, node.y));
}
