export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const spring = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;

export const popupClass = (extra = "") =>
  cx(
    "origin-(--transform-origin) rounded-xl bg-bg-2 text-tx shadow-pop outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0 dark:bg-ui",
    extra,
  );

export const tabular = "font-mono text-[11.5px] tabular-nums";
