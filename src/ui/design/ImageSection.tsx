import type { ImageFit } from "../../doc/types";
import { setSelected } from "../../editor/actions";
import { Section } from "../controls/Section";
import { Select } from "../controls/Select";
import { MIXED, useSelected } from "../hooks";

const FITS: Array<{ value: ImageFit; label: string }> = [
  { value: "cover", label: "Fill" },
  { value: "contain", label: "Fit" },
  { value: "stretch", label: "Stretch" },
  { value: "tile", label: "Tile" },
];

export function ImageSection() {
  const fit = useSelected("fit");

  return (
    <Section title="Image">
      <Select value={fit === MIXED || !fit ? null : fit} options={FITS} onChange={(value) => setSelected("fit", value)} />
    </Section>
  );
}
