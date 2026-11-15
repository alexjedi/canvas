import { nodes } from "../../doc/store";
import { editor } from "../../editor/state";
import type { SceneNode } from "../../doc/types";
import { useFrame, useSelectionEvery } from "../hooks";
import { AppearanceSection } from "./AppearanceSection";
import { AutoLayoutSection } from "./AutoLayoutSection";
import { ExportSection } from "./ExportSection";
import { FillSection } from "./FillSection";
import { ImageSection } from "./ImageSection";
import { LayoutSection } from "./LayoutSection";
import { PageSection } from "./PageSection";
import { PointSection } from "./PointSection";
import { PositionSection } from "./PositionSection";
import { StrokeSection } from "./StrokeSection";
import { TextSection } from "./TextSection";

const isPaintable = (node: SceneNode) => node.kind !== "group";
const isImage = (node: SceneNode) => node.kind === "image";
const isText = (node: SceneNode) => node.kind === "text";

export function DesignPanel() {
  const count = useFrame(() => editor.selection.length);
  const paintable = useSelectionEvery(isPaintable);
  const images = useSelectionEvery(isImage);
  const texts = useSelectionEvery(isText);
  const points = useFrame(() => nodes.get(editor.editing)?.kind === "vector");

  return (
    <aside className="flex w-[248px] shrink-0 flex-col overflow-y-auto rounded-2xl bg-panel pb-4 [scrollbar-color:var(--color-field-3)_transparent] [scrollbar-width:thin]">
      {count === 0 ? (
        <PageSection />
      ) : (
        <>
          {points && <PointSection />}
          <PositionSection />
          <LayoutSection />
          <AutoLayoutSection />
          <AppearanceSection />
          {texts && <TextSection />}
          {images && <ImageSection />}
          {paintable && <FillSection />}
          {paintable && <StrokeSection />}
          <ExportSection />
        </>
      )}
    </aside>
  );
}
