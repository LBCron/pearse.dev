/**
 * Which hero/stack path a visitor gets, as a pure function of plain booleans, so the
 * components and node's test runner apply exactly the same rule. No `window`, `navigator`
 * or `matchMedia` here: the probes live in `src/scripts/env.ts` and run in the browser,
 * inside each component's deferral (`onIdle` for the hero, the IntersectionObserver for
 * the stack). Erasable TypeScript only, so it imports under Node 22 like `visibility.ts`.
 *
 * The full 3D scene is for capable, motion-tolerant desktop visitors. Everyone else keeps
 * the build-time SVG poster and never fetches three.js.
 */
export type SceneProbe = {
  /** A WebGL context can be created (and `?nogl` is absent). */
  webgl: boolean;
  /** `prefers-reduced-motion: reduce`, or `?reduce`. */
  reducedMotion: boolean;
  /** `navigator.connection.saveData === true`; false where the API does not exist. */
  saveData: boolean;
  /** Viewport narrower than 640 px (the `isLowEnd()` threshold), from a media query. */
  phoneViewport: boolean;
  /** The `?lite` query-string override. */
  lite: boolean;
};

export type SceneMode = 'gl' | 'poster';

/** `'gl'` only when WebGL works and nothing asks for less; otherwise the poster stays. */
export function sceneMode(p: SceneProbe): SceneMode {
  if (!p.webgl || p.reducedMotion || p.saveData || p.phoneViewport || p.lite) return 'poster';
  return 'gl';
}
