import { translateWorld, worldBounds } from "./geometry";
import { nodes } from "./store";
import type { Rect } from "./types";

interface Item {
  id: string;
  bounds: Rect;
}

interface Track {
  min: number;
  max: number;
  size: number;
}

interface Axis {
  tracks: Track[];
  first: number[];
}

export interface GridGaps {
  columns: number;
  rows: number;
  gapX: number | null;
  gapY: number | null;
}

const EPSILON = 0.01;

function collect(ids: readonly string[]): Item[] {
  const items: Item[] = [];
  for (const id of ids) {
    const node = nodes.get(id);
    if (node) items.push({ id, bounds: worldBounds(node) });
  }
  return items;
}

function analyse(items: Item[], horizontal: boolean): Axis {
  const start = (item: Item) => (horizontal ? item.bounds.x : item.bounds.y);
  const size = (item: Item) => (horizontal ? item.bounds.width : item.bounds.height);
  const order = items.map((_, index) => index).sort((a, b) => size(items[a]) - size(items[b]));
  const tracks: Track[] = [];
  const spanning: number[] = [];
  for (const index of order) {
    const min = start(items[index]);
    const max = min + size(items[index]);
    const hits = tracks.filter((track) => min < track.max - EPSILON && max > track.min + EPSILON);
    if (hits.length > 1) {
      spanning.push(index);
      continue;
    }
    if (hits.length === 1) {
      hits[0].min = Math.min(hits[0].min, min);
      hits[0].max = Math.max(hits[0].max, max);
      hits[0].size = hits[0].max - hits[0].min;
    } else {
      tracks.push({ min, max, size: max - min });
    }
  }
  tracks.sort((a, b) => a.min - b.min);
  const first = items.map((item) => {
    const min = start(item);
    const max = min + size(item);
    const found = tracks.findIndex((track) => min < track.max - EPSILON && max > track.min + EPSILON);
    return found < 0 ? 0 : found;
  });
  return { tracks, first };
}

function gapOf(tracks: Track[]): number | null {
  if (tracks.length < 2) return null;
  const gap = tracks[1].min - tracks[0].max;
  for (let i = 2; i < tracks.length; i++) {
    if (Math.abs(tracks[i].min - tracks[i - 1].max - gap) > EPSILON) return null;
  }
  return Math.round(gap * 100) / 100;
}

function averageGap(tracks: Track[]): number {
  if (tracks.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < tracks.length; i++) total += tracks[i].min - tracks[i - 1].max;
  return Math.max(0, Math.round(total / (tracks.length - 1)));
}

export function gridGaps(ids: readonly string[]): GridGaps {
  const items = collect(ids);
  const x = analyse(items, true).tracks;
  const y = analyse(items, false).tracks;
  return { columns: x.length, rows: y.length, gapX: gapOf(x), gapY: gapOf(y) };
}

function space(items: Item[], horizontal: boolean, gap: number | null, align: boolean) {
  const axis = analyse(items, horizontal);
  if (axis.tracks.length === 0) return;
  const step = gap ?? averageGap(axis.tracks);
  const origins: number[] = [];
  let cursor = axis.tracks[0].min;
  for (const track of axis.tracks) {
    origins.push(cursor);
    cursor += track.size + step;
  }
  items.forEach((item, index) => {
    const track = axis.first[index];
    const delta = origins[track] - (align ? (horizontal ? item.bounds.x : item.bounds.y) : axis.tracks[track].min);
    translateWorld(item.id, horizontal ? delta : 0, horizontal ? 0 : delta);
  });
}

export function spaceGrid(ids: readonly string[], horizontal: boolean, gap: number | null) {
  space(collect(ids), horizontal, gap, false);
}

export function tidyGrid(ids: readonly string[]) {
  space(collect(ids), true, null, true);
  space(collect(ids), false, null, true);
}
