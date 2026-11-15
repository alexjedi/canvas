import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cx, spring } from "./cx";

interface SegmentedProps<T extends string> {
  value: T | null;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, className }: SegmentedProps<T>) {
  const id = useId();
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => next[0] && onChange(next[0] as T)}
      className={cx("flex h-8 gap-0.5 rounded-lg bg-field p-0.5", className)}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          aria-label={option.title}
          title={option.title}
          className="relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-tx-2 transition-colors outline-none hover:text-tx data-pressed:text-tx"
        >
          {value === option.value && (
            <motion.span
              layoutId={id}
              transition={spring}
              className="absolute inset-0 rounded-md bg-bg-2 shadow-[0_1px_2px_color-mix(in_oklch,black_12%,transparent)] dark:bg-field-3 dark:shadow-none"
            />
          )}
          <span className="relative flex items-center gap-1.5">{option.label}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
