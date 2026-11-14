const listeners = new Set<() => void>();
let draw: (() => void) | null = null;
let scheduled = false;

function tick() {
  scheduled = false;
  listeners.forEach((fn) => fn());
  draw?.();
}

export function invalidate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(tick);
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setDraw(fn: (() => void) | null) {
  draw = fn;
  invalidate();
}
