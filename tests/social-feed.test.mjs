// Asserts the shape, ordering and draft exclusion of /social.json for both kinds
// (articles and standalone posts), the pure buildFeed rules on fixtures, and that the
// standalone migration is idempotent. Reads the build made by `pretest`.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/lib/site.ts';
import { buildFeed } from '../src/lib/feed.ts';
import { parse as parseYaml } from 'yaml';
import { projects } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

let feed;

before(() => {
  assert.ok(existsSync('dist/social.json'), 'dist/social.json is missing: run `npm run build` first (npm test does it in pretest)');
  feed = JSON.parse(readFileSync('dist/social.json', 'utf8'));
});

/** Source ids whose frontmatter matches `re`. */
function sourceIds(dir, re) {
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f) && re.test(readFileSync(join(dir, f), 'utf8').split(/^---$/m)[1] ?? ''))
    .map((f) => f.replace(/\.mdx?$/, ''));
}

test('feed is a JSON array of well-formed entries', () => {
  assert.ok(Array.isArray(feed));
  for (const e of feed) {
    assert.ok(['article', 'standalone', 'project'].includes(e.kind), `kind ${e.kind}`);
    assert.equal(typeof e.id, 'string');
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.equal(typeof e.status, 'string', e.id);
    assert.equal(typeof e.published, 'boolean', e.id);
    assert.ok(e.social?.linkedin?.length > 0, `${e.id} linkedin`);
    assert.ok(e.social?.short?.length > 0, `${e.id} short`);
  }
});

test('feed is sorted by date ascending', () => {
  const dates = feed.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort());
});

test('no draft entries of either kind', () => {
  assert.equal(feed.some((e) => e.status === 'draft'), false);
  const ids = new Set(feed.map((e) => `${e.kind}:${e.id}`));
  for (const id of sourceIds('src/content/posts', /^draft:\s*true\s*$/m)) assert.equal(ids.has(`article:${id}`), false, id);
  for (const id of sourceIds('src/content/social', /^status:\s*draft\s*$/m)) assert.equal(ids.has(`standalone:${id}`), false, id);
  // Approved standalone posts are all present, future-dated or not.
  for (const id of sourceIds('src/content/social', /^status:\s*approved\s*$/m)) assert.ok(ids.has(`standalone:${id}`), id);
});

test('article entries keep the legacy fields and link to their page', () => {
  const articles = feed.filter((e) => e.kind === 'article');
  assert.ok(articles.length >= 1);
  for (const e of articles) {
    assert.ok(e.url.startsWith(`${SITE.url}/writing/`), e.url);
    assert.equal(e.slug, e.id);
    assert.equal(e.pubDate, e.date);
    assert.ok(Array.isArray(e.tags));
  }
});

test('feed ids are unique: the scheduler keys its Posting record by id', () => {
  const ids = feed.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every visible case study with social copy is a published project entry linking its built page', () => {
  const expected = projects().filter((p) => p.visible && p.social).map((p) => p.slug).sort();
  const entries = feed.filter((e) => e.kind === 'project');
  assert.deepEqual(entries.map((e) => e.id).sort(), expected);
  for (const e of entries) {
    assert.equal(e.published, true, e.id);
    assert.equal(e.status, 'approved', e.id);
    assert.equal(e.url, `${SITE.url}/work/${e.id}/`, e.id);
    assert.ok(existsSync(`dist/work/${e.id}/index.html`), `${e.id} page`);
    assert.ok(e.social.linkedin.includes(e.url), `${e.id} linkedin links the page`);
    assert.ok(e.social.short.includes(e.url), `${e.id} short links the page`);
  }
});

test('the four client case studies are in the feed as published project entries', () => {
  const byId = new Map(feed.filter((e) => e.kind === 'project').map((e) => [e.id, e]));
  for (const slug of ['east-coast-blinds', 'dublin-plein-air', 'm-buildz', 'pauldarcy-ie']) {
    assert.equal(byId.get(slug)?.category, 'client', slug);
    assert.equal(byId.get(slug)?.published, true, slug);
  }
});

test('standalone entries are always published and never carry a url', () => {
  for (const e of feed.filter((x) => x.kind === 'standalone')) {
    assert.equal(e.published, true, e.id);
    assert.equal('url' in e, false, e.id);
  }
});

