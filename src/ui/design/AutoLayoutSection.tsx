import { ArrowDown, ArrowRight, MoveHorizontal, MoveVertical, SquareDashed, StretchHorizontal, StretchVertical } from "lucide-react";
import { useState } from "react";
import type { CrossAlign, LayoutMode, MainAlign } from "../../doc/types";
import { addAutoLayout, removeAutoLayout, setSelected, setSelectedPair } from "../../editor/actions";
import { IconButton } from "../controls/IconButton";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Segmented } from "../controls/Segmented";
import { Select } from "../controls/Select";
import { Switch } from "../controls/Switch";
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

type Side = (typeof PADDING)[number][0];

function PaddingField({ side, label, name }: { side: Side; label: string; name: string }) {
  const value = useSelected(side);
  return <NumberField label={label} name={name} min={0} value={numberOf(value)} onChange={(next) => setSelected(side, next, side)} />;
}

function PaddingPair({ first, second, label, name }: { first: Side; second: Side; label: React.ReactNode; name: string }) {
  const start = useSelected(first);
  const end = useSelected(second);
  return <NumberField label={label} name={name} min={0} value={start === end ? numberOf(start) : null} onChange={(next) => setSelectedPair(first, second, next)} />;
}

function PaddingRows() {
  const [perSide, setPerSide] = useState(false);
  return (
    <div className="flex items-start gap-1.5">
      <Row className="min-w-0 flex-1">
        {perSide ? (
          PADDING.map(([side, label, name]) => <PaddingField key={side} side={side} label={label} name={name} />)
        ) : (
          <>
            <PaddingPair first="paddingLeft" second="paddingRight" label={<MoveHorizontal size={12} />} name="Horizontal padding" />
            <PaddingPair first="paddingTop" second="paddingBottom" label={<MoveVertical size={12} />} name="Vertical padding" />
          </>
        )}
      </Row>
      <IconButton tip="Padding per side" active={perSide} onClick={() => setPerSide(!perSide)}>
        <SquareDashed size={13} />
      </IconButton>
    </div>
  );
}

export function AutoLayoutSection() {
  const layout = useSelected("layout");
  const gap = useSelected("gap");
  const alignMain = useSelected("alignMain");
  const alignCross = useSelected("alignCross");
  const wrap = useSelected("wrap");
  const gapCross = useSelected("gapCross");
  const present = layout === MIXED || (!!layout && layout !== "none");

  return (
    <Section title="Auto layout" onOpen={present ? undefined : addAutoLayout} action={<PaintToggle label="auto layout" present={present} onAdd={addAutoLayout} onRemove={removeAutoLayout} />}>
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
          <Switch label="Wrap" checked={wrap === true} onChange={(value) => setSelected("wrap", value)} />
          {wrap === true && (
            <NumberField
              label={<StretchVertical size={12} />}
              name="Line gap"
              min={0}
              value={numberOf(gapCross)}
              onChange={(value) => setSelected("gapCross", value, "gapCross")}
            />
          )}
          <PaddingRows />
        </>
      )}
    </Section>
  );
}
