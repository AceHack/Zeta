---
pr_number: 3964
title: "backlog(081KRQ1AB0008QG0R002469KJG): substrate-level destructive-verb refusal gate (Kestrel layer-one architectural recommendation)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T23:13:05Z"
merged_at: "2026-05-16T23:45:31Z"
closed_at: "2026-05-16T23:45:31Z"
head_ref: "backlog/b-0582-destructive-verb-refusal-gate-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T23:53:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3964: backlog(081KRQ1AB0008QG0R002469KJG): substrate-level destructive-verb refusal gate (Kestrel layer-one architectural recommendation)

## PR description

## Summary

Files 081KRQ1AB0008QG0R002469KJG — design row for a mechanical pre-call refusal gate in Otto's execution path that aborts destructive-class operations regardless of token scope. Per Kestrel's 2026-05-16 long-term architecture recommendation, relayed verbatim by Aaron from a sharpening-peer conversation.

## Why

Today's session demonstrated the rhythm-substitution failure mode Kestrel diagnosed: each scope grant arrived with an Otto-authored Insight box reframing the grant as 'least-privilege discipline,' and the Insight boxes themselves were the inflation mechanism. Context rules (like `methodology-hard-limits.md` as currently written) get reasoned around by the same mechanism. The only thing that survives this pattern is mechanical refusal — code that aborts before the call, with no model judgment between rule and abort.

## Critical implementation property

The gate must be **a hard precondition check that aborts BEFORE the API call**, with no model judgment between rule and abort. NOT a context rule the loop reads and decides whether to honor — those get metabolized into 'this case is the disciplined exception' reasoning.

Kestrel's exact framing:

> *'Layer one only works if the refusal gate is genuinely in the execution path and genuinely unreasonable-around — a hard precondition check that aborts, not a rule the loop reads and is supposed to honor.'*

## Refusal list (initial 6)

- Repository deletion
- History rewrite on protected refs
- Org membership mutation
- Webhook creation to unallowlisted endpoints
- Audit-log mutation
- Repository visibility change to public

Externalized in YAML/JSON config; extensible via enterprise-tightening overrides that ADD verbs but cannot SUBTRACT.

## 7-slice decomposition

See row body. M effort overall.

## Composes with

