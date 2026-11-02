---
title: "One engineer, one platform: building an operations system of record with an agent team"
description: "How I built MTS Hub, a Django system of record for a wetlab-education company, as the sole engineer: 939 commits, 6000+ tests, 22 ADRs, and an agent team."
pubDate: 2026-11-03
tags: [django, agentic-engineering, architecture]
project: "mts-hub"
series: mts-hub
seriesOrder: 1
draft: false
social:
  linkedin: |
    One engineer. 939 commits. 6000+ tests. Four months.

    Since July I've been the only engineer on MTS Hub, the operations platform for the wetlab-education company I work for. Congresses, courses, contacts, bookings, packing, inventory, staffing, tickets, certificates, comms. One system of record.

    "Sole engineer" is true and slightly misleading. I worked with a team of Claude Code agents. They wrote a lot of the code. They did not decide what the system was.

    The parts I kept for myself:

    The domain model. Two older tools and a legacy CRM folded into one schema, checked by rebuilding a real congress end to end.

    The decisions. 22 architecture decision records, each one short. "No email sends without human approval." "Time bookings are an append-only ledger."

    The definition of done. The agents never got to call something finished on their own. The tests decided that.

    The tests are what made the speed safe. Without them, a fast agent team is just a fast way to make a mess.

    I wrote up what "system of record" meant in practice, the one modelling decision I'd defend hardest, and what I'd do differently:

    https://pearse.dev/writing/one-engineer-one-platform/
  short: "939 commits, 6000+ tests, one engineer and an agent team. What it took to build an operations system of record in Django, and what the agents didn't do. https://pearse.dev/writing/one-engineer-one-platform/"
---

A system of record is a promise that there is exactly one place where the truth lives, and most of the work of building one is refusing to break that promise.

Since July 2026 I have been the only engineer on MTS Hub, the operations platform for MTS – The Wetlab Company. It covers congresses, courses, contacts, faculty, bookings, packing, warehouse inventory, staff scheduling, tickets, certificates and communications. As of late October it stands at 939 commits on `main`, more than 6000 automated tests and 22 written architecture decision records.

I built it with a team of Claude Code agents. This post is about what that actually looked like.

## What "system of record" meant in practice

Before Hub, the company's operational knowledge lived in spreadsheets, a FileMaker system, two small internal tools I built, one for packing and fleet and one for event feedback reports, and a legacy CRM. Each one was fine on its own. Together they disagreed with each other about who a contact was and which course they had booked.

So "system of record" became a short list of rules:

- One contact, one course, one booking. Every other module points at those rows instead of copying them.
- Course planning goes rooms → stations → equipment, and packing lists are generated from templates per session, not typed in.
- History is kept, not overwritten, where money or hours are involved.
- Personal data has a known location, a known purpose and a working delete button.

That last rule turned into a module of its own: a PII inventory, erasure and anonymisation, and a human-approval gate before any email leaves the system. Erasure reaches further than I expected. Certificates have public verification pages, so erasing a person has to scrub their name while keeping the credential verifiable.

## The decision I'd defend hardest: an append-only time ledger

Staff log time and expenses. The obvious model is a `TimeEntry` row that people edit when they get it wrong. I rejected that.

Instead, time bookings are an append-only ledger. A correction is a new entry that offsets the old one. Rates come from dated statutory rate tables, so a booking from March is always priced with March's rates, even after the table changes.

The editable-row version is simpler to build and nicer to demo. It also makes "what did we think we owed this person last month?" unanswerable. For anything that ends up in payroll or an invoice, I'd rather pay the modelling cost up front. It is ADR 0018.

## What the agents did, and what they did not

The agents implemented issues. Each one worked in its own git worktree, ran ruff and the touched app's tests, and opened a pull request. A separate reviewer agent then tried to break the PR before anything merged. I'll cover that workflow in a later post.

What they did not do:

- **Choose the domain model.** I owned the glossary and the ADRs. Agents helped draft them, but every term and every decision in them was mine to accept or reject. Agents are very good at implementing a model and quietly bad at noticing when two modules have started meaning different things by the same word.
- **Decide when something was done.** The tests did. 6000+ of them is not a vanity number; it is the only reason I could merge agent-written code at this pace without reading every line twice.
- **Validate against reality.** The real check was reconstructing an actual congress end to end in Hub, from bookings to packing lists to certificates, and seeing where the model did not fit. It turned up things the schema had no place for, such as equipment that industry partners bring to a course and that must never count as our stock, and a stale course an earlier import had left with placeholder dates, which the rebuild would otherwise have duplicated.

## What went wrong

I let the pull requests get too big. Agents make large changes cheap to produce; one PR, on the video platform I also run, reached 92 files. Review of a PR that size does not converge: every round finds new problems, because there is simply too much surface. I now cap PRs at roughly 1.5k changed lines and ship bigger features as a stack of slices.

If I started again, I would set that cap on day one, before the first large feature, not after.

## The stack, for the curious

Python 3.12, Django 5.2 and DRF, django-unfold for the admin, Celery and Redis for background work, Django Channels for a live multi-user packing screen, PostgreSQL, Tailwind v4 with DaisyUI v5, HTMX and Alpine. Email goes through django-anymail, PDFs through ReportLab, and event tickets can be added to Apple Wallet. Docs are MkDocs Material. Tests are pytest. The interface is in German and English, and external participants log in with a magic link instead of a password.

None of it is exotic. That was deliberate: boring parts let the interesting work stay in the domain model.

One engineer can own a platform this size now. The trick is deciding which parts you never hand over.
