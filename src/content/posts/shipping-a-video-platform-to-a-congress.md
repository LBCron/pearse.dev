---
title: "Shipping a surgical video platform to a live congress"
description: "wetlabs.app: FFmpeg and Celery pipelines, a small local phase model chosen over a general VLM, GDPR-first EU hosting, and what a live congress teaches you."
pubDate: 2026-11-10
tags: [django, self-hosted-ai, privacy]
project: "wetlabs-app"
draft: false
social:
  linkedin: |
    A congress is the least forgiving deployment target I know. Nobody files a ticket. They just walk away from the station.

    For the last year I've been the sole engineer on wetlabs.app, a surgical-training video platform. Wetlab stations record surgeons practising procedures. The footage is transcoded, split into procedure phases, and lands in the surgeon's personal library.

    The decision I'm proudest of is a boring one. For phase segmentation, I did not use a general vision-language model as the default. I chose a small supervised model, trained locally (a frozen image encoder under an MS-TCN++ temporal model) and judged against a locked test set.

    Qwen3-VL, self-hosted via Ollama, is still in the product. It is opt-in.

    The reason: a general model gives you a plausible answer. A small model with a locked test set gives you a number you can defend.

    The other lessons were operational. QR placards so recordings attach to the right surgeon without anyone typing. Chunked uploads for files up to 10 GB. Every merge to main deploys to production, so main has to always be shippable. Footage deleted six months after the event, by the product, not by a reminder.

    Full write-up on the pipeline, the model decision and the thing I'd undo:

    https://pearse.dev/writing/shipping-a-video-platform-to-a-congress/
  short: "Why I chose a small supervised phase model over a general VLM for surgical video, and what shipping to a live congress taught me about readiness. https://pearse.dev/writing/shipping-a-video-platform-to-a-congress/"
---

The hardest requirement for software used at a live congress is not a feature; it is that nothing needs explaining to a surgeon standing at a wetlab station with gloves on.

wetlabs.app is a surgical-training video platform I have built as the sole engineer since August 2025, for MTS – The Wetlab Company. Wetlab stations record surgeons practising procedures, the platform splits the footage into procedure phases, and each surgeon gets a personal video library they own. It has run live at congresses, and sits at 1,086 commits and more than a dozen releases, currently v0.19.

## The pipeline: boring on purpose

A recording's life looks like this:

1. **Check-in.** Each station has a QR placard. The surgeon scans it, and from then on recordings from that station attach to the right person and session automatically. Nobody types a name into a form at the station.
2. **Upload.** Files can be large, so uploads are chunked, up to 10 GB.
3. **Processing.** Celery workers run FFmpeg to transcode, generate thumbnails and prepare progressive playback. Redis is the broker, PostgreSQL holds the state.
4. **Serving.** Django checks permissions and nginx streams the file via `X-Accel-Redirect`, so Python never pushes video bytes.
5. **Analysis.** A phase model segments the procedure into chapters.

There is also a live view: a capture station can stream over SRT into MediaMTX and out to the browser as low-latency HLS, so staff, or the surgeon checked in at that station, can watch it from a browser elsewhere.

None of these pieces is novel. The value is that each step is a separate, retryable task with visible status, so when something fails at an event you can see which step and run it again.

## The decision: a small supervised model over a general VLM

The tempting design for phase segmentation was to send frames to a vision-language model and ask it which phase it was looking at. I had Qwen3-VL running self-hosted via Ollama, so the data never left our infrastructure.

I rejected it as the default. That decision is written down as an ADR: supervised phase model over VLM classification.

Instead the default is a small supervised model trained locally, on a GPU MTS already owns: a frozen image encoder feeding an MS-TCN++ temporal network, judged against a locked, hand-labelled test set that training never touches. The headline metric is not accuracy but the wrong-chapter rate. A missing chapter is harmless and a wrong one is not, so the model abstains when it is unsure.

The reasoning was simple. A local Qwen3-VL trial on our footage scored about 10% frame accuracy, which is chance. A general model returns an answer that sounds right, and its failure modes are hard to characterise. A small supervised model returns a number against a fixed benchmark, and when it gets worse I know. Qwen3-VL stays in the product as an opt-in path, not the thing a surgeon's chapters depend on.

One product detail followed from that: non-work time is skipped in the player, not cut from the file. If the model is wrong, nothing is lost.

## GDPR as a feature, not a page

Surgical footage of identifiable people is sensitive, so privacy rules live in the code:

- A consent register.
- Anonymous event surveys with receipts.
- Tiered session lifetimes depending on context.
- Footage deleted automatically six months after the event. The policy is encoded in the product, not in someone's calendar.
- Hosting in the EU, on Hetzner.

The surgeon owns their library. Sharing for review is an explicit link to a mentor, and faculty can annotate.

## What a congress teaches you about operational readiness

Every merge to `main` deploys to production through CI. That forces a discipline: `main` is always shippable, because it is always shipped. Two self-hosted CI runners handle the test suite, about 490 test files including Playwright tests with axe accessibility checks.

What events taught me:

- Venue networks are worse than you planned for: hundreds of attendees share one wifi. I looked at a CDN and an on-site cache and rejected both in an ADR; the lever is a lower bitrate at the source.
- Operators re-run things under pressure. An import interrupted on an event laptop gets run again, so a second run must not create a second copy of every recording. Imports now fingerprint each file and skip what is already in the library.
- Tracing pays for itself. OpenTelemetry in the app means one slow upload can be followed from the request into the Celery task that processes it.

## What I would do differently

For a long time I committed the built CSS bundle, about 190 KB, to the repo. Every template change rebuilt it, and every rebuild meant a merge conflict between parallel branches. Removing it from version control and building it in CI and in a build stage of the Docker image was a small change that removed a daily source of friction. I should have done it in the first month.

The rest of the stack is a Django 5.2 monolith, an installable PWA with push notifications, white-label theming per congress and MkDocs for the docs.

A live event is a deadline that cannot move. Build so that the only thing left to do on the day is watch.
