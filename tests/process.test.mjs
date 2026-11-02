// "How the job ran" (#160): the shared process steps (src/lib/process.ts), which client case
// studies list them, that every proof stays within facts its own page already states, and how
// the block renders. The module is loaded directly through Node type stripping; the rendered
// checks read dist/ and rely on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESS_STEPS, PROCESS_STEP_IDS, processIssues } from '../src/lib/process.ts';
import { projects, pendingSlugs } from './lib/projects.mjs';
import { parseHtml, find, text } from './lib/html.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const ORDER = ['audit', 'staging', 'gated', 'cutover', 'written-down'];

// The decision in #160, checked clause by clause against each page. Do not add `cutover` to
// dublin-plein-air (an in-place upgrade), `gated` to m-buildz (a dry run is not an undo), or
// any step to east-coast-blinds (one backed step is not a process; #114 can add more).
const PINNED = {
  'pauldarcy-ie': ['audit', 'staging', 'gated', 'cutover', 'written-down'],
  'dublin-plein-air': ['audit', 'staging', 'gated', 'written-down'],
  'm-buildz': ['audit', 'staging', 'written-down'],
};

const steps = (ids) => ids.map((step) => ({ step }));
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (NAMED[e.toLowerCase()] ?? m),
  );

test('process.ts has no imports and lists the steps in canonical order', () => {
  const src = readFileSync('src/lib/process.ts', 'utf8');
  assert.doesNotMatch(src, /^\s*import[\s{*'"]/m, 'no import statement');
  assert.doesNotMatch(src, /\bimport\s*\(/, 'no dynamic import');
  assert.deepEqual(PROCESS_STEPS.map((s) => s.id), ORDER);
  assert.deepEqual([...PROCESS_STEP_IDS], ORDER);
  for (const s of PROCESS_STEPS) {
    assert.ok(s.title && s.promise, `${s.id}: title and promise`);
  }
  // "Handover" is not a step: no page says anything was handed to the client.
  assert.equal(PROCESS_STEPS.at(-1).title, 'Written down');
});

test('processIssues flags duplicates, order, unknown ids and single steps', () => {
  const dup = processIssues(steps(['audit', 'staging', 'audit']));
  assert.equal(dup.length, 1);
  assert.equal(dup[0].index, 2);
  assert.match(dup[0].message, /duplicate/);

  const order = processIssues(steps(['staging', 'audit']));
  assert.equal(order.length, 1);
  assert.equal(order[0].index, 1);
  assert.match(order[0].message, /out of order/);

  const unknown = processIssues(steps(['audit', 'handover']));
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].index, 1);
  assert.match(unknown[0].message, /unknown/);

  const single = processIssues(steps(['cutover']));
  assert.equal(single.length, 1);
  assert.equal(single[0].index, 0);
  assert.match(single[0].message, /at least two/);

  assert.deepEqual(processIssues([]), [], 'no process is fine');
  assert.deepEqual(processIssues(steps(ORDER)), [], 'all five in order');
});

test('processIssues accepts every real entry', () => {
  const withProcess = projects().filter((p) => (p.process ?? []).length > 0);
  assert.equal(withProcess.length, Object.keys(PINNED).length);
  for (const p of withProcess) assert.deepEqual(processIssues(p.process), [], p.slug);
});

test('the schema runs processIssues and keeps process to client case studies', () => {
  const src = readFileSync('src/content.config.ts', 'utf8');
  assert.match(src, /step: z\.enum\(PROCESS_STEP_IDS\)/);
  assert.match(src, /proof: z\.string\(\)\.max\(160\)/);
  assert.match(src, /processIssues\(steps\)/);
  assert.match(src, /d\.category !== 'client' && d\.process\.length > 0/);
});

test('each client case study lists exactly its pinned steps; no other project has any', () => {
  for (const p of projects()) {
    const ids = (p.process ?? []).map((s) => s.step);
    if (p.slug in PINNED) {
      assert.equal(p.category, 'client', p.slug);
      assert.deepEqual(ids, PINNED[p.slug], p.slug);
    } else {
      assert.deepEqual(ids, [], `${p.slug}: no process`);
    }
  }
});

/** The project file's text without its `process:` block, so a proof cannot vouch for itself. */
function withoutProcess(file) {
  const src = readFileSync(`src/content/projects/${file}`, 'utf8');
  return src.replace(/^process:\n(?:[ \t]+.*\n)*/m, '');
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('no new facts: every number and proper noun in a proof is already on its page', () => {
  for (const p of projects()) {
    if (!(p.process ?? []).length) continue;
    const rest = withoutProcess(p.file);
    assert.ok(!/^process:/m.test(rest), `${p.slug}: process block removed`);
    for (const { step, proof } of p.process) {
      assert.ok(proof.length <= 160, `${p.slug}/${step}: at most 160 characters`);
      assert.match(proof, /\.$/, `${p.slug}/${step}: ends a sentence`);
      assert.doesNotMatch(proof, /[.!?]\s/, `${p.slug}/${step}: one sentence`);
      const digits = proof.match(/\d+/g) ?? [];
      const words = (proof.match(/[A-Za-z][\w'’-]*/g) ?? []).slice(1).filter((w) => /^[A-Z]/.test(w));
      for (const token of [...digits, ...words]) {
        assert.match(rest, new RegExp(`(?<![\\w])${escape(token)}(?![\\w])`, 'i'), `${p.slug}/${step}: "${token}" appears elsewhere on the page`);
      }
    }
  }
});

test('each pinned page renders one "How the job ran" block with promises and proofs in order', () => {
  const byId = new Map(PROCESS_STEPS.map((s) => [s.id, s]));
  for (const [slug, ids] of Object.entries(PINNED)) {
    const html = readFileSync(`dist/work/${slug}/index.html`, 'utf8');
    assert.equal(html.match(/id="process-title"/g)?.length, 1, `${slug}: one process heading`);
    const root = parseHtml(html);
    const [h2] = find(root, (e) => e.attrs.id === 'process-title');
    assert.equal(h2.tag, 'h2', slug);
    assert.equal(squash(text(h2)), 'How the job ran', `${slug}: heading text`);
    const [section] = find(root, (e) => e.tag === 'section' && e.attrs['aria-labelledby'] === 'process-title');
    assert.ok(section, `${slug}: labelled section`);
    const [ol] = find(section, (e) => e.tag === 'ol');
    assert.ok(ol, `${slug}: ordered list`);
    const items = ol.children.filter((c) => typeof c !== 'string' && c.tag === 'li');
    assert.deepEqual(items.map((li) => li.attrs['data-step']), ids, `${slug}: canonical order`);
    const entries = projects().find((p) => p.slug === slug).process;
    items.forEach((li, i) => {
      const t = squash(decode(text(li)));
      const step = byId.get(ids[i]);
      assert.ok(t.includes(step.title), `${slug}/${ids[i]}: title`);
      assert.ok(t.includes(step.promise), `${slug}/${ids[i]}: promise verbatim`);
      assert.ok(t.includes(squash(entries[i].proof)), `${slug}/${ids[i]}: proof`);
    });
  }
});

test('the block sits after the body and sections, before related writing, contact and the case nav', () => {
  for (const slug of Object.keys(PINNED)) {
    const html = readFileSync(`dist/work/${slug}/index.html`, 'utf8');
    const at = html.indexOf('id="process-title"');
    const notes = html.search(/<section[^>]*aria-label="Notes"/);
    assert.ok(notes > 0, `${slug}: body present`);
    assert.ok(notes < at, `${slug}: after the body`);
    const sections = html.indexOf('id="sections-title"');
    if (sections >= 0) assert.ok(sections < at, `${slug}: after "in depth"`);
    for (const later of ['id="related-title"', 'id="contact-title"']) {
      const i = html.indexOf(later);
      if (i >= 0) assert.ok(at < i, `${slug}: before ${later}`);
    }
    const nav = html.indexOf('<nav class="case-nav');
    assert.ok(nav > 0, `${slug}: case nav`);
    assert.ok(at < nav, `${slug}: before the case nav`);
  }
});

/** Every built HTML page under dist/, as a path relative to the repo root. */
function pages(dir = 'dist') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

test('no other page carries the process block', () => {
  const allowed = new Set(Object.keys(PINNED).map((slug) => join('dist', 'work', slug, 'index.html')));
  const all = pages();
  assert.ok(all.length > Object.keys(PINNED).length);
  for (const p of all) {
    if (allowed.has(p)) continue;
    assert.ok(!readFileSync(p, 'utf8').includes('process-title'), `${p}: no process block`);
  }
});

test('pending client case studies are not built, so their process cannot leak', () => {
  for (const slug of pendingSlugs()) {
    assert.ok(!existsSync(`dist/work/${slug}`), `${slug}: not built`);
  }
});
