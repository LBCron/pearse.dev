---
title: Dublin Plein Air
slug: dublin-plein-air
oneLiner: An art festival's WordPress site audited, hardened and upgraded, then a Django CRM to replace its FileMaker database — WooCommerce sync, scannable passes, check-in, badges, public voting and campaigns.
period: Aug 2026 – Present
role: Sole engineer
stack:
  - WordPress
  - WooCommerce
  - Apache
  - Cloudflare
  - Django 5
  - PostgreSQL 16
  - Celery
  - django-unfold
  - HTMX + Alpine.js
  - Brevo
  - pywebpush
  - GitHub Actions → GHCR
featured: true
order: 6
diagram: DublinPleinAir
features:
  - A read-only external audit of the live site across seven areas — security, privacy, WordPress and WooCommerce, performance, accessibility, SEO and content — with every finding re-checked by a second pass before it was filed.
  - The server's hardening config and the security headers brought into the repository, byte for byte what runs on the box, so a change is a diff rather than a memory.
  - A staging clone with no public DNS, payment credentials scrubbed and a guard plugin that stops it emailing or charging anyone.
  - The upgrade planned as twenty gated steps, each with its own preflight and rollback, after a fresh backup verified off the server.
  - A Django CRM that syncs registrations one way from the WooCommerce shop, so the shop stays the source of payment truth.
  - Scannable passes, on-site check-in from a phone, badge generation, public voting and email campaigns with GDPR-aware consent.
hooks:
  - An adversarial review of the upgrade plan found seven defects in its own rollback paths before a single step ran.
  - "`cmd && echo OK` cannot fail a script under `set -e`. Running step zero found that; every preflight block was fixed before step one."
  - The CRM replaces a FileMaker database that only one person could operate.
visibility: private
category: client
clientPermission: granted
live: https://dublinpleinair.ie
social:
  date: 2027-01-27
  linkedin: |
    An art festival had a WordPress shop that takes real money and a CRM that lived in one FileMaker file.

    I took on both, in that order.

    The website came first. A read-only audit from the outside, across security, privacy, performance, accessibility and SEO, with every finding checked twice before it was filed. Then the server's hardening config went into git, byte for byte what runs on the box. Then a staging clone that can't email or charge anyone.

    The upgrade is twenty gated steps, each with its own rollback. An adversarial review of that plan found seven defects in the rollback paths themselves. Running step zero found one more: `cmd && echo OK` can't fail a script under set -e.

    Then the CRM. A Django app that pulls registrations one way from the shop, issues scannable passes, runs check-in, badges and public voting, and sends the campaigns. The modelling question was who a person is to the festival. An artist can also buy a ticket; a volunteer can also vote. One Person with roles per edition.

    The case study:

    https://pearse.dev/work/dublin-plein-air/
  short: "An art festival's WordPress shop audited, hardened and upgraded in gated steps, then a Django CRM to replace a FileMaker file: shop sync, passes, check-in, voting. https://pearse.dev/work/dublin-plein-air/"
---

A plein air festival has artists, visitors, volunteers, daily contests and one festival week to get it all right. Its public face is a WordPress site with a shop that takes registrations and payments. Behind it, the people and their registrations lived in a FileMaker file that one person knew how to drive.

## The website

The site worked, and it was taking money, so the first rule was not to break it. I started from the outside with a read-only audit: no server access, only requests anyone could make, each one labelled so the whole session could be filtered out of the logs. Every finding went through a second, adversarial pass, and the ones that turned out fine on measurement were written down as fine rather than dropped.

The fixes followed the same habit. The server's hardening config had partly lived only on the box; it is now in the repository, and the repository copy is the one that matches the server. Updates are rehearsed on a staging clone with no public DNS, scrubbed payment credentials and a guard plugin, before they touch live. The upgrade itself is a sequence of gated steps, each with a preflight check and a rollback, starting from a fresh backup verified off the server.

The step I would point to is the review of that plan. Three adversarial passes over it found seven defects in its rollback paths: the parts nobody reads until the night they are needed. They were fixed inside the steps, not in a footnote.

## The CRM

The second chapter replaces the FileMaker file. It is a Django app that pulls registrations one way from the shop, issues scannable passes, runs check-in from a phone, generates badges, runs the public vote and sends the campaigns. The shop stays the source of payment truth; the CRM never writes an order back.

The modelling question was who a person is to the festival. An artist can also buy a ticket, a volunteer can also vote. The answer was a single Person with roles per edition, which is the same shape I had already arrived at in MTS Hub. It builds on an earlier WordPress voting plugin for the same festival, with the same anonymous-artist rules, now with a real data model behind them.
