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
    <div className="flex items-center justify-between">
      <IconButton tip="Align left" className="size-7" onClick={() => alignSelection("left")}>
        <AlignStartVertical size={14} />
      </IconButton>
      <IconButton tip="Align horizontal centres" className="size-7" onClick={() => alignSelection("center")}>
        <AlignCenterVertical size={14} />
      </IconButton>
      <IconButton tip="Align right" className="size-7" onClick={() => alignSelection("right")}>
        <AlignEndVertical size={14} />
      </IconButton>
      <IconButton tip="Align top" className="size-7" onClick={() => alignSelection("top")}>
        <AlignStartHorizontal size={14} />
      </IconButton>
      <IconButton tip="Align vertical centres" className="size-7" onClick={() => alignSelection("middle")}>
        <AlignCenterHorizontal size={14} />
      </IconButton>
      <IconButton tip="Align bottom" className="size-7" onClick={() => alignSelection("bottom")}>
        <AlignEndHorizontal size={14} />
      </IconButton>
      <IconButton tip="Distribute horizontally" className="size-7" disabled={!spreadable} onClick={() => distributeSelection("horizontal")}>
        <AlignHorizontalDistributeCenter size={14} />
      </IconButton>
      <IconButton tip="Distribute vertically" className="size-7" disabled={!spreadable} onClick={() => distributeSelection("vertical")}>
        <AlignVerticalDistributeCenter size={14} />
      </IconButton>
    </div>
  );
}
