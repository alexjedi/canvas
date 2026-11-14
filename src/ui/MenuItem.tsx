import { ContextMenu } from "@base-ui/react/context-menu";
import { cx, tabular } from "./controls/cx";

export function MenuItem({ label, hint, disabled, onSelect }: { label: string; hint?: string; disabled?: boolean; onSelect: () => void }) {
  return (
    <ContextMenu.Item
      disabled={disabled}
      onClick={onSelect}
      className="flex h-8 cursor-default items-center justify-between gap-8 rounded-md px-2 outline-none data-disabled:opacity-40 data-highlighted:bg-field-2"
    >
      {label}
      {hint && <span className={cx(tabular, "text-tx-3")}>{hint}</span>}
    </ContextMenu.Item>
  );
}

export function MenuSeparator() {
  return <ContextMenu.Separator className="mx-2 my-1 h-px bg-field-2" />;
}
