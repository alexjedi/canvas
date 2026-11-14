import { editor } from "../../editor/state";
import { useFrame } from "../hooks";
import { AppearanceSection } from "./AppearanceSection";
import { FillSection } from "./FillSection";
import { LayoutSection } from "./LayoutSection";
import { PositionSection } from "./PositionSection";
import { StrokeSection } from "./StrokeSection";

export function DesignPanel() {
  const count = useFrame(() => editor.selection.length);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col overflow-y-auto rounded-2xl bg-panel pb-4 [scrollbar-color:var(--color-field-3)_transparent] [scrollbar-width:thin]">
      {count === 0 ? (
        <p className="px-4 pt-4 text-tx-4">Select a layer to edit it</p>
      ) : (
        <>
          <PositionSection />
          <LayoutSection />
          <AppearanceSection />
          <FillSection />
          <StrokeSection />
        </>
      )}
    </aside>
  );
}
