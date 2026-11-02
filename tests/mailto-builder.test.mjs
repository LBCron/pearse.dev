// Unit tests for the mailto builder (#153), loaded straight from source under Node's type
// stripping. The built pages are checked in tests/mailto.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE } from '../src/lib/site.ts';
import { ADDRESS_URI, MAX_BODY, MAX_HREF, SUBJECTS, aboutProjectHref, buildMailto, encodeMailtoValue } from '../src/lib/mailto.ts';

const CONTEXTS = ['home', 'cv', 'now', 'brief'];
const parse = (href) => new URL(href);

test('the subjects are exactly the closed set of four', () => {
  assert.deepEqual(Object.keys(SUBJECTS).sort(), [...CONTEXTS].sort());
  assert.deepEqual(SUBJECTS, {
    home: 'Hello from pearse.dev',
    cv: 'Re: your CV',
    now: 'Re: your /now/ page',
    brief: 'Brief from pearse.dev',
  });
});

test('every context is mailto: + SITE.email with exactly its subject and no body', () => {
  for (const c of CONTEXTS) {
    const m = buildMailto(c);
    assert.ok(m.href.startsWith(`mailto:${SITE.email}?`), m.href);
    const url = parse(m.href);
    assert.equal(url.pathname, SITE.email);
    assert.deepEqual([...url.searchParams.keys()], ['subject']);
    assert.equal(decodeURIComponent(m.href.split('subject=')[1]), SUBJECTS[c]);
    assert.equal(m.subject, SUBJECTS[c]);
    assert.equal(m.truncated, false);
    assert.equal(m.text, `To: ${SITE.email}\nSubject: ${SUBJECTS[c]}`);
  }
  assert.equal(ADDRESS_URI, `mailto:${SITE.email}`);
});

test('a body with reserved, non-ASCII and line-break characters encodes per RFC 6068 and round-trips', () => {
  const body = 'Q #1 & Q 2? 1+1\nPearse D’Arcy, Grüße\r\nlast line';
  const m = buildMailto('brief', body);
  const query = m.href.slice(m.href.indexOf('?') + 1);
  assert.equal((query.match(/&/g) ?? []).length, 1, 'one & separator only');
  assert.doesNotMatch(m.href, /[ +#\n\r]/, 'no raw space, +, # or line break');
  assert.doesNotMatch(m.href.slice(m.href.indexOf('?') + 1), /\?/, 'no raw ? after the separator');
  assert.doesNotMatch(m.href, /[^\x21-\x7e]/, 'ASCII only');
  const encoded = query.split('&body=')[1];
  assert.ok(encoded.includes('%0D%0A'), 'line breaks are %0D%0A');
  assert.doesNotMatch(encoded.replaceAll('%0D%0A', ''), /%0A|%0D/, 'no bare CR or LF');
  assert.equal(decodeURIComponent(encoded), body.replace(/\r?\n/g, '\r\n'));
  assert.equal(m.body, body.replace(/\r\n/g, '\n'));
  assert.equal(m.truncated, false);
  assert.equal(m.text, `To: ${SITE.email}\nSubject: ${SUBJECTS.brief}\n\n${m.body}`);
  // The query parses to the same two keys a browser would see.
  const url = parse(m.href);
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  assert.equal(url.searchParams.get('subject'), SUBJECTS.brief);
});

test('encodeMailtoValue never leaves a raw reserved character', () => {
  assert.equal(encodeMailtoValue('a b+c#d&e?f%g'), 'a%20b%2Bc%23d%26e%3Ff%25g');
  assert.equal(encodeMailtoValue('a\nb\rc\r\nd'), 'a%0D%0Ab%0D%0Ac%0D%0Ad');
  assert.equal(encodeMailtoValue('ü'), '%C3%BC');
  assert.equal(encodeMailtoValue('x\uD800y'), 'x%EF%BF%BDy', 'a lone surrogate becomes U+FFFD, not a throw');
});

test('a body over MAX_BODY is truncated, says so, and the href stays under 2,000 characters', () => {
  const long = 'word '.repeat(MAX_BODY);
  const m = buildMailto('brief', long);
  assert.equal(m.truncated, true);
  assert.ok(m.body.length <= MAX_BODY, `${m.body.length}`);
  assert.ok(long.startsWith(m.body), 'the href carries a prefix of the input');
  assert.ok(m.href.length < 2000, `${m.href.length}`);
  assert.ok(m.href.length <= MAX_HREF);
  assert.ok(m.text.endsWith(long), 'the clipboard text keeps the whole body');
});

test('a body exactly MAX_BODY long of plain ASCII is not truncated', () => {
  const m = buildMailto('brief', 'a'.repeat(MAX_BODY));
  assert.equal(m.truncated, false);
  assert.equal(m.body.length, MAX_BODY);
});

test('bodies that encode long are cut to fit the href, on a code point boundary', () => {
  for (const body of ['ü'.repeat(MAX_BODY), '\n'.repeat(MAX_BODY), '😀'.repeat(MAX_BODY)]) {
    const m = buildMailto('brief', body);
    assert.equal(m.truncated, true);
    assert.ok(m.href.length <= MAX_HREF && m.href.length < 2000, `${m.href.length}`);
    assert.ok(body.startsWith(m.body));
    assert.doesNotThrow(() => decodeURIComponent(m.href.split('&body=')[1]));
  }
});

test('aboutProjectHref builds the case-study subject from the title, encoded', () => {
  assert.equal(aboutProjectHref('MTS Hub'), `mailto:${SITE.email}?subject=About%20MTS%20Hub`);
  const odd = aboutProjectHref('Q&A? Time');
  assert.ok(odd.includes('Q%26A%3F%20Time'), odd);
  assert.ok(!odd.slice(odd.indexOf('subject=')).match(/[&?]/), 'no raw & or ? in the subject');
});

test('the builder imports ./site.ts and nothing else', () => {
  const src = readFileSync(new URL('../src/lib/mailto.ts', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^\s*import\b[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const bare = [...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const dynamic = [...src.matchAll(/\bimport\s*\(/g)];
  assert.deepEqual(imports, ['./site.ts']);
  assert.deepEqual(bare, []);
  assert.equal(dynamic.length, 0);
  assert.doesNotMatch(src, /\brequire\s*\(/);
});
