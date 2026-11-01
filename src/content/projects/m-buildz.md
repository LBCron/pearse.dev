---
title: m-buildz.com
slug: m-buildz
oneLiner: My first freelance job — m-buildz.com, a WooCommerce store for JDM and drift car parts in Ireland — and, two years on, the child theme, infrastructure-as-code and rehearsed catalogue scripts that keep it running.
period: Nov 2024 – 2026
role: Freelance, sole engineer
stack:
  - WordPress
  - WooCommerce
  - Blocksy child theme
  - PHP 8.3
  - MySQL 8
  - Redis
  - Apache
  - Cloudflare
  - Bash + Make
featured: false
order: 15
features:
  - A WooCommerce store for JDM and drift parts, trading since November 2024, with a product enquiry form as the sales channel for parts.
  - A child theme as the one part of the store that is real code, deployed from the repository.
  - Infrastructure-as-code for the rest — Apache vhosts and hardening, a system unit for WP-Cron, backup scripts and a guard plugin that keeps staging from emailing customers or charging cards.
  - A drift check that compares the repository against the live server file by file, because nothing else enforced that they matched.
  - Catalogue scripts for SKUs, descriptions, cars and taxonomy, each one dry-runnable and rehearsed on a staging copy of production before it touched the shop.
  - A full audit filed as issues by priority, phase and domain, so the backlog is something to work through rather than a list in someone's head.
hooks:
  - Every check has three exit codes — passed, failed, could not run — and "could not run" is never a pass.
  - When the CI minutes ran out, runs queued forever instead of failing. A four-second pre-push hook now runs the same lint locally.
visibility: private
category: client
clientPermission: granted
live: https://m-buildz.com
social:
  date: 2027-02-03
  linkedin: |
    My first freelance job was m-buildz.com, a WooCommerce store for JDM and drift car parts in Ireland.

    Two years later it's still mine to look after, and it taught me more about operations than the build did.

    A WordPress store's source of truth is its live database and wp-admin, so most of it can't go in git. What can: the child theme, the Apache config, the WP-Cron unit, the backup scripts, and a guard plugin that stops the staging copy emailing customers or charging cards.

    The catalogue changes are scripts, and every one has a dry run and a rehearsal on staging before it runs on the shop.

    Two rules I'd keep anywhere:

    Every check has three exit codes: passed, failed, could not run. "Could not run" is never a pass.

    Don't treat CI as the gate if it can silently stop running. When the minutes ran out, runs queued instead of failing and changes merged with nothing having checked them. A four-second pre-push hook fixed that.

    The case study:

    https://pearse.dev/work/m-buildz/
  short: "My first freelance job, the m-buildz.com WooCommerce store for JDM parts, two years on: child theme, infra in git, dry-run catalogue scripts, and checks where \"could not run\" is never a pass. https://pearse.dev/work/m-buildz/"
---

My first freelance job was m-buildz.com, a WooCommerce store for a small business selling JDM and drift car parts in Ireland. It went live in November 2024 and has been trading since. Parts are sold through an enquiry form as much as through the cart, so that form is the part of the site that matters most.

Two years on, the problem was no longer building a shop. It was changing a live one safely. A WordPress store's source of truth is its database and wp-admin, so the store itself does not belong in git. What does is everything around it: the child theme, which is the one piece of real code; the Apache vhosts and hardening; WP-Cron, moved off page views onto a system unit; the backup scripts; and a small plugin that keeps the staging copy from emailing customers or charging cards.

With those in the repository, a drift check compares them against the server file by file. When it reports drift, the server is what is running and the repository is what is wrong. Catalogue work — SKUs, descriptions, cars, taxonomy — is a set of scripts, each with a dry run, each rehearsed on staging before it runs on the shop.

The lesson I carry to every project: a check that cannot run must say so. Every check here exits 0 for passed, 1 for failed and 2 for could not run, and 2 is never treated as a pass. That rule came from the CI minutes running out and runs queueing forever instead of failing, which looked exactly like a slow run. The same lint now runs in a pre-push hook in about four seconds.
