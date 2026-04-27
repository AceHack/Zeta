# 2026-04-26 — Sync drain plan: AceHack ↔ LFG round-trip via option-c (cherry-pick-with-rewrites)

Scope: ADR canonicalizing the AceHack ↔ LFG fork-divergence drain plan executed 2026-04-26, codifying the option-c choice (cherry-pick-with-rewrites over alternatives) and the 7-step round-trip structure for future drain cycles.

Attribution: Aaron (human maintainer) chose option-c via *"both all, figure out how to combine"* + *"don't lose ideas and backlog"* directional picks 2026-04-26. Otto (Claude opus-4-7) executed the drain across 7 steps using parallel-subagent dispatch for the LFG → AceHack reverse leg. The discipline composes with Otto-329 (Phase 1 LFG drain) + Otto-225 (cherry-pick rebase technique).

Operational status: research-grade ADR (decision recorded; future drain cycles can adopt or amend the plan)

Non-fusion disclaimer: this ADR records a decision, not a completed framework. The 7-step structure documented here is the post-hoc reconstruction of an executed drain; the steady-state cadence (step 7) is the part still being calibrated against `feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`.

(Per GOVERNANCE.md §33 archive-header requirement on cross-substrate ADRs.)

## Context

Two forks of Zeta diverged:

