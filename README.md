# pearse.dev

Personal site of Pearse D'Arcy. Static, built with [Astro](https://astro.build) 7, Tailwind CSS v4 and a small amount of Three.js. Deployed to GitHub Pages at <https://pearse.dev>.

## Stack

- **Astro 7** — static output, content collections, `@astrojs/rss`, `@astrojs/sitemap`
- **Tailwind v4** via `@tailwindcss/vite`, configured in CSS (`src/styles/global.css`, `@theme` block) with `@tailwindcss/typography` for prose
- **Three.js** (tree-shaken) — hero icosahedron and the About-section stack object, loaded after first paint
- **GSAP** core + ScrollTrigger + SplitText — scroll reveals, loaded on idle
- **Fonts** — Archivo (display, expanded), Inter (body), JetBrains Mono (labels), self-hosted from `@fontsource-variable/*`, latin subset only

Node 22 or newer (`.nvmrc` / `engines`).

## Commands

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm run preview    # serve dist/
npm run check      # astro check (types + content schema)
npm run links      # verify every internal link in dist/ resolves
npm run gate       # confidentiality gate (see Checks)
npm test           # node:test suites under tests/
npm run og         # regenerate public/og-default.png with headless Chrome
npm run og:pages   # render per-page cards to public/og/ (also runs as prebuild)
```

## Content

Everything editorial is Markdown in `src/content/`, validated by the schemas in `src/content.config.ts`. A missing or mistyped field fails the build.

### Content model

Case studies are the `projects` collection, grouped by `category`:

| Category | What it is |
|---|---|
| `mts` | Day-job work. Exactly two: MTS Hub and wetlabs.app. |
| `client` | Commissioned work for a named client. Gated by `clientPermission`. |
| `tool` | Personal and internal tooling (the agent workflow, the keypad driver, small utilities). |
| `learning` | Side projects built to learn something. |

There is no separate `personal` category: personal projects are `tool` or `learning`. Visibility is two independent flags:

- `visibility: public | private` says whether the source is public. It only decides the repository line: `public` links `repo`, `private` shows "Private repository" and never links. MTS repositories are private.
- `clientPermission` hides a client case study everywhere until it is `granted` or `anonymised` (table below). Other categories ignore it.

Posts follow a third rule: `draft: true` or a future `pubDate` keeps an article off the pages and RSS (see Add a post). Standalone social posts need `status: approved` to reach the feed.

The two-products rule, the permission flags and the reasoning are in [ADR 0006](docs/adr/0006-mts-is-two-products-and-client-work-is-gated.md). Source briefs used to draft content (writing, design and research notes) are kept privately outside the repository; nothing here links to them. Anything that would name a customer, address, credential or figure is stopped by the gate (see Checks).

To add a case study: pick the category, create `src/content/projects/<slug>.md` as under Add a project, set `clientPermission` explicitly if it is a client, run `npm run build && npm run gate && npm test`. For an MTS tool, add a `sections` entry to MTS Hub or wetlabs.app instead. To add a post: see Add a post. Changes are logged in [`CHANGELOG.md`](CHANGELOG.md).

### Add a project

Create `src/content/projects/<slug>.md`:

```yaml
---
title: Project name
slug: project-name          # used in /work/<slug>/
oneLiner: One sentence, what it is and for whom.
period: Jan – Mar 2026
role: Sole engineer         # optional, defaults to "Sole engineer"
stack: [Django 5, PostgreSQL]
featured: true              # home page shows the first six featured, by order
order: 7                    # sort key everywhere
features: ["…", "…"]
hooks: ["…", "…"]           # 2–3 pull-quote facts
repo: https://github.com/…  # optional; omit for private work
live: https://…             # optional
visibility: private         # private | public
category: mts               # mts | client | tool | learning
clientPermission: pending   # client case studies only; pending | granted | anonymised (default pending)
diagram: MtsHub             # optional; names an architecture diagram, see Diagrams
social:                     # optional; puts the case study in /social.json as a `project` entry
  date: 2027-02-17          # planned posting date
  linkedin: |
    LinkedIn copy, ending with the case study URL.
  short: "≤ 300 chars incl. the URL"