test('migrate-standalone writes one file per post, preserves markers, and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrate-'));
  try {
    const input = join(dir, 'in.json');
    const out = join(dir, 'social');
    writeFileSync(
      input,
      JSON.stringify({
        posts: [
          {
            id: 'P01',
            title: 'A "quoted" title',
            pillar: 'Agentic engineering',
            format: 'Short lesson',
            date: '2026-11-04',
            visual: 'none',
            status: 'approved',
            linkedin: 'First line [VERIFY: is this right? yes.] ends here. Second sentence.\n\nMore.',
            note: 'client post',
          },
          { id: 'P02', title: 'Two', pillar: 'Platform building (Django)', format: 'X', date: '2026-11-05', status: 'draft', linkedin: 'Only.' },
        ],
      }),
    );
    const run = () => {
      const r = spawnSync(process.execPath, ['scripts/migrate-standalone.mjs', input, out], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      return Object.fromEntries(readdirSync(out).sort().map((f) => [f, readFileSync(join(out, f), 'utf8')]));
    };
    const first = run();
    assert.deepEqual(Object.keys(first), ['p01.md', 'p02.md']);
    const p01 = first['p01.md'];
    assert.match(p01, /^title: "A \\"quoted\\" title"$/m);
    assert.match(p01, /^date: 2026-11-04$/m);
    assert.match(p01, /^status: approved$/m);
    assert.match(p01, /^note: "client post"$/m);
    assert.ok(p01.includes(`\nshort: "First line [VERIFY: is this right? yes.] ends here. ${SITE.url}"\n`));
    assert.ok(p01.endsWith('\n---\n\nFirst line [VERIFY: is this right? yes.] ends here. Second sentence.\n\nMore.\n'));
    assert.match(first['p02.md'], /^visual: "none"$/m);
    assert.doesNotMatch(first['p02.md'], /^note:/m);
    assert.deepEqual(run(), first);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// buildFeed: the merge, filter and sort rules on plain fixtures, independent of today's content.
const NOW = new Date('2026-11-10T12:00:00Z');
const copy = { linkedin: ' L ', short: ' S ' };
const article = (id, pubDate, draft = false, extra = {}) => ({ id, title: id, description: 'D.', pubDate: new Date(pubDate), draft, tags: ['t'], url: `${SITE.url}/writing/${id}/`, body: 'Body.', social: copy, ...extra });
const standalone = (id, date, status = 'approved', body = 'Copy.') => ({
  id, title: id, date: new Date(date), pillar: 'Agentic engineering', format: 'Short lesson', visual: 'none', status, short: 'S', body,
});

test('buildFeed: drafts of both kinds are excluded, the rest sorted ascending across kinds, articles win ties', () => {
  const out = buildFeed(
    [article('future', '2026-12-01'), article('tie', '2026-11-05'), article('draft-a', '2026-11-01', true), article('past', '2026-10-01')],
    [standalone('s-tie', '2026-11-05'), standalone('s-draft', '2026-11-02', 'draft'), standalone('s-early', '2026-10-15')],
    NOW,
  );
  assert.deepEqual(out.map((e) => `${e.kind}:${e.id}`), ['article:past', 'standalone:s-early', 'article:tie', 'standalone:s-tie', 'article:future']);
  assert.ok(out.every((e) => e.status === 'approved'));
});

test('buildFeed: a future-dated article is in the feed as scheduled', () => {
  const [e] = buildFeed([article('future', '2026-12-01')], [], NOW);
  assert.equal(e.published, false);
  assert.equal(e.status, 'approved');
  assert.equal(e.date, '2026-12-01');
  assert.equal(e.pubDate, '2026-12-01');
  assert.equal(e.slug, 'future');
  assert.deepEqual(e.social, { linkedin: 'L', short: 'S' });
});

test('buildFeed: a future-dated approved standalone post is published and has no url', () => {
  const [e] = buildFeed([], [standalone('s-future', '2027-01-01', 'approved', '\nBody copy.\n')], NOW);
  assert.equal(e.kind, 'standalone');
  assert.equal(e.published, true);
  assert.equal('url' in e, false);
  assert.equal(e.social.linkedin, 'Body copy.');
});

test('buildFeed: an approved standalone post with a verify marker in its body throws', () => {
  assert.throws(() => buildFeed([], [standalone('s-bad', '2026-11-20', 'approved', 'Copy [VERIFY: check].')], NOW), /s-bad.*\[VERIFY\]/);
  // The same body on a draft is fine: drafts are never in the feed.
  assert.deepEqual(buildFeed([], [standalone('s-bad', '2026-11-20', 'draft', 'Copy [VERIFY: check].')], NOW), []);
});

test('buildFeed: a non-draft article with a verify marker in its body throws, naming the id', () => {
  const bad = article('a-bad', '2026-11-01', false, { body: 'Text [VERIFY: check this] more.' });
  assert.throws(() => buildFeed([bad], [], NOW), /a-bad.*\[VERIFY\].*resolve it or set draft: true/);
});

test('buildFeed: a future-dated non-draft article with a verify marker throws (the gate for scheduled posts)', () => {
  const bad = article('a-future-bad', '2026-12-24', false, { body: 'Text [VERIFY: check this] more.' });
  assert.ok(bad.pubDate > NOW);
  assert.throws(() => buildFeed([bad], [], NOW), /a-future-bad.*resolve it or set draft: true/);
});

test('buildFeed: a verify marker only in the article social copy throws', () => {
  const li = article('a-li', '2026-11-01', false, { social: { linkedin: 'L [VERIFY: x]', short: 'S' } });
  const sh = article('a-sh', '2026-12-24', false, { social: { linkedin: 'L', short: 'S [VERIFY: x]' } });
  assert.throws(() => buildFeed([li], [], NOW), /a-li.*resolve it or set draft: true/);
  assert.throws(() => buildFeed([sh], [], NOW), /a-sh.*resolve it or set draft: true/);
});

test('buildFeed: a future-dated non-draft article with a verify marker in its body throws, naming the article and field; as a draft it does not', () => {
  const bad = article('a-body', '2026-12-24', false, { body: 'Text [VERIFY: x] more.' });
  assert.throws(
    () => buildFeed([bad], [], NOW),
    { message: 'Article "a-body" is not a draft but still has a [VERIFY] marker in its body; resolve it or set draft: true.' },
  );
  assert.deepEqual(buildFeed([{ ...bad, draft: true }], [], NOW), []);
});

test('buildFeed: a verify marker in a non-draft article title, description, LinkedIn or short copy throws, naming the field', () => {
  const cases = [
    ['title', { title: 'T [VERIFY: x]' }],
    ['description', { description: 'D [VERIFY: x]' }],
    ['LinkedIn copy', { social: { linkedin: 'L [VERIFY: x]', short: 'S' } }],
    ['short copy', { social: { linkedin: 'L', short: 'S [VERIFY: x]' } }],
  ];
  for (const [field, extra] of cases) {
    const bad = article('a-field', '2026-12-24', false, extra);
    assert.throws(
      () => buildFeed([bad], [], NOW),
      { message: `Article "a-field" is not a draft but still has a [VERIFY] marker in its ${field}; resolve it or set draft: true.` },
      field,
    );
    assert.deepEqual(buildFeed([{ ...bad, draft: true }], [], NOW), [], `${field} on a draft`);
  }
});

/** Every article source file as a buildFeed input: frontmatter plus the Markdown body. */
function sourceArticles() {
  const dir = 'src/content/posts';
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const [, front, ...rest] = readFileSync(join(dir, f), 'utf8').split(/^---\s*$/m);
      const d = parseYaml(front);
      const id = f.replace(/\.mdx?$/, '');
      return {
        id, title: d.title, description: d.description, pubDate: new Date(d.pubDate), draft: d.draft ?? false,
        tags: d.tags, url: `${SITE.url}/writing/${id}/`, body: rest.join('---'), social: d.social,
      };
    });
}

