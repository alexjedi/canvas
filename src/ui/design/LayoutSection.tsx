import { nodes } from "../../doc/store";
import { setSelected } from "../../editor/actions";
import { editor } from "../../editor/state";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Switch } from "../controls/Switch";
import { MIXED, numberOf, useFrame, useSelected } from "../hooks";

export function LayoutSection() {
  const width = useSelected("width");
  const height = useSelected("height");
  const clip = useSelected("clip");
  const framesOnly = useFrame(() => editor.selection.every((id) => nodes.get(id)?.kind === "frame"));

  return (
    <Section title="Layout">
      <Row>
        <NumberField label="W" name="Width" min={1} value={numberOf(width)} onChange={(value) => setSelected("width", value, "width")} />
        <NumberField label="H" name="Height" min={1} value={numberOf(height)} onChange={(value) => setSelected("height", value, "height")} />
      </Row>
      {framesOnly && <Switch label="Clip content" checked={clip !== MIXED && !!clip} onChange={(value) => setSelected("clip", value)} />}
    </Section>
  );
}
