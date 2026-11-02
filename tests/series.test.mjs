// Article series (issue #148). The first half imports src/lib/series.ts directly and runs it on
// made-up fixtures (no dist/, no real draft titles). The second half checks dist/ against the
// real frontmatter (tests/lib/posts.mjs): the number of series boxes, what each box lists, and
// that no draft or scheduled series part leaks its title or URL into the built site.
// The dist half relies on `npm test`'s pretest build; run `npm run build` first when running
// this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERIES_TITLES, seriesNav, seriesSchema, seriesTitle, validateSeries } from '../src/lib/series.ts';
import { find, parseHtml, text } from './lib/html.mjs';
import { posts } from './lib/posts.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

// ---- pure functions, fixtures only ------------------------------------------------------------

const NOW = new Date('2030-06-01T12:00:00Z');
const entry = (id, title, pubDate, extra = {}) => ({ id, data: { title, pubDate: new Date(pubDate), draft: false, ...extra } });
const part = (id, title, pubDate, seriesOrder, extra = {}) => entry(id, title, pubDate, { series: 'mts-hub', seriesOrder, ...extra });

const liveA = part('fixture-live-a', 'Fixture live part A', '2030-01-01', 1);
const scheduled = part('fixture-scheduled-b', 'Fixture scheduled part B', '2030-09-01', 2);
const draft = part('fixture-draft-c', 'Fixture draft part C', '2030-02-01', 3, { draft: true });
const liveD = part('fixture-live-d', 'Fixture live part D', '2030-03-01', 4);
const loner = entry('fixture-no-series', 'Fixture article without a series', '2030-01-15');

test('seriesNav: null for an article without a series', () => {
  assert.equal(seriesNav(loner, [loner, liveA, liveD], NOW), null);
});

test('seriesNav: null when the series has 0 or 1 published parts', () => {
  // 0 published: the current article is scheduled itself.
  assert.equal(seriesNav(scheduled, [scheduled, draft], NOW), null);
  // 1 published, the rest unpublished.
  assert.equal(seriesNav(liveA, [liveA, scheduled, draft, loner], NOW), null);
});

test('seriesNav: lists only published parts in seriesOrder order and counts only them', () => {
  // Out of order on purpose: seriesOrder, not input order, decides.
  const all = [liveD, draft, loner, scheduled, liveA];
  const a = seriesNav(liveA, all, NOW);
  const d = seriesNav(liveD, all, NOW);
  assert.deepEqual(a, {
    title: 'MTS Hub',
    index: 1,
    total: 2,
    parts: [
      { id: 'fixture-live-a', title: 'Fixture live part A', current: true },
      { id: 'fixture-live-d', title: 'Fixture live part D', current: false },
    ],
  });
  assert.equal(d.index, 2);
  assert.equal(d.total, 2);
  assert.deepEqual(d.parts.map((p) => [p.id, p.current]), [['fixture-live-a', false], ['fixture-live-d', true]]);
  for (const nav of [a, d]) {
    const json = JSON.stringify(nav);
    for (const hidden of [scheduled, draft]) {
      assert.ok(!json.includes(hidden.id), `${hidden.id} leaked`);
      assert.ok(!json.includes(hidden.data.title), `${hidden.data.title} leaked`);
    }
  }
});

test('seriesNav: the scheduled part joins on its date, with no change to the page code', () => {
  const later = new Date('2030-09-02T00:00:00Z');
  const nav = seriesNav(liveA, [liveA, scheduled, draft, liveD], later);
  assert.equal(nav.total, 3);
  assert.deepEqual(nav.parts.map((p) => p.id), ['fixture-live-a', 'fixture-scheduled-b', 'fixture-live-d']);
});

