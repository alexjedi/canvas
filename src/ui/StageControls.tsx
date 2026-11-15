import { Redo2, Undo2 } from "lucide-react";
import { canRedo, canUndo } from "../doc/store";
import { redoAction, undoAction } from "../editor/actions";
import { IconButton } from "./controls/IconButton";
import { useFrame } from "./hooks";
import { ZoomControl } from "./ZoomControl";

export function StageControls() {
  const undoable = useFrame(canUndo);
  const redoable = useFrame(canRedo);

  return (
    <div className="pointer-events-none absolute top-3 right-3 flex">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl bg-panel p-1 shadow-pop">
        <IconButton tip="Undo (⌘Z)" disabled={!undoable} onClick={undoAction}>
          <Undo2 size={15} />
        </IconButton>
        <IconButton tip="Redo (⇧⌘Z)" disabled={!redoable} onClick={redoAction}>
          <Redo2 size={15} />
        </IconButton>
        <span className="mx-1 h-4 w-px bg-field-2" />
        <ZoomControl />
      </div>
    </div>
  );
}
