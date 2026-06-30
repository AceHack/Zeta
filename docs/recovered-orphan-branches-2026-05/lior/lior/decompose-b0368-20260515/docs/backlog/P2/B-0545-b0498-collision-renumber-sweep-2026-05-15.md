---
id: B-0545
priority: P2
title: B-0498 ID collision — renumber sweep (Riven cursor-terminal scaffold → new ID)
type: substrate-correction
status: done
created: 2026-05-15
completed: 2026-05-16
filed_by: otto-cli
completed_by: otto-cli
depends_on: []
composes_with:
  - "memory/feedback_b0451_per_collision_renumber_procedure_external_references_rule_trumps_first_merged_2026_05_14.md"
  - "B-0498-substrate-evolution-algebra-rule-promotion-after-cooling-period-2026-05-14"
  - "B-0549-riven-cursor-terminal-background-loop-ide-native-autonomous-gate-2026-05-15"
---

# B-0545 — B-0498 ID collision renumber sweep

## Observation

`git ls-tree origin/main -- docs/backlog/` returns **two** files claiming the B-0498 ID:

```
100644 blob b9f58c058e371297daef7972be75ffc60bc98da0  docs/backlog/P1/B-0498-riven-cursor-terminal-background-loop-ide-native-autonomous-gate-2026-05-15.md
100644 blob 4a70acd550adb763d219871b86fea00726e1a567  docs/backlog/P2/B-0498-substrate-evolution-algebra-rule-promotion-after-cooling-period-2026-05-14.md
```

The collision was caught by `copilot-pull-request-reviewer` on PR #3604 (tick shard 2217Z) — substrate-honest credit to the automated reviewer.

## Rule for renumber

Per `memory/feedback_b0451_per_collision_renumber_procedure_external_references_rule_trumps_first_merged_2026_05_14.md`:

> first-merged wins; external references to the kept ID are the rule's authority; the colliding-new-row renumbers.

Apply:

- **P2/B-0498-substrate-evolution-algebra-* (dated 2026-05-14)** — predates by 1 day → **keeps B-0498**.
- **P1/B-0498-riven-cursor-terminal-* (dated 2026-05-15)** — postdates → **renumbers** to next free ID.

## Next free ID

At time of filing (2026-05-15T22:55Z), `git ls-tree origin/main` plus `gh pr list --search "B-NNNN" --state all` shows:

- B-0542 last on main
- B-0543/B-0544 taken in flight (PR #3614, OPEN)
- B-0545 — THIS ROW, claimed
- **B-0546** — next free for the renumber target

## Sweep scope (estimate before doing the work)

External references to B-0498 that need cross-walk:

1. The backlog file itself: `docs/backlog/P1/B-0498-riven-cursor-*.md` → rename to `docs/backlog/P1/B-0546-riven-cursor-*.md`
2. PR titles referencing B-0498 in the Riven sense:
   - #3603 (merged) — `feat(riven): Riven cursor-terminal loop scaffold [B-0498] (decomposed)` — historical record; do NOT edit merged-PR title; note in row body
3. Tick shards referencing #3603 with `B-0498` quote:
   - `docs/hygiene-history/ticks/2026/05/15/2217Z.md` (already merged via #3604; thread-resolution on #3604 references this row)
   - Possibly other shards from concurrent sessions
4. Memory files / rule files / skill files: search needed
5. Tools/scripts referencing the Riven loop by B-0498 name: search needed

## Substrate-honest scope-bound

The renumber is a **substrate-correction**, NOT a feature. Implementation:

- Move file: `git mv docs/backlog/P1/B-0498-riven-* docs/backlog/P1/B-0546-riven-*`
- Update `id:` frontmatter inside the moved file
- Update any `depends_on:` / `composes_with:` fields in OTHER backlog rows that pointed at B-0498 in the Riven sense
- Update tick shards that QUOTE the Riven B-0498: PER `tick-shards-are-immutable` discipline, do NOT in-place-edit; instead, append a correction note in a new shard OR add a glossary entry in the renumber row
- Update any tools/scripts: rename references via `grep -rln "B-0498-riven\|B-0498.*riven" memory/ docs/ .claude/ tools/`

This row IS NOT the implementation — it's the rule-defined filed-correction surface. Implementation happens in a follow-up PR.

## Why P2 priority

The collision exists but doesn't actively break anything immediately:

- Both files exist; no automated tooling currently fails on the duplicate ID (no enforcement)
- The Riven scaffold (#3603) is merged and functional; renaming doesn't undo the substrate
- The pre-existing B-0498 (algebra-rule-promotion) is referenced by various substrate; renaming IT would propagate further

P2 cadence: address within the next 1-2 weeks; pair with the renumber sweep tools if available.

## Composes with

- The `b0451_per_collision_renumber_procedure` memory (2026-05-14) — same shape, second instance
- The `claim-acquire-before-worktree-work.md` rule's "ID allocation discipline" section — this collision is an instance the discipline is meant to prevent
- `refresh-before-decide.md` invariant at ID-allocation scope — both surfaces (merged + in-flight) must be checked; the Riven-cursor row at 2026-05-15 likely skipped the on-disk B-0498 P2 check

## Resolution (2026-05-16)

Renumber executed in this same PR:

- Renamed `docs/backlog/P1/B-0498-riven-cursor-terminal-*-2026-05-15.md` → `docs/backlog/P1/B-0549-riven-cursor-terminal-*-2026-05-15.md`
- Updated frontmatter: `id: B-0498` → `id: B-0549`; added `renumbered_from: B-0498` and `renumbered_per: B-0545` breadcrumbs (per audit-tool recommendation)
- Updated cross-reference: `docs/research/2026-05-15-riven-cursor-terminal-loop-design.md` Backlog line
- Updated this row's `composes_with` to point at the new ID
- Did **NOT** edit tick shards (`docs/hygiene-history/ticks/2026/05/15/2217Z.md`), merged-PR title (#3603), or the PR-3619 PR-discussion archive — all immutable historical artifacts. Readers resolve `B-0498` (Riven sense) → B-0549 via the renumbered_from breadcrumb.

**Renumber target refresh**: B-0545 originally noted B-0546 as next-free at filing time (22:55Z 2026-05-15), but B-0546/B-0547/B-0548 were claimed in the intervening 27h. Picked B-0549 after re-running `git ls-tree origin/main -- docs/backlog/` per `refresh-before-decide.md` at ID-allocation scope.

**Verification**: `bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids` → 0 duplicate-ID groups (was 1 before this PR).
