#!/usr/bin/env node
/**
 * Confidentiality gate (ADR 0005). Scans dist/, src/ and docs/ (relative to the
 * current directory) for patterns that must never ship.
 *
 * Patterns: one regex per line, blank lines and `#` comments ignored, read from
 * env CONFIDENTIAL_PATTERNS or, if unset/blank, the untracked file
 * .confidential-patterns. Matching is case-insensitive and multiline (^ and $ match per line).
 * Every file is scanned except known binary extensions and NUL-containing files. A `.pdf` is
 * read with pdfjs-dist (scripts/pdf-text.mjs, loaded only when a PDF is found) and every pattern
 * is tested against its page text, the text with whitespace collapsed, the text with whitespace
 * removed, every Info dictionary value, the raw XMP and every link annotation target. A PDF that
 * cannot be parsed, or pdfjs-dist failing to load, prints `<file>: unreadable PDF` and fails.
 *
 * On a hit: prints `<file>: pattern #<n>` (never the matched text), exits 1.
 * With no patterns: prints a loud warning and exits 0.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { readPdf, scanStrings } from './pdf-text.mjs';

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2',
  '.ttf', '.otf', '.mp4', '.webm', '.zip', '.gz',
]);
const ROOTS = ['dist', 'src', 'docs'];

function isBinary(buf) {
  return buf.subarray(0, 8192).includes(0);
}

function loadPatterns() {
  let raw = process.env.CONFIDENTIAL_PATTERNS ?? '';
  if (!raw.trim() && existsSync('.confidential-patterns')) {
    raw = readFileSync('.confidential-patterns', 'utf8');
  }
  const out = [];
  raw.split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith('#')) out.push(t);
  });
  return out;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (!BINARY_EXT.has(extname(p).toLowerCase())) out.push(p);
  }
  return out;
}

if (!existsSync('dist')) {
  console.log('confidentiality gate: dist/ not found, run the build first');
  process.exit(1);
}

const raw = loadPatterns();
if (raw.length === 0) {
  const msg =
    'confidentiality gate: NO PATTERNS CONFIGURED, nothing was checked. ' +
    'Set the CONFIDENTIAL_PATTERNS secret or create .confidential-patterns.';
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `WARNING: ${msg}`);
  process.exit(0);
}

const patterns = [];
for (const [i, p] of raw.entries()) {
  try {
    patterns.push(new RegExp(p, 'im'));
  } catch {
    console.log(`pattern #${i + 1}: invalid regular expression`);
    process.exit(1);
  }
}

let hits = 0;
for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    const buf = readFileSync(file);
    // PDFs are routed by extension before the NUL-byte check: they are binary but carry text.
    if (extname(file).toLowerCase() === '.pdf') {
      let fields;
      try {
        fields = scanStrings(await readPdf(buf));
      } catch {
        hits++;
        console.log(`${file}: unreadable PDF`);
        continue;
      }
      patterns.forEach((re, i) => {
        if (fields.some((f) => re.test(f))) {
          hits++;
          console.log(`${file}: pattern #${i + 1}`);
        }
      });
      continue;
    }
    if (isBinary(buf)) continue;
    const text = buf.toString('utf8');
    patterns.forEach((re, i) => {
      if (re.test(text)) {
        hits++;
        console.log(`${file}: pattern #${i + 1}`);
      }
    });
  }
}

if (hits) {
  console.log(`confidentiality gate: FAILED, ${hits} hit(s)`);
  process.exit(1);
}
console.log(`confidentiality gate: ok (${patterns.length} patterns, no hits)`);
