# pearse.dev

Personal site of Pearse D'Arcy. Static, built with [Astro](https://astro.build) 7, Tailwind CSS v4 and a small amount of Three.js. Deployed to GitHub Pages at <https://pearse.dev>.

## Stack

- **Astro 7** — static output, content collections, `@astrojs/rss`, `@astrojs/sitemap`
- **Tailwind v4** via `@tailwindcss/vite`, configured in CSS (`src/styles/global.css`, `@theme` block) with `@tailwindcss/typography` for prose
- **Three.js** (tree-shaken) — hero icosahedron and the About-section stack object, loaded after first paint
- **GSAP** core + ScrollTrigger + SplitText — scroll reveals, loaded on idle
- **Fonts** — Archivo (display, expanded), Inter (body), JetBrains Mono (labels), self-hosted from `@fontsource-variable/*`, latin subset only

Node 22.23.4 or newer (`.nvmrc` / `engines`; see Requirements).

## Commands

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm run preview    # serve dist/
npm run check      # astro check (types + content schema)
npm run links      # verify every internal link in dist/ resolves
npm run gate       # confidentiality gate (see Checks)
npm test           # node:test suites under tests/ (builds first via pretest)
npm run test:ci    # the same suites with no pretest build (CI, after its one build)
npm run og         # regenerate public/og-default.png with headless Chrome
npm run og:pages   # render per-page cards to public/og/ (also runs as prebuild)
npm run cv:pdf     # print /cv/ to dist/pearse-darcy-cv.pdf (also runs as postbuild)
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

Every visible case study closes with a contact block (after "Writing about this project", before Previous/Next; `src/lib/contact.ts` picks the variant) with a mailto link titled "About <project>" from `aboutProjectHref` in `src/lib/mailto.ts` and three variants: `private` offers a walkthrough call and links nothing, `repo` (public with `repo`) links that repo, `public` (no `repo`) is the mailto alone. `tests/case-contact.test.mjs` asserts it on every page.

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
featured: true              # home page shows six cards: featured first, then backfilled by order to six
order: 7                    # /work/, case-study numbers, Previous/Next and OG cards group by category
                            # (mts, client, tool, learning) and sort by order within a group; the home
                            # page uses plain order. The displayed number is the position in that
                            # sequence, not this raw value
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
process:                    # optional, client only; rendered as "How the job ran" after the body and sections
  - step: audit             # audit | staging | gated | cutover | written-down, in that order, two or more
    proof: One sentence (max 160 chars) from this page that backs every clause of the step's promise.
---
Optional notes in Markdown, rendered under the facts.
```

`process` is for client case studies only; on any other category the build fails. The step titles and promises are shared and live in `src/lib/process.ts`; an entry cannot override them. Each `proof` paraphrases a line on the same page and must back every clause of its step's promise, adding no number, name, host or tool the page does not already state. List a step only when the page backs it. `tests/process.test.mjs` pins the steps per case study and checks that each proof's numbers and proper nouns appear elsewhere on its page.

A granted client case study titled by its domain must set `live`, and `tests/client-live-link.test.mjs` enforces it.

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
2. Describe two layouts in viewBox units: `wide` (shown from 64rem up, about 960 wide) and `narrow` (phones, 360 wide, stacked). Each is a list of `nodes` (box, label, optional `sub` lines, `kind`: service, store, actor, ai or gate for a human approval point) and `edges` between node ids (`flow` for the main path, `both` for two-way, `optional` for opt-in, `rollback` for a fallback path that is kept ready but not taken: drawn in steel with its own dash-dot pattern, never animated; it needs a `label` and cannot also be `flow`, or the build fails). Edges route orthogonally; use `fromSide`/`toSide`, `fromOff`/`toOff` or `via` when the default crosses a box.
3. Give `Diagram` a `title` and a `desc` that tells the flow in sentences, for screen readers.
4. Add `<Name>` to `DIAGRAM_NAMES` in `src/lib/diagrams.ts` and to `DIAGRAMS` in `src/components/diagrams/index.ts`, then set `diagram: <Name>` on the case study, or on one of its `sections`.

Name only components the case study already names: no hostnames, addresses, customer names or counts. The build fails when a label is too long for its box. Flow edges animate only under `prefers-reduced-motion: no-preference`. Check both layouts at 390 and 1280 px; `tests/diagrams.test.mjs` asserts which titled diagrams each case study renders.

### Add a post

Create `src/content/posts/<slug>.md`. The filename is the URL: `/writing/<slug>/`.

```yaml
---
title: Post title
description: ≤160 characters, used as the meta description.
pubDate: 2026-11-03
updatedDate: 2026-11-10     # optional
tags: [django, architecture]
project: mts-hub            # optional, a project slug; links the post and the case study
series: mts-hub             # optional, with seriesOrder: mts-hub | wetlabs-app (src/lib/series.ts)
seriesOrder: 1              # positive integer, unique within the series
draft: false
social:
  linkedin: |
    Long-form LinkedIn version, first line is the hook.
  short: "≤300 chars incl. URL, for X/Bluesky/Mastodon."
