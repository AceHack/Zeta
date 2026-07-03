---
pr_number: 5070
title: "backlog(081KSE6WT0008QG0R000TMNCVS): agent-on-agent Claude Code session recovery \u2014 lift operator-runs gate once safety substrate stronger than classifier"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T02:39:39Z"
merged_at: "2026-05-26T02:45:18Z"
closed_at: "2026-05-26T02:45:18Z"
head_ref: "otto-cli/b0788-agent-on-agent-session-recovery-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:32Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5070: backlog(081KSE6WT0008QG0R000TMNCVS): agent-on-agent Claude Code session recovery — lift operator-runs gate once safety substrate stronger than classifier

## PR description

## Summary

Files 081KSE6WT0008QG0R000TMNCVS — the P3 deferred row capturing the eventual-state
design for cross-agent Claude Code session recovery without a
human in the loop. Composes with PR #5069 (which shipped the
operator-runs interim).

Aaron 2026-05-26 explicit authorization: *"this is something we
can allow other agents to run on each other even tually so we
need no human operator"* + agreed with the composed design.

## Why deferred

All three lift criteria from `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` must hold first:

1. Zeta safety substrate on `.jsonl` edits stronger than the Anthropic classifier
2. Knights Guild ratification (per 081KRW63S0008QG0R003TX8MG5)
3. Maintainer-collective re-authorization after substrate is in place

None are met today; row tracks the design so it's not lost.

## Eventual shape (3 components)

- **settings.json `_session_recovery_acceptance` block** (four-field attribution per `human-audit-and-legal-risk-acceptance-pattern-in-settings.md`)
- **`session-recovery-request` bus envelope topic** for inter-Otto coordination
- **Recovery audit log** (DV2.0 hub-satellite shape — `recovery-event` hub + `recovery-strip-detail` satellite)

Full design in the row body.

## Test plan

- [x] 081KSE6WT0008QG0R000TMNCVS ID free on origin/main (highest claimed: 081KSE6WT0008QG0R000FN7TVJ in-flight via PR #5068)
- [x] BACKLOG.md regenerated via `bun tools/backlog/generate-index.ts`
- [x] Row follows P3 frontmatter convention (id/title/status/priority/size/created/authors/composes_with/depends_on/labels)
- [x] `composes_with` populated with 081KRW63S0008QG0R003TX8MG5 + 081KRW63S0008QG0R001Z7NYMV; `depends_on` left empty (no specific row to point at for "stronger than classifier" criterion yet)
- [x] Row body lists premature-action risks so the deferral is substrate-honest

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:42:10Z)

## Pull request overview

Adds a new P3 backlog row (081KSE6WT0008QG0R000TMNCVS) documenting the *deferred* eventual-state design for agent-on-agent Claude Code session recovery (lifting the operator-runs gate only after explicit safety-substrate lift criteria are met), and refreshes the generated backlog index accordingly.

**Changes:**

- Added `docs/backlog/P3/081KSE6WT0008QG0R000TMNCVS-…` capturing lift criteria + 3-component eventual design (settings acceptance, bus envelope, audit log).
- Regenerated `docs/BACKLOG.md` to include the new row (and any newly discovered P3 rows in that range).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/081KSE6WT0008QG0R000TMNCVS-agent-on-agent-claude-code-session-recovery-lift-operator-runs-gate-once-zeta-safety-substrate-stronger-than-classifier-2026-05-25.md | New P3 backlog row documenting deferred design + lift criteria for agent-on-agent session recovery. |
| docs/BACKLOG.md | Updated generated index to include 081KSE6WT0008QG0R000TMNCVS (and surrounding P3 rows). |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:45:26Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/backlog/P3/081KSE6WT0008QG0R000TMNCVS-agent-on-agent-claude-code-session-recovery-lift-operator-runs-gate-once-zeta-safety-substrate-stronger-than-classifier-2026-05-25.md:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:42:10Z):

`tools/backlog/README.md` documents `last_updated` as a required frontmatter field (and used to track edits). This row is missing it; for a new row it should generally match `created` until the next edit.

### Thread 2: docs/backlog/P3/081KSE6WT0008QG0R000TMNCVS-agent-on-agent-claude-code-session-recovery-lift-operator-runs-gate-once-zeta-safety-substrate-stronger-than-classifier-2026-05-25.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:42:10Z):

The row body repeatedly describes this as deferred until lift criteria are met (e.g., “this row stays in P3 deferred state”), but the frontmatter `status` is `open`. Consider aligning the frontmatter to match the semantics (e.g., `status: deferred`) or adjusting the prose if `open` is intentional.

### Thread 3: docs/backlog/P3/081KSE6WT0008QG0R000TMNCVS-agent-on-agent-claude-code-session-recovery-lift-operator-runs-gate-once-zeta-safety-substrate-stronger-than-classifier-2026-05-25.md:9 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:45:26Z):

`last_updated` should reflect the most recent content edit date. The row body references events on 2026-05-26 (e.g., PR #5069 merge time and the 2026-05-26 authorization), so leaving `last_updated: 2026-05-25` violates the per-row backlog convention that `last_updated` is updated on every content edit.

## General comments

### @chatgpt-codex-connector (2026-05-26T02:39:42Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
