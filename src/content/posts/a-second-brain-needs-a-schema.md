---
title: "A second brain needs a schema"
description: "The Hub's second brain: voice notes over Telegram, self-hosted speech-to-text, an agent filing a Markdown vault, and why the schema gates every write."
pubDate: 2027-01-12
tags: [agentic-engineering, self-hosted-ai, architecture]
project: "mts-hub"
draft: true
social:
  linkedin: |
    If an agent writes your notes for you, the notes need a schema. Otherwise you get a pile of plausible Markdown nobody can use.

    I've been building a second brain into MTS Hub, the operations platform I run, for the business side of my work. I talk into Telegram. A self-hosted speech model transcribes it. An agent files the ideas into a Markdown vault as typed concepts with typed links, and opens GitHub issues for anything that is actual work. A 3D graph shows the result.

    The interesting part isn't the voice or the graph. It's the gate in the middle.

    Five concept types. Six relation types. A capability belongs to exactly one product. A link that points at nothing is an error.

    Every intake runs the validator before anything is committed. If the vault doesn't validate, nothing lands. The agent can be as creative as it likes, but only inside the shape.

    The domain language came first: Vault, Concept, Utterance. Then five short ADRs. Then code.

    One thing went wrong in the first real filing: a tool I trusted rewrote every file it touched. The vault's git history caught it.

    The design, the alternatives I rejected and that bug:

    https://pearse.dev/writing/a-second-brain-needs-a-schema/
  short: "An agent that writes your notes needs a schema, or you get plausible Markdown nobody can query. Voice intake, a validated vault and a read-only 3D graph: https://pearse.dev/writing/a-second-brain-needs-a-schema/"
---

An agent that writes your notes needs a schema, or within a week you have a heap of plausible Markdown that nobody can query and nobody trusts.

MTS Hub's records say what the company does. Its second brain, which I built into Hub, holds the business side of what it is thinking about: a place where spoken ideas become linked, structured knowledge that can be browsed as a graph, and where anything that is really a task gets handed to the tool that already tracks work. Most of it was built in September 2026, after the domain language and five decision records were written down first.

## The loop

The input is a voice note. I record it in Telegram on my phone. An n8n workflow picks it up and hands the audio to a self-hosted speech model, with a Whisper-family model as fallback. The transcript goes to an intake service, which stores it as an **Utterance**: never edited, always kept.

An agent built on the Claude Agent SDK then does the **Intake**. It reads the vault through the Basic Memory MCP server, files the Utterance as Concepts and Relations, and opens GitHub issues for anything that is actual work. The vault never copies an issue's status; it only points at it.

Then the gate. The intake service runs the schema validator over the whole vault. If it fails, nothing is committed. If it passes, the change is committed and pushed to git, and the bot replies in the chat with the Concepts it touched and the issues it opened.

Telegram itself is not EU-hosted, but the audio is short-lived there. The transcript and everything downstream stay on our own server. I rejected the alternatives on the same grounds: dictating into a remote coding session from the phone needs the desktop awake and gets keyboard-grade transcription, and voice-note SaaS sends the audio out of the EU.

## The decision: a Markdown vault, not a database

The store had to be writable by agents and readable by me anywhere, including on a phone, with links between ideas.

The obvious choice for me was Django and Postgres, the stack the rest of Hub is built on. I rejected it: I would have built storage, editing, sync and a mobile reader before any of it was useful. A self-hosted note app came closer, but its store is not files on disk. Agent-memory stores were the furthest off: they hold facts an LLM extracted, behind an inspector, not a vault a human curates.

So the vault is plain Markdown: one file per Concept, YAML frontmatter, wikilinks, versioned in git. It is readable with none of my software running. The cost is real: querying is weaker than SQL, and every component has to parse Markdown.

## Why the schema is the product

Every Concept has exactly one of five types: Product, Capability, Offer, Customer or Idea. A Relation is one of six: `part_of`, `includes`, `targets`, `depends_on`, `replaces`, `relates_to`. Nothing else.

The validator enforces it. An unknown type is an error. A missing required field is an error that names the file and line. A Capability must have exactly one `part_of`. A wikilink that resolves to nothing is a dangling-link error. Some rules are only warnings, to keep the validator simple.

The glossary does the rest. "Upsell" was being used for both a sellable feature and a priced bundle. Resolved: the feature is a Capability, the priced thing is an Offer, and the word upsell never appears in the vault. An agent cannot notice that kind of drift on its own. A schema it has to pass can.

## The graph is a view, never a store

The 3D graph is a separate web app that only reads: the vault through the same vault library the validator uses, the issues from GitHub. Open issues orbit their Concept as small satellites, so a Customer whose Offers have no satellites shows up as a gap.

Rest positions come from embeddings, so similar but unlinked ideas sit near each other. The plan was UMAP. Measured on the ten-Concept seed vault, PCA preserved similarity far better, so UMAP only takes over at 20 Concepts or more. When the local embedding model is unreachable, the graph falls back to a plain force layout with a banner. Because it never writes, the fallback costs nothing but a less meaningful arrangement.

## What went wrong

The first real filing produced eleven frontmatter edits nobody asked for. Basic Memory's sync was adding a `permalink:` line to every file it indexed. One environment flag fixed it, and a test run against a copy of the vault rewrote zero lines with it set. The vault being in git is the only reason I saw it in the diff instead of months later.

What I would do differently: run the full Telegram leg end to end before calling intake done. When I last checked, it waited on a public webhook URL. [VERIFY: is the Telegram trigger leg live end to end, with a real voice note and bot reply?] [VERIFY: rough count of Concepts in the vault today, if Pearse is happy to share it]

The agent does the filing. The schema decides what counts as filed.
