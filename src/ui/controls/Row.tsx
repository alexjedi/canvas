import type { ReactNode } from "react";
import { cx } from "./cx";

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid grid-cols-2 gap-1.5", className)}>{children}</div>;
}