---
```

`series` and `seriesOrder` come as a pair or not at all. They put a "Part n of m" box on the article, listing only the published parts in `seriesOrder` order, once at least two are live; a duplicate order in one series fails the build, drafts included.

`tags` is a closed list of one to three terms, validated by the schema, so an unknown tag fails the build. The vocabulary lives in `src/lib/tags.ts`; each tag maps to one of the four content pillars (Platform building (Django), Self-hosted AI in production, Agentic engineering, Career). A new tag is added there and must be carried by at least two posts (`tests/post-tags.test.mjs`).

Drafts are excluded everywhere. Posts dated in the future are excluded from the HTML pages and RSS until their `pubDate`; the deploy workflow rebuilds every day at 04:23 UTC so they go live on their date. GitHub disables scheduled workflows after 60 days with no repository activity, so `.github/workflows/keepalive.yml` re-enables the deploy workflow weekly. That works only if the enable call resets GitHub's inactivity counter, which GitHub does not document; the fallback is a push to `master` at least every 60 days.

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

- `draft` (the default) is never in the social feed. Resolve every `[VERIFY: …]` marker before approving.
- One rule covers every published kind: the build fails on an approved standalone post, a non-draft article (past-dated or scheduled) or a visible case study (with or without social copy) that still has a marker in its body or in any frontmatter field, nested strings included, except the fields in the exemption list `VERIFY_EXEMPT` (today only the standalone `note`). The error names the kind, the id and the field paths, never the marked text. The rule lives in `src/lib/verify-marker.ts`; `npm test` also fails on a marker in any built text file in `dist/`, which covers `/now/`, `/cv/` and the other pages with no feed entry.
- `approved` is in the feed straight away, even when dated in the future, so the scheduler can plan around its `date`. The scheduler still asks for a human approve before sending anything (ADR 0004).

The collection is the source of truth: edit the Markdown directly. The first twelve were migrated from a JSON file that has since been deleted; `scripts/migrate-standalone.mjs` is kept only as the record of that migration and must not be re-run.

### Now page

`/now/` renders `src/content/now/now.md`. To update it, edit the file and bump `updated` in the frontmatter; the page shows it as "Updated <Month YYYY>". Keep it public-safe (see ADR 0005). The file holds no address: the page template adds "Write to <address>." straight after the content, so "Open to conversations" must stay the last section (`tests/mailto.test.mjs` checks the order).

### Contact and mailto links

Every mailto on the site comes from `src/lib/mailto.ts` (#153), and no page, component or content file may contain the literal address (only `src/lib/site.ts` holds it) or a `mailto:` outside comments; `tests/mailto.test.mjs` fails on either. The address is always `SITE.email`. Subjects are a closed set, one constant per context (`home`, `cv`, `now`, `brief`); the only other subject is a case study's "About <title>" on its own page. No user-typed text ever goes into a subject. `buildMailto(context, body)` percent-encodes per RFC 6068 (line breaks as `%0D%0A`), caps the body at `MAX_BODY` code units and the href at `MAX_HREF` characters, reports `truncated`, and returns the same content as plain text for the clipboard. The module imports only `./site.ts`, so the unit tests load it under Node's type stripping and the home contact script can import it alone.

The home `#contact` section and the `/cv/` contact line have a Copy button beside the address; it is reserved with `visibility` from first paint and shown only when `navigator.clipboard` exists, and `/cv/` hides it in print. `#contact` also has a brief form: without script it is a native `method="get"` form to the bare mailto address with a hidden `subject` and a `body` textarea, the only named fields; with script, submit goes through `buildMailto('brief', …)` and "Copy brief" copies the plain text, for webmail and for briefs over the cap.

