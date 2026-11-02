/**
 * Article series (issue #148): an optional `series` + `seriesOrder` pair that ties articles
 * into one ordered story, and the "Part n of m" box on each published part.
 *
 * Pure, with no `astro:content` import and only erasable TypeScript, so `node --test` imports
 * it directly (tests/series.test.mjs). The zod rules live here too and the posts schema in
 * src/content.config.ts spreads them in, so the rules are written once.
 */
import { z } from 'astro/zod';
import { isPublishedPost } from './visibility.ts';

/**
 * Series slug -> display title. The only place series copy is written: it may name only the
 * two MTS products (ADR 0006), and tests/series.test.mjs pins the values.
 */
export const SERIES_TITLES = { 'mts-hub': 'MTS Hub', 'wetlabs-app': 'wetlabs.app' } as const;
export type SeriesSlug = keyof typeof SERIES_TITLES;

export const SERIES_SLUGS = Object.keys(SERIES_TITLES) as [SeriesSlug, ...SeriesSlug[]];

/** The display title of a series. Throws on an unknown slug, so a hand-built entry cannot bypass the enum. */
export function seriesTitle(slug: string): string {
  if (!Object.hasOwn(SERIES_TITLES, slug)) throw new Error(`unknown series "${slug}"; known: ${SERIES_SLUGS.join(', ')}`);
  return SERIES_TITLES[slug as SeriesSlug];
}

/** The per-entry fields, spread into the posts schema's `z.object({...})`. */
export const seriesFields = {
  series: z.enum(SERIES_SLUGS).optional(),
  seriesOrder: z.number().int().positive().optional(),
};

/** Per-entry rule: an article has both `series` and `seriesOrder`, or neither. For `.superRefine`. */
export function refineSeries(d: { series?: string; seriesOrder?: number }, ctx: z.RefinementCtx): void {
  if (d.series !== undefined && d.seriesOrder === undefined) {
    ctx.addIssue({ code: 'custom', path: ['seriesOrder'], message: `"series: ${d.series}" needs a seriesOrder` });
  }
  if (d.series === undefined && d.seriesOrder !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['series'], message: 'seriesOrder needs a series' });
  }
}

/** The fragment on its own: exactly what the posts schema enforces for the two fields. */
export const seriesSchema = z.object(seriesFields).superRefine(refineSeries);

export interface SeriesEntry {
  id: string;
  data: { title: string; pubDate: Date; draft?: boolean; series?: string; seriesOrder?: number };
}

/**
 * Cross-entry rule zod cannot express: no two articles in one series share a `seriesOrder`.
 * Pass every article (published, scheduled and draft) so a clash between drafts fails the
 * build before either goes live. The error names both article ids.
 */
export function validateSeries(entries: readonly SeriesEntry[]): void {
  const seen = new Map<string, string>(); // "<series>#<order>" -> id
  for (const e of entries) {
    const { series, seriesOrder } = e.data;
    if (series === undefined) continue;
    seriesTitle(series);
    const key = `${series}#${seriesOrder}`;
    const other = seen.get(key);
    if (other !== undefined) {
      throw new Error(`series "${series}": "${other}" and "${e.id}" both have seriesOrder ${seriesOrder}`);
    }
    seen.set(key, e.id);
  }
}

export interface SeriesNav {
  title: string;
  /** 1-based position of the current article among the published parts. */
  index: number;
  /** Number of published parts. Unpublished parts are never counted. */
  total: number;
  parts: { id: string; title: string; current: boolean }[];
}

/**
 * The series box for `current`: its published parts (isPublishedPost at `now`, the page's own
 * clock) in `seriesOrder` order. `null` when `current` has no series, is not itself published,
 * or fewer than two parts are published. Scheduled and draft parts leave no trace in the result.
 */
export function seriesNav(current: SeriesEntry, entries: readonly SeriesEntry[], now = new Date()): SeriesNav | null {
  const slug = current.data.series;
  if (slug === undefined) return null;
  const title = seriesTitle(slug);
  const parts = entries
    .filter((e) => e.data.series === slug && isPublishedPost(e.data, now))
    .sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
  const i = parts.findIndex((p) => p.id === current.id);
  if (parts.length < 2 || i === -1) return null;
  return {
    title,
    index: i + 1,
    total: parts.length,
    parts: parts.map((p) => ({ id: p.id, title: p.data.title, current: p.id === current.id })),
  };
}
