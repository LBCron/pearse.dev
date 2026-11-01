# CLAUDE.md

Agent entry point for pearse.dev: an Astro static site and its publishing pipeline. This file links to the docs instead of repeating them. Where it disagrees with them, they win.

## Where the truth lives

- [`README.md`](README.md): stack, commands, content model, checks, deploy.
- [`GLOSSARY.md`](GLOSSARY.md): the names for everything on the site.
- [`docs/adr/`](docs/adr/): decisions 0001 to 0006.

## Node

Use the version in `.nvmrc` (22.23.4 or newer, also enforced by `engines`). Why the patch version is pinned: README [Requirements](README.md#requirements).

## Test loop

- `npm test` runs `pretest`, which rebuilds `dist/`. The suites read `dist/`, not the sources.
- To run one suite file alone, run `npm run build` first.
- `GITHUB_FETCH=0` makes the build use the GitHub snapshot: offline and reproducible builds.
- Every behaviour you add gets a test in `tests/*.test.mjs`.

## Local gate

Run `npm run build && npm run gate` before pushing. The gate reads `CONFIDENTIAL_PATTERNS` or the untracked, gitignored `.confidential-patterns`. A "NO PATTERNS CONFIGURED" warning means nothing was checked. The denylist is kept outside the repo ([ADR 0005](docs/adr/0005-confidentiality-denylist-outside-the-repo.md)); this file does not say where. Never commit it, and never publish hostnames, credentials, customer or client names, or prices.

## Naming and products

- MTS is exactly two products, MTS Hub and wetlabs.app ([ADR 0006](docs/adr/0006-mts-is-two-products-and-client-work-is-gated.md)). Never use the retired product name or the folded tool names.
- Names follow [`GLOSSARY.md`](GLOSSARY.md).
- A folded MTS tool becomes a `sections` entry on one of the two products, not a project. See README "Content model".

## Static site and social

- Static site only, on GitHub Pages: [ADR 0001](docs/adr/0001-static-astro-site-on-github-pages.md).
- Social copy lives in the article's frontmatter: [ADR 0002](docs/adr/0002-social-copy-lives-with-the-article.md).
- Publish by date, with a daily rebuild: [ADR 0003](docs/adr/0003-publish-by-date-with-a-daily-rebuild.md).
- A human approves every social post: [ADR 0004](docs/adr/0004-human-approval-before-any-social-post.md).

## Branch hygiene

- The default branch is `master`. Branch from it and open pull requests against it.
- After any rebase onto `master`, run `npm test` again: suites encode counts and order that other merges change.
- Stage explicit paths, not `git add -A`. Commits use the conventional style (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## CHANGELOG

Every user-visible or pipeline change adds a line under `## Unreleased` in [`CHANGELOG.md`](CHANGELOG.md).
