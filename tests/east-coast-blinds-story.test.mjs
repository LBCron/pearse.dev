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
import { CUTOVER_DONE } from '../src/lib/east-coast-blinds.ts';
import { eastCoastBlinds } from '../src/components/diagrams/east-coast-blinds.ts';
import { prepare } from '../src/components/diagrams/layout.ts';
import { diagramSvgs, textOf } from './lib/diagrams.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

// CUTOVER_DONE (src/lib/east-coast-blinds.ts) says whether the production cutover has
// happened. While it is false, copy and the diagram must describe the plan, not an event.
// When it flips: rewrite the copy in the past tense; the diagram follows the flag, and the
// origin/DNS assertions below still apply. The tense guard only catches the phrases listed
// in DONE_PHRASES; the reviewer reads the rest.

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

// The diagram follows the same flag (#203): before the cutover it draws today's live path
// (Apache serving WordPress) with the Django proxy marked planned, and says nothing about a
// live vhost or a rollback; after it, the swapped vhost with WordPress behind a rollback edge.
const POST_CUTOVER = /live vhost|rollback/i;

/** Every visible word of one diagram state, per layout: node names and subs, edge labels. */
function labels(layout) {
  return [...layout.nodes.flatMap((n) => [n.label, ...(n.sub ?? [])]), ...layout.edges.map((e) => e.label ?? '')].join(' | ');
}
const edge = (layout, from, to) => layout.edges.find((e) => e.from === from && e.to === to);

for (const done of [false, true]) {
  test(`diagram labels for CUTOVER_DONE=${done}`, () => {
    const d = eastCoastBlinds(done);
    for (const [name, layout] of [['wide', d.wide], ['narrow', d.narrow]]) {
      assert.doesNotThrow(() => prepare(layout, `east-coast-blinds ${name} done=${done}`), `${name}: labels fit`);
      const text = labels(layout);
      const toWordpress = edge(layout, 'apache', 'wordpress');
      const toDjango = edge(layout, 'apache', 'django');
      assert.ok(toWordpress && toDjango, `${name}: Apache reaches WordPress and Django`);
      if (done) {
        assert.match(text, /live vhost/, `${name}: Apache is the live vhost`);
        assert.equal(toDjango.flow, true, `${name}: the proxy to Django is the live path`);
        assert.equal(toDjango.label, 'reverse proxy', name);
        assert.equal(toWordpress.rollback, true, `${name}: WordPress is reached only by rollback`);
        assert.equal(toWordpress.label, 'rollback', name);
      } else {
        assert.doesNotMatch(text, POST_CUTOVER, `${name}: post-cutover wording before the cutover`);
        assert.equal(toWordpress.flow, true, `${name}: Apache serving WordPress is the live path`);
        assert.ok(!toWordpress.rollback, name);
        assert.ok(!toDjango.flow, `${name}: the proxy to Django is not live yet`);
        assert.match(toDjango.label, /planned/, `${name}: the proxy to Django is marked planned`);
      }
    }
    if (done) {
      assert.match(d.desc, /rollback/);
    } else {
      assert.doesNotMatch(`${d.title} ${d.desc}`, POST_CUTOVER, 'title and description');
      assert.doesNotMatch(`${d.title} ${d.desc}`, DONE_PHRASES, 'title and description');
      assert.match(d.desc, /planned/);
    }
  });
}

test('built diagram is drawn for the current CUTOVER_DONE', () => {
  const html = read('dist/work/east-coast-blinds/index.html');
  const svgs = diagramSvgs(html).filter((svg) => svg.includes('aria-labelledby="diagram-east-coast-blinds-title"'));
  assert.equal(svgs.length, 1, 'one East Coast Blinds diagram');
  const text = textOf(svgs[0]);
  const expected = eastCoastBlinds(CUTOVER_DONE);
  for (const layout of [expected.wide, expected.narrow]) {
    for (const e of layout.edges.filter((e) => e.label)) assert.ok(text.includes(e.label), `edge label "${e.label}"`);
  }
  if (CUTOVER_DONE) {
    assert.match(text, /live vhost/);
    assert.match(text, /rollback/);
  } else {
    assert.doesNotMatch(text, POST_CUTOVER, 'post-cutover wording in the built diagram');
    assert.doesNotMatch(text, DONE_PHRASES, 'done-tense wording in the built diagram');
    assert.match(text, /planned/);
  }
});
