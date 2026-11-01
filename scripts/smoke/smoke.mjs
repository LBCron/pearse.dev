/**
 * Browser smoke run over the built site (#119). Every other test reads `dist/` as text; this
 * one drives it in headless Chrome and fails on what a visitor would see go wrong.
 *
 * Checks, in order, one browser, one context per group, nothing in parallel:
 *   console      every sitemap URL loads with no console error, page error, failed or >= 400
 *                same-origin request (and no console warning outside the WebGL allowlist)
 *   transitions  from /, each primary Nav link: a cross-document view transition is not skipped,
 *                and at least one reports `done`
 *   redirects    from /, an in-page navigation into each redirect page reaches its target with
 *                the console clean (the #55 and #79 path)
 *   overflow     at 360 and 320 px, no sitemap URL scrolls sideways
 *   hero         `/?nogl`, `/?reduce` and `/` settle (`data-hero-ready`) into the right mode
 *
 * Usage: node scripts/smoke/smoke.mjs [--dist dist] [--out .smoke] [--skip hero,transitions]
 * Chrome comes from findChrome() (CHROME_PATH, then PATH). Exit 1 on any failure; the report and
 * screenshots go to --out (gitignored `.smoke/`), which is emptied first.
 *
 * Confidentiality: redirect pages live at old slugs. They are named only as `redirect #n -> <target>`,
 * every message is scrubbed of their paths, and nothing is captured on them.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { findChrome } from '../og-shared.mjs';
import { serve } from './server.mjs';

const CHECKS = ['console', 'transitions', 'redirects', 'overflow', 'hero'];
const WIDTHS = [360, 320];
const DESKTOP = { width: 1280, height: 800 };
/** Explicit timeouts (ms) for every wait. The redirect one must clear the 1 s meta refresh (#79). */
const T = { nav: 15_000, ready: 10_000, settle: 5_000, redirect: 10_000 };

/**
 * Console warnings that are not failures, matched by prefix. Warning type only: an `error`
 * message is never allowlisted. Each is noise from Chrome's software WebGL (SwiftShader, which
 * CI uses because the runner has no GPU), not from the site.
 */
const ALLOWED_WARNINGS = [
  // SwiftShader driver chatter, e.g. "[.WebGL-0x…]GL Driver Message (OpenGL, Performance, …): GPU stall due to ReadPixels".
  '[.WebGL-',
];

/** 1x1 transparent PNG, served for every external image (the GitHub avatar). */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const { values: args } = parseArgs({
  options: {
    dist: { type: 'string', default: 'dist' },
    out: { type: 'string', default: '.smoke' },
    skip: { type: 'string', default: '' },
  },
});
const DIST = resolve(args.dist);
const OUT = resolve(args.out);
const skip = new Set(args.skip.split(',').filter(Boolean));
for (const s of skip) if (!CHECKS.includes(s)) die(`smoke: unknown check "${s}" in --skip (known: ${CHECKS.join(', ')})`);
const run = (check) => !skip.has(check);

function die(message) {
  console.error(message);
  process.exit(2);
}

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&').replace(/&quot;/g, '"');

/** Every `<loc>` path in the sitemap. The origin is dropped so the local server can stand in. */
function sitemapPaths() {
  let xml;
  try {
    xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
  } catch {
    die(`smoke: no ${relative(process.cwd(), join(DIST, 'sitemap-0.xml'))}. Run npm run build first.`);
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const u = new URL(decode(m[1].trim()));
    return u.pathname + u.search;
  });
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

