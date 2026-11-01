// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { readPdf } from '../scripts/pdf-text.mjs';
import { NAV, SITE } from '../src/lib/site.ts';
import { projects as sourceProjects } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const CV = 'dist/cv/index.html';
const html = () => readFileSync(CV, 'utf8');

/** Frontmatter fields the tests need, read straight from the case study files. */
function projects() {
  return sourceProjects().map((p) => ({
    slug: p.slug,
    title: p.title,
    featured: p.featured === true,
    mts: p.category === 'mts',
    pending: !p.visible,
  }));
}

test('/cv/ is built', () => {
  assert.equal(existsSync(CV), true);
});

test('/cv/ carries no verify markers', () => {
  assert.equal(html().includes('[VERIFY'), false);
});

// No client case study is pending today, so this guards future ones; the rule itself is
// unit-tested in tests/visibility.test.mjs.
test('/cv/ never mentions pending client case studies', () => {
  const page = html();
  const pending = projects().filter((p) => p.pending);
  for (const p of pending) {
    assert.equal(page.includes(p.slug), false, `slug ${p.slug}`);
    assert.equal(page.includes(p.title), false, `title ${p.title}`);
  }
});

test('/cv/ links every visible featured case study', () => {
  const page = html();
  const featured = projects().filter((p) => p.featured && !p.pending);
  assert.ok(featured.length > 0);
  for (const p of featured) assert.match(page, new RegExp(`href="/work/${p.slug}/"`), p.slug);
});

test('/cv/ has a print stylesheet', () => {
  const page = html();
  assert.ok(/<link[^>]+rel="stylesheet"[^>]+media="print"/.test(page) || /@media print/.test(page));
});

/** Contents of every `@media print { … }` block in the page, braces balanced. */
function printBlocks(page) {
  const out = [];
  for (const m of page.matchAll(/@media\s+print\s*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    while (i < page.length && depth > 0) {
      if (page[i] === '{') depth++;
      else if (page[i] === '}') depth--;
      i++;
    }
    out.push(page.slice(from, i - 1));
  }
  return out.join('\n');
}

test('/cv/ print stylesheet sets A4 and hides the nav header and footer', () => {
  const css = printBlocks(html());
  assert.match(css, /@page\s*\{[^}]*size:\s*A4/);
  for (const sel of ['header', 'footer']) {
    assert.match(css, new RegExp(`body\\s*>\\s*${sel}[^{]*\\{[^}]*display:\\s*none`), `body > ${sel} not hidden`);
  }
});

test('/cv/ case studies show no role and start-only periods', () => {
  const page = html();
  assert.equal(page.includes('Platform lead'), false);
  const periods = [...page.matchAll(/class="cv-period"[^>]*>([^<]*)</g)].map((m) => m[1]);
  // Experience and education rows keep their ranges; case-study rows must be a single start.
  const work = page.slice(page.indexOf('id="cv-work"'), page.indexOf('id="cv-skills"'));
  for (const m of work.matchAll(/class="cv-period"[^>]*>([^<]*)</g)) assert.doesNotMatch(m[1], /–/, m[1]);
  assert.ok(periods.length > 0);
});

test('/cv/ mailto matches SITE.email', () => {
  const email = readFileSync('src/lib/site.ts', 'utf8').match(/email:\s*'([^']+)'/)?.[1];
  assert.ok(email);
  const mailtos = [...html().matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1]);
  assert.ok(mailtos.length > 0, 'no mailto link');
  for (const m of mailtos) assert.equal(m, email);
});

test('/cv/ has a print button', () => {
  assert.match(html(), /<button[^>]*data-cv-print/);
});

