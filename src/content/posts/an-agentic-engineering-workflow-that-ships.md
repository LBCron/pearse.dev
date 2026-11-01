---
title: "An agentic engineering workflow that actually ships"
description: "One planner model, cheaper delegates by issue size, worktrees enforced by hooks, adversarial PR review and review budgets. What it costs and where it fails."
pubDate: 2026-11-17
tags: [agentic-engineering, claude-code, code-review, git]
project: agentic-workflow
draft: false
social:
  linkedin: |
    Half my AI coding spend was the same context being sent again.

    I measured it. 53% of tokens over the period went on re-sending context each turn, not on new work. That one number reshaped how I run a team of Claude Code agents.

    The workflow now, in short:

    One planner model at the top. It turns a brain-dump into a spec and routes the work. It doesn't type most of the code.

    Delegates chosen by issue size. Small, mechanical issues go to cheaper models. Bigger ones get stronger ones.

    One git worktree per task, enforced by hooks. Agents physically can't commit in the shared checkout. They also claim an issue on the tracker first: two once picked up the same one, and one got as far as an open PR.

    Adversarial review. A prosecutor agent tries to break the PR. A judge on a different, stronger model rules on each finding.

    Budgets for review. A 92-file PR taught me review doesn't converge on a big diff: every round found new problems. So now there's a PR size cap and a fixed number of fix rounds. Leftovers become issues.

    The full write-up has the routing table, the hooks and the costs I'd rather not have paid:

    https://pearse.dev/writing/an-agentic-engineering-workflow-that-ships/
  short: "53% of my agent token spend was re-sent context. How I redesigned a Claude Code team around that: size-based routing, hook-enforced worktrees, adversarial review with budgets. https://pearse.dev/writing/an-agentic-engineering-workflow-that-ships/"
---

An agent team ships when the rules that keep it honest are enforced by the machine, not remembered by the model.

Since August 2026 I have run most of my engineering through a team of Claude Code agents, across a Django operations platform, a surgical video platform and a handful of client projects. The setup lives in a private config repo: hooks, agent definitions, about 30 custom skills and a set of written workflow rules. It replaced Tutto, an earlier headless orchestrator I built that took an issue all the way to an auto-merged PR. This post is the design, plus the parts that cost me.

## One planner, cheaper delegates

There is exactly one planning session, on the strongest model, and it is the interactive one I talk to. Its job is to turn a vague request into a spec block (goal, scope, non-goals, acceptance criteria, assumptions, open questions) and show it to me before any expensive work starts.

Then it routes by the issue's size:

| Size | Delegate |
|---|---|
| Scouting / read-only | Haiku |
| S (one to three files) | Sonnet, or Haiku if purely mechanical |
| M (multi-file, migrations) | Opus |
| L (design-heavy) | the top model explicitly, or split into smaller issues |

Every delegate gets the same contract: goal and issue link, its worktree path, the files to read first, acceptance criteria and the commands that verify them, constraints, and a short word limit on what it reports back.

The rejected alternative was letting every subagent inherit the planner's model. It is simpler and it was most of the bill. A subagent also costs about 23,000 tokens just to start, so anything under roughly ten tool calls is done inline instead of delegated.

## Worktrees, enforced by hooks

Several agents work against the same repos at once. The shared checkout of each repo belongs to no agent; every task gets its own git worktree on its own branch.

Writing that rule down did not work, so now there are two `PreToolUse` hooks. One blocks destructive or sweeping git commands (`checkout`, `reset`, `stash`, `add`, `commit` and friends) in a shared checkout. The other blocks editing any tracked file there. A blocked message tells the agent to take a worktree and try again.

Agents also claim an issue on the tracker before starting, and check for existing worktrees and open PRs. The tracker is the coordination surface. That rule has a history: in August two agents independently picked up the same issue within the hour, and one reached an open PR before the duplication was spotted.

## Adversarial review, with a budget

Every PR gets a prosecutor: a fresh Sonnet agent whose only job is to find gaps between what the PR claims and what the code does. If it claims a blocker or a major issue, a judge on a different, stronger model rules on each finding cold. A different model matters; the one that wrote the code is generous to its own kind of mistake.

What I got wrong was assuming review converges. A 92-file PR went through three full adversarial rounds, at roughly 600,000 tokens a round, and still produced new major findings every round. That was not a sign of bad code. It was a sign of too much surface.

So review now has a budget:

- PRs capped at roughly 1,500 changed lines; larger work ships as a stack of slices.
- One prosecutor per PR by default.
- At most two fix rounds, and round two reviews only the fix diff.
- Whatever is left after that becomes an issue, not a third round.

## The costs I'd rather not have paid

I measured token spend over four weeks in August and September and found 53% went on re-sending context each turn. Fixed overhead, the instruction files and skills, was a rounding error. Fewer turns beat shorter prompts. That turned into small habits: batch shell commands into one call, slice files rather than reading them whole, and never re-run a status check to confirm something already known.

The other cost is the machine itself. My workstation also hosts the CI runners. When every implementer ran the full test suite, concurrent runs pushed the load so high that CI timed out and timing-sensitive browser tests flaked. Now implementers run lint plus the tests for the apps they touched, and CI runs the full suite once.

The supporting pieces are small: ntfy notifications to my phone when an agent needs me, remote control from a tablet over Tailscale, and a start- and end-of-shift handover protocol so a new session can resume from the repo alone.

I retired Tutto in September, when this setup replaced it as the canonical workflow.

The model is not the bottleneck any more. The rules around it are.
