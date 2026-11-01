// Asserts the two-MTS rule: the site presents MTS as exactly two products, MTS Hub and
// wetlabs.app. The sub-projects folded into them live on as feature sections, their old
// /work/<slug>/ URLs are static redirect pages, and the old product name is gone from the build.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPdf, scanStrings } from '../scripts/pdf-text.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const MTS = [
  { slug: 'mts-hub', title: 'MTS Hub' },
  { slug: 'wetlabs-app', title: 'wetlabs.app' },
];

// Old case study URL -> where it now lives. Hard-coded on purpose: these URLs are already out there.
const MOVED = {
  ophthix: '/work/wetlabs-app/',
  'infrastructure-observability': '/work/wetlabs-app/#observability',
  wetpack: '/work/mts-hub/#packing',
  opthalyze: '/work/mts-hub/#feedback',
  'mts-atlas': '/work/mts-hub/#drafting',
  'mts-cortex': '/work/mts-hub/#knowledge',
  'jdm-parts-webshop': '/work/m-buildz/',
  'artist-wordpress-site': '/work/pauldarcy-ie/',
};

const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.pdf']);

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}

// The old product name, in any letter case. Its slug survives only as the path of its redirect page.
const OLD_NAME = /ophthix/i;

const decode = (s) => s.replace(/&#x2F;|&#47;/g, '/').replace(/&amp;/g, '&');

test('/work/ lists exactly two MTS case studies: MTS Hub and wetlabs.app', () => {
  const html = readFileSync('dist/work/index.html', 'utf8');
  const group = html.match(/<section\b[^>]*aria-labelledby="group-mts"[\s\S]*?<\/section>/)?.[0];
  assert.ok(group, 'no MTS group on /work/');
  const slugs = (group.match(/<a [^>]*href="\/work\/([a-z0-9-]+)\/"/g) ?? []).map((a) => a.match(/\/work\/([a-z0-9-]+)\//)[1]);
  assert.deepEqual(slugs, MTS.map((p) => p.slug));
  for (const { title } of MTS) assert.ok(group.includes(`>${title}<`), `card title ${title}`);
});

test('the projects collection has exactly two MTS case studies', () => {
  const mts = readdirSync('src/content/projects')
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => readFileSync(`src/content/projects/${f}`, 'utf8').split(/^---$/m)[1])
    .filter((fm) => /^category:\s*mts\s*$/m.test(fm))
    .map((fm) => fm.match(/^slug:\s*(\S+)/m)[1])
    .sort();
  assert.deepEqual(mts, MTS.map((p) => p.slug).sort());
});

// Folded sub-projects are features of the two case studies, not named projects of their own.
const FOLDED_NAMES = /WetPack|Opthalyze|MTS Atlas|MTS Cortex/i;

test('the MTS case studies describe folded tools as features, not by their old names', () => {
  for (const { slug } of MTS) {
    const text = readFileSync(`dist/work/${slug}/index.html`, 'utf8').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(text, FOLDED_NAMES, slug);
  }
});

test('social feed links no removed case study and never uses the old product name', () => {
  const raw = readFileSync('dist/social.json', 'utf8');
  const feed = JSON.parse(raw);
  assert.ok(feed.length > 0, 'empty social feed');
  assert.doesNotMatch(raw, OLD_NAME, 'old product name in social.json');
  for (const slug of Object.keys(MOVED)) assert.equal(raw.includes(`/work/${slug}/`), false, `/work/${slug}/ in social.json`);
});

test('the old product name appears nowhere in dist/, in any case, except as one redirect path', () => {
  const paths = files('dist').filter((file) => OLD_NAME.test(file));
  assert.deepEqual(paths, [join('dist', 'work', 'ophthix', 'index.html')]);
  for (const file of files('dist')) {
    if (BINARY.has(extname(file))) continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), OLD_NAME, file);
  }
});

// The CV PDF is binary, so the walk above skips it; its text, metadata and links are read instead.
const CV_PDF = 'dist/pearse-darcy-cv.pdf';
test('the CV PDF never uses the old product name', { skip: !existsSync(CV_PDF) && 'no CV PDF was built (see .astro/cv-pdf.json)' }, async () => {
  for (const s of scanStrings(await readPdf(readFileSync(CV_PDF)))) assert.doesNotMatch(s, OLD_NAME);
});

test('every social.json entry keeps the old product name out of its title and short copy (#43)', () => {
  const feed = JSON.parse(readFileSync('dist/social.json', 'utf8'));
  for (const e of feed) {
    if (!e.title || !e.social) continue; // scheduled stubs carry neither
    assert.doesNotMatch(e.title, OLD_NAME, `${e.kind}:${e.id} title`);
    assert.doesNotMatch(e.social.short, OLD_NAME, `${e.kind}:${e.id} short`);
  }
});

// Drafts never reach dist/, so the copy is checked at the source too: every post and social
// entry (draft or not), the CV, and the LinkedIn and bio copy in docs/profile (#43).
const COPY_DIRS = ['src/content/posts', 'src/content/social', 'src/content/cv', 'docs/profile'];
const OLD_NAMES = /ophthix|WetPack|Opthalyze|\bAtlas\b|\bCortex\b/i;

test('posts, social copy, CV and profile copy use neither the old product name nor the folded tool names', () => {
  for (const file of COPY_DIRS.flatMap((d) => files(d)).filter((f) => /\.mdx?$/.test(f))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), OLD_NAMES, file);
  }
});

for (const [slug, to] of Object.entries(MOVED)) {
  test(`/work/${slug}/ is a static redirect page to ${to}`, () => {
    const file = `dist/work/${slug}/index.html`;
    assert.equal(existsSync(file), true, file);
    const html = decode(readFileSync(file, 'utf8'));
    const refresh = html.match(/<meta\s+http-equiv="refresh"\s+content="([^"]+)"/)?.[1];
    assert.ok(refresh, 'no meta refresh');
    // 1s, not 0: an instant refresh aborts the incoming view transition (#79). The opt-in below stays (#55).
    assert.match(refresh, /^1;\s*url=/);
    assert.equal(refresh.replace(/^1;\s*url=/, ''), to);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.equal(/<script\b/.test(html), false, 'redirect page must not need JavaScript');
    assert.match(html, /@view-transition\s*\{\s*navigation:\s*auto/, 'redirect page must opt in to view transitions like every other page');
    assert.match(html, /<link rel="icon" href="\/favicon\.svg"/, 'redirect page must name its icon, or the browser requests a missing /favicon.ico');
    assert.equal(html.replace(/<[^>]+>/g, ' ').includes(`/work/${slug}/`), false, 'redirect page text repeats the old path');
  });
}

test('every redirect target section exists on its case study page', () => {
  for (const to of Object.values(MOVED)) {
    const [path, id] = to.split('#');
    const html = readFileSync(join('dist', path, 'index.html'), 'utf8');
    if (id) assert.match(html, new RegExp(`<section id="${id}"`), to);
  }
});

test('redirect pages stay out of the sitemap', () => {
  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  for (const slug of Object.keys(MOVED)) assert.equal(sitemap.includes(`/work/${slug}/`), false, slug);
});
