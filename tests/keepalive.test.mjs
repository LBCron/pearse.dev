// Issue #100: the weekly keepalive workflow that keeps the daily deploy cron from being disabled
// after 60 idle days (ADR 0003). Reads the workflow YAML only, not dist/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const workflow = parse(readFileSync(`${ROOT}.github/workflows/keepalive.yml`, 'utf8'));

// yaml 2.x (YAML 1.2) parses `on` as a string key; a YAML 1.1 parser yields boolean `true`.
const triggers = workflow.on ?? workflow[true];
const jobs = Object.values(workflow.jobs ?? {});
const steps = jobs.flatMap((job) => job.steps ?? []);

test('triggers are a schedule and a manual dispatch', () => {
  assert.ok(triggers, 'workflow has an on: map');
  assert.ok('schedule' in triggers, 'has schedule');
  assert.ok('workflow_dispatch' in triggers, 'has workflow_dispatch');
});

test('the schedule is weekly: one entry, a single day-of-week', () => {
  assert.equal(triggers.schedule.length, 1, 'exactly one schedule entry');
  const fields = triggers.schedule[0].cron.trim().split(/\s+/);
  assert.equal(fields.length, 5, 'cron has five fields');
  const [, , dayOfMonth, month, dayOfWeek] = fields;
  assert.equal(dayOfMonth, '*');
  assert.equal(month, '*');
  assert.match(dayOfWeek, /^([0-6]|sun|mon|tue|wed|thu|fri|sat)$/i, 'one day, no list, range, step or wildcard');
});

test('permissions are exactly actions: write, and no job grants contents: write', () => {
  assert.deepEqual(workflow.permissions, { actions: 'write' });
  for (const job of jobs) {
    assert.notEqual(job.permissions?.contents, 'write', 'no job grants contents: write');
  }
});

test('the step enables deploy.yml and keepalive.yml with the workflow token', () => {
  const step = steps.find((s) => typeof s.run === 'string' && s.run.includes('gh api'));
  assert.ok(step, 'a step runs gh api');
  for (const name of ['deploy.yml', 'keepalive.yml']) {
    const call = `gh api -X PUT repos/\${{ github.repository }}/actions/workflows/${name}/enable`;
    assert.ok(step.run.includes(call), `run contains: ${call}`);
  }
  assert.equal(step.env?.GH_TOKEN, '${{ github.token }}');
});

test('nothing is checked out, committed or pushed', () => {
  assert.ok(steps.length > 0, 'the workflow has steps');
  for (const step of steps) {
    assert.ok(!/actions\/checkout/.test(step.uses ?? ''), 'no actions/checkout');
    assert.ok(!/git\s+(commit|push)/.test(step.run ?? ''), 'no git commit or git push');
  }
});
