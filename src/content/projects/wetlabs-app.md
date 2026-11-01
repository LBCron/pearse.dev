---
title: wetlabs.app
slug: wetlabs-app
oneLiner: Surgical-training video platform — wetlab stations record surgeons, an AI model segments the footage into procedure phases, and every surgeon gets a personal video library.
period: Aug 2025 – Present
role: Lead and sole engineer
stack:
  - Django 5.2
  - Celery + Redis
  - PostgreSQL
  - FFmpeg
  - nginx X-Accel-Redirect
  - PyTorch (ResNet50 + MS-TCN++)
  - Qwen3-VL via Ollama
  - MediaMTX (SRT / LL-HLS)
  - Web Push / PWA
  - OpenTelemetry
  - Playwright + axe
featured: true
order: 2
features:
  - Station check-in via QR placards; recordings auto-attach to the right surgeon and session.
  - FFmpeg pipeline for transcoding, thumbnails and progressive playback; chunked uploads up to 10 GB.
  - A trained phase model segments each procedure into chapters; non-work time is skipped in the player rather than cut from the file.
  - Surgeons own their library; share-for-review links for mentors; faculty annotations on the timeline.
  - Live view of a capture station in the browser, from SRT ingest to LL-HLS.
  - Consent register, anonymous event surveys with receipts, tiered session lifetimes.
  - Installable PWA with push notifications; white-label theming per congress.
  - Automatic footage deletion six months after the event — the retention policy is encoded in the product.
hooks:
  - ADR-0008 chose a supervised phase model over VLM classification — a small local model trained against a locked test set, instead of trusting a general LLM. Qwen3-VL stayed as an opt-in.
  - 22 ADRs, around 490 test files, accessibility checks in CI and two self-hosted runners. Every merge to main deploys to production.
  - Deleted a 190 KB committed CSS bundle that had caused a merge conflict on every template change.
visibility: private
category: mts
diagram: WetlabsApp
sections:
  - id: observability
    title: Observability and incident response
    origin: Built in Aug – Sep 2026; it watches MTS Hub as well.
    summary: >-
      Two production Django apps, two self-hosted CI runners, a handful of VMs and one engineer. That is not enough
      people to watch dashboards, so the dashboards have to watch themselves. The stack is deliberately boring; the
      novel part is the responder. When an alert fires, an agent with read-only access to the signals writes a short
      diagnosis into the same Telegram thread, before I have unlocked my phone. It is wrong sometimes. It is fast
      every time, and it always shows its working.
    features:
      - Logs, metrics and traces in one place; distributed tracing instrumented in both production Django apps.
      - Self-hosted error tracking and synthetic uptime, login and TLS checks.
      - Alerts routed to Telegram; an AI agent reads the alert, pulls the relevant signals and posts a first diagnosis.
      - Encrypted nightly backups with a rehearsed restore; credential-rotation scripts.
      - A test asserts that every alert rule is capable of firing — an alert that can never trigger is worse than none.
      - Secrets never pass through argv, and the bot token is isolated in a local relay process. Entirely EU-hosted.
    stack:
      - OpenObserve
      - Grafana Alloy
      - OpenTelemetry
      - GlitchTip
      - Traefik
      - systemd
      - Claude CLI
    diagram: Observability
---

A wetlab is a room full of microscopes, practice eyes and surgeons learning a technique for the first time. wetlabs.app puts a camera on each station and turns the raw footage into something a surgeon can actually use afterwards: their own procedure, chaptered by phase, in a library they control.

It is the product I have lived with longest. It started in August 2025 as a video pipeline — FFmpeg, Celery, thumbnails — and grew into a platform with check-in, consent, live view, surveys and a trained phase model. It runs at live congresses, which means every release is tested against a hard deadline and a room that cannot wait.

The AI decision is the one I would defend first. A general vision-language model could describe a frame; it could not reliably tell me where phase three ended. A small supervised model, trained on our own footage and judged against a locked test set, could. The VLM is still there for the cases where it earns its place, but it is opt-in.
