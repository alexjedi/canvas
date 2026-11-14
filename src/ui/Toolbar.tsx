import { Circle, Frame, Hand, ImagePlus, MousePointer2, Redo2, Scaling, Square, SunMoon, Undo2 } from "lucide-react";
import { canRedo, canUndo } from "../doc/store";
import { pickImages, redoAction, toggleTheme, undoAction } from "../editor/actions";
import { IconButton } from "./controls/IconButton";
import { useFrame } from "./hooks";
import { ToolButton } from "./ToolButton";
import { ZoomControl } from "./ZoomControl";

export function Toolbar() {
  const undoable = useFrame(canUndo);
  const redoable = useFrame(canRedo);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl bg-panel p-1 shadow-pop">
        <ToolButton tool="move" tip="Move (V)">
          <MousePointer2 size={15} />
        </ToolButton>
        <ToolButton tool="scale" tip="Scale (K)">
          <Scaling size={15} />
        </ToolButton>
        <ToolButton tool="frame" tip="Frame (F)">
          <Frame size={15} />
        </ToolButton>
        <ToolButton tool="rect" tip="Rectangle (R)">
          <Square size={15} />
        </ToolButton>
        <ToolButton tool="ellipse" tip="Ellipse (O)">
          <Circle size={15} />
        </ToolButton>
        <IconButton tip="Image (⇧⌘K)" onClick={pickImages}>
          <ImagePlus size={15} />
        </IconButton>
        <ToolButton tool="hand" tip="Hand (H)">
          <Hand size={15} />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-field-2" />
        <IconButton tip="Undo (⌘Z)" disabled={!undoable} onClick={undoAction}>
          <Undo2 size={15} />
        </IconButton>
        <IconButton tip="Redo (⇧⌘Z)" disabled={!redoable} onClick={redoAction}>
          <Redo2 size={15} />
        </IconButton>
        <span className="mx-1 h-4 w-px bg-field-2" />
        <ZoomControl />
        <IconButton tip="Light / dark" onClick={toggleTheme}>
          <SunMoon size={15} />
        </IconButton>
      </div>
    </div>
  );
}
