import { Switch as BaseSwitch } from "@base-ui/react/switch";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex h-8 cursor-pointer items-center justify-between rounded-lg bg-field px-2.5 text-tx-2 transition-colors hover:bg-field-2">
      {label}
      <BaseSwitch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative flex h-4 w-7 rounded-full bg-field-3 p-0.5 transition-colors data-checked:bg-tx"
      >
        <BaseSwitch.Thumb className="size-3 rounded-full bg-bg shadow-sm transition-transform data-checked:translate-x-3" />
      </BaseSwitch.Root>
    </label>
  );
}
