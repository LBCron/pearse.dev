// Asserts the closed post-tag vocabulary (issue #166): every post uses only tags from
// src/lib/tags.ts, every tag is carried by at least two posts (drafts included, so no entry is
// unused or a one-off), each tag maps to one of the four README pillars, and the chips in
// dist/ (the Topics list and each post page) are vocabulary tags.
// Nothing here depends on today's date: which posts are live changes daily (ADR 0003), so the
// source checks read every post file and the dist checks accept any number of chips, even none.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { PILLARS, POST_TAGS, TAG_PILLAR } from '../src/lib/tags.ts';
import { find, hasClass, parseHtml, text } from './lib/html.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POSTS = `${ROOT}/src/content/posts`;
const README_PILLARS = ['Platform building (Django)', 'Self-hosted AI in production', 'Agentic engineering', 'Career'];

/** Every post file, drafts included: its raw frontmatter text and the parsed data. */
const posts = readdirSync(POSTS)
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => {
    const raw = readFileSync(`${POSTS}/${f}`, 'utf8').split(/^---$/m)[1];
    return { file: f, slug: f.replace(/\.mdx?$/, ''), raw, data: parse(raw) ?? {} };
  });

test('there are posts to check', () => {
  assert.ok(posts.length > 0);
});

test('the vocabulary has at most 8 tags, each mapped to a README pillar', () => {
  assert.ok(POST_TAGS.length <= 8, `${POST_TAGS.length} tags`);
  assert.deepEqual([...POST_TAGS].sort(), Object.keys(TAG_PILLAR).sort());
  assert.deepEqual([...PILLARS], README_PILLARS);
  for (const tag of POST_TAGS) assert.ok(README_PILLARS.includes(TAG_PILLAR[tag]), `${tag} -> ${TAG_PILLAR[tag]}`);
});

test('every post has 1-3 tags, all in the vocabulary', () => {
  for (const { file, data } of posts) {
    assert.ok(Array.isArray(data.tags), `${file}: tags is a list`);
    assert.ok(data.tags.length >= 1 && data.tags.length <= 3, `${file}: ${data.tags.length} tags`);
    assert.equal(new Set(data.tags).size, data.tags.length, `${file}: duplicate tag`);
    for (const t of data.tags) assert.ok(POST_TAGS.includes(t), `${file}: "${t}" is not in the vocabulary`);
  }
});

test('every post writes its tags in flow style', () => {
  for (const { file, raw } of posts) assert.match(raw, /^tags: \[[^\]\n]+\]\s*$/m, `${file}: use "tags: [a, b]"`);
});

test('every vocabulary tag is carried by at least two posts, drafts included', () => {
  for (const tag of POST_TAGS) {
    const carriers = posts.filter((p) => p.data.tags.includes(tag)).map((p) => p.slug);
    assert.ok(carriers.length >= 2, `"${tag}" is carried by ${carriers.length} post(s): ${carriers.join(', ') || 'none'}`);
  }
});

const chips = (html, label) => {
  const lists = find(parseHtml(html), (e) => e.tag === 'ul' && e.attrs['aria-label'] === label);
  return lists.flatMap((ul) => find(ul, (e) => e.tag === 'li' && hasClass(e, 'chip')).map((li) => text(li).trim()));
};

test('every chip in the /writing/ Topics list is a vocabulary tag', () => {
  const html = readFileSync(`${ROOT}/dist/writing/index.html`, 'utf8');
  for (const t of chips(html, 'Topics')) assert.ok(POST_TAGS.includes(t), `Topics chip "${t}" is not in the vocabulary`);
});

test('every chip on each built post page is a vocabulary tag', () => {
  for (const { slug, data } of posts) {
    const page = `${ROOT}/dist/writing/${slug}/index.html`;
    if (!existsSync(page)) continue; // not built yet: a draft or a future-dated post
    const found = chips(readFileSync(page, 'utf8'), 'Tags');
    assert.deepEqual(found, data.tags, `${slug}: page chips match the frontmatter tags`);
    for (const t of found) assert.ok(POST_TAGS.includes(t), `${slug}: chip "${t}" is not in the vocabulary`);
  }
});
