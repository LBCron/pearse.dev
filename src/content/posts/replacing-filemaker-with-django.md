---
title: "Replacing FileMaker with Django for an art festival"
description: "Modelling a festival's people and registrations in Django: one-way WooCommerce sync, scannable passes, check-in, public voting and email campaigns."
pubDate: 2026-12-08
tags: [django, data-modelling, woocommerce, migration]
project: dublin-plein-air
# draft until client permission (#7)
draft: true
social:
  linkedin: |
    The most important arrow in my latest project points one way only.

    I'm replacing a FileMaker CRM for an art festival with Django. Artists register and pay through the festival's WooCommerce shop. That shop isn't going anywhere, and it shouldn't.

    So the sync is one-way. WooCommerce is the source of truth for orders. Django reads them and turns them into people, registrations and passes. Django never writes an order back.

    The alternative was two-way sync, so staff could fix an order from either side. I said no. Two-way sync between two systems that both think they own an order is how you get a registration that exists in one place and not the other, on the morning of the event.

    What Django adds on top:

    Scannable passes, sent by email.
    Check-in at the desk by scanning the pass.
    Badges.
    Public voting.
    Email campaigns through Brevo, with web push.

    The modelling question that matters most isn't technical. It was: what is a "person" at a festival? An artist who has painted at five festivals is one person with five registrations, not five contacts. Get that wrong and every count, badge and email is wrong after it.

    Full write-up on the model, the sync and what I'd change:

    https://pearse.dev/writing/replacing-filemaker-with-django/
  short: "Replacing a festival's FileMaker CRM with Django: one-way WooCommerce sync, scannable passes, check-in, voting, campaigns. And what a 'person' is. https://pearse.dev/writing/replacing-filemaker-with-django/"
---

When you replace a legacy system, decide first which system owns each fact, because every bug that follows comes from two systems believing they own the same one.

In October 2026 I started replacing the FileMaker CRM of an art festival [VERIFY: client permission to describe, even anonymised] with a Django application. The festival sells registrations through a WooCommerce shop, runs on-site check-in, prints badges, runs public voting and emails its artists and visitors. FileMaker held the people: contacts, attendance and award history, message templates and the workshop roster. It knew nothing about the shop, so every order was re-keyed by hand, and there was no scannable ticket, no check-in, and the daily vote ran through a paid third-party service.

The project is new, so this is a post about modelling and design decisions more than about running it at scale.

## Who owns what

The first page of the design was a table: each fact, and the one system that owns it.

- **Orders and payments:** WooCommerce. It already takes the money; it keeps doing that.
- **People, registrations, passes, check-ins, votes, campaigns:** Django.
- **Email delivery:** Brevo.

Everything else follows from that table.

## The decision: one-way sync from WooCommerce

Django pulls orders from WooCommerce and turns them into people and registrations. It never writes an order, a payment or a refund back.

The alternative was two-way sync, so festival staff could correct an order in whichever system they had open. It is a reasonable request and I turned it down. Two-way sync between two systems that each think they own an order needs conflict rules, and conflict rules are where the morning-of-the-event bugs live: a registration that was changed on both sides and now exists in two shapes.

With one-way sync the rule is short. If an order is wrong, fix it in WooCommerce; Django will pick it up on the next sync. Django-only data, such as check-ins and votes, never has to be reconciled with anything. Orders arrive by webhook, and a periodic pull over the REST API catches anything a webhook missed. Both are idempotent on the order ID and its modified time, so a replay never duplicates anything.

## Modelling a festival's people

The hard modelling question was not technical: what is a person?

A festival sees the same human in several roles and over many years. An artist paints one year and tutors a workshop the next. A volunteer is also an exhibiting artist. And the same artist usually exists twice before any code runs: once in FileMaker, typed in by hand, and once in the shop's order history, typed in by themselves.

The Django model separates the human from what they did:

- **Contact:** one row per real person, merged across FileMaker and WooCommerce by email. Where the two disagree, the shop's details win, because the person typed them more recently.
- **Registration:** a contact's entry into one year's festival, at most one per contact per festival, linked to the WooCommerce order that created it.
- **Pass:** one per registration, what they carry on the day, with a scannable code.
- **Check-in:** recorded when a pass is scanned at the desk.
- **Vote:** an anonymous choice of an artist's number in a public contest, with no voter identity at all.

Counting "how many artists do we have?" is then a question about distinct people, not rows, and a badge or campaign email goes to a person once.

## Passes, check-in, voting, campaigns

Passes are generated per registration and emailed out. At the desk, scanning a pass records a check-in. Badges are printed in a batch as a PDF before day one, and each carries the pass's QR code, so the badge itself scans. Public voting moves into Django too, and builds on a WordPress voting plugin I wrote for the same kind of event earlier in the year. One thing changed on the way: the plugin asked voters for an email, and the new vote asks for nothing. Duplicates are limited by session and device instead. A determined person can still vote twice; for a community painting prize, that is a fair trade against collecting identities.

Campaigns go out through Brevo, and pywebpush handles browser push for people who opt in. The admin is django-unfold, background work is Celery, and deploys run GitHub Actions → GHCR → SSH to the host.

## What I would do differently

I started from the FileMaker export's columns and mapped them to models. That carried over some of FileMaker's assumptions, including the record-per-role habit, longer than it should have. Next time I would write the "who owns what" table and the person/registration split first, and only then open the export. [VERIFY: confirm this happened, or replace with the real lesson]

Most legacy migrations are ownership problems wearing a data-format costume. Settle ownership and the code gets small.
