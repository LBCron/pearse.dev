# LinkedIn profile copy

Paste-ready copy for Pearse's LinkedIn profile. Every claim comes from a case study under `src/content/projects/`, the timeline in `src/components/Timeline.astro` or the About section of `src/pages/index.astro`. No business or product numbers appear here that those files do not already state. Nothing Confidential (see `GLOSSARY.md`).

Rules this copy keeps:

- MTS is named by its public name, MTS – The Wetlab Company, and described as a wetlab-education company. No customers, congresses, events or prices.
- MTS has exactly two products, MTS Hub and wetlabs.app. Packing, event feedback, AI drafting, the second brain and the observability stack are features of those two, never products of their own.
- Client permission is recorded for the client case studies (#7, ADR 0006), so a client may be named by its business name only: never an owner or staff member, a server, a price or a business figure.
- Private repositories are described, never linked.
- Each pasteable field sits in a code block. Character counts are for the text inside the block, newlines included, as LinkedIn counts them.
- `[VERIFY: …]` marks a fact the sources do not state. Resolve each one before pasting and delete the marker.

## Headline

Limit 220 characters. Pick one.

**A. Pillar-led** (159 characters)

```
Software engineer at MTS – The Wetlab Company. I build Django platforms, run self-hosted AI in production, and ship with an agent team under review. Innsbruck.
```

**B. Stack-led** (173 characters)

```
Sole engineer at MTS – The Wetlab Company | Django, PostgreSQL, Celery | Surgical-training video platform, operations system of record | Self-hosted AI | Agentic engineering
```

**C. Sentence** (163 characters)

```
I build the systems a wetlab-education company runs on: a surgical-training video platform, an operations system of record, and the agent workflow that ships them.
```

## About

Limit 2,600 characters. This one is 1,881. The first two lines are the preview before "see more" and stand on their own.

```
I build the systems a wetlab-education company runs on, and the agent workflow that lets one engineer ship all of it under review.
Django, PostgreSQL and Celery underneath. Self-hosted AI where it earns its place.

At MTS – The Wetlab Company in Innsbruck, that means:

wetlabs.app, a surgical-training video platform. Each wetlab station records the surgeon, a small supervised model chapters the footage by procedure phase, and the surgeon leaves with their own library. It runs at live congresses, and every merge to main deploys to production.

MTS Hub, the operations system of record: congresses, courses, contacts, bookings, packing, staffing, certificates and comms on one model. It replaced spreadsheets, a FileMaker database and three earlier tools of mine. 6000+ tests, 22 ADRs, and a human-approval gate before any email leaves the system.

The observability that keeps both honest: OpenTelemetry, OpenObserve and GlitchTip, with an AI agent that reads each alert and posts a first diagnosis to Telegram. It is wrong sometimes. It is fast every time, and it shows its working.

Since mid-2026 most of my code is written by agents and reviewed before it merges. The harness is the part I would talk about first: one planning session, cheaper delegates routed by issue size, each in its own git worktree; hooks that block destructive git commands in a shared checkout; a prosecutor model that argues against every PR. Most of the rules came from failures.

What I care about: writing decisions down before they get expensive, small trained models over general ones when the answer has to be right, and boring infrastructure that tells you when it breaks.

Before MTS: a full-stack diploma in 2024, then freelance Django, Wagtail, WordPress and TYPO3 work. I still take the odd client rebuild. From Dublin, based in Innsbruck.

Case studies and writing: https://pearse.dev
```

## Experience

Newest first, as LinkedIn shows them. The timeline has seven rows; they map to five positions:

| Timeline row | Position |
|---|---|
| Aug – Oct 2026, Infrastructure and client work | 1 (client work) and 2 (observability, part of wetlabs.app) |
| Jul 2026 – Present, Platform lead | 2 |
| Feb – Oct 2026, Software engineer, MTS | 3 |
| Aug 2025 – Present, Software engineer, MTS | 3 |
| 2025, Freelance, then MTS | 4, then 3 |
| May – Dec 2024, Freelance and side builds | 4 |
| Nov 2023 – Apr 2024, Self-taught, then Code Institute | 5 |

Positions 2 and 3 go under one company on LinkedIn, so they show as two roles at MTS.

### 1. Freelance software engineer

- **Title:** Freelance Software Engineer
- **Organisation:** Self-employed
- **Dates:** Aug 2026 – Present
- **Location:** [VERIFY: location for freelance work]
- **Description:** 701 characters (limit 2,000)

```
Client rebuilds, alongside MTS.

• Rebuilt a small business's WordPress site in Django and Wagtail, with quoting, invoicing, procurement, jobs and a CRM, so that the website and the back office share one database.
• Set up the cutover as an Apache vhost swap on the same server, behind Cloudflare, with WordPress left on disk untouched, so that rollback is one config change rather than a restore.
• Wrote firewall and backup runbooks before cutover so that they existed before the first incident, not after it.
• Built a Django CRM for a small arts event so that a legacy desktop database only one person could operate gave way to shop sync, registrations, check-in and email campaigns in one system.
```

### 2. Platform lead, MTS – The Wetlab Company

- **Title:** Platform Lead [VERIFY: the Hub case study gives "Platform lead, sole engineer (agent-assisted)" as the role. If that is not a title you want on LinkedIn, fold these bullets into position 3 and drop this one.]
- **Organisation:** MTS – The Wetlab Company
- **Dates:** Jul 2026 – Present
- **Location:** Innsbruck, Austria
- **Description:** 1,303 characters (limit 2,000)

```
Sole engineer, agent-assisted, on MTS Hub: 939 commits, 6000+ tests and a first live event. Also the observability and agent workflow behind both MTS products.

• Built MTS Hub, the operations system of record, by unifying my earlier packing and feedback tools and a legacy CRM into one model, so that congresses, courses, contacts, bookings, packing, staffing, certificates and comms stop living in spreadsheets and a FileMaker database.
• Wrote 22 ADRs and 6000+ automated tests, and reconstructed a real congress end to end, so that the decisions that are expensive to reverse are on record and the model was proven before anyone relied on it.
• Built GDPR tooling (PII inventory, erasure, anonymisation, a human-approval gate on outgoing email) so that an erasure request reaches even publicly verifiable certificates: the name is scrubbed, the credential stays valid.
• Built an observability stack on OpenTelemetry, Grafana Alloy, OpenObserve and GlitchTip, with an AI agent that reads each alert, so that a first diagnosis is in the Telegram thread before I have unlocked my phone.
• Built an agentic engineering workflow (worktree isolation enforced by hooks, model routing by issue size, adversarial PR review, shift handovers) so that one engineer can ship with agents every day, under review.
```

### 3. Software engineer, MTS – The Wetlab Company

- **Title:** Software Engineer
- **Organisation:** MTS – The Wetlab Company
- **Dates:** Aug 2025 – Present
- **Location:** Innsbruck, Austria
- **Description:** 1,096 characters (limit 2,000)

```
wetlabs.app, and the internal tools that became features of MTS Hub: packing, event feedback, AI drafting and the Hub's second brain.

• Built wetlabs.app, a surgical-training video platform, so that each surgeon recorded at a wetlab station leaves with their own procedure, chaptered by phase, in a library they control.
• Trained a supervised phase model (ResNet50 + MS-TCN++) on our own footage, judged against a locked test set, so that chapter boundaries do not depend on a general vision-language model. Qwen3-VL stays as an opt-in.
• Set up 22 ADRs, around 490 test files, accessibility checks in CI and two self-hosted runners so that every merge to main can deploy to production.
• Built the packing and event-feedback tools, now features of MTS Hub, so that packing lists became recipes per course type and event feedback went from a paper form to a PDF report the same evening.
• Built the Hub's second brain, a schema-validated Markdown vault that Claude Code writes to over MCP and Telegram voice notes feed, so that company knowledge has one place to change instead of chat threads.
```

### 4. Freelance web developer

- **Title:** Freelance Web Developer
- **Organisation:** Self-employed
- **Dates:** May 2024 – Jul 2025 [VERIFY: end month. The timeline says "2025: Freelance, then MTS" and the MTS rows start Aug 2025.]
- **Location:** [VERIFY: location]
- **Description:** 403 characters (limit 2,000)

```
• Built my first Django apps, a blog, a store and an events calendar, with Tailwind and DaisyUI.
• Built sites in Wagtail and TYPO3, and did WordPress store work.
• Built Chatterbox, a streaming chat UI over HTMX against a local model on Ollama, to find out whether a local model was usable enough to build on. It was. That thread leads to Qwen3-VL in wetlabs.app and vLLM in the Hub's drafting feature.
```

### 5. Code Institute

LinkedIn puts this under **Education**, not Experience. Paste it there.

- **School:** Code Institute
- **Qualification:** Full Stack Diploma [VERIFY: exact diploma name as it appears on the certificate]
- **Dates:** Nov 2023 – Apr 2024 (self-taught first, then the diploma)
- **Location:** [VERIFY: online, or a campus]
- **Description:** 313 characters (limit 1,000 for an Education description)

```
• Taught myself web development, then took the Code Institute Full Stack Diploma.
• Built static sites, JavaScript apps, a first Python CLI and a first Flask app.
• Built Tournament Brackets, a Python CLI that runs knockout brackets on a Google Sheet: the first project where tests caught a bug before a user did.
```

## Featured

Pin in this order. Only published pages go in now.

1. https://pearse.dev/ (the site: case studies, timeline, writing)
2. https://pearse.dev/work/mts-hub/ (MTS Hub case study)
3. https://pearse.dev/work/wetlabs-app/ (wetlabs.app case study, with the observability stack and the AI incident responder)
4. https://pearse.dev/writing/why-i-rebuilt-pearse-dev/ (the one published article)
5. https://pearse.dev/work/agentic-workflow/ (the agent harness)

Add each article when it is published, and move it above the case study it covers:

- https://pearse.dev/writing/one-engineer-one-platform/ (from 2026-11-03, above MTS Hub)
- https://pearse.dev/writing/shipping-a-video-platform-to-a-congress/ (from 2026-11-10, above wetlabs.app)
- https://pearse.dev/writing/an-agentic-engineering-workflow-that-ships/ (from 2026-11-17)
- https://pearse.dev/writing/observability-with-an-ai-incident-responder/ (from 2026-11-24, above wetlabs.app)

Add the two client articles from their publish dates once they are published:

- https://pearse.dev/writing/wordpress-to-wagtail-without-breaking-the-business/ (from 2026-12-01, once published)
- https://pearse.dev/writing/replacing-filemaker-with-django/ (from 2026-12-08, once published)

## Skills

36 skills, ordered for the positioning. Add them in this order and pin the first three as top skills. Where LinkedIn's picker has no exact match, take the closest entry it offers.

1. Django
2. Python
3. Agentic workflows
4. PostgreSQL
5. Celery
6. Self-hosted LLM deployment
7. Django REST Framework
8. Software architecture
9. Architecture decision records
10. Claude Code
11. AI agents
12. LangGraph
13. vLLM
14. Ollama
15. PyTorch
16. Computer vision
17. FFmpeg
18. OpenTelemetry
19. Observability
20. Docker
21. Hetzner Cloud
22. Cloudflare
23. Traefik
24. GitHub Actions
25. Continuous deployment
26. Redis
27. WebSockets
28. HTMX
29. Alpine.js
30. Tailwind CSS
31. Wagtail
32. Astro
33. Three.js
34. Playwright
35. Web accessibility
36. GDPR

## Open to

Held in reserve (95 characters). Do not switch on "Open to work" with this yet.

```
Open to platform work that needs one owner, and to talks on agent workflows that actually ship.
```

## Paste order

1. Location: Innsbruck, Austria. Website in contact info: https://pearse.dev.
2. Headline: one of A, B or C.
3. About.
4. Experience, oldest first so LinkedIn sorts them correctly: position 4, then 3, then 2 (under the same MTS company entry as 3), then 1.
5. Education: Code Institute (position 5).
6. Featured, in the order above.
7. Skills, in the order above; pin the first three.
8. Open to: hold.
9. Custom profile URL: tracked in #16.
