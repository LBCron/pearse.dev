/**
 * Shared by the Open Graph card scripts: og-image.mjs (the default card) and
 * og-pages.mjs (one card per article and case study). Fonts, the icosahedron
 * mark, and how to find and drive headless Chrome.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const root = resolve(import.meta.dirname, '..');

const font = (pkg, file) => pathToFileURL(resolve(root, 'node_modules/@fontsource-variable', pkg, 'files', file)).href;

/** The site's self-hosted variable fonts as @font-face rules: Archivo (wdth axis), Mono, Inter. */
export const FONT_FACES = `@font-face{font-family:Archivo;src:url("${font('archivo', 'archivo-latin-wdth-normal.woff2')}") format("woff2-variations");font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:Mono;src:url("${font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}") format("woff2-variations");font-weight:100 800}
@font-face{font-family:Inter;src:url("${font('inter', 'inter-latin-wght-normal.woff2')}") format("woff2-variations");font-weight:100 900}`;

/** SVG <line>s of the icosahedron for a 400x400 viewBox: same projection as src/components/Hero.astro. */
export function icosahedronLines(extra = '') {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const verts = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) verts.push([0, a, b], [a, b, 0], [b, 0, a]);
  const rot = ([x, y, z], ax, ay) => {
    const y1 = y * Math.cos(ax) - z * Math.sin(ax);
    const z1 = y * Math.sin(ax) + z * Math.cos(ax);
    return [x * Math.cos(ay) + z1 * Math.sin(ay), y1, -x * Math.sin(ay) + z1 * Math.cos(ay)];
  };
  const P = verts.map((v) => rot(v, 0.35, -0.4));
  let lines = '';
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const [a, b] = [verts[i], verts[j]];
      if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) > 1e-6) continue;
      const [pa, pb] = [P[i], P[j]];
      const o = (0.3 + (0.7 * ((pa[2] + pb[2]) / 2 / PHI + 1)) / 2).toFixed(2);
      lines += `<line x1="${200 + pa[0] * 96}" y1="${200 - pa[1] * 96}" x2="${200 + pb[0] * 96}" y2="${200 - pb[1] * 96}" stroke="#c6ff3d" stroke-width="2" stroke-opacity="${o}"${extra}/>`;
    }
  return lines;
}

/** Absolute path of `bin` on PATH (`command -v`), or null. */
const onPath = (bin) => {
  try {
    const out = execFileSync('command', ['-v', bin], { shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || null;
  } catch {
    return null;
  }
};

/**
 * Chrome binary as an absolute path: $CHROME_PATH, then google-chrome, chromium,
 * chromium-browser on PATH; null if none. Absolute because Playwright (scripts/smoke/)
 * only launches an executable path that exists on disk.
 */
export function findChrome() {
  const env = process.env.CHROME_PATH;
  if (env) {
    if (existsSync(env)) return resolve(env);
    const found = onPath(env);
    if (found) return found;
    console.warn(`CHROME_PATH=${env} does not exist; looking on PATH instead.`);
  }
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser']) {
    const found = onPath(bin);
    if (found) return found;
  }
  return null;
}

/** Headless screenshot flags for a 1200x630 card. CI runners get --no-sandbox (trusted local HTML only). */
export function screenshotArgs(out) {
  return [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    ...(process.env.CI ? ['--no-sandbox'] : []),
    `--screenshot=${out}`,
    '--virtual-time-budget=3000',
  ];
}
