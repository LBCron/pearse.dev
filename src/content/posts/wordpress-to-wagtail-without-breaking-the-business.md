---
title: "WordPress to Wagtail without breaking the business"
description: "Audit the live WordPress, build Django and Wagtail alongside it, then swap the live vhost behind Cloudflare with WordPress kept warm as the rollback."
pubDate: 2026-12-01
tags: [django, migration]
project: east-coast-blinds
# draft until client permission (#7)
draft: true
social:
  linkedin: |
    The safest way I know to migrate off WordPress keeps WordPress running the whole time.

    The client is a small Irish blinds installer. Their website was WordPress. Their actual business needed more than a website: quotes, invoices, suppliers, jobs, customers.

    So the job was never "rebuild the website". It was: give them a Django system for the business, with a Wagtail site in front, and switch over without a day where the phone stops ringing.

    How it's set up:

    1. Audit the live WordPress first. Every page, form, redirect and plugin that does something someone relies on.

    2. Build Django 5.2 LTS + Wagtail alongside it, on the same server. Quoting with PDF quotes, invoicing, procurement, jobs, a small CRM.

    3. Both sites sit behind Cloudflare. Cutover is swapping the web-server config, not a DNS change you wait on.

    4. WordPress stays on disk, untouched, as the rollback. Going back is one config change, not a restore.

    The rejected option was a big-bang switch with WordPress archived. Less to run in parallel. Much more to lose if a form or a redirect you forgot about turns out to be where the leads came from.

    The write-up covers the audit checklist, the cutover and what I'd do differently:

    https://pearse.dev/writing/wordpress-to-wagtail-without-breaking-the-business/
  short: "Moving a small business from WordPress to Django + Wagtail with WordPress kept warm as the rollback: audit first, build alongside, swap the vhost behind Cloudflare. https://pearse.dev/writing/wordpress-to-wagtail-without-breaking-the-business/"
---

A migration off WordPress is safe when going back is a single, boring change that you never have to make.

This autumn I rebuilt the website of a small Irish blinds installer [VERIFY: client permission to describe the project, even anonymised] in Django 5.2 LTS and Wagtail 8. Over about 96 commits between August and October 2026, it grew into more than a website: quoting with PDF quotes, invoicing, procurement, job tracking and a small CRM, with the public site as the front door.

The interesting part was not the build. It was switching a business that takes enquiries every day from one system to another without a gap.

## Audit before you build

Before writing a model, I audited the live WordPress site. The same checklist I now use for any WordPress job:

- **Every URL that gets traffic.** Old blog posts, product pages, landing pages from past campaigns. Each gets a redirect, kept in Wagtail's redirects app, or a deliberate decision to let it go.
- **Every form, and where its submissions actually go.** This is where leads are lost in migrations.
- **Every plugin that does something a person relies on.** Not the plugin list, the behaviour: "sends the quote request to the owner's phone", not "Contact Form X".
- **Performance, SEO and security baselines,** so the new site can be shown to be better, not just different.

Most of that list is invisible in the WordPress admin. You find it by reading the site from the outside and asking the owner what they would miss.

## Build alongside, not instead

The new stack runs in Docker on the same Hetzner server as WordPress, behind Cloudflare. Django handles the business apps; Wagtail handles the pages the owner edits. Quote PDFs are rendered with WeasyPrint, background work runs on Celery, the UI is Tailwind 4 with DaisyUI, and staff get Web Push notifications for new enquiries, quotes, jobs and invoices.

Building alongside meant the business apps could be used for real before the public site moved. [VERIFY: did the owner start quoting in the new system before cutover?]

## The decision: swap the vhost, keep WordPress warm

WordPress keeps its files, its database and its web-server config, untouched. Cutover is swapping the live Apache vhost from WordPress to a reverse proxy in front of Django. Rollback is copying the WordPress vhost back and reloading Apache.

The alternative I rejected was the usual big-bang: change DNS, archive WordPress, deal with anything that comes up. It is less to run in parallel and it feels cleaner. It also turns every forgotten form or redirect into a live incident, with the old system no longer there to fall back on.

Keeping WordPress on disk, unchanged and untouched, for at least a few weeks after cutover costs almost nothing, because it shares the server. In exchange, the worst case at cutover is a minute of embarrassment instead of a lost week of enquiries.

The cutover itself is a short, written runbook: ship the image, load the content, review it on a password-protected staging subdomain, swap the live vhost, verify from the public internet (every page, the contact form, the sitemap, TLS), purge the Cloudflare cache, then watch the inbox for the first real enquiry. Firewall and backup runbooks were written before cutover, not after.

## What went wrong

My first runbook did not work. I rehearsed it end to end on my own machine, against the real production compose file, a real Postgres and the real content dump, and it failed in five places. The server had no Node, so the stylesheet could not be built and every page would have returned a 500; Tailwind now builds inside the Docker image. Worse, because it would have looked fine: the content dump restored Wagtail's site record as localhost, so the sitemap would have advertised localhost URLs to Google. And the contact form, the site's only conversion event, could not send until the mail credentials were in place, so the switch waited on that.

What I would do differently regardless: write the URL inventory as a test, not a spreadsheet. A test that requests every old URL against the new site and asserts a 200 or a redirect would have been cheaper than checking by hand.

## Patterns for any WordPress to Django move

- Audit behaviour, not plugins.
- Build alongside, without touching the old site.
- Put a proxy you control in front of both, so cutover and rollback are the same size of change.
- Keep the old system untouched until the new one has survived real traffic.
- Verify from outside, the way a customer would arrive.

The owner shouldn't notice the day you switch. The only sign should be that the quotes go out faster afterwards.
