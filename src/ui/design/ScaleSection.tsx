import { Scaling } from "lucide-react";
import { useState } from "react";
import { unionBounds } from "../../doc/geometry";
import { scaleSelection } from "../../editor/actions";
import { editor } from "../../editor/state";
import { Button } from "../controls/Button";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { useFrame } from "../hooks";

const FACTORS = [0.5, 2, 3, 4];

export function ScaleSection() {
  const size = useFrame(() => {
    const bounds = unionBounds(editor.selection);
    return bounds ? `${Math.round(bounds.width * 100) / 100}:${Math.round(bounds.height * 100) / 100}` : "";
  });
  const [factor, setFactor] = useState(2);
  if (!size) return null;
  const [width, height] = size.split(":").map(Number);

  return (
    <Section title="Scale">
      <Row>
        <NumberField label={<Scaling size={12} />} name="Scale factor" suffix="×" min={0.01} step={0.1} value={factor} onChange={setFactor} />
        <Button onClick={() => scaleSelection(factor)}>Apply</Button>
      </Row>
      <div className="grid grid-cols-4 gap-1.5">
        {FACTORS.map((factor) => (
          <Button key={factor} className="px-0" onClick={() => scaleSelection(factor)}>
            {factor}×
          </Button>
        ))}
      </div>
      <Row>
        <NumberField label="W" name="Scaled width" min={0.01} value={width} onChange={(value) => width > 0 && scaleSelection(value / width)} />
        <NumberField label="H" name="Scaled height" min={0.01} value={height} onChange={(value) => height > 0 && scaleSelection(value / height)} />
      </Row>
    </Section>
  );
}
