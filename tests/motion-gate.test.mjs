// Asserts the motion gate (#135): the pure rule, that its selector list stays in step with
// src/scripts/motion.ts, that the layout asks it before importing the motion chunk, and the built
// output. Dist assertions name only index.html and 404.html and report counts, never other slugs.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION_TARGETS, shouldLoadMotion } from '../src/lib/motion-gate.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

/** A root whose querySelector matches only the listed selectors. */
const rootMatching = (...matching) => ({ querySelector: (sel) => (matching.includes(sel) ? {} : null) });

test('MOTION_TARGETS lists the three selectors', () => {
  assert.deepEqual([...MOTION_TARGETS], ['[data-split]', '[data-reveal]', '.hero-letter:not(.is-space)']);
});

test('shouldLoadMotion: false when nothing matches', () => {
  assert.equal(shouldLoadMotion(rootMatching(), false), false);
});

test('shouldLoadMotion: false under reduced motion even if every selector matches', () => {
  assert.equal(shouldLoadMotion(rootMatching(...MOTION_TARGETS), true), false);
});

for (const selector of MOTION_TARGETS) {
  test(`shouldLoadMotion: true when only ${selector} matches`, () => {
    assert.equal(shouldLoadMotion(rootMatching(selector), false), true);
  });
}

test('MOTION_TARGETS and the querySelectorAll literals in motion.ts are the same set', () => {
  const src = readFileSync('src/scripts/motion.ts', 'utf8');
  for (const selector of MOTION_TARGETS) assert.ok(src.includes(selector), `motion.ts contains ${selector}`);
  const literals = [...src.matchAll(/querySelectorAll(?:<[^>]*>)?\(\s*(['"`])(.*?)\1\s*\)/g)].map((m) => m[2]);
  assert.ok(literals.length > 0, 'found querySelectorAll literals');
  for (const literal of literals) assert.ok(MOTION_TARGETS.includes(literal), `${literal} is in MOTION_TARGETS`);
});

test('Base.astro asks shouldLoadMotion inside onIdle before it imports the motion script', () => {
  const full = readFileSync('src/layouts/Base.astro', 'utf8');
  // Only the client <script>: the frontmatter and comments may mention the names.
  const src = full.slice(full.lastIndexOf('<script>'));
  assert.match(src, /import\s*\{[^}]*\bshouldLoadMotion\b[^}]*\}\s*from\s*'\.\.\/lib\/motion-gate'/, 'imports the gate');
  const idle = src.indexOf('onIdle(');
  const gate = src.search(/\bshouldLoadMotion\(/);
  const load = src.indexOf("import('../scripts/motion')");
  assert.notEqual(idle, -1, 'calls onIdle');
  assert.notEqual(load, -1, 'imports the motion script');
  assert.ok(idle < gate && gate < load, 'onIdle( then shouldLoadMotion( then import(motion)');
});

const astroDir = join('dist', '_astro');
const chunks = () => readdirSync(astroDir).filter((f) => f.endsWith('.js'));

test('the layout entry chunk still dynamically imports the motion chunk', () => {
  const entries = chunks().filter((f) => /^Base\.astro_astro_type_script_index_0_lang\..+\.js$/.test(f));
  assert.equal(entries.length, 1, 'one layout entry chunk');
  const code = readFileSync(join(astroDir, entries[0]), 'utf8');
  assert.match(code, /import\(\s*[`'"][^`'"]*motion\.[^`'"]*\.js[`'"]\s*\)/, 'dynamic import of motion.*.js');
  assert.ok(chunks().some((f) => /^motion\..+\.js$/.test(f)), 'motion.*.js is emitted');
});

test('each motion target string survives in a built chunk other than motion.*.js', () => {
  const others = chunks().filter((f) => !/^motion\./.test(f));
  for (const selector of MOTION_TARGETS) {
    const hits = others.filter((f) => readFileSync(join(astroDir, f), 'utf8').includes(selector));
    assert.ok(hits.length >= 1, `${selector} appears in ${hits.length} non-motion chunks`);
  }
});

// Element attributes only: every page inlines the .hero-letter CSS rule, so a text search would hit /404.
function hasMotionTarget(html) {
  for (const tag of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const t = tag[0];
    if (/\sdata-split[\s=>]/.test(t) || /\sdata-reveal[\s=>]/.test(t)) return true;
    const cls = /\sclass=("([^"]*)"|'([^']*)'|([^\s>]+))/.exec(t);
    if (cls && /(^|\s)hero-letter(\s|$)/.test(cls[2] ?? cls[3] ?? cls[4])) return true;
  }
  return false;
}

test('dist/index.html has a motion target and dist/404.html has none', () => {
  assert.equal(hasMotionTarget(readFileSync('dist/index.html', 'utf8')), true, 'dist/index.html');
  assert.equal(hasMotionTarget(readFileSync('dist/404.html', 'utf8')), false, 'dist/404.html');
});
