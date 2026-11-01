// Asserts the header wraps instead of clipping Contact at 320px, and that header and footer
// links are at least 24px tall (#105, WCAG 1.4.10 and 2.5.8). The pixel measurements were done
// in a browser (see the PR); these tests pin the classes and the CSS rules that produce them.
// Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
