import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { DIAGRAM_NAMES } from './lib/diagrams';
import { PILLARS, POST_TAGS } from './lib/tags';
import { publishBlockers } from './lib/verify-marker';
import { META_DESCRIPTION_MAX, metaDescriptionLength } from './lib/seo';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    // The visible lede on the case-study page. Also the meta description unless `description` is set.
    oneLiner: z.string(),
    // Meta description, for a case study whose oneLiner is too long for one (#134).
    description: z.string().optional(),
    // An ongoing period is "<start with a four-digit year> – Present" (en dash, single spaces),
    // so the CV's start-only display and the /work/ start-year parser keep their year.
    period: z.string().refine((v) => !/present/i.test(v) || /^(?:[A-Z][a-z]{2} )?(?:19|20)\d{2} – Present$/.test(v), {
      message: 'an ongoing period must read "Mon YYYY – Present" or "YYYY – Present"',
    }),
    role: z.string().default('Sole engineer'),
    stack: z.array(z.string()),
    featured: z.boolean().default(false),
    order: z.number().int(),
    features: z.array(z.string()),
    hooks: z.array(z.string()),
    repo: z.string().url().optional(),
    live: z.string().url().optional(),
    visibility: z.enum(['public', 'private']),
    category: z.enum(['mts', 'client', 'tool', 'learning']),
    // Only meaningful for category 'client'; 'pending' hides the case study everywhere.
    clientPermission: z.enum(['pending', 'granted', 'anonymised']).default('pending'),
    // Names an architecture diagram component in src/components/diagrams/.
    diagram: z.enum(DIAGRAM_NAMES).optional(),
    // Social copy for the case study (ADR 0002). With it, a visible case study is a
    // `project` entry in /social.json on `date`; without it, the case study is not in the feed.
    social: z
      .object({
        date: z.coerce.date(),
        linkedin: z.string(),
        short: z.string().max(300),
      })
      .optional(),
    // Feature sections: parts of the product that once stood alone (e.g. a tool folded into
    // MTS Hub). Each renders as a "what it does" subsection with an anchor at #<id>.
    sections: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          title: z.string(),
          // Where the part came from, e.g. "Began as a standalone packing tool in Feb 2026". Describe the
          // feature, never a product name: MTS is two products (issue #39)..
          origin: z.string().optional(),
          summary: z.string(),
          features: z.array(z.string()).min(1),
          stack: z.array(z.string()).default([]),
          diagram: z.enum(DIAGRAM_NAMES).optional(),
        }),
      )
      .default([])
      .superRefine((sections, ctx) => {
        const seen = new Set<string>();
        sections.forEach((s, i) => {
          if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate section id "${s.id}"` });
          seen.add(s.id);
        });
      }),
  }).superRefine((d, ctx) => {
    // The page's meta description is `description ?? oneLiner`; the shared rule caps it (#134).
    const n = metaDescriptionLength(d.description ?? d.oneLiner);
    if (n > META_DESCRIPTION_MAX) {
      ctx.addIssue({
        code: 'custom',
        path: [d.description === undefined ? 'oneLiner' : 'description'],
        message: `"${d.slug}": meta description is ${n} chars, max ${META_DESCRIPTION_MAX}`,
      });
    }
  }),
});

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(META_DESCRIPTION_MAX),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // Closed vocabulary (src/lib/tags.ts): an unknown tag fails the build.
    tags: z.array(z.enum(POST_TAGS)).min(1),
    project: z.string().optional(),
    draft: z.boolean().default(false),
    social: z.object({
      linkedin: z.string(),
      short: z.string().max(300),
    }),
  }),
});

const now = defineCollection({
  loader: glob({ base: './src/content/now', pattern: '**/*.md' }),
  schema: z.object({
    updated: z.coerce.date(),
  }),
});

// Standalone posts: social copy with no article (ADR 0002). Body = LinkedIn copy.
// The first twelve were migrated from a JSON file by scripts/migrate-standalone.mjs; the files are now the source of truth.
const social = defineCollection({
  loader: glob({ base: './src/content/social', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    pillar: z.enum(PILLARS),
    format: z.string(),
    visual: z.string().default('none'),
    // draft: never in the social feed. approved: in the feed, even when dated in the future.
    status: z.enum(['draft', 'approved']).default('draft'),
    short: z.string().max(300),
    note: z.string().optional(),
  }).superRefine((d, ctx) => {
    // Fail fast on an approved post with a verify marker in its frontmatter. Only an early
    // warning: buildFeed (assertPublishable) is the guarantee, and it checks the body too.
    if (d.status !== 'approved') return;
    for (const path of publishBlockers('standalone', d, '')) {
      ctx.addIssue({ code: 'custom', path: path.split('.'), message: `approved standalone post still has a verify marker in ${path}` });
    }
  }),
});

// CV facts that live nowhere else on the site. Everything else on /cv/ comes from
// SITE, INTERESTS, the projects collection and MARQUEE. Wording follows docs/profile/.
const entry = z.object({
  title: z.string(),
  organisation: z.string(),
  period: z.string(),
  location: z.string().optional(),
  summary: z.string().optional(),
  bullets: z.array(z.string()),
  // A job's products, each with its own bullets, rendered as sub-headings under the job.
  // MTS is exactly two products (issue #39); folded tools are bullets under them, never products.
  products: z
    .array(z.object({ name: z.string(), summary: z.string().optional(), bullets: z.array(z.string()).min(1) }))
    .default([]),
});

const cv = defineCollection({
  loader: glob({ base: './src/content/cv', pattern: '**/*.md' }),
  schema: z.object({
    headline: z.string(),
    experience: z.array(entry),
    education: z.array(entry),
    // "Before software": the skating career, rendered after Education.
    before: z.array(entry).default([]),
    // Optional on purpose: the section only renders once a language list is confirmed.
    languages: z.array(z.object({ language: z.string(), level: z.string() })).default([]),
  }),
});

export const collections = { projects, posts, now, social, cv };
