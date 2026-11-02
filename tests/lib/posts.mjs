// Article frontmatter for the tests, read straight from the source files and classified with
// the same pure rule the pages use (isPublishedPost in src/lib/visibility.ts), like
// tests/lib/projects.mjs does for case studies. Not a test file itself: `npm test` only runs
// tests/**/*.test.mjs.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isPublishedPost } from '../../src/lib/visibility.ts';

const DIR = fileURLToPath(new URL('../../src/content/posts', import.meta.url));

/**
 * Every article, drafts and scheduled included, as { id, file, data, published }. `data` has
 * pubDate coerced to a Date and draft defaulted to false, as the collection schema does;
 * `published` is isPublishedPost at `now`.
 */
export function posts(now = new Date()) {
  return readdirSync(DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const raw = parse(readFileSync(`${DIR}/${f}`, 'utf8').split(/^---\s*$/m)[1]) ?? {};
      const data = { ...raw, draft: raw.draft ?? false, pubDate: new Date(raw.pubDate) };
      return { id: f.replace(/\.mdx?$/, ''), file: f, data, published: isPublishedPost(data, now) };
    });
}
