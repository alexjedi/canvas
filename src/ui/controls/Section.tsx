import type { ReactNode } from "react";

export function Section({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-3 pt-4 pb-1">
      <div className="flex h-5 items-center justify-between px-1">
        <h2 className="text-[11px] tracking-[0.06em] text-tx-3 uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
