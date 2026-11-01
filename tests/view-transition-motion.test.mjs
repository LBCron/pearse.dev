// Asserts that cross-document view transitions follow the reduced-motion setting (#136):
// the layout opts in only under `prefers-reduced-motion: no-preference`, and the global
// reduced-motion block turns off the transition pseudo-elements as a backstop.
// Reads dist/ only; relies on `npm test`'s pretest build (run `npm run build` first when running alone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pageCss } from './lib/diagrams.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

/** Whitespace-collapsed CSS of everything the built page ships. */
const css = (file) => pageCss(readFileSync(file, 'utf8')).replace(/\s+/g, ' ');

/** Index of the `}` that closes the `{` at `open`, by brace depth. */
function closeOf(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error('unbalanced braces in CSS');
}

/** Every at-rule block whose prelude matches `preludeRe`, as { prelude, body, start, end }. */
function blocks(text, preludeRe) {
  const found = [];
  const re = /@[a-z-]+[^{};]*\{/g;
  for (let m; (m = re.exec(text)); ) {
    const prelude = m[0].slice(0, -1).trim();
    if (!preludeRe.test(prelude)) continue;
    const open = m.index + m[0].length - 1;
    const end = closeOf(text, open);
    found.push({ prelude, body: text.slice(open + 1, end), start: m.index, end });
  }
  return found;
}

const NO_PREF = /^@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)$/;
const REDUCE = /^@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)$/;
const OPT_IN = /^@view-transition$/;
const PSEUDOS = ['::view-transition-group(*)', '::view-transition-old(*)', '::view-transition-new(*)'];

const redirectSlug = readdirSync('dist/work').find((d) => {
  const f = `dist/work/${d}/index.html`;
  return existsSync(f) && /http-equiv="refresh"/.test(readFileSync(f, 'utf8'));
});
const article = readdirSync('dist/writing').find((d) => existsSync(`dist/writing/${d}/index.html`));

const PAGES = {
  home: 'dist/index.html',
  article: `dist/writing/${article}/index.html`,
  redirect: `dist/work/${redirectSlug}/index.html`,
};

test('the fixtures exist', () => {
  assert.ok(article, 'no built article under dist/writing');
  assert.ok(redirectSlug, 'no redirect page under dist/work');
});

for (const [name, file] of Object.entries(PAGES)) {
  test(`${name} page: the only view-transition opt-in sits inside a no-preference media block`, () => {
    const text = css(file);
    const optIns = blocks(text, OPT_IN);
    assert.equal(optIns.length, 1, `expected exactly one @view-transition rule, found ${optIns.length}`);
    assert.match(optIns[0].body.replace(/\s/g, ''), /^navigation:auto;?$/);
    const guards = blocks(text, NO_PREF).filter((g) => g.start < optIns[0].start && optIns[0].end < g.end);
    assert.equal(guards.length, 1, '@view-transition is not inside a prefers-reduced-motion: no-preference block');
    // No @view-transition anywhere outside that guard, i.e. none at the top level of any style.
    const outside = text.slice(0, guards[0].start) + text.slice(guards[0].end + 1);
    assert.doesNotMatch(outside, /@view-transition\b/, '@view-transition outside the no-preference guard');
  });

  test(`${name} page: the reduced-motion block disables the view-transition animations`, () => {
    const text = css(file);
    const reduce = blocks(text, REDUCE);
    assert.ok(reduce.length > 0, 'no prefers-reduced-motion: reduce block');
    for (const pseudo of PSEUDOS) {
      const rule = reduce
        .flatMap((b) => [...b.body.matchAll(/([^{}]+)\{([^{}]*)\}/g)])
        .find(([, sel]) => sel.split(',').map((s) => s.trim()).includes(pseudo));
      assert.ok(rule, `${pseudo} missing from the reduce block`);
      assert.match(rule[2].replace(/\s/g, ''), /(^|;)animation:none(!important)?(;|$)/, `${pseudo} does not set animation: none`);
    }
  });
}
