import { Trash2 } from "lucide-react";
import { nodes } from "../../doc/store";
import { isSmooth, locatePoint, STRIDE } from "../../doc/vector";
import { deleteSelection, movePointTo, setPointsSmooth } from "../../editor/actions";
import { editor } from "../../editor/state";
import { Button } from "../controls/Button";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Segmented } from "../controls/Segmented";
import { useFrame, useNodeVersion } from "../hooks";

type PointKind = "corner" | "smooth";

const KINDS: Array<{ value: PointKind; label: string }> = [
  { value: "corner", label: "Corner" },
  { value: "smooth", label: "Smooth" },
];

export function PointSection() {
  const id = useFrame(() => editor.editing);
  const points = useFrame(() => editor.points);
  useNodeVersion(id);
  const node = nodes.get(id);
  if (!node) return null;

  let x: number | null = null;
  let y: number | null = null;
  let kind: PointKind | null = null;
  let mixed = false;
  for (const global of points) {
    const [path, index] = locatePoint(node.paths, global);
    if (path < 0) continue;
    const p = node.paths[path].points;
    const next: PointKind = isSmooth(node.paths[path], index) ? "smooth" : "corner";
    if (kind !== null && kind !== next) mixed = true;
    kind = next;
    if (points.length === 1 && node.rotation === 0) {
      x = node.x + p[index * STRIDE] * node.width;
      y = node.y + p[index * STRIDE + 1] * node.height;
    }
  }

  return (
    <Section title="Point">
      {points.length === 0 ? (
        <p className="px-1 text-tx-3">Select a point to edit it. Click a line to add one, drag a line to bend it.</p>
      ) : (
        <>
          <Row>
            <NumberField label="X" name="Point X" value={x} onChange={(value) => movePointTo(0, value)} />
            <NumberField label="Y" name="Point Y" value={y} onChange={(value) => movePointTo(1, value)} />
          </Row>
          <Segmented value={mixed ? null : kind} options={KINDS} onChange={(value) => setPointsSmooth(value === "smooth")} />
          <Button onClick={deleteSelection}>
            <Trash2 size={13} />
            {points.length > 1 ? `Delete ${points.length} points` : "Delete point"}
          </Button>
        </>
      )}
    </Section>
  );
}
