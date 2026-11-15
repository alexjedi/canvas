export type NodeKind = "document" | "page" | "frame" | "group" | "rect" | "ellipse" | "image" | "vector" | "text";
export type LayoutMode = "none" | "row" | "column";
export type Sizing = "fixed" | "hug" | "fill";
export type MainAlign = "start" | "center" | "end" | "between";
export type CrossAlign = "start" | "center" | "end";
export type ImageFit = "cover" | "contain" | "stretch" | "tile";
export type StrokeAlign = "inside" | "center" | "outside";
export type StrokeCap = "butt" | "round" | "square";
export type StrokeJoin = "miter" | "round" | "bevel";

export type TextAlign = "left" | "center" | "right";
export type TextSizing = "width" | "height" | "fixed";
export type GradientType = "linear" | "radial";

export interface GradientStop {
  offset: number;
  color: string;
  opacity: number;
}

export interface Gradient {
  type: GradientType;
  angle: number;
  stops: GradientStop[];
}

export interface Paint {
  color: string;
  opacity: number;
  gradient: Gradient | null;
}

export interface VectorPath {
  closed: boolean;
  points: number[];
}

export interface Stroke extends Paint {
  width: number;
  align: StrokeAlign;
  cap: StrokeCap;
  join: StrokeJoin;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  fill: Paint | null;
}

export interface TextRun extends TextStyle {
  length: number;
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
  wrap: boolean;
  gapCross: number;
  absolute: boolean;
  paths: VectorPath[];
  evenOdd: boolean;
  text: string;
  runs: TextRun[];
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: TextAlign;
  textSizing: TextSizing;
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
