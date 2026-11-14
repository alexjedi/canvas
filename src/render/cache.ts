import type { Mat } from "../doc/geometry";
import type { Paint, SceneNode, Stroke } from "../doc/types";
import { rasterize, strokeOutset } from "./raster";

export interface Tile {
  texture: WebGLTexture;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  full: boolean;
  bytes: number;
  used: number;
  nodeWidth: number;
  nodeHeight: number;
  radius: number;
  fill: Paint | null;
  stroke: Stroke | null;
}

const FULL_LIMIT = 2048;
const MEMORY_BUDGET = 384 * 1024 * 1024;
const RASTER_BUDGET_MS = 6;
const SWEEP_INTERVAL = 300;
const MARGIN = 0.25;

export function createCache(gl: WebGL2RenderingContext) {
  const tiles = new Map<string, Tile>();
  const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 8192);
  const inverse = new Float64Array(6);
  const visible = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let bytes = 0;
  let frame = 0;
  let frameStart = 0;
  let pending = false;

  function measureVisible(node: SceneNode, m: Mat, pad: number, viewWidth: number, viewHeight: number) {
    const det = m[0] * m[3] - m[1] * m[2] || 1;
    inverse[0] = m[3] / det;
    inverse[1] = -m[1] / det;
    inverse[2] = -m[2] / det;
    inverse[3] = m[0] / det;
    inverse[4] = (m[2] * m[5] - m[3] * m[4]) / det;
    inverse[5] = (m[1] * m[4] - m[0] * m[5]) / det;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      const sx = i & 1 ? viewWidth : 0;
      const sy = i & 2 ? viewHeight : 0;
      const x = inverse[0] * sx + inverse[2] * sy + inverse[4];
      const y = inverse[1] * sx + inverse[3] * sy + inverse[5];
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    visible.x0 = Math.max(-pad, x0);
    visible.y0 = Math.max(-pad, y0);
    visible.x1 = Math.min(node.width + pad, x1);
    visible.y1 = Math.min(node.height + pad, y1);
  }

  function isCurrent(tile: Tile, node: SceneNode) {
    return (
      tile.nodeWidth === node.width &&
      tile.nodeHeight === node.height &&
      tile.radius === node.radius &&
      tile.fill === node.fill &&
      tile.stroke === node.stroke
    );
  }

  function covers(tile: Tile) {
    const slack = 0.5 / tile.scale;
    return (
      tile.x <= visible.x0 + slack &&
      tile.y <= visible.y0 + slack &&
      tile.x + tile.width >= visible.x1 - slack &&
      tile.y + tile.height >= visible.y1 - slack
    );
  }

  function paint(node: SceneNode, existing: Tile | undefined, scale: number, viewWidth: number, viewHeight: number): Tile | null {
    const padPixels = Math.ceil(strokeOutset(node) * scale) + 1;
    const pad = padPixels / scale;
    let pixelWidth = Math.ceil(node.width * scale) + padPixels * 2;
    let pixelHeight = Math.ceil(node.height * scale) + padPixels * 2;
    let x = -pad;
    let y = -pad;
    let actual = scale;
    const full = pixelWidth <= FULL_LIMIT && pixelHeight <= FULL_LIMIT;
    if (!full) {
      const margin = (Math.max(viewWidth, viewHeight) * MARGIN) / scale;
      x = Math.max(-pad, Math.floor((visible.x0 - margin) * scale) / scale);
      y = Math.max(-pad, Math.floor((visible.y0 - margin) * scale) / scale);
      const right = Math.min(node.width + pad, visible.x1 + margin);
      const bottom = Math.min(node.height + pad, visible.y1 + margin);
      pixelWidth = Math.max(1, Math.ceil((right - x) * scale));
      pixelHeight = Math.max(1, Math.ceil((bottom - y) * scale));
      const overflow = Math.max(pixelWidth, pixelHeight) / maxSize;
      if (overflow > 1) {
        actual = scale / overflow;
        pixelWidth = Math.max(1, Math.floor(pixelWidth / overflow));
        pixelHeight = Math.max(1, Math.floor(pixelHeight / overflow));
      }
    }
    const surface = rasterize(node, x, y, actual, pixelWidth, pixelHeight);
    if (!surface) return null;
    const texture = existing?.texture ?? gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
    if (!existing) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const tile: Tile = existing ?? ({ texture } as Tile);
    bytes += pixelWidth * pixelHeight * 4 - (existing?.bytes ?? 0);
    tile.x = x;
    tile.y = y;
    tile.width = pixelWidth / actual;
    tile.height = pixelHeight / actual;
    tile.scale = scale;
    tile.full = full;
    tile.bytes = pixelWidth * pixelHeight * 4;
    tile.used = frame;
    tile.nodeWidth = node.width;
    tile.nodeHeight = node.height;
    tile.radius = node.radius;
    tile.fill = node.fill;
    tile.stroke = node.stroke;
    tiles.set(node.id, tile);
    return tile;
  }

  return {
    beginFrame() {
      frame++;
      frameStart = performance.now();
      pending = false;
    },

    resolve(node: SceneNode, m: Mat, scale: number, viewWidth: number, viewHeight: number, settled: boolean): Tile | null {
      const tile = tiles.get(node.id);
      const pad = (Math.ceil(strokeOutset(node) * scale) + 1) / scale;
      measureVisible(node, m, pad, viewWidth, viewHeight);
      if (tile && isCurrent(tile, node) && (tile.full || covers(tile))) {
        const sharp = tile.scale === scale;
        const deferred = !sharp && (!settled || performance.now() - frameStart > RASTER_BUDGET_MS);
        if (sharp || deferred) {
          pending ||= deferred;
          tile.used = frame;
          gl.bindTexture(gl.TEXTURE_2D, tile.texture);
          return tile;
        }
      }
      return paint(node, tile, scale, viewWidth, viewHeight);
    },

    endFrame(): boolean {
      const sweep = frame % SWEEP_INTERVAL === 0;
      if (bytes > MEMORY_BUDGET || sweep) {
        const stale = [...tiles].filter(([, tile]) => tile.used < frame).sort((a, b) => a[1].used - b[1].used);
        for (const [id, tile] of stale) {
          if (bytes <= MEMORY_BUDGET && frame - tile.used < SWEEP_INTERVAL) continue;
          gl.deleteTexture(tile.texture);
          bytes -= tile.bytes;
          tiles.delete(id);
        }
      }
      return pending;
    },

    clear(release: boolean) {
      if (release) for (const tile of tiles.values()) gl.deleteTexture(tile.texture);
      tiles.clear();
      bytes = 0;
    },
  };
}
