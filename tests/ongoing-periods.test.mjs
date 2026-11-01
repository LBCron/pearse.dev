// Ongoing MTS periods read "<start with a year> – Present", never a frozen end month.
// Static: frontmatter is read from source and the built pages are read from dist/; nothing here
// reads the clock, because the site rebuilds daily (ADR 0003). Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projects } from './lib/projects.mjs';
import { earliestYear } from '../src/lib/work-order.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const read = (p) => readFileSync(p, 'utf8');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// agentic-workflow is category "tool", so it is named explicitly rather than found by category.
const ongoing = () => projects().filter((p) => p.category === 'mts' || p.slug === 'agentic-workflow');

test('the ongoing set is the MTS case studies plus agentic-workflow', () => {
  const slugs = ongoing().map((p) => p.slug);
  for (const s of ['mts-hub', 'wetlabs-app', 'agentic-workflow']) assert.ok(slugs.includes(s), `${s} missing`);
});

test('ongoing case-study periods are "<start with a year> – Present" and keep no frozen end', () => {
  for (const p of ongoing()) {
    assert.match(p.period, /^(?:[A-Z][a-z]{2} )?\d{4} – Present$/, `${p.slug}: ${p.period}`);
    assert.equal(p.period.includes('Oct 2026'), false, `${p.slug}: ${p.period}`);
  }
});

test('home timeline shows the two ongoing MTS rows as Present', () => {
  const html = read('dist/index.html');
  assert.ok(html.includes('Aug 2025 – Present'));
  assert.ok(html.includes('Jul 2026 – Present'));
  const timeline = html.match(/<ol class="timeline[\s\S]*?<\/ol>/)?.[0] ?? '';
  const rows = [...timeline.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
  for (const context of ['Software engineer, MTS', 'Platform lead']) {
    const row = rows.find((r) => r.includes(context));
    assert.ok(row, `timeline row "${context}" missing`);
    assert.equal(row.includes('Oct 2026'), false, row);
    assert.match(row, /Present/, row);
  }
});

test('case study pages show the Present period', () => {
  assert.ok(read('dist/work/mts-hub/index.html').includes('Jul 2026 – Present'));
  assert.ok(read('dist/work/agentic-workflow/index.html').includes('Jul 2026 – Present'));
  assert.ok(read('dist/work/wetlabs-app/index.html').includes('Aug 2025 – Present'));
});

test('/cv/ still shows the MTS case studies as a start only', () => {
  const periods = [...read('dist/cv/index.html').matchAll(/class="cv-period"[^>]*>([^<]*)/g)].map((m) => m[1].trim());
  assert.ok(periods.includes('Jul 2026'), periods.join(' | '));
  assert.ok(periods.includes('Aug 2025'), periods.join(' | '));
});

test('earliestYear ignores "Present" and keeps the year of an ongoing period', () => {
  assert.equal(earliestYear(['Jul 2026 – Present', '2022 – 2026']), 2022);
  assert.equal(earliestYear(['Jul 2026 – Present']), 2026);
});

// The freelance client track is ongoing (issue #189): every page that dates it says the same thing.
const CLIENT_PERIOD = 'Aug 2026 – Present';
const clientSlugs = ['east-coast-blinds', 'dublin-plein-air'];

test('client case-study frontmatter gives the freelance period, matching the CV entry', () => {
  const cv = read('src/content/cv/cv.md');
  assert.match(cv, new RegExp(`title: Freelance Software Engineer[\\s\\S]*?period: ${CLIENT_PERIOD}`));
  for (const slug of clientSlugs) {
    const p = projects().find((x) => x.slug === slug);
    assert.ok(p, `${slug} missing`);
    assert.equal(p.period, CLIENT_PERIOD, slug);
  }
});

test('home timeline, /work/ cards, case pages and /cv/ all tell the client track as ongoing', () => {
  const home = read('dist/index.html');
  const timeline = home.match(/<ol class="timeline[\s\S]*?<\/ol>/)?.[0] ?? '';
  const row = [...timeline.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0])).find((r) => r.includes('Infrastructure and client work'));
  assert.ok(row, 'client timeline row missing');
  assert.ok(row.includes(CLIENT_PERIOD), row);
  assert.equal(row.includes('Oct 2026'), false, row);
  const work = text(read('dist/work/index.html'));
  for (const slug of clientSlugs) {
    assert.ok(text(read(`dist/work/${slug}/index.html`)).includes(CLIENT_PERIOD), `${slug} page`);
  }
  assert.ok(work.includes(CLIENT_PERIOD), '/work/ cards');
  assert.equal(/Aug – Oct 2026/.test(work), false, '/work/ still has a frozen end');
  const periods = [...read('dist/cv/index.html').matchAll(/class="cv-period"[^>]*>([^<]*)/g)].map((m) => m[1].trim());
  assert.equal(periods[0], CLIENT_PERIOD, periods.join(' | '));
});

test('East Coast Blinds body keeps the cutover as still ahead, consistent with an open period', () => {
  const body = text(read('dist/work/east-coast-blinds/index.html'));
  assert.ok(body.includes('The swap itself is still ahead'));
});
