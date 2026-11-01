/**
 * The social feed: every non-draft article (including scheduled ones), every
 * approved standalone post and every visible case study with social copy, oldest first.
 * An n8n workflow reads this to schedule social posts. A scheduled article is a stub of
 * `kind`, `id`, `date` and `published: false`, with no title, url or copy; the daily
 * rebuild on its pubDate turns it into the full entry with `published: true`, so a
 * scheduler can never link early. Standalone posts have no page and no `url`. Visible case studies
 * with a `social` block are `project` entries linking their /work/ page; the
 * scheduler does not offer them yet (automation/n8n/select.mjs isEligible).
 */
import type { APIRoute } from 'astro';
import { getFeedEntries } from '../lib/social';

export const GET: APIRoute = async () => {
  const body = await getFeedEntries();
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
