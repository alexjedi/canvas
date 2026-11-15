import { Pipette, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";
import { RgbaColorPicker, RgbColorPicker, type RgbaColor } from "react-colorful";
import type { Gradient, Paint } from "../../doc/types";
import { prefs, setPref, type Notation } from "../../editor/prefs";
import { editor, setEyedropper } from "../../editor/state";
import { hexToRgb, toHex } from "../../render/color";
import { IconButton } from "../controls/IconButton";
import { NumberField } from "../controls/NumberField";
import { Segmented } from "../controls/Segmented";
import { Select } from "../controls/Select";
import { useFrame } from "../hooks";
import { ColorInput } from "./ColorInput";
import { defaultGradient } from "./convert";
import { GradientBar } from "./GradientBar";
import { Swatches } from "./Swatches";

const NOTATIONS: Array<{ value: Notation; label: string }> = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "oklch", label: "OKLCH" },
];

type PaintType = "solid" | Gradient["type"];

const TYPES: Array<{ value: PaintType; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
];

const BLACK: Paint = { color: "#000000", opacity: 1, gradient: null };

const pickerClass =
  "h-auto! w-full! gap-2.5 [&_[role=slider]>div]:size-3.5 [&_[role=slider]>div]:border-2 [&>div]:rounded-full [&>div:first-child]:h-36 [&>div:first-child]:flex-none [&>div:first-child]:rounded-lg [&>div:first-child]:border-b-0 [&>div:not(:first-child)]:h-3";

interface ColorPickerProps {
  value: Paint | null;
  alpha: boolean;
  gradients: boolean;
  onChange: (paint: Paint) => void;
}

export function ColorPicker({ value, alpha, gradients, onChange }: ColorPickerProps) {
  const notation = useFrame(() => prefs.notation);
  const picking = useFrame(() => editor.eyedropper !== null);
  const [chosen, setChosen] = useState(0);
  const gradient = gradients ? (value?.gradient ?? null) : null;
  const index = gradient ? Math.min(chosen, gradient.stops.length - 1) : 0;
  const stop = gradient?.stops[index];
  const active: Paint | null = stop ? { color: stop.color, opacity: stop.opacity, gradient: null } : value;
  const translucent = alpha || !!gradient;
  const opacity = active?.opacity ?? 1;
  const color = useMemo<RgbaColor>(() => {
    const [r, g, b] = hexToRgb(active?.color ?? "#000000");
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: opacity };
  }, [active?.color, opacity]);

  function apply(next: Paint) {
    if (!gradient || !value) {
      onChange({ color: next.color, opacity: translucent ? next.opacity : 1, gradient: null });
      return;
    }
    const stops = gradient.stops.map((item, at) => (at === index ? { ...item, color: next.color, opacity: next.opacity } : item));
    onChange({ ...value, gradient: { ...gradient, stops } });
  }

  function setType(type: PaintType) {
    const base = value ?? BLACK;
    if (type === "solid") onChange({ ...base, gradient: null });
    else onChange({ ...base, gradient: gradient ? { ...gradient, type } : defaultGradient(type, base.color) });
  }

  const setGradient = (next: Gradient) => onChange({ ...(value ?? BLACK), gradient: next });
  const emit = (next: RgbaColor) => apply({ color: toHex([next.r / 255, next.g / 255, next.b / 255]), opacity: Math.round(next.a * 100) / 100, gradient: null });

  return (
    <div className="flex flex-col gap-3">
      {gradients && <Segmented value={gradient?.type ?? "solid"} options={TYPES} onChange={setType} />}
      {gradient && (
        <div className="flex items-center gap-1.5">
          <GradientBar gradient={gradient} index={index} onSelect={setChosen} onChange={setGradient} />
          {gradient.type === "linear" && (
            <NumberField
              label={<RotateCw size={12} />}
              name="Gradient angle"
              suffix="°"
              className="w-[72px] shrink-0"
              value={gradient.angle}
              onChange={(angle) => setGradient({ ...gradient, angle })}
            />
          )}
        </div>
      )}
      {translucent ? (
        <RgbaColorPicker className={pickerClass} color={color} onChange={emit} />
      ) : (
        <RgbColorPicker className={pickerClass} color={color} onChange={(next) => emit({ ...next, a: 1 })} />
      )}
      <div className="flex gap-1.5">
        <IconButton
          tip="Pick from canvas"
          active={picking}
          className="bg-field"
          onClick={() => setEyedropper(picking ? null : (picked) => apply({ color: picked, opacity, gradient: null }))}
        >
          <Pipette size={14} />
        </IconButton>
        <Select value={notation} options={NOTATIONS} onChange={(next) => setPref("notation", next)} className="w-[88px]" />
      </div>
      <ColorInput value={active} notation={notation} alpha={translucent} onChange={apply} />
      <Swatches current={active?.color ?? null} onPick={(picked) => apply({ color: picked, opacity, gradient: null })} />
    </div>
  );
}
