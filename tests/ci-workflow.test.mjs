// Issue #150: CI builds dist/ once, checks it, and deploys that exact build. Parses the two
// workflow files and package.json (YAML comments cannot satisfy or break these). Reads no dist/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${ROOT}${path}`, 'utf8');
const check = parse(read('.github/workflows/check.yml'));
const deploy = parse(read('.github/workflows/deploy.yml'));
const pkg = JSON.parse(read('package.json'));

const stepsOf = (workflow) => Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
const checkSteps = check.jobs.check.steps;
const BUILD = /npm run build|astro build/;
const isGate = (step) => typeof step.run === 'string' && /\bnpm run gate\b/.test(step.run);
const isHashVerify = (step) => step.name === 'Verify dist unchanged';

test('no step in either workflow uses withastro/action', () => {
  for (const step of [...stepsOf(check), ...stepsOf(deploy)]) {
    assert.ok(!String(step.uses ?? '').startsWith('withastro/action'), `step "${step.name}" uses ${step.uses}`);
  }
});

test('deploy.yml has exactly the jobs check and deploy, and deploy only runs on master after check', () => {
  assert.deepEqual(Object.keys(deploy.jobs).sort(), ['check', 'deploy']);
  assert.equal(deploy.jobs.check.uses, './.github/workflows/check.yml');
  assert.equal(deploy.jobs.deploy.needs, 'check');
  assert.match(String(deploy.jobs.deploy.if ?? ''), /refs\/heads\/master/);
  assert.ok(
    deploy.jobs.deploy.steps.some((s) => String(s.uses ?? '').startsWith('actions/deploy-pages@')),
    'deploy uses actions/deploy-pages',
  );
});

test('no run in deploy.yml mentions build', () => {
  for (const step of stepsOf(deploy)) {
    assert.doesNotMatch(String(step.run ?? ''), /build/i, `step "${step.name}"`);
  }
});

test('exactly one check.yml step builds the site, with GITHUB_TOKEN in its env', () => {
  const builds = stepsOf(check).filter((s) => BUILD.test(String(s.run ?? '')));
  assert.equal(builds.length, 1, 'one build step');
  assert.ok(builds[0].env && 'GITHUB_TOKEN' in builds[0].env, 'build step sets GITHUB_TOKEN');
});

test('the Tests step runs npm run test:ci and no step runs npm test', () => {
  const tests = checkSteps.filter((s) => s.name === 'Tests');
  assert.equal(tests.length, 1, 'one Tests step');
  assert.equal(tests[0].run, 'npm run test:ci');
  for (const step of stepsOf(check)) {
    assert.doesNotMatch(String(step.run ?? ''), /\bnpm (run )?test(?!:)/, `step "${step.name}" runs npm test`);
  }
});

test('test:ci is the test command with no pretest:ci hook', () => {
  assert.equal(typeof pkg.scripts.test, 'string');
  assert.equal(pkg.scripts['test:ci'], pkg.scripts.test);
  assert.equal('pretest:ci' in pkg.scripts, false);
  assert.ok('pretest' in pkg.scripts, 'local npm test still builds through pretest');
});

test('dist/ is hashed right after Build and verified after the gate', () => {
  const buildAt = checkSteps.findIndex((s) => BUILD.test(String(s.run ?? '')));
  const hash = checkSteps[buildAt + 1];
  assert.ok(hash?.id, 'the step after Build has an id');
  assert.match(String(hash.run), /sha256sum/);
  assert.match(String(hash.run), /GITHUB_OUTPUT/);
  const verifyAt = checkSteps.findIndex(isHashVerify);
  assert.ok(verifyAt > checkSteps.findIndex(isGate), 'hash verify comes after the gate');
  const verify = checkSteps[verifyAt];
  assert.match(String(verify.run), /sha256sum/);
  assert.ok(String(verify.env?.EXPECTED).includes(`steps.${hash.id}.outputs.`), 'compares against the Build hash');
  assert.match(String(verify.run), /exit 1/);
});

test('the last check step uploads dist as the Pages artifact outside pull requests, after gate and verify', () => {
  const lastAt = checkSteps.length - 1;
  const last = checkSteps[lastAt];
  assert.equal(last.uses, 'actions/upload-pages-artifact@v5');
  assert.equal(last.with?.path, 'dist');
  assert.match(String(last.if ?? ''), /github\.event_name\s*!=\s*'pull_request'/);
  const gateAt = checkSteps.findIndex(isGate);
  const verifyAt = checkSteps.findIndex(isHashVerify);
  assert.ok(gateAt >= 0 && gateAt < lastAt, 'upload comes after the gate');
  assert.ok(verifyAt >= 0 && verifyAt < lastAt, 'upload comes after the hash verify');
  const uploads = stepsOf(check).filter((s) => String(s.uses ?? '').startsWith('actions/upload-pages-artifact'));
  assert.equal(uploads.length, 1, 'one Pages upload');
});

// #140: upload-pages-artifact leaves out dot-paths unless told otherwise, which would drop
// /.well-known/security.txt from the deployed site while every local test passes. The dist hash
// must cover what ships, hidden files included.
test('the Pages upload includes hidden files and both dist hashes cover them', () => {
  const upload = checkSteps.find((s) => String(s.uses ?? '').startsWith('actions/upload-pages-artifact'));
  assert.equal(upload.with?.['include-hidden-files'], true);
  for (const step of checkSteps.filter((s) => s.id === 'dist-hash' || isHashVerify(s))) {
    assert.doesNotMatch(String(step.run), /-not -path/, `${step.name} hashes hidden files`);
  }
});
