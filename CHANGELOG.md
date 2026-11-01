# Changelog

Notable changes to the site and its publishing pipeline. Newest first. Dates are merge dates.

## Unreleased

### Changed
- East Coast Blinds cutover is told one way in the case study, the draft post and the LinkedIn doc: a same-server Apache vhost swap behind Cloudflare, with rollback a config change, described as planned rather than done; a test guards the wording (#106).

### Added
- Build-time guard: the feed builder throws for a non-draft article, future-dated or not, with a `[VERIFY` marker in its body or social copy (#92).
- `docs/verify-answer-sheet.md`: the 22 open markers, one question each, ordered by publish date (#92).

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
