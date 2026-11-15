import { ALargeSmall, MoveHorizontal, TextAlignCenter, TextAlignEnd, TextAlignStart, UnfoldVertical } from "lucide-react";
import { useMemo } from "react";
import type { TextAlign, TextSizing } from "../../doc/types";
import { setSelected, setTextSizing, styleText } from "../../editor/actions";
import { canLoadFonts, fontOptions, fonts, loadInstalledFonts } from "../../editor/fonts";
import { Button } from "../controls/Button";
import { NumberField } from "../controls/NumberField";
import { Row } from "../controls/Row";
import { Section } from "../controls/Section";
import { Segmented } from "../controls/Segmented";
import { Select } from "../controls/Select";
import { MIXED, numberOf, useFrame, useSelected, useTextStyle } from "../hooks";

const WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const ALIGNMENTS: Array<{ value: TextAlign; label: React.ReactNode; title: string }> = [
  { value: "left", label: <TextAlignStart size={13} />, title: "Align left" },
  { value: "center", label: <TextAlignCenter size={13} />, title: "Align centre" },
  { value: "right", label: <TextAlignEnd size={13} />, title: "Align right" },
];

const SIZINGS: Array<{ value: TextSizing; label: string; title: string }> = [
  { value: "width", label: "Auto W", title: "Auto width" },
  { value: "height", label: "Auto H", title: "Auto height" },
  { value: "fixed", label: "Fixed", title: "Fixed size" },
];

const textOf = <T extends string>(value: T | typeof MIXED | undefined): T | null => (typeof value === "string" ? value : null);

export function TextSection() {
  const family = textOf(useTextStyle("fontFamily"));
  const weight = numberOf(useTextStyle("fontWeight"));
  const size = numberOf(useTextStyle("fontSize"));
  const leading = numberOf(useSelected("lineHeight"));
  const tracking = numberOf(useTextStyle("letterSpacing"));
  const align = textOf(useSelected("textAlign"));
  const sizing = textOf(useSelected("textSizing"));
  const installed = useFrame(() => fonts.installed);
  const families = useMemo(() => fontOptions(installed, family), [installed, family]);

  return (
    <Section title="Text">
      <Select value={family} options={families} onChange={(fontFamily) => styleText({ fontFamily })} />
      <Row>
        <Select value={weight === null ? null : String(weight)} options={WEIGHTS} onChange={(value) => styleText({ fontWeight: Number(value) })} />
        <NumberField
          label={<ALargeSmall size={13} />}
          name="Font size"
          min={1}
          value={size}
          onChange={(fontSize) => styleText({ fontSize }, "fontSize")}
        />
      </Row>
      <Row>
        <NumberField
          label={<UnfoldVertical size={12} />}
          name="Line height"
          suffix="%"
          min={10}
          value={leading === null ? null : leading * 100}
          onChange={(value) => setSelected("lineHeight", value / 100, "lineHeight")}
        />
        <NumberField
          label={<MoveHorizontal size={12} />}
          name="Letter spacing"
          step={0.1}
          value={tracking}
          onChange={(letterSpacing) => styleText({ letterSpacing }, "letterSpacing")}
        />
      </Row>
      <Segmented value={align} options={ALIGNMENTS} onChange={(value) => setSelected("textAlign", value)} />
      <Segmented value={sizing} options={SIZINGS} onChange={setTextSizing} />
      {canLoadFonts() && installed.length === 0 && <Button onClick={loadInstalledFonts}>Load installed fonts</Button>}
    </Section>
  );
}
