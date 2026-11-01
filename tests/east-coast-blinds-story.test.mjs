// Asserts the East Coast Blinds cutover is told one way everywhere (#106): same-server
// vhost swap behind Cloudflare, WordPress kept on disk, rollback is a config change, no
// DNS or origin change. The case study page is read from dist/ (`npm test`'s pretest build);
// the post is a draft and the case study's social copy is not rendered, so both are also
// read from their markdown source. The LinkedIn doc describes the client without naming
// it, so its freelance block is found by heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

// The production cutover is still open in the client's tracker, so copy must describe the
// plan, not an event. When it is closed: set this to true, rewrite the copy in the past
// tense, and the origin/DNS assertions below still apply. The tense guard only catches
// the phrases listed in DONE_PHRASES; the reviewer reads the rest.
const CUTOVER_DONE = false;

// Ban only these four. The bare word "DNS" stays allowed: the post's paragraph that
// rejects the big-bang "change DNS" option is deliberate.
const OLD_STORY = /origin switch|new origin|origin change|DNS change away/i;

const DONE_PHRASES = /took over|on the night|cutover was|went live|cutover day/i;
const SURVIVED = /survived real traffic/i; // a claim in the case study and LinkedIn; conditional advice in the post

const read = (p) => readFileSync(p, 'utf8');
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const caseDist = strip(read('dist/work/east-coast-blinds/index.html'));
const caseSrc = read('src/content/projects/east-coast-blinds.md');
const postSrc = read('src/content/posts/wordpress-to-wagtail-without-breaking-the-business.md');

const linkedin = read('docs/profile/linkedin.md');
const section = (() => {
  const start = linkedin.indexOf('### 1. Freelance software engineer');
  assert.ok(start >= 0, 'freelance position heading');
  const next = linkedin.indexOf('\n### ', start + 4);
  return linkedin.slice(start, next < 0 ? undefined : next);
})();
const block = section.match(/\n```\n([\s\S]*?)\n```/)?.[1];

test('built case study tells the same-server vhost story', () => {
  assert.doesNotMatch(caseDist, OLD_STORY);
  assert.match(caseDist, /same server/i);
  assert.match(caseDist, /vhost|web-server config/i);
});

test('case study source (incl. social copy) has no origin/DNS cutover wording', () => {
  assert.doesNotMatch(caseSrc, OLD_STORY);
});

test('post source (incl. social copy) has no origin/DNS cutover wording', () => {
  assert.doesNotMatch(postSrc, OLD_STORY);
});

test('LinkedIn freelance block has no origin/DNS cutover wording', () => {
  assert.ok(block, 'fenced block in the freelance position');
  assert.doesNotMatch(block, OLD_STORY);
});

test('LinkedIn freelance description count equals the block length', () => {
  assert.ok(block, 'fenced block in the freelance position');
  const stated = Number(section.match(/\*\*Description:\*\* ([\d,]+) characters/)?.[1].replace(/,/g, ''));
  assert.ok(Number.isFinite(stated), 'Description line states a number');
  assert.equal(stated, block.length, 'stated characters = text between the fences, newlines included');
  assert.ok(stated <= 2000, 'at or under the 2,000 limit');
});

test('tense guard: cutover is described as planned, not done', { skip: CUTOVER_DONE }, () => {
  assert.doesNotMatch(caseSrc, DONE_PHRASES, 'case study source');
  assert.doesNotMatch(caseSrc, SURVIVED, 'case study source');
  assert.doesNotMatch(postSrc, DONE_PHRASES, 'post source');
  assert.ok(block, 'fenced block in the freelance position');
  assert.doesNotMatch(block, DONE_PHRASES, 'LinkedIn freelance block');
  assert.doesNotMatch(block, SURVIVED, 'LinkedIn freelance block');
});
