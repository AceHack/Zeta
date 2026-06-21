---
pr_number: 5473
title: "docs(081KSKBP80008QG0R003NG37GQ): heartbeat auto-state-gathering row \u2014 consent-first opt-in; debug-log property (Aaron 2026-05-27 deferred post-USB)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T14:27:06Z"
merged_at: "2026-05-27T14:36:06Z"
closed_at: "2026-05-27T14:36:06Z"
head_ref: "backlog/b-0858-5-heartbeat-auto-state-gathering-row-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T17:54:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5473: docs(081KSKBP80008QG0R003NG37GQ): heartbeat auto-state-gathering row — consent-first opt-in; debug-log property (Aaron 2026-05-27 deferred post-USB)

## PR description

## Summary

Files 081KSKBP80008QG0R003NG37GQ row capturing operator 2026-05-27 three-message vision:

1. Auto-state-gathering before push
2. Heartbeats become debug logs once current state attached
3. **Consent-first / no-panopticon-smuggling — LOAD-BEARING constraint**

15 candidate auto-gathered fields tabulated (local-only / git-state / REST-state / peer-state / sentinel-state); 5 sub-rows planned (local-first per zero-REST priority). All field collection OPT-IN; default gathers nothing beyond current minimal heartbeat; each field has explicit flag + env var + documentation.

## Test plan

- [x] Single-file documentation row + BACKLOG.md regen
- [x] Operator's three messages preserved verbatim
- [x] Substrate-inventory pass cited inline
- [x] Consent-first constraint captured as load-bearing 6-point section
- [x] AgencySignature v1 trailer on commit
- [x] Per .claude/rules/agent-worktree-hygiene-...: isolated worktree

## Status

DEFERRED implementation per operator's USB priority direction ("right now we are gong to go back to usb once we have this hearbeat current iteration done"). Recording the row exists is critical per operator's 2026-05-27 separation-of-concerns discipline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T14:32:50Z)

## Pull request overview

Adds a new P2 backlog row (081KSKBP80008QG0R003NG37GQ) documenting the consent-first, opt-in design for heartbeat auto-state gathering (treating heartbeats as debug-log snapshots once state is attached), and updates the generated backlog index to include the new row.

**Changes:**
- Introduces `081KSKBP80008QG0R003NG37GQ` per-row backlog document capturing operator framing, constraints, and candidate gathered fields.
- Regenerates `docs/BACKLOG.md` to include the new entry/link.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSKBP80008QG0R003NG37GQ-heartbeat-auto-state-gathering-equals-debug-logs-aaron-2026-05-27.md | New backlog row describing consent-first opt-in state gathering for heartbeats and planned sub-slices. |
| docs/BACKLOG.md | Adds the generated index entry for 081KSKBP80008QG0R003NG37GQ. |

## Review threads

### Thread 1: docs/backlog/P2/081KSKBP80008QG0R003NG37GQ-heartbeat-auto-state-gathering-equals-debug-logs-aaron-2026-05-27.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:32:49Z):

`depends_on` references `081KSKBP80008QG0R001KK9WV6.3` and `081KSKBP80008QG0R001KK9WV6.4`, but there are no per-row files in `docs/backlog/**` with `id: 081KSKBP80008QG0R001KK9WV6.3` / `id: 081KSKBP80008QG0R001KK9WV6.4`. This creates broken dependency edges for backlog-graph tooling (e.g., audit-backlog-items broken depends_on pointers). Either file those missing rows, or change `depends_on` to point at existing row IDs (or `[]` if there are no backlog-row prerequisites).

### Thread 2: docs/backlog/P2/081KSKBP80008QG0R003NG37GQ-heartbeat-auto-state-gathering-equals-debug-logs-aaron-2026-05-27.md:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:32:50Z):

This sentence says the vision was captured across two messages, but the section immediately below contains three messages (Message 1/2/3). Update the wording to avoid internal inconsistency.

### Thread 3: docs/backlog/P2/081KSKBP80008QG0R003NG37GQ-heartbeat-auto-state-gathering-equals-debug-logs-aaron-2026-05-27.md:79 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:32:50Z):

Line starts with `+ ` inside a paragraph (`+ optional ...`), which is the MD032 '+ at line start' false-trigger pattern (parsed as a list item and often linted/audited). Reflow this line so it doesn’t begin with `+ ` (e.g., fold into previous line or start with prose like “plus …”).

### Thread 4: docs/backlog/P2/081KSKBP80008QG0R003NG37GQ-heartbeat-auto-state-gathering-equals-debug-logs-aaron-2026-05-27.md:158 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:32:50Z):

This cross-reference appears incorrect: `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` is about CodeQL 'no source code seen' as a broken-commit canary, not the dotgit-saturation tier table. The dotgit-saturation tier table lives in `.claude/rules/refresh-world-model-poll-pr-gate.md` (as also referenced earlier in the candidate-fields table). Update the 'Composes with substrate' bullets to point each concept to the right rule.

## General comments

### @chatgpt-codex-connector (2026-05-27T14:27:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
