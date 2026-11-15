import { invalidate } from "../frame";

export interface FontOption {
  value: string;
  label: string;
}

interface LocalFont {
  family: string;
}

type FontWindow = Window & { queryLocalFonts?: () => Promise<LocalFont[]> };

const SYSTEM: FontOption[] = [
  { value: "system-ui", label: "System" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Menlo", label: "Menlo" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
];

export const fonts = { installed: [] as readonly string[] };

export const canLoadFonts = () => typeof (window as FontWindow).queryLocalFonts === "function";

export async function loadInstalledFonts() {
  try {
    const found = (await (window as FontWindow).queryLocalFonts?.()) ?? [];
    fonts.installed = [...new Set(found.map((font) => font.family))].sort((a, b) => a.localeCompare(b));
    invalidate();
  } catch {}
}

export function fontOptions(installed: readonly string[], current: string | null): FontOption[] {
  const options = SYSTEM.slice();
  const known = new Set(options.map((option) => option.value));
  for (const family of installed) {
    if (known.has(family)) continue;
    known.add(family);
    options.push({ value: family, label: family });
  }
  if (current && !known.has(current)) options.push({ value: current, label: current });
  return options;
}
