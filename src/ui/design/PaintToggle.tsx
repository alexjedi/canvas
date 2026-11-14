import { Minus, Plus } from "lucide-react";
import { IconButton } from "../controls/IconButton";

export function PaintToggle({ label, present, onAdd, onRemove }: { label: string; present: boolean; onAdd: () => void; onRemove: () => void }) {
  return (
    <IconButton tip={present ? `Remove ${label}` : `Add ${label}`} className="-mr-1 size-6" onClick={present ? onRemove : onAdd}>
      {present ? <Minus size={13} /> : <Plus size={13} />}
    </IconButton>
  );
}
