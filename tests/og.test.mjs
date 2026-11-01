// Asserts one Open Graph card per article and visible case study page, and none for
// the home and index pages, drafts, future-dated articles or pending client case studies.
// `npm test`'s pretest runs `npm run build` (og:pages runs as prebuild). Run alone, it
// builds when dist/ is missing or older than the last og:pages run. Under CI (`npm run
// test:ci`, no pretest) it never builds: a stale or missing dist/ fails, because CI must
// test the one build it gates and deploys (#150).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { pendingSlugs } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const SITE = 'https://pearse.dev';
const DEFAULT_IMAGE = `${SITE}/og-default.png`;
// Pending client case studies, derived from the source files (none today).
const HIDDEN_PROJECTS = pendingSlugs();
const STATUS = '.astro/og-pages.json';

const STALE_IN_CI = 'dist/ is stale or missing; CI must build once before tests';

let status;
const NO_CHROME = 'Chrome was unavailable at build time (see .astro/og-pages.json); pages use the default image';

before(() => {
  const stale =
    !existsSync('dist/index.html') ||
    !existsSync(STATUS) ||
    statSync(STATUS).mtimeMs > statSync('dist/index.html').mtimeMs;
  if (stale && process.env.CI) throw new Error(STALE_IN_CI);
  if (stale) execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 120_000 });
  status = JSON.parse(readFileSync(STATUS, 'utf8'));
});

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function meta(html, key) {
  const tag = html.match(new RegExp(`<meta (?:property|name)="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`));
  return tag ? decode(tag[1]) : undefined;
}

/**
 * Slugs of the built detail pages under dist/<section>/<slug>/index.html. Redirect pages
 * for moved case studies (astro.config.mjs `redirects`) are not pages and get no card.
 */
function pages(section) {
  return readdirSync(`dist/${section}`)
    .filter((name) => existsSync(join('dist', section, name, 'index.html')))
    .map((slug) => ({ slug, html: readFileSync(join('dist', section, slug, 'index.html'), 'utf8') }))
    .filter(({ html }) => !/<meta http-equiv="refresh"/.test(html))
    .map(({ slug, html }) => {
      const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '')).trim();
      return { section, slug, html, title };
    });
}

/** Article slugs that must not have a card: drafts and anything dated after now. */
function unpublishedPostSlugs(now = new Date()) {
  return readdirSync('src/content/posts')
    .filter((f) => /\.mdx?$/.test(f))
    .filter((f) => {
      const data = parse(readFileSync(join('src/content/posts', f), 'utf8').split(/^---\s*$/m)[1]);
      return data.draft === true || new Date(data.pubDate) > now;
    })
    .map((f) => basename(f, extname(f)));
}

const all = () => [...pages('writing'), ...pages('work')];

test('there are article and case study pages to check', () => {
  assert.ok(pages('writing').length > 0, 'no article pages');
  assert.ok(pages('work').length > 0, 'no case study pages');
});

test('every article and case study page points og:image and twitter:image at its own card', () => {
  for (const { section, slug, html } of all()) {
    const expected = status.chrome ? `${SITE}/og/${slug}.png` : DEFAULT_IMAGE;
    assert.equal(meta(html, 'og:image'), expected, `${section}/${slug} og:image`);
    assert.equal(meta(html, 'twitter:image'), expected, `${section}/${slug} twitter:image`);
  }
});

test('og:image:alt names the page title and pearse.dev, twitter alt mirrors it', (t) => {
  if (!status.chrome) return t.skip(NO_CHROME);
  for (const { section, slug, html, title } of all()) {
    const alt = meta(html, 'og:image:alt');
    assert.ok(alt?.includes(title), `${section}/${slug}: alt "${alt}" lacks title "${title}"`);
    assert.ok(alt.endsWith(', pearse.dev'), `${section}/${slug}: alt "${alt}"`);
    assert.equal(meta(html, 'twitter:image:alt'), alt, `${section}/${slug} twitter:image:alt`);
  }
});

test('each card exists in dist/og/, is a 1200x630 PNG over 10 KB, and all are distinct', (t) => {
  if (!status.chrome) return t.skip(NO_CHROME);
  const images = new Set();
  for (const { slug } of all()) {
    const file = `dist/og/${slug}.png`;
    assert.ok(existsSync(file), `${file} missing`);
    const buf = readFileSync(file);
    assert.ok(buf.length > 10 * 1024, `${file} is only ${buf.length} bytes`);
    assert.equal(buf.toString('latin1', 1, 4), 'PNG', `${file} is not a PNG`);
    assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [1200, 630], `${file} size`);
    images.add(buf.toString('base64'));
  }
  assert.equal(images.size, all().length, 'two pages share identical card pixels');
});

test('dist/og/ holds exactly one card per page and nothing else', () => {
  const cards = existsSync('dist/og') ? readdirSync('dist/og').sort() : [];
  const expected = status.chrome ? all().map((p) => `${p.slug}.png`).sort() : [];
  assert.deepEqual(cards, expected);
});

test('no card for pending client case studies, drafts or future-dated articles', () => {
  const unpublished = unpublishedPostSlugs();
  assert.ok(unpublished.length > 0, 'expected at least one draft to check against');
  for (const slug of [...HIDDEN_PROJECTS, ...unpublished]) {
    assert.equal(existsSync(`dist/og/${slug}.png`), false, `dist/og/${slug}.png`);
    assert.equal(existsSync(`public/og/${slug}.png`), false, `public/og/${slug}.png`);
  }
});

test('home, index and 404 pages keep the default image and alt', () => {
  for (const file of ['dist/index.html', 'dist/writing/index.html', 'dist/work/index.html', 'dist/404.html']) {
    const html = readFileSync(file, 'utf8');
    assert.equal(meta(html, 'og:image'), DEFAULT_IMAGE, file);
    assert.equal(meta(html, 'twitter:image'), DEFAULT_IMAGE, file);
    assert.doesNotMatch(meta(html, 'og:image:alt') ?? '', /, pearse\.dev$/, file);
  }
  assert.ok(existsSync('dist/og-default.png'), 'default image missing from dist');
});
