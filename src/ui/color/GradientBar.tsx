import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { Gradient, GradientStop } from "../../doc/types";
import { stopColor } from "../../render/paint";
import { cx } from "../controls/cx";
import { stopAt } from "./convert";

interface GradientBarProps {
  gradient: Gradient;
  index: number;
  onSelect: (index: number) => void;
  onChange: (gradient: Gradient) => void;
}

const byOffset = (a: GradientStop, b: GradientStop) => a.offset - b.offset;

export function GradientBar({ gradient, index, onSelect, onChange }: GradientBarProps) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const stops = gradient.stops;
  const preview = stops.map((stop) => `${stopColor(stop)} ${stop.offset * 100}%`).join(", ");

  function offsetOf(event: PointerEvent): number {
    const bounds = track.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return 0;
    return Math.round(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) * 100) / 100;
  }

  function place(stop: GradientStop, others: GradientStop[]) {
    const next = [...others, stop].sort(byOffset);
    onChange({ ...gradient, stops: next });
    onSelect(next.indexOf(stop));
  }

  function onTrackDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    if (event.target === event.currentTarget) place(stopAt(stops, offsetOf(event)), stops);
  }

  function onTrackMove(event: PointerEvent<HTMLDivElement>) {
    const current = stops[index];
    if (!dragging.current || !current) return;
    const offset = offsetOf(event);
    if (offset !== current.offset) place({ ...current, offset }, stops.filter((stop) => stop !== current));
  }

  function onStopKey(event: KeyboardEvent, at: number) {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    event.stopPropagation();
    event.preventDefault();
    if (stops.length <= 2) return;
    onChange({ ...gradient, stops: stops.filter((_, other) => other !== at) });
    onSelect(Math.max(0, at - 1));
  }

  return (
    <div
      ref={track}
      onPointerDown={onTrackDown}
      onPointerMove={onTrackMove}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      style={{ background: `linear-gradient(90deg, ${preview})` }}
      className="relative mx-1.5 h-8 min-w-0 flex-1 cursor-copy touch-none rounded-lg shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-tx)_12%,transparent)]"
    >
      {stops.map((stop, at) => (
        <button
          key={at}
          aria-label={`Stop ${Math.round(stop.offset * 100)}%`}
          title="⌫ to remove"
          onPointerDown={() => onSelect(at)}
          onKeyDown={(event) => onStopKey(event, at)}
          style={{ left: `${stop.offset * 100}%`, background: stop.color }}
          className={cx(
            "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white shadow-[0_0_0_1px_color-mix(in_oklch,black_35%,transparent)] outline-none",
            at === index && "size-4 shadow-[0_0_0_2px_var(--color-bl)]",
          )}
        />
      ))}
    </div>
  );
}
