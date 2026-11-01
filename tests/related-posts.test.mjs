// Asserts the "Writing about this project" rule (relatedPosts in src/lib/visibility.ts) on the
// real article frontmatter with an injected `now`, never the wall clock, so it holds on every
// daily rebuild; and that every article's `project:` names a case study that exists.
// Reads source files only, no dist/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { relatedPosts } from '../src/lib/visibility.ts';
import { projects } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const DIR = 'src/content/posts';

/** Every article as { id, data }, with pubDate coerced to a Date as the collection schema does. */
function posts() {
  return readdirSync(DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const data = parse(readFileSync(join(DIR, f), 'utf8').split(/^---\s*$/m)[1]);
      return { id: f.replace(/\.mdx?$/, ''), data: { ...data, pubDate: new Date(data.pubDate) } };
    });
}

const titles = (slug, now) => relatedPosts(posts(), slug, new Date(now)).map((p) => p.data.title);

test('relatedPosts: matches the slug, drops drafts and future posts, sorts newest first', () => {
  const p = (id, pubDate, project, draft = false) => ({ id, data: { pubDate: new Date(pubDate), project, draft } });
  const all = [p('old', '2026-01-01', 'x'), p('new', '2026-03-01', 'x'), p('draft', '2026-02-01', 'x', true), p('future', '2026-06-01', 'x'), p('other', '2026-02-01', 'y'), p('none', '2026-02-01')];
  assert.deepEqual(relatedPosts(all, 'x', new Date('2026-04-01')).map((e) => e.id), ['new', 'old']);
  assert.deepEqual(relatedPosts(all, 'x', new Date('2026-07-01')).map((e) => e.id), ['future', 'new', 'old']);
  assert.deepEqual(relatedPosts(all, 'z', new Date('2026-07-01')), []);
});

test('relatedPosts: agentic-workflow has no related posts before its article goes live', () => {
  assert.deepEqual(titles('agentic-workflow', '2026-11-01T12:00:00Z'), []);
});

test('relatedPosts: agentic-workflow has exactly its article once it is live', () => {
  assert.deepEqual(titles('agentic-workflow', '2026-11-18T12:00:00Z'), ['An agentic engineering workflow that actually ships']);
});

test('relatedPosts: the two client case studies have none while their articles are drafts', () => {
  for (const slug of ['east-coast-blinds', 'dublin-plein-air']) {
    assert.deepEqual(titles(slug, '2026-12-09T12:00:00Z'), [], slug);
  }
});

test("every article's project names a case study source file", () => {
  const slugs = new Set(projects().map((p) => p.slug));
  const linked = posts().filter((p) => p.data.project !== undefined);
  assert.ok(linked.length > 0, 'no article names a project');
  for (const p of linked) {
    assert.ok(slugs.has(p.data.project), `${p.id}: project "${p.data.project}" has no file in src/content/projects/`);
  }
});
