// Asserts the scene gate (#99): the pure rule's full truth table, that both components
// consult it before they dynamically import three.js (source order), and that the built home
// page keeps the two SVG posters, fetches no three.js up front, and still emits the chunk
// the desktop path imports.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneMode } from '../src/lib/scene-gate.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const OPEN = { webgl: true, reducedMotion: false, saveData: false, phoneViewport: false, lite: false };

test('sceneMode: gl only when webgl is on and every degrading flag is off', () => {
  assert.equal(sceneMode(OPEN), 'gl');
});

test('sceneMode: each single flag flips the result to poster', () => {
  assert.equal(sceneMode({ ...OPEN, webgl: false }), 'poster', 'no webgl');
  for (const flag of ['reducedMotion', 'saveData', 'phoneViewport', 'lite']) {
    assert.equal(sceneMode({ ...OPEN, [flag]: true }), 'poster', flag);
  }
});

test('sceneMode: full truth table over the five flags', () => {
  const keys = Object.keys(OPEN);
  for (let bits = 0; bits < 1 << keys.length; bits++) {
    const probe = Object.fromEntries(keys.map((k, i) => [k, Boolean(bits & (1 << i))]));
    const expected = probe.webgl && !probe.reducedMotion && !probe.saveData && !probe.phoneViewport && !probe.lite;
    assert.equal(sceneMode(probe), expected ? 'gl' : 'poster', JSON.stringify(probe));
  }
});

for (const [file, importer] of [
  ['src/components/Hero.astro', "import('../scripts/hero')"],
  ['src/components/StackObject.astro', "import('../scripts/stack')"],
]) {
  test(`${file} gates before it imports the scene`, () => {
    const full = readFileSync(file, 'utf8');
    // Only the client <script>: the header comment may mention the rule by name.
    const src = full.slice(full.indexOf('<script>'));
    assert.match(src, /import\s*\{[^}]*\bsceneMode\b[^}]*\}\s*from\s*'\.\.\/lib\/scene-gate'/, 'imports the shared gate');
    const gate = src.search(/\bsceneMode\(/);
    const load = src.indexOf(importer);
    assert.notEqual(gate, -1, 'calls the gate');
    assert.notEqual(load, -1, `contains ${importer}`);
    assert.ok(gate < load, `the first sceneMode( call comes before ${importer}`);
  });
}

test('dist/index.html keeps both posters and does not reference three.js', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  assert.equal(html.match(/data-mode="poster"/g)?.length, 2, 'two posters');
  assert.equal(html.includes('three.module'), false, 'no three.module reference');
});

test('the three.js chunk is still emitted for the desktop path', () => {
  const dir = join('dist', '_astro');
  assert.ok(existsSync(dir), 'dist/_astro exists');
  assert.ok(readdirSync(dir).some((f) => /^three\.module\..+\.js$/.test(f)), 'dist/_astro/three.module.*.js');
});

// The browser smoke run (scripts/smoke/) waits on `data-hero-ready`, so it must be set after every
// mode decision and never be in the static HTML, where it would make the wait pass at once (#119).
test('Hero.astro marks the settled hero after each of its three mode decisions', () => {
  const full = readFileSync('src/components/Hero.astro', 'utf8');
  const src = full.slice(full.indexOf('<script>'));
  const decisions = [...src.matchAll(/root\.dataset\.mode = '(poster|gl)';\n\s*root\.dataset\.heroReady = '';/g)];
  assert.equal(decisions.length, 3, 'no WebGL, gl mounted, import failed: each sets data-hero-ready right after data-mode');
  assert.equal(src.match(/root\.dataset\.mode =/g)?.length, 3, 'no mode assignment without the ready mark');
});

test('data-hero-ready exists only at runtime, and the hero chunk the smoke run looks for is emitted', () => {
  for (const file of ['dist/index.html', 'dist/404.html']) assert.equal(readFileSync(file, 'utf8').includes('data-hero-ready'), false, file);
  assert.ok(readdirSync(join('dist', '_astro')).some((f) => /^hero\.[\w-]+\.js$/.test(f)), 'dist/_astro/hero.*.js');
});
