import { RotateCw } from "lucide-react";
import { rotateAroundCenter } from "../../doc/geometry";
import { transact } from "../../doc/store";
import { setSelected } from "../../editor/actions";
import { editor } from "../../editor/state";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { AlignRow } from "./AlignRow";
import { numberOf, useSelected } from "../hooks";

function rotateSelection(rotation: number) {
  transact(() => editor.selection.forEach((id) => rotateAroundCenter(id, rotation)), `rotation:${editor.selection.join()}`);
}

export function PositionSection() {
  const x = useSelected("x");
  const y = useSelected("y");
  const rotation = useSelected("rotation");

  return (
    <Section title="Position">
      <AlignRow />
      <Row>
        <NumberField label="X" name="X" value={numberOf(x)} onChange={(value) => setSelected("x", value, "x")} />
        <NumberField label="Y" name="Y" value={numberOf(y)} onChange={(value) => setSelected("y", value, "y")} />
      </Row>
      <Row>
        <NumberField label={<RotateCw size={12} />} name="Rotation" suffix="°" value={numberOf(rotation)} onChange={rotateSelection} />
      </Row>
    </Section>
  );
}
