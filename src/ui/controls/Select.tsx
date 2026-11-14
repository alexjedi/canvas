import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cx, popupClass } from "./cx";

interface SelectProps<T extends string> {
  value: T | null;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

export function Select<T extends string>({ value, options, onChange, placeholder = "Mixed", className }: SelectProps<T>) {
  return (
    <BaseSelect.Root items={options} value={value} onValueChange={(next) => next && onChange(next as T)}>
      <BaseSelect.Trigger
        className={cx(
          "flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg bg-field px-2.5 text-left transition-colors outline-none hover:bg-field-2 data-popup-open:bg-field-2",
          className,
        )}
      >
        <BaseSelect.Value className="flex-1 truncate" placeholder={placeholder} />
        <BaseSelect.Icon className="text-tx-3">
          <ChevronDown size={12} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="z-50 outline-none" sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className={popupClass("min-w-(--anchor-width) p-1")}>
            <BaseSelect.List className="max-h-(--available-height) overflow-y-auto">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none data-highlighted:bg-field-2"
                >
                  {option.icon && <span className="text-tx-2">{option.icon}</span>}
                  <BaseSelect.ItemText className="flex-1">{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="text-tx-2">
                    <Check size={12} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
