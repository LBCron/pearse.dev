// Pure social-feed logic. Its only import is the pure visibility module, so node:test
// can load it with type stripping (hence the explicit .ts extension).
import { isPublishedPost, isVisibleProject } from './visibility.ts';
// src/lib/social.ts feeds it from the content collections.

export interface Copy {
  linkedin: string;
  short: string;
}

export interface ArticleInput {
  id: string;
  title: string;
  pubDate: Date;
  draft: boolean;
  tags: string[];
  /** Absolute URL of the article page. */
  url: string;
  /** Markdown body of the article, scanned for verify markers. */
  body: string;
  social: Copy;
}

export interface StandaloneInput {
  id: string;
  title: string;
  date: Date;
  pillar: string;
  format: string;
  visual: string;
  status: 'draft' | 'approved';
  short: string;
  /** Markdown body: the LinkedIn copy. */
  body: string;
}

export interface ProjectInput {
  /** The case study slug. */
  id: string;
  title: string;
  category: string;
  clientPermission?: string;
  /** Absolute URL of the case study page. */
  url: string;
  /** Absent: the case study is not in the feed. */
  social?: Copy & { date: Date };
}

interface BaseEntry {
  id: string;
  title: string;
  /** YYYY-MM-DD (UTC). */
  date: string;
  published: boolean;
  status: 'approved';
  social: Copy;
}

export interface ArticleEntry extends BaseEntry {
  kind: 'article';
  /** Legacy alias of `id`, kept for existing feed consumers. */
  slug: string;
  /** Legacy alias of `date`, kept for existing feed consumers. */
  pubDate: string;
  url: string;
  tags: string[];
}

export interface StandaloneEntry extends BaseEntry {
  kind: 'standalone';
  pillar: string;
  format: string;
  visual: string;
}

export interface ProjectEntry extends BaseEntry {
  kind: 'project';
  category: string;
  url: string;
}

export type FeedEntry = ArticleEntry | StandaloneEntry | ProjectEntry;


const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The social feed: every non-draft article (published or scheduled), every approved
 * standalone post and every visible case study with social copy, oldest first; on the
 * same date articles come first, then standalone posts, then case studies.
 * Standalone posts have no page, so `published` is always true and they carry no `url`.
 * A visible case study's page is always built, so its `published` is always true too.
 * Throws if a non-draft article (published or scheduled, whatever its date), an approved
 * standalone post or a case study still has a verify marker in its copy. Draft articles are exempt.
 */
export function buildFeed(
  articles: ArticleInput[],
  standalone: StandaloneInput[],
  now = new Date(),
  projects: ProjectInput[] = [],
): FeedEntry[] {
  const a: ArticleEntry[] = articles
    .filter((p) => !p.draft)
    .map((p) => {
      // Not gated on pubDate: ADR 0003 builds a future article only after its date, so
      // this is the only check that sees its body before it goes live.
      if (`${p.body}\n${p.social.linkedin}\n${p.social.short}`.includes('[VERIFY')) {
        throw new Error(`Article "${p.id}" still has a [VERIFY] marker; resolve it or set draft: true.`);
      }
      const date = day(p.pubDate);
      return {
        kind: 'article',
        id: p.id,
        slug: p.id,
        title: p.title,
        date,
        pubDate: date,
        url: p.url,
        published: isPublishedPost(p, now),
        status: 'approved',
        tags: p.tags,
        social: { linkedin: p.social.linkedin.trim(), short: p.social.short.trim() },
      };
    });

  const s: StandaloneEntry[] = standalone
    .filter((p) => p.status === 'approved')
    .map((p) => {
      if (p.body.includes('[VERIFY')) {
        throw new Error(`Standalone post "${p.id}" is approved but its body still has a [VERIFY] marker; resolve it or set status: draft.`);
      }
      return {
        kind: 'standalone',
        id: p.id,
        title: p.title,
        date: day(p.date),
        pillar: p.pillar,
        format: p.format,
        visual: p.visual,
        published: true,
        status: 'approved',
        social: { linkedin: p.body.trim(), short: p.short.trim() },
      };
    });

  const p: ProjectEntry[] = projects
    .filter((c) => c.social && isVisibleProject(c))
    .map((c) => {
      const social = c.social!;
      if (`${social.linkedin}\n${social.short}`.includes('[VERIFY')) {
        throw new Error(`Case study "${c.id}" has social copy with a [VERIFY] marker; resolve it or remove the social block.`);
      }
      return {
        kind: 'project',
        id: c.id,
        title: c.title,
        date: day(social.date),
        category: c.category,
        url: c.url,
        published: true,
        status: 'approved',
        social: { linkedin: social.linkedin.trim(), short: social.short.trim() },
      };
    });

  // Array.prototype.sort is stable: articles were added first, so they win date ties.
  return [...a, ...s, ...p].sort((x, y) => x.date.localeCompare(y.date));
}
