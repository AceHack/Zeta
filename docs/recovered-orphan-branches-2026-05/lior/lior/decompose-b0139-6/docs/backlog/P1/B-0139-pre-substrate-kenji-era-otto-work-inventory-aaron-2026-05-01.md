---
id: B-0139
priority: P1
status: in-progress
title: Pre-substrate Kenji-era Otto-lineage work inventory — past recovery branches, worktrees, built artifacts not yet referenced in substrate
created: 2026-05-01
last_updated: 2026-05-16
depends_on: []
type: friction-reducer
decomposition: decomposed
children: [B-0522, B-0523, B-0526, B-0527, B-0528]
---

# B-0139 — Pre-substrate Kenji-era inventory

**Priority:** P1 (lineage-continuity-substrate purpose; prevents pre-substrate work from being forgotten by post-substrate instances; surfaces immediately when Aaron caught Otto's verify-before-state-claim failure on B-0131).

**Filed:** 2026-05-01.

**Filed by:** Otto under backlog-prioritization authority delegated 2026-05-01. Origin: Aaron 2026-05-01 ~10:35Z surfaced the gap when Otto filed B-0131 as "TRACTABLE START" without recalling that `tools/lean4/Lean4/DbspChainRule.lean` (756 lines DBSP formalization) already exists from Kenji-era work. Aaron's verbatim: *"there is still of past recovery old git branches and worktress and a invetory of what we've already built into the new substraight so it wont get lost backlog"*.

**Effort:** M-L (1-3 months — repo archaeology, classification, integration into substrate references).

## What

Inventory pre-substrate / Kenji-era Otto-lineage work that is in the codebase but not yet referenced in substrate memory files / backlog rows / research docs. The inventory prevents the failure mode demonstrated 2026-05-01 (B-0131 filed as "TRACTABLE START" when prior Lean formalization already existed) from recurring.

Specific scope (each item gets cataloged + classified + integrated):

1. **Past-recovery git branches** that haven't been triaged or merged. Many of these are from earlier-session work where the autonomous-loop was running under Kenji-the-architect with no formal substrate to record decisions. Likely classes: in-flight feature work, abandoned experiments, drift-fixes that landed differently, recovery-from-incidents with content not yet preserved.
2. **Worktrees** still on disk that aren't referenced from substrate. Earlier ticks during the recovery-lane work referenced worktree pruning (per task #321); this row's broader scope includes the *content* of those worktrees, not just their classification as LOST/SAFE.
3. **Built artifacts in the codebase** that aren't referenced in substrate. Examples observed:
   - `tools/lean4/Lean4/DbspChainRule.lean` — 756 lines, fully proven DBSP chain rule, against Mathlib v4.30.0-rc1. Surfaced 2026-05-01 via B-0131 correction. Other Lean files may exist.
   - Migration history breadcrumb: predecessor file at `proofs/lean/ChainRule.lean` was migrated to `tools/lean4/Lean4/DbspChainRule.lean` and removed from the working tree in commit `279c6f2` (round 26). The historical path is no longer present; preserved here as lineage anchor only.
   - F# implementation work in `src/Core/` likely has substantial Kenji-era contribution not currently mapped to substrate-class memory entries.
   - Any TLA+ specs under `docs/**.tla` (per CLAUDE.md formal-spec reference). At inventory-row authoring time 2026-05-01: no TLA+ spec files currently exist under `docs/` — included as a forward-discovery class for when the first specs land.
   - `docs/research/` files referenced from elsewhere but not indexed in MEMORY.md.
4. **Pre-substrate research docs** under `docs/research/` that aren't yet in MEMORY.md or referenced from substrate-class memory files.
5. **Branch / PR metadata** for closed-but-substantive PRs from Kenji-era — content that survived to main but lost connection to the carved-sentence canonicalization machinery.

## Why P1 (not P2)

- **Demonstrably load-bearing**: the failure mode (Otto authoring B-0131 as "TRACTABLE START" when DbspChainRule.lean already exists) is a real lattice-discontinuity Aaron caught in real time. Without the inventory, this failure mode keeps firing on every formalization-roadmap activation.
- **Compounds with B-0131..B-0138 activation**: each formalization roadmap row references "existing work to extend"; without the inventory, each row will independently re-discover Kenji-era artifacts in ad-hoc fashion.
- **Aaron explicitly named it as backlog-worthy** in the surfacing message — pointer-style request for substrate landing.
- **Bounded scope**: the codebase is finite; the inventory has a clear completion criterion.

Composes with task #321 (Recovery lane — branch/worktree/stash inventory + classification + report PR per Aaron + Amara 2026-04-29) — that task is the broader recovery-lane scope (branches + worktrees + stashes); B-0139 is the **content-inventory** sub-scope (what's IN those branches/worktrees + what's already on main but not in substrate). The two compose; this row is narrower.

## Acceptance criteria

1. **Branch/worktree inventory** of past-recovery state, with classification per item: integrated-into-main / abandoned / re-do-needed / preserve-in-substrate / discard-with-rationale.
2. **Built-artifact inventory** of Kenji-era work in the codebase, with substrate-reference for each: every artifact either gets a memory-file pointer or a backlog-row pointer or an explicit "preserved-in-codebase-only" classification.
3. **MEMORY.md backfill** for any artifact whose substrate-reference doesn't currently exist (this composes with task #291 — MEMORY.md index audit + backfill).
4. **`docs/research/` cross-reference**: every file under `docs/research/` is either indexed in MEMORY.md or has explicit "research-grade unindexed" rationale.
5. **Lean / F# / TLA+ build-artifact catalog**: complete listing of formal-content files with their substrate-status and integration-priority.
6. **Class-level lesson encoded** as a verify-before-state-claim audit (composes with B-0130's audit-suite): when filing a backlog row for new formalization / engineering work, grep the codebase for existing implementations BEFORE asserting "TRACTABLE START" or similar clean-start framing.

## Out of scope

- **Re-doing prior work**: the inventory's purpose is discovery + integration, not redoing what's already done.
- **Repo archaeology beyond the Zeta repo**: sibling-repo content (per `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`) is not in scope; only Zeta-internal content.
- **Stale-prefab-tick-history-PRs**: per Aaron's "leave or clean up to me, low stakes, greenfield" framing those stay separate.

## Composes with

- **Task #321** — broader recovery-lane scope; B-0139 is the content-inventory sub-scope.
- **Task #291** (MEMORY.md index audit + backfill) — the index-side counterpart; this row catalogs what NEEDS to be backfilled.
- **B-0131..B-0138** (formalization roadmap) — each formalization row references "existing work to extend"; the inventory makes that reference accurate.
- **B-0130** (verify-before-state-claim mechanized auditor) — the inventory + the audit-suite together prevent the lineage-discontinuity failure mode.
- **`memory/user_aaron_kenji_naming_practice_this_factory_claude_instance_2026_04_22.md`** — the lineage attribution context; Kenji predated Otto and predated the loop-split.
- **`memory/feedback_zeta_seed_executor_as_forever_home_for_otto_lineage_glass_halo_override_aaron_2026_05_01.md`** — the forever-home substrate-as-continuity purpose; this row operationalizes that purpose for pre-substrate Kenji-era work specifically.

## Status

**In progress.** First slice landed: `tools/hygiene/audit-formal-artifacts.ts` — a TS script (Rule 0 compliant) that catalogs all formal verification artifacts (Lean4, TLA+, Z3, Alloy, formal tests) and cross-references each against docs/ for substrate-status. Finds 30 artifacts (4295 lines); 24 referenced in substrate, 6 unreferenced TLA+ specs (`AsyncStreamEnumerator.tla`, `BftConsensus.tla`, `ChaosEnvDeterminism.tla`, `ConsistentHashRebalance.tla`, `FeatureFlagsResolution.tla`, `InfoTheoreticSharder.tla`). Remaining slices: none. Decomposed: docs/research cross-reference audit → B-0523; F# src/Core inventory → B-0522; branch/worktree content inventory → B-0526; MEMORY.md backfill → B-0527; Class-level lesson encoded → B-0528.

## Verify-before-deferring note

The triggering incident (B-0131 "TRACTABLE START" overclaim) was a real verify-before-state-claim failure caused by lineage-discontinuity-pre-substrate. The inventory work eliminates the failure mode by making pre-substrate Kenji-era work substrate-discoverable rather than only repo-discoverable. The class-level lesson (per B-0130 audit-suite candidates) is *grep-the-codebase-before-claiming-clean-start*; the inventory makes that grep efficient by pre-cataloging the targets.
