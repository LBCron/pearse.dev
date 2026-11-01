---
status: accepted
date: 2026-10-24
---

# Confidential material is gated in CI with a denylist kept outside the repository

Content about MTS work must not name customers, congresses, infrastructure addresses, credentials or business figures. The repository is public, so the list of forbidden strings cannot live in it: the list would itself be the leak. The check runs in CI against the built site, reading its patterns from a repository secret, and fails the build on any hit. We rejected a committed denylist for that reason, and rejected "just be careful" because ghost-written content from multiple agents has already needed this filter once.

## Exception: legacy redirect stubs keep their old paths (2026-11-01, #199)

The built site contains eight static redirect stubs under `/work/`, one per entry of `MOVED_CASE_STUDIES` in `astro.config.mjs` (ADR 0006). Each is a noindex meta-refresh page whose text never repeats its old path, but the old path itself is a public URL and cannot be hidden. Three groups of them put a name in that path that the site no longer uses:

- `/work/ophthix/` carries the **retired product name**. It redirects to `/work/wetlabs-app/`.
- `/work/wetpack/`, `/work/opthalyze/`, `/work/mts-atlas/` and `/work/mts-cortex/` carry the names of **private sub-projects** that are now feature sections of MTS Hub. They redirect to anchors on `/work/mts-hub/`.
- `/work/infrastructure-observability/` (to an anchor on `/work/wetlabs-app/`) `/work/jdm-parts-webshop/` and `/work/artist-wordpress-site/` (client case studies renamed once permission was granted, to `/work/m-buildz/` and `/work/pauldarcy-ie/`) carry no retired name; they are listed only so the whole set is on record.

Decision: **keep all eight stubs.** These URLs were indexed or shared before the rename, and the stubs are the only thing that keeps those links working; dropping them would turn each into a 404. The names are already visible to anyone holding an old link, so the stubs add no new disclosure. We rejected deleting the retired-name stub alone: the two-products rule (ADR 0006) already settled that old URLs stay alive, and one missing redirect would be a silent exception to it.

The exception is exactly this and no wider:

- The old name may appear in `dist/` only as the path of `/work/ophthix/index.html`. `tests/mts-products.test.mjs` fails on any other file name or file content that carries it.
- A stub's page text, title, canonical, sitemap entry and social feed never repeat the old path.
- A new stub means a new line here. The same test file fails if a `MOVED_CASE_STUDIES` slug is missing from this ADR.
