---
pr_number: 4795
title: "backlog(081KSBMG30008QG0R003B46GWG): file Soraya round-57 hand-off \u2014 LSM Spine registry-rows + BP-16 cross-check pair"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T00:14:59Z"
merged_at: "2026-05-24T00:20:46Z"
closed_at: "2026-05-24T00:20:46Z"
head_ref: "otto/soraya-round57-b0717-lsm-spine-registry-and-bp16-pair-2026-05-24"
base_ref: "main"
archived_at: "2026-05-24T14:25:27Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4795: backlog(081KSBMG30008QG0R003B46GWG): file Soraya round-57 hand-off — LSM Spine registry-rows + BP-16 cross-check pair

## PR description

## Summary

Soraya autonomous round 57 — re-engagement trigger fired (PR #4791 / 081KS923C0008QG0R0009JFVSE MERGED at 00:06:45Z).

**Two bounded subitems** under existing 081KS923C0008QG0R0032VJZPF umbrella:

### Subitem (a) — Registry-row capture for 3 LSM Spine specs

Mechanical follow-up to 081KS923C0008QG0R0009JFVSE (which corrected the enumeration but did NOT execute the registry-row authoring). `verification-registry.md` still has **zero `Spine` matches**.

| Spec | Property class | Tool |
|---|---|---|
| `Spine.als` | Structural shape (LSM levels, sorted runs, no-cycles) | Alloy |
| `SpineAsyncProtocol.tla` | State-machine safety + concurrency | TLA+ |
| `SpineMergeInvariants.tla` | State-machine safety invariant | TLA+ |

### Subitem (b) — BP-16 cross-check on SpineAsyncProtocol (candidate-P0)

**Wrong-tool cost** if stays single-tool TLA+: classic TLA+/code-drift — spec passes TLC but no longer constrains real F# code under implementation evolution. **Silent data corruption shape** on async compaction interleavings.

Acceptance: FsCheck property file `tests/Tests.FSharp/Algebra/Spine.AsyncProtocol.Properties.fs` (mirrors PR #4780's residuated-lattice analog shape — just shipped 980/980) exercising real `Spine` F# implementation under simulated async flush/compact interleavings.

## TLA+-hammer guard

INVERSE direction. TLA+ IS right primary; FsCheck pair CLOSES the code-drift class specifically. Neither alone suffices for candidate-P0.

## Effort

S each (~M total). Subitem (a) routinely; subitem (b) one evening. Assignee: kenji.

## Policy-flip authorization

Per Aaron's 2026-05-23 21:30Z direction: Otto auto-ships Soraya findings immediately. Re-engagement trigger explicitly named by Soraya rounds 54+55+56 has fired.

## Test plan

- [ ] CI green (lint + backlog-index-integrity)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T00:17:26Z)

## Pull request overview

This PR files a new backlog row (081KSBMG30008QG0R003B46GWG) capturing a formal-verification hand-off: registering the LSM “Spine” spec cluster in the verification registry and adding a BP-16 cross-check pairing request (TLA+ spec + FsCheck properties) to reduce TLA+/implementation drift risk.

**Changes:**
- Added new backlog row file `081KSBMG30008QG0R003B46GWG` under `docs/backlog/P2/` describing the Spine registry-row work + BP-16 cross-check pairing acceptance criteria.
- Updated `docs/BACKLOG.md` to include new index entries (including 081KSBMG30008QG0R003B46GWG).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSBMG30008QG0R003B46GWG-soraya-round57-lsm-spine-registry-and-bp16-cross-check-pair-2026-05-24.md | New P2 backlog row describing Spine registry-row capture and BP-16 paired-tool cross-check request. |
| docs/BACKLOG.md | Backlog index updated to reference 081KSBMG30008QG0R003B46GWG (and also adds a 081KRSKQ20008QG0R00367828S entry). |

## Review threads

### Thread 1: docs/BACKLOG.md:667 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T00:17:25Z):

The new BACKLOG entry for 081KRSKQ20008QG0R00367828S links to `backlog/P2/081KRSKQ20008QG0R00367828S-soraya-continuous-loop-substrate-with-bus-escalation-2026-05-17.md`, but there is no corresponding per-row file under `docs/backlog/` (search for `id: 081KRSKQ20008QG0R00367828S` returns no matches). This leaves a broken link and will likely fail the backlog index integrity gate; either add the missing row file or remove this line and regenerate `docs/BACKLOG.md` from the row files (`tools/backlog/generate-index.sh`).

### Thread 2: docs/backlog/P2/081KSBMG30008QG0R003B46GWG-soraya-round57-lsm-spine-registry-and-bp16-cross-check-pair-2026-05-24.md:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T00:17:26Z):

The per-spec routing table is malformed (rows start with `||`), so it won’t render as a proper markdown table. Use a standard table format with a single leading `|` per row (and keep the header separator aligned) so readers and markdown tooling parse it correctly.
