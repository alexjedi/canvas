import type { ReactNode } from "react";
import { editor, setTool, type ToolId } from "../editor/state";
import { IconButton } from "./controls/IconButton";
import { useFrame } from "./hooks";

export function ToolButton({ tool, tip, children }: { tool: ToolId; tip: string; children: ReactNode }) {
  const active = useFrame(() => editor.tool === tool);
  return (
    <IconButton tip={tip} active={active} onClick={() => setTool(tool)}>
      {children}
    </IconButton>
  );
}
