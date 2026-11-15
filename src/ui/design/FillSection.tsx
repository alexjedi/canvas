import { Blend } from "lucide-react";
import type { Paint, SceneNode } from "../../doc/types";
import { patchSelected, setSelected, styleText } from "../../editor/actions";
import { ColorField } from "../controls/ColorField";
import { NumberField } from "../controls/NumberField";
import { Section } from "../controls/Section";
import { MIXED, paintOf, useSelected, useSelectionEvery, useTextStyle } from "../hooks";
import { PaintToggle } from "./PaintToggle";

const DEFAULT_FILL: Paint = { color: "#d9d9d9", opacity: 1, gradient: null };

const isText = (node: SceneNode) => node.kind === "text";

export function FillSection() {
  const texts = useSelectionEvery(isText);
  const shared = useSelected("fill");
  const ranged = useTextStyle("fill");
  const value = texts ? ranged : shared;
  const fill = paintOf(value);
  const present = value === MIXED || !!value;
  const add = () => (texts ? styleText({ fill: DEFAULT_FILL }) : setSelected("fill", DEFAULT_FILL));
  const remove = () => (texts ? styleText({ fill: null }) : setSelected("fill", null));
  const patch = (change: Partial<Paint>) =>
    texts ? styleText((style) => ({ fill: { ...(style.fill ?? DEFAULT_FILL), ...change } }), "fill") : patchSelected("fill", change, DEFAULT_FILL);

  return (
    <Section
      title="Fill"
      onOpen={present ? undefined : add}
      action={<PaintToggle label="fill" present={present} onAdd={add} onRemove={remove} />}
    >
      {present && (
        <div className="grid grid-cols-[1fr_76px] gap-1.5">
          <ColorField value={fill} onChange={patch} />
          <NumberField
            label={<Blend size={12} />}
            name="Fill opacity"
            suffix="%"
            min={0}
            max={100}
            value={fill ? fill.opacity * 100 : null}
            onChange={(opacity) => patch({ opacity: opacity / 100 })}
          />
        </div>
      )}
    </Section>
  );
}
