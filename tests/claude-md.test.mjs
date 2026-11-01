// Keeps the root CLAUDE.md (the agent entry point) honest: tracked, short, linked to files that
// exist, pointing at the docs that hold the rules, and free of the retired product names.
// Reads source files and git only, not dist/. Untracked files fail the "tracked" check, so
// `git add CLAUDE.md` before running this locally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OLD_NAMES } from './lib/old-names.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILE = resolve(ROOT, 'CLAUDE.md');
const MAX_LINES = 80;

const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const text = () => readFileSync(FILE, 'utf8');

test('CLAUDE.md exists, is tracked by git and is not ignored', () => {
  assert.ok(existsSync(FILE), 'CLAUDE.md is missing');
  assert.equal(git('ls-files', 'CLAUDE.md').stdout.trim(), 'CLAUDE.md', 'CLAUDE.md is not tracked');
  assert.equal(git('check-ignore', '-q', 'CLAUDE.md').status, 1, 'CLAUDE.md is ignored by git');
});

test('every relative Markdown link in CLAUDE.md resolves to an existing path', () => {
  const links = [...text().matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length > 0, 'no links found');
  for (const link of links) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('#')) continue;
    const path = link.split('#')[0];
    assert.ok(existsSync(resolve(dirname(FILE), path)), `broken link: ${link}`);
  }
});

test('CLAUDE.md names the files, flags and commands agents need', () => {
  const body = text();
  for (const needle of ['.nvmrc', 'GITHUB_FETCH=0', 'npm run gate', 'CHANGELOG.md', 'GLOSSARY.md', 'docs/adr/']) {
    assert.ok(body.includes(needle), `CLAUDE.md does not mention ${needle}`);
  }
});

test(`CLAUDE.md stays at ${MAX_LINES} lines or fewer`, () => {
  const lines = text().split('\n').length - (text().endsWith('\n') ? 1 : 0);
  assert.ok(lines <= MAX_LINES, `${lines} lines`);
});

test('CLAUDE.md uses neither the retired product name nor the folded tool names', () => {
  assert.doesNotMatch(text(), OLD_NAMES);
});
