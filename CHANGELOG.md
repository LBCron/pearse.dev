# Changelog

Notable changes to the site and its publishing pipeline. Newest first. Dates are merge dates.

## Unreleased

### Changed
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
- Primary nav no longer clips Contact at 320 px: the header row wraps, so the nav drops under the logo when they do not fit. Header and footer links, and the logo, are 32 px tall tap targets (WCAG 1.4.10, 2.5.8) (#105).

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