sections:                   # optional feature sections, rendered under "What it does, in depth"
  - id: packing             # anchor: /work/<slug>/#packing
    title: Packing, inventory and fleet
    origin: Began as a standalone packing tool in Feb 2026.   # optional; no product names
    summary: One short paragraph.
    features: ["…", "…"]
    stack: [Celery]         # optional chips
    diagram: MtsCortex      # optional; same names as `diagram:`
---
Optional notes in Markdown, rendered under the facts.
```

MTS is presented as exactly two case studies, **MTS Hub** and **wetlabs.app**. Its smaller tools (WetPack, Opthalyze, Atlas, Cortex, the observability stack) are feature sections of those two, not case studies of their own, and the case studies describe them as features without their old names. The video platform's old name appears nowhere in `dist/`, in any letter case; `tests/mts-products.test.mjs` holds both rules.

When a case study is renamed or folded into another, add its old slug to `MOVED_CASE_STUDIES` in `astro.config.mjs`. The build writes a static redirect page (`<meta http-equiv="refresh">`, canonical, noindex, no JavaScript) at the old `/work/<slug>/`, kept out of the sitemap. The `quietRedirects` integration rewrites those pages so their text never repeats the old slug.

`clientPermission` gates **client case studies** (`category: client`) and is ignored for every other category.

| Value | Meaning |
|---|---|
| `pending` (default) | No permission yet. The case study is excluded from the home grid, `/work/`, its own page, the sitemap, "next" links and writing-post project links. |
| `granted` | Client agreed to be named. Published as written. |
| `anonymised` | Client agreed on condition of anonymity. Published; the copy must already be anonymised. |

Set the value explicitly on every client case study. `tests/visibility.test.mjs` unit-tests the rule for every value, asserts that `granted` ones are on `/work/` under Client work, and that `pending` ones (read from the source files) are absent from the build.

A client case study names no owner or staff member, no server name or address, and no prices or business figures, whatever its permission value.

Private repositories show "Private repository" and never link.

### Diagrams

A case study can show one architecture diagram under its features, in a figure headed "How it fits together". The frontmatter key `diagram:` names a component in `src/components/diagrams/`; without the key the page has no figure.

To add one:

1. Copy an existing diagram (say `MtsCortex.astro`) to `src/components/diagrams/<Name>.astro`.
2. Describe two layouts in viewBox units: `wide` (shown from 64rem up, about 960 wide) and `narrow` (phones, 360 wide, stacked). Each is a list of `nodes` (box, label, optional `sub` lines, `kind`: service, store, actor, ai or gate for a human approval point) and `edges` between node ids (`flow` for the main path, `both` for two-way, `optional` for opt-in). Edges route orthogonally; use `fromSide`/`toSide`, `fromOff`/`toOff` or `via` when the default crosses a box.
3. Give `Diagram` a `title` and a `desc` that tells the flow in sentences, for screen readers.
4. Add `<Name>` to `DIAGRAM_NAMES` in `src/lib/diagrams.ts` and to `DIAGRAMS` in `src/components/diagrams/index.ts`, then set `diagram: <Name>` on the case study, or on one of its `sections`.

Name only components the case study already names: no hostnames, addresses, customer names or counts. The build fails when a label is too long for its box. Flow edges animate only under `prefers-reduced-motion: no-preference`. Check both layouts at 390 and 1280 px; `tests/diagrams.test.mjs` asserts which titled diagrams each MTS case study renders.

### Add a post

Create `src/content/posts/<slug>.md`. The filename is the URL: `/writing/<slug>/`.

```yaml
---
title: Post title
description: ≤155 characters, used as the meta description.
pubDate: 2026-11-03
updatedDate: 2026-11-10     # optional
tags: [django, agents]
project: mts-hub            # optional, a project slug; links the post and the case study
draft: false
social:
  linkedin: |
    Long-form LinkedIn version, first line is the hook.
  short: "≤280 chars incl. URL, for X/Bluesky/Mastodon."
