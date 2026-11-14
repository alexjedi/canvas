import type { ComponentProps } from "react";
import { cx } from "./cx";

export function Button({ className, variant = "field", ...rest }: ComponentProps<"button"> & { variant?: "field" | "solid" | "ghost" }) {
  return (
    <button
      {...rest}
      className={cx(
        "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 transition-[background-color,color,opacity,scale] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        variant === "field" && "bg-field text-tx hover:bg-field-2",
        variant === "solid" && "bg-tx text-bg hover:opacity-90",
        variant === "ghost" && "text-tx-2 hover:bg-field-2 hover:text-tx",
        className,
      )}
    />
  );
}
