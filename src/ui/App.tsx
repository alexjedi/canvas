import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect } from "react";
import { attachShortcuts } from "../editor/shortcuts";
import { DesignPanel } from "./design/DesignPanel";
import { LayersPanel } from "./layers/LayersPanel";
import { Stage } from "./Stage";
import { Toolbar } from "./Toolbar";

export function App() {
  useEffect(attachShortcuts, []);

  return (
    <Tooltip.Provider delay={400}>
      <div className="flex h-full gap-2 p-2">
        <LayersPanel />
        <main className="relative flex min-w-0 flex-1 flex-col">
          <Stage />
          <Toolbar />
        </main>
        <DesignPanel />
      </div>
    </Tooltip.Provider>
  );
}
