# Backlog-item start gate — proof required before starting

Carved sentence:

> Proof of prior-art-search + dependency-restructure is REQUIRED
> before starting any backlog item. Update the row with proof;
> then start.

## Operational content

Before beginning work on any `docs/backlog/P*/B-*.md` row,
complete a checklist directly on the row body:

0. **Substrate-drift discriminator** (~3 seconds; catches the
   "row says open but the work already shipped" pattern):
   - Read the row's **Acceptance** / **Proposed mechanization** /
     **Scope** sections (NOT `composes_with:` cross-refs — those
     are false-positive prone per the empirical catalog in
     [081KRQ1AB0008QG0R000QYJFZE](../../docs/backlog/P3/081KRQ1AB0008QG0R000QYJFZE-audit-backlog-status-drift-detection-2026-05-16.md))
   - Existence-check every primary-artifact path on disk
   - **If all primary artifacts exist AND every acceptance bullet
     has a corresponding merged PR** → row is drift, not work.
     Release the claim, open a close-row PR (`status: open` → `closed`
     + Resolution section + `BACKLOG_WRITE_FORCE=1 bun
     tools/backlog/generate-index.ts` regen). Skip the remaining
     gate steps.
   - **If artifacts exist but some acceptance bullets are
     pending** → row is in-progress, NOT drift. Leave it open,
     proceed with normal gate steps. (Canonical example: 081KRMEXM0008QG0R0034SS319 —
     `audit-memory-index-entry-lengths.ts` shipped, but the row's
     "cleanup of 100 long entries + CI gate at --max 150" had
     not. Closing it would have hidden in-progress work.)
   - **If artifacts missing** → proceed with the gate steps below.

   Full reasoning + 4-catch empirical evidence + section-aware
   parsing rationale in
   [`memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md`](../../memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md).

1. **Prior-art-search** across the existing axes:
   wake-time-substrate + skill-router + orthogonal-axes +
   Otto-364 + PR #1701 + decision-archaeology + lost-files
   canonical at `tools/hygiene/LOST-FILES-LOCATIONS.md` + **the
   curated external prior-art surface at `references/prior-art/`**
   (humans who've solved similar problems; mix of cutting-edge
   and tried-and-true; prefer explicit-target subtree searches
   like `rg "pattern" references/prior-art/postgres/` for focused
   prior-art research; `rg` from repo root is also safe — it
   respects `.gitignore` and `references/prior-art/*` is gitignored
   — but explicit-target is recommended because it documents
   which upstream(s) you actually consulted on the backlog row;
   see `.claude/rules/references-prior-art-not-our-code-search-excludes.md`
   for the full two-modes table and the plain-grep caveats).
   The watchlist + category index lives at `docs/PRIOR-ART-LIST.md`;
   the synthesis notes at `references/notes/`.
   Log surfaces searched, queries used, results found on the row.

2. **Dependency-restructure**:
   - Walk `depends_on:` chain.
   - Backfill reciprocal `composes_with:` pointers.
   - Reconstruct supersession history via decision-archaeology
     procedure (081KQJZR90008QG0R002D6XYHB P1).
   - Fix broken pointers.

3. **Update the row** with a "Pre-start checklist" section
   containing the proof before any code/substrate work begins.

This gate catches the failure modes the seven-rule cascade
lineage was designed to catch — at the *start of work* scope
rather than the *substrate-landing* scope.

## Orphaned-branch triage discriminator (generalizes step 0 to branch scope)

Fires when a fresh-cold-boot session inherits an orphaned feature
branch (substantive unmerged commits + no associated PR + days/weeks
of peer-agent activity since the branch was last touched).

The substrate-honest insight: peer agents (Lior preservation passes,
peer Otto rescues, decompose-into-slices patterns) often rescue
stranded substrate via separate PRs before a slow-cold-boot Otto
finds the orphaned branch. Assuming re-landing without verification
produces duplicate substrate, substrate regression (re-applying stale
commits OVER newer-on-main work), and wasted operator review.

