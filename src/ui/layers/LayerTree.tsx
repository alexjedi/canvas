import { useEffect, useMemo, useRef, useState } from "react";
import { nodes, structure } from "../../doc/store";
import { clearDrop, editor, select } from "../../editor/state";
import { Section } from "../controls/Section";
import { EditorMenu } from "../EditorMenu";
import { useFrame } from "../hooks";
import { LayerRow, ROW_HEIGHT } from "./LayerRow";

interface Entry {
  id: string;
  depth: number;
}

const OVERSCAN = 6;

function flatten(pageId: string): Entry[] {
  const rows: Entry[] = [];
  const walk = (parentId: string, depth: number) => {
    const children = nodes.get(parentId)?.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      rows.push({ id: children[i], depth });
      if (editor.expanded.has(children[i])) walk(children[i], depth + 1);
    }
  };
  walk(pageId, 0);
  return rows;
}

export function LayerTree() {
  const ref = useRef<HTMLDivElement>(null);
  const page = useFrame(() => editor.page);
  const version = useFrame(() => structure.version + editor.tree);
  const first = useFrame(() => editor.selection[0] ?? "");
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(0);
  const rows = useMemo(() => flatten(page), [page, version]);
  const latest = useRef(rows);
  latest.current = rows;

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => setHeight(scroller.clientHeight));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scroller = ref.current;
    const index = first ? latest.current.findIndex((row) => row.id === first) : -1;
    if (!scroller || index < 0) return;
    const offset = index * ROW_HEIGHT;
    if (offset < scroller.scrollTop) scroller.scrollTop = offset;
    else if (offset + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = offset + ROW_HEIGHT - scroller.clientHeight;
  }, [first]);

  const start = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((top + height) / ROW_HEIGHT) + OVERSCAN);

  return (
    <div className="flex min-h-0 flex-1 flex-col" onClick={() => select([])} onDragEnd={clearDrop}>
      <Section title="Layers" />
      <EditorMenu className="flex min-h-0 flex-1 flex-col">
        <div
          ref={ref}
          onScroll={(event) => setTop(event.currentTarget.scrollTop)}
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--color-field-3)_transparent] [scrollbar-width:thin]"
        >
          {rows.length === 0 && <p className="px-1 py-1 text-tx-4">Press F to draw a frame</p>}
          <div style={{ height: rows.length * ROW_HEIGHT, paddingTop: start * ROW_HEIGHT }}>
            {rows.slice(start, end).map((row) => (
              <LayerRow key={row.id} id={row.id} depth={row.depth} />
            ))}
          </div>
        </div>
      </EditorMenu>
    </div>
  );
}
