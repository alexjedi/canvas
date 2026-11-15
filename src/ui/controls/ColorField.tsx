import { Popover } from "@base-ui/react/popover";
import type { Paint } from "../../doc/types";
import { ColorPicker } from "../color/ColorPicker";
import { cssGradient } from "../color/convert";
import { cx, popupClass, tabular } from "./cx";

interface ColorFieldProps {
  value: Paint | null;
  onChange: (paint: Paint) => void;
  alpha?: boolean;
  gradients?: boolean;
  className?: string;
}

const LABELS = { linear: "Linear", radial: "Radial" };

export function ColorField({ value, onChange, alpha = true, gradients = true, className }: ColorFieldProps) {
  const gradient = value?.gradient ?? null;
  const label = gradient ? LABELS[gradient.type] : value ? value.color.replace("#", "") : "Mixed";

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Colour"
        className={cx(
          "flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-field px-1.5 text-left transition-colors outline-none hover:bg-field-2 data-popup-open:bg-field-2",
          className,
        )}
      >
        <span
          style={{ background: gradient ? cssGradient(gradient) : value?.color, opacity: value ? Math.max(0.15, value.opacity) : 1 }}
          className="size-5 shrink-0 rounded-md shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-tx)_12%,transparent)]"
        />
        <span className={cx(tabular, "flex-1 truncate text-tx-2 uppercase")}>{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="left" align="start" sideOffset={20} className="z-50 outline-none">
          <Popover.Popup className={popupClass("w-60 p-3")}>
            <ColorPicker value={value} alpha={alpha} gradients={gradients} onChange={onChange} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
