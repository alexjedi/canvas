import { RotateCw } from "lucide-react";
import { rotateAroundCenter } from "../../doc/geometry";
import { isLayout } from "../../doc/layout";
import { nodes, transact } from "../../doc/store";
import type { SceneNode } from "../../doc/types";
import { setSelected } from "../../editor/actions";
import { editor } from "../../editor/state";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { AlignRow } from "./AlignRow";
import { GridRow } from "./GridRow";
import { Switch } from "../controls/Switch";
import { numberOf, useSelected, useSelectionEvery } from "../hooks";

const inLayout = (node: SceneNode) => isLayout(nodes.get(node.parent));

function rotateSelection(rotation: number) {
  transact(() => editor.selection.forEach((id) => rotateAroundCenter(id, rotation)), `rotation:${editor.selection.join()}`);
}

export function PositionSection() {
  const x = useSelected("x");
  const y = useSelected("y");
  const rotation = useSelected("rotation");
  const absolute = useSelected("absolute");
  const nested = useSelectionEvery(inLayout);

  return (
    <Section title="Position">
      <AlignRow />
      <GridRow />
      <Row>
        <NumberField label="X" name="X" value={numberOf(x)} onChange={(value) => setSelected("x", value, "x")} />
        <NumberField label="Y" name="Y" value={numberOf(y)} onChange={(value) => setSelected("y", value, "y")} />
      </Row>
      <Row>
        <NumberField label={<RotateCw size={12} />} name="Rotation" suffix="°" value={numberOf(rotation)} onChange={rotateSelection} />
      </Row>
      {nested && <Switch label="Ignore auto layout" checked={absolute === true} onChange={(value) => setSelected("absolute", value)} />}
    </Section>
  );
}
