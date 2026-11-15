import { useState } from "react";
import { nodes } from "../doc/store";
import { renameNode } from "../editor/actions";
import { LABEL_GAP, LABEL_HEIGHT, LABEL_SIZE, labelWidth } from "../editor/labels";
import { camera, editor, setRenaming } from "../editor/state";
import { useFrame } from "./hooks";

function NameField({ id }: { id: string }) {
  const node = nodes.get(id);
  const [draft, setDraft] = useState(node?.name ?? "");
  const [cancelled, setCancelled] = useState(false);
  useFrame(() => `${camera.x},${camera.y},${camera.zoom}`);
  if (!node) return null;

  return (
    <input
      autoFocus
      aria-label="Frame name"
      value={draft}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (!cancelled) renameNode(id, draft);
        setRenaming("");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setCancelled(true);
          setRenaming("");
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        left: node.x * camera.zoom + camera.x - 2,
        top: node.y * camera.zoom + camera.y - LABEL_HEIGHT - LABEL_GAP,
        width: Math.max(48, labelWidth(draft) + 12),
        height: LABEL_HEIGHT,
        fontSize: LABEL_SIZE,
      }}
      className="absolute rounded-sm bg-panel px-0.5 text-tx outline-1 outline-bl"
    />
  );
}

export function FrameNameEditor() {
  const id = useFrame(() => editor.renaming);
  return id ? <NameField key={id} id={id} /> : null;
}
