import { Minus, Plus } from "lucide-react";
import { zoomBy, zoomToFit } from "../editor/actions";
import { camera } from "../editor/state";
import { cx, tabular } from "./controls/cx";
import { IconButton } from "./controls/IconButton";
import { useFrame } from "./hooks";

export function ZoomControl() {
  const percent = useFrame(() => Math.round(camera.zoom * 100));
  return (
    <div className="flex items-center">
      <IconButton tip="Zoom out (⌘−)" onClick={() => zoomBy(0.5)}>
        <Minus size={15} />
      </IconButton>
      <button
        title="Zoom to fit (⇧1)"
        onClick={() => zoomToFit()}
        className={cx(tabular, "h-8 w-12 cursor-pointer rounded-lg text-tx-2 transition-colors hover:bg-field-2 hover:text-tx")}
      >
        {percent}%
      </button>
      <IconButton tip="Zoom in (⌘+)" onClick={() => zoomBy(2)}>
        <Plus size={15} />
      </IconButton>
    </div>
  );
}