### CV

`/cv/` is built from the site: contact links and location from `src/lib/site.ts`, the featured case studies and the MTS ones that are visible (pending client case studies are excluded, as everywhere; only the start of each period is shown, and roles are left to the case study pages), and the marquee stack as skills. Facts that exist nowhere else on the site (headline, profile, experience, education, and languages once confirmed) live in `src/content/cv/cv.md`; their wording follows `docs/profile/`, and nothing that still carries a verify marker there goes in. The page has a print stylesheet (A4, black on white, no nav or footer, links spelled out, entries never split across pages). Keep it at two pages or fewer when adding content: `npm test` fails on a third.

"Download PDF" is a plain link to `/pearse-darcy-cv.pdf` with a `download` attribute, so it works without JavaScript and hands recruiters a file to attach. The file is printed from the built page by `scripts/cv-pdf.mjs`, which runs as `postbuild` (and alone as `npm run cv:pdf`): it serves `dist/` on a throwaway 127.0.0.1 server for the length of the step, rewrites the root-relative links in the copy of `/cv/` it serves (never in `dist/`) to `https://pearse.dev/`, so the PDF's links are public, and prints with headless Chrome (`--no-pdf-header-footer`, the page's own `@page` rules). It deletes any old PDF first and writes `.astro/cv-pdf.json` (`{ chrome, pdf, pages }`) for the tests. Next to the link, a "Print" button (`window.print()`) appears once JavaScript runs; it is the fallback whenever the link is gone. The page never ships a link to a missing file:

| Situation | PDF | Link in `dist/cv/index.html` | Exit |
|---|---|---|---|
| Chrome found, print OK | written | kept | 0 |
| No Chrome, not CI | none | removed | 0, with a warning |
| No Chrome, `CI` set | none | removed | 1 |
| Chrome found but the print fails, times out or writes no, an empty or an unreadable file (CI or not) | deleted | removed | 1 |

"No Chrome" means `findChrome()` (`scripts/og-shared.mjs`) found none; an invalid `CHROME_PATH` still falls back to PATH. To try the no-Chrome path locally, reduce PATH to the Node bin directory and give npm an absolute shell: `/usr/bin/env PATH="$(dirname "$(command -v node)")" CHROME_PATH=/nonexistent npm run --script-shell=/bin/sh cv:pdf`.

### GitHub section

