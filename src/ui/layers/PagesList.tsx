import { Plus } from "lucide-react";
import { nodes } from "../../doc/store";
import { ROOT } from "../../doc/types";
import { createPage } from "../../editor/actions";
import { IconButton } from "../controls/IconButton";
import { Section } from "../controls/Section";
import { useNodeVersion } from "../hooks";
import { PageRow } from "./PageRow";

export function PagesList() {
  useNodeVersion(ROOT);
  const pages = nodes.get(ROOT)?.children ?? [];

  return (
    <Section
      title="Pages"
      action={
        <IconButton tip="Add page" className="-mr-1 size-6" onClick={createPage}>
          <Plus size={13} />
        </IconButton>
      }
    >
      <div className="flex max-h-40 flex-col overflow-y-auto [scrollbar-width:thin]">
        {pages.map((id) => (
          <PageRow key={id} id={id} removable={pages.length > 1} />
        ))}
      </div>
    </Section>
  );
}
