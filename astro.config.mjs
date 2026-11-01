// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { writeFileSync } from 'node:fs';

// Case studies that were renamed or folded into another one (issue #39: MTS is two products; #89: client names).
// A static build turns each into a small HTML page with <meta http-equiv="refresh">, a canonical
// link and noindex, so URLs that are already indexed or shared keep working without JavaScript.
const MOVED_CASE_STUDIES = {
  ophthix: '/work/wetlabs-app/',
  'infrastructure-observability': '/work/wetlabs-app/#observability',
  wetpack: '/work/mts-hub/#packing',
  opthalyze: '/work/mts-hub/#feedback',
  'mts-atlas': '/work/mts-hub/#drafting',
  'mts-cortex': '/work/mts-hub/#knowledge',
  // Client case studies renamed to their real names once permission was granted (#89).
  'jdm-parts-webshop': '/work/m-buildz/',
  'artist-wordpress-site': '/work/pauldarcy-ie/',
};

const SITE = 'https://pearse.dev';

/** @param {string} s */
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Astro's static redirect page says "Redirecting from <code>/work/<old-slug>/</code> to …". An old
// slug may carry a name the site no longer uses (MTS is two products), so once the build is done each
// moved page is rewritten as the same redirect without the "from" text: meta refresh, noindex,
// canonical, a plain link, the same view-transition opt-in as every other page (without it the browser logs an
// InvalidStateError when a transition from an opted-in page lands on the redirect), no JavaScript. Only the URL path itself still holds the old slug.
// The refresh waits 1 second, not 0: an immediate refresh starts a new navigation while the incoming
// cross-document view transition is still running, which logs "AbortError: Transition was skipped" (#79).
// The page keeps the opt-in, since dropping it brings back the #55 InvalidStateError. It sits inside a
// no-preference media query, like the shared layout's (#136); this page does not render through that layout.
const REDIRECT_DELAY = 1;
/** @type {import('astro').AstroIntegration} */
const quietRedirects = {
  name: 'quiet-redirects',
  hooks: {
    'astro:build:done': ({ dir }) => {
      for (const [slug, to] of Object.entries(MOVED_CASE_STUDIES)) {
        const rel = escapeHtml(to);
        const abs = escapeHtml(new URL(to, SITE).href);
        writeFileSync(
          new URL(`work/${slug}/index.html`, dir),
          `<!doctype html><title>Moved to ${rel}</title><meta http-equiv="refresh" content="${REDIRECT_DELAY};url=${rel}">` +
            `<meta name="robots" content="noindex"><link rel="canonical" href="${abs}">` +
            // Named icon, as on every other page: without it the browser asks for a /favicon.ico that does not exist (a 404 in the console).
            `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` +
            // Reduced motion: no opt-in, and any transition that still runs finishes instantly (#136).
            `<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}` +
            `@media (prefers-reduced-motion:reduce){::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}}</style>` +
            `<body><a href="${rel}">This page has moved to <code>${rel}</code></a></body>\n`,
        );
      }
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  redirects: Object.fromEntries(Object.entries(MOVED_CASE_STUDIES).map(([slug, to]) => [`/work/${slug}/`, to])),
  integrations: [sitemap(), quietRedirects],
  vite: {
    plugins: [tailwindcss()],
    // three.js is one intentionally lazy chunk (~130 KB gzipped); silence the 500 KB minified warning.
    build: { chunkSizeWarningLimit: 600 },
  },
  build: {
    inlineStylesheets: 'always',
  },
});
