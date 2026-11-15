import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { alignSelection, distributeSelection } from "../../editor/actions";
import { editor } from "../../editor/state";
import { IconButton } from "../controls/IconButton";
import { useFrame } from "../hooks";

export function AlignRow() {
  const spreadable = useFrame(() => editor.selection.length > 2);

  return (
    <div className="grid grid-cols-4 gap-1">
      <IconButton tip="Align left" className="h-7 w-full" onClick={() => alignSelection("left")}>
        <AlignStartVertical size={12} />
      </IconButton>
      <IconButton tip="Align horizontal centres" className="h-7 w-full" onClick={() => alignSelection("center")}>
        <AlignCenterVertical size={12} />
      </IconButton>
      <IconButton tip="Align right" className="h-7 w-full" onClick={() => alignSelection("right")}>
        <AlignEndVertical size={12} />
      </IconButton>
      <IconButton tip="Distribute horizontally" className="h-7 w-full" disabled={!spreadable} onClick={() => distributeSelection("horizontal")}>
        <AlignHorizontalDistributeCenter size={12} />
      </IconButton>
      <IconButton tip="Align top" className="h-7 w-full" onClick={() => alignSelection("top")}>
        <AlignStartHorizontal size={12} />
      </IconButton>
      <IconButton tip="Align vertical centres" className="h-7 w-full" onClick={() => alignSelection("middle")}>
        <AlignCenterHorizontal size={12} />
      </IconButton>
      <IconButton tip="Align bottom" className="h-7 w-full" onClick={() => alignSelection("bottom")}>
        <AlignEndHorizontal size={12} />
      </IconButton>
      <IconButton tip="Distribute vertically" className="h-7 w-full" disabled={!spreadable} onClick={() => distributeSelection("vertical")}>
        <AlignVerticalDistributeCenter size={12} />
      </IconButton>
    </div>
  );
}
