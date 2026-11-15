import { Blend, Minus as Weight } from "lucide-react";
import { DEFAULT_STROKE } from "../../doc/create";
import type { SceneNode, Stroke, StrokeAlign, StrokeCap, StrokeJoin } from "../../doc/types";
import { patchSelected, setSelected } from "../../editor/actions";
import { ColorField } from "../controls/ColorField";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Select } from "../controls/Select";
import { MIXED, paintOf, useSelected, useSelectionEvery } from "../hooks";
import { PaintToggle } from "./PaintToggle";

const isFreeform = (node: SceneNode) => node.kind === "vector" || node.kind === "text";

const ALIGNMENTS: Array<{ value: StrokeAlign; label: string }> = [
  { value: "inside", label: "Inside" },
  { value: "center", label: "Center" },
  { value: "outside", label: "Outside" },
];

const CAPS: Array<{ value: StrokeCap; label: string }> = [
  { value: "butt", label: "Flat ends" },
  { value: "round", label: "Round ends" },
  { value: "square", label: "Square ends" },
];

const JOINS: Array<{ value: StrokeJoin; label: string }> = [
  { value: "miter", label: "Sharp joins" },
  { value: "round", label: "Round joins" },
  { value: "bevel", label: "Bevel joins" },
];

const isVector = (node: SceneNode) => node.kind === "vector";

export function StrokeSection() {
  const value = useSelected("stroke");
  const stroke = paintOf(value);
  const present = value === MIXED || !!value;
  const freeform = useSelectionEvery(isFreeform);
  const vectors = useSelectionEvery(isVector);
  const update = (patch: Partial<Stroke>) => patchSelected("stroke", patch, DEFAULT_STROKE);

  return (
    <Section
      title="Stroke"
      onOpen={present ? undefined : () => setSelected("stroke", DEFAULT_STROKE)}
      action={<PaintToggle label="stroke" present={present} onAdd={() => setSelected("stroke", DEFAULT_STROKE)} onRemove={() => setSelected("stroke", null)} />}
    >
      {present && (
        <>
          <div className="grid grid-cols-[1fr_76px] gap-1.5">
            <ColorField value={stroke} onChange={(paint) => update(paint)} />
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
            {!freeform && <Select value={stroke?.align ?? null} options={ALIGNMENTS} onChange={(align) => update({ align })} />}
          </Row>
          {vectors && (
            <Row>
              <Select value={stroke?.cap ?? null} options={CAPS} onChange={(cap) => update({ cap })} />
              <Select value={stroke?.join ?? null} options={JOINS} onChange={(join) => update({ join })} />
            </Row>
          )}
        </>
      )}
    </Section>
  );
}
