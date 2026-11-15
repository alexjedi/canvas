import { nodes } from "../../doc/store";
import { resizeSelected, setSelected } from "../../editor/actions";
import { editor } from "../../editor/state";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Switch } from "../controls/Switch";
import { MIXED, numberOf, useFrame, useSelected } from "../hooks";
import { SizingRow } from "./SizingRow";

export function LayoutSection() {
  const width = useSelected("width");
  const height = useSelected("height");
  const clip = useSelected("clip");
  const framesOnly = useFrame(() => editor.selection.every((id) => nodes.get(id)?.kind === "frame"));

  return (
    <Section title="Layout">
      <Row>
        <NumberField label="W" name="Width" min={1} value={numberOf(width)} onChange={(value) => resizeSelected("width", value)} />
        <NumberField label="H" name="Height" min={1} value={numberOf(height)} onChange={(value) => resizeSelected("height", value)} />
      </Row>
      <SizingRow />
      {framesOnly && <Switch label="Clip content" checked={clip !== MIXED && !!clip} onChange={(value) => setSelected("clip", value)} />}
    </Section>
  );
}
