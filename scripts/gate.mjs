#!/usr/bin/env node
/**
 * Confidentiality gate (ADR 0005 and its amendment). Run from the repo root.
 *
 * Scans every tracked file (`git ls-files -z`) plus the gitignored build output
 * in dist/, matching each pattern against file content and against the file's
 * relative path (forward slashes).
 *
 * Patterns: one regex per line, blank lines and `#` comments ignored, read from
 * env CONFIDENTIAL_PATTERNS or, if unset/blank, the untracked file
 * .confidential-patterns. Matching is case-insensitive and multiline (^ and $ match per line).
 * Every file's content is scanned except known binary extensions and NUL-containing files.
 *
 * Environment (an empty value always means unset):
 *   GATE_REQUIRED=1               fail closed: no patterns, too few patterns or no git => exit 1
 *   CONFIDENTIAL_PATTERNS_MIN     minimum pattern count (default MIN_PATTERNS), enforced when required
 *   CONFIDENTIAL_PATTERNS_SHA256  sha256 hex of the normalised list; a mismatch exits 1
 *
 * Output: a content hit prints `<path>: pattern #<n>` (never the matched text);
 * a path hit prints `<path>: pattern #<n> (path)`. Deliberate mentions are listed in
 * the committed `.gate-allow` file: `<n> <content|path> <exact relative path> # <reason>`.
 *
 * `--fingerprint` prints the pattern count and the fingerprint of the loaded list and exits 0.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { spawnSync } from 'node:child_process';

/** Default minimum pattern count in required mode (truncation guard). */
const MIN_PATTERNS = 10;
const ALLOW_FILE = '.gate-allow';

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2',
  '.ttf', '.otf', '.pdf', '.mp4', '.webm', '.zip', '.gz',
]);

const env = (name) => (process.env[name] ?? '').trim();
const required = process.env.GATE_REQUIRED === '1';

function fail(msg) {
  console.log(`confidentiality gate: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  const text = `confidentiality gate: ${msg}`;
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${text}` : `WARNING: ${text}`);
}

function isBinary(buf) {
  return buf.subarray(0, 8192).includes(0);
}

/** Non-blank, non-`#` lines, trimmed. This is also the fingerprinted form. */
function loadPatterns() {
  let raw = process.env.CONFIDENTIAL_PATTERNS ?? '';
  if (!raw.trim() && existsSync('.confidential-patterns')) {
    raw = readFileSync('.confidential-patterns', 'utf8');
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((t) => t && !t.startsWith('#'));
}

function fingerprint(list) {
  return createHash('sha256').update(list.join('\n')).digest('hex');
}

/**
 * Parses .gate-allow. Exits 1 on a malformed line, or on an `n` above the
 * pattern count when patterns are loaded (with none, only the format is checked).
 *
 * Returns the entries and the file's text for its own content scan, with each
 * entry's path field removed: a path entry has to spell out the matched path,
 * which is a tracked or deployed name and already public. Comments and reasons
 * are still scanned, so a reason that quotes matched text fails the gate.
 */
function loadAllow(patternCount) {
  if (!existsSync(ALLOW_FILE)) return { entries: [], scanText: null };
  const entries = [];
  const LINE = /^([1-9]\d*)\s+(content|path)\s+(\S(?:.*?\S)?)\s+#\s*(\S.*)$/;
  const lines = readFileSync(ALLOW_FILE, 'utf8').split(/\r?\n/);
  const scanLines = lines.map((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const m = LINE.exec(t);
    // The allow file may not exempt itself: its reasons must never quote matched text.
    if (!m || m[3] === ALLOW_FILE) fail(`${ALLOW_FILE}:${i + 1}: malformed entry`);
    const n = Number(m[1]);
    if (patternCount > 0 && n > patternCount) {
      fail(`${ALLOW_FILE}:${i + 1}: pattern #${n} does not exist (${patternCount} patterns)`);
    }
    entries.push({ line: i + 1, n, scope: m[2], path: m[3] });
    return `${m[1]} ${m[2]} # ${m[4]}`;
  });
  return { entries, scanText: scanLines.join('\n') };
}

function minPatterns() {
  const v = env('CONFIDENTIAL_PATTERNS_MIN');
  if (!v) return MIN_PATTERNS;
  if (!/^\d+$/.test(v)) fail('CONFIDENTIAL_PATTERNS_MIN is not a whole number');
  return Number(v);
}

/** Tracked paths from the index, or null when git is unavailable or this is not a repo. */
function trackedFiles() {
  const r = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error || r.status !== 0) return null;
  return r.stdout.split('\0').filter(Boolean);
}

