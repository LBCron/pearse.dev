# Changelog

Notable changes to the site and its publishing pipeline. Newest first. Dates are merge dates.

## Unreleased

### Added
- A root `CLAUDE.md` is the agent entry point: it links to README, GLOSSARY and the ADRs and states the Node pin, the test loop (`pretest` rebuilds `dist/`, `GITHUB_FETCH=0`), the local gate, the two-products naming rule, branch hygiene and the changelog habit. `tests/claude-md.test.mjs` checks it is tracked and not ignored, its links resolve, it names the key files and commands, it stays within 80 lines and it avoids the retired names. `OLD_NAME` and `OLD_NAMES` moved to `tests/lib/old-names.mjs`, shared with the products test (#141).
- The m-buildz.com and pauldarcy.ie case studies link to their running sites through the existing "Live" link. A test requires every granted client case study titled by a domain to set an https `live` URL on that host and to render it as a Live link (#107).
- `/cv/` offers its PDF as a real download: `scripts/cv-pdf.mjs` (`postbuild`, or `npm run cv:pdf`) prints the built page with headless Chrome from a throwaway loopback server to `dist/pearse-darcy-cv.pdf`, two A4 pages with links pointing at pearse.dev. "Download PDF" is a plain `download` link; the old button is now "Print" and the fallback. Without Chrome the link is removed from the built page (a warning locally, a failure under CI); a failed print always fails. The confidentiality gate now reads PDFs (text, metadata and link targets, with `pdfjs-dist` 6.4.299 as a pinned devDependency) and fails closed on one it cannot parse; the two-products test checks the PDF too (#113).
- Every case study closes with a contact block: private code offers a walkthrough call, a public repo is linked, and each has a mailto titled "About <project>". The helper lives in `src/lib/contact.ts` (#103).

### Changed
- The daily scheduled rebuild skips the Lighthouse budget and its report upload, so a score just under 0.9 on one morning cannot block a date-gated article or the social posts that wait for it. Pull requests, pushes to `master` and manual dispatches still run Lighthouse; check, build, link crawl, smoke, tests and gate still run on schedule. Trade-off, recorded in ADR 0003 and the README: the rebuild does not audit the performance of pages it newly publishes. `tests/ci-schedule.test.mjs` locks the step conditions (#154).
- The site that deploys is the exact build CI checked. The `check` job builds `dist/` once, hashes it, runs the link crawl, Lighthouse, smoke run, tests and gate against it, re-hashes it and fails if anything changed, then (outside pull requests) uploads it with `actions/upload-pages-artifact@v5`. The deploy workflow's `build` job and `withastro/action` are gone: `deploy` needs `check`, publishes that artifact with `actions/deploy-pages`, and runs only on `master`, so a branch dispatch skips it. CI runs the new `npm run test:ci` (the `test` command without the `pretest` build), and under `CI` the Open Graph test fails on a stale or missing `dist/` instead of rebuilding; local `npm test` is unchanged. One build and one GitHub fetch per deploy instead of three. `tests/ci-workflow.test.mjs` locks the pipeline in (#150).
- Headings and mono labels built as `<b>part</b> text` carry a real space after `</b>`, so textContent and the accessible name no longer run words together ("Writingabout this project", "01posts", "How it fits togetherCompany knowledge", the case-study and /work/ group numbers, the 404 and home "Fig." labels). The on-screen gap is still the flex `gap`; label geometry is unchanged at 390 and 1080 px. `tests/label-spacing.test.mjs` fails on any `<b>` in a heading or label followed directly by a letter or digit on any built page (#197).
- The freelance client track is ongoing: the home timeline row "Infrastructure and client work" and the East Coast Blinds and Dublin Plein Air periods read "Aug 2026 – Present", matching the CV's freelance entry and the East Coast Blinds body ("the swap itself is still ahead"). A test checks every page that dates the track (#189).
- Standalone links reach the 24px WCAG 2.5.8 target at 390px without moving any layout: the case-study GitHub/Live links and the home "All N projects", "All posts" and "All N repos" links are `inline-block py-2 -my-2` (33-38px), the CV contact links `inline-block py-0.5 -my-0.5` (26px, so neighbouring rows do not overlap). `tests/tap-targets.test.mjs` covers every case study, the home section links and the CV contacts (#190).
- The last under-24px links at 390px are layout-neutral targets too: the home timeline "Skatedownhills" link is `inline-block py-1 -my-1` (29px), the four `/cv/` project links `inline-block py-0.5 -my-0.5` (30px) and the footer "CV" link adds `px-1 -mx-1` (25px wide). Row and footer geometry measured unchanged; `tests/tap-targets.test.mjs` pins all three groups (#205).
- One verify-marker rule for every published kind: `src/lib/verify-marker.ts` walks every frontmatter string (except the standalone `note`) and the body of each non-draft article, approved standalone post and visible case study, with or without social copy, and the build fails naming the kind, the id and the field paths, never the text. It replaces the three field-by-field checks in `buildFeed`, whose inputs now require `body` and `data`. A test also fails on a marker in any built text file in `dist/`, skipping binaries by the confidentiality gate's rule, now shared from `scripts/binary-files.mjs` (#110).
- The base layout preloads the Inter variable woff2 that paints LCP (the lede paragraph, per Lighthouse) instead of the Archivo one, as a `?url` import so the preload and the inline `@font-face` share one hashed file. The hero comment no longer says the H1 is the LCP element. A test checks every layout page's preload against its `@font-face` (#112).
- `/social.json` lists a scheduled article as a stub of `kind`, `id`, `date` and `published: false`, with no title, URL, tags or copy until its date; the feed type now narrows on `published` (#111).
- The home-page GitHub avatar is served from pearse.dev: a committed, sharp-normalised 160x160 JPEG at `src/assets/github-avatar.jpg`, rendered by astro:assets `<Picture>` (AVIF, WebP, JPEG fallback). A live build refreshes the file only when the normalised bytes change and keeps it on any failure; the new avatar renders from the next build. No built page now loads a third-party origin, which a test enforces. `sharp` is now a direct dependency, pinned (#115).
- Ongoing MTS periods read "– Present" instead of a frozen "Oct 2026": the MTS Hub, wetlabs.app and agentic-workflow case studies and the two matching home timeline rows. Finished phases and the client case studies keep their end dates. The project schema rejects a "Present" period without a start year (#93).
- Home page GitHub cards are an allowlist: only public repositories owned by `pearsedarcy` and named on a featured or shown list appear, so a repository made public later never shows unreviewed. The site's own repository leads, then shown repositories by push day with list order on ties, capped at six; the committed snapshot is filtered the same way. The profile card shows last year's contributions instead of followers, with a note that most of the work is in private repositories. The build log names skipped repositories only outside CI (#109).
- East Coast Blinds cutover is told one way in the case study, the draft post and the LinkedIn doc: a same-server Apache vhost swap behind Cloudflare, with rollback a config change, described as planned rather than done; a test guards the wording (#106).

### Added
- East Coast Blinds is a full case study: a Notes body under "The website" and "The back office", told in its own sentences, and a cutover diagram where WordPress is reached only by a `rollback` edge. Dublin Plein Air gets a one-way shop-to-CRM sync diagram. Diagram edges gain a `rollback` style (steel, static, dash-dot; the build fails if it is also `flow` or has no label), and the diagram hostname check now catches `.ie` (#114).
- Browser smoke run (`npm run smoke`, in CI after Lighthouse): headless Chrome over `dist/` fails on console errors, skipped view transitions, redirect pages that leave before their incoming transition ends, sideways scroll at 360 and 320 px, and a hero that does not settle on `?nogl`, `?reduce` or the default path. The hero sets `data-hero-ready` once its mode is decided. Redirect pages now name their icon, so they no longer request a missing `/favicon.ico` (#119).
- The article guard also covers the title and description, and names the field it found the marker in. The Wagtail, FileMaker and agentic-workflow articles link to their case studies, and the case study page picks its related articles with the pure `relatedPosts` helper. A test fails on a `project:` that names no case study (#95).
- Build-time guard: the feed builder throws for a non-draft article, future-dated or not, with a `[VERIFY` marker in its body or social copy (#92).
- `docs/verify-answer-sheet.md`: the 22 open markers, one question each, ordered by publish date (#92).

### Fixed
- The CV PDF is 152 KB instead of 2.6 MB: the print stylesheet hides the fixed screen grain overlay, which Chrome rasterised as a page-sized RGB image plus alpha mask on every page. Text and layout are unchanged (same extracted text; page renders differ only by the removed speckle). Tests hold the PDF to a 500 KB budget with no raster images (#191).
- Home "Selected work" cards no longer overflow at 768-1080 px: each card is a size container and its title's font size is capped so the widest word fits (`src/lib/title-fit.ts`), so only long-word titles such as "wetlabs.app" shrink, and the text column can no longer grow past the card. The browser smoke run gains a `cards` check (every `a.card` page, 390-1440 px, element boxes and text runs against the card border) with a self-test fixture (#187).
- Primary nav no longer clips Contact at 320 px: the header row wraps, so the nav drops under the logo when they do not fit. Header and footer links, and the logo, are 32 px tall tap targets (WCAG 1.4.10, 2.5.8) (#105).

## 2026-11-01: bio and LinkedIn copy match the site

### Changed
- `docs/profile` tells the same history as the site: the 100- and 300-word bios and the LinkedIn About gain the downhill skateboarding arc and Skatedownhills (the bios stay exactly 100 and 300 words; the About is 2,121 characters), and say "two earlier tools" where they said three. The LinkedIn Experience mapping table is rewritten from the nine timeline rows, with the three pre-software rows marked "— (before software)". `/cv/` gains a first experience entry, Freelance Software Engineer, Self-employed, Aug 2026 – Present, with no location and no client named (#118).
- `tests/bio.test.mjs` checks the bio word counts, the LinkedIn character counts, the arc and "two earlier tools" in the copy, the timeline row count against the mapping table and sentence, the position count, and the `/cv/` experience and education periods, so the copy cannot drift from the site again (#118).

## 2026-11-01: hero frame cap, idle pause and touch fix

### Changed
- The home-page hero caps to 30 fps on phones and low-end devices, pauses after 20 s without input, and no longer sticks after a tap (#117).

## 2026-11-01: poster first on phones and low-data visits

### Changed
- The home page's two Three.js scenes load only for capable, motion-tolerant desktop visitors. Phone-width viewports, Save-Data, reduced motion, missing WebGL and the new `?lite` override keep the build-time SVG poster and never fetch three.js (about 131 KB gzipped). Reduced-motion and Save-Data visitors now get the poster, not a single rendered frame. One shared rule in `src/lib/scene-gate.ts` gates both the hero and the stack (#99).

## 2026-10-28: content model restructure

### Changed
- MTS is presented as two case studies, MTS Hub and wetlabs.app. Folded tools are feature sections, and the old `/work/<slug>/` URLs redirect (ADR 0006).
- The two anonymised client case studies are named: m-buildz.com (`/work/m-buildz/`) and pauldarcy.ie (`/work/pauldarcy-ie/`); the old slugs redirect (#89).
- Four client case studies are visible, named with written permission, and enter the social feed (#48).
- Posts, social copy and profile docs rewritten for the two-product framing (#50).
- Case study story renders before the in-depth sections; case studies are numbered by their place in the `/work/` grid (#65, #77).
- `/work/` header start year is computed from the earliest project period (#86).

### Added
- GitHub section on the home page: profile, contribution heatmap, recent repositories (#49).
- About, CV and Now carry the skating career, origin story and hobbies (#51).
- Skatedownhills case study and draft essay (#46).
- Documentation: ADR 0006 and the content model guide in the README.

### Fixed
- Accessibility: heading outline on `/writing/`, spacing in headings (#73, #74, #84).
- Phone width: case study heading and prev/next nav, heatmap labels (#66, #67).
- Redirect pages opt in to view transitions and wait one second before refreshing (#64, #85).

## 2026-10-24 to 2026-10-27: pipeline

### Added
- Astro 7 rebuild on GitHub Pages (#1).
- Confidentiality gate and check workflow (#25), client permission flag (#26), Lighthouse budget (#30).
- `/now/` (#29), `/cv/` with print stylesheet (#34), per-page Open Graph cards (#33), architecture diagrams (#37).
- Standalone social posts as a collection (#32), n8n scheduler with Telegram approval (#35), Bluesky and Mastodon cross-posting (#38).
- LinkedIn profile copy and bios under `docs/profile/` (#28).
