import { LayoutGrid, StretchHorizontal, StretchVertical } from "lucide-react";
import { topLevel } from "../../doc/geometry";
import { gridGaps } from "../../doc/grid";
import { nodes } from "../../doc/store";
import { spaceSelection, tidySelection } from "../../editor/actions";
import { editor } from "../../editor/state";
import { Button } from "../controls/Button";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { useFrame } from "../hooks";

let cachedKey = "";
let cachedValue = "";

function read(): string {
  if (editor.selection.length < 2) return "";
  let key = "";
  for (const id of editor.selection) key += `${id}:${nodes.get(id)?.version ?? 0},`;
  if (key === cachedKey) return cachedValue;
  const gaps = gridGaps(topLevel(editor.selection));
  cachedKey = key;
  cachedValue = `${gaps.columns}|${gaps.rows}|${gaps.gapX ?? ""}|${gaps.gapY ?? ""}`;
  return cachedValue;
}

export function GridRow() {
  const state = useFrame(read);
  if (!state) return null;
  const [columns, rows, gapX, gapY] = state.split("|");
  const many = Number(columns) > 1 || Number(rows) > 1;
  if (!many) return null;

  return (
    <>
      <Row>
        {Number(columns) > 1 && (
          <NumberField
            label={<StretchHorizontal size={12} />}
            name="Horizontal gap"
            value={gapX === "" ? null : Number(gapX)}
            onChange={(value) => spaceSelection(true, value)}
          />
        )}
        {Number(rows) > 1 && (
          <NumberField
            label={<StretchVertical size={12} />}
            name="Vertical gap"
            value={gapY === "" ? null : Number(gapY)}
            onChange={(value) => spaceSelection(false, value)}
          />
        )}
      </Row>
      <Button onClick={tidySelection}>
        <LayoutGrid size={13} />
        Tidy up
      </Button>
    </>
  );
}
