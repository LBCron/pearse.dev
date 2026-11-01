// The one font preload is the Inter variable woff2 that paints LCP (issue #112). Lighthouse
// records the LCP element as an Inter paragraph (the hero lede, a case-study lede, a plain <p>),
// never the Archivo H1. A preload whose href differs from the url() in the inline @font-face makes
// the browser download the font twice, so the test compares the two strings exactly.
// Shipped variant: (a) swap, Inter only. No page preloads an Archivo woff2.
// Relies on `npm test`'s pretest build; CSS is inlined, so there is no .css file to read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { find, parseHtml, text } from './lib/html.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

/** The url() of the @font-face whose family is `family`, in a block of inline CSS. */
export function fontFaceUrl(css, family) {
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    const fam = body.match(/font-family\s*:\s*(?:"([^"]*)"|'([^']*)'|([^;]*?))\s*(?:;|$)/);
    if ((fam?.[1] ?? fam?.[2] ?? fam?.[3])?.trim() !== family) continue;
    const u = body.match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/);
    if (u) return u[1] ?? u[2] ?? u[3];
  }
  return null;
}

/** Font preloads in document order, as { href, crossorigin, type }. */
export function fontPreloads(root) {
  return find(
    root,
    (el) => el.tag === 'link' && el.attrs.rel === 'preload' && el.attrs.as === 'font',
  ).map((el) => ({ href: el.attrs.href, type: el.attrs.type, crossorigin: 'crossorigin' in el.attrs }));
}

// Pages that do not use the base layout are skipped: the meta-refresh redirect pages for moved
// case studies (dist/work/<old-slug>/index.html, under 400 bytes, no @font-face). A page is a
// layout page exactly when its inline <style> declares the Inter Variable @font-face.
const pages = walk('dist').flatMap((file) => {
  const root = parseHtml(readFileSync(file, 'utf8'));
  const css = find(root, (el) => el.tag === 'style').map(text).join('\n');
  const inter = fontFaceUrl(css, 'Inter Variable');
  return inter ? [{ file: relative('dist', file), root, inter }] : [];
});

test('the selector finds layout pages (not vacuous)', () => {
  assert.ok(pages.length > 0, 'no built page declares an Inter Variable @font-face');
  const files = pages.map((p) => p.file);
  assert.ok(files.includes('index.html'), 'dist/index.html must use the base layout');
  assert.ok(files.includes('404.html'), 'dist/404.html must use the base layout');
});

test('fontFaceUrl reads quoted, unquoted and minified faces', () => {
  assert.equal(
    fontFaceUrl("@font-face{font-family:Inter Variable;src:url(/a.woff2)format('x')}", 'Inter Variable'),
    '/a.woff2',
  );
  assert.equal(
    fontFaceUrl(`@font-face { font-family: 'Inter Variable'; src: url("/b.woff2") }`, 'Inter Variable'),
    '/b.woff2',
  );
  assert.equal(fontFaceUrl('@font-face{font-family:Other;src:url(/c.woff2)}', 'Inter Variable'), null);
});

test('every layout page preloads the exact Inter woff2 its @font-face loads', () => {
  for (const { file, root, inter } of pages) {
    const hit = fontPreloads(root).filter((p) => p.href === inter);
    assert.equal(hit.length, 1, `${file}: expected one preload of ${inter}`);
    assert.equal(hit[0].type, 'font/woff2', `${file}: preload type`);
    assert.ok(hit[0].crossorigin, `${file}: preload needs crossorigin`);
  }
});

test('variant (a): Inter is the only font preloaded, no page preloads Archivo', () => {
  for (const { file, root } of pages) {
    const hrefs = fontPreloads(root).map((p) => p.href);
    assert.deepEqual(
      hrefs.filter((h) => /archivo/i.test(h)),
      [],
      `${file}: Archivo is preloaded`,
    );
    assert.equal(hrefs.length, 1, `${file}: expected exactly one font preload, got ${hrefs}`);
  }
});
