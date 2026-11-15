import { mat, multiply, setLocal, setWorld, unionBounds, type Mat } from "../doc/geometry";
import { nodes } from "../doc/store";
import type { SceneNode } from "../doc/types";
import { segmentCount, STRIDE } from "../doc/vector";
import { camera, editor, viewport } from "../editor/state";
import { invalidate } from "../frame";
import { createCache } from "./cache";
import { cssColor, type Rgb } from "./color";
import { createProgram, type Program } from "./gl";
import { cornerRadius, isPaintable, paintOutset } from "./raster";
import { MASK_FRAGMENT, SOLID_FRAGMENT, TEXTURE_FRAGMENT, VERTEX } from "./shaders";

const SETTLE_MS = 120;
const HANDLE_SIZE = 8;
const ANCHOR_SIZE = 7;
const KNOB_SIZE = 5;
const CURVE_STEPS = 16;
const WHITE: Rgb = [1, 1, 1];
const MAX_CLIP_DEPTH = 255;
const FALLBACK_ACCENT: Rgb = [0.05, 0.6, 1];
const FALLBACK_GUIDE: Rgb = [1, 0.25, 0.3];

export function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: true,
  });
  if (!gl) return null;

  const matrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const stack: Mat[] = [mat()];
  const world = mat();
  const corners = new Float64Array(8);
  let cache = createCache(gl);
  let texture: Program;
  let solid: Program;
  let mask: Program;
  let active: Program;
  let accent = FALLBACK_ACCENT;
  let guide = FALLBACK_GUIDE;
  let scale = 1;
  let settled = true;
  let concealed = "";

  function setup() {
    texture = createProgram(gl!, VERTEX, TEXTURE_FRAGMENT, ["u_rect", "u_matrix", "u_resolution", "u_texture", "u_alpha"]);
    solid = createProgram(gl!, VERTEX, SOLID_FRAGMENT, ["u_rect", "u_matrix", "u_resolution", "u_color"]);
    mask = createProgram(gl!, VERTEX, MASK_FRAGMENT, ["u_rect", "u_matrix", "u_resolution", "u_size", "u_radius"]);
    const buffer = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl!.STATIC_DRAW);
    gl!.enableVertexAttribArray(0);
    gl!.vertexAttribPointer(0, 2, gl!.FLOAT, false, 0, 0);
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
    gl!.clearColor(0, 0, 0, 0);
  }

  function readTheme() {
    accent = cssColor("--color-bl", FALLBACK_ACCENT);
    guide = cssColor("--color-re", FALLBACK_GUIDE);
    invalidate();
  }

  function use(program: Program) {
    if (active === program) return;
    active = program;
    gl!.useProgram(program.program);
    gl!.uniform2f(program.uniforms.u_resolution, canvas.width, canvas.height);
  }

  function upload(program: Program, m: Mat, x: number, y: number, width: number, height: number) {
    matrix[0] = m[0];
    matrix[1] = m[1];
    matrix[3] = m[2];
    matrix[4] = m[3];
    matrix[6] = m[4];
    matrix[7] = m[5];
    gl!.uniformMatrix3fv(program.uniforms.u_matrix, false, matrix);
    gl!.uniform4f(program.uniforms.u_rect, x, y, width, height);
  }

  function measure(node: SceneNode, m: Mat, pad: number) {
    const x0 = -pad, y0 = -pad, x1 = node.width + pad, y1 = node.height + pad;
    corners[0] = m[0] * x0 + m[2] * y0 + m[4];
    corners[1] = m[1] * x0 + m[3] * y0 + m[5];
    corners[2] = m[0] * x1 + m[2] * y0 + m[4];
    corners[3] = m[1] * x1 + m[3] * y0 + m[5];
    corners[4] = m[0] * x1 + m[2] * y1 + m[4];
    corners[5] = m[1] * x1 + m[3] * y1 + m[5];
    corners[6] = m[0] * x0 + m[2] * y1 + m[4];
    corners[7] = m[1] * x0 + m[3] * y1 + m[5];
  }

  function onScreen() {
    const minX = Math.min(corners[0], corners[2], corners[4], corners[6]);
    const maxX = Math.max(corners[0], corners[2], corners[4], corners[6]);
    const minY = Math.min(corners[1], corners[3], corners[5], corners[7]);
    const maxY = Math.max(corners[1], corners[3], corners[5], corners[7]);
    return maxX >= 0 && maxY >= 0 && minX <= canvas.width && minY <= canvas.height;
  }

  function drawMask(node: SceneNode, m: Mat) {
    use(mask);
    upload(mask, m, 0, 0, node.width, node.height);
    gl!.uniform2f(mask.uniforms.u_size, node.width, node.height);
    gl!.uniform1f(mask.uniforms.u_radius, cornerRadius(node));
    gl!.colorMask(false, false, false, false);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    gl!.colorMask(true, true, true, true);
    gl!.stencilOp(gl!.KEEP, gl!.KEEP, gl!.KEEP);
  }

  function drawChildren(parent: SceneNode, depth: number, alpha: number, clipDepth: number) {
    if (stack.length <= depth + 1) stack.push(mat());
    const m = stack[depth + 1];
    for (let i = 0; i < parent.children.length; i++) {
      const node = nodes.get(parent.children[i]);
      if (!node || !node.visible) continue;
      multiply(m, stack[depth], setLocal(m, node));
      measure(node, m, paintOutset(node));
      const visible = onScreen();
      const hasChildren = node.children.length > 0;
      if (!visible && (!hasChildren || node.clip)) continue;
      const opacity = alpha * node.opacity;
      if (opacity <= 0) continue;
      if (visible && node.id !== concealed && isPaintable(node)) {
        const tile = cache.resolve(node, m, scale, canvas.width, canvas.height, settled);
        if (tile) {
          use(texture);
          upload(texture, m, tile.x, tile.y, tile.width, tile.height);
          gl!.uniform1f(texture.uniforms.u_alpha, opacity);
          gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
        }
      }
      if (!hasChildren) continue;
      if (!node.clip || clipDepth >= MAX_CLIP_DEPTH) {
        drawChildren(node, depth + 1, opacity, clipDepth);
        continue;
      }
      gl!.stencilFunc(gl!.EQUAL, clipDepth, 0xff);
      gl!.stencilOp(gl!.KEEP, gl!.KEEP, gl!.INCR);
      drawMask(node, m);
      gl!.stencilFunc(gl!.EQUAL, clipDepth + 1, 0xff);
      drawChildren(node, depth + 1, opacity, clipDepth + 1);
      gl!.stencilFunc(gl!.EQUAL, clipDepth + 1, 0xff);
      gl!.stencilOp(gl!.KEEP, gl!.KEEP, gl!.DECR);
      drawMask(node, m);
      gl!.stencilFunc(gl!.EQUAL, clipDepth, 0xff);
    }
  }

  function fillRect(x: number, y: number, width: number, height: number, alpha: number, color: Rgb = accent) {
    matrix[0] = width;
    matrix[1] = 0;
    matrix[3] = 0;
    matrix[4] = height;
    matrix[6] = x;
    matrix[7] = y;
    gl!.uniformMatrix3fv(solid.uniforms.u_matrix, false, matrix);
    gl!.uniform4f(solid.uniforms.u_color, color[0] * alpha, color[1] * alpha, color[2] * alpha, alpha);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  function line(x0: number, y0: number, x1: number, y1: number, thickness: number, color: Rgb = accent) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const ux = (dx / length) * thickness;
    const uy = (dy / length) * thickness;
    matrix[0] = dx + ux;
    matrix[1] = dy + uy;
    matrix[3] = -uy;
    matrix[4] = ux;
    matrix[6] = x0 - ux / 2 + uy / 2;
    matrix[7] = y0 - uy / 2 - ux / 2;
    gl!.uniformMatrix3fv(solid.uniforms.u_matrix, false, matrix);
    gl!.uniform4f(solid.uniforms.u_color, color[0], color[1], color[2], 1);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  function strokeRect(x: number, y: number, width: number, height: number, thickness: number) {
    line(x, y, x + width, y, thickness);
    line(x + width, y, x + width, y + height, thickness);
    line(x + width, y + height, x, y + height, thickness);
    line(x, y + height, x, y, thickness);
  }

  function outline(id: string, thickness: number, handles: boolean) {
    const node = nodes.get(id);
    if (!node) return;
    multiply(world, stack[0], setWorld(world, node));
    measure(node, world, 0);
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      line(corners[i * 2], corners[i * 2 + 1], corners[next * 2], corners[next * 2 + 1], thickness);
    }
    if (!handles) return;
    const size = HANDLE_SIZE * viewport.dpr;
    const border = Math.max(1, Math.round(viewport.dpr));
    for (let i = 0; i < 4; i++) {
      const x = Math.round(corners[i * 2] - size / 2);
      const y = Math.round(corners[i * 2 + 1] - size / 2);
      fillRect(x, y, size, size, 1);
      fillRect(x + border, y + border, size - border * 2, size - border * 2, 1, [1, 1, 1]);
    }
  }

  function square(x: number, y: number, size: number, filled: boolean) {
    const left = Math.round(x - size / 2);
    const top = Math.round(y - size / 2);
    const border = Math.max(1, Math.round(viewport.dpr));
    fillRect(left, top, size, size, 1);
    if (!filled) fillRect(left + border, top + border, size - border * 2, size - border * 2, 1, WHITE);
  }

  function curve(x0: number, y0: number, c1x: number, c1y: number, c2x: number, c2y: number, x1: number, y1: number, thickness: number) {
    let px = x0;
    let py = y0;
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      const x = a * x0 + b * c1x + c * c2x + d * x1;
      const y = a * y0 + b * c1y + c * c2y + d * y1;
      line(px, py, x, y, thickness);
      px = x;
      py = y;
    }
  }

  function drawVector(node: SceneNode, thickness: number) {
    multiply(world, stack[0], setWorld(world, node));
    const { width, height } = node;
    const sx = (x: number, y: number) => world[0] * x * width + world[2] * y * height + world[4];
    const sy = (x: number, y: number) => world[1] * x * width + world[3] * y * height + world[5];
    const anchor = ANCHOR_SIZE * viewport.dpr;
    const knob = KNOB_SIZE * viewport.dpr;
    const selected = editor.points;
    const pen = editor.pen;
    let offset = 0;
    for (let index = 0; index < node.paths.length; index++) {
      const path = node.paths[index];
      const p = path.points;
      const count = p.length / STRIDE;
      const segments = segmentCount(path);
      for (let i = 0; i < segments; i++) {
        const a = i * STRIDE;
        const b = ((i + 1) % count) * STRIDE;
        curve(sx(p[a], p[a + 1]), sy(p[a], p[a + 1]), sx(p[a + 4], p[a + 5]), sy(p[a + 4], p[a + 5]), sx(p[b + 2], p[b + 3]), sy(p[b + 2], p[b + 3]), sx(p[b], p[b + 1]), sy(p[b], p[b + 1]), thickness);
      }
      const last = index === node.paths.length - 1 && !path.closed && count > 0 ? count - 1 : -1;
      if (pen && last >= 0) {
        const o = last * STRIDE;
        const ex = pen.x * stack[0][0] + stack[0][4];
        const ey = pen.y * stack[0][3] + stack[0][5];
        curve(sx(p[o], p[o + 1]), sy(p[o], p[o + 1]), sx(p[o + 4], p[o + 5]), sy(p[o + 4], p[o + 5]), ex, ey, ex, ey, thickness);
      }
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        const active = selected.includes(offset + i);
        const ax = sx(p[o], p[o + 1]);
        const ay = sy(p[o], p[o + 1]);
        if (active || (pen && i === last)) {
          for (let side = 2; side <= 4; side += 2) {
            if (p[o + side] === p[o] && p[o + side + 1] === p[o + 1]) continue;
            const hx = sx(p[o + side], p[o + side + 1]);
            const hy = sy(p[o + side], p[o + side + 1]);
            line(ax, ay, hx, hy, thickness);
            square(hx, hy, knob, false);
          }
        }
        square(ax, ay, anchor, active);
      }
      offset += count;
    }
  }

  function drawOverlay() {
    gl!.disable(gl!.STENCIL_TEST);
    use(solid);
    gl!.uniform4f(solid.uniforms.u_rect, 0, 0, 1, 1);
    const thin = Math.max(1, Math.round(viewport.dpr));
    const selection = editor.selection;
    const view = stack[0];
    if (editor.hover && !editor.selected.has(editor.hover)) outline(editor.hover, thin * 2, false);
    const edited = nodes.get(editor.editing);
    for (const id of selection) if (id !== editor.editing) outline(id, thin, selection.length === 1);
    if (edited?.kind === "vector") drawVector(edited, thin);
    if (selection.length > 1) {
      const bounds = unionBounds(selection);
      if (bounds) {
        strokeRect(bounds.x * view[0] + view[4], bounds.y * view[3] + view[5], bounds.width * view[0], bounds.height * view[3], thin);
      }
    }
    for (const item of editor.guides) {
      line(
        Math.round(item.x0 * view[0] + view[4]),
        Math.round(item.y0 * view[3] + view[5]),
        Math.round(item.x1 * view[0] + view[4]),
        Math.round(item.y1 * view[3] + view[5]),
        thin,
        guide,
      );
    }
    const marquee = editor.marquee;
    if (marquee) {
      const x = marquee.x * view[0] + view[4];
      const y = marquee.y * view[3] + view[5];
      fillRect(x, y, marquee.width * view[0], marquee.height * view[3], 0.12);
      strokeRect(x, y, marquee.width * view[0], marquee.height * view[3], thin);
    }
  }

  function draw(overlay = true) {
    if (gl!.isContextLost() || canvas.width === 0 || canvas.height === 0) return;
    const page = nodes.get(editor.page);
    concealed = overlay && nodes.get(editor.editing)?.kind === "text" ? editor.editing : "";
    scale = camera.zoom * viewport.dpr;
    settled = performance.now() - camera.zoomedAt > SETTLE_MS;
    const view = stack[0];
    view[0] = scale;
    view[1] = 0;
    view[2] = 0;
    view[3] = scale;
    view[4] = camera.x * viewport.dpr;
    view[5] = camera.y * viewport.dpr;
    active = null as unknown as Program;
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.stencilMask(0xff);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.STENCIL_BUFFER_BIT);
    gl!.enable(gl!.STENCIL_TEST);
    gl!.stencilFunc(gl!.EQUAL, 0, 0xff);
    gl!.stencilOp(gl!.KEEP, gl!.KEEP, gl!.KEEP);
    cache.beginFrame();
    if (page) drawChildren(page, 0, 1, 0);
    if (overlay) drawOverlay();
    if (cache.endFrame()) invalidate();
  }

  function sample(x: number, y: number): [number, number, number, number] | null {
    if (gl!.isContextLost() || canvas.width === 0) return null;
    draw(false);
    const pixel = new Uint8Array(4);
    gl!.readPixels(Math.round(x * viewport.dpr), canvas.height - Math.round(y * viewport.dpr) - 1, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    invalidate();
    return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255, pixel[3] / 255];
  }

  function onLost(event: Event) {
    event.preventDefault();
  }

  function onRestored() {
    cache.clear(false);
    cache = createCache(gl!);
    setup();
    invalidate();
  }

  setup();
  readTheme();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  window.addEventListener("themechange", readTheme);

  return {
    draw,
    sample,
    destroy() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      window.removeEventListener("themechange", readTheme);
      cache.clear(true);
    },
  };
}
