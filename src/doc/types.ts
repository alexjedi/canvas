export type NodeKind = "document" | "page" | "frame" | "rect";
export type StrokeAlign = "inside" | "center" | "outside";

export interface Paint {
  color: string;
  opacity: number;
}

export interface Stroke extends Paint {
  width: number;
  align: StrokeAlign;
}

export interface SceneNode {
  id: string;
  kind: NodeKind;
  name: string;
  parent: string;
  children: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  fill: Paint | null;
  stroke: Stroke | null;
  radius: number;
  clip: boolean;
  version: number;
}

export type NodeProps = Omit<SceneNode, "id" | "kind" | "parent" | "children" | "version">;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ROOT = "root";