test('series titles: mts-hub is "MTS Hub", wetlabs-app is "wetlabs.app", unknown throws', () => {
  assert.equal(seriesTitle('mts-hub'), 'MTS Hub');
  assert.equal(seriesTitle('wetlabs-app'), 'wetlabs.app');
  const w1 = entry('fixture-w1', 'Fixture w1', '2030-01-01', { series: 'wetlabs-app', seriesOrder: 1 });
  const w2 = entry('fixture-w2', 'Fixture w2', '2030-01-02', { series: 'wetlabs-app', seriesOrder: 2 });
  assert.equal(seriesNav(w1, [w1, w2], NOW).title, 'wetlabs.app');
  assert.equal(seriesNav(liveA, [liveA, liveD], NOW).title, 'MTS Hub');
  assert.throws(() => seriesTitle('unknown'), /unknown series/);
  assert.throws(() => seriesTitle('toString'), /unknown series/);
  const bogus = entry('fixture-bogus', 'Fixture bogus', '2030-01-01', { series: 'unknown', seriesOrder: 1 });
  assert.throws(() => seriesNav(bogus, [bogus], NOW), /unknown series/);
  assert.throws(() => validateSeries([bogus]), /unknown series/);
});

test('SERIES_TITLES names only the two MTS products (ADR 0006)', () => {
  assert.deepEqual(Object.values(SERIES_TITLES), ['MTS Hub', 'wetlabs.app']);
});

test('validateSeries: a duplicate seriesOrder between a draft and a scheduled article throws, naming both', () => {
  const clash = part('fixture-scheduled-clash', 'Fixture scheduled clash', '2030-10-01', 3);
  assert.throws(
    () => validateSeries([liveA, draft, clash]),
    (err) => err.message.includes('fixture-draft-c') && err.message.includes('fixture-scheduled-clash'),
  );
});

test('validateSeries: equal orders in two series, and entries without a series, pass', () => {
  const w1 = entry('fixture-w1', 'Fixture w1', '2030-01-01', { series: 'wetlabs-app', seriesOrder: 1 });
  assert.doesNotThrow(() => validateSeries([liveA, w1, loner, entry('fixture-other', 'Fixture other', '2030-01-01')]));
  assert.doesNotThrow(() => validateSeries([]));
});

test('schema fragment: both-or-neither, positive integer order, closed enum', () => {
  const ok = (v) => seriesSchema.safeParse(v).success;
  assert.ok(ok({}), 'neither field');
  assert.ok(ok({ series: 'mts-hub', seriesOrder: 1 }));
  assert.ok(ok({ series: 'wetlabs-app', seriesOrder: 7 }));
  assert.ok(!ok({ series: 'mts-hub' }), 'series without seriesOrder');
  assert.ok(!ok({ seriesOrder: 1 }), 'seriesOrder without series');
  assert.ok(!ok({ series: 'mts-hub', seriesOrder: 0 }), 'seriesOrder 0');
  assert.ok(!ok({ series: 'mts-hub', seriesOrder: 1.5 }), 'seriesOrder 1.5');
  assert.ok(!ok({ series: 'unknown', seriesOrder: 1 }), 'unknown slug');
});

// ---- the real frontmatter and dist/ ------------------------------------------------------------

const now = new Date();
const all = posts(now);
const parts = all.filter((p) => p.data.series !== undefined);

/** Boxes the build should render: per series with >= 2 published parts, one per published part. */
function expectedBoxes(entries) {
  const published = new Map();
  for (const p of entries) {
    if (p.data.series === undefined || !p.published) continue;
    published.set(p.data.series, (published.get(p.data.series) ?? 0) + 1);
  }
  return [...published.values()].filter((n) => n >= 2).reduce((a, n) => a + n, 0);
}