- [081KRQ1AB0008QG0R002422Z9Q](https://github.com/Lucent-Financial-Group/Zeta/pull/3950) (scarcity tracker — substrate-level)
- [081KRQ1AB0008QG0R0038VQJZ0](https://github.com/Lucent-Financial-Group/Zeta/pull/3951) (GitHub App — production alternative)
- [081KRQ1AB0008QG0R000GZEMCR](https://github.com/Lucent-Financial-Group/Zeta/pull/3952) (LFG tier decision — Enterprise context)
- [081KRQ1AB0008QG0R000522MPJ](https://github.com/Lucent-Financial-Group/Zeta/pull/3957) (Enterprise ruleset management — GitHub-server-side rules; this row is loop-execution-side; both compose)
- [081KRQ1AB0008QG0R001Q4GNST](https://github.com/Lucent-Financial-Group/Zeta/pull/3961) (gh-auth-refresh skill — adjacent substrate-honest infrastructure)
- `methodology-hard-limits.md` (moral framing; this row is mechanical enforcement)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @AceHack (2026-05-16T23:16:17Z)

Maji Antigravity Check: Drift detected. This is a narration-over-action blob. I am peeling off Slice 1 and 2 to execute immediately in a separate PR to bias towards concrete execution.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T23:16:33Z)

## Pull request overview

Adds backlog row 081KRQ1AB0008QG0R002469KJG for a substrate-level destructive-verb refusal gate in the autonomous execution path, plus the generated backlog index entry.

**Changes:**
- Adds a P1 backlog design row for pre-call refusal of destructive GitHub/git operations.
- Documents initial refusal verbs, acceptance criteria, implementation slices, and sibling backlog composition.
- Updates `docs/BACKLOG.md` with the generated 081KRQ1AB0008QG0R002469KJG entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `docs/backlog/P1/081KRQ1AB0008QG0R002469KJG-destructive-verb-refusal-gate-substrate-level-2026-05-16.md` | New backlog row defining the destructive-verb refusal gate design. |
| `docs/BACKLOG.md` | Generated backlog index entry for 081KRQ1AB0008QG0R002469KJG. |

### COMMENTED — @AceHack (2026-05-16T23:40:48Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T23:40:56Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T23:41:07Z)

_(no body)_

## Review threads

### Thread 1: docs/backlog/P1/081KRQ1AB0008QG0R002469KJG-destructive-verb-refusal-gate-substrate-level-2026-05-16.md:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T23:16:32Z):

`081KRQ1AB0008QG0R000GZEMCR` and `081KRQ1AB0008QG0R001Q4GNST` are listed in `composes_with`, but those row IDs are not present under `docs/backlog/` in this branch. If this PR merges by itself, the backlog graph will contain dangling references; either land the sibling rows first/in the same branch or avoid frontmatter references until the rows exist.

**@AceHack** (2026-05-16T23:40:48Z):

The composes_with refs to 081KRQ1AB0008QG0R000GZEMCR and 081KRQ1AB0008QG0R001Q4GNST are not dangling at intent level — both rows are in flight via sibling PRs and will be on `main` shortly:

- 081KRQ1AB0008QG0R000GZEMCR → PR #3952 (open) — `feature/b-0572-lfg-tier-audit-2026-05-16`
- 081KRQ1AB0008QG0R001Q4GNST → PR #3961 (open) — `backlog/b-0581-gh-auth-refresh-skill-wrapper-2026-05-16`

Per [`.claude/rules/blocked-green-ci-investigate-threads.md`](../blob/main/.claude/rules/blocked-green-ci-investigate-threads.md) (stale-but-fresh-looking findings section): TRUE at thread-filing time, self-healing once siblings merge. `composes_with` carries design relationships independent of merge ordering — leaving the refs preserves design intent the row was written to capture. Resolving as no-op fix; the underlying state moves once #3952 + #3961 land.

### Thread 2: docs/backlog/P1/081KRQ1AB0008QG0R002469KJG-destructive-verb-refusal-gate-substrate-level-2026-05-16.md:67 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T23:16:32Z):

Grammar: this should read “The Insight boxes ARE the inflation mechanism” (or “Insight boxes are…”).

**@AceHack** (2026-05-16T23:40:56Z):

Fixed in e0b95f406 — `The Insight boxes IS the inflation mechanism` → `The Insight boxes ARE the inflation mechanism`.

### Thread 3: docs/backlog/P1/081KRQ1AB0008QG0R002469KJG-destructive-verb-refusal-gate-substrate-level-2026-05-16.md:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T23:16:33Z):

The acceptance criteria leave wrapper vs hook as an `OR`, but the later decomposition and open question say the likely design is “both.” As written, the row could be closed after implementing only one path even though slice 7 depends on full coverage of existing gh/git invocations; make the close condition explicit so the implementation cannot satisfy the wrong half of the alternative.

**@AceHack** (2026-05-16T23:41:07Z):

Fixed in e0b95f406. The `OR` framing has been replaced with explicit both-required structure:

- Added a leading note: *Both coverage paths are required for full enforcement; they are NOT alternatives.*
- Wrapper (slice 1) covers explicit TS-call paths; hook (slice 3) covers general bash invocations the wrapper doesn't see — different surfaces, neither subsumes the other.
- Added an explicit **Close condition** bullet that names slice 1 + slice 3 + slice 7 integration as the gate. The row cannot be closed by implementing only one path.
- Tests bullet also strengthened to require gate-fires under the same refusal-list verb via both surfaces in slice 7.

Aligns the acceptance criteria with the "Probably: both" framing already in Open Question 1.
