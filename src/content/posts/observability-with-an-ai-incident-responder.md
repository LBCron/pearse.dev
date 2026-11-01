---
title: "Observability for small teams, with an AI incident responder"
description: "OpenObserve, Grafana Alloy, OpenTelemetry and GlitchTip on one EU VM, synthetic checks, and an AI agent that triages alerts before I read them."
pubDate: 2026-11-24
tags: [self-hosted-ai]
project: "wetlabs-app"
draft: true
social:
  linkedin: |
    The most useful test in my monitoring repo checks that every alert rule can actually fire.

    An alert that can't fire looks exactly like a quiet system. You find out it was broken on the day you needed it.

    Over about a month I built the observability stack behind both products I run, two production Django apps, as the only person on ops. All of it self-hosted in the EU:

    OpenObserve for logs, metrics and traces in one place.
    Grafana Alloy and OpenTelemetry to collect them, with distributed tracing in both apps.
    GlitchTip for error tracking.
    Synthetic checks for uptime, login and TLS expiry.
    Alerts to Telegram.

    Then the part people ask about: when an alert fires, an AI agent picks it up, looks at the logs and traces around it, and posts a first diagnosis next to the alert. It doesn't fix anything. It saves me the first ten minutes of every incident.

    Two rules I'd keep for any setup like this. Secrets never go on a command line, where they end up in process lists and shell history. And backups don't count until you've rehearsed a restore.

    The write-up covers the architecture, why I didn't use a hosted service, and what I'd change:

    https://pearse.dev/writing/observability-with-an-ai-incident-responder/
  short: "Self-hosted observability for two Django apps: OpenObserve, Alloy, OpenTelemetry, GlitchTip, synthetic checks, and an AI agent that triages alerts first. https://pearse.dev/writing/observability-with-an-ai-incident-responder/"
---

Observability for a small team is not about collecting everything; it is about making sure the first ten minutes of an incident are already done when you open your phone.

In August and September 2026 I built the observability stack behind both MTS products: it is part of wetlabs.app, the surgical video platform I run, and it watches MTS Hub, the operations platform, as well. I am the only person on ops, so the design goal was blunt: when something breaks, I should be told quickly, by something that has already looked.

The whole thing shipped in about a month, in seven phases (0 to 6), and runs on a single EU-hosted VM.

## The stack

- **OpenObserve** stores logs, metrics and traces in one place, with one query interface.
- **Grafana Alloy** collects and forwards telemetry from the hosts.
- **OpenTelemetry** instruments both Django apps, so a request can be followed through the web process, into a Celery task and back.
- **GlitchTip** handles error tracking, self-hosted and compatible with the Sentry SDKs.
- **Traefik** sits in front, systemd keeps services up.
- **Synthetic checks** probe uptime, a real login flow and TLS certificate expiry from outside.
- **Telegram** receives the alerts.

## The decision: self-hosted, not a SaaS

The obvious alternative was a hosted observability platform. It is less work to set up and someone else is on call for it.

I rejected it for one reason that outweighed the convenience. Telemetry from these apps contains personal data whether you like it or not: user IDs in traces, email addresses in error messages. Keeping it on an EU host I control is the simplest GDPR answer.

The cost of that choice is that I now operate the thing that tells me when other things are broken. Which is why the next two sections exist.

## Making alerts trustworthy

The test I am happiest with asserts that every alert rule *can* fire. [VERIFY: how the test works, e.g. feeds each rule the condition it should catch and checks an alert comes out.] An alert with a typo in its query is indistinguishable from a healthy system until the day it matters.

The other habits:

- **Secrets never pass through argv.** Anything on a command line shows up in process listings and shell history, so tokens and passwords are read from files or the environment.
- **The bot token lives in a local relay.** Components that send alerts talk to a small relay on the box; only the relay holds the Telegram token.
- **Nightly backups are encrypted, and restores are rehearsed.** A backup you have never restored is a hope, not a backup.

## The AI incident responder

When an alert fires, a triage agent built on the Claude CLI picks it up. It pulls the logs, traces and recent errors around the alert window, forms a view of what is going on, and posts a short diagnosis to the same Telegram thread as the alert.

It is deliberately read-only. It does not restart services, roll back deploys or touch data. Its job is to answer "what is this and where should I look?" before I have unlocked my phone.

What it should be good at [VERIFY: confirm from real use]: correlating an error spike with the deploy that preceded it, spotting that a synthetic login failure is really a TLS or upstream issue, and summarising a noisy log stream. [VERIFY: one real, non-sensitive incident it triaged well]

What it is not good at: knowing what "normal" looks like for a quiet app on a weekend. [VERIFY: an example of a wrong or unhelpful diagnosis]

## What I would do differently

I would write the "every alert can fire" test first, before writing the alert rules, not after. Several of the early rules [VERIFY: were any actually broken when the test landed?] were written against field names I had guessed.

I would also have started with fewer alerts. A small team learns to ignore a noisy channel within a week. [VERIFY: final number of alert rules]

Good observability is mostly discipline about what you are allowed to ignore. The AI just makes the first read cheaper.