const pages = readdirSync(join(DIST, 'writing'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({ id: d.name, html: readFileSync(join(DIST, 'writing', d.name, 'index.html'), 'utf8') }));

const boxesOn = (html) => find(parseHtml(html), (el) => 'data-series-nav' in el.attrs);

test('the MTS Hub run is tagged series mts-hub, parts 1-4 in pubDate order', () => {
  const run = parts.filter((p) => p.data.series === 'mts-hub').sort((a, b) => a.data.seriesOrder - b.data.seriesOrder);
  assert.deepEqual(run.map((p) => p.id), [
    'one-engineer-one-platform',
    'pricing-is-a-workflow-not-a-spreadsheet',
    'a-second-brain-needs-a-schema',
    'verifiable-and-erasable',
  ]);
  const dates = run.map((p) => p.data.pubDate.getTime());
  assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
});

test('dist: no series box before two parts are published (0 on 2026-11-02, the issue date)', () => {
  assert.equal(expectedBoxes(posts(new Date('2026-11-02T12:00:00Z'))), 0);
});

test('dist: the number of series boxes matches the published parts in frontmatter', () => {
  assert.ok(pages.length > 0, 'no article pages in dist/writing/');
  const found = pages.reduce((n, p) => n + boxesOn(p.html).length, 0);
  // Asserted even when both are 0 (the state until a second part goes live): never skipped.
  assert.equal(found, expectedBoxes(all));
});

test('dist: each series box lists the published parts, marks the current one and links the rest', () => {
  for (const page of pages) {
    const boxes = boxesOn(page.html);
    if (boxes.length === 0) continue;
    assert.equal(boxes.length, 1, `${page.id}: more than one series box`);
    const [box] = boxes;
    const current = all.find((p) => p.id === page.id);
    const nav = seriesNav(current, all, now);
    assert.ok(nav, `${page.id}: box rendered but seriesNav is null`);
    assert.equal(box.tag, 'nav');
    assert.ok(box.attrs['aria-label'].includes(nav.title), `${page.id}: nav name lacks "${nav.title}"`);
    assert.ok(text(box).includes(`Part ${nav.index} of ${nav.total}`), `${page.id}: no "Part ${nav.index} of ${nav.total}"`);
    const items = find(box, (el) => el.tag === 'li');
    assert.equal(find(box, (el) => el.tag === 'ol').length, 1, `${page.id}: parts are not one ordered list`);
    assert.deepEqual(items.map((li) => text(li).trim()), nav.parts.map((p) => p.title));
    const links = find(box, (el) => el.tag === 'a').map((a) => a.attrs.href);
    assert.deepEqual(links, nav.parts.filter((p) => !p.current).map((p) => `/writing/${p.id}/`));
    const cur = find(box, (el) => el.attrs['aria-current'] === 'page');
    assert.equal(cur.length, 1, `${page.id}: expected one aria-current part`);
    assert.notEqual(cur[0].tag, 'a', `${page.id}: the current part is a link`);
  }
});

/** Every file under dir, recursively. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
}

const escapes = (s) => [
  s,
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  s.replace(/&/g, '&amp;').replace(/'/g, '&apos;'),
  s.replace(/'/g, '&#x27;'),
];

test('dist: no draft or scheduled series part leaks its title or URL', () => {
  const hidden = parts.filter((p) => !p.published);
  const files = walk(DIST).filter((f) => f.endsWith('.html') || /[/\\]rss\.xml$/.test(f) || /[/\\]sitemap-[^/\\]*\.xml$/.test(f));
  assert.ok(files.some((f) => f.endsWith('rss.xml')), 'dist/rss.xml missing');
  assert.ok(files.some((f) => /sitemap-[^/\\]*\.xml$/.test(f)), 'no dist/sitemap-*.xml');
  // dist/social.json is deliberately not scanned: it lists scheduled articles in full today, and
  // stripping title and social copy from scheduled entries is #111's job, not this check's.
  for (const file of files) {
    const body = readFileSync(file, 'utf8');
    for (const p of hidden) {
      for (const needle of [...new Set(escapes(p.data.title)), `/writing/${p.id}/`]) {
        assert.ok(!body.includes(needle), `${file.slice(DIST.length)} carries unpublished series part ${p.id}`);
      }
    }
  }
});
