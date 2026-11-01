// The verify-marker rule (GLOSSARY "Verify marker"): content that still has a marker is never
// approved. Pure and import-free, so node:test can load it with type stripping; buildFeed
// (src/lib/feed.ts) enforces it at build time and the content schema uses it to fail fast.

/** The marker prefix, matched literally and case-sensitively. The only definition in the repository. */
export const VERIFY_MARKER = '[VERIFY';

/** The content kinds that can be published: the `kind` of their /social.json entries. */
export type PublishableKind = 'article' | 'standalone' | 'project';

/**
 * Top-level frontmatter fields the publish check skips, per kind. Only internal fields that are
 * never rendered, on a page or in /social.json, belong here. Adding one is a deliberate change.
 */
export const VERIFY_EXEMPT: Readonly<Record<PublishableKind, readonly string[]>> = {
  article: [],
  // The standalone reviewer note: never in the feed (README "Standalone posts").
  standalone: ['note'],
  project: [],
};

const HINT: Readonly<Record<PublishableKind, string>> = {
  article: 'resolve it or set draft: true',
  standalone: 'resolve it or set status: draft',
  project: 'resolve it, since a visible case study is always built',
};

/**
 * Dotted paths of every string under `value` that contains the marker, walking objects and
 * arrays recursively: keys and array indices joined by dots (`sections.2.summary`), prefixed
 * by `path`. A string `value` is reported as `path` itself. Non-strings (dates, numbers,
 * booleans, null) are skipped.
 */
export function findVerifyMarkers(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return value.includes(VERIFY_MARKER) ? [path] : [];
  if (value === null || typeof value !== 'object' || value instanceof Date) return [];
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  return entries.flatMap(([key, v]) => findVerifyMarkers(v, path ? `${path}.${key}` : key));
}

/** The marker paths that stop a publish: all of `data` minus the kind's exempt fields, then `body`. */
export function publishBlockers(kind: PublishableKind, data: Readonly<Record<string, unknown>>, body: string): string[] {
  const exempt = new Set(VERIFY_EXEMPT[kind]);
  const checked = Object.fromEntries(Object.entries(data).filter(([key]) => !exempt.has(key)));
  return [...findVerifyMarkers(checked), ...findVerifyMarkers(body, 'body')];
}

/**
 * Throws if the entry still has a verify marker in any frontmatter field (except VERIFY_EXEMPT)
 * or its body. The message names the kind, the id and every hit path, never the marked text,
 * the way scripts/gate.mjs reports. Missing data or body throws too, so a caller cannot skip the check.
 */
export function assertPublishable(
  kind: PublishableKind,
  id: string,
  data: Readonly<Record<string, unknown>>,
  body: string,
): void {
  if (data === null || typeof data !== 'object' || Array.isArray(data) || typeof body !== 'string') {
    throw new TypeError(`${kind} "${id}" has no frontmatter data or body to check for verify markers.`);
  }
  const hits = publishBlockers(kind, data, body);
  if (hits.length) {
    throw new Error(`${kind} "${id}" still has a verify marker in ${hits.join(', ')}; ${HINT[kind]}.`);
  }
}