---
```

Drafts are excluded everywhere. Posts dated in the future are excluded from the HTML pages and RSS until their `pubDate`; the deploy workflow rebuilds every day at 06:00 UTC so they go live on their date.

### Social feed

`/social.json` lists every non-draft article (including scheduled ones), every approved standalone post and every visible case study with a `social` block, oldest first (on one date: articles, then standalone posts, then case studies). Each entry has a `kind`:

```json
[
  { "kind": "article", "id": "…", "slug": "…", "title": "…", "date": "2026-11-03", "pubDate": "2026-11-03",
    "url": "https://pearse.dev/writing/…/", "published": true, "status": "approved", "tags": ["…"],
    "social": { "linkedin": "…", "short": "…" } },
  { "kind": "article", "id": "…", "date": "2026-11-10", "published": false },
  { "kind": "standalone", "id": "p01", "title": "…", "date": "2026-11-04", "pillar": "Agentic engineering",
    "format": "Short lesson", "visual": "none", "published": true, "status": "approved",
    "social": { "linkedin": "…", "short": "…" } },
  { "kind": "project", "id": "east-coast-blinds", "title": "…", "date": "2027-02-17", "category": "client",
    "url": "https://pearse.dev/work/east-coast-blinds/", "published": true, "status": "approved",
    "social": { "linkedin": "…", "short": "…" } }
]
```

Articles keep their original fields (`slug`, `pubDate`, `url`, `tags`); `id` and `date` are the same values under the shared names. A scheduled article (future-dated, so no page yet) is a stub with exactly `kind`, `id`, `date` and `published: false`: no title, URL, tags or copy until the daily rebuild on its date turns it into the full entry with `published: true`. The id stays in the feed so the scheduler knows it exists, and it must never link a stub. Standalone posts have no page and no `url`, and are always `published: true`. A `project` entry's `id` is the case study slug and its `url` the case study page, which always exists for a visible case study, so it is always `published: true`; pending client case studies are never in the feed. The scheduler does not offer `project` entries yet (`isEligible` in `automation/n8n/select.mjs` returns false for any other kind).

An n8n workflow reads it to schedule posts: LinkedIn gets the `linkedin` copy, and Bluesky and Mastodon optionally get the `short` copy (see [`automation/n8n/README.md`](automation/n8n/README.md)). `/rss.xml` carries the published posts.

### Add a standalone post

A standalone post is social copy with no article. Add `src/content/social/<id>.md`; the filename is the id (lowercase, e.g. `p13.md`):

```md
---
title: "Write the rule as a hook, not a sentence"
date: 2026-11-04                 # the day it should go out (UTC)
pillar: "Agentic engineering"    # Platform building (Django) | Self-hosted AI in production | Agentic engineering | Career
format: "Short lesson"           # free text: Short lesson, How we do X, Before/after, …
visual: "none"                   # what to attach, or "none"
status: draft                    # draft | approved
short: "≤300 chars incl. URL, for X/Bluesky/Mastodon. https://pearse.dev"
note: "optional reviewer note"   # optional, not in the feed
---

