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
diagram: EastCoastBlinds
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
A small business with a WordPress site and a back office that ran largely on paper. They asked for a faster website. What the business needed was one system that follows an enquiry into a quote, the quote into a job, and the job into an invoice.

## The website

The site takes enquiries every day, so it could not go dark while its replacement was being built. Before writing a model I audited the live WordPress from the outside, the way a customer arrives. Every URL that gets traffic has a redirect in Wagtail or a deliberate decision to let it go. Every form was traced to wherever its submissions actually land, because that is where migrations lose leads. Plugins were listed by what they do for a person rather than by name, and performance, SEO and security were measured first, so the new site can be shown to be better and not just different.

The new public site is Wagtail, with the existing content migrated across. It runs in Docker on the same server as WordPress, behind Cloudflare, and WordPress itself has not been touched. Cutover is planned as one edit to Apache: the live vhost stops serving WordPress and becomes a reverse proxy in front of Django. Going back is that edit in reverse, with the old vhost restored and Apache reloaded, while WordPress stays warm on disk. When both directions cost the same, rolling back is cheap enough that nobody hesitates to do it. The swap itself is still ahead; everything up to it is in place.

The firewall and backup runbooks were written first, ahead of any traffic moving. The cutover runbook ends outside the server: every page, the contact form, the sitemap and TLS checked from the public internet, then the Cloudflare cache purged.

## The back office

The website is the front door, and most of the work sits behind it. Quoting produces PDF quotes through WeasyPrint. An accepted quote becomes a job, and a finished job ends in an invoice. Procurement handles what has to be ordered from suppliers, and a small CRM keeps each customer's history next to their quotes and jobs.

The public pages and the business apps share one database, so an enquiry from the site and the quote that answers it are never copied between tools. Slow work runs on Celery, and staff get push notifications when a job changes.
