import { cx, tabular } from "./cx";

export function ColorField({ value, onChange, className }: { value: string | null; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={cx("flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-field px-1.5 transition-colors hover:bg-field-2", className)}>
      <input
        type="color"
        aria-label="Colour"
        value={value ?? "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="size-5 shrink-0 cursor-pointer appearance-none rounded-md border-0 bg-transparent p-0 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-tx)_12%,transparent)] [&::-moz-color-swatch]:rounded-[inherit] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[inherit] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <span className={cx(tabular, "flex-1 truncate text-tx-2 uppercase")}>{value ? value.replace("#", "") : "Mixed"}</span>
    </label>
  );
}
