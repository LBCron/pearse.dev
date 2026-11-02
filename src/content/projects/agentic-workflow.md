---
title: Agentic engineering workflow
slug: agentic-workflow
oneLiner: A Claude Code harness for a one-person, many-agent team — worktree isolation enforced by hooks, model routing by issue size, adversarial PR review and a shift handover protocol.
description: "A Claude Code harness for a one-person, many-agent team: worktree isolation enforced by hooks, model routing by issue size and adversarial PR review."
period: Jul 2026 – Present
role: Designer and operator
stack:
  - Claude Code
  - git worktrees
  - Bash hooks
  - GitHub CLI
  - ntfy
  - Tailscale
featured: false
order: 10
features:
  - One planning session, cheaper delegate agents chosen by issue size, each in its own git worktree.
  - PreToolUse hooks that block destructive git commands and writes in a shared checkout.
  - Adversarial PR review — a prosecutor model argues against the change, a judge from a different model family rules.
  - Risk classification, phone notifications, and remote control from a tablet.
  - Start- and end-of-shift handover protocols so the next session rebuilds context from the repo alone.
  - Around 30 custom skills. Tutto, an earlier headless orchestrator with auto-merge under a deterministic risk policy, was retired in favour of this lighter design.
hooks:
  - Measured token spend over 28 days — 53% was context resend, so the workflow was redesigned around fewer turns, not shorter prompts.
  - A PR size cap and a review budget, after a 92-file PR showed that review surface does not converge no matter how many rounds you run.
visibility: private
category: tool
diagram: AgenticWorkflow
---

Everything on this site from mid-2026 onwards was built with agents, under review. This is the harness that made that safe enough to do every day: hooks that make the dangerous commands impossible in the wrong place, a tracker that is the only coordination surface, and a review process that assumes the author is wrong until proven otherwise.

The honest version is that most of the design came from failures — two agents picking up the same issue within an hour, a review loop that found two new majors every round, a suite that ran four times per PR and took the CI runners down with it. Each one became a rule.
