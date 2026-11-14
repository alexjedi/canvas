import { Tooltip } from "@base-ui/react/tooltip";
import type { ComponentProps } from "react";
import { cx, popupClass } from "./cx";

export function IconButton({ tip, children, className, active, ...rest }: ComponentProps<"button"> & { tip: string; active?: boolean }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        {...rest}
        aria-label={tip}
        className={cx(
          "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-tx-2 transition-colors hover:bg-field-2 hover:text-tx disabled:pointer-events-none disabled:opacity-35",
          active && "bg-field-2 text-tx",
          className,
        )}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} className="z-50">
          <Tooltip.Popup className={popupClass("px-2 py-1 text-xs text-tx-2")}>{tip}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
