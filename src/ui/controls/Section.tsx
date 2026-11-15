import type { ReactNode } from "react";
import { cx } from "./cx";

export function Section({ title, action, onOpen, children }: { title: string; action?: ReactNode; onOpen?: () => void; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-3 pt-4 pb-1">
      <div
        onClick={(event) => {
          if (onOpen && !(event.target as HTMLElement).closest("button")) onOpen();
        }}
        className={cx("flex h-5 items-center justify-between px-1", onOpen && "cursor-pointer")}
      >
        <h2 className={cx("text-[11px] tracking-[0.06em] text-tx-3 uppercase transition-colors", onOpen && "hover:text-tx-2")}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
