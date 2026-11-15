import { Download, Smartphone } from "lucide-react";
import { useState } from "react";
import { nodes } from "../../doc/store";
import { openInReel } from "../../editor/actions";
import { editor } from "../../editor/state";
import { exportNodes, type ExportFormat } from "../../render/export";
import { Button } from "../controls/Button";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Select } from "../controls/Select";
import { useFrame } from "../hooks";

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "svg", label: "SVG" },
];

const SCALES = ["0.5", "1", "2", "3", "4"].map((value) => ({ value, label: `${value}x` }));

export function ExportSection() {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState("1");
  const [busy, setBusy] = useState(false);
  const count = useFrame(() => editor.selection.length);
  const framed = useFrame(() => editor.selection.length === 1 && nodes.get(editor.selection[0])?.kind === "frame");

  async function run() {
    setBusy(true);
    await exportNodes(editor.selection, format, Number(scale));
    setBusy(false);
  }

  return (
    <Section title="Export">
      <Row className={format === "svg" ? "grid-cols-1" : undefined}>
        <Select value={format} options={FORMATS} onChange={setFormat} />
        {format !== "svg" && <Select value={scale} options={SCALES} onChange={setScale} />}
      </Row>
      <Button disabled={busy} onClick={run}>
        <Download size={14} />
        {count > 1 ? `Export ${count} layers` : "Export"}
      </Button>
      {framed && (
        <Button title="Copies the frame as an image and opens Reel. Paste it there with ⌘V." onClick={openInReel}>
          <Smartphone size={14} />
          Open in Reel
        </Button>
      )}
    </Section>
  );
}
