---
# CV facts that exist nowhere else on the site. Wording comes from docs/profile/linkedin.md,
# docs/profile/bio.md and the case studies; anything still carrying a verify marker stays out of here until confirmed.
# Case studies, contact links, location, skills and interests are pulled from the site itself.
# MTS is exactly two products, MTS Hub and wetlabs.app (issue #39): tools folded into them are bullets
# under `products`, described by what they do, never by their old names.
headline: 'Software engineer at MTS – The Wetlab Company. I build its two products, MTS Hub and wetlabs.app, run self-hosted AI in production, and ship with an agent team under review.'
experience:
  - title: Freelance Software Engineer
    organisation: Self-employed
    period: Aug 2026 – Present
    summary: 'Client rebuilds, alongside MTS.'
    bullets:
      - 'Rebuilt a small business''s WordPress site in Django and Wagtail, with quoting, invoicing, procurement, jobs and a CRM, so that the website and the back office share one database.'
      - 'Built a festival CRM in Django so that a legacy desktop database only one person could operate gave way to shop sync, registrations, check-in and email campaigns in one system.'
  - title: Software Engineer
    organisation: MTS – The Wetlab Company
    period: Aug 2025 – Present
    location: Innsbruck, Austria
    summary: 'Sole engineer on the two products a wetlab-education company runs on.'
    products:
      - name: MTS Hub
        summary: 'The operations system of record: congresses, courses, contacts, bookings, packing, staffing, certificates and comms on one model, instead of spreadsheets and a FileMaker database.'
        bullets:
          - 'Folded two earlier tools of mine and a legacy CRM into it, so that packing lists became recipes per course type and event feedback went from a paper form to a PDF report the same evening.'
          - 'Wrote 22 ADRs and 6000+ automated tests, and reconstructed a real congress end to end, so that the decisions that are expensive to reverse are on record and the model was proven before anyone relied on it.'
          - 'Built GDPR tooling (PII inventory, erasure, anonymisation, a human-approval gate on outgoing email) so that an erasure request reaches even publicly verifiable certificates: the name is scrubbed, the credential stays valid.'
          - 'Added AI drafting with human approval, and company knowledge as a schema-validated Markdown vault that Claude Code writes to over MCP and Telegram voice notes feed.'
      - name: wetlabs.app
        summary: 'Surgical-training video platform: each surgeon recorded at a wetlab station leaves with their own procedure, chaptered by phase, in a library they control.'
        bullets:
          - 'Trained a supervised phase model (ResNet50 + MS-TCN++) on our own footage, judged against a locked test set, so that chapter boundaries do not depend on a general vision-language model. Qwen3-VL stays as an opt-in.'
          - 'Set up accessibility checks in CI and two self-hosted runners so that every merge to main can deploy to production.'
          - 'Built observability on OpenTelemetry, Grafana Alloy, OpenObserve and GlitchTip, with an AI agent that reads each alert, so that a first diagnosis is in the Telegram thread before I have unlocked my phone. It watches MTS Hub too.'
    bullets:
      - 'Built an agentic engineering workflow (worktree isolation enforced by hooks, model routing by issue size, adversarial PR review, shift handovers) so that one engineer can ship both products with agents every day, under review.'
  - title: Freelance Web Developer
    organisation: Self-employed
    period: May 2024 – 2025
    bullets:
      - 'First paid job: a WooCommerce store for JDM and drift car parts in Ireland, trading since November 2024. I still keep it running.'
      - 'Built my first Django apps, a blog, a store and an events calendar, with Tailwind and DaisyUI.'
      - 'Built sites in Wagtail and TYPO3, and did WordPress store work.'
      - 'Built Chatterbox, a streaming chat UI over HTMX against a local model on Ollama, to find out whether a local model was usable enough to build on. It was. That thread leads to Qwen3-VL in wetlabs.app and vLLM in the Hub''s drafting feature.'
education:
  - title: Full-stack diploma
    organisation: Code Institute
    period: Nov 2023 – Apr 2024
    summary: 'A government-sponsored online diploma, taken once Skatedownhills had brought me back to software.'
    bullets:
      - 'Built static sites, JavaScript apps, a first Python CLI, and Skatedownhills again: first in Flask, then in Django.'
      - 'Built Tournament Brackets, a Python CLI that runs knockout brackets on a Google Sheet: the first project where tests caught a bug before a user did.'
before:
  - title: Professional downhill skateboarder
    organisation: IDF World Tour
    period: From 2014
    summary: 'Ten years racing downhill, from the Irish and UK scenes to the world tour.'
    bullets:
      - '2nd overall in the 2019 IDF European rankings (European vice champion), and BDSL (British Downhill Skateboard League) champion.'
      - 'Raced Almabtrieb, Kozakov, Peyragudes, Maryhill and Transylvania; 19th in the WDSC world rankings in 2022. Thrill Magazine called me one of the top skaters in Europe in 2021.'
      - 'Elected IDF European Racer Representative in 2020. In the scene I was the event guy, the one people asked what was on and where, which is how Skatedownhills started.'
---

I build the two products a wetlab-education company runs on, MTS Hub and wetlabs.app, and the agent workflow that lets one engineer ship both under review. Django, PostgreSQL and Celery underneath. Self-hosted AI where it earns its place.

I built my first website at 14, for my airsoft team, Legion Airsoft. Ten years of racing downhill skateboards came next, and I found my way back to software by building [Skatedownhills](/work/skatedownhills/), an events calendar for the sport.

What I care about: writing decisions down before they get expensive, small trained models over general ones when the answer has to be right, and boring infrastructure that tells you when it breaks.
