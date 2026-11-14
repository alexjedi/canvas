import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cx, tabular } from "./cx";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  reset?: number;
  format?: (value: number) => string;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, reset, format }: SliderProps) {
  const percent = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  const text = format ? format(value) : String(Math.round(value * 100) / 100);

  return (
    <BaseSlider.Root value={value} min={min} max={max} step={step} onValueChange={(next) => onChange(next as number)} className="w-full">
      <BaseSlider.Control
        className="group relative flex h-8 w-full cursor-ew-resize touch-none overflow-hidden rounded-lg bg-field transition-colors select-none hover:bg-field-2"
        onDoubleClick={() => reset !== undefined && onChange(reset)}
      >
        <BaseSlider.Track className="h-full w-full">
          <div className="absolute inset-y-0 left-0 bg-field-2 transition-colors group-hover:bg-field-3" style={{ width: `${percent}%` }} />
          <BaseSlider.Thumb
            aria-label={label}
            className="h-3.5 w-0.5 rounded-full bg-tx-2 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100 has-[:focus-visible]:opacity-100"
          />
        </BaseSlider.Track>
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-tx-2">{label}</span>
        <span className={cx(tabular, "pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-tx-2")}>{text}</span>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
