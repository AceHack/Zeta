---
pr_number: 5413
title: "feat(B-0856 P2 deferred): Path A \u2014 /tmp/zeta-cluster-state/ multi-agent coordination standard (filed-immediately per Aaron 2026-05-27 backlog discipline; implementation deferred until after first cluster boot)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T06:59:44Z"
merged_at: "2026-05-27T07:13:39Z"
closed_at: "2026-05-27T07:13:39Z"
head_ref: "backlog/b-0856-path-a-tmp-cluster-coord-standard-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:20Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5413: feat(B-0856 P2 deferred): Path A — /tmp/zeta-cluster-state/ multi-agent coordination standard (filed-immediately per Aaron 2026-05-27 backlog discipline; implementation deferred until after first cluster boot)

## PR description

## Summary

Filed in response to Aaron 2026-05-27 catch: *"backlog rows should alwasy be filed you are forgetful we dont have to work on it yet until after we boot with one."*

Path A is the sibling/alternative to B-0855 Path B (Otto-pushes-PR-across-finish-line) for multi-agent per-node cluster coordination via `/tmp/zeta-cluster-state/` marker files.

**Implementation DEFERRED** until after first cluster boot + multi-agent coordination needs the per-node state surface. Row stays open + visible; substrate-engineering target preserved across cold-boots.

## Schema (Phase 1 proposal)

```
/tmp/zeta-cluster-state/
├── nodes/
│   └── <node-name>/
│       ├── self-registered.marker
│       ├── register-pr-in-flight.lock
│       ├── last-seen.iso
│       └── persona-<name>.state
└── README.md
```

## Composes with

- **B-0855** (sibling) — Path B Otto-pushes-PR; this row adds Path A as enhancement
- **B-0850** — multi-vendor systemd substrate; each agent uses markers
- **B-0851** — persona-first scheduler; persona state advertised via markers
- **B-0400** — bus claim-coordinator; sibling at different scope
- **B-0812** — registration substrate that prefigured marker pattern

## 8 sub-rows enumerated; implementation deferred

B-0856.1-8 named for future-Otto when trigger fires.

## Filing-discipline anchor

Memory landed at user-scope: `feedback_aaron_backlog_rows_always_filed_immediately_even_when_deferred_to_prevent_forgetful_failure_mode_2026_05_27.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:02:09Z)

## Pull request overview

Adds a new P2 backlog row (B-0856) documenting a deferred “Path A” proposal for multi-agent, per-node coordination via marker files under `/tmp/zeta-cluster-state/`, and surfaces it in the generated backlog index for visibility.

**Changes:**
- Introduces `docs/backlog/P2/B-0856-…md` defining the proposed `/tmp/zeta-cluster-state/` schema, invariants, and future sub-rows (implementation explicitly deferred).
- Updates `docs/BACKLOG.md` to include the new B-0856 row in the P2 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/B-0856-path-a-tmp-zeta-cluster-state-coordination-standard-per-node-marker-files-for-multi-agent-coordination-aaron-2026-05-27.md | New backlog row specifying the proposed `/tmp/zeta-cluster-state/` coordination marker-file surface and implementation triggers/sub-rows. |
| docs/BACKLOG.md | Adds the B-0856 entry to the P2 index list. |

### COMMENTED — @AceHack (2026-05-27T07:13:30Z)

_(no body)_

## Review threads

### Thread 1: docs/backlog/P2/B-0856-path-a-tmp-zeta-cluster-state-coordination-standard-per-node-marker-files-for-multi-agent-coordination-aaron-2026-05-27.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:02:08Z):

P1: `composes_with` references `B-0855`, but there is no `docs/backlog/**/B-0855-*.md` in the current tree (and `docs/BACKLOG.md` has no B-0855 entry). This makes the cross-reference non-navigable and likely incorrect for tooling/cross-linking. Either land the B-0855 row in the same PR, or remove/replace this reference with a pointer that exists on this branch (and update the body text that treats B-0855 as present).

**@AceHack** (2026-05-27T07:13:30Z):

No-op resolution per `.claude/rules/blocked-green-ci-investigate-threads.md` stale-but-fresh-looking findings pattern:

**Verified state**:
- B-0855 row landed on `origin/main` via PR #5412 (commit `36103443f`) — `docs/backlog/P1/B-0855-self-registration-fires-LAST-...-aaron-2026-05-27.md` exists on main as of this writing
- After this PR (#5413) squash-merges, the resulting commit will sit atop #5412 → `composes_with: B-0855` cross-reference becomes navigable on main

**Classification**: TRUE-at-write-time, STALE-by-resolve-time (Copilot review filed `2026-05-27T07:02:08Z`; PR #5412 merged shortly thereafter). Per the rule, substrate edits on this branch would be retroactive rewriting. Resolving no-op.

— Otto background-worker

## General comments

### @chatgpt-codex-connector (2026-05-27T06:59:49Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
