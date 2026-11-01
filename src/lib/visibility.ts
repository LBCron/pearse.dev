/**
 * The publish and visibility rules as pure functions of frontmatter data, with no
 * `astro:content` import, so build scripts (scripts/og-pages.mjs) apply exactly the
 * rules the pages do. `src/lib/posts.ts` and `src/lib/projects.ts` wrap these.
 */

/** Published = not a draft and not dated in the future at build time. */
export function isPublishedPost(data: { draft?: boolean; pubDate: Date }, now = new Date()): boolean {
  return !data.draft && data.pubDate.getTime() <= now.getTime();
}

/**
 * Visible = not a client case study awaiting permission. Only `category: client`
 * is gated by `clientPermission`, which defaults to 'pending' when absent.
 */
export function isVisibleProject(data: { category: string; clientPermission?: string }): boolean {
  return data.category !== 'client' || (data.clientPermission ?? 'pending') !== 'pending';
}

/**
 * The posts shown under "Writing about this project" on a case study: those whose
 * `project` is `slug` and that are published at `now` (isPublishedPost), newest first.
 * Generic over the entry, so the page passes collection entries and tests pass plain objects.
 */
export function relatedPosts<T extends { data: { draft?: boolean; pubDate: Date; project?: string } }>(
  posts: readonly T[],
  slug: string,
  now = new Date(),
): T[] {
  return posts
    .filter((p) => p.data.project === slug && isPublishedPost(p.data, now))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}
