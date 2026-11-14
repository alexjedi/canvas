import { fitIfNeeded, zoomAt } from "../editor/actions";
import { camera, editor, setCamera, toWorld, viewport, type ToolId } from "../editor/state";
import { invalidate, subscribe } from "../frame";
import { createShapeTool } from "./create";
import { handTool } from "./hand";
import { createSelectTool } from "./select";
import type { Pointer, Tool } from "./types";

interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

const TOOLS: Record<ToolId, Tool> = {
  move: createSelectTool(false),
  scale: createSelectTool(true),
  frame: createShapeTool("frame"),
  rect: createShapeTool("rect"),
  hand: handTool,
};

const ZOOM_SPEED = 0.01;

export function attachInput(canvas: HTMLCanvasElement) {
  let active: Tool | null = null;
  let space = false;
  let gestureZoom = 1;
  let lastTool = editor.tool;

  const current = () => (space ? handTool : TOOLS[editor.tool]);

  function pointerOf(event: PointerEvent | MouseEvent): Pointer {
    const bounds = canvas.getBoundingClientRect();
    const sx = event.clientX - bounds.left;
    const sy = event.clientY - bounds.top;
    const world = toWorld(sx, sy);
    return {
      x: world.x,
      y: world.y,
      sx,
      sy,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey || event.ctrlKey,
      clicks: event.detail,
    };
  }

  function onPointerDown(event: PointerEvent) {
    if (active || (event.button !== 0 && event.button !== 1)) return;
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
    canvas.setPointerCapture(event.pointerId);
    active = event.button === 1 ? handTool : current();
    if (active === handTool) canvas.style.cursor = "grabbing";
    active.down(pointerOf(event));
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    const pointer = pointerOf(event);
    if (active) {
      active.drag(pointer);
      return;
    }
    const tool = current();
    canvas.style.cursor = tool.hover?.(pointer) ?? tool.cursor;
  }

  function onPointerUp(event: PointerEvent) {
    if (!active) return;
    const tool = active;
    active = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.type === "pointercancel") tool.cancel?.();
    else tool.up(pointerOf(event));
    canvas.style.cursor = current().cursor;
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, camera.zoom * Math.exp(-delta * ZOOM_SPEED));
    } else {
      const dx = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
      setCamera(camera.x - dx, camera.y - dy, camera.zoom);
    }
  }

  function onGestureStart(event: Event) {
    event.preventDefault();
    gestureZoom = camera.zoom;
  }

  function onGestureChange(event: Event) {
    event.preventDefault();
    const gesture = event as GestureEvent;
    const bounds = canvas.getBoundingClientRect();
    zoomAt(gesture.clientX - bounds.left, gesture.clientY - bounds.top, gestureZoom * gesture.scale);
  }

  function isTyping(event: KeyboardEvent) {
    return event.target instanceof HTMLElement && !!event.target.closest("input, textarea, select, [contenteditable]");
  }

  function onKeyDown(event: KeyboardEvent) {
    if (isTyping(event)) return;
    if (event.key === " ") {
      event.preventDefault();
      if (space) return;
      space = true;
      if (!active) canvas.style.cursor = handTool.cursor;
    } else if (event.key === "Escape" && active) {
      event.stopImmediatePropagation();
      const tool = active;
      active = null;
      tool.cancel?.();
      canvas.style.cursor = current().cursor;
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key !== " ") return;
    space = false;
    if (!active) canvas.style.cursor = current().cursor;
  }

  function onBlur() {
    space = false;
  }

  function onResize() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    viewport.width = width;
    viewport.height = height;
    viewport.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    fitIfNeeded();
    invalidate();
  }

  const unsubscribe = subscribe(() => {
    if (lastTool === editor.tool) return;
    lastTool = editor.tool;
    if (!active) canvas.style.cursor = current().cursor;
  });

  const observer = new ResizeObserver(onResize);
  observer.observe(canvas);
  onResize();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("gesturestart", onGestureStart);
  canvas.addEventListener("gesturechange", onGestureChange);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return () => {
    unsubscribe();
    observer.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("gesturestart", onGestureStart);
    canvas.removeEventListener("gesturechange", onGestureChange);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}
