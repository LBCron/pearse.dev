/**
 * The closing contact block of a case study (#103), as pure functions. No imports at all,
 * so `node --test` loads this file under type stripping like visibility.ts and
 * work-order.ts. The page passes `SITE.email` in rather than this file importing it.
 */

export type ContactVariant = 'private' | 'repo' | 'public';

/** Which closing block a case study gets: private code, a public repo, or public without a repo link. */
export function contactVariant(data: { visibility: string; repo?: string }): ContactVariant {
  if (data.visibility === 'private') return 'private';
  return data.repo ? 'repo' : 'public';
}

/** `mailto:<email>?subject=About%20<title>`, the title percent-encoded so `&` and `?` survive. */
export function contactHref(title: string, email: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(`About ${title}`)}`;
}