/** Redirect pages: any built page with a meta refresh. The sitemap lists none of them. */
function redirectPages() {
  const found = [];
  for (const file of htmlFiles(DIST)) {
    const m = readFileSync(file, 'utf8').match(/<meta\s+http-equiv=["']?refresh["']?\s+content=["']?\s*\d+\s*;\s*url=([^"'>]+)/i);
    if (!m) continue;
    const rel = relative(DIST, file).split('\\').join('/');
    const from = '/' + rel.replace(/(^|\/)index\.html$/, '$1');
    const to = new URL(decode(m[1].trim()), `http://x${from}`);
    found.push({ from, to: to.pathname + to.search + to.hash });
  }
  return found.sort((a, b) => a.from.localeCompare(b.from)).map((r, i) => ({ ...r, index: i + 1, label: `redirect #${i + 1} -> ${r.to}` }));
}

/** Built filenames (in dist/_astro) of the chunks only the 3D hero should fetch. */
function heroChunks() {
  let files = [];
  try {
    files = readdirSync(join(DIST, '_astro'));
  } catch {
    // No _astro directory (the self-test fixture): the hero check is skipped there.
  }
  return { hero: files.filter((f) => /^hero\.[\w-]+\.js$/.test(f)), three: files.filter((f) => /^three\.module\.[\w-]+\.js$/.test(f)) };
}

const paths = sitemapPaths();
if (!paths.length) die('smoke: dist/sitemap-0.xml lists no URLs.');
const redirects = redirectPages();

/** Remove every redirect page's old path, and its last path segment, from text that leaves this script. */
function scrub(text) {
  let s = String(text);
  for (const r of redirects) {
    const slug = r.from.split('/').filter(Boolean).pop();
    s = s.split(r.from).join(`<redirect #${r.index}>`);
    if (slug) s = s.split(slug).join('<old slug>');
  }
  return s;
}

const failures = [];
const notes = [];
let shots = 0;
function fail(check, where, message) {
  const f = { check, where: scrub(where), message: scrub(message).replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, 3).join(' | ').slice(0, 400) };
  failures.push(f);
  console.error(`FAIL [${f.check}] ${f.where}: ${f.message}`);
}

async function screenshot(page, name) {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${String(++shots).padStart(2, '0')}-${name.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'root'}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
}

const chrome = findChrome();
if (!chrome) die('smoke: no Chrome found on PATH (google-chrome, chromium, chromium-browser). Set CHROME_PATH to a Chrome or Chromium binary.');

rmSync(OUT, { recursive: true, force: true });
const started = Date.now();
const server = await serve(DIST);
const { origin } = server;
const at = (path) => origin + path;
const local = (url) => {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
};
const pathOf = (url) => {
  const u = new URL(url);
  return u.pathname + u.search + u.hash;
};

console.log(`smoke: ${paths.length} sitemap URLs, ${redirects.length} redirect pages, Chrome ${chrome}`);

const browser = await chromium.launch({
  executablePath: chrome,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/**
 * A context with external requests stubbed, and a page whose console, errors and same-origin
 * request failures are reported against `where.current`.
 */
async function open(check, options = {}) {
  const context = await browser.newContext({ viewport: DESKTOP, ...options });
  await context.route('**/*', (route) => {
    const req = route.request();
    if (local(req.url())) return route.continue();
    if (req.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const where = { current: '' };
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') fail(check, where.current, `console error: ${text}`);
    else if (msg.type() === 'warning' && !ALLOWED_WARNINGS.some((p) => text.startsWith(p))) fail(check, where.current, `console warning: ${text}`);
  });
  page.on('pageerror', (err) => fail(check, where.current, `page error: ${err.message}`));
  page.on('requestfailed', (req) => {
    if (local(req.url())) fail(check, where.current, `request failed: ${pathOf(req.url())} (${req.failure()?.errorText ?? 'unknown'})`);
  });
  page.on('response', (res) => {
    if (local(res.url()) && res.status() >= 400) fail(check, where.current, `HTTP ${res.status()}: ${pathOf(res.url())}`);
  });
  return { context, page, where };
}

/** Load a page and let it go quiet: no request for 500 ms (Playwright's networkidle). */
const load = (page, path) => page.goto(at(path), { waitUntil: 'networkidle', timeout: T.nav });

/** Run one check's body; a thrown error (a timeout, a crash) is that check's failure. */
async function step(check, where, body) {
  try {
    await body();
  } catch (err) {
    fail(check, where, err.message);
  }
}

// 1. Console clean on every sitemap URL.
if (run('console')) {
  const { context, page, where } = await open('console');
  for (const path of paths) {
    where.current = path;
    await step('console', path, () => load(page, path));
  }
  await context.close();
}

// 2. Cross-document view transitions through the primary Nav.
if (run('transitions')) {
  const { context, page, where } = await open('transitions');
  // Registered before any page script. A skipped transition rejects `ready` (`finished` still
  // fulfils), so both are awaited: 'done' only when the transition really ran.
  await context.addInitScript(() => {
    addEventListener('pagereveal', (event) => {
      const vt = event.viewTransition;
      const settled = vt ? Promise.all([vt.ready, vt.finished]).then(() => 'done', () => 'skipped') : Promise.resolve('none');
      window.__smokeVT = settled;
      settled.then((v) => (window.__smokeVTResult = v));
    });
  });
  const counts = { done: 0, none: 0, skipped: 0, 'same-document': 0 };
  where.current = '/';
  let links = [];
  await step('transitions', '/', async () => {
    await load(page, '/');
    links = await page.locator('header nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  });
  if (!links.length) fail('transitions', '/', 'no primary Nav links (header nav a) found');
  for (const [i, href] of links.entries()) {
    const target = new URL(href, at('/')).href;
    where.current = `/ -> ${href}`;
    await step('transitions', where.current, async () => {
      await load(page, '/');
      await page.evaluate(() => delete window.__smokeVTResult);
      const sameDocument = new URL(target).pathname === '/' && new URL(target).search === '';
      await page.locator('header nav a').nth(i).click({ timeout: T.settle });
      await page.waitForURL(target, { timeout: T.nav });
      if (sameDocument) {
        counts['same-document']++;
        return;
      }
      const result = await (await page.waitForFunction(() => window.__smokeVTResult, null, { timeout: T.settle })).jsonValue();
      counts[result]++;
      if (result === 'skipped') fail('transitions', where.current, 'view transition was skipped');
    });
  }
  if (links.length && !counts.done) fail('transitions', 'Nav', 'no Nav hop reported viewTransition.finished as done: the transition check did not run');
  notes.push(`transitions: ${counts.done}/${links.length} Nav hops done (${counts.none} none, ${counts.skipped} skipped, ${counts['same-document']} same-document)`);
  await context.close();
}

// 3. Redirect pages, entered by an in-page navigation (renderer-initiated, unlike page.goto) so the
// cross-document transition really runs into them (#55). The page reports its own lifecycle: it must
// be revealed with a view transition, and that transition must finish before the meta refresh leaves.
// Leaving earlier is the #79 condition (Chrome then logs "AbortError: Transition was skipped" only
// sometimes), so it is asserted directly instead of waiting for the console to say so. Only
// `finished` is observed, never `ready`, so no rejection the browser would report gets handled here.
if (run('redirects') && redirects.length) {
  const { context, page, where } = await open('redirects');
  const seen = [];
  await context.exposeBinding('__smokeLifecycle', (_source, event) => seen.push(event));
  await context.addInitScript(() => {
    const report = (type, vt) => window.__smokeLifecycle({ path: location.pathname, type, vt });
    addEventListener('pagereveal', (event) => {
      report('reveal', Boolean(event.viewTransition));
      event.viewTransition?.finished.then(() => report('finished', true));
    });
    addEventListener('pageswap', () => report('swap', false));
  });
  for (const r of redirects) {
    where.current = r.label;
    await step('redirects', r.label, async () => {
      where.current = `${r.label} (from /)`;
      await load(page, '/');
      where.current = r.label;
      seen.length = 0;
      await page.evaluate((href) => {
        location.href = href;
      }, at(r.from));
      await page.waitForURL(at(r.to), { timeout: T.redirect, waitUntil: 'load' });
      await page.waitForLoadState('networkidle', { timeout: T.nav });
      const on = seen.map((e, i) => ({ ...e, i })).filter((e) => e.path === r.from);
      const reveal = on.find((e) => e.type === 'reveal');
      const finished = on.find((e) => e.type === 'finished');
      const swap = on.find((e) => e.type === 'swap');
      if (!reveal) fail('redirects', r.label, 'the redirect page was never revealed: its refresh left before the incoming view transition (#79)');
      else if (!reveal.vt) fail('redirects', r.label, 'no cross-document view transition ran into the redirect page (#55 opt-in)');
      else if (!finished || (swap && swap.i < finished.i))
        fail('redirects', r.label, 'the refresh left while the incoming view transition was still running (#79 AbortError)');
    });
  }
  notes.push(`redirects: ${redirects.length} pages followed`);
  await context.close();
}

// 4. No sideways scroll at phone widths.
if (run('overflow')) {
  for (const width of WIDTHS) {
    const { context, page, where } = await open('overflow', { viewport: { width, height: 800 } });
    for (const path of paths) {
      where.current = `${path} @ ${width}px`;
      await step('overflow', where.current, async () => {
        await load(page, path);
        await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: T.settle });
        const over = await page.evaluate(() => {
          const de = document.documentElement;
          const cw = de.clientWidth;
          if (de.scrollWidth <= cw) return null;
          const clipped = (el) => {
            for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement)
              if (getComputedStyle(p).overflowX !== 'visible') return true;
            return false;
          };
          let worst = null;
          let widest = -1;
          for (const el of document.body.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.right <= cw + 0.5 || clipped(el)) continue;
            if (r.width > widest) [worst, widest] = [el, r.width];
          }
          const selector = (el) => {
            const parts = [];
            for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
              let s = e.tagName.toLowerCase();
              if (e.id) {
                parts.unshift(`${s}#${CSS.escape(e.id)}`);
                break;
              }
              const cls = [...e.classList].slice(0, 2).map((c) => CSS.escape(c));
              if (cls.length) s += `.${cls.join('.')}`;
              parts.unshift(s);
            }
            return parts.join(' > ');
          };
          return { scrollWidth: de.scrollWidth, clientWidth: cw, selector: worst ? selector(worst) : '(no single element)', width: Math.round(widest) };
        });
        if (over) {
          fail('overflow', where.current, `scrollWidth ${over.scrollWidth} > clientWidth ${over.clientWidth}; widest offender ${over.selector} (${over.width}px)`);
          await screenshot(page, `overflow-${width}-${path}`);
        }
      });
    }
    await context.close();
  }
}

// 5. Hero degraded paths on /. `data-hero-ready` is set only once the hero script has decided the mode.
if (run('hero')) {
  const chunks = heroChunks();
  const READY = '#hero-3d[data-hero-ready]';

  /** The h1 says the name: concatenated letter text equals its aria-label without whitespace. */
  async function lettersSpellName(page, where) {
    const { label, text } = await page.evaluate(() => {
      const h1 = document.querySelector('h1#hero-title');
      return {
        label: h1?.getAttribute('aria-label') ?? '',
        text: [...(h1?.querySelectorAll('.hero-letter') ?? [])].map((l) => l.textContent).join(''),
      };
    });
    if (!label || text !== label.replace(/\s+/g, '')) fail('hero', where, `hero letters "${text}" do not spell the h1 label "${label}"`);
  }
  async function lettersOpaque(page, where) {
    const notOpaque = await page.evaluate(() =>
      [...document.querySelectorAll('.hero-letter')].filter((l) => getComputedStyle(l).opacity !== '1').length,
    );
    if (notOpaque) fail('hero', where, `${notOpaque} .hero-letter element(s) not at opacity 1`);
  }

  if (!chunks.hero.length) fail('hero', '/', 'no hero.*.js chunk in dist/_astro: cannot check that ?nogl skips it');

  // ?nogl: poster, no 3D chunk fetched, poster shown and canvas hidden once transitions finish.
  {
    const where0 = '/?nogl';
    const { context, page, where } = await open('hero');
    where.current = where0;
    const requested = [];
    page.on('request', (req) => requested.push(new URL(req.url()).pathname.split('/').pop()));
    await step('hero', where0, async () => {
      await load(page, '/?nogl');
      await page.waitForSelector(READY, { state: 'attached', timeout: T.ready });
      const mode = await page.getAttribute('#hero-3d', 'data-mode');
      if (mode !== 'poster') fail('hero', where0, `data-mode is "${mode}", expected "poster"`);
      const fetched = [...chunks.hero, ...chunks.three].filter((c) => requested.includes(c));
      if (fetched.length) fail('hero', where0, `3D chunk requested: ${fetched.join(', ')}`);
      await page.waitForFunction(
        () => ['.hero-poster', '.hero-canvas'].every((s) => document.querySelector(`#hero-3d ${s}`)?.getAnimations().every((a) => a.playState === 'finished')),
        null,
        { timeout: T.settle },
      );
      const [poster, canvas] = await page.evaluate(() =>
        ['.hero-poster', '.hero-canvas'].map((s) => getComputedStyle(document.querySelector(`#hero-3d ${s}`)).opacity),
      );
      if (poster !== '1' || canvas !== '0') fail('hero', where0, `poster opacity ${poster}, canvas opacity ${canvas}; expected 1 and 0`);
      await lettersSpellName(page, where0);
    });
    if (failures.some((f) => f.where === where0)) await screenshot(page, 'hero-nogl');
    await context.close();
  }

  // ?reduce with prefers-reduced-motion emulated: the CSS letter reveal follows the media query.
  {
    const where0 = '/?reduce';
    const { context, page, where } = await open('hero', { reducedMotion: 'reduce' });
    where.current = where0;
    await step('hero', where0, async () => {
      await page.goto(at('/?reduce'), { waitUntil: 'load', timeout: T.nav });
      const running = await page.evaluate(
        () => [...document.querySelectorAll('.hero-letter')].filter((l) => l.getAnimations().some((a) => a.playState === 'running')).length,
      );
      if (running) fail('hero', where0, `${running} .hero-letter animation(s) running under reduced motion`);
      await lettersOpaque(page, where0);
      await page.waitForSelector(READY, { state: 'attached', timeout: T.ready });
      const mode = await page.getAttribute('#hero-3d', 'data-mode');
      if (mode !== 'poster') fail('hero', where0, `data-mode is "${mode}", expected "poster"`);
      await lettersSpellName(page, where0);
      await page.waitForLoadState('networkidle', { timeout: T.nav });
    });
    if (failures.some((f) => f.where === where0)) await screenshot(page, 'hero-reduce');
    await context.close();
  }

  // Default: settles (gl where software WebGL works, poster otherwise) with the console clean,
  // and the letter reveal ends with every letter shown.
  {
    const where0 = '/ (default hero)';
    const { context, page, where } = await open('hero');
    where.current = where0;
    await step('hero', where0, async () => {
      await load(page, '/');
      await page.waitForSelector(READY, { state: 'attached', timeout: T.ready });
      notes.push(`hero: default mode ${await page.getAttribute('#hero-3d', 'data-mode')}`);
      await page.waitForFunction(
        () => [...document.querySelectorAll('.hero-letter')].every((l) => l.getAnimations().every((a) => a.playState === 'finished')),
        null,
        { timeout: T.settle },
      );
      await lettersOpaque(page, where0);
      await lettersSpellName(page, where0);
      await page.waitForLoadState('networkidle', { timeout: T.nav });
    });
    if (failures.some((f) => f.where === where0)) await screenshot(page, 'hero-default');
    await context.close();
  }
}

await browser.close();
await server.close();

const seconds = ((Date.now() - started) / 1000).toFixed(1);
for (const n of notes) console.log(`smoke: ${n}`);
const ran = CHECKS.filter(run).join(', ');
if (failures.length) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ checks: ran, sitemapUrls: paths.length, redirectPages: redirects.length, notes, failures }, null, 2) + '\n');
  console.error(`smoke: ${failures.length} failure(s) in ${seconds} s (checks: ${ran}). Report: ${join(OUT.startsWith(process.cwd()) ? relative(process.cwd(), OUT) : OUT, 'report.json')}`);
  process.exit(1);
}
console.log(`smoke: all clean in ${seconds} s (checks: ${ran})`);
