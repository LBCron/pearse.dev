import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = resolve('scripts/gate.mjs');
const GATE_VARS = ['CONFIDENTIAL_PATTERNS', 'GATE_REQUIRED', 'CONFIDENTIAL_PATTERNS_MIN', 'CONFIDENTIAL_PATTERNS_SHA256'];
// Git variables that would point a subprocess at another repository or index.
const GIT_VARS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR'];

/** Ten patterns that match nothing, so required mode clears the default minimum. */
const FILLER = Array.from({ length: 10 }, (_, i) => `nomatchfiller${i}zz`);
const list = (...extra) => [...extra, ...FILLER].join('\n');

function cleanEnv(dir) {
  const env = { ...process.env, GITHUB_ACTIONS: '', GIT_CEILING_DIRECTORIES: dirname(dir) };
  for (const k of [...GATE_VARS, ...GIT_VARS]) delete env[k];
  return env;
}

function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, env: cleanEnv(dir), encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/**
 * A temp dir with dist/index.html (holding PlantedSecret123). By default it is a
 * git repo (`git init`, files staged, nothing committed). Never contains
 * .confidential-patterns, so the worktree's local list cannot reach a result.
 */
function fixture({ repo = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist', 'index.html'), '<p>hello PlantedSecret123 world</p>');
  if (repo) git(dir, '-c', 'init.defaultBranch=main', 'init', '-q');
  return dir;
}

/** Writes a file (creating parents) and stages it. */
function track(dir, path, content) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
  git(dir, 'add', '--', path);
}

/** Runs the gate in `dir`. `overrides` sets env vars; `undefined` deletes one. */
function run(dir, patterns, overrides = {}, args = []) {
  const env = cleanEnv(dir);
  if (patterns !== undefined) env.CONFIDENTIAL_PATTERNS = patterns;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return spawnSync(process.execPath, [gate, ...args], { cwd: dir, env, encoding: 'utf8' });
}

/** Criterion 10: a content hit never prints the matched text. */
function assertNoLeak(r, text) {
  const out = `${r.stdout}\n${r.stderr}`.toLowerCase();
  assert.ok(!out.includes(text.toLowerCase()), `output leaked the matched text:\n${out}`);
}

function withFixture(opts, fn) {
  const dir = fixture(opts);
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const sha = (lines) => createHash('sha256').update(lines.join('\n')).digest('hex');

// --- existing behaviour -------------------------------------------------------

test('hit fails, names the file and pattern index, not the text', () => {
  withFixture({}, (dir) => {
    const r = run(dir, '# comment\n\nplantedsecret123\n');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^dist\/index\.html: pattern #1$/m);
    assertNoLeak(r, 'plantedsecret123');
  });
});

test('no patterns passes with a warning when not required', () => {
  withFixture({}, (dir) => {
    const r = run(dir, '');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /NO PATTERNS CONFIGURED/);
  });
});

