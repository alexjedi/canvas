import { Blend, Minus as Weight } from "lucide-react";
import type { Stroke, StrokeAlign } from "../../doc/types";
import { patchSelected, setSelected } from "../../editor/actions";
import { ColorField } from "../controls/ColorField";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Select } from "../controls/Select";
import { MIXED, paintOf, useSelected } from "../hooks";
import { PaintToggle } from "./PaintToggle";

const DEFAULT_STROKE: Stroke = { color: "#000000", opacity: 1, width: 1, align: "inside" };

const ALIGNMENTS: Array<{ value: StrokeAlign; label: string }> = [
  { value: "inside", label: "Inside" },
  { value: "center", label: "Center" },
  { value: "outside", label: "Outside" },
];

export function StrokeSection() {
  const value = useSelected("stroke");
  const stroke = paintOf(value);
  const present = value === MIXED || !!value;
  const update = (patch: Partial<Stroke>) => patchSelected("stroke", patch, DEFAULT_STROKE);

  return (
    <Section
      title="Stroke"
      action={<PaintToggle label="stroke" present={present} onAdd={() => setSelected("stroke", DEFAULT_STROKE)} onRemove={() => setSelected("stroke", null)} />}
    >
      {present && (
        <>
          <div className="grid grid-cols-[1fr_76px] gap-1.5">
            <ColorField value={stroke?.color ?? null} onChange={(color) => update({ color })} />
            <NumberField
              label={<Blend size={12} />}
              name="Stroke opacity"
              suffix="%"
              min={0}
              max={100}
              value={stroke ? stroke.opacity * 100 : null}
              onChange={(opacity) => update({ opacity: opacity / 100 })}
            />
          </div>
          <Row>
            <NumberField label={<Weight size={12} />} name="Stroke width" min={0} value={stroke?.width ?? null} onChange={(width) => update({ width })} />
            <Select value={stroke?.align ?? null} options={ALIGNMENTS} onChange={(align) => update({ align })} />
          </Row>
        </>
      )}
    </Section>
  );
}
