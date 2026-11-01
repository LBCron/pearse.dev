/**
 * The closed vocabulary for a post's `tags:` frontmatter. The posts schema in
 * src/content.config.ts validates against it, so an unknown tag fails the build.
 * Each tag belongs to exactly one content pillar (the four named in the README).
 * Kept here (plain TS) so the content schema and the tests can both import it.
 *
 * To add a tag: add it here with its pillar, and make sure at least two posts carry it
 * (tests/post-tags.test.mjs fails on an unused or one-off tag).
 */
export const PILLARS = ['Platform building (Django)', 'Self-hosted AI in production', 'Agentic engineering', 'Career'] as const;
export type Pillar = (typeof PILLARS)[number];

export const TAG_PILLAR = {
  django: 'Platform building (Django)',
  architecture: 'Platform building (Django)',
  migration: 'Platform building (Django)',
  privacy: 'Platform building (Django)',
  'self-hosted-ai': 'Self-hosted AI in production',
  'agentic-engineering': 'Agentic engineering',
  career: 'Career',
} as const satisfies Record<string, Pillar>;

export const POST_TAGS = Object.keys(TAG_PILLAR) as [keyof typeof TAG_PILLAR, ...(keyof typeof TAG_PILLAR)[]];
export type PostTag = keyof typeof TAG_PILLAR;
