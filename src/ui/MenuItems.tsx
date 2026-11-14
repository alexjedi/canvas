import { nodes } from "../doc/store";
import {
  copyToSystem,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  hasClipboard,
  pasteClipboard,
  reorder,
  toggleSelected,
  ungroupSelection,
} from "../editor/actions";
import { editor } from "../editor/state";
import { useFrame } from "./hooks";
import { MenuItem, MenuSeparator } from "./MenuItem";

export function MenuItems() {
  const empty = useFrame(() => editor.selection.length === 0);
  const container = useFrame(() => editor.selection.some((id) => (nodes.get(id)?.children.length ?? 0) > 0));
  const hidden = useFrame(() => editor.selection.length > 0 && editor.selection.every((id) => !nodes.get(id)?.visible));
  const locked = useFrame(() => editor.selection.length > 0 && editor.selection.every((id) => nodes.get(id)?.locked));

  return (
    <>
      <MenuItem label="Copy" hint="⌘C" disabled={empty} onSelect={copyToSystem} />
      <MenuItem label="Paste" hint="⌘V" disabled={!hasClipboard()} onSelect={pasteClipboard} />
      <MenuItem label="Duplicate" hint="⌘D" disabled={empty} onSelect={duplicateSelection} />
      <MenuItem label="Delete" hint="⌫" disabled={empty} onSelect={deleteSelection} />
      <MenuSeparator />
      <MenuItem label="Group" hint="⌘G" disabled={empty} onSelect={groupSelection} />
      <MenuItem label="Ungroup" hint="⇧⌘G" disabled={!container} onSelect={ungroupSelection} />
      <MenuSeparator />
      <MenuItem label="Bring to front" hint="]" disabled={empty} onSelect={() => reorder("front")} />
      <MenuItem label="Send to back" hint="[" disabled={empty} onSelect={() => reorder("back")} />
      <MenuSeparator />
      <MenuItem label={hidden ? "Show" : "Hide"} hint="⇧⌘H" disabled={empty} onSelect={() => toggleSelected("visible")} />
      <MenuItem label={locked ? "Unlock" : "Lock"} hint="⇧⌘L" disabled={empty} onSelect={() => toggleSelected("locked")} />
    </>
  );
}
