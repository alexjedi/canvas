import { useState } from "react";
import { cx } from "../controls/cx";

export function InlineName({ name, onRename, className }: { name: string; onRename: (name: string) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <span onDoubleClick={() => setDraft(name)} className={cx("min-w-0 flex-1 truncate", className)}>
        {name}
      </span>
    );
  }

  return (
    <input
      autoFocus
      aria-label="Name"
      value={draft}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        onRename(draft);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className="-mx-1 min-w-0 flex-1 rounded-sm bg-field-2 px-1 text-tx outline-none"
    />
  );
}
