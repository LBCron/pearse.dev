import { getCollection } from 'astro:content';
import { absoluteUrl } from './site';
import { postPath } from './posts';
import { getVisibleProjects } from './projects';
import { buildFeed, type FeedEntry } from './feed';

export type { FeedEntry } from './feed';

/** The social feed from the content collections; see buildFeed for the rules. */
export async function getFeedEntries(now = new Date()): Promise<FeedEntry[]> {
  const posts = await getCollection('posts');
  const social = await getCollection('social');
  // Visible only; buildFeed applies the same visibility rule again to its input.
  const projects = await getVisibleProjects();
  return buildFeed(
    posts.map((p) => ({
      id: p.id,
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      draft: p.data.draft,
      tags: p.data.tags,
      url: absoluteUrl(postPath(p)),
      body: p.body ?? '',
      data: p.data,
      social: p.data.social,
    })),
    social.map((p) => ({ id: p.id, ...p.data, body: p.body ?? '', data: p.data })),
    now,
    projects.map((p) => ({
      id: p.data.slug,
      title: p.data.title,
      category: p.data.category,
      clientPermission: p.data.clientPermission,
      url: absoluteUrl(`/work/${p.data.slug}/`),
      social: p.data.social,
      body: p.body ?? '',
      data: p.data,
    })),
  );
}
