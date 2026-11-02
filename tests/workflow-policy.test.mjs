// Issue #140: least-privilege policy for every workflow in .github/workflows/. `check()` is a
// pure function (object in, violations out); the fixtures below prove each rule can fail.
// Reads no dist/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { check } from './lib/workflow-policy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = `${ROOT}.github/workflows/`;
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

const checkout = (withBlock) => ({ uses: 'actions/checkout@v7', ...(withBlock ? { with: withBlock } : {}) });
const good = (over = {}) => ({
  permissions: { contents: 'read' },
  jobs: { build: { 'runs-on': 'ubuntu-latest', steps: [checkout({ 'persist-credentials': false }), { run: 'true' }] } },
  ...over,
});

test('there are workflows to check', () => {
  assert.ok(files.length >= 3, files.join(', '));
});

for (const file of files) {
  test(`${file} passes the workflow policy`, () => {
    const workflow = parse(readFileSync(`${DIR}${file}`, 'utf8'));
    assert.deepEqual(check(workflow), []);
  });
}

test('the deploy workflow maps CONFIDENTIAL_PATTERNS by name and never inherits', () => {
  const deploy = parse(readFileSync(`${DIR}deploy.yml`, 'utf8'));
  assert.deepEqual(deploy.jobs.check.secrets, { CONFIDENTIAL_PATTERNS: '${{ secrets.CONFIDENTIAL_PATTERNS }}' });
  const called = parse(readFileSync(`${DIR}check.yml`, 'utf8')).on.workflow_call.secrets;
  assert.deepEqual(Object.keys(called), ['CONFIDENTIAL_PATTERNS'], 'the called workflow declares exactly that secret');
});

test('check(): a compliant workflow reports nothing', () => {
  assert.deepEqual(check(good()), []);
});

test('check(): missing top-level permissions is reported', () => {
  const { permissions, ...rest } = good();
  assert.deepEqual(check(rest), ['no top-level permissions block']);
});

test('check(): write-all at workflow level is reported', () => {
  assert.deepEqual(check(good({ permissions: 'write-all' })), ['top-level permissions: write-all']);
});

test('check(): write-all at job level is reported', () => {
  const wf = good();
  wf.jobs.build.permissions = 'write-all';
  assert.deepEqual(check(wf), ['job build: permissions: write-all']);
});

test('check(): secrets: inherit on a job is reported, an explicit mapping is not', () => {
  const inherit = good({ jobs: { call: { uses: './.github/workflows/check.yml', secrets: 'inherit' } } });
  assert.deepEqual(check(inherit), ['job call: secrets: inherit']);
  const mapped = good({ jobs: { call: { uses: './.github/workflows/check.yml', secrets: { X: '${{ secrets.X }}' } } } });
  assert.deepEqual(check(mapped), []);
});

test('check(): checkout without persist-credentials: false is reported', () => {
  for (const withBlock of [undefined, {}, { 'persist-credentials': true }, { 'persist-credentials': 'true' }]) {
    const wf = good({ jobs: { build: { steps: [checkout(withBlock)] } } });
    const violations = check(wf);
    assert.equal(violations.length, 1, JSON.stringify(withBlock));
    assert.match(violations[0], /actions\/checkout without persist-credentials: false/);
  }
  const unversioned = good({ jobs: { build: { steps: [{ uses: 'actions/checkout' }] } } });
  assert.equal(check(unversioned).length, 1);
});

test('check(): named write scopes with no checkout (the keepalive shape) report nothing', () => {
  const keepalive = {
    permissions: { actions: 'write' },
    jobs: { keepalive: { steps: [{ run: 'gh api -X PUT repos/x/y/actions/workflows/deploy.yml/enable' }] } },
  };
  assert.deepEqual(check(keepalive), []);
  const deploy = good();
  deploy.jobs.deploy = { permissions: { pages: 'write', 'id-token': 'write' }, steps: [{ uses: 'actions/deploy-pages@v5' }] };
  assert.deepEqual(check(deploy), []);
});

test('check(): every violation in a workflow is listed, not just the first', () => {
  const wf = { jobs: { a: { permissions: 'write-all', secrets: 'inherit', steps: [checkout()] } } };
  assert.equal(check(wf).length, 4);
});