test('buildFeed: every non-draft article in the source passes the verify-marker guard', () => {
  const articles = sourceArticles();
  const live = articles.filter((a) => !a.draft);
  assert.ok(live.length > 0, 'no non-draft articles');
  const out = buildFeed(articles, [], NOW);
  assert.deepEqual(out.map((e) => e.id).sort(), live.map((a) => a.id).sort());
});

test('buildFeed: a draft article with a verify marker does not throw and is left out', () => {
  const draft = article('a-draft', '2026-12-24', true, { body: 'Text [VERIFY: x].', social: { linkedin: 'L [VERIFY: x]', short: 'S' } });
  assert.deepEqual(buildFeed([draft], [], NOW), []);
  // A clean article beside it still comes through.
  assert.deepEqual(buildFeed([draft, article('ok', '2026-11-01')], [], NOW).map((e) => e.id), ['ok']);
});

const project = (id, date, extra = {}) => ({
  id, title: id, category: 'client', clientPermission: 'granted', url: `${SITE.url}/work/${id}/`,
  social: { date: new Date(date), linkedin: ' L ', short: ' S ' }, ...extra,
});

test('buildFeed: visible case studies with copy are published project entries, sorted after posts on ties', () => {
  const out = buildFeed(
    [article('tie', '2026-11-05')],
    [standalone('s-tie', '2026-11-05')],
    NOW,
    [project('c-tie', '2026-11-05'), project('c-early', '2026-10-01'), project('mts', '2027-01-01', { category: 'mts', clientPermission: undefined })],
  );
  assert.deepEqual(out.map((e) => `${e.kind}:${e.id}`), ['project:c-early', 'article:tie', 'standalone:s-tie', 'project:c-tie', 'project:mts']);
  const [e] = out;
  assert.equal(e.published, true);
  assert.equal(e.status, 'approved');
  assert.equal(e.url, `${SITE.url}/work/c-early/`);
  assert.equal(e.category, 'client');
  assert.deepEqual(e.social, { linkedin: 'L', short: 'S' });
});

test('buildFeed: pending client case studies and case studies without copy are not in the feed', () => {
  const out = buildFeed([], [], NOW, [
    project('pending', '2026-11-05', { clientPermission: 'pending' }),
    project('default', '2026-11-05', { clientPermission: undefined }),
    project('no-copy', '2026-11-05', { social: undefined }),
    project('anon', '2026-11-05', { clientPermission: 'anonymised' }),
  ]);
  assert.deepEqual(out.map((e) => e.id), ['anon']);
});

test('buildFeed: case study copy with a verify marker throws, unless the case study is hidden', () => {
  const bad = (extra) => project('c-bad', '2026-11-05', { social: { date: new Date('2026-11-05'), linkedin: 'L [VERIFY: x]', short: 'S' }, ...extra });
  assert.throws(() => buildFeed([], [], NOW, [bad()]), /c-bad.*\[VERIFY\]/);
  assert.deepEqual(buildFeed([], [], NOW, [bad({ clientPermission: 'pending' })]), []);
});
