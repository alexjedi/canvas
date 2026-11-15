import { ArrowDown, ArrowRight, StretchHorizontal } from "lucide-react";
import type { CrossAlign, LayoutMode, MainAlign } from "../../doc/types";
import { addAutoLayout, removeAutoLayout, setSelected } from "../../editor/actions";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Segmented } from "../controls/Segmented";
import { Select } from "../controls/Select";
import { MIXED, numberOf, useSelected } from "../hooks";
import { PaintToggle } from "./PaintToggle";

const DIRECTIONS: Array<{ value: LayoutMode; label: React.ReactNode; title: string }> = [
  { value: "row", label: <ArrowRight size={13} />, title: "Horizontal" },
  { value: "column", label: <ArrowDown size={13} />, title: "Vertical" },
];

const MAIN: Array<{ value: MainAlign; label: string }> = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "between", label: "Space between" },
];

const CROSS: Array<{ value: CrossAlign; label: string }> = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
];

const PADDING = [
  ["paddingLeft", "L", "Padding left"],
  ["paddingRight", "R", "Padding right"],
  ["paddingTop", "T", "Padding top"],
  ["paddingBottom", "B", "Padding bottom"],
] as const;

function PaddingField({ side, label, name }: { side: (typeof PADDING)[number][0]; label: string; name: string }) {
  const value = useSelected(side);
  return <NumberField label={label} name={name} min={0} value={numberOf(value)} onChange={(next) => setSelected(side, next, side)} />;
}

export function AutoLayoutSection() {
  const layout = useSelected("layout");
  const gap = useSelected("gap");
  const alignMain = useSelected("alignMain");
  const alignCross = useSelected("alignCross");
  const present = layout === MIXED || (!!layout && layout !== "none");

  return (
    <Section title="Auto layout" action={<PaintToggle label="auto layout" present={present} onAdd={addAutoLayout} onRemove={removeAutoLayout} />}>
      {present && (
        <>
          <Row>
            <Segmented value={layout === MIXED || !layout ? null : layout} options={DIRECTIONS} onChange={(value) => setSelected("layout", value)} />
            <NumberField label={<StretchHorizontal size={12} />} name="Gap" min={0} value={numberOf(gap)} onChange={(value) => setSelected("gap", value, "gap")} />
          </Row>
          <Row>
            <Select value={alignMain === MIXED || !alignMain ? null : alignMain} options={MAIN} onChange={(value) => setSelected("alignMain", value)} />
            <Select value={alignCross === MIXED || !alignCross ? null : alignCross} options={CROSS} onChange={(value) => setSelected("alignCross", value)} />
          </Row>
          <Row>
            {PADDING.map(([side, label, name]) => (
              <PaddingField key={side} side={side} label={label} name={name} />
            ))}
          </Row>
        </>
      )}
    </Section>
  );
}
