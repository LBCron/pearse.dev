#!/usr/bin/env node
/**
 * Print /cv/ to dist/pearse-darcy-cv.pdf with headless Chrome. Runs as `postbuild`, so
 * `npm run build` (and withastro/action on deploy) always regenerates it; `npm run cv:pdf`
 * runs it alone over an existing dist/.
 *
 * dist/ is served from a throwaway node:http server on 127.0.0.1 (an ephemeral port, for
 * this step only: the site keeps no runtime, ADR 0001), so the page's root-relative CSS and
 * fonts load as on the live site. The copy of /cv/ served to Chrome, never the file in dist/,
 * has its root-relative <a href="/..."> rewritten to the public origin, so the PDF's link
 * annotations do not point at the loopback port. The page's own @page A4 rules apply.
 *
 * The page never ships a link to a missing file. The old PDF is deleted first; then:
 * - Chrome found, print OK: PDF written, the data-cv-pdf link kept, exit 0
 * - no Chrome, not CI: no PDF, the link removed from dist/cv/index.html, exit 0 with a warning
 * - no Chrome, CI set: no PDF, the link removed, exit 1
 * - Chrome found but the print fails, times out or writes no, an empty or an unreadable file:
 *   PDF deleted, link removed, exit 1 (CI or not)
 * The Print button (data-cv-print) stays as the fallback either way.
 * Writes .astro/cv-pdf.json ({ chrome, pdf, pages }) for tests/cv.test.mjs.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { SITE } from '../src/lib/site.ts';
import { findChrome, root } from './og-shared.mjs';
import { readPdf } from './pdf-text.mjs';
import { serve } from './smoke/server.mjs';

const run = promisify(execFile);
const DIST = resolve(root, 'dist');
const CV = join(DIST, 'cv/index.html');
const PDF_NAME = 'pearse-darcy-cv.pdf';
const PDF = join(DIST, PDF_NAME);
const STATUS = resolve(root, '.astro/cv-pdf.json');
const TIMEOUT_MS = 60_000;

/** The download link, as cv.astro renders it. */
const LINK = /<a\b[^>]*\sdata-cv-pdf\b[^>]*>[\s\S]*?<\/a>/g;

/** Root-relative hrefs on anchors point at the public site; stylesheet and script URLs stay relative. */
function absoluteAnchors(html, origin = SITE.url) {
  return html.replace(/<a\b[^>]*>/gi, (tag) => tag.replace(/(\shref=)(["']?)\/(?!\/)/i, `$1$2${origin}/`));
}

/** dist/cv/index.html without the download link. Throws if a data-cv-pdf element survives. */
function removeLink() {
  const html = readFileSync(CV, 'utf8').replace(LINK, '');
  if (html.includes('data-cv-pdf')) throw new Error('cv:pdf: could not remove the data-cv-pdf link');
  writeFileSync(CV, html);
}

function finish(status, code, message) {
  mkdirSync(dirname(STATUS), { recursive: true });
  writeFileSync(STATUS, JSON.stringify(status, null, 2) + '\n');
  if (message) (code ? console.error : console.warn)(message);
  process.exit(code);
}

async function print(chrome) {
  const profile = mkdtempSync(join(tmpdir(), 'cv-pdf-'));
  const html = absoluteAnchors(readFileSync(CV, 'utf8'));
  const server = await serve(DIST, { '/cv/': html, '/cv/index.html': html });
  try {
    await run(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        // CI runners only, as screenshotArgs() does: trusted local HTML.
        ...(process.env.CI ? ['--no-sandbox'] : []),
        `--user-data-dir=${profile}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${PDF}`,
        // Time for the self-hosted fonts to load, or the PDF falls back to system fonts.
        '--virtual-time-budget=5000',
        `${server.origin}/cv/`,
      ],
      { timeout: TIMEOUT_MS, killSignal: 'SIGKILL' },
    );
  } finally {
    await server.close();
    rmSync(profile, { recursive: true, force: true });
  }
  if (!existsSync(PDF) || statSync(PDF).size === 0) throw new Error('Chrome wrote no PDF');
  const bytes = readFileSync(PDF);
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Chrome wrote a file that is not a PDF');
  return (await readPdf(bytes)).pages.length;
}

if (!existsSync(CV)) {
  console.error('cv:pdf: dist/cv/index.html not found, run the build first');
  process.exit(1);
}
rmSync(PDF, { force: true });

const chrome = findChrome();
if (!chrome) {
  removeLink();
  const msg = 'cv:pdf: no Chrome found (CHROME_PATH, google-chrome, chromium, chromium-browser); no PDF, and /cv/ offers only Print.';
  if (process.env.CI) finish({ chrome, pdf: false, pages: 0 }, 1, `${msg} CI must build the PDF.`);
  finish({ chrome, pdf: false, pages: 0 }, 0, `WARNING: ${msg}`);
}

const started = Date.now();
try {
  const pages = await print(chrome);
  console.log(`cv:pdf: dist/${PDF_NAME}, ${pages} page(s), ${(statSync(PDF).size / 1024).toFixed(0)} KB (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  finish({ chrome, pdf: true, pages }, 0);
} catch (err) {
  rmSync(PDF, { force: true });
  removeLink();
  finish({ chrome, pdf: false, pages: 0 }, 1, `cv:pdf: printing failed, no PDF and the link is removed: ${String(err.message).split('\n')[0]}`);
}