The LinkedIn copy is the body, first line is the hook.
```

- `draft` (the default) is never in the social feed. Resolve every `[VERIFY: …]` marker before approving: the build fails on an approved post with a marker left in its title, short copy or body.
- Articles follow the same rule: the build fails on a non-draft article, past-dated or scheduled, with a `[VERIFY` marker left in its title, description, body, LinkedIn copy or short copy.
- `approved` is in the feed straight away, even when dated in the future, so the scheduler can plan around its `date`. The scheduler still asks for a human approve before sending anything (ADR 0004).

The collection is the source of truth: edit the Markdown directly. The first twelve were migrated from a JSON file that has since been deleted; `scripts/migrate-standalone.mjs` is kept only as the record of that migration and must not be re-run.

### Now page

`/now/` renders `src/content/now/now.md`. To update it, edit the file and bump `updated` in the frontmatter; the page shows it as "Updated <Month YYYY>". Keep it public-safe (see ADR 0005).

### CV

`/cv/` is built from the site: contact links and location from `src/lib/site.ts`, the featured and MTS case studies that are visible (pending client case studies are excluded, as everywhere; only the start of each period is shown, and roles are left to the case study pages), and the marquee stack as skills. Facts that exist nowhere else on the site (headline, profile, experience, education, and languages once confirmed) live in `src/content/cv/cv.md`; their wording follows `docs/profile/`, and nothing that still carries a verify marker there goes in. The page has a print stylesheet (A4, black on white, no nav or footer, links spelled out, entries never split across pages); "Download PDF" calls `window.print()`. Keep the print preview at two pages or fewer when adding content.

### GitHub section

Section 04 on the home page shows the public GitHub profile of `pearsedarcy`: a profile card (public repos and, when the calendar is available, last year's contributions, with a note that most of the work is in private repositories), the last year's contribution heatmap (inline SVG, no client JS) and six repository cards. Every link goes to github.com. `src/lib/github.ts` fetches it once per build:

- Profile and repositories come from the REST API, no token needed. The cards are an allowlist that fails closed: a repository is shown only if it is public, owned by `pearsedarcy` (never an org) and named in `FEATURED_REPOS` or `SHOWN_REPOS` in `src/lib/github.ts`; the fork flag does not matter for a listed name, and anything unlisted is skipped. Featured repositories come first in list order, then shown ones by last-push day (UTC, newest first), with list order breaking ties, capped at six. Every listed name needs an entry in `DESCRIPTION_OVERRIDES` or `DESCRIPTION_FALLBACKS`. To show a new repository, add its name and its copy in the same pull request.
- The build logs the public repositories it skipped. Locally the line names them; when `CI` is set it logs only the count, because Actions logs on a public repository are public.
- The contribution calendar comes from GraphQL `contributionsCollection`, which needs `GITHUB_TOKEN`. CI and the deploy pass `github.token`.
- `src/data/github.json` is the committed, already-shaped snapshot. Reading it applies the same repository rule (unlisted repositories dropped, re-ordered, capped) and the avatar-host check. Without network the build uses it whole; without a token it keeps the snapshot's calendar. Either way it logs a `[github]` warning saying so. A successful fetch rewrites the file when the data changed, so a local build with network may leave it modified: commit it or `git checkout` it.
- `GITHUB_FETCH=0` forces the snapshot (offline builds, reproducible tests).
- `tests/github.test.mjs` covers the shaping, the fallback paths with a fake `fetch`, and the rendered section.

## Open Graph images

Every article and visible case study page gets its own 1200x630 card at `/og/<slug>.png`: the title in Archivo, a mono kicker (date and reading time for an article, order, category and period for a case study), the icosahedron mark and `pearse.dev` above the lime bar. Home, index and 404 pages keep `public/og-default.png`, which is committed and regenerated by hand with `npm run og`.

- `scripts/og-pages.mjs` renders the cards with headless Chrome, not satori, because the Archivo width axis only renders faithfully in a browser. It runs as `prebuild`, so `npm run build` (and `withastro/action` on deploy) always regenerates them; `npm run og:pages` runs it alone. Four renders run in parallel, about 2 s for the current pages.
- `public/og/` is generated and gitignored. The script empties it first, so a post that goes back to draft loses its card.
- Which pages get a card follows `src/lib/visibility.ts`, the same publish and visibility rules the pages use: drafts, future-dated articles and `pending` client case studies get none.
- Chrome comes from `CHROME_PATH`, then `google-chrome`, `chromium` or `chromium-browser` on `PATH`. Without one the script warns and every page falls back to the default image, so a local build never fails on it; under `CI` it fails instead. `src/lib/og.ts` picks the page card only when its file exists.
- `og:image:alt` (and `twitter:image:alt`) reads `<Title>, Pearse D’Arcy, pearse.dev`; `twitter:image` mirrors `og:image`.
- `tests/og.test.mjs` checks one distinct card per page, each a real PNG over 10 KB, none for drafts or pending client case studies, and the default on every other page. It skips the image assertions when the build had no Chrome (`.astro/og-pages.json` records the run).

## Motion and degraded paths

- **The scene gate** (`src/lib/scene-gate.ts`, one pure rule, `tests/scene-gate.test.mjs`). The full 3D scenes (the hero icosahedron and the five-layer stack) are for capable, motion-tolerant desktop visitors. A visitor stays on the build-time SVG poster, and never fetches three.js, when any of these is true: WebGL is unavailable; `prefers-reduced-motion: reduce`; the browser sends Save-Data (`navigator.connection.saveData`, where the API exists); the viewport is narrower than 640 px; or `?lite` is in the URL. Both components build a probe (`sceneProbe()` in `src/scripts/env.ts`) inside their deferral (`onIdle` for the hero, the IntersectionObserver for the stack) and import the scene module only when the rule returns `'gl'`.
- Reduced-motion and Save-Data visitors get the poster. The poster is not claimed to be pixel-identical to the single frame the scenes used to draw under reduced motion; that is a product decision, not a parity claim.
- `isLowEnd()` (four cores or fewer, or under 640 px) is separate: it lowers detail on desktop scenes that do load, and is not part of the gate.
- The marquee and the letter reveal also stop under reduced motion.
- Force a path for testing with `?reduce`, `?nogl` or `?lite` on any URL.
- Once the hero script has decided the mode, on every path (no WebGL, gl mounted, import failed), it sets `data-hero-ready` on `#hero-3d`. The attribute exists only at runtime, never in the static HTML, which already ships `data-mode="poster"`. The browser smoke run waits on it to check `?nogl` (poster, no three.js fetched), `?reduce` (with reduced motion emulated: no letter animation, every letter shown) and the default path.

## Checks

`.github/workflows/check.yml` runs on every pull request and is called by the deploy workflow, whose `build` job needs it green. It runs `npm ci`, then in order: check (`astro check`), build, link crawl, Lighthouse, smoke (the browser smoke run below), `npm test`, gate (the confidentiality gate).

The gate (`scripts/gate.mjs`, ADR 0005) scans `dist/`, `src/` and `docs/` case-insensitively for patterns that must never ship. Patterns come from the repository secret `CONFIDENTIAL_PATTERNS`: one regular expression per line (case-insensitive, multiline: `^`/`$` match per line), blank lines and `#` comments ignored. Every file is scanned except known binary types and files containing a NUL byte. The `#n` in the output counts patterns (non-empty, non-comment lines), not file lines. The printed path can itself reveal a name, so keep sensitive words out of filenames. Fork and Dependabot PRs receive no secret and so only get the warning. A missing `dist/` fails the gate: build first. On a hit it prints `<file>: pattern #<n>` and fails; it never prints the matched text. With no patterns it passes with a warning annotation, so the workflow works before the secret exists.

Locally, put the same patterns in `.confidential-patterns` at the repo root (gitignored, never commit it) and run `npm run build && npm run gate` before pushing. `CONFIDENTIAL_PATTERNS` in the environment takes precedence over the file.

### Lighthouse budget

`npm run lhci` (`lhci autorun`, config in `lighthouserc.json`) serves `dist/` locally and audits `/`, `/work/mts-hub/` and `/writing/why-i-rebuilt-pearse-dev/` three times each (median asserted) with the default mobile preset. Budgets, each an `error` that fails the PR: performance 0.9 or more, accessibility 1.0, best practices 0.95 or more, SEO 1.0. The URL list is hard-coded: bump the article URL when a new article is published. Run locally with `npm run build && npm run lhci` (set `CHROME_PATH` if Chrome is not found). Reports land in `.lighthouseci/` (gitignored); CI uploads them as the `lighthouse-report` artefact, kept 7 days, even on failure (`include-hidden-files` is needed because `.lighthouseci` is a dot-directory). Order in CI: check, build, link crawl, Lighthouse, smoke, `npm test` (which rebuilds `dist` via `pretest`), gate.

### Browser smoke run

Every other check reads `dist/` as text. `npm run smoke` (`scripts/smoke/smoke.mjs`) drives the built site in headless Chrome through `playwright-core` (no browser download) and fails on what a visitor would see. It serves `dist/` with a small `node:http` server on `127.0.0.1`, visits every URL in `dist/sitemap-0.xml` plus every redirect page (any page with a meta refresh), and prints both counts. External requests never leave the machine: images get a 1x1 PNG, everything else is aborted. It runs sequentially in one browser:

- **Console:** on every sitemap URL, a console error, an uncaught page error, a failed same-origin request or a same-origin response of 400 or more fails. Console warnings fail too, except a short commented allowlist of software-WebGL noise (warnings only, never errors).
- **Transitions:** from `/`, each primary Nav link. A skipped cross-document view transition fails, and at least one hop must report `done` (the summary prints the count).
- **Redirects:** from `/`, an in-page navigation into each redirect page, then its target within 10 s. The page must be revealed with a view transition that finishes before the 1 s meta refresh leaves (#55, #79), with the console clean on both hops. Redirect pages are only ever named `redirect #n -> <target>`: no screenshot is taken on them, and their old paths are scrubbed from every message.
- **Overflow:** at 360 and 320 px, after `document.fonts` has loaded, no sitemap URL may scroll sideways. A failure names the path, the width and the widest offending element.
- **Hero:** `/?nogl`, `/?reduce` and `/`, each waiting on `data-hero-ready` (see Motion and degraded paths).

Run it locally with `npm run build && npm run smoke`. Chrome comes from `findChrome()` (`CHROME_PATH`, then `google-chrome`, `chromium` or `chromium-browser` on `PATH`); without one it fails and asks for `CHROME_PATH`. It launches with `--no-sandbox` and SwiftShader, so CI gets software WebGL. `npm run smoke:self` runs it against the fixture in `scripts/smoke/fixture/` (a page that throws, a 400 px element, a clean page) and checks that it fails for exactly those. Neither is part of `npm test`. On failure the run writes `.smoke/report.json` and screenshots (gitignored); CI uploads `.smoke/` as the `smoke-report` artefact, kept 7 days, only when the job fails. Every wait names its signal and has a timeout; there are no fixed sleeps.

## Requirements

Node 22.23.4 or newer (`.nvmrc`). Astro 7 refuses older 22.x builds, including the 22.23.3 that GitHub-hosted runners cache under a bare `22`, which is why the workflow pins the patch version.

## Deploy

`.github/workflows/deploy.yml` builds with `withastro/action` and publishes with `actions/deploy-pages` on every push to `master`, on the daily schedule, and on manual dispatch. The repository's Pages source must be set to **GitHub Actions**. `public/CNAME` keeps the custom domain; `site` is `https://pearse.dev` with no `base`.

## Docs

- **Decisions:** [`docs/adr/`](docs/adr/) (0001 to 0006) and [`GLOSSARY.md`](GLOSSARY.md).
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md).
- **Profile copy:** [`docs/profile/linkedin.md`](docs/profile/linkedin.md) (LinkedIn headline, About, Experience, Featured, Skills, paste order) and [`docs/profile/bio.md`](docs/profile/bio.md) (50, 100 and 300-word speaker bios), derived from the case studies.

## Licence

Code is MIT (see `LICENSE`). Written content under `src/content/` is © Pearse D'Arcy.
