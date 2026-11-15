import { Plus } from "lucide-react";
import { useMemo } from "react";
import { prefs, setPref } from "../../editor/prefs";
import { cssColor, toHex } from "../../render/color";
import { useFrame } from "../hooks";

const PALETTE = [
  "--color-re",
  "--color-or",
  "--color-ye",
  "--color-gr",
  "--color-cy",
  "--color-bl",
  "--color-pu",
  "--color-ma",
  "--color-tx",
  "--color-tx-2",
  "--color-tx-3",
  "--color-ui-3",
  "--color-ui",
  "--color-bg-2",
  "--color-bg",
];

const swatchClass =
  "size-5 cursor-pointer rounded-md shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-tx)_14%,transparent)] transition-transform hover:scale-110";

export function Swatches({ current, onPick }: { current: string | null; onPick: (color: string) => void }) {
  const saved = useFrame(() => prefs.swatches);
  const palette = useMemo(() => PALETTE.map((variable) => toHex(cssColor(variable, [0, 0, 0]))), []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {palette.map((color, index) => (
          <button key={PALETTE[index]} aria-label={color} title={color} style={{ background: color }} className={swatchClass} onClick={() => onPick(color)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {saved.map((color) => (
          <button
            key={color}
            aria-label={color}
            title={`${color} · ⌥-click to remove`}
            style={{ background: color }}
            className={swatchClass}
            onClick={(event) => (event.altKey ? setPref("swatches", saved.filter((other) => other !== color)) : onPick(color))}
          />
        ))}
        <button
          aria-label="Save colour"
          title="Save colour"
          disabled={!current || saved.includes(current)}
          onClick={() => current && setPref("swatches", [...saved, current])}
          className="flex size-5 cursor-pointer items-center justify-center rounded-md bg-field text-tx-3 transition-colors hover:bg-field-2 hover:text-tx disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
