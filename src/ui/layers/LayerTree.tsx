import { nodes } from "../../doc/store";
import { clearDrop, editor, select } from "../../editor/state";
import { Section } from "../controls/Section";
import { EditorMenu } from "../EditorMenu";
import { useFrame, useNodeVersion } from "../hooks";
import { LayerRow } from "./LayerRow";

export function LayerTree() {
  const page = useFrame(() => editor.page);
  useNodeVersion(page);
  const children = nodes.get(page)?.children ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" onClick={() => select([])} onDragEnd={clearDrop}>
      <Section title="Layers" />
      <EditorMenu className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 [scrollbar-color:var(--color-field-3)_transparent] [scrollbar-width:thin]">
        {children.length === 0 && <p className="px-1 py-1 text-tx-4">Press F to draw a frame</p>}
        {children
          .slice()
          .reverse()
          .map((id) => (
            <LayerRow key={id} id={id} depth={0} />
          ))}
      </EditorMenu>
    </div>
  );
}