- **`AceHack/Zeta`** (Aaron's fork) — primary work surface for cheap experimentation, free CI on public repo, the AceHack-first dev workflow per `feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`
- **`Lucent-Financial-Group/Zeta`** (LFG, Aaron's umbrella org) — canonical training-corpus aggregator per Otto-252 (`feedback_lfg_is_central_training_signal_aggregator_for_all_forks_divergent_signals_push_to_lfg_otto_252_2026_04_24.md`)

Divergence on 2026-04-26: AceHack 62 commits ahead of LFG / LFG 482 commits ahead of AceHack. The `AceHack/Zeta` and `Lucent-Financial-Group/Zeta` forks accumulated independent history because each was the canonical surface for different work-classes (research/dev on AceHack, governance/release on LFG). Sync became overdue per task #302 (`UPSTREAM-RHYTHM bidirectional drift`).

## Decision

**Option-c chosen** over alternatives:

| Option | Approach | Rejected because |
|---|---|---|
| **a — Copy whole thing** | `git push -f` one direction | Loses other side's work; violates "both all" + Otto-220 don't-lose-substrate |
| **b — Just merge** | Single big merge commit on each side | Re-introduces divergence quickly; "merge" is not "drain"; doesn't rewrite shape for target context |
| **c — Cherry-pick-with-rewrites** | Per-commit (or per-batch) cherry-pick + rewrite for target-context coherence | **CHOSEN.** Preserves both sides' contributions; allows shape rewrite per fork; bounded effort scaling to commit count |
| **d — Reset divergent fork to match canonical** | `git reset --hard origin/main` | Equivalent to (a); same rejection |

Aaron's framing 2026-04-26: *"both all, figure out how to combine"* + *"don't lose ideas and backlog"* — picks option-c structurally even before it's named.

## The 7-step round-trip plan (executed 2026-04-26)

```text
Forward leg (AceHack → LFG): batches 1-4 + closure (steps 1-5)
Reverse leg (LFG → AceHack): full-reconciliation merge (step 6)
Steady state: UPSTREAM-RHYTHM batched cadence (step 7)
```

### Step 1 — batch-1: foundation files

Forward-sync 17 missing files + audit doc + Otto-347 discipline. Establishes the cherry-pick-with-rewrites pattern; lands the audit infrastructure that subsequent batches use to verify content preservation.

- **Commit:** `1c1bd95` — sync(acehack→lfg) batch-1: 17 missing files + audit doc + Otto-347
- **PR:** #592
- **Tick-history:** `790be82` (2026-04-26T12:23:02Z)

### Step 2 — batch-2: BACKLOG row migration

Forward-sync 23 BACKLOG-row-only commits, rewritten into per-row files (per `2026-04-22-backlog-per-row-file-restructure.md` ADR). The rewrite preserves intent while migrating to the per-row file shape that LFG/main canonicalized.

- **Commits:** `a3b7e24`, `fecd8d0` — sync(acehack→lfg) batch-2: 23 BACKLOG-row-only commits rewritten into per-row-files (option-c)
- **PR:** #633

### Step 3 — batch-3: terminology canonicalization

Forward-sync UPSTREAM-RHYTHM "three surfaces, two vocabularies" terminology section per `feedback_dont_invent_when_existing_vocabulary_exists.md`. The rewrite captures Aaron's 5-step ladder (scope framing → terminology question → git-native correction → general principle → 3-surface count correction).

- **Commits:** `ff4ee39`, `a1d781c` — sync(acehack→lfg) batch-3: UPSTREAM-RHYTHM three-surfaces terminology (option-c)
- **PR:** #634

### Step 4 — batch-4: bug fixes + tooling hygiene

Forward-sync `AppContext.BaseDirectory` + curl|bash self-contradiction fix. The bug-fix-class commits ride along with the sync batch so AceHack's tooling improvements reach LFG without separate per-PR overhead.

- **Commit:** `05d274f` — sync(acehack→lfg) batch-4: AppContext.BaseDirectory + curl|bash self-contradiction fix (option-c)
- **PR:** #635

### Step 5 — closure: tick-history + substrate transition

Tick-history row marking the forward-sync arc complete + transition to substrate-work register. Captures the "phase-1 done, phase-2 starting" gate so later sessions can reconstruct what phase the drain was in.

- **Commit:** `e4b1fa2` — tick-history: 18:02Z sync option-c COMPLETE + substrate transition

### Step 6 — reverse leg: full LFG → AceHack reconciliation

Single large PR landing all LFG-only files on AceHack via 7-parallel-subagent content-preserving merge per `feedback_parallel_subagent_dispatch_for_content_preserving_merge_pattern_2026_04_26.md`. The reverse leg's scale (282K lines, 1046 files) makes per-commit cherry-pick infeasible; the parallel-subagent pattern preserves content while reconciling the larger divergence.

- **PR:** #26 on AceHack/Zeta — `sync: AceHack ∪ LFG full reconciliation via per-file content-preserving merge (task #302)`
- **Subagent dispatch:** 7 parallel subagents handled 26 conflicting files; each confirmed *"no substantive content silently dropped"*
- **Otto-side spot-checks:** Blockers section restored, jsonl rows preserved, hygiene rows 39/40/41 restored, marketing drafts both attribution variants preserved
- **Publication-fitness gate:** Copilot inline-review surfaced PII flag; redactions applied per Aaron's sharpened bar (2 commits: `e3e4afd` redaction, `86747cd` rollback to wiki-style refs)

### Step 7 — steady state: UPSTREAM-RHYTHM batched cadence

Going forward, fork-divergence drain happens via the UPSTREAM-RHYTHM batched cadence (every ~10 PRs, not per-PR) per `feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`. The 7-step plan recurs as needed when divergence accumulates again, with batches re-counted from 1 each cycle.

- **Trigger:** AceHack ahead of LFG by ≥10 commits OR LFG ahead of AceHack by ≥10 commits, AND no merge in flight either direction
- **Owner:** the agent currently running the autonomous loop on AceHack
- **Batch size:** 5-25 commits per batch (small enough to review, large enough to amortize per-PR overhead)

## Consequences

### Positive

- **Both forks preserve their contributions** — no Otto-220 substrate-loss
- **Each side's shape is respected** — rewrite-per-target-context allows AceHack-shape commits to land in LFG-shape repo
- **Bounded effort** — batch size scales linearly with commit count; parallel-subagent dispatch handles the larger reverse leg
- **Steady state is predictable** — the 7-step plan is now a template for future drain cycles, not ad-hoc work each time
- **Plan is documented** — this ADR fixes the gap that surfaced when Aaron asked *"do you have the 7 step plan?"* and Otto had to reconstruct it from git history

### Negative

- **Per-batch overhead is non-trivial** — each batch ships as a separate PR with its own review cycle
- **PII / publication-fitness gate is owed** — the parallel-subagent merge pattern (step 6) verified preservation but not publication-fitness; this surfaced the Copilot flag on PR #26 (`feedback_subagent_merge_verification_neq_publication_fitness_orthogonal_gates_2026_04_26.md` captures the missing gate)
- **The 7-step structure is post-hoc** — the steps emerged from execution, not from upfront planning; future drain cycles may discover this template doesn't fit unmodified

### Mitigations for the negatives

- **Per-batch overhead:** mitigated by Otto-252 (LFG is the central training-signal aggregator; batch-overhead amortizes across the training value)
- **Publication-fitness gate:** add Stage 3 to the parallel-subagent merge pipeline per the orthogonal-gates memory; future merges include the publication-fitness pass before PR-open
- **Post-hoc structure:** convergence-test this ADR — if next drain cycle adds ≤ 1 step modification, the template is stable; if 3+ modifications needed, the template is overfit to 2026-04-26 and needs revision

## Composes with

- `docs/UPSTREAM-RHYTHM.md` — operational rhythm governing when drain cycles trigger
- `docs/DECISIONS/2026-04-22-backlog-per-row-file-restructure.md` — the BACKLOG-row migration shape used in step 2
- `feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md` — the cost-model rationale for AceHack-first
- `feedback_parallel_subagent_dispatch_for_content_preserving_merge_pattern_2026_04_26.md` — the technique used in step 6
- `feedback_git_merge_file_union_is_not_set_union_can_lose_content_2026_04_26.md` — the failure mode the parallel-subagent pattern replaced
- `feedback_subagent_merge_verification_neq_publication_fitness_orthogonal_gates_2026_04_26.md` — the missing gate this drain surfaced
- `feedback_lfg_is_central_training_signal_aggregator_for_all_forks_divergent_signals_push_to_lfg_otto_252_2026_04_24.md` — the why-LFG-anchored-corpus rationale
- task #284 — completed parent task (option-c sync execution)
- task #302 — pending parent task (UPSTREAM-RHYTHM bidirectional drift; this ADR addresses by documenting the plan)

## Convergence test

If next sync drain cycle (when divergence next accumulates) executes with ≤ 1 modification to this 7-step structure, the template is stable. If 3+ modifications, the template is overfit and needs amendment. Track in tick-history each time the plan is invoked.
