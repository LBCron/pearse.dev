// Issue #162: every remote action is pinned to a full commit SHA with a `# vX.Y.Z` comment,
// every job with steps runs on ubuntu-24.04, and Dependabot is configured for npm and Actions.
// Reads .github/ from source, not dist/. `checkWorkflow` is pure (text in, violations out); the
// fixtures below prove each rule can fail. The YAML parser drops comments, so the version
// comment is checked against the raw lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOWS = `${ROOT}.github/workflows/`;
const RUNNER = 'ubuntu-24.04';
const PINNED = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const VERSION_COMMENT = /^#\s*v\d+\.\d+\.\d+\s*$/;

function checkWorkflow(text) {
  const violations = [];
  const workflow = parse(text);
  const parsedUses = [];
  for (const [jobId, job] of Object.entries(workflow?.jobs ?? {})) {
    if (job?.uses !== undefined) {
      // A reusable-workflow call: runs-on is invalid here, and the ref is local or pinned below.
      parsedUses.push(String(job.uses));
      if (job['runs-on'] !== undefined) violations.push(`job ${jobId}: has uses: and runs-on (invalid)`);
    } else if (Array.isArray(job?.steps) && job['runs-on'] !== RUNNER) {
      violations.push(`job ${jobId}: runs-on is ${JSON.stringify(job['runs-on'])}, expected ${RUNNER}`);
    }
    for (const step of job?.steps ?? []) if (step?.uses !== undefined) parsedUses.push(String(step.uses));
  }

  const rawLines = text.split('\n').flatMap((line) => {
    const m = line.match(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/);
    return m ? [{ ref: m[1], rest: m[2].trim() }] : [];
  });
  if (rawLines.length !== parsedUses.length) {
    violations.push(`found ${rawLines.length} uses: lines but ${parsedUses.length} parsed uses (quoted or unusual form)`);
  }
  for (const { ref, rest } of rawLines) {
    if (ref.startsWith('./')) continue;
    if (!PINNED.test(ref)) violations.push(`${ref}: not pinned to a 40-hex commit SHA`);
    else if (!VERSION_COMMENT.test(rest)) violations.push(`${ref}: missing "# vX.Y.Z" comment (got ${JSON.stringify(rest)})`);
  }
  return violations;
}

const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const wf = (jobBody) => `name: x\non: push\njobs:\n  j:\n${jobBody}\n`;
const good = wf(`    runs-on: ubuntu-24.04\n    steps:\n      - uses: actions/checkout@${SHA} # v7.0.1\n      - uses: ./.github/actions/local\n      - run: true`);

test('a pinned, commented, ubuntu-24.04 workflow passes; local refs are skipped', () => {
  assert.deepEqual(checkWorkflow(good), []);
});

test('a major tag fails', () => {
  assert.match(checkWorkflow(good.replace(`@${SHA} # v7.0.1`, '@v7')).join('\n'), /not pinned/);
});

test('a short or non-hex SHA fails', () => {
  assert.equal(checkWorkflow(good.replace(SHA, SHA.slice(0, 12))).length, 1);
  assert.equal(checkWorkflow(good.replace(SHA, 'z'.repeat(40))).length, 1);
});

test('a dropped or malformed version comment fails', () => {
  assert.match(checkWorkflow(good.replace(' # v7.0.1', '')).join('\n'), /missing/);
  assert.match(checkWorkflow(good.replace('# v7.0.1', '# latest')).join('\n'), /missing/);
});

test('a job with steps on ubuntu-latest fails', () => {
  assert.match(checkWorkflow(good.replace('ubuntu-24.04', 'ubuntu-latest')).join('\n'), /runs-on/);
});

test('a job with steps and no runs-on fails', () => {
  assert.match(checkWorkflow(good.replace('    runs-on: ubuntu-24.04\n', '')).join('\n'), /runs-on/);
});

test('a reusable-workflow job is skipped for runs-on, and adding runs-on to it fails', () => {
  const call = wf('    uses: ./.github/workflows/check.yml');
  assert.deepEqual(checkWorkflow(call), []);
  assert.match(checkWorkflow(`${call}    runs-on: ubuntu-24.04\n`).join('\n'), /invalid/);
});

test('a remote reusable-workflow call must be pinned too', () => {
  assert.match(checkWorkflow(wf('    uses: owner/repo/.github/workflows/w.yml@main')).join('\n'), /not pinned/);
});

const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

test('there are workflows to check', () => {
  assert.ok(files.length >= 3, files.join(', '));
});

for (const file of files) {
  test(`${file}: every remote action is SHA-pinned with a version comment, every job runs on ${RUNNER}`, () => {
    assert.deepEqual(checkWorkflow(readFileSync(`${WORKFLOWS}${file}`, 'utf8')), []);
  });
}

test('deploy.yml: the check job calls the reusable workflow and has no runs-on', () => {
  const deploy = parse(readFileSync(`${WORKFLOWS}deploy.yml`, 'utf8'));
  assert.equal(deploy.jobs.check.uses, './.github/workflows/check.yml');
  assert.equal(deploy.jobs.check['runs-on'], undefined);
});

const dependabot = parse(readFileSync(`${ROOT}.github/dependabot.yml`, 'utf8'));
const updates = dependabot.updates ?? [];

test('dependabot: version 2 with npm and github-actions, both on /', () => {
  assert.equal(dependabot.version, 2);
  assert.deepEqual(updates.map((u) => u['package-ecosystem']).sort(), ['github-actions', 'npm']);
  for (const u of updates) assert.equal(u.directory, '/', u['package-ecosystem']);
});

for (const ecosystem of ['npm', 'github-actions']) {
  const u = updates.find((x) => x['package-ecosystem'] === ecosystem) ?? {};
  test(`dependabot ${ecosystem}: weekly, cooldown of at least 7 days, one group`, () => {
    assert.equal(u.schedule?.interval, 'weekly');
    assert.ok(u.cooldown?.['default-days'] >= 7, `cooldown.default-days is ${u.cooldown?.['default-days']}`);
    assert.equal(Object.keys(u.groups ?? {}).length, 1, 'exactly one group');
  });
}

test('dependabot npm: the group covers minor and patch only', () => {
  const group = Object.values(updates.find((x) => x['package-ecosystem'] === 'npm')?.groups ?? {})[0] ?? {};
  assert.deepEqual([...(group['update-types'] ?? [])].sort(), ['minor', 'patch']);
});
