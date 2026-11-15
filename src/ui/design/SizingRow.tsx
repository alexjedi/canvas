import { isLayout } from "../../doc/layout";
import { nodes } from "../../doc/store";
import type { SceneNode, Sizing } from "../../doc/types";
import { setSelected } from "../../editor/actions";
import { Row } from "../controls/Row";
import { Select } from "../controls/Select";
import { MIXED, useSelected, useSelectionEvery } from "../hooks";

const LABELS: Record<Sizing, string> = { fixed: "Fixed", hug: "Hug", fill: "Fill" };

const inLayout = (node: SceneNode) => isLayout(nodes.get(node.parent));

export function SizingRow() {
  const sizeX = useSelected("sizeX");
  const sizeY = useSelected("sizeY");
  const canHug = useSelectionEvery(isLayout);
  const canFill = useSelectionEvery(inLayout);
  if (!canHug && !canFill) return null;

  const options = (["fixed", "hug", "fill"] as Sizing[])
    .filter((value) => value === "fixed" || (value === "hug" ? canHug : canFill))
    .map((value) => ({ value, label: LABELS[value] }));
  const shown = (value: Sizing | typeof MIXED | undefined) =>
    value === MIXED || !value ? null : options.some((option) => option.value === value) ? value : "fixed";

  return (
    <Row>
      <Select value={shown(sizeX)} options={options} onChange={(value) => setSelected("sizeX", value)} />
      <Select value={shown(sizeY)} options={options} onChange={(value) => setSelected("sizeY", value)} />
    </Row>
  );
}
