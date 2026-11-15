import { nodes } from "../../doc/store";
import type { Paint } from "../../doc/types";
import { setPageProps } from "../../editor/actions";
import { prefs, setPref } from "../../editor/prefs";
import { editor } from "../../editor/state";
import { ColorField } from "../controls/ColorField";
import { Section } from "../controls/Section";
import { Switch } from "../controls/Switch";
import { useFrame } from "../hooks";
import { PaintToggle } from "./PaintToggle";

const DEFAULT_BACKGROUND: Paint = { color: "#f5f5f5", opacity: 1 };

export function PageSection() {
  const fill = useFrame(() => nodes.get(editor.page)?.fill ?? null);
  const pixelGrid = useFrame(() => prefs.pixelGrid);
  const snapObjects = useFrame(() => prefs.snapObjects);

  return (
    <>
      <Section
        title="Page background"
        action={
          <PaintToggle
            label="background"
            present={!!fill}
            onAdd={() => setPageProps({ fill: DEFAULT_BACKGROUND })}
            onRemove={() => setPageProps({ fill: null })}
          />
        }
      >
        {fill && <ColorField value={fill} alpha={false} onChange={(paint) => setPageProps({ fill: paint }, "page-background")} />}
      </Section>
      <Section title="Snapping">
        <Switch label="Snap to pixel grid" checked={pixelGrid} onChange={(value) => setPref("pixelGrid", value)} />
        <Switch label="Snap to objects" checked={snapObjects} onChange={(value) => setPref("snapObjects", value)} />
      </Section>
    </>
  );
}