Procedure per orphaned commit `<sha>`:

- `git log --oneline origin/main --grep="<key terms from commit message>"`
  — does main carry a rescue PR for this substrate?
- `git show --name-only --format="" <sha> | head -1` — pick the first
  file the commit touched
- `git diff origin/main..<sha> -- "<that file>"` — count lines

Interpretation:
`0 lines` = substrate identical; fully rescued; no re-landing needed
(e.g., `f0abf3ed` HC-8 NCI was rescued by
[PR #4205](https://github.com/Lucent-Financial-Group/Zeta/pull/4205)).
`20–50 lines` = partial drift; substrate evolved on main; cell-by-cell
triage needed; the on-main version is usually preferred unless the
orphaned content carries genuine deltas.
`hundreds of lines` = genuine substrate not yet on main; cherry-pick
worth considering (with operator awareness, since orphaned-branch
context may have been superseded by newer architectural decisions).

**Special-case guard — runtime scripts**: when an orphaned commit
modifies a runtime substrate file (e.g., `.gemini/bin/lior-loop-tick.ts`,
peer-agent loop tick scripts, install-graph files in `tools/setup/`),
DO NOT re-apply without explicit operator awareness even if `git diff`
shows large deltas. Runtime scripts evolve continuously on main as
agents tune their own loops; re-applying a multi-day-old version
regresses prompt-engineering or operational tuning that happened in
the intervening window. The Lior prompt fix at `467424ec` was 22 lines
of diff vs main — re-applying it would have regressed substantive
newer prompt-engineering work.

Empirical anchors:
[PR #4461](https://github.com/Lucent-Financial-Group/Zeta/pull/4461)
(the 0059Z cold-boot under orphaned `otto/2012z-...`),
[PR #4472](https://github.com/Lucent-Financial-Group/Zeta/pull/4472)
(the 0149Z follow-up shard naming the discovery — 4 of 5 commits
already rescued, the 5th was the runtime-script special case),
[PR #4478](https://github.com/Lucent-Financial-Group/Zeta/pull/4478)
(the 0202Z follow-up upgrading the spot-check to full per-file diff
across all 32 + 4 + 4 + 4 + 2 files of the 5 orphaned commits —
the cheap first-file heuristic correctly classified 4 of 4 cases
this session checked exhaustively, anchoring the discriminator's
operational reliability),
[PR #4205](https://github.com/Lucent-Financial-Group/Zeta/pull/4205)
(the peer-agent rescue this discriminator catches).

Composes with [`honor-those-that-came-before.md`](honor-those-that-came-before.md)
at orphaned-commit scope: verifying substrate exists on main IS the
honor — re-landing without checking dishonors the peer agent's
rescue work.

## Composes with

- 081KQJZR90008QG0R002D6XYHB (decision-archaeology procedure)
- 081KQNJ500008QG0R003SCWBDV (substrate-claim-checker validates the proof)
- 081KQNJ500008QG0R003ZC6PK8 (hook authoring — mechanization candidate)
- 081KRQ1AB0008QG0R000QYJFZE (substrate-drift auditor — mechanizes step 0 across all open rows)
- [`memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md`](../../memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md) — step 0 origin substrate
- [`.claude/rules/wake-time-substrate.md`](wake-time-substrate.md) — the discipline this rule extension lands
- [`.claude/rules/honor-those-that-came-before.md`](honor-those-that-came-before.md) — orphaned-branch triage discriminator composes; verifying substrate-on-main IS the honor at orphaned-commit scope
- [PR #4205 (HC-8 rescue)](https://github.com/Lucent-Financial-Group/Zeta/pull/4205) + [PR #4461 (0059Z cold-boot)](https://github.com/Lucent-Financial-Group/Zeta/pull/4461) + [PR #4472 (0149Z discovery)](https://github.com/Lucent-Financial-Group/Zeta/pull/4472) — empirical anchors for the orphaned-branch triage discriminator

## Full reasoning

CLAUDE.md "Backlog-item start gate" bullet, origin 2026-05-05.
