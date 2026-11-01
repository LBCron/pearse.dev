// Asserts the client-permission rule: the pure function on every flag value, client case
// studies with clientPermission: granted present everywhere in the build, and pending ones
// (none today; the list is derived from the source files) absent from it.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVisibleProject } from '../src/lib/visibility.ts';
import { pendingSlugs, projects } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const HIDDEN = pendingSlugs();
// Client case studies whose permission was granted on 2026-10-28 (#40). Hard-coded on purpose.
const GRANTED = ['east-coast-blinds', 'dublin-plein-air', 'm-buildz', 'pauldarcy-ie'];

test('isVisibleProject: only a client case study without permission is hidden', () => {
  assert.equal(isVisibleProject({ category: 'client', clientPermission: 'granted' }), true);
  assert.equal(isVisibleProject({ category: 'client', clientPermission: 'anonymised' }), true);
  assert.equal(isVisibleProject({ category: 'client', clientPermission: 'pending' }), false);
  assert.equal(isVisibleProject({ category: 'client' }), false, 'absent flag defaults to pending');
  for (const category of ['mts', 'tool', 'learning']) {
    assert.equal(isVisibleProject({ category, clientPermission: 'pending' }), true, category);
    assert.equal(isVisibleProject({ category }), true, category);
  }
});

test('every client case study states its permission explicitly', () => {
  for (const p of projects().filter((x) => x.category === 'client')) {
    assert.ok(['pending', 'granted', 'anonymised'].includes(p.clientPermission), `${p.file}: clientPermission`);
  }
});

test('the granted client case studies are granted in source', () => {
  const bySlug = new Map(projects().map((p) => [p.slug, p]));
  for (const slug of GRANTED) {
    assert.equal(bySlug.get(slug)?.category, 'client', slug);
    assert.equal(bySlug.get(slug)?.clientPermission, 'granted', slug);
  }
});

test('granted client case studies have a page, a sitemap entry and a card under Client work on /work/', () => {
  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  const index = readFileSync('dist/work/index.html', 'utf8');
  // The /work/ index renders one <section> per category, headed by an h2 with id group-<category>.
  const client = index.split(/<section\b/).find((sec) => sec.includes('id="group-client"')) ?? '';
  assert.ok(client, 'no Client work section on /work/');
  for (const slug of GRANTED) {
    assert.equal(existsSync(`dist/work/${slug}/index.html`), true, slug);
    assert.ok(sitemap.includes(`/work/${slug}/`), `${slug} in sitemap`);
    assert.ok(client.includes(`href="/work/${slug}/"`), `${slug} under Client work`);
  }
});

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

test('no page directory for pending client case studies', () => {
  for (const slug of HIDDEN) assert.equal(existsSync(`dist/work/${slug}`), false, slug);
});

test('no href to pending case studies in any html', () => {
  for (const file of htmlFiles('dist')) {
    const html = readFileSync(file, 'utf8');
    for (const slug of HIDDEN) assert.equal(html.includes(`/work/${slug}`), false, `${file} links ${slug}`);
  }
});

test('pending case studies are absent from the sitemap', () => {
  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  for (const slug of HIDDEN) assert.equal(sitemap.includes(slug), false, slug);
});

// Expected home grid, in order: the visible featured projects by `order`, then the first
// four visible non-featured by `order`. Hard-coded on purpose; update it when content changes.
const HOME_SLUGS = ['mts-hub', 'wetlabs-app', 'east-coast-blinds', 'dublin-plein-air', 'agentic-workflow', 'mx-creative-keypad'];

test('home grid shows exactly the expected six cards, in order', () => {
  // Selector: anchors with class "card" linking to /work/<slug>/ inside <section id="work">.
  const html = readFileSync('dist/index.html', 'utf8');
  const section = html.match(/<section id="work"[\s\S]*?<\/section>/)?.[0] ?? '';
  const cards = (section.match(/<a [^>]*href="\/work\/[a-z0-9-]+\/"[^>]*>/g) ?? []).filter((a) => /class="[^"]*\bcard\b/.test(a));
  assert.deepEqual(cards.map((a) => a.match(/href="\/work\/([a-z0-9-]+)\//)[1]), HOME_SLUGS);
});

test('/work/ index lists only visible projects and its count matches', () => {
  const total = readdirSync('src/content/projects').filter((f) => /\.mdx?$/.test(f)).length;
  const visible = total - HIDDEN.length;
  const html = readFileSync('dist/work/index.html', 'utf8');
  const hrefs = new Set(html.match(/href="\/work\/[a-z0-9-]+\/"/g) ?? []);
  assert.equal(hrefs.size, visible);
  const count = Number(html.match(/<b>(\d+)<\/b>\s+projects/)?.[1]);
  assert.equal(count, visible);
});
