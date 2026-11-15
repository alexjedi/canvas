import { useState } from "react";
import type { Paint } from "../../doc/types";
import type { Notation } from "../../editor/prefs";
import { cx, tabular } from "../controls/cx";
import { formatColor, parseColor } from "./convert";

export function ColorInput({ value, notation, alpha, onChange }: { value: Paint | null; notation: Notation; alpha: boolean; onChange: (paint: Paint) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value ? formatColor(value, notation, alpha) : "Mixed";

  function commit() {
    const parsed = draft === null || draft === shown ? null : parseColor(draft);
    if (parsed) onChange(alpha ? parsed : { ...parsed, opacity: 1 });
    setDraft(null);
  }

  return (
    <input
      aria-label="Colour value"
      spellCheck={false}
      value={draft ?? shown}
      onFocus={() => setDraft(value ? shown : "")}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
      className={cx(tabular, "h-8 min-w-0 flex-1 rounded-lg bg-field px-2.5 text-tx outline-none transition-colors hover:bg-field-2 focus:bg-field-2")}
    />
  );
}
