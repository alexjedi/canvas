import { Circle, Frame, Hand, ImagePlus, MousePointer2, PenTool, Scaling, Square, SunMoon, Type } from "lucide-react";
import { pickImages, toggleTheme } from "../editor/actions";
import { IconButton } from "./controls/IconButton";
import { ToolButton } from "./ToolButton";

export function Toolbar() {
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
        <ToolButton tool="pen" tip="Pen (P)">
          <PenTool size={15} />
        </ToolButton>
        <ToolButton tool="text" tip="Text (T)">
          <Type size={15} />
        </ToolButton>
        <IconButton tip="Image (⇧⌘K)" onClick={pickImages}>
          <ImagePlus size={15} />
        </IconButton>
        <ToolButton tool="hand" tip="Hand (H)">
          <Hand size={15} />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-field-2" />
        <IconButton tip="Light / dark" onClick={toggleTheme}>
          <SunMoon size={15} />
        </IconButton>
      </div>
    </div>
  );
}
