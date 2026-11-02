---
title: pauldarcy.ie
slug: pauldarcy-ie
oneLiner: pauldarcy.ie, an artist’s WordPress site and shop — audited, fixed on staging first, then cut over to a hardened, upgraded live site with a written runbook.
period: Aug – Sep 2026
role: Sole engineer
stack:
  - WordPress 7.1
  - WooCommerce
  - Apache
  - Cloudflare
  - wp-cli
  - Claude Code agents
featured: false
order: 16
features:
  - A full audit over SSH and HTTP by four agents working in parallel — security, WordPress, performance and SEO — that made no change to the server.
  - A staging environment where core, plugin and theme updates were validated before anything touched live.
  - Hardening, compression and caching headers, and SEO fixes including a broken sitemap, all verified on staging first.
  - A cutover runbook in which every step is reversible on its own and nothing starts without a fresh off-server backup.
  - The infrastructure notes, audit and runbooks kept in a private repository, so the next person starts from what is true rather than from memory.
hooks:
  - The brief assumed the shop was not live yet. The audit found it already was, which changed the order of everything after it.
  - Fifty-eight findings, nine of them top priority, from an audit that changed nothing on the server.
process:
  - step: audit
    proof: "A read-only audit over SSH and HTTP found fifty-eight findings, nine top priority, and is kept with the runbooks in a private repository."
  - step: staging
    proof: "Core, plugin and theme updates, then the hardening and SEO fixes, were validated on a staging copy before anything touched live."
  - step: gated
    proof: "Every step of the runbook is reversible on its own, and step zero is a fresh backup taken off the server before anything else runs."
  - step: cutover
    proof: "The cutover followed a written runbook of reversible steps; it is done, and the live site is on WordPress 7.1, hardened."
  - step: written-down
    proof: "The audit, the runbooks and the infrastructure notes live in a private repository, so the next change starts from what is true."
visibility: private
category: client
clientPermission: granted
live: https://pauldarcy.ie
social:
  date: 2027-02-10
  linkedin: |
    The brief said "make the checkout real". The audit found it already was.

    The client was an artist with a WordPress site and shop, pauldarcy.ie. Before changing anything, I ran a read-only audit over SSH and HTTP: four agents in parallel on security, WordPress, performance and SEO. Fifty-eight findings, nine top priority, zero changes to the server.

    That one finding reordered the plan. A live shop is a different job from a shop that's about to launch.

    So everything went through staging first: updates, hardening, compression, the SEO fixes. Then a cutover runbook where each step can be undone on its own and nothing starts without a fresh backup off the server.

    The live site is now on WordPress 7.1, hardened, with a working sitemap.

    https://pearse.dev/work/pauldarcy-ie/
  short: "The brief said \"make the checkout real\". The audit found it already was. pauldarcy.ie, a WordPress shop, audited read-only, fixed on staging, cut over with a reversible runbook. https://pearse.dev/work/pauldarcy-ie/"
---

pauldarcy.ie is an artist's website with a shop: WordPress, WooCommerce and a long list of plugins. The brief was to make the checkout real.

I started with an audit that changed nothing. Four agents worked in parallel over SSH and HTTP, one each on security, WordPress, performance and SEO, and came back with fifty-eight findings, nine of them top priority. The first finding turned the brief around: the shop was already live and had already taken payments. Making checkout real was the wrong goal; the work was making a live shop safe and dependable.

Everything after that went through a staging copy first. Core, plugin and theme updates were validated there with no fatal errors, then the hardening, compression, caching headers and SEO fixes. Only then did I write the cutover runbook: every step reversible on its own, and step zero a fresh backup taken off the server before anything else is allowed to run.

The cutover is done. The live site is on WordPress 7.1, hardened, and its sitemap works again. The audit, the runbooks and the infrastructure notes live in a private repository, so the next change starts from a written record of what is true.
