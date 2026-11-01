// SEO contract over the built site (#134). Relies on `npm test`'s pretest build; run
// `npm run build` first when running this file alone. Reads dist/ only and needs no server.
//
// Every .html page in dist/ is one of three kinds, derived from the build alone:
//   redirect page: robots noindex plus a meta refresh (the moved case-study stubs)
//   noindex page:  robots noindex, no refresh (today only 404)
//   indexable:     everything else
// Redirect pages are named by index and refresh target only, never by their dist path or old
// slug: CI logs are public (ADR 0005, ADR 0006). This file hard-codes no slug list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/lib/site.ts';
import { META_DESCRIPTION_MAX, isValidMetaDescription, metaDescriptionLength } from '../src/lib/seo.ts';
import { find, parseHtml } from './lib/html.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the HTML entities in an attribute value, so lengths and URLs compare as a browser reads them. */
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Every .html file under dist/, as a path relative to dist/ with forward slashes, sorted. */
function htmlFiles(dir = 'dist', prefix = '') {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + ent.name;
    if (ent.isDirectory()) out.push(...htmlFiles(`${dir}/${ent.name}`, `${rel}/`));
    else if (ent.name.endsWith('.html')) out.push(rel);
  }
  return out.sort();
}

/**
 * A page's own path from its dist path, independent of the layout: `a/b/index.html` is `/a/b/`
 * and `404.html` is `/404/` (trailingSlash is 'always').
 */
const pathOf = (rel) => `/${rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '/')}`;
const absolute = (p) => new URL(p, SITE.url).href;

const attr = (el, name) => (el.attrs[name] === undefined ? undefined : decodeEntities(el.attrs[name]));
const metas = (root, key, value) => find(root, (e) => e.tag === 'meta' && (e.attrs[key] ?? '').toLowerCase() === value);

