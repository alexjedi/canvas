import { Circle, Frame, Group, Image, Spline, Square, Type } from "lucide-react";
import type { NodeKind } from "../../doc/types";

export function LayerIcon({ kind }: { kind: NodeKind }) {
  if (kind === "frame") return <Frame size={12} />;
  if (kind === "group") return <Group size={12} />;
  if (kind === "ellipse") return <Circle size={12} />;
  if (kind === "image") return <Image size={12} />;
  if (kind === "vector") return <Spline size={12} />;
  if (kind === "text") return <Type size={12} />;
  return <Square size={12} />;
}
