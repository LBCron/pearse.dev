/**
 * Frame pacing and hover rules for the hero loop, as pure functions of plain numbers and
 * strings, so the browser code in `src/scripts/` and node's test runner apply exactly the
 * same decisions. No `window`, `document` or `performance` here: the caller passes in the
 * clock. Erasable TypeScript only (no enum, namespace or parameter properties), so it
 * imports under Node 22 like `scene-gate.ts`.
 */

/** Phones and low-end devices render at most 30 frames per second. */
export const CAPPED_FRAME_MS = 1000 / 30;

/** Input-free time after which the loop stops requesting frames. */
export const IDLE_MS = 20000;

export type Pacing = {
  /** Minimum gap between rendered frames in ms; 0 means every refresh. */
  minFrameMs: number;
  /** Input-free time in ms after which the loop pauses. */
  idleMs: number;
};

/** About 33.3 ms between frames on a coarse pointer or a low-end device, otherwise uncapped. */
export function pacingFor(p: { coarse: boolean; lowEnd: boolean }): Pacing {
  return { minFrameMs: p.coarse || p.lowEnd ? CAPPED_FRAME_MS : 0, idleMs: IDLE_MS };
}

/** True when enough time has passed since the last rendered frame. Always true when uncapped. */
export function shouldRender(now: number, lastRendered: number, minFrameMs: number): boolean {
  if (minFrameMs <= 0) return true;
  return now - lastRendered >= minFrameMs;
}

/** True once `idleMs` has passed with no input. An `idleMs` of 0 or less disables the pause. */
export function isIdle(now: number, lastInput: number, idleMs: number): boolean {
  if (idleMs <= 0) return false;
  return now - lastInput >= idleMs;
}

export type WakeState = { lastInput: number; lastRendered: number };

/**
 * The state every restart path resets to: input, the tab becoming visible, and the hero
 * scrolling back into view. Resetting `lastInput` stops the loop pausing again on its next
 * frame; resetting `lastRendered` keeps the first `dt` after a restart at zero.
 */
export function onWake(now: number): WakeState {
  return { lastInput: now, lastRendered: now };
}

/**
 * What a pointer move does to the bulge: 1 inside the canvas, 0 outside, `null` to ignore.
 * Touch is ignored for hover and tilt, because a finger leaves no `pointerleave` behind.
 */
export function hoverForMove(p: { pointerType: string; inside: boolean }): 0 | 1 | null {
  if (p.pointerType === 'touch') return null;
  return p.inside ? 1 : 0;
}
