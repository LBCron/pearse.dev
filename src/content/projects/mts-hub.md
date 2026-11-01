---
title: MTS Hub
slug: mts-hub
oneLiner: Operations platform and system of record for a wetlab-education company — congresses, courses, contacts, bookings, packing, inventory, staffing, tickets, certificates, comms.
period: Jul 2026 – Present
role: Platform lead, sole engineer (agent-assisted)
stack:
  - Python 3.12
  - Django 5.2
  - DRF
  - django-unfold
  - Celery + Redis
  - Channels / Daphne
  - PostgreSQL
  - Tailwind v4 + DaisyUI
  - HTMX + Alpine
  - ReportLab
  - pytest
featured: true
order: 1
features:
  - Single source of truth for contacts, faculty, courses, congresses and bookings; replaces spreadsheets and a FileMaker system.
  - Course planning from rooms to stations to equipment, with template-driven packing lists per session.
  - Live multi-user packing screen over WebSockets; warehouse inventory and vehicle capacity planning.
  - Staff scheduling with a daily roster, plus time and expense tracking on an append-only ledger with dated statutory rate tables.
  - Certificate platform with public verification pages; event ticketing with Apple Wallet passes.
  - Sponsor vouchers and a pricing pipeline with scenario forecasting.
  - GDPR tooling — PII inventory, erasure and anonymisation, and a human-approval gate before any email leaves the system.
  - Magic-link login for external participants, German and English localisation, QR and RFID asset identification (experimental).
hooks:
  - 6000+ automated tests and 22 written architecture decision records, including "no email sends without human approval" and "time bookings are an append-only ledger".
  - Three older systems — a packing tool, a feedback tool and a legacy CRM — unified into one model, then validated by reconstructing a real congress end to end.
  - Privacy by design — an erasure request reaches even publicly verifiable certificates. The name is scrubbed; the credential stays valid.
visibility: private
category: mts
diagram: MtsHub
sections:
  - id: packing
    title: Packing, inventory and fleet
    origin: Began as a standalone packing tool in Feb 2026.
    summary: >-
      A wetlab travels in boxes. The packing list became a recipe — rooms, stations, equipment — and the checklist a
      shared screen rather than a clipboard. It replaced paper packing lists and the knowledge in one warehouse
      manager's head.
    features:
      - Calendar-to-event import from Microsoft 365.
      - Deterministic recipe packing lists per course type.
      - Real-time collaborative checklist on the warehouse floor, over WebSockets.
      - Serialised equipment tracking, vehicle capacity and staff scheduling.
      - Seven roles and around 140 permissions.
    stack:
      - Django Channels
      - Celery
      - Microsoft 365 calendar
  - id: feedback
    title: Event feedback and reports
    origin: Began as a standalone feedback tool in May 2026.
    summary: >-
      Feedback used to be a paper form at the door and a spreadsheet a week later. Now it is a QR code on the station
      and a branded PDF in the faculty's inbox the same evening, with no login for the people filling it in. It
      replaced a day of manual data entry after each event.
    features:
      - Per-session QR surveys; participants scan and answer, nothing to install or sign into.
      - Live analytics dashboard that polls over HTMX during the event.
      - Session benchmark percentiles across the whole event.
      - Session and event-level PDF reports with charts rendered server-side; CSV and XLSX export.
      - Custom branding per event.
    stack:
      - ReportLab
      - matplotlib
      - openpyxl
      - HTMX
  - id: drafting
    title: AI drafting with human approval
    origin: Began as a separate prototype in May 2026.
    summary: >-
      One rule: no AI output reaches a human audience without a human approving it first. The agents draft; the
      approval is a signed token in an email; Mailchimp only hears from the system after that token is
      used. The prototype stopped at its second sprint and its approval pattern moved into Hub's comms module.
    features:
      - Content ingestion from WordPress and PDFs into embeddings.
      - Multi-agent drafting with approval-by-email tokens before anything is sent.
      - Repurposing one approved piece into newsletter, LinkedIn and blog formats.
      - A self-hosted LLM behind an OpenAI-compatible API, chosen for data sovereignty.
    stack:
      - LangGraph
      - Self-hosted vLLM
      - PostgreSQL + pgvector
      - Mailchimp
  - id: knowledge
    title: Company knowledge, as a graph
    origin: Started in Sep 2026, alongside the rest of Hub.
    summary: >-
      Most company knowledge dies in chat threads. This is a memory that agents and people can both use: a vault of
      Markdown notes with a strict schema, written to by Claude Code over MCP, fed by voice notes, and browsed as a
      graph. The graph app never writes and Telegram never writes directly, so there is exactly one place where the
      truth can change.
    features:
      - A Markdown vault as the source of truth — Products, Capabilities, Offers, Customers, Ideas — with typed relations between them.
      - Claude Code reads and writes the vault over MCP; a schema validator CLI keeps it honest.
      - Telegram voice intake — a voice note becomes a transcript, then concepts, then links into the vault, on self-hosted speech-to-text.
      - A read-only 3D graph app laid out with UMAP, with open GitHub issues as satellite nodes around the concepts they touch.
      - Five ADRs before the first feature, including "GitHub is the work tracker" and "the graph app is a read-only consumer".
    stack:
      - Typer
      - FastAPI
      - Basic Memory (MCP)
      - claude-agent-sdk
      - UMAP + numpy
      - n8n
    diagram: MtsCortex
---

MTS runs hands-on surgical training at medical congresses across Europe. Before Hub, that business lived in spreadsheets, a FileMaker database, a legacy CRM and two small Django tools I had built over the previous year, one for packing and fleet and one for event feedback. Each one knew part of the story: who was coming, what to pack, how the feedback looked. None of them knew the whole thing.

Hub is the whole thing. It took the domain language from the packing tool, the feedback tool and the old CRM, settled it in a glossary and a set of ADRs, then rebuilt the model once. Everything downstream — rosters, packing lists, certificates, tickets, invoices — hangs off the same Congress, Course, Session and Contact records.

The scale that mattered was not users but consequences. A certificate is a professional credential. A packing list is what gets loaded onto a truck at 5am. A GDPR erasure has to actually erase. So the test suite is large, the sensitive paths have approval gates, and the decisions that would be expensive to reverse are written down.
