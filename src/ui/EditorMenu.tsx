import { ContextMenu } from "@base-ui/react/context-menu";
import type { ReactNode } from "react";
import { popupClass } from "./controls/cx";
import { MenuItems } from "./MenuItems";

export function EditorMenu({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className={className}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50 outline-none">
          <ContextMenu.Popup className={popupClass("min-w-52 p-1")}>
            <MenuItems />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
