// The meta description length rule, shared by the content schemas (src/content.config.ts) and
// the SEO contract test over dist/ (tests/seo.test.mjs), so both count the same way (#134).

/** Longest meta description, in characters. Search results and link previews cut longer ones. */
export const META_DESCRIPTION_MAX = 160;

/**
 * Length of a meta description, measured on the decoded string (no HTML entities) as the JS
 * string length, which is what zod's `.max` counts.
 */
export function metaDescriptionLength(text: string): number {
  return text.length;
}

/** True when a decoded meta description is non-empty and within META_DESCRIPTION_MAX. */
export function isValidMetaDescription(text: string): boolean {
  const n = metaDescriptionLength(text.trim());
  return n > 0 && n <= META_DESCRIPTION_MAX;
}
