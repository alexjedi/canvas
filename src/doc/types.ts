export type NodeKind = "document" | "page" | "frame" | "group" | "rect" | "ellipse" | "image";
export type LayoutMode = "none" | "row" | "column";
export type Sizing = "fixed" | "hug" | "fill";
export type MainAlign = "start" | "center" | "end" | "between";
export type CrossAlign = "start" | "center" | "end";
export type ImageFit = "cover" | "contain" | "stretch" | "tile";
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
  asset: string;
  fit: ImageFit;
  layout: LayoutMode;
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignMain: MainAlign;
  alignCross: CrossAlign;
  sizeX: Sizing;
  sizeY: Sizing;
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
