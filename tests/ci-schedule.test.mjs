// Issue #154: the daily scheduled rebuild (ADR 0003) skips Lighthouse and nothing else.
// Parses the two workflow files; reads no dist/. Steps are looked up by exact name and a
// missing name fails loudly, so a rename cannot make these pass vacuously.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${ROOT}${path}`, 'utf8');
const check = parse(read('.github/workflows/check.yml'));
const deploy = parse(read('.github/workflows/deploy.yml'));
const steps = check.jobs.check.steps;

const step = (name) => {
  const found = steps.filter((s) => s.name === name);
  assert.equal(
    found.length,
    1,
    `check.yml job "check" must have exactly one step named "${name}" (found ${found.length}); if it was renamed, update this test and ADR 0003`,
  );
  return found[0];
};
const norm = (expr) => String(expr ?? '').replace(/\s+/g, ' ').trim();

test('"Lighthouse budget" runs only when the event is not schedule', () => {
  assert.equal(norm(step('Lighthouse budget').if), "github.event_name != 'schedule'");
});

test('"Upload Lighthouse report" keeps always() and skips schedule', () => {
  assert.equal(norm(step('Upload Lighthouse report').if), "always() && github.event_name != 'schedule'");
});

test('the other checks have no if: that excludes schedule', () => {
  for (const name of ['Type and content check', 'Build', 'Link crawl', 'Tests', 'Confidentiality gate']) {
    assert.doesNotMatch(norm(step(name).if), /schedule/, `step "${name}" must still run on schedule`);
  }
});

test('no step guards on github.event.schedule', () => {
  for (const s of steps) assert.doesNotMatch(norm(s.if), /event\.schedule/, `step "${s.name}"`);
});

test('deploy.yml keeps the 06:00 UTC cron and build-gating on check, with no guard on the check job', () => {
  assert.ok(
    (deploy.on.schedule ?? []).some((e) => e.cron === '0 6 * * *'),
    'deploy.yml schedule cron is 0 6 * * *',
  );
  assert.equal(deploy.jobs.check.uses, './.github/workflows/check.yml');
  assert.equal(deploy.jobs.check.if, undefined, 'the check job in deploy.yml must not be skipped on schedule');
  assert.equal(deploy.jobs.deploy.needs, 'check');
});
