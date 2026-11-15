import { Trash2 } from "lucide-react";
import { useState } from "react";
import { nodes } from "../../doc/store";
import { deletePage, renameNode } from "../../editor/actions";
import { editor, setPage } from "../../editor/state";
import { ConfirmDialog } from "../ConfirmDialog";
import { cx } from "../controls/cx";
import { useFrame, useNodeVersion } from "../hooks";
import { InlineName } from "./InlineName";

export function PageRow({ id, removable }: { id: string; removable: boolean }) {
  useNodeVersion(id);
  const active = useFrame(() => editor.page === id);
  const [confirming, setConfirming] = useState(false);
  const page = nodes.get(id);
  if (!page) return null;

  return (
    <>
    <div
      onClick={() => setPage(id)}
      className={cx(
        "group flex h-7 shrink-0 cursor-default items-center gap-1 rounded-md px-2 transition-colors",
        active ? "bg-field-2 text-tx" : "text-tx-2 hover:bg-field",
      )}
    >
      <InlineName name={page.name} onRename={(name) => renameNode(id, name)} />
      {removable && (
        <button
          aria-label="Delete page"
          onClick={(event) => {
            event.stopPropagation();
            setConfirming(true);
          }}
          className="hidden size-5 cursor-pointer items-center justify-center rounded text-tx-3 group-hover:flex hover:text-tx"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
      {confirming && (
        <ConfirmDialog
          open
          title={`Delete ${page.name}?`}
          message="The page and all of its layers will be removed. You can bring it back with undo."
          action="Delete page"
          onConfirm={() => deletePage(id)}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
