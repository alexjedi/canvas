import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cx, tabular } from "./cx";

interface NumberFieldProps {
  label: ReactNode;
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}

const format = (value: number) => String(Math.round(value * 100) / 100);

export function NumberField({ label, name, value, onChange, min = -Infinity, max = Infinity, step = 1, suffix = "", className }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const scrub = useRef<{ x: number; value: number } | null>(null);
  const cancelled = useRef(false);
  const shown = value === null ? "Mixed" : format(value) + suffix;
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  function commit() {
    const parsed = parseFloat((draft ?? "").replace(",", "."));
    if (!cancelled.current && Number.isFinite(parsed) && clamp(parsed) !== value) onChange(clamp(parsed));
    cancelled.current = false;
    setDraft(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    else if (event.key === "Escape") {
      cancelled.current = true;
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const parsed = parseFloat((draft ?? "").replace(",", "."));
      const base = Number.isFinite(parsed) ? parsed : (value ?? 0);
      const next = clamp(base + (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1));
      onChange(next);
      setDraft(format(next));
    }
  }

  function onScrubStart(event: PointerEvent<HTMLSpanElement>) {
    if (value === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { x: event.clientX, value };
  }

  function onScrubMove(event: PointerEvent<HTMLSpanElement>) {
    if (!scrub.current) return;
    const next = clamp(Math.round((scrub.current.value + (event.clientX - scrub.current.x) * step) / step) * step);
    if (next !== value) onChange(next);
  }

  return (
    <div className={cx("flex h-8 min-w-0 items-center rounded-lg bg-field transition-colors focus-within:bg-field-2 hover:bg-field-2", className)}>
      <span
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={() => (scrub.current = null)}
        onPointerCancel={() => (scrub.current = null)}
        className="flex h-full w-7 shrink-0 cursor-ew-resize touch-none items-center justify-center text-tx-3"
      >
        {label}
      </span>
      <input
        aria-label={name}
        value={draft ?? shown}
        onFocus={(event) => {
          setDraft(value === null ? "" : format(value));
          const input = event.currentTarget;
          requestAnimationFrame(() => input.select());
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cx(tabular, "min-w-0 flex-1 bg-transparent pr-2 text-tx outline-none")}
      />
    </div>
  );
}
