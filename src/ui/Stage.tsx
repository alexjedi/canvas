import { useEffect, useRef, useState } from "react";
import { fitIfNeeded } from "../editor/actions";
import { setDraw } from "../frame";
import { createRenderer } from "../render/renderer";
import { attachInput } from "../tools/input";

export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas);
    if (!renderer) {
      setUnsupported(true);
      return;
    }
    const detach = attachInput(canvas);
    setDraw(() => {
      fitIfNeeded();
      renderer.draw();
    });
    return () => {
      setDraw(null);
      detach();
      renderer.destroy();
    };
  }, []);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
      <canvas ref={ref} className="absolute inset-0 size-full touch-none outline-none" />
      {unsupported && <p className="absolute inset-0 flex items-center justify-center text-tx-3">This browser does not support WebGL2.</p>}
    </div>
  );
}
