// Asserts the header wraps instead of clipping Contact at 320px, and that header, footer and
// standalone links are at least 24px tall (#105, #190, WCAG 1.4.10 and 2.5.8). The pixel
// measurements were done in a browser (see the PRs); these tests pin the classes and the CSS
// rules that produce them. Relies on `npm test`'s pretest build.
//
// The standalone links of #190 (case-study Code row, home "All ..." links, CV contacts) sit in
// layouts that must not move, so each pairs its padding with an equal negative margin: the box
// grows to a full target while the line it sits in keeps its height (measured unchanged at 390
// and 1280px). The CV contacts take 2px, not 8px: their rows are 28.75px apart, so 8px would
// make neighbouring targets overlap, while 2px gives 26.4px boxes that do not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const PAGES = ['dist/index.html', 'dist/work/index.html', 'dist/cv/index.html'];
const read = (f) => readFileSync(f, 'utf8');
const anchors = (html) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
const classOf = (tag) => tag.match(/\bclass="([^"]*)"/)?.[1] ?? '';
const section = (html, open, close) => {
  const start = html.indexOf(open);
  assert.notEqual(start, -1, `${open} present`);
  const end = html.indexOf(close, start);
  assert.notEqual(end, -1, `${close} present`);
  return html.slice(start, end);
};
const assertTarget = (tag, where) => {
  const cls = classOf(tag);
  assert.match(cls, /\binline-block\b/, `${where}: ${tag}`);
  assert.match(cls, /\bpy-2\b/, `${where}: ${tag}`);
};
/** A target whose padding `pad` is cancelled by an equal negative margin, so layout is unchanged. */
const assertNeutralTarget = (tag, where, pad) => {
  const cls = classOf(tag).split(/\s+/);
  assert.ok(cls.includes('inline-block'), `${where}: inline-block: ${tag}`);
  assert.ok(cls.includes(`py-${pad}`), `${where}: py-${pad}: ${tag}`);
  assert.ok(cls.includes(`-my-${pad}`), `${where}: -my-${pad}: ${tag}`);
};
const sections = (html, open, close) => {
  const out = [];
  for (let i = html.indexOf(open); i !== -1; i = html.indexOf(open, i + 1)) out.push(html.slice(i, html.indexOf(close, i)));
  return out;
};

test('the header row wraps so the nav drops under the logo instead of clipping', () => {
  for (const f of PAGES) {
    const header = read(f).match(/<header\b[^>]*>/)?.[0];
    assert.ok(header, `${f}: header`);
    assert.match(classOf(header), /\bflex-wrap\b/, f);
  }
});

test('primary nav links, the logo and every footer link are inline-block py-2 targets', () => {
  for (const f of PAGES) {
    const html = read(f);
    const nav = anchors(section(html, '<nav aria-label="Primary"', '</nav>'));
    assert.equal(nav.length, 4, `${f}: four primary links`);
    for (const a of nav) assertTarget(a, `${f} nav`);

    const logo = anchors(html).filter((a) => /aria-label="pearse\.dev home"/.test(a));
    assert.equal(logo.length, 1, `${f}: one logo link`);
    assertTarget(logo[0], `${f} logo`);

    const footer = anchors(section(html, '<footer', '</footer>'));
    assert.equal(footer.length, 7, `${f}: seven footer links`);
    for (const a of footer) assertTarget(a, `${f} footer`);
  }
});

test('the inlined CSS defines the wrap, inline-block and py-2 rules', () => {
  const html = read('dist/index.html');
  assert.ok(html.includes('.flex-wrap{flex-wrap:wrap}'));
  assert.ok(html.includes('.inline-block{display:inline-block}'));
  assert.match(html, /\.py-2\{padding-block:calc\(var\(--spacing\) \* 2\)\}/);
});

// Case studies named in #190; every built case study is checked, these must each have a link.
const CASES = ['m-buildz', 'pauldarcy-ie', 'dublin-plein-air', 'cam-tests', 'pearse-dev', 'chatterbox', 'tournament-brackets', 'skatedownhills'];
const FACTS = '<dl class="case-facts"';

test('every case-study header link (GitHub, Live) is a layout-neutral py-2 target', () => {
  const pages = readdirSync('dist/work', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`dist/work/${d.name}/index.html`))
    .map((d) => d.name)
    .filter((slug) => read(`dist/work/${slug}/index.html`).includes(FACTS));
  for (const slug of CASES) assert.ok(pages.includes(slug), `${slug} is a built case study`);
  for (const slug of pages) {
    const links = anchors(section(read(`dist/work/${slug}/index.html`), FACTS, '</dl>'));
    if (CASES.includes(slug)) assert.ok(links.length >= 1, `${slug}: a GitHub or Live link`);
    for (const a of links) assertNeutralTarget(a, `${slug} case facts`, '2');
  }
});

test('the home section links (All N projects, All posts, All N repos) are layout-neutral py-2 targets', () => {
  const links = sections(read('dist/index.html'), '<header class="section-head"', '</header>').flatMap(anchors);
  assert.equal(links.length, 3, 'three section links');
  const hrefs = links.map((a) => a.match(/href="([^"]*)"/)?.[1]);
  assert.deepEqual(hrefs.slice(0, 2), ['/work/', '/writing/']);
  assert.match(hrefs[2], /^https:\/\/github\.com\//);
  for (const a of links) assertNeutralTarget(a, 'home section-head', '2');
});

test('the CV contact links are layout-neutral py-0.5 targets', () => {
  const links = anchors(section(read('dist/cv/index.html'), '<ul class="cv-contact"', '</ul>'));
  assert.ok(links.length >= 4, `${links.length} contact links`);
  for (const a of links) assertNeutralTarget(a, 'cv contact', '0.5');
});

test('the inlined CSS defines the negative-margin rules that keep those links layout-neutral', () => {
  for (const f of ['dist/index.html', 'dist/work/m-buildz/index.html']) {
    assert.match(read(f), /\.-my-2\{margin-block:calc\(var\(--spacing\) \* -2\)\}/, f);
  }
  const cv = read('dist/cv/index.html');
  assert.ok(cv.includes('.py-0\\.5{padding-block:calc(var(--spacing) * .5)}'), 'cv py-0.5');
  assert.ok(cv.includes('.-my-0\\.5{margin-block:calc(var(--spacing) * -.5)}'), 'cv -my-0.5');
});