Section 04 on the home page shows the public GitHub profile of `pearsedarcy`: a profile card (public repos and, when the calendar is available, last year's contributions, with a note that most of the work is in private repositories), the last year's contribution heatmap (inline SVG, no client JS) and six repository cards. Every link goes to github.com. `src/lib/github.ts` fetches it once per build:

- Profile and repositories come from the REST API, no token needed. The cards are an allowlist that fails closed: a repository is shown only if it is public, owned by `pearsedarcy` (never an org) and named in `FEATURED_REPOS` or `SHOWN_REPOS` in `src/lib/github.ts`; the fork flag does not matter for a listed name, and anything unlisted is skipped. Featured repositories come first in list order, then shown ones by last-push day (UTC, newest first), with list order breaking ties, capped at six. Every listed name needs an entry in `DESCRIPTION_OVERRIDES` or `DESCRIPTION_FALLBACKS`. To show a new repository, add its name and its copy in the same pull request.
- The build logs the public repositories it skipped. Locally the line names them; when `CI` is set it logs only the count, because Actions logs on a public repository are public.
- The contribution calendar comes from GraphQL `contributionsCollection`, which needs `GITHUB_TOKEN`. CI and the deploy pass `github.token`.
- `src/data/github.json` is the committed, already-shaped snapshot. Reading it applies the same repository rule (unlisted repositories dropped, re-ordered, capped) and the avatar-host check. Without network the build uses it whole; without a token it keeps the snapshot's calendar. Either way it logs a `[github]` warning saying so. A successful fetch rewrites the file when the data changed, so a local build with network may leave it modified: commit it or `git checkout` it.
- `GITHUB_FETCH=0` forces the snapshot (offline builds, reproducible tests).
- The profile avatar is self-hosted, so no built page loads anything from GitHub's avatar CDN. `src/assets/github-avatar.jpg` is committed (a 160x160 JPEG, no metadata) and is the source of truth: the card imports it and renders it with astro:assets `<Picture>` (AVIF and WebP at 80 and 160 px, JPEG fallback). A live build only refreshes it. After shaping the profile, `loadGithub` downloads `avatarUrl` (https on the avatar host, `image/*`, at most 256 KB), has sharp decode it, resize to 160x160 cover, encode a JPEG at a fixed quality and drop all metadata, and writes the file only if those normalised bytes differ from the committed ones. Any failure (offline, `GITHUB_FETCH=0`, wrong host or type, oversize, decode error) keeps the committed file and logs one `[github]` warning. **One build behind:** Astro reads the static import before page frontmatter runs `getGithub()`, so the build that fetches a new avatar still renders the committed one and the new bytes show from the next build. The deploy build commits nothing (ADR 0003), so a refreshed avatar only matters locally: commit `src/assets/github-avatar.jpg` or `git checkout` it. `avatarUrl` stays in `src/data/github.json` as the refresh source; no page renders it.
- `tests/github.test.mjs` covers the shaping, the fallback paths and the avatar refresh with a fake `fetch`, and the rendered section and avatar markup. `tests/no-third-party-origins.test.mjs` parses every built page and fails on any resource (`src`, `srcset`, `poster`, stylesheet/icon/preload `<link>`, inline `url()`) outside pearse.dev; its `ALLOWED_THIRD_PARTY_ORIGINS` list is empty.

## Site config

`src/lib/site.ts` holds three optional fields for the Fediverse and Bluesky. All three ship **unset** (`null`, typed `string | null` so the set branch is type-checked), and nothing new renders until they are filled in. Putting a real value in is a one-line change per field.

- `mastodon`: the full `https://` profile URL. When set, the footer gets a Mastodon link.
- `bluesky`: the full `https://` profile URL on bsky.app. When set, the footer gets a Bluesky link.
- `atprotoDid`: the Bluesky DID (`did:plc:…` or `did:web:…`). When set, the build emits `/.well-known/atproto-did` whose body is exactly the DID, which is what lets Bluesky use `pearse.dev` as a handle. While it is unset the build contains no such file.

The footer links come from `profileLinks(SITE)` in `src/lib/profile-links.ts`: GitHub, LinkedIn, then Mastodon and Bluesky when set, each with `rel="me"`. The footer is in the shared layout, so every page carries them; Source, Now, CV, RSS and social.json do not. A set value that is not an `https://` URL, or a DID that does not match `^did:(plc|web):[A-Za-z0-9._:%-]+$`, fails the build. `tests/social-links.test.mjs` covers the set state with placeholder values and the shipped build by reading `SITE`.

After the values are set and deployed, two steps are by hand:

1. On Mastodon, add `https://pearse.dev` as a profile metadata link. Mastodon fetches the page and looks for the `rel="me"` link back to the profile.
2. In the Bluesky app, set the handle to `pearse.dev`. Bluesky reads `https://pearse.dev/.well-known/atproto-did`.

**Bluesky DNS fallback.** If the well-known file does not reach the deployed site, or DNS is preferred, add a TXT record in Cloudflare: name `_atproto`, value `did=<DID>`. The deploy uploads `dist/` with `actions/upload-pages-artifact@v5`, which leaves out dot-directories unless `include-hidden-files: true` is set; `check.yml` sets it (#140, for `security.txt`), so `/.well-known/` ships. Still check `curl https://pearse.dev/.well-known/atproto-did` after the first deploy with a DID set and use the TXT record if it answers 404.

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
- **The GSAP chunk** (`motion.*.js`) is only fetched when the page has motion targets (`src/lib/motion-gate.ts`: `[data-split]`, `[data-reveal]`, `.hero-letter:not(.is-space)`) and reduced motion is off, `?reduce` included. `tests/motion-gate.test.mjs` keeps that list in step with `src/scripts/motion.ts`.
- Page-to-page view transitions stop under reduced motion too, in two layers (`tests/view-transition-motion.test.mjs`). The shared layout opts in (`@view-transition { navigation: auto; }`) only inside `@media (prefers-reduced-motion: no-preference)`, so reduced-motion visitors never start one, and the global reduced-motion block sets `animation: none !important` on `::view-transition-group(*)`, `::view-transition-old(*)` and `::view-transition-new(*)` as a backstop. The static `/work/<old-slug>/` redirect pages keep the guarded opt-in. This follows the OS/browser setting only: `?reduce` drives the JS paths (hero, stack) and cannot change a CSS media query, so it does not affect view transitions.
- Force a path for testing with `?reduce`, `?nogl` or `?lite` on any URL.
- Once the hero script has decided the mode, on every path (no WebGL, gl mounted, import failed), it sets `data-hero-ready` on `#hero-3d`. The attribute exists only at runtime, never in the static HTML, which already ships `data-mode="poster"`. The browser smoke run waits on it to check `?nogl` (poster, no three.js fetched), `?reduce` (with reduced motion emulated: no letter animation, every letter shown) and the default path.

## Checks

`.github/workflows/check.yml` runs on every pull request and is called by the deploy workflow, whose `deploy` job needs it green. It runs `npm ci`, then in order: check (`astro check`), build, a content hash of `dist/`, link crawl, Lighthouse (skipped on the scheduled rebuild, see below), smoke (the browser smoke run below), `npm run test:ci`, gate (the confidentiality gate), a second hash that must equal the first, and, outside pull requests, the upload of `dist/` as the `github-pages` artifact (`actions/upload-pages-artifact`). The build step is the only build in CI: `test:ci` runs the same suites as `npm test` without its `pretest` build, and under `CI` the Open Graph test fails on a stale or missing `dist/` instead of rebuilding. The hash covers every file in `dist/`, hidden ones included (`.well-known/`), which is what the Pages artifact archives because the upload sets `include-hidden-files: true`, so the site that ships is byte for byte the one the link crawl, Lighthouse, smoke run, tests and gate checked. Pull requests run every check and upload nothing. The daily scheduled rebuild skips only the Lighthouse budget and its report upload (#154); it still runs check, build, link crawl, smoke, tests and gate. Any new check goes after the build and before the second hash.

The gate (`scripts/gate.mjs`, ADR 0005) scans `dist/`, `src/` and `docs/` case-insensitively for patterns that must never ship. Patterns come from the repository secret `CONFIDENTIAL_PATTERNS`: one regular expression per line (case-insensitive, multiline: `^`/`$` match per line), blank lines and `#` comments ignored. Every file is scanned except known binary types and files containing a NUL byte. PDFs are the exception among binaries: each `.pdf` is read with `pdfjs-dist` (`scripts/pdf-text.mjs`, shared with the tests and loaded only when a PDF is found) and every pattern is tested against its text (per line, with whitespace collapsed so a phrase wrapped across lines or pages still matches, and with whitespace removed so letter-spaced words read whole), its metadata (every Info value and the raw XMP) and its link targets. A PDF that cannot be parsed fails the gate as `<file>: unreadable PDF`. The `#n` in the output counts patterns (non-empty, non-comment lines), not file lines. The printed path can itself reveal a name, so keep sensitive words out of filenames. Fork and Dependabot PRs receive no secret and so only get the warning. A missing `dist/` fails the gate: build first. On a hit it prints `<file>: pattern #<n>` and fails; it never prints the matched text. With no patterns it passes with a warning annotation, so the workflow works before the secret exists.

Locally, put the same patterns in `.confidential-patterns` at the repo root (gitignored, never commit it) and run `npm run build && npm run gate` before pushing. `CONFIDENTIAL_PATTERNS` in the environment takes precedence over the file; a blank or whitespace-only value falls back to the file. The tracked `.confidential-patterns.example` documents the format with invented tokens only. Start a local file from it without overwriting an existing one: `cp -n .confidential-patterns.example .confidential-patterns`. Each active pattern in the example hides one character in a class (`ab[c]def` matches `abcdef` but not its own source line), so the example never trips the gate on itself; `tests/gate.test.mjs` runs the file fallback, the env-precedence rule and the example itself in temp fixtures, never touching a local `.confidential-patterns`.

### Lighthouse budget

`npm run lhci` (`lhci autorun`, config in `lighthouserc.json`) serves `dist/` locally and audits `/`, `/cv/`, `/work/mts-hub/` and `/writing/why-i-rebuilt-pearse-dev/` three times each (median asserted) with the default mobile preset. Budgets, each an `error` that fails the PR: performance 0.9 or more, accessibility 1.0, best practices 0.95 or more, SEO 1.0, and cumulative layout shift 0.02 or less (`cumulative-layout-shift`, #153; the key is the bare audit id, since lhci splits keys on `:`). The URL list is hard-coded: bump the article URL when a new article is published. Lighthouse runs on pull requests, pushes to `master` and manual dispatches, but not on the daily scheduled rebuild (#154): that run publishes date-gated content rather than new code, and a score just under budget on one morning would block that day's article and the social posts that wait for it. The trade-off: a date-gated article that goes live on schedule was absent from the PR-time `dist/`, so Lighthouse never audited it, and the scheduled run does not audit newly published pages. That check stays with the PR that bumps the article URL; run the Check workflow by manual dispatch to audit a newly published page on demand. Run locally with `npm run build && npm run lhci` (set `CHROME_PATH` if Chrome is not found). Reports land in `.lighthouseci/` (gitignored); CI uploads them as the `lighthouse-report` artefact, kept 7 days, even on failure (`include-hidden-files` is needed because `.lighthouseci` is a dot-directory). Order in CI: check, build, hash, link crawl, Lighthouse (not on `schedule`), smoke, `npm run test:ci` (no rebuild), gate, hash verify, Pages upload.

### Browser smoke run

Every other check reads `dist/` as text. `npm run smoke` (`scripts/smoke/smoke.mjs`) drives the built site in headless Chrome through `playwright-core` (no browser download) and fails on what a visitor would see. It serves `dist/` with a small `node:http` server on `127.0.0.1`, visits every URL in `dist/sitemap-0.xml` plus every redirect page (any page with a meta refresh), and prints both counts. External requests never leave the machine: images get a 1x1 PNG, everything else is aborted. It runs sequentially in one browser:

- **Console:** on every sitemap URL, a console error, an uncaught page error, a failed same-origin request or a same-origin response of 400 or more fails. Console warnings fail too, except a short commented allowlist of software-WebGL noise (warnings only, never errors).
- **Transitions:** from `/`, each primary Nav link. A skipped cross-document view transition fails, and at least one hop must report `done` (the summary prints the count).
- **Redirects:** from `/`, an in-page navigation into each redirect page, then its target within 10 s. The page must be revealed with a view transition that finishes before the 1 s meta refresh leaves (#55, #79), with the console clean on both hops. Redirect pages are only ever named `redirect #n -> <target>`: no screenshot is taken on them, and their old paths are scrubbed from every message.
- **Overflow:** at 360 and 320 px, after `document.fonts` has loaded, no sitemap URL may scroll sideways. A failure names the path, the width and the widest offending element.
- **Hero:** `/?nogl`, `/?reduce` and `/`, each waiting on `data-hero-ready` (see Motion and degraded paths).

Run it locally with `npm run build && npm run smoke`. Chrome comes from `findChrome()` (`CHROME_PATH`, then `google-chrome`, `chromium` or `chromium-browser` on `PATH`); without one it fails and asks for `CHROME_PATH`. It launches with `--no-sandbox` and SwiftShader, so CI gets software WebGL. `npm run smoke:self` runs it against the fixture in `scripts/smoke/fixture/` (a page that throws, a 400 px element, a clean page) and checks that it fails for exactly those. Neither is part of `npm test`. On failure the run writes `.smoke/report.json` and screenshots (gitignored); CI uploads `.smoke/` as the `smoke-report` artefact, kept 7 days, only when the job fails. Every wait names its signal and has a timeout; there are no fixed sleeps.

### Security

- **Workflow rules.** `tests/workflow-policy.test.mjs` runs every file in `.github/workflows/` through the pure `check()` in `tests/lib/workflow-policy.mjs`, which fails on: no top-level `permissions:` block; `permissions: write-all` at workflow or job level; a job with `secrets: inherit`; an `actions/checkout` step without `with.persist-credentials: false`. Named write scopes (`pages: write`, `id-token: write`, `actions: write`) are allowed. Fixture cases in the same file prove each rule can fail.
- **Read-only default token.** The repository's default `GITHUB_TOKEN` is `read` and Actions may not create or approve pull requests, so a new workflow must declare every permission it needs. Read both settings back with `gh api repos/pearsedarcy/pearse.dev/actions/permissions/workflow` (expect `"default_workflow_permissions":"read"` and `"can_approve_pull_request_reviews":false`) and turn on private vulnerability reporting, then check it, with `gh api repos/pearsedarcy/pearse.dev/private-vulnerability-reporting` (expect `{"enabled":true}`). Both settings are changed with `gh api -X PUT` on the same paths and need admin.
- **Reporting.** `SECURITY.md` is the policy GitHub shows; `public/.well-known/security.txt` (RFC 9116) is served at `/.well-known/security.txt`. `tests/security-txt.test.mjs` checks `dist/` against `SITE.email`, `SITE.repo` and `SITE.url`, so a change to the site config fails until the static file is updated.
- **Renew `Expires` before it passes.** The test fails once `Expires` is in the past or more than 366 days out, and prints a `::warning::` annotation for the last 60 days. The test runs inside the check job the daily deploy needs, so after the date passes the check job fails and scheduled posts stop going live (ADR 0003). Land a PR that bumps `Expires` (about eleven months ahead) before then.

## Requirements

Node 22.23.4 or newer (`.nvmrc`). Astro 7 refuses older 22.x builds, including the 22.23.3 that GitHub-hosted runners cache under a bare `22`, which is why the workflow pins the patch version.

## Deploy

`.github/workflows/deploy.yml` runs on every push to `master`, on the daily schedule, and on manual dispatch. It has two jobs and builds nothing itself. `check` calls `check.yml`, which builds `dist/` once, checks it (including the confidentiality gate) and uploads it as the run's `github-pages` artifact. `deploy` needs `check` and publishes that artifact with `actions/deploy-pages`, so what goes live is the build that was gated. `deploy` runs only on `refs/heads/master`, because the `github-pages` environment accepts only `master`: a dispatch on another branch runs `check` and its upload, then skips `deploy`. The repository's Pages source must be set to **GitHub Actions**. `public/CNAME` keeps the custom domain; `site` is `https://pearse.dev` with no `base`. The build runs with `CI` set and devDependencies installed, so the CV PDF is printed there too (ubuntu-latest ships Chrome; without it the build fails).

`.github/workflows/keepalive.yml` runs weekly (and on manual dispatch) with `actions: write` only. It checks out and commits nothing; it calls the API to re-enable `deploy.yml` and itself, so GitHub's 60-day inactivity cutoff does not silence the daily rebuild. This depends on the enable call resetting the inactivity counter, which GitHub does not document. If it does not, a push to `master` at least every 60 days keeps the schedules alive regardless.

## Docs

- **Decisions:** [`docs/adr/`](docs/adr/) (0001 to 0006) and [`GLOSSARY.md`](GLOSSARY.md).
- **Agent entry point:** [`CLAUDE.md`](CLAUDE.md) (house rules for agents, linking to the docs above).
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md).
- **Profile copy:** [`docs/profile/linkedin.md`](docs/profile/linkedin.md) (LinkedIn headline, About, Experience, Featured, Skills, paste order) and [`docs/profile/bio.md`](docs/profile/bio.md) (50, 100 and 300-word speaker bios), derived from the case studies.

## Licence

Code is MIT (see `LICENSE`). Written content under `src/content/` is © Pearse D'Arcy.
