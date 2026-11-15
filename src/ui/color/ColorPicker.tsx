import { Pipette } from "lucide-react";
import { useMemo } from "react";
import { RgbaColorPicker, RgbColorPicker, type RgbaColor } from "react-colorful";
import type { Paint } from "../../doc/types";
import { prefs, setPref, type Notation } from "../../editor/prefs";
import { editor, setEyedropper } from "../../editor/state";
import { hexToRgb, toHex } from "../../render/color";
import { IconButton } from "../controls/IconButton";
import { Select } from "../controls/Select";
import { useFrame } from "../hooks";
import { ColorInput } from "./ColorInput";
import { Swatches } from "./Swatches";

const NOTATIONS: Array<{ value: Notation; label: string }> = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "oklch", label: "OKLCH" },
];

const pickerClass =
  "h-auto! w-full! gap-2.5 [&_[role=slider]>div]:size-3.5 [&_[role=slider]>div]:border-2 [&>div]:rounded-full [&>div:first-child]:h-36 [&>div:first-child]:flex-none [&>div:first-child]:rounded-lg [&>div:first-child]:border-b-0 [&>div:not(:first-child)]:h-3";

export function ColorPicker({ value, alpha, onChange }: { value: Paint | null; alpha: boolean; onChange: (paint: Paint) => void }) {
  const notation = useFrame(() => prefs.notation);
  const picking = useFrame(() => editor.eyedropper !== null);
  const opacity = value?.opacity ?? 1;
  const color = useMemo<RgbaColor>(() => {
    const [r, g, b] = hexToRgb(value?.color ?? "#000000");
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: opacity };
  }, [value?.color, opacity]);

  const emit = (next: RgbaColor) => onChange({ color: toHex([next.r / 255, next.g / 255, next.b / 255]), opacity: alpha ? Math.round(next.a * 100) / 100 : 1 });

  return (
    <div className="flex flex-col gap-3">
      {alpha ? (
        <RgbaColorPicker className={pickerClass} color={color} onChange={emit} />
      ) : (
        <RgbColorPicker className={pickerClass} color={color} onChange={(next) => emit({ ...next, a: 1 })} />
      )}
      <div className="flex gap-1.5">
        <IconButton
          tip="Pick from canvas"
          active={picking}
          className="bg-field"
          onClick={() => setEyedropper(picking ? null : (picked) => onChange({ color: picked, opacity }))}
        >
          <Pipette size={14} />
        </IconButton>
        <Select value={notation} options={NOTATIONS} onChange={(next) => setPref("notation", next)} className="w-[88px]" />
      </div>
      <ColorInput value={value} notation={notation} alpha={alpha} onChange={onChange} />
      <Swatches current={value?.color ?? null} onPick={(picked) => onChange({ color: picked, opacity })} />
    </div>
  );
}
