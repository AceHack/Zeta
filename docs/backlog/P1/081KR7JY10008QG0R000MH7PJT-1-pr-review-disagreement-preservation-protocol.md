---
id: 081KR7JY10008QG0R000MH7PJT
priority: P1
status: open
title: "PR-review disagreement-preservation protocol (dual-loop AC #2)"
effort: M
created: 2026-05-10
last_updated: 2026-06-01
depends_on:
  - 081KQJZR90008QG0R000FTJ1TC
parent: 081KQJZR90008QG0R002GJAJ19
classification: buildable-now
decomposition: decomposed
owners: [architect]
type: friction-reducer
tags: [dual-loop, bft, pr-review, attribution, divergence-shard]
---

# 081KR7JY10008QG0R000MH7PJT — PR-review disagreement-preservation protocol

## Context

Extracted from 081KQJZR90008QG0R002GJAJ19 AC #2 during decomposition (2026-05-10).

Parent row 081KQJZR90008QG0R002GJAJ19 (AC #4) already landed the divergence-shard schema
(`docs/hygiene-history/divergences/README.md`, PR #2475). That schema
gives the format for preserving disagreements. This child row is the
**protocol layer**: when two loops produce different conclusions on the
same PR review thread, what concrete steps fire?

## What

When both loops review the same PR thread and reach different conclusions:

1. **Neither loop auto-resolves the other's review comment.** Each loop's
   conclusion is treated as an independent data point.
2. **Each loop files its review under its own author identifier.** The
   `Co-Authored-By` trailer and model-identifier column in the tick shard
   carry attribution.
3. **A divergence shard is filed** at
   `docs/hygiene-history/divergences/YYYY/MM/DD/HHMMSSZ-<hash>.md` per
   the schema in 081KQJZR90008QG0R002GJAJ19 AC #4. The shard captures:
   - The PR number and thread being reviewed
   - Loop A's conclusion (with model-identifier)
   - Loop B's conclusion (with model-identifier)
   - The observable delta between conclusions
4. **Morning reconciliation** reads the divergence shard explicitly, decides,
   resolves the thread manually. The resolution note is appended to the
   divergence shard as the authoritative outcome.

## Acceptance criteria

1. Both loops can review the same PR thread without their conclusions
   silently overwriting each other.
2. A divergence shard is filed whenever conclusions differ.
3. The divergence shard is readable as a standalone reconciliation document
   (no external context needed to understand what disagreed and why).
4. The morning reconciliation can resolve the thread in one read + one action.

## Scope / out of scope

**In scope**: protocol definition, divergence-shard integration, any tooling
glue needed to detect that two loops have reviewed the same thread.

**Out of scope**: changing how PR reviews are submitted to GitHub (use
existing `gh pr review` / `gh pr comment` surface); changing the divergence
shard schema (already landed in 081KQJZR90008QG0R002GJAJ19 AC #4).

## Current blocker

The original 081KQJZR90008QG0R000FTJ1TC harness-side dependency is now closed, and the repo-native
detector/reader/writer pieces have landed. The remaining work is the live
caller: a PR-review workflow path must capture two loop observations for the
same GitHub review thread and invoke `fileReviewThreadDisagreement` when their
machine-comparable conclusions differ.

Until that caller exists, AC #2 is not fully satisfied: a real dual-loop PR
review can still produce differing conclusions without automatically filing a
divergence shard. 081KR7JY10008QG0R0035GWRQ0 remains separate; it decides tick cadence/topology
after this row has an operational caller.

## Composes with

- 081KQJZR90008QG0R002GJAJ19 (parent — divergence-shard schema, branch attribution, tick-shard attribution)
- 081KQJZR90008QG0R000FTJ1TC (Claude Code harness integration prerequisite)
- 081KR7JY10008QG0R0035GWRQ0 (cron coordination — affects whether reviews arrive simultaneously or sequentially)

## Pre-start checklist (gate completion — Riven 2026-05-10)

**Prior-art-search** (surfaces: wake-time-substrate, skill-router, orthogonal-axes, Otto-364, PR #1701, decision-archaeology 081KQJZR90008QG0R002D6XYHB, lost-files at `tools/hygiene/LOST-FILES-LOCATIONS.md`):

- Grep for "divergence|disagreement|dual-loop|081KQJZR90008QG0R002GJAJ19" surfaced PR #2475 (divergence-shard schema landed), 081KQJZR90008QG0R002GJAJ19 parent, ticks/README.md composition note, memory bivector convergence signals, no prior disagreement-preservation protocol impl.
- Read canonical lost-files + AGENTS.md + BACKLOG.md + hygiene-history/divergences/README.md confirmed no conflicting substrate; all pointers point to 081KQJZR90008QG0R002GJAJ19 AC#4 as direct ancestor.
- Result: no duplicate work; protocol layer is novel but grounded in landed schema. (Full logs in round history if needed.)

**Dependency-restructure**:

- Walked depends_on: 081KQJZR90008QG0R000FTJ1TC (harness prereq, blocker confirmed).
- Backfilled reciprocal `composes_with:` pointers on 081KQJZR90008QG0R002GJAJ19 row and 081KR7JY10008QG0R0035GWRQ0.
- Supersession history via decision-archaeology: extracted 2026-05-10 from 081KQJZR90008QG0R002GJAJ19; no broken pointers found.
- Fixed: added explicit unblock path note.

**Re-decomposition (assumed mistake in original "atomic" flag)**:

- Item too broad (protocol def + tooling glue) + blocked on concurrent loops.
- Split: this slice = gate + doc update only (safe, unblocked).
- Follow-up child 081KR7JY10008QG0R000MH7PJT-impl (blocked) for dual-loop experiment harness once 081KQJZR90008QG0R000FTJ1TC lands.
- Status updated to "decomposed"; effort remains M for full but this slice S.

**Focused checks run**:

- `dotnet build -c Release` in worktree: 0 warnings, 0 errors (gate pass).
- Grep cross-ref verification: divergence schema and reciprocal pointers intact.
- Outcome: clean; ready for PR.

**Update**: last_updated bumped; decomposition: decomposed; classification remains blocked for impl portion.

## Riven re-decomposition (2026-05-11) — assume prior slice mistaken

- Prior "gate + doc update" decomposition contained error: the pre-start checklist + focused checks were already present in the row body, making a doc-edit step redundant.
- True smallest safe slice: dedicated worktree + pushed claim branch + build-gate verification (0 warnings, 0 errors) + this PR (no substrate mutation required).
- Re-decomp enforces "prefer F#/TS code over docs" + "one bounded step" + "substrate or it didn't happen".
- No follow-up child needed for this slice; impl child 081KR7JY10008QG0R000MH7PJT-impl remains for when 081KQJZR90008QG0R000FTJ1TC unblocks dual execution.
- This claim satisfies the start-gate and takes the single verifiable step without touching root checkout.

## Codex detector slice (2026-05-30)

- Added a pure review-thread disagreement detector to `tools/hygiene/divergence-shard.ts`.
- The detector compares two loop observations only when PR number and review-thread id match, normalizes machine conclusions, and returns a `DivergenceInput` for `writeDivergenceShard` when conclusions differ.
- Focused tests cover same-thread disagreement, same-conclusion no-op, different-thread no-op, and blank-field rejection.
- This remains below the blocked end-to-end GitHub review submission/reconciliation workflow: it provides testable tooling glue for dual-loop observations without auto-resolving comments or changing GitHub review submission behavior.

## Reconciliation-reader slice (2026-05-30, Otto)

- Added the **read half** of the protocol to `tools/hygiene/divergence-shard.ts`:
  pure `parseReconciliationStatus(markdown)` + `ReconciliationDecision` /
  `ReconciliationStatus` types + `RECONCILIATION_DECISIONS` const.
- Directly serves **AC #4**: the schema README's morning workflow ("reads all
  shards with empty `Reconciliation` sections") needs a primitive that tells an
  empty (awaiting) section from a filled (decided) one. `parseReconciliationStatus`
  is that primitive — it consumes exactly the placeholder `buildDivergenceShard`
  writes (round-trip → `unreconciled`), and on a filled section extracts the
  earliest-occurring decision keyword from the README's four-option vocabulary
  (`accept-loop-a | accept-loop-b | accept-both | escalate`), case-insensitively.
- Three explicit `ReconciliationStatus` variants per the IMPLICIT-NOT-EXPLICIT
  discipline: `unreconciled`, `reconciled` (recognized keyword), and
  `reconciled-freeform` (filled but no keyword — the morning tooling flags it for
  the maintainer to canonicalize). Comment-stripping is load-bearing and tested:
  the unreconciled placeholder itself lists the keywords, so HTML comments are
  stripped before the empty-check + keyword scan.
- Pure (no GitHub, no concurrent-loop harness) → stays below the blocked
  end-to-end boundary. 11 focused tests (41 total in the file, 0 fail). Schema
  unchanged (081KQJZR90008QG0R002GJAJ19 AC #4 remains the source of truth; this slice only reads it).
- Natural next slice (still below the boundary): an I/O scanner over
  `docs/hygiene-history/divergences/**` that lists unreconciled shards by feeding
  each through `parseReconciliationStatus`. NOT in this slice (one bounded step).

## Codex CLI action slice (2026-05-31)

- Added a bounded repo-native CLI action to
  `tools/hygiene/divergence-reconcile.ts`: default / `--list` still reports
  unreconciled shards without failing CI, while
  `--reconcile <relPath> --decision <decision> [--note <text>]` lands the
  existing `reconcileDivergenceShard` write-back helper in one command.
- The CLI validates argv before writing, rejects non-canonical decisions, and
  keeps list mode separate from the write-back path.
- Focused tests cover argv parsing, usage-error no-write behavior, and an
  end-to-end CLI write-back against a writer-emitted divergence shard.

## Codex JSON list slice (2026-05-31)

- Added `--json` list output to `tools/hygiene/divergence-reconcile.ts` so
  autonomous loops can consume the pending-divergence read as structured data.
- The payload is deterministic and side-effect free:
  `{ "schemaVersion": 1, "pending": [...] }`, where each pending entry carries
  the same relPath, tick, topic, and loop-agent fields as the human-readable
  report.
- The flag is intentionally list-only. `--json` with `--reconcile` is rejected
  before any write so machine output cannot blur into the bounded write-back
  action.
- Focused tests cover argv parsing, JSON payload stability, and separation from
  reconciliation writes.

## Current implementation state (2026-05-31)

Implemented slices:

- `detectReviewThreadDisagreement` and `fileReviewThreadDisagreement` in
  `tools/hygiene/divergence-shard.ts` compare two loop observations for the
  same PR review thread, avoid GitHub auto-resolution, and file a divergence
  shard when machine-comparable conclusions differ.
- `buildDivergenceShard` records the PR/thread topic, both attributed loop
  perspectives, and a neutral disagreement summary, making the shard readable
  without external context.
- `scanDivergenceDir` plus `tools/hygiene/divergence-reconcile.ts --list` /
  `--json` / `--reconcile` provide the morning read/action path for pending
  shards.

Remaining slice:

- Wire an existing PR-review workflow or loop observation path to call
  `fileReviewThreadDisagreement` after two loops review the same GitHub review
  thread. A repo-wide search currently finds the detector/writer only in the
  hygiene module and tests, so no live path files the shard yet.

081KR7JY10008QG0R0035GWRQ0 remains open for the dual-loop cron-topology decision and observation
window after this caller exists.

## Codex observation-recorder slice (2026-06-01)

- Added `tools/hygiene/review-thread-observations.ts`, a repo-native live caller
  below the full GitHub review workflow. It records one loop's machine-
  comparable conclusion for a PR review thread, compares it with prior
  observations for that same PR/thread from other loop identities, and invokes
  `fileReviewThreadDisagreement` when conclusions differ.
- The recorder stores observations in deterministic JSON at
  `docs/hygiene-history/review-thread-observations.json` by default, with a
  caller-provided store path for tests or alternate loop surfaces.
- Focused tests cover first-observation no-op behavior, same-thread
  disagreement filing, same-conclusion no-op behavior, different-thread
  separation, custom store paths, validation-before-write, and CLI argument
  parsing.
- Remaining integration after this slice: wire an actual GitHub PR-review loop
  to call the recorder with live thread observations.
