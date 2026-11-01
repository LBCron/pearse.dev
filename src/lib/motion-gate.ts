/**
 * Whether the GSAP motion chunk is worth fetching. A pure function of a root's `querySelector`
 * and one boolean, so the layout and node's test runner apply the same rule. No `window` or
 * `document` here: the layout passes `document` and `prefersReducedMotion()` (`src/scripts/env.ts`,
 * which already honours `?reduce`) from inside its `onIdle` callback. Erasable TypeScript only,
 * so it imports under Node 22 like `scene-gate.ts`.
 *
 * `MOTION_TARGETS` is the one list of what `src/scripts/motion.ts` animates. That script keeps
 * its own literals; `tests/motion-gate.test.mjs` fails when the two drift apart.
 */
export const MOTION_TARGETS: readonly string[] = ['[data-split]', '[data-reveal]', '.hero-letter:not(.is-space)'];

/** False for reduced motion, or when the page has nothing for the motion script to act on. */
export function shouldLoadMotion(root: Pick<ParentNode, 'querySelector'>, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  return MOTION_TARGETS.some((selector) => root.querySelector(selector) !== null);
}
