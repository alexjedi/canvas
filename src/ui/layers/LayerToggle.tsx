import type { ReactNode } from "react";
import { cx } from "../controls/cx";

export function LayerToggle({ label, pinned, onToggle, children }: { label: string; pinned: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cx(
        "size-5 shrink-0 cursor-pointer items-center justify-center rounded text-tx-3 hover:text-tx",
        pinned ? "flex" : "hidden group-hover:flex",
      )}
    >
      {children}
    </button>
  );
}