function readPage(rel) {
  const html = readFileSync(`dist/${rel}`, 'utf8');
  const root = parseHtml(html);
  const robots = metas(root, 'name', 'robots').map((e) => attr(e, 'content') ?? '');
  const refresh = metas(root, 'http-equiv', 'refresh').map((e) => attr(e, 'content') ?? '');
  const noindex = robots.some((c) => /\bnoindex\b/i.test(c));
  const kind = noindex && refresh.length > 0 ? 'redirect' : noindex ? 'noindex' : 'indexable';
  const target = refresh.length ? /url=(.*)$/i.exec(refresh[0])?.[1].trim() : undefined;
  const htmlEl = find(root, (e) => e.tag === 'html');
  return {
    rel,
    path: pathOf(rel),
    kind,
    target,
    canonicals: find(root, (e) => e.tag === 'link' && (e.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')).map((e) => attr(e, 'href')),
    ogUrls: metas(root, 'property', 'og:url').map((e) => attr(e, 'content')),
    ogImages: metas(root, 'property', 'og:image').map((e) => attr(e, 'content')),
    descriptions: metas(root, 'name', 'description').map((e) => attr(e, 'content') ?? ''),
    langs: htmlEl.map((e) => e.attrs.lang),
    h1s: find(root, (e) => e.tag === 'h1').length,
    jsonLd: find(root, (e) => e.tag === 'script' && (e.attrs.type ?? '').toLowerCase() === 'application/ld+json').map((e) => e.children.join('')),
  };
}

const PAGES = htmlFiles().map(readPage);
const REDIRECTS = PAGES.filter((p) => p.kind === 'redirect');
REDIRECTS.forEach((p, i) => (p.label = `redirect page ${i + 1} -> ${p.target}`));
for (const p of PAGES) p.label ??= p.path;
const INDEXABLE = PAGES.filter((p) => p.kind === 'indexable');
const NOINDEX = PAGES.filter((p) => p.kind === 'noindex');

/** The dist page an absolute URL on the site lands on, or undefined. Query and hash are ignored. */
function pageAt(url) {
  const u = new URL(url);
  if (u.origin !== new URL(SITE.url).origin) return undefined;
  return PAGES.find((p) => p.path === u.pathname);
}

/** How to name a URL in a message: a redirect page by its label, never by its path. */
const describe = (url) => pageAt(url)?.label ?? `${url} (no page in dist/)`;

/** Every URL in the sitemap, following sitemap-index.xml to each sitemap file it lists. */
function sitemapUrls() {
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => decodeEntities(m[1].trim()));
  const files = locs(readFileSync('dist/sitemap-index.xml', 'utf8'));
  assert.ok(files.length > 0, 'sitemap-index.xml lists no sitemap');
  const urls = [];
  for (const f of files) {
    const u = new URL(f);
    assert.equal(u.origin, new URL(SITE.url).origin, `sitemap index entry ${f} is off the site origin`);
    const file = `dist${u.pathname}`;
    assert.ok(existsSync(file), `sitemap index lists ${u.pathname}, which is not in dist/`);
    urls.push(...locs(readFileSync(file, 'utf8')));
  }
  return urls;
}

test('dist/ has pages of every kind the contract expects', () => {
  assert.ok(INDEXABLE.length > 0, 'no indexable pages found');
  assert.ok(NOINDEX.some((p) => p.rel === '404.html'), 'dist/404.html must be a noindex page');
  // Counts only: redirect pages are never listed by path.
  assert.ok(REDIRECTS.every((p) => p.target), 'every redirect page has a refresh url');
});

test('indexable pages use both page-specific and default og:images', () => {
  const paths = INDEXABLE.map((p) => (p.ogImages[0] ? new URL(p.ogImages[0]).pathname : ''));
  assert.ok(paths.some((x) => /^\/og\/[^/]+\.png$/.test(x)), 'no indexable page uses an /og/*.png image');
  assert.ok(paths.includes(SITE.ogImage), `no indexable page uses ${SITE.ogImage}`);
});

test('the shared length rule counts decoded characters', () => {
  assert.equal(decodeEntities('A &amp; B &#8217; &#x2014;'), 'A & B ’ —');
  assert.equal(metaDescriptionLength(decodeEntities('&amp;')), 1);
  assert.equal(isValidMetaDescription('x'.repeat(META_DESCRIPTION_MAX)), true);
  assert.equal(isValidMetaDescription('x'.repeat(META_DESCRIPTION_MAX + 1)), false);
  assert.equal(isValidMetaDescription('  '), false);
});

for (const p of INDEXABLE) {
  test(`indexable page ${p.label}`, () => {
    const self = absolute(p.path);
    assert.equal(p.canonicals.length, 1, `${p.label}: expected exactly one canonical, found ${p.canonicals.length}`);
    assert.equal(p.canonicals[0], self, `${p.label}: canonical is not the page's own URL`);
    assert.deepEqual(p.ogUrls, [self], `${p.label}: og:url must equal the canonical`);

    assert.equal(p.ogImages.length, 1, `${p.label}: expected exactly one og:image`);
    const img = new URL(p.ogImages[0]);
    assert.equal(img.origin, new URL(SITE.url).origin, `${p.label}: og:image must be absolute on ${SITE.url}`);
    assert.ok(existsSync(`dist${decodeURIComponent(img.pathname)}`), `${p.label}: og:image ${img.pathname} is not in dist/`);

    assert.deepEqual(p.langs, ['en-GB'], `${p.label}: <html lang> must be en-GB`);
    assert.equal(p.h1s, 1, `${p.label}: expected exactly one <h1>, found ${p.h1s}`);

    assert.equal(p.descriptions.length, 1, `${p.label}: expected exactly one meta description`);
    const d = p.descriptions[0];
    assert.ok(
      isValidMetaDescription(d),
      `${p.label}: meta description is ${metaDescriptionLength(d)} chars, must be 1 to ${META_DESCRIPTION_MAX}`,
    );

    p.jsonLd.forEach((block, i) => {
      assert.doesNotThrow(() => JSON.parse(block), `${p.label}: ld+json block ${i + 1} is not valid JSON`);
    });
  });
}

for (const p of NOINDEX) {
  test(`noindex page ${p.label}`, () => {
    assert.equal(p.canonicals.length, 0, `${p.label}: a noindex page must not claim a canonical`);
    assert.equal(p.ogUrls.length, 0, `${p.label}: a noindex page must not claim an og:url`);
    assert.deepEqual(p.langs, ['en-GB'], `${p.label}: <html lang> must be en-GB`);
  });
}

for (const p of REDIRECTS) {
  // Keyed on noindex plus refresh, never on a missing lang. Booleans only, so a failure
  // prints neither the page's path nor its old slug.
  test(p.label, () => {
    assert.ok(p.canonicals.length === 1, `${p.label}: expected exactly one canonical`);
    assert.ok(p.canonicals[0] === absolute(p.target), `${p.label}: canonical must be the absolute refresh target`);
  });
}

test('the sitemap lists exactly the indexable pages', () => {
  const urls = sitemapUrls();
  const seen = new Set();
  for (const url of urls) {
    const page = pageAt(url);
    assert.ok(!seen.has(url), `sitemap lists ${describe(url)} twice`);
    seen.add(url);
    assert.ok(page, `sitemap lists ${describe(url)}`);
    assert.ok(page.kind === 'indexable', `sitemap lists ${page.kind} page ${page.label}`);
    assert.ok(url === absolute(page.path), `sitemap entry for ${page.label} is not its canonical URL`);
  }
  for (const p of INDEXABLE) assert.ok(seen.has(absolute(p.path)), `sitemap is missing ${p.label}`);
});

test('every RSS item links to an indexable page in the sitemap', () => {
  const rss = readFileSync('dist/rss.xml', 'utf8');
  const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  assert.ok(items.length > 0, 'rss.xml has no items');
  const inSitemap = new Set(sitemapUrls());
  items.forEach((item, i) => {
    const link = /<link>([^<]*)<\/link>/.exec(item)?.[1];
    assert.ok(link, `RSS item ${i + 1} has no <link>`);
    const url = decodeEntities(link.trim());
    const page = pageAt(url);
    assert.ok(page, `RSS item ${i + 1} links to ${describe(url)}`);
    assert.ok(page.kind === 'indexable', `RSS item ${i + 1} links to ${page.kind} page ${page.label}`);
    assert.ok(inSitemap.has(url), `RSS item ${i + 1} links to ${page.label}, which is not in the sitemap`);
  });
});
