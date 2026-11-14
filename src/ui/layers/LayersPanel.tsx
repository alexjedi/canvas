import { LayerTree } from "./LayerTree";
import { PagesList } from "./PagesList";

export function LayersPanel() {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col overflow-hidden rounded-2xl bg-panel">
      <PagesList />
      <LayerTree />
    </aside>
  );
}
