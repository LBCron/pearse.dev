// Asserts the East Coast Blinds case study is a full case study (#114): a headed Notes body
// of real length, told in its own sentences rather than pasted from the social copy shown
// or posted beside the page, and in agreement with the reconciled cutover facts (#106): a
// vhost swap on the same server, so no DNS or origin wording anywhere, diagram included.
// Reads dist/ (`npm test`'s pretest build) and, for the unrendered social copy, the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { diagramSvgs, textOf } from './lib/diagrams.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const SRC = 'src/content/projects/east-coast-blinds.md';
const source = readFileSync(SRC, 'utf8');
const [, front, ...rest] = source.split(/^---$/m);
const data = parse(front);
const body = rest.join('---');
const html = readFileSync('dist/work/east-coast-blinds/index.html', 'utf8');

// #106 chose the same-server vhost swap; these phrases belong to the rejected Cloudflare
// origin switch and must not appear in anything the case study shows or posts.
const REJECTED = [/DNS change/i, /new origin/i, /origin switch/i, /origin change/i];

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** The Notes section, from its opening tag to the matching </section>. */
function notesHtml() {
  const open = html.match(/<section\b[^>]*aria-label="Notes"[^>]*>/);
  assert.ok(open, 'Notes section');
  const tag = /<section\b|<\/section>/g;
  tag.lastIndex = open.index;
  let depth = 0;
  for (let m; (m = tag.exec(html)); ) {
    depth += m[0] === '</section>' ? -1 : 1;
    if (depth === 0) return html.slice(open.index, tag.lastIndex);
  }
  assert.fail('unterminated Notes section');
}
const notes = notesHtml();
const notesText = decode(notes.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Sentences as #114 defines them: URLs out, split on . ! ? + space, letters/digits only. */
const sentences = (text) =>
  text
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/[.!?]\s+/)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
const long = (text) => sentences(text).filter((s) => s.split(' ').length >= 8);

test('Notes is a headed case study of real length', () => {
  assert.ok((notes.match(/<h2\b/g) ?? []).length >= 2, 'at least two h2 in Notes');
  const words = notesText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  assert.ok(words >= 250, `Notes has ${words} words`);
});

test('Notes shares no sentence of 8+ words with the social copy or hooks', () => {
  const copy = { 'social.linkedin': data.social.linkedin, 'social.short': data.social.short, hooks: data.hooks.join('\n') };
  const mine = long(notesText);
  assert.ok(mine.length > 5, 'Notes sentences found');
  for (const [field, text] of Object.entries(copy)) {
    const theirs = long(text);
    const theirsJoined = sentences(text).join(' ');
    const mineJoined = sentences(notesText).join(' ');
    for (const s of mine) assert.equal(theirsJoined.includes(s), false, `Notes repeats ${field}: "${s}"`);
    for (const s of theirs) assert.equal(mineJoined.includes(s), false, `Notes repeats ${field}: "${s}"`);
  }
});

test('the overlap normaliser splits and cleans as specified', () => {
  assert.deepEqual(sentences('One, two! Three? See https://pearse.dev/x/ now. Done'), ['one two', 'three', 'see now', 'done']);
  assert.deepEqual(long('A b c d e f g h. Short one.'), ['a b c d e f g h']);
});

test('no [VERIFY marker in the source or the built page', () => {
  assert.equal(source.includes('[VERIFY'), false, SRC);
  assert.equal(html.includes('[VERIFY'), false, 'dist page');
});

test('no rejected cutover wording in body, features, hooks, social copy or diagram', () => {
  const diagram = diagramSvgs(html).map(textOf).join(' ');
  assert.ok(diagram.length > 100, 'diagram text');
  const fields = {
    body,
    features: data.features.join('\n'),
    hooks: data.hooks.join('\n'),
    'social.linkedin': data.social.linkedin,
    'social.short': data.social.short,
    diagram,
  };
  for (const [field, text] of Object.entries(fields)) {
    for (const re of REJECTED) assert.doesNotMatch(text, re, field);
  }
});
