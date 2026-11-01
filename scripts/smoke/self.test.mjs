// Self-test for the browser smoke run (npm run smoke:self). It runs scripts/smoke/smoke.mjs over
// the fixture site in scripts/smoke/fixture/ (one page that throws, one with a 400 px element, one
// clean page) with the site-specific checks off, and asserts the run fails for the right reasons.
// Not part of `npm test`, which only reads dist/ and needs no browser.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const HERE = import.meta.dirname;

test('the smoke run fails on the fixture site, reports both defects and spares the clean page', () => {
  const out = mkdtempSync(join(tmpdir(), 'smoke-self-'));
  try {
    const run = spawnSync(
      process.execPath,
      [join(HERE, 'smoke.mjs'), '--dist', join(HERE, 'fixture'), '--out', out, '--skip', 'hero,transitions'],
      { encoding: 'utf8', timeout: 120_000 },
    );
    const output = run.stdout + run.stderr;
    assert.notEqual(run.status, 0, `expected a failing run:\n${output}`);
    assert.match(output, /smoke: 3 sitemap URLs, 0 redirect pages/);

    const { failures } = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    const thrown = failures.filter((f) => f.check === 'console' && f.where === '/throws/');
    assert.ok(thrown.some((f) => /page error: .*thrown on purpose/.test(f.message)), `no thrown error reported:\n${output}`);
    const wide = failures.filter((f) => f.check === 'overflow' && f.where === '/wide/ @ 320px');
    assert.ok(wide.some((f) => /div#too-wide \(400px\)/.test(f.message)), `no 320 px overflow reported:\n${output}`);
    assert.equal(failures.filter((f) => f.where.startsWith('/clean/')).length, 0, 'the clean page is listed as failing');
    assert.doesNotMatch(output.split('\n').filter((l) => l.startsWith('FAIL')).join('\n'), /\/clean\//);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
