// The verify-marker rule: the pure walk and publish check (src/lib/verify-marker.ts) on fixtures,
// and a backstop over every text file in the build made by `pretest`, which also covers pages
// that have no feed entry (home, /now/, /cv/, /work/). Errors and failures name ids, paths and
// files only, never the marked text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERIFY_EXEMPT, VERIFY_MARKER, assertPublishable, findVerifyMarkers } from '../src/lib/verify-marker.ts';
import { BINARY_EXT, isBinary } from '../scripts/binary-files.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const MARKED = 'Text [VERIFY: check this] more.';
const KINDS = ['article', 'standalone', 'project'];

/** The thrown error, so the tests can read its message. */
function thrown(fn) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  assert.fail('expected a throw');
}

test('findVerifyMarkers: dotted paths through nested objects and array indices', () => {
  const value = {
    title: MARKED,
    social: { linkedin: 'Clean.', short: MARKED },
    sections: [{ summary: 'Clean.' }, { summary: 'Clean.' }, { summary: MARKED, features: ['Clean.', MARKED] }],
    tags: [MARKED, 'clean'],
  };
  assert.deepEqual(findVerifyMarkers(value), ['title', 'social.short', 'sections.2.summary', 'sections.2.features.1', 'tags.0']);
});

test('findVerifyMarkers: non-string leaves are skipped', () => {
  const value = { date: new Date('2026-11-01'), order: 3, featured: true, repo: null, live: undefined, list: [1, false, null] };
  assert.deepEqual(findVerifyMarkers(value), []);
  assert.deepEqual(findVerifyMarkers({ order: 3, note: { when: new Date(), text: MARKED } }), ['note.text']);
});

test('findVerifyMarkers: no hits is an empty list, and a bare string reports its prefix', () => {
  assert.deepEqual(findVerifyMarkers({ title: 'Clean', tags: ['a', 'b'], sections: [] }), []);
  assert.deepEqual(findVerifyMarkers('Clean'), []);
  assert.deepEqual(findVerifyMarkers(MARKED, 'body'), ['body']);
  assert.deepEqual(findVerifyMarkers([MARKED]), ['0']);
});

test('findVerifyMarkers: the match is the literal prefix, case-sensitive', () => {
  assert.deepEqual(findVerifyMarkers({ a: '[verify: x]', b: 'VERIFY: x', c: 'please verify this', d: '[VERIFY]' }), ['d']);
});

for (const kind of KINDS) {
  test(`assertPublishable(${kind}): a body hit throws naming the kind, the id and body, never the marker`, () => {
    const e = thrown(() => assertPublishable(kind, 'x-1', { title: 'Clean' }, MARKED));
    assert.match(e.message, new RegExp(`^${kind}.*"x-1".*\\bbody\\b`));
    assert.equal(e.message.includes(VERIFY_MARKER), false, e.message);
    assert.equal(e.message.includes('check this'), false, e.message);
  });

  test(`assertPublishable(${kind}): clean data and body pass`, () => {
    assert.doesNotThrow(() => assertPublishable(kind, 'x-1', { title: 'Clean', tags: ['a'], when: new Date() }, 'Clean body.'));
  });

  test(`assertPublishable(${kind}): missing data or body throws instead of passing`, () => {
    assert.throws(() => assertPublishable(kind, 'x-1', undefined, ''), TypeError);
    assert.throws(() => assertPublishable(kind, 'x-1', { title: 'Clean' }, undefined), TypeError);
  });
}

test('assertPublishable: a deep frontmatter hit throws and names its path', () => {
  const cases = [
    ['article', { title: 'T', tags: ['clean', MARKED] }, 'tags.1'],
    ['article', { title: 'T', tags: [MARKED] }, 'tags.0'],
    ['standalone', { title: 'T', visual: MARKED, short: 'S' }, 'visual'],
    ['project', { title: 'T', sections: [{ id: 'a', summary: MARKED, features: ['F'] }] }, 'sections.0.summary'],
  ];
  for (const [kind, data, path] of cases) {
    const e = thrown(() => assertPublishable(kind, 'deep', data, 'Clean.'));
    assert.match(e.message, new RegExp(`^${kind}.*"deep".*in ${path.replaceAll('.', '\\.')};`), `${kind} ${path}`);
    assert.equal(e.message.includes(VERIFY_MARKER), false, e.message);
  }
});

test('assertPublishable: every hit path is listed, frontmatter first, then body', () => {
  const e = thrown(() => assertPublishable('article', 'many', { title: MARKED, social: { linkedin: MARKED, short: 'S' } }, MARKED));
  assert.match(e.message, /in title, social\.linkedin, body;/);
});

test('assertPublishable: a hit only in standalone note does not throw; note is exempt for standalone only', () => {
  assert.deepEqual(VERIFY_EXEMPT, { article: [], standalone: ['note'], project: [] });
  assert.doesNotThrow(() => assertPublishable('standalone', 's-1', { title: 'T', note: MARKED }, 'Clean.'));
  // The exemption is a top-level field name, not a substring: a nested `note` is still checked.
  assert.throws(() => assertPublishable('standalone', 's-1', { extra: { note: MARKED } }, 'Clean.'), /in extra\.note;/);
  for (const kind of ['article', 'project']) {
    assert.throws(() => assertPublishable(kind, 'n-1', { note: MARKED }, 'Clean.'), /in note;/, kind);
  }
});

/** Every file under `dir`, with forward-slash paths. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test('no built file carries a verify marker (dist backstop; binaries skipped as scripts/gate.mjs skips them)', () => {
  assert.ok(existsSync('dist/index.html'), 'dist/ is missing: run `npm run build` first (npm test does it in pretest)');
  const scanned = [];
  const hits = [];
  for (const file of walk('dist')) {
    if (BINARY_EXT.has(extname(file).toLowerCase())) continue;
    const buf = readFileSync(file);
    if (isBinary(buf)) continue;
    scanned.push(file);
    // Only the file path is reported, never the text around the marker.
    if (buf.toString('utf8').includes(VERIFY_MARKER)) hits.push(file);
  }
  // Not vacuous: the pages with no feed entry, and the feeds themselves, were read.
  for (const f of ['dist/index.html', 'dist/now/index.html', 'dist/cv/index.html', 'dist/work/index.html', 'dist/social.json', 'dist/rss.xml']) {
    assert.ok(scanned.includes(f), `${f} was not scanned`);
  }
  assert.deepEqual(hits, [], `verify marker in ${hits.length} built file(s): ${hits.join(', ')}`);
});
