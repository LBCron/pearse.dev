// No built page loads anything from a third-party origin (issue #115): the footer says "Static
// HTML, no tracking", so a visit must not send the visitor's IP anywhere but pearse.dev.
// Only resource-loading attributes are checked (src, srcset, poster, <link href> for loading
// rels, url() in inline CSS). <a href> is deliberately left out: outbound links are fine.
// Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { find, parseHtml, srcsetCandidates, text } from './lib/html.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const SITE_ORIGIN = 'https://pearse.dev';
/**
 * Third-party origins a built page may load from. Empty on purpose. #20 (the Cloudflare Web
 * Analytics beacon) adds 'https://static.cloudflareinsights.com' here when it lands.
 */
const ALLOWED_THIRD_PARTY_ORIGINS = [];

const LOADING_RELS = new Set(['stylesheet', 'preload', 'modulepreload', 'icon', 'manifest']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Every URL a page loads, as { where, url }. */
export function loadedUrls(html) {
  const root = parseHtml(html);
  const out = [];
  const cssUrls = (css, where) => {
    for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) {
      out.push({ where, url: m[1] ?? m[2] ?? m[3] });
    }
  };
  for (const el of find(root, () => true)) {
    const { attrs } = el;
    if (attrs.src !== undefined) out.push({ where: `<${el.tag} src>`, url: attrs.src });
    if (attrs.poster !== undefined) out.push({ where: `<${el.tag} poster>`, url: attrs.poster });
    if (attrs.srcset !== undefined) {
      for (const c of srcsetCandidates(attrs.srcset)) out.push({ where: `<${el.tag} srcset>`, url: c.url });
    }
    if (el.tag === 'link' && attrs.href !== undefined) {
      const rels = (attrs.rel ?? '').toLowerCase().split(/\s+/);
      if (rels.some((r) => LOADING_RELS.has(r))) out.push({ where: `<link rel=${attrs.rel}>`, url: attrs.href });
    }
    if (attrs.style !== undefined) cssUrls(attrs.style, `<${el.tag} style>`);
    if (el.tag === 'style') cssUrls(text(el), '<style>');
  }
  return out;
}

/** Relative, same-site absolute, or on the allowlist. */
function isAllowed(url) {
  const u = url.trim();
  if (u === '') return true;
  if (u.startsWith('//')) return false;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return true; // relative
  if (/^data:/i.test(u)) return true; // inline, makes no request
  const origin = new URL(u, SITE_ORIGIN).origin;
  return origin === SITE_ORIGIN || ALLOWED_THIRD_PARTY_ORIGINS.includes(origin);
}

test('loadedUrls reads resource attributes only, and isAllowed rejects foreign origins', () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/a.css"><link rel="canonical" href="https://elsewhere.example/x">
    <link rel="icon" href="https://x.example/i.svg"><style>.a{background:url("//cdn.example/b.png")}</style>
    </head><body style="background:url(https://y.example/c.png)">
    <a href="https://github.com/x">out</a>
    <img src="/i.jpg" srcset="/i.jpg 80w, https://z.example/j.jpg 160w">
    <script>var s = '<img src="https://in-script.example/x.png">'</script>
    </body></html>`;
  const urls = loadedUrls(html).map((x) => x.url);
  assert.deepEqual(urls.sort(), ['//cdn.example/b.png', '/a.css', '/i.jpg', '/i.jpg', 'https://x.example/i.svg', 'https://y.example/c.png', 'https://z.example/j.jpg'].sort());
  assert.deepEqual(
    urls.filter((u) => !isAllowed(u)).sort(),
    ['//cdn.example/b.png', 'https://x.example/i.svg', 'https://y.example/c.png', 'https://z.example/j.jpg'].sort(),
  );
  assert.ok(isAllowed('https://pearse.dev/og/x.png'));
  assert.ok(isAllowed('data:image/svg+xml,%3Csvg%3E'));
  assert.ok(!isAllowed('https://pearse.dev.evil.example/x.png'));
});

test('no built page loads a resource from a third-party origin', () => {
  const pages = walk('dist').filter((f) => extname(f) === '.html');
  assert.ok(pages.length >= 10, `expected the built pages, found ${pages.length}`);
  const bad = [];
  let checked = 0;
  for (const f of pages) {
    for (const { where, url } of loadedUrls(readFileSync(f, 'utf8'))) {
      checked++;
      if (!isAllowed(url)) bad.push(`${f}: ${where} ${url}`);
    }
  }
  assert.ok(checked > 50, `parsed ${checked} resource URLs`);
  assert.deepEqual(bad, []);
});

test('the GitHub avatar CDN is named in no built HTML, CSS or JS file', () => {
  const files = walk('dist').filter((f) => ['.html', '.css', '.js', '.mjs'].includes(extname(f)));
  assert.ok(files.length > 10);
  const hits = files.filter((f) => readFileSync(f, 'utf8').includes('avatars.githubusercontent.com'));
  assert.deepEqual(hits, []);
});