test('sitemap lists /cv/', () => {
  assert.match(readFileSync('dist/sitemap-0.xml', 'utf8'), /https:\/\/pearse\.dev\/cv\//);
});

test('footer and About link to /cv/', () => {
  const home = readFileSync('dist/index.html', 'utf8');
  assert.match(home.slice(home.indexOf('<footer')), /href="\/cv\/"/);
  const about = home.match(/<section id="about"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(about, /href="\/cv\/"/);
});

test('/cv/ job line has a text space before the location separator', () => {
  assert.match(html(), /<\/h3>/);
  assert.match(html(), /[^\s>] <span class="cv-meta"[^>]*>· /, 'space must precede the separator');
  assert.equal(/[^\s>]<span class="cv-meta"/.test(html()), false, 'no glued cv-meta span');
});

// The PDF download (scripts/cv-pdf.mjs, run as postbuild). Its status file says whether Chrome
// was found and the PDF written; the page must link the file exactly when it exists.
const PDF = 'dist/pearse-darcy-cv.pdf';
const PDF_STATUS = '.astro/cv-pdf.json';
const pdfStatus = existsSync(PDF_STATUS) ? JSON.parse(readFileSync(PDF_STATUS, 'utf8')) : null;
const NO_CHROME = pdfStatus?.chrome === null && 'Chrome was unavailable at build time (see .astro/cv-pdf.json); no PDF was built';

test('the PDF step wrote its status file', () => {
  assert.ok(pdfStatus, `${PDF_STATUS} missing: run npm run build`);
});

test('/cv/ links the PDF download when the PDF was built', { skip: pdfStatus?.pdf !== true && 'no PDF was built' }, () => {
  const tag = html().match(/<a\b[^>]*\sdata-cv-pdf\b[^>]*>/)?.[0];
  assert.ok(tag, 'no data-cv-pdf link');
  assert.match(tag, /\sdownload(=|\s|>)/);
  assert.match(tag.match(/\sclass="([^"]*)"/)?.[1] ?? '', /(^|\s)cv-screen(\s|$)/, 'link must hide in print');
  assert.match(tag, /\shref="\/pearse-darcy-cv\.pdf"/);
  assert.equal(existsSync(PDF), true);
});

test('/cv/ has no data-cv-pdf element when no PDF was built', { skip: pdfStatus?.pdf === true && 'the PDF was built' }, () => {
  assert.equal(html().includes('data-cv-pdf'), false);
  assert.equal(existsSync(PDF), false);
});

/** Whitespace collapsed, curly quotes straightened, case folded (print CSS uppercases the name). */
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

let parsed;
const pdf = () => (parsed ??= readPdf(readFileSync(PDF)));

test('the PDF is a real file over 10 KB', { skip: NO_CHROME }, () => {
  assert.equal(pdfStatus.pdf, true);
  assert.equal(readFileSync(PDF).subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(statSync(PDF).size > 10 * 1024);
});

// #191: the screen grain overlay once printed as a page-sized raster per page (2.6 MB).
test('the PDF stays within its 500 KB size budget', { skip: NO_CHROME }, () => {
  const size = statSync(PDF).size;
  assert.ok(size <= 500 * 1024, `${(size / 1024).toFixed(0)} KB`);
});

test('the PDF embeds no raster images: the CV is text and vector only', { skip: NO_CHROME }, () => {
  assert.doesNotMatch(readFileSync(PDF).toString('latin1'), /\/Subtype\s*\/Image\b/);
});

test('/cv/ print stylesheet hides the grain overlay', () => {
  assert.match(printBlocks(html()), /body:{1,2}after[^{]*\{[^}]*display:\s*none/);
});

test('the PDF has one or two A4 pages', { skip: NO_CHROME }, async () => {
  const { pages } = await pdf();
  assert.ok(pages.length >= 1 && pages.length <= 2, `${pages.length} pages`);
  assert.equal(pdfStatus.pages, pages.length);
  for (const [i, { width, height }] of pages.entries()) {
    assert.ok(Math.abs(width - 595.28) <= 1 && Math.abs(height - 841.89) <= 1, `page ${i + 1}: ${width} x ${height} pt`);
  }
});

test('the PDF carries the name, email, headline and every case study the page lists', { skip: NO_CHROME }, async () => {
  const text = norm((await pdf()).text);
  const headline = parse(readFileSync('src/content/cv/cv.md', 'utf8').split(/^---$/m)[1]).headline;
  for (const s of [SITE.name, SITE.email, headline]) assert.ok(text.includes(norm(s)), s);
  const shown = projects().filter((p) => !p.pending && (p.featured || p.mts));
  assert.ok(shown.some((p) => p.featured) && shown.some((p) => p.mts));
  for (const p of shown) assert.ok(text.includes(norm(p.title)), p.title);
});

test('the PDF carries no screen chrome: no buttons, skip link, home link or nav', { skip: NO_CHROME }, async () => {
  const { text } = await pdf();
  for (const s of ['Download PDF', 'Skip to content', 'pearse.dev home']) assert.equal(text.includes(s), false, s);
  assert.doesNotMatch(text, /\bPrint\b/);
  const labels = new Set(NAV.map((n) => n.label));
  for (const line of text.split('\n')) assert.equal(labels.has(line.trim()), false, `nav label line: ${line.trim()}`);
});

test('the PDF links only public https and mailto targets, case studies on pearse.dev', { skip: NO_CHROME }, async () => {
  const { links } = await pdf();
  assert.ok(links.length > 0);
  for (const url of links) {
    assert.match(url, /^(https:\/\/|mailto:)/, url);
    assert.doesNotMatch(url, /127\.0\.0\.1|localhost/, url);
  }
  // Every listed case study links to its public page; any other /work/ link (the profile text
  // links one too) still names a visible case study on pearse.dev.
  for (const p of projects().filter((x) => !x.pending && (x.featured || x.mts))) {
    assert.ok(links.includes(`https://pearse.dev/work/${p.slug}/`), p.slug);
  }
  const visible = new Set(projects().filter((p) => !p.pending).map((p) => p.slug));
  for (const url of links.filter((u) => u.includes('/work/'))) {
    const slug = url.match(/^https:\/\/pearse\.dev\/work\/([a-z0-9-]+)\/$/)?.[1];
    assert.ok(slug && visible.has(slug), url);
  }
});

test('the PDF title is set and names no loopback address', { skip: NO_CHROME }, async () => {
  const { title } = await pdf();
  assert.ok(title.trim(), 'empty Info Title');
  assert.doesNotMatch(title, /127\.0\.0\.1|localhost/);
});

// No client case study is pending today, so this guards future ones.
test('the PDF never mentions pending client case studies', { skip: NO_CHROME }, async () => {
  const { text, links } = await pdf();
  for (const p of projects().filter((x) => x.pending)) {
    assert.equal(norm(text).includes(norm(p.title)), false, `title ${p.title}`);
    assert.equal(links.some((u) => u.includes(`/work/${p.slug}/`)), false, `link ${p.slug}`);
  }
});
