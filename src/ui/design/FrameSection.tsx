import { createFrame } from "../../editor/actions";
import { FRAME_PRESETS } from "../../editor/presets";
import { tabular } from "../controls/cx";
import { Section } from "../controls/Section";

export function FrameSection() {
  return (
    <>
      {FRAME_PRESETS.map((group) => (
        <Section key={group.title} title={group.title}>
          <div className="flex flex-col">
            {group.presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => createFrame(preset.name, preset.width, preset.height)}
                className="flex h-7 cursor-pointer items-center justify-between gap-2 rounded-md px-1 text-left text-tx-2 transition-colors hover:bg-field-2 hover:text-tx"
              >
                <span className="truncate">{preset.name}</span>
                <span className={`${tabular} shrink-0 text-tx-3`}>
                  {preset.width} × {preset.height}
                </span>
              </button>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
