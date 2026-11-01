---
title: East Coast Blinds
slug: east-coast-blinds
oneLiner: WordPress to Django + Wagtail rebuild for an Irish blinds installer, with quoting, invoicing, procurement, jobs and a CRM behind the public site.
period: Aug – Oct 2026
role: Sole engineer
stack:
  - Django 5.2 LTS
  - Wagtail 8
  - Celery
  - WeasyPrint
  - Web Push
  - Tailwind v4 + DaisyUI
  - Cloudflare
  - Hetzner
featured: true
order: 5
features:
  - Public site rebuilt in Wagtail with the existing content migrated and WordPress kept on disk, untouched, as the rollback.
  - Quoting and invoicing with PDF output via WeasyPrint.
  - Procurement, jobs and CRM apps so that the website and the back office share one database.
  - Push notifications for job updates; Celery for the slow work.
hooks:
  - Cutover is a vhost swap on the same server, behind Cloudflare, with WordPress still on disk — rollback will be one config change.
  - Firewall and backup runbooks were written before cutover, not after the first incident.
visibility: private
category: client
clientPermission: granted
social:
  date: 2027-02-17
  linkedin: |
    The brief was a faster website. The actual need was one system that knows about a quote, the job it became and the invoice it ends in.

    East Coast Blinds is an Irish blinds installer. They had a WordPress site and a paper-heavy back office. I rebuilt both in Django and Wagtail: the public site, plus quoting and invoicing with PDF output, procurement, jobs and a small CRM, all on one database.

    The part I'd reuse on any WordPress migration is the cutover plan. WordPress stays live and untouched on the same server through the whole build. The new stack runs beside it in Docker, behind Cloudflare. Cutover is a swap of the Apache vhost, from WordPress to a reverse proxy in front of Django, and rollback will be putting the WordPress vhost back. A proxy you control makes cutover and rollback the same size of change.

    The firewall and backup runbooks were written before cutover, not after the first incident.

    https://pearse.dev/work/east-coast-blinds/
  short: "A blinds installer's WordPress site rebuilt in Django and Wagtail, with quoting, invoicing, jobs and a CRM on one database. WordPress stays on disk on the same server: cutover is a vhost swap and rollback will be one config change. https://pearse.dev/work/east-coast-blinds/"
---

A small business with a WordPress site and a paper-heavy back office. The brief was a faster website; the actual need was one system that knows about a quote, the job it became and the invoice it ends in.

I kept WordPress alive through the whole build. The new stack runs in Docker on the same server, behind Cloudflare. Cutover is a swap of the live Apache vhost, from WordPress to a reverse proxy in front of Django. WordPress stays on disk, untouched, so rollback will be putting its vhost back and reloading Apache: a proxy I control makes cutover and rollback the same size of change. The production cutover is still to come.
