import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ReactNode } from "react";
import { cx } from "./cx";

interface SegmentedProps<T extends string> {
  value: T | null;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, className }: SegmentedProps<T>) {
  const index = options.findIndex((option) => option.value === value);
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => next[0] && onChange(next[0] as T)}
      className={cx("relative flex h-8 rounded-lg bg-field p-0.5", className)}
    >
      {index >= 0 && (
        <span
          style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
          className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md bg-bg-2 shadow-[0_1px_2px_color-mix(in_oklch,black_12%,transparent)] transition-transform duration-200 ease-out dark:bg-field-3 dark:shadow-none"
        />
      )}
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          aria-label={option.title}
          title={option.title}
          className="relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-tx-2 transition-colors outline-none hover:text-tx data-pressed:text-tx"
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
