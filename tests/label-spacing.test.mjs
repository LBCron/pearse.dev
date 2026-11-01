// Headings and mono labels are built as `<b>1</b> post`: the gap on screen is a flex `gap`, so
// without a real space after `</b>` textContent and the accessible name run the words together
// ("Writingabout this project", "1posts"; #197, and #69 before it). Walks every built page.
// Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countNoun } from '../src/lib/count-label.ts';
import { parseHtml, find, text, hasClass } from './lib/html.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

/** Every built HTML page under dist/, as a path relative to dist/. */
function pages(dir = 'dist') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

const HEADING = /^h[1-6]$/;
const isTarget = (n) => typeof n !== 'string' && (HEADING.test(n.tag) || hasClass(n, 'label'));
const squash = (s) => s.replace(/\s+/g, ' ').trim();

/** A `<b>` inside a heading or label whose next sibling is text starting with a letter or digit. */
function runTogether(html) {
  const hits = [];
  for (const el of find(parseHtml(html), isTarget)) {
    for (const b of find(el, (n) => typeof n !== 'string' && n.tag === 'b')) {
      const sibs = b.parent.children;
      const next = sibs[sibs.indexOf(b) + 1];
      if (typeof next === 'string' && /^[\p{L}\p{N}]/u.test(next)) hits.push(squash(text(el)));
    }
  }
  return hits;
}

const textOf = (file, pred) => {
  const el = find(parseHtml(readFileSync(file, 'utf8')), pred)[0];
  assert.ok(el, `${file}: element not found`);
  return squash(text(el));
};

test('runTogether flags </b> followed directly by a letter, not by a space', () => {
  assert.deepEqual(runTogether('<h2 class="label"><b>Writing</b>about this project</h2>'), ['Writingabout this project']);
  assert.deepEqual(runTogether('<p class="label"><b>01</b>posts</p>'), ['01posts']);
  assert.deepEqual(runTogether('<h2><b>Writing</b> about this project</h2>'), []);
  assert.deepEqual(runTogether('<p class="label"><b>01</b><span aria-hidden="true">—</span>Work</p>'), []);
  assert.deepEqual(runTogether('<p><b>Bold</b>text outside any heading or label</p>'), []);
});

test('no heading or label on any built page runs </b> into the next word', () => {
  const files = pages();
  assert.ok(files.length > 10, 'dist/ has pages; run the build first');
  const bad = files.flatMap((f) => runTogether(readFileSync(f, 'utf8')).map((t) => `${f}: "${t}"`));
  assert.deepEqual(bad, []);
});

test('the related-writing heading reads "Writing about this project"', () => {
  assert.equal(textOf('dist/work/pearse-dev/index.html', (n) => typeof n !== 'string' && n.attrs.id === 'related-title'), 'Writing about this project');
});

test('countNoun pluralises on the count and does not zero-pad', () => {
  assert.deepEqual(countNoun(1, 'post'), { n: '1', noun: 'post' });
  assert.deepEqual(countNoun(0, 'post'), { n: '0', noun: 'posts' });
  assert.deepEqual(countNoun(2, 'post'), { n: '2', noun: 'posts' });
  assert.deepEqual(countNoun(12, 'post'), { n: '12', noun: 'posts' });
});

test('the /writing/ count label matches the number of published posts, singular for one', () => {
  const label = textOf('dist/writing/index.html', (n) => typeof n !== 'string' && n.tag === 'p' && hasClass(n, 'label'));
  const rows = (readFileSync('dist/rss.xml', 'utf8').match(/<item>/g) ?? []).length;
  const { n, noun } = countNoun(rows, 'post');
  assert.equal(label, `${n} ${noun}/RSS`);
  assert.doesNotMatch(label, /^0\d/);
});
