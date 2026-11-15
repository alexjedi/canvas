import { useEffect, useRef, useState } from "react";
import { nodes } from "../doc/store";
import { fitIfNeeded } from "../editor/actions";
import { editor } from "../editor/state";
import { setDraw } from "../frame";
import { createRenderer } from "../render/renderer";
import { setSampler } from "../render/sample";
import { attachInput } from "../tools/input";
import { EditorMenu } from "./EditorMenu";
import { useFrame } from "./hooks";

export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  const background = useFrame(() => nodes.get(editor.page)?.fill?.color ?? "");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas);
    if (!renderer) {
      setUnsupported(true);
      return;
    }
    const detach = attachInput(canvas);
    setSampler(renderer.sample);
    setDraw(() => {
      fitIfNeeded();
      renderer.draw();
    });
    return () => {
      setDraw(null);
      setSampler(null);
      detach();
      renderer.destroy();
    };
  }, []);

  return (
    <EditorMenu className="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
      <canvas ref={ref} style={{ background: background || undefined }} className="absolute inset-0 size-full touch-none outline-none" />
      {unsupported && <p className="absolute inset-0 flex items-center justify-center text-tx-3">This browser does not support WebGL2.</p>}
    </EditorMenu>
  );
}
