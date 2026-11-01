// Asserts the hero pacing rules (#117): the pure rules in src/lib/frame-pacing.ts, that every
// restart path resets the idle clock and `dt`, the shape of the built hero chunk, and that the
// stack scene keeps calling visibleLoop with no options.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hoverForMove, isIdle, onWake, pacingFor, shouldRender } from '../src/lib/frame-pacing.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

test('pacingFor: about 33.3 ms when coarse, low-end or both; uncapped otherwise; idle is 20 s', () => {
  for (const [coarse, lowEnd, capped] of [
    [true, false, true],
    [false, true, true],
    [true, true, true],
    [false, false, false],
  ]) {
    const p = pacingFor({ coarse, lowEnd });
    if (capped) assert.ok(Math.abs(p.minFrameMs - 33.3) < 0.1, `coarse=${coarse} lowEnd=${lowEnd}: ${p.minFrameMs}`);
    else assert.equal(p.minFrameMs, 0);
    assert.equal(p.idleMs, 20000);
  }
});

test('shouldRender: gated by the minimum interval, always true when uncapped', () => {
  assert.equal(shouldRender(1010, 1000, 33.3), false, '10 ms after');
  assert.equal(shouldRender(1034, 1000, 33.3), true, '34 ms after');
  assert.equal(shouldRender(1000, 1000, 0), true, 'uncapped, same instant');
  assert.equal(shouldRender(999, 1000, 0), true, 'uncapped, clock slightly behind');
});

test('isIdle: false at 19 999 ms, true at 20 000 ms; a zero idle window never pauses', () => {
  assert.equal(isIdle(19999, 0, 20000), false);
  assert.equal(isIdle(20000, 0, 20000), true);
  assert.equal(isIdle(1e9, 0, 0), false);
});

test('onWake: an idle loop is no longer idle after a wake, and dt starts at zero', () => {
  const last = { lastInput: 0, lastRendered: 0 };
  const now = 60000;
  assert.equal(isIdle(now, last.lastInput, 20000), true, 'precondition: idle');
  const woke = onWake(now);
  assert.equal(isIdle(now + 1, woke.lastInput, 20000), false);
  assert.equal(now - woke.lastRendered, 0, 'no dt jump');
});

test('hoverForMove: touch is ignored; mouse and pen are 1 inside and 0 outside', () => {
  assert.equal(hoverForMove({ pointerType: 'touch', inside: true }), null);
  assert.equal(hoverForMove({ pointerType: 'touch', inside: false }), null);
  for (const pointerType of ['mouse', 'pen']) {
    assert.equal(hoverForMove({ pointerType, inside: true }), 1, pointerType);
    assert.equal(hoverForMove({ pointerType, inside: false }), 0, pointerType);
  }
});

test('built hero chunk: window-level exit handling, no dead canvas pointerleave', () => {
  const chunks = readdirSync('dist/_astro').filter((f) => /^hero\..*\.js$/.test(f));
  assert.equal(chunks.length, 1, `exactly one hero chunk, got ${chunks.join(', ')}`);
  const js = readFileSync(`dist/_astro/${chunks[0]}`, 'utf8');
  for (const needle of ['pointerout', 'blur', 'pointerType']) assert.ok(js.includes(needle), `contains ${needle}`);
  assert.ok(!js.includes('pointerleave'), 'does not contain pointerleave');
});

test('source wiring: the hero opts in, the stack does not, and every restart path uses onWake', () => {
  const hero = readFileSync('src/scripts/hero.ts', 'utf8');
  assert.match(hero, /visibleLoop\(canvas, draw, pacingFor\(/);
  const stack = readFileSync('src/scripts/stack.ts', 'utf8');
  assert.match(stack, /visibleLoop\(canvas, draw\)/);
  const env = readFileSync('src/scripts/env.ts', 'utf8');
  const start = env.slice(env.indexOf('const start = () =>'), env.indexOf('const io = new'));
  assert.match(start, /onWake\(/, 'start (used by input, visibility and intersection) resets via onWake');
});