/** dist/ walked as before (it is gitignored), with forward-slash paths. */
function walkDist(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) walkDist(p, out);
    else out.push(p);
  }
  return out;
}

/** Only regular files: deleted entries, symlinks and gitlinks (directories) are skipped. */
function isRegularFile(p) {
  try {
    return lstatSync(p).isFile();
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return false;
    throw err;
  }
}

// --- main -------------------------------------------------------------------

if (process.argv.includes('--fingerprint')) {
  const list = loadPatterns();
  console.log(`patterns: ${list.length}`);
  console.log(`sha256: ${fingerprint(list)}`);
  process.exit(0);
}

if (!existsSync('dist')) fail('dist/ not found, run the build first');

const raw = loadPatterns();
const { entries: allow, scanText: allowScanText } = loadAllow(raw.length);
const min = minPatterns();

if (raw.length === 0) {
  const msg =
    'NO PATTERNS CONFIGURED, nothing was checked. ' +
    'Set the CONFIDENTIAL_PATTERNS secret or create .confidential-patterns.';
  if (required) fail(`FAILED, ${msg} (GATE_REQUIRED=1)`);
  warn(msg);
  process.exit(0);
}

if (raw.length < min) {
  const msg = `only ${raw.length} patterns loaded, expected at least ${min}; the list may be truncated`;
  if (required) fail(`FAILED, ${msg} (GATE_REQUIRED=1)`);
  warn(msg);
}

const expected = env('CONFIDENTIAL_PATTERNS_SHA256').toLowerCase();
// Never print either hash: it would help forge a truncated list.
if (expected && fingerprint(raw) !== expected) fail('FAILED, fingerprint mismatch');

const patterns = [];
for (const [i, p] of raw.entries()) {
  try {
    patterns.push(new RegExp(p, 'im'));
  } catch {
    fail(`pattern #${i + 1}: invalid regular expression`);
  }
}

const files = new Set();
const tracked = trackedFiles();
if (tracked === null) {
  if (required) fail('FAILED, git is unavailable or this is not a git repository (GATE_REQUIRED=1)');
  warn('git is unavailable or this is not a git repository, only dist/ was scanned');
} else {
  for (const p of tracked) if (isRegularFile(p)) files.add(p);
}
for (const p of walkDist('dist')) files.add(p);

// Raw hits first: staleness is judged before any suppression.
const hits = [];
for (const file of [...files].sort()) {
  patterns.forEach((re, i) => {
    if (re.test(file)) hits.push({ n: i + 1, scope: 'path', path: file });
  });
  if (BINARY_EXT.has(extname(file).toLowerCase())) continue;
  const buf = readFileSync(file);
  if (isBinary(buf)) continue;
  const text = file === ALLOW_FILE && allowScanText !== null ? allowScanText : buf.toString('utf8');
  patterns.forEach((re, i) => {
    if (re.test(text)) hits.push({ n: i + 1, scope: 'content', path: file });
  });
}

const same = (a, b) => a.n === b.n && a.scope === b.scope && a.path === b.path;
const stale = allow.filter((e) => !hits.some((h) => same(h, e)));
const reported = hits.filter((h) => !allow.some((e) => same(h, e)));

for (const h of reported) {
  console.log(`${h.path}: pattern #${h.n}${h.scope === 'path' ? ' (path)' : ''}`);
}
for (const e of stale) {
  console.log(`${ALLOW_FILE}:${e.line}: stale entry, no pattern #${e.n} ${e.scope} hit in ${e.path}`);
}

if (reported.length || stale.length) {
  fail(`FAILED, ${reported.length} hit(s), ${stale.length} stale ${ALLOW_FILE} entr${stale.length === 1 ? 'y' : 'ies'}`);
}
const allowed = hits.length ? `, ${hits.length} allowed by ${ALLOW_FILE}` : '';
console.log(`confidentiality gate: ok (${patterns.length} patterns, ${files.size} files, no hits${allowed})`);
