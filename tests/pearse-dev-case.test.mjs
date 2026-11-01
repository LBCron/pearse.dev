// Asserts the pearse.dev case study (#97): a public tool case study that links this site's
// own repository, draws its two-lane pipeline diagram and links the agentic-workflow case
// study from its colophon; and that the rebuild article links to it and shows "Updated".
// Reads dist/ (`npm test`'s pretest build) and the case study's frontmatter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { diagramSvgs, textOf } from './lib/diagrams.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const REPO = 'https://github.com/pearsedarcy/pearse.dev';
const data = parse(readFileSync('src/content/projects/pearse-dev.md', 'utf8').split(/^---$/m)[1]);
const html = readFileSync('dist/work/pearse-dev/index.html', 'utf8');
const post = readFileSync('dist/writing/why-i-rebuilt-pearse-dev/index.html', 'utf8');

test('pearse-dev is a public, non-featured tool case study that links its own repo', () => {
  assert.equal(data.category, 'tool');
  assert.equal(data.visibility, 'public');
  assert.equal(data.featured, false);
  assert.equal(data.repo, REPO);
  assert.ok(html.includes(`href="${REPO}"`), 'repo link on the page');
});

test('pearse-dev draws one two-lane pipeline diagram', () => {
  const svgs = diagramSvgs(html);
  assert.equal(svgs.length, 1);
  const text = textOf(svgs[0]);
  for (const label of ['Markdown', 'Daily rebuild', 'Check job', 'Astro build', 'GitHub Pages', 'Cloudflare', 'Social feed', 'n8n', 'Telegram', 'LinkedIn']) {
    assert.ok(text.includes(label), `diagram names ${label}`);
  }
  for (const step of ['type check', 'links', 'Lighthouse', 'tests', 'gate']) assert.ok(text.includes(step), `check job lists ${step}`);
  // Both lanes are drawn as labelled groups.
  assert.match(text, /Site build/);
  assert.match(text, /Social posting/);
});

test('pearse-dev colophon links the agentic-workflow case study', () => {
  assert.ok(html.includes('id="colophon"') || /<h2[^>]*>\s*Colophon\s*<\/h2>/.test(html), 'colophon heading');
  assert.ok(html.includes('href="/work/agentic-workflow/"'), 'agentic-workflow link');
});

test('the rebuild article links the case study and shows an Updated line', () => {
  assert.ok(post.includes('href="/work/pearse-dev/"'));
  assert.match(post, />Updated [^<]+</);
});
