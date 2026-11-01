---
title: pearse.dev
slug: pearse-dev
oneLiner: This site. A static Astro build with typed content, publish-by-date, a confidentiality gate in CI and a social scheduler that posts nothing without a human's approval.
period: Oct 2026 – Present
role: Sole engineer
stack:
  - Astro 7
  - Tailwind v4
  - Three.js
  - GitHub Actions
  - GitHub Pages
  - Cloudflare
  - n8n
  - Telegram Bot API
featured: false
order: 18
diagram: PearseDev
features:
  - Five typed content collections (projects, posts, now, social, cv). A missing or malformed field fails the build.
  - Articles publish on their date. Drafts and future-dated posts stay out of the build, and a daily rebuild puts them live without a commit.
  - A confidentiality gate checks the built site against a denylist kept outside the repository before anything deploys.
  - An Open Graph card rendered at build time for every article and case study.
  - Social copy lives with the article. Self-hosted n8n reads the site's social feed and posts only what was approved on Telegram.
  - The tests read the built dist/, and the deploy runs the full check job before GitHub Pages gets a byte.
hooks:
  - The only substantial codebase on this site that you can open. Every claim here can be checked against it.
  - Six ADRs record why a personal site is built the way it is.
repo: https://github.com/pearsedarcy/pearse.dev
visibility: public
category: tool
---
Every MTS repository is private, so this site's repository is the one piece of my work a reviewer can actually read. It is a small codebase with the same habits as the big ones: decisions written down as ADRs, content as typed data, and a CI job that has to pass before anything ships. The six ADRs are in `docs/adr/`.

## Content as typed data

There is no CMS. Content is Markdown in five collections: projects, posts, now, social and cv. Each one has a schema in `src/content.config.ts`. A missing field, a malformed date or a diagram name that does not exist fails the build, so a broken page never reaches the deploy step. Adding a case study is a file and a pull request (ADR 0001).

## Publishing on a date

An article is published when it is not a draft and its publication date has passed at build time. Drafts and future-dated posts are left out of the build: no page, no card, no RSS entry. The social feed does list a scheduled post ahead of time, flagged as not yet published, and the scheduler refuses anything with that flag, so it never links to a page that does not exist yet. A scheduled workflow rebuilds and redeploys the site every morning at 06:00 UTC, so a post goes live on its date without a commit (ADR 0003). GitHub disables scheduled workflows on quiet repositories, so a second workflow re-enables the deploy every week.

## The confidentiality gate

I write about client and employer work here, sometimes with agents drafting. The repository is public, so the list of things that must never appear on the site cannot live in it: the list would be the leak. It sits outside the repository and reaches CI as a secret. The gate is the last step of the check job. It scans the built site and the source against that list and fails the build on any hit, reporting the file and the pattern number but never the matching text (ADR 0005). It runs before the deploy, not after.

## Cards and the social feed

At build time, headless Chrome renders a 1200×630 Open Graph card for each published article and case study, in the default card's type and colours. The home page, the index pages and the 404 page keep the default image.

Social copy lives in the article's frontmatter, next to the text it promotes, so it is reviewed in the same pull request (ADR 0002). The build emits it as a machine-readable feed. A self-hosted n8n workflow reads that feed and offers each due post on Telegram with approve and skip buttons. Only approved copy is posted, once, to LinkedIn, and to Bluesky and Mastodon when those are configured (ADR 0004). Nothing goes out under my name that I have not tapped approve on.

## Tested from the built output

The test suite reads `dist/`, not the source, so it checks the HTML a visitor gets. `npm test` builds first. The deploy workflow calls the same check job that runs on every pull request: type check, build, link crawl, Lighthouse budget, browser smoke tests, the test suite and the confidentiality gate. GitHub Pages deploys only after all of them pass.

## Colophon

Astro 7 and Tailwind v4, with a small Three.js hero that renders one frame and stops for reduced motion. Archivo, Inter and JetBrains Mono, self-hosted. Static HTML on GitHub Pages behind Cloudflare: no server, no database, no login to protect. Agents built most of it, under review, with the harness described in the [agentic engineering workflow](/work/agentic-workflow/) case study.
