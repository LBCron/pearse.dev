---
title: Why I rebuilt pearse.dev
description: The old site was a template from 2024 that said nothing about the work since. The new one is Astro, Tailwind v4 and Three.js, and it is built to be written to.
pubDate: 2026-10-24
updatedDate: 2026-11-01
tags: [career]
project: pearse-dev
draft: false
social:
  linkedin: |
    I rebuilt my personal site this week. The old one was a 2024 template with a photo of someone else's desk.

    The new pearse.dev is Astro, Tailwind v4 and a small Three.js hero. Static HTML, two content collections, one GitHub Actions deploy.

    The part I care about most is not the 3D. It is that the site now has a blog with a machine-readable feed, so writing goes out from one place instead of being pasted around.

    Short write-up on what changed and why: https://pearse.dev/writing/why-i-rebuilt-pearse-dev/
  short: "Rebuilt pearse.dev on Astro + Tailwind v4 + Three.js. Static, fast, and finally somewhere to write. https://pearse.dev/writing/why-i-rebuilt-pearse-dev/"
---

The old pearse.dev was a template I picked in 2024 because it looked fine and I needed a URL on a CV. It had a stock photo, a skills grid and a contact form that posted to a service I no longer use. It said nothing about the two years since: a video platform running at live congresses, an operations system of record with 6000 tests, an agent-driven workflow that builds most of my code under review.

So I replaced it. Here is what changed and why.

## Static, but with a build

The site is Astro. Everything is HTML at build time, served from GitHub Pages behind Cloudflare. There is no runtime, no framework island, no hydration. The two interactive pieces — the hero and a small 3D object in the About section — are plain `<script>` tags that Astro bundles and loads after first paint.

I chose Astro over writing the HTML by hand for one reason: content collections. Projects and posts are Markdown files with a typed schema. Adding a case study is a file. Adding a post is a file. The build fails if a field is missing. That is the whole content management system and it is enough.

*Update, November 2026: the site now has five typed collections (projects, posts, now, social and cv), not the two described here. The [pearse.dev case study](/work/pearse-dev/) has the current build.*

## Tailwind v4, configured in CSS

Tailwind v4 moved configuration into the stylesheet. The colours, type scale and shadows for this site live in one `@theme` block, and the components — card, button, label, marquee — are a hundred lines of CSS under them. I spent more time on the type scale than on anything else: Archivo in its expanded width for display, Inter for body, JetBrains Mono for labels. Three self-hosted font files, latin subset only.

## Three.js, kept small

The hero is a wireframe icosahedron with a displacement shader that follows the pointer, and a thin layer of points behind it. It is imported tree-shaken from `three`, capped at 1.5 device pixels, paused when it leaves the viewport or the tab is hidden, and it does not load until the browser is idle. If you prefer reduced motion, it renders one frame and stops. If WebGL is unavailable, there is an SVG poster in the same place. Both paths are real code and I tested both by forcing them.

The point of the 3D is not to show off Three.js. It is to have one memorable thing on the page and keep everything around it quiet.

## Writing, and a feed for the writing

The actual reason for the rebuild is the blog. I write things down in ADRs and handover documents all day and almost none of it leaves the repos. Now there is a `/writing/` section, an RSS feed, and a `/social.json` endpoint that lists every post with a ready-to-use LinkedIn version and a short version. An n8n workflow reads that file and schedules the posts. Publish once, in Markdown, and the rest follows.

## What I would still change

The Lighthouse numbers are good, but the hero script is still the heaviest thing on the page. If it ever gets in the way of the text, the text wins and the icosahedron goes.