test('non-matching pattern passes', () => {
  withFixture({}, (dir) => {
    const r = run(dir, 'nothingmatchesthis');
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /pattern #/);
    assert.match(r.stdout, /confidentiality gate: ok \(1 patterns/);
  });
});

test('missing dist fails with a clear message before any git call', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    const r = run(dir, 'anything', { GATE_REQUIRED: '1' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /dist\/ not found/);
    assert.doesNotMatch(r.stdout, /git/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scans files with unusual or no extension, skips binaries', () => {
  withFixture({}, (dir) => {
    writeFileSync(join(dir, 'dist', '_redirects'), '/old /plantedredirect9 301');
    writeFileSync(join(dir, 'dist', 'a.ics'), 'SUMMARY:plantedcal8');
    writeFileSync(join(dir, 'dist', 'b.png'), 'plantedpng7');
    writeFileSync(join(dir, 'dist', 'blob'), Buffer.from('plantedblob6\0\0'));
    track(dir, 'public/c.woff2', 'plantedfont4');
    for (const [pat, file] of [['plantedredirect9', '_redirects'], ['plantedcal8', 'a.ics']]) {
      const r = run(dir, pat);
      assert.equal(r.status, 1);
      assert.match(r.stdout, new RegExp(`dist/${file.replace('.', '\\.')}: pattern #1$`, 'm'));
      assertNoLeak(r, pat);
    }
    assert.equal(run(dir, 'plantedpng7').status, 0);
    assert.equal(run(dir, 'plantedblob6').status, 0);
    assert.equal(run(dir, 'plantedfont4').status, 0);
  });
});

test('anchored patterns match mid-file lines', () => {
  withFixture({}, (dir) => {
    writeFileSync(join(dir, 'dist', 'x.txt'), 'first\nplantedline5\nlast');
    const r = run(dir, '^plantedline5$');
    assert.equal(r.status, 1);
    assertNoLeak(r, 'plantedline5');
  });
});

// --- 1. fail closed ------------------------------------------------------------

test('required with no patterns fails', () => {
  withFixture({}, (dir) => {
    const r = run(dir, '', { GATE_REQUIRED: '1' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /NO PATTERNS CONFIGURED/);
  });
});

test('GATE_REQUIRED other than exactly 1 counts as unset', () => {
  withFixture({}, (dir) => {
    for (const v of ['', 'true', ' 1', '0']) {
      const r = run(dir, '', { GATE_REQUIRED: v });
      assert.equal(r.status, 0, `GATE_REQUIRED=${JSON.stringify(v)}`);
      assert.match(r.stdout, /NO PATTERNS CONFIGURED/);
    }
  });
});

// --- 2. minimum pattern count ------------------------------------------------

test('required with fewer patterns than the minimum fails; not required warns', () => {
  withFixture({}, (dir) => {
    const short = FILLER.slice(0, 9).join('\n');
    const r = run(dir, short, { GATE_REQUIRED: '1' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /only 9 patterns loaded, expected at least 10/);
    const w = run(dir, short);
    assert.equal(w.status, 0);
    assert.match(w.stdout, /WARNING: .*only 9 patterns/);
    assert.equal(run(dir, list(), { GATE_REQUIRED: '1' }).status, 0);
  });
});

test('CONFIDENTIAL_PATTERNS_MIN overrides the minimum; empty falls back to 10', () => {
  withFixture({}, (dir) => {
    const three = FILLER.slice(0, 3).join('\n');
    assert.equal(run(dir, three, { GATE_REQUIRED: '1', CONFIDENTIAL_PATTERNS_MIN: '3' }).status, 0);
    assert.equal(run(dir, three, { GATE_REQUIRED: '1', CONFIDENTIAL_PATTERNS_MIN: '4' }).status, 1);
    assert.equal(run(dir, three, { GATE_REQUIRED: '1', CONFIDENTIAL_PATTERNS_MIN: '' }).status, 1);
    assert.equal(run(dir, list(), { GATE_REQUIRED: '1', CONFIDENTIAL_PATTERNS_MIN: '' }).status, 0);
    assert.equal(run(dir, list(), { GATE_REQUIRED: '1', CONFIDENTIAL_PATTERNS_MIN: '11' }).status, 1);
    assert.equal(run(dir, list(), { CONFIDENTIAL_PATTERNS_MIN: 'ten' }).status, 1);
  });
});

// --- 3. fingerprint ------------------------------------------------------------

test('fingerprint mismatch fails without printing either hash; match passes; empty ignored', () => {
  withFixture({}, (dir) => {
    const lines = FILLER;
    const good = sha(lines);
    // Comments, blank lines and surrounding whitespace do not change the fingerprint.
    const raw = `# header\n\n${lines.map((l) => `  ${l} `).join('\n')}\n# trailing\n`;
    assert.equal(run(dir, raw, { CONFIDENTIAL_PATTERNS_SHA256: good }).status, 0);
    assert.equal(run(dir, raw, { CONFIDENTIAL_PATTERNS_SHA256: good.toUpperCase() }).status, 0);
    assert.equal(run(dir, raw, { CONFIDENTIAL_PATTERNS_SHA256: '' }).status, 0);

    const wrong = sha(['something else']);
    const r = run(dir, lines.slice(0, 9).join('\n'), { CONFIDENTIAL_PATTERNS_SHA256: good });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /fingerprint mismatch/);
    const m = run(dir, raw, { CONFIDENTIAL_PATTERNS_SHA256: wrong });
    assert.equal(m.status, 1);
    for (const out of [r, m]) {
      for (const h of [good, wrong, sha(lines.slice(0, 9))]) assert.ok(!out.stdout.includes(h));
      assert.doesNotMatch(out.stdout, /[0-9a-f]{64}/);
    }
  });
});

test('--fingerprint prints the count and hash and scans nothing', () => {
  withFixture({}, (dir) => {
    const r = run(dir, '# c\nplantedsecret123\n\nother\n', {}, ['--fingerprint']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^patterns: 2$/m);
    assert.match(r.stdout, new RegExp(`^sha256: ${sha(['plantedsecret123', 'other'])}$`, 'm'));
    assert.doesNotMatch(r.stdout, /pattern #|confidentiality gate/);
  });
});

// --- 4. tracked file set ----------------------------------------------------------

test('content hits in a tracked root file and a tracked workflow fail and name the path', () => {
  withFixture({}, (dir) => {
    track(dir, 'README.md', 'see plantedroot3 here');
    track(dir, '.github/workflows/ci.yml', 'name: plantedwf2');
    const pats = list('plantedroot3', 'plantedwf2');
    const r = run(dir, pats, { GATE_REQUIRED: '1' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^README\.md: pattern #1$/m);
    assert.match(r.stdout, /^\.github\/workflows\/ci\.yml: pattern #2$/m);
    assertNoLeak(r, 'plantedroot3');
    assertNoLeak(r, 'plantedwf2');
  });
});

test('an untracked, non-ignored file outside dist/ is not scanned', () => {
  withFixture({}, (dir) => {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'draft.md'), 'planteduntracked1');
    const r = run(dir, list('planteduntracked1'), { GATE_REQUIRED: '1' });
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /pattern #/);
  });
});

// --- 5. path hits -------------------------------------------------------------------

test('a tracked file whose name matches prints the path hit', () => {
  withFixture({}, (dir) => {
    track(dir, 'docs/plantedname0-notes.md', 'harmless');
    const r = run(dir, list('plantedname0'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^docs\/plantedname0-notes\.md: pattern #1 \(path\)$/m);
  });
});

test('a dist/ path is matched with the dist/ prefix', () => {
  withFixture({}, (dir) => {
    mkdirSync(join(dir, 'dist', 'work', 'plantedslug'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'work', 'plantedslug', 'index.html'), 'ok');
    const r = run(dir, list('^dist/work/plantedslug/'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^dist\/work\/plantedslug\/index\.html: pattern #1 \(path\)$/m);
  });
});

// --- 6. non-ASCII paths --------------------------------------------------------------

test('a tracked non-ASCII filename is scanned and reported with its real path', () => {
  withFixture({}, (dir) => {
    track(dir, 'src/café ñ.md', 'plantedunicode9');
    const r = run(dir, list('plantedunicode9'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^src\/café ñ\.md: pattern #1$/m);
    assert.doesNotMatch(r.stdout, /\\303/);
    assertNoLeak(r, 'plantedunicode9');
  });
});

// --- 7. deleted, symlinked and gitlink entries ---------------------------------------

test('tracked-then-deleted files, symlinks and gitlinks do not crash the gate', () => {
  withFixture({}, (dir) => {
    track(dir, 'gone.md', 'plantedgone8');
    unlinkSync(join(dir, 'gone.md'));
    track(dir, 'gonedir/x.md', 'plantedgone8');
    rmSync(join(dir, 'gonedir'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'target.txt'), 'fine');
    symlinkSync('dist/target.txt', join(dir, 'link.txt'));
    symlinkSync('nowhere', join(dir, 'dangling.txt'));
    git(dir, 'add', '--', 'link.txt', 'dangling.txt');
    // A gitlink (submodule entry) shows up as a directory, or not at all.
    const fake = '0123456789abcdef0123456789abcdef01234567';
    mkdirSync(join(dir, 'sub'));
    git(dir, 'update-index', '--add', '--cacheinfo', `160000,${fake},sub`);
    git(dir, 'update-index', '--add', '--cacheinfo', `160000,${fake},missingsub`);
    const tracked = git(dir, 'ls-files', '-z').split('\0');
    for (const p of ['gone.md', 'link.txt', 'sub', 'missingsub']) assert.ok(tracked.includes(p), p);

    const r = run(dir, list('plantedgone8'), { GATE_REQUIRED: '1' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stderr, '');
    assert.match(r.stdout, /confidentiality gate: ok/);
  });
});

// --- 8. .gate-allow ---------------------------------------------------------------------

test('.gate-allow: an exact entry suppresses its hit', () => {
  withFixture({}, (dir) => {
    track(dir, 'CHANGELOG.md', 'mentions plantedallow7 on purpose');
    track(dir, '.gate-allow', '# deliberate mentions\n\n1 content CHANGELOG.md # historical entry, reviewed\n');
    const r = run(dir, list('plantedallow7'), { GATE_REQUIRED: '1' });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /1 allowed by \.gate-allow/);
    assertNoLeak(r, 'plantedallow7');
  });
});

test('.gate-allow: entries are exact in pattern, scope and path', () => {
  withFixture({}, (dir) => {
    track(dir, 'CHANGELOG.md', 'mentions plantedallow7 on purpose');
    track(dir, 'README.md', 'and plantedallow7 again');
    track(dir, '.gate-allow', '1 path CHANGELOG.md # wrong scope\n');
    const r = run(dir, list('plantedallow7'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^CHANGELOG\.md: pattern #1$/m);
    assert.match(r.stdout, /^README\.md: pattern #1$/m);
    assert.match(r.stdout, /^\.gate-allow:1: stale entry/m);
    assertNoLeak(r, 'plantedallow7');
  });
});

test('.gate-allow: a malformed line fails and prints its line number', () => {
  withFixture({}, (dir) => {
    const bad = [
      '1 content CHANGELOG.md', // no reason
      '1 content CHANGELOG.md #', // empty reason
      '1 contents CHANGELOG.md # bad scope',
      '0 content CHANGELOG.md # zero',
      'x content CHANGELOG.md # not a number',
      '1 content .gate-allow # may not exempt itself',
    ];
    for (const line of bad) {
      track(dir, '.gate-allow', `# header\n\n${line}\n`);
      // Format is checked even with no patterns loaded.
      for (const pats of [list(), '']) {
        const r = run(dir, pats);
        assert.equal(r.status, 1, line);
        assert.match(r.stdout, /\.gate-allow:3: malformed entry/, line);
      }
    }
  });
});

test('.gate-allow: an n above the pattern count fails', () => {
  withFixture({}, (dir) => {
    track(dir, '.gate-allow', '12 content README.md # beyond the list\n');
    const r = run(dir, list());
    assert.equal(r.status, 1);
    assert.match(r.stdout, /\.gate-allow:1: pattern #12 does not exist/);
  });
});

test('.gate-allow: a stale entry fails; with no patterns only the format is checked', () => {
  withFixture({}, (dir) => {
    track(dir, 'README.md', 'nothing here');
    track(dir, '.gate-allow', '1 content README.md # was a mention\n');
    const r = run(dir, list('plantedstale6'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^\.gate-allow:1: stale entry/m);
    const none = run(dir, '');
    assert.equal(none.status, 0);
    assert.match(none.stdout, /NO PATTERNS CONFIGURED/);
  });
});

test('.gate-allow: a path entry suppresses a path hit and is not stale', () => {
  withFixture({}, (dir) => {
    track(dir, 'docs/plantedname0.md', 'harmless');
    track(dir, '.gate-allow', '1 path docs/plantedname0.md # renamed in a follow-up\n');
    const r = run(dir, list('plantedname0'));
    assert.equal(r.status, 0, r.stdout);
    assert.doesNotMatch(r.stdout, /stale|pattern #/);
  });
});

test('.gate-allow is scanned itself: a reason quoting matched text fails', () => {
  withFixture({}, (dir) => {
    track(dir, 'README.md', 'mentions plantedquote4');
    track(dir, '.gate-allow', '1 content README.md # it says plantedquote4\n');
    const r = run(dir, list('plantedquote4'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^\.gate-allow: pattern #1$/m);
    assertNoLeak(r, 'plantedquote4');
    track(dir, '.gate-allow', '# plantedquote4 in a comment\n1 content README.md # reviewed mention\n');
    assert.equal(run(dir, list('plantedquote4')).status, 1);
    track(dir, '.gate-allow', '1 content README.md # reviewed mention\n');
    assert.equal(run(dir, list('plantedquote4')).status, 0);
  });
});

// --- 9. not a git repository ----------------------------------------------------------

test('outside a git repo: warns, scans dist/ only; required fails', () => {
  withFixture({ repo: false }, (dir) => {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'x.md'), 'plantedoutside5');
    const r = run(dir, list('plantedoutside5'));
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /not a git repository, only dist\/ was scanned/);
    assert.doesNotMatch(r.stdout, /pattern #/);
    const d = run(dir, list('plantedsecret123'));
    assert.equal(d.status, 1);
    assert.match(d.stdout, /^dist\/index\.html: pattern #1$/m);
    assertNoLeak(d, 'plantedsecret123');
    const req = run(dir, list('plantedoutside5'), { GATE_REQUIRED: '1' });
    assert.equal(req.status, 1);
    assert.match(req.stdout, /not a git repository/);
  });
});

test('git missing from PATH counts as no git', () => {
  withFixture({}, (dir) => {
    const r = run(dir, list(), { PATH: '/nonexistent' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /only dist\/ was scanned/);
    assert.equal(run(dir, list(), { PATH: '/nonexistent', GATE_REQUIRED: '1' }).status, 1);
  });
});

// --- dedupe -------------------------------------------------------------------------------

test('a tracked file under dist/ is reported once', () => {
  withFixture({}, (dir) => {
    git(dir, 'add', '--', 'dist/index.html');
    const r = run(dir, list('plantedsecret123'));
    assert.equal(r.status, 1);
    assert.equal(r.stdout.match(/dist\/index\.html: pattern #1/g).length, 1);
  });
});
