import { Blend } from "lucide-react";
import type { Paint } from "../../doc/types";
import { patchSelected, setSelected } from "../../editor/actions";
import { ColorField } from "../controls/ColorField";
import { NumberField } from "../controls/NumberField";
import { Section } from "../controls/Section";
import { MIXED, paintOf, useSelected } from "../hooks";
import { PaintToggle } from "./PaintToggle";

const DEFAULT_FILL: Paint = { color: "#d9d9d9", opacity: 1 };

export function FillSection() {
  const value = useSelected("fill");
  const fill = paintOf(value);
  const present = value === MIXED || !!value;

  return (
    <Section
      title="Fill"
      action={<PaintToggle label="fill" present={present} onAdd={() => setSelected("fill", DEFAULT_FILL)} onRemove={() => setSelected("fill", null)} />}
    >
      {present && (
        <div className="grid grid-cols-[1fr_76px] gap-1.5">
          <ColorField value={fill?.color ?? null} onChange={(color) => patchSelected("fill", { color }, DEFAULT_FILL)} />
          <NumberField
            label={<Blend size={12} />}
            name="Fill opacity"
            suffix="%"
            min={0}
            max={100}
            value={fill ? fill.opacity * 100 : null}
            onChange={(opacity) => patchSelected("fill", { opacity: opacity / 100 }, DEFAULT_FILL)}
          />
        </div>
      )}
    </Section>
  );
}
