import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import type { DragEvent, MouseEvent } from "react";
import { isDescendant } from "../../doc/geometry";
import { nodes } from "../../doc/store";
import { dropLayers, renameNode, toggleFlag } from "../../editor/actions";
import { clearDrop, editor, select, setDrop, setHover, toggleExpanded, type DropPosition } from "../../editor/state";
import { cx } from "../controls/cx";
import { useFrame, useNodeVersion } from "../hooks";
import { InlineName } from "./InlineName";
import { LayerIcon } from "./LayerIcon";
import { LayerToggle } from "./LayerToggle";

const INDENT = 14;

export const ROW_HEIGHT = 28;

export function LayerRow({ id, depth }: { id: string; depth: number }) {
  useNodeVersion(id);
  const selected = useFrame(() => editor.selected.has(id));
  const hovered = useFrame(() => editor.hover === id);
  const expanded = useFrame(() => editor.expanded.has(id));
  const drop = useFrame(() => (editor.drop?.id === id ? editor.drop.position : ""));
  const node = nodes.get(id);

  if (!node) return null;
  const isFrame = node.kind === "frame" || node.kind === "group";
  const hasChildren = node.children.length > 0;

  function onClick(event: MouseEvent) {
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      select(selected ? editor.selection.filter((other) => other !== id) : [...editor.selection, id]);
    } else {
      select([id]);
    }
  }

  function onDragStart(event: DragEvent) {
    event.stopPropagation();
    if (!editor.selected.has(id)) select([id]);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function onDragOver(event: DragEvent) {
    event.stopPropagation();
    if (editor.selection.some((dragged) => dragged === id || isDescendant(id, dragged))) {
      clearDrop();
      return;
    }
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - bounds.top) / bounds.height;
    const position: DropPosition = isFrame && ratio > 0.25 && ratio < 0.75 ? "inside" : ratio < 0.5 ? "above" : "below";
    setDrop(id, position);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (editor.drop?.id === id) dropLayers(id, editor.drop.position);
    clearDrop();
  }

  return (
    <div
      draggable
      onClick={onClick}
      onContextMenu={() => !editor.selected.has(id) && select([id])}
      onPointerEnter={() => setHover(id)}
      onPointerLeave={() => setHover("")}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ paddingLeft: depth * INDENT + 4 }}
      className={cx(
        "group relative flex h-7 shrink-0 cursor-default items-center gap-1 rounded-md pr-1 transition-colors",
        selected ? "bg-field-3 text-tx" : hovered ? "bg-field text-tx" : "text-tx-2",
        drop === "inside" && "ring-[1.5px] ring-bl ring-inset",
        !node.visible && "opacity-50",
      )}
    >
      {drop === "above" && <span className="pointer-events-none absolute inset-x-1 top-0 h-0.5 rounded-full bg-bl" />}
      {drop === "below" && <span className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-bl" />}
      <button
        aria-label={expanded ? "Collapse" : "Expand"}
        onClick={(event) => {
          event.stopPropagation();
          toggleExpanded(id);
        }}
        className={cx("flex size-4 shrink-0 items-center justify-center text-tx-3 hover:text-tx", !hasChildren && "invisible")}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      <span className="shrink-0 text-tx-3">
        <LayerIcon kind={node.kind} />
      </span>
      <InlineName name={node.name} onRename={(name) => renameNode(id, name)} />
      <LayerToggle label={node.locked ? "Unlock" : "Lock"} pinned={node.locked} onToggle={() => toggleFlag(id, "locked")}>
        {node.locked ? <Lock size={12} /> : <LockOpen size={12} />}
      </LayerToggle>
      <LayerToggle label={node.visible ? "Hide" : "Show"} pinned={!node.visible} onToggle={() => toggleFlag(id, "visible")}>
        {node.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </LayerToggle>
    </div>
  );
}
