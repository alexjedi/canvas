import { Scan } from "lucide-react";
import { setSelected } from "../../editor/actions";
import { NumberField } from "../controls/NumberField";
import { Section } from "../controls/Section";
import { Slider } from "../controls/Slider";
import type { SceneNode } from "../../doc/types";
import { numberOf, useSelected, useSelectionEvery } from "../hooks";

const hasCorners = (node: SceneNode) => node.kind === "frame" || node.kind === "rect" || node.kind === "image";

export function AppearanceSection() {
  const opacity = numberOf(useSelected("opacity"));
  const radius = useSelected("radius");
  const corners = useSelectionEvery(hasCorners);

  return (
    <Section title="Appearance">
      <Slider
        label="Opacity"
        min={0}
        max={1}
        reset={1}
        value={opacity ?? 1}
        format={(value) => (opacity === null ? "Mixed" : `${Math.round(value * 100)}%`)}
        onChange={(value) => setSelected("opacity", value, "opacity")}
      />
      {corners && (
        <NumberField
          label={<Scan size={12} />}
          name="Corner radius"
          min={0}
          value={numberOf(radius)}
          onChange={(value) => setSelected("radius", value, "radius")}
        />
      )}
    </Section>
  );
}
