/**
 * The closing contact block of a case study (#103), as a pure function. No imports at all,
 * so `node --test` loads this file under type stripping like visibility.ts and
 * work-order.ts. Its link, "About <title>", comes from `aboutProjectHref` in `./mailto.ts`,
 * which owns every mailto on the site (#153).
 */

export type ContactVariant = 'private' | 'repo' | 'public';

/** Which closing block a case study gets: private code, a public repo, or public without a repo link. */
export function contactVariant(data: { visibility: string; repo?: string }): ContactVariant {
  if (data.visibility === 'private') return 'private';
  return data.repo ? 'repo' : 'public';
}
