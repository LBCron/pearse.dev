---
title: "Pricing is a workflow, not a spreadsheet"
description: "Building a pricing and sales pipeline in Django: immutable scenario revisions, a pinned plan, a forecast that never double-counts, and humans at the gates."
pubDate: 2027-01-05
tags: [django, architecture]
project: "mts-hub"
draft: true
social:
  linkedin: |
    A price is the last step of a workflow. Model only the number and the spreadsheet comes back.

    I've been building a pricing and sales pipeline into MTS Hub, the Django operations platform I run. The brief sounded like a calculator: try some packages, see the margin.

    What people actually needed was a trail. Which assumptions produced this quote? What were we steering by last month? How much of the forecast is signed, and how much is hope?

    Three decisions did most of the work:

    Every save of a pricing scenario is a new, immutable revision. A quote pins the revision it came from and freezes its prices. Nothing is ever "locked", because nothing that depends on a revision can see it change.

    The plan is one pinned revision, adopted by a person, on the record.

    Won contracts replace forecast events instead of adding to them. Open pitches sit in a separate, probability-weighted band, never in the base line.

    And the thing I got wrong: I assumed every quote would come from the engine. None of the real ones had.

    The write-up covers the model, the rejected alternative and the fix, with no numbers:

    https://pearse.dev/writing/pricing-is-a-workflow-not-a-spreadsheet/
  short: "Every save is an immutable revision, the plan is pinned by a person, won deals replace forecast events. Building a pricing pipeline in Django as a workflow: https://pearse.dev/writing/pricing-is-a-workflow-not-a-spreadsheet/"
---

A price is the end of a workflow, and software that models only the number sends everyone straight back to the spreadsheet.

Hub is the Django operations platform I run for MTS – The Wetlab Company. Since October 2026 it has also held the commercial side: a pricing engine, a sales pipeline and a live forecast. Before that, pricing lived in a generated spreadsheet model. It could answer "what does this package cost?" It could not answer "what did we offer them, from which assumptions, and what are we steering by now?"

This post is the mechanism, with no numbers, on purpose.

## Where it lives

The first decision was placement. The pipeline sells more than one product, and some are separate systems with their own release cycles. A pricing tool for one product inside another would have read as unexplained scope creep.

So the rule became: Hub owns commercial pricing and the sales pipeline for every product; the product repos own delivery. Hub already holds the accounts, contacts and congresses a pitch is about, so pricing sits next to the records it talks about.

It is two Django apps. `pricing` holds the engine, the scenarios, the plan and quotes. `pipeline` holds congress series, pitches, contracts, activity and the dashboard. The engine itself is a pure Python module with no Django import, which is what makes it testable against golden values taken from the old spreadsheet model, to within a cent.

## The decision: a scenario is an immutable JSON revision

A scenario is the complete input to the engine: people and costs, recurring costs, event labour, a portfolio of event archetypes, targets and module prices. People clone, compare and edit scenarios constantly.

The obvious model is relational: a `Scenario` with child tables for each input. I rejected it. It is about eight tables, and a migration for every engine change, to gain database-level querying of inputs that nobody needs to query.

Instead, each scenario revision is one JSON document validated by a typed schema that carries a `schema_version` and ordered upgrade steps. Every save creates a new, immutable revision recording who saved it and when. A scenario is just a name pointing at its latest revision.

That one choice made the rest easy:

- **Cloning** is a row copy. **Comparing** is flatten-and-diff: two to four scenarios side by side, showing only the paths that differ.
- **A quote pins the revision it was priced from** and freezes its computed prices. A quote sent months ago keeps showing what was offered.
- **Old revisions stay computable.** They are upgraded on read, never rewritten. An engine change that adds an input ships an upgrade step, not a migration.

Nothing is ever "locked", because nothing that depends on a revision can see it change.

## A forecast that never double-counts

The engine forecasts archetypes: hypothetical kinds of event, times events per year, times uptake. The pipeline holds real commitments. Add the two together and every won deal is counted twice. Show only contracts and the forecast says nothing about later years.

The rule: a won contract replaces one event of its archetype for each year it covers, using its real terms. The remaining archetype volume forecasts the rest. If contracts exceed what the plan expected, the surplus goes on top and the dashboard flags the plan as understated.

Open pitches are neither. They sit in a probability-weighted band, never in the base line. Each pipeline stage has a default probability, editable globally and per pitch. A pitch on hold drops out of the band and is counted separately, rather than quietly keeping its old stage's weight.

## Where the humans sit

The plan is one pinned scenario revision, and pinning it is a person's act. Every adoption is recorded with who did it and an optional note, even re-adopting the same revision. When a newer revision of the planned scenario exists, the screen says so. It never moves the plan on its own.

Scenario inputs sit behind their own permission, separate from the pipeline. And Hub never emails a prospect. The one email the pipeline does send, a weekly digest of next actions falling due, goes through the same human-approval gate as every other message in Hub. [VERIFY: is automatic sending still off for the digest, so each one waits for approval?]

## What went wrong

I built the forecast assuming every quote came from the engine. When real pitches went in, none of the offers already sent had. They were negotiated, and their totals lived in a free-text notes field. So the weighted band valued those pitches at the plan's archetype revenue instead of at what had actually been offered.

The fix was a quote `kind`: **engine**, priced from a revision as before, or **manual**, with free-text line items and a stored total. A database check constraint keeps the two shapes apart, and every screen reads one accessor for the total, so no call site cares which kind it has. Manual quotes are frozen once created, like engine ones.

I would model the price people actually agree first, and the price the engine suggests second. [VERIFY: is the pipeline dashboard in regular use yet, or still being adopted?]

Pricing software is mostly a record of who decided what, from which assumptions. The arithmetic is the easy part.
