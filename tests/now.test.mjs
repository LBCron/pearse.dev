// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

test('/now/ page has updated date and mailto link', () => {
  const html = readFileSync('dist/now/index.html', 'utf8');
  assert.match(html, /Updated /);
  assert.match(html, /href="mailto:pearse@pearse\.dev(\?subject=[^"&]*)?"/);
  assert.match(html, /href="https:\/\/nownownow\.com\/about"[^>]*rel="noopener"/);
});

test('sitemap lists /now/', () => {
  assert.match(readFileSync('dist/sitemap-0.xml', 'utf8'), /\/now\//);
});

test('footer on the home page links to /now/', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const footer = html.slice(html.indexOf('<footer'));
  assert.match(footer, /href="\/now\/"/);
});

test('/now/ document title does not repeat the site name', () => {
  const html = readFileSync('dist/now/index.html', 'utf8');
  assert.match(html, /<title>Now — Pearse D’Arcy<\/title>/);
});

test('/now/ timeline link lands on the Timeline heading, not About', () => {
  const now = readFileSync('dist/now/index.html', 'utf8');
  assert.match(now, /href="\/#timeline"/);
  const home = readFileSync('dist/index.html', 'utf8');
  assert.match(home, /<h3 id="timeline"[^>]*>/);
});
