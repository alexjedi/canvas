import { insertNodes, loadNodes, nodes } from "./store";
import { ROOT, type NodeKind, type SceneNode } from "./types";

const LABELS: Record<NodeKind, string> = {
  document: "Document",
  page: "Page",
  frame: "Frame",
  group: "Group",
  rect: "Rectangle",
  ellipse: "Ellipse",
  image: "Image",
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
  version: 0,
};

export function createId(): string {
  const parts = crypto.getRandomValues(new Uint32Array(2));
  return parts[0].toString(36) + parts[1].toString(36);
}

export function nextName(kind: NodeKind): string {
  let count = 1;
  for (const node of nodes.values()) if (node.kind === kind) count++;
  return `${LABELS[kind]} ${count}`;
}

export const normalizeNode = (node: SceneNode): SceneNode => ({ ...DEFAULTS, ...node });

export function createNode(kind: NodeKind, props: Partial<SceneNode> = {}): SceneNode {
  return {
    ...DEFAULTS,
    id: createId(),
    kind,
    name: LABELS[kind],
    children: [],
    fill: kind === "frame" ? { color: "#ffffff", opacity: 1 } : kind === "rect" || kind === "ellipse" ? { color: "#d9d9d9", opacity: 1 } : null,
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
