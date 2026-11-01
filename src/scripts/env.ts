/**
 * Environment probes shared by the hero and the stack object.
 *
 * Three query-string overrides exist so the degraded paths can be forced
 * without touching OS settings: `?reduce` (prefers-reduced-motion), `?nogl`
 * (WebGL unavailable) and `?lite` (stay on the poster). They are documented in
 * the README. The probes here feed the shared rule in `src/lib/scene-gate.ts`.
 */
import { isIdle, onWake, shouldRender } from '../lib/frame-pacing';
import type { SceneProbe } from '../lib/scene-gate';

const params = () => new URLSearchParams(window.location.search);

export function prefersReducedMotion(): boolean {
  if (params().has('reduce')) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function supportsWebGL(): boolean {
  if (params().has('nogl')) return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext;
  } catch {
    return false;
  }
}

/** True when the browser asks for less data. False where `navigator.connection` is undefined. */
export function saveDataRequested(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

/** Phone-width viewport: the same < 640 px threshold `isLowEnd()` uses, read from a media query. */
export function isPhoneViewport(): boolean {
  return window.matchMedia('(max-width: 639.98px)').matches;
}

/** `?lite` forces the poster, so the cheap path can be tested on a desktop. */
export function liteRequested(): boolean {
  return params().has('lite');
}

/** Everything `sceneMode()` needs, read in the browser at the moment of decision. */
export function sceneProbe(): SceneProbe {
  return {
    webgl: supportsWebGL(),
    reducedMotion: prefersReducedMotion(),
    saveData: saveDataRequested(),
    phoneViewport: isPhoneViewport(),
    lite: liteRequested(),
  };
}

/** Cheap heuristic for "skip the particle layer". */
export function isLowEnd(): boolean {
  const cores = navigator.hardwareConcurrency ?? 8;
  return cores <= 4 || window.innerWidth < 640;
}

export function devicePixelRatioCapped(): number {
  const cap = window.innerWidth < 768 ? 1 : 1.5;
  return Math.min(window.devicePixelRatio || 1, cap);
}

/** Run after first paint and when the main thread is idle. */
export function onIdle(fn: () => void, timeout = 1500): void {
  const go = () => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(() => fn(), { timeout });
    else w.setTimeout(fn, 200);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/** Opt-in pacing for `visibleLoop`. Without it the loop runs every refresh and never pauses. */
export type LoopOptions = {
  /** Minimum ms between rendered frames; 0 or absent renders every refresh. */
  minFrameMs?: number;
  /** Pause after this many ms without input; 0 or absent never pauses. */
  idleMs?: number;
};

/** Events that count as the reader being present. */
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'scroll', 'keydown', 'touchstart'] as const;

/**
 * Drives a render loop that only runs while `el` is on screen and the tab
 * is visible. Returns a function that stops everything.
 *
 * With `opts.minFrameMs` it still requests every animation frame but skips `tick` until the
 * interval has passed; `dt` is measured from the last rendered frame. With `opts.idleMs` it
 * stops requesting frames after that long without input and leaves the last frame on screen.
 * Input, the tab becoming visible and the element scrolling back into view all restart it
 * through `onWake`, so `dt` starts fresh and the idle clock resets.
 */
export function visibleLoop(el: Element, tick: (dt: number) => void, opts: LoopOptions = {}): () => void {
  const minFrameMs = opts.minFrameMs ?? 0;
  const idleMs = opts.idleMs ?? 0;
  let visible = true;
  let hidden = document.hidden;
  let raf = 0;
  let { lastInput, lastRendered: last } = onWake(performance.now());

  const frame = (now: number) => {
    raf = 0;
    if (!visible || hidden) return;
    // Paused: request nothing, so the last frame stays on screen until input wakes the loop.
    if (isIdle(now, lastInput, idleMs)) return;
    if (shouldRender(now, last, minFrameMs)) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      tick(dt);
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf || !visible || hidden) return;
    ({ lastInput, lastRendered: last } = onWake(performance.now()));
    raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
      start();
    },
    { threshold: 0 },
  );
  io.observe(el);

  const onVis = () => {
    hidden = document.hidden;
    start();
  };
  document.addEventListener('visibilitychange', onVis);

  // While the loop runs, input only moves the idle clock; `start` is a no-op then and `last`
  // is left alone, so the frame cap is not defeated by a stream of pointer events.
  const onInput = () => {
    lastInput = performance.now();
    start();
  };
  if (idleMs > 0) for (const type of INPUT_EVENTS) window.addEventListener(type, onInput, { passive: true });
  start();

  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    if (idleMs > 0) for (const type of INPUT_EVENTS) window.removeEventListener(type, onInput);
    if (raf) cancelAnimationFrame(raf);
    visible = false;
  };
}
