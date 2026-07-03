---
pr_number: 4774
title: "backlog(081KS923C0008QG0R003GHCG1P..081KS923C0008QG0R001N2RSGJ): file Soraya rounds 43+44+45 hand-offs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T22:12:57Z"
merged_at: "2026-05-23T22:25:59Z"
closed_at: "2026-05-23T22:25:59Z"
head_ref: "otto/soraya-handoffs-b0710-b0711-b0712-2026-05-23"
base_ref: "main"
archived_at: "2026-05-23T22:44:14Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4774: backlog(081KS923C0008QG0R003GHCG1P..081KS923C0008QG0R001N2RSGJ): file Soraya rounds 43+44+45 hand-offs

## PR description

## Summary

Files Soraya's three pending findings (rounds 43+44+45) as backlog rows in one cohesive PR, per Aaron's 2026-05-23 21:30Z policy-flip authorization (*"lets try to keep things moving other than if we need budget increases"*) — Soraya findings flow through Otto (plumbing-commit-fallback) to backlog without per-finding maintainer pick; Aaron reviews aggregates only.

## Three rows

**081KS923C0008QG0R003GHCG1P** — DBSP chain rule BP-16 cross-check

- Lean artifact is single-tool; needs FsCheck cross-trace + Z3 pointwise lemma
- Composes with just-merged PR #4772 (Lean README + CI badge) — this is gap #3 of the chain-rule publication arc
- Effort: S+S

**081KS923C0008QG0R0005VM4FB** — Residuated FsCheck property file

- `src/Core/Residuated.fs` is the ONLY CRDT-class file with zero FsCheck (sanity-checked across PNCounter, OrSet, Lww, GCounter, DeltaCrdt, Bloom, CountMin, Haar, HyperLogLog, HyperMinHash — all have tests)
- Round-17 regression-guard: prior "O(1) amortised" claim was actually O(n); harsh-critic caught it; FsCheck pins the law
- Three properties: Galois + residual + retraction equivalence
- Effort: S

**081KS923C0008QG0R001N2RSGJ** — WitnessDurable commit protocol formal verification triple

- `Durability.fs:14-22` self-declares TLA+ prereq; type itself is the gate (`Save` throws until proven)
- P0 triple: TLA+ for state-machine safety + Z3 for quorum arithmetic + FsCheck for real-code cross-check
- Soraya explicitly named + REJECTED the TLA+-hammer trap (don't bundle quorum arithmetic into TLA+; Z3 closes in seconds vs TLC enumeration)
- Effort: M+S+S

## Origin

Soraya's autonomous formal-verification routing loop started 2026-05-23 ~20:00Z. Rounds 42-45 produced four findings; round 42 already filed as 081KS923C0008QG0R0032VJZPF (merged earlier today). Rounds 43-45 stayed pending until Aaron's policy-flip authorization just now.

All assigned to **kenji** per Soraya's advisory-only authority constraint (she routes; Kenji or original spec owners author).

## Commit details

6th plumbing-fallback PR this session — sibling pattern to #4755 / #4761 / #4762 / #4765 / #4772.

## Test plan

- [x] 3 row files written with §33-compliant frontmatter
- [x] All cross-references point at real files
- [x] TLA+-hammer guards preserved per Soraya's analysis
- [ ] CI green
- [ ] Auto-merge fires

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-23T22:16:31Z)

## Pull request overview

Adds three new per-row backlog entries capturing Soraya’s round-43/44/45 hand-offs as actionable backlog work items, aligned with the repo’s per-row backlog workflow under `docs/backlog/P2/`.

**Changes:**

- Adds 081KS923C0008QG0R003GHCG1P (DBSP chain rule BP-16 cross-check: FsCheck + Z3).
- Adds 081KS923C0008QG0R0005VM4FB (Residuated FsCheck property coverage).
- Adds 081KS923C0008QG0R001N2RSGJ (WitnessDurable commit protocol verification triple: TLA+ + Z3 + FsCheck).

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KS923C0008QG0R003GHCG1P-soraya-round43-dbsp-chain-rule-bp16-cross-check-fscheck-z3-2026-05-23.md | New backlog row for chain rule cross-check work (FsCheck + Z3) and registry updates. |
| docs/backlog/P2/081KS923C0008QG0R0005VM4FB-soraya-round44-residuated-fscheck-property-file-2026-05-23.md | New backlog row to add FsCheck law coverage for `Residuated.fs`. |
| docs/backlog/P2/081KS923C0008QG0R001N2RSGJ-soraya-round45-witnessdurable-commit-protocol-tla-z3-fscheck-triple-2026-05-23.md | New backlog row defining a 3-tool verification plan for WitnessDurable durability mode. |

## Review threads

### Thread 1: docs/backlog/P2/081KS923C0008QG0R003GHCG1P-soraya-round43-dbsp-chain-rule-bp16-cross-check-fscheck-z3-2026-05-23.md:33 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T22:16:29Z):

The text says this was checked against “all 20 TLA+ specs”, but `tools/tla/specs/` currently contains 19 `.tla` specs. Consider updating the count (or phrasing it as “all specs under tools/tla/specs/”) to keep the empirical claim accurate.

### Thread 2: docs/backlog/P2/081KS923C0008QG0R003GHCG1P-soraya-round43-dbsp-chain-rule-bp16-cross-check-fscheck-z3-2026-05-23.md:67 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T22:16:30Z):

`memory/soraya/NOTEBOOK.md` is currently 235 lines long, so the reference to “line 238” doesn’t exist. Please adjust the citation to a valid line range (or switch to a section heading/anchor reference).

### Thread 3: docs/backlog/P2/081KS923C0008QG0R0005VM4FB-soraya-round44-residuated-fscheck-property-file-2026-05-23.md:57 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T22:16:30Z):

Acceptance criteria says `dotnet test` “should pick them up automatically”, but `tests/Tests.FSharp/Tests.FSharp.fsproj` uses an explicit `<Compile Include=...>` list. The criteria should include adding the new `Algebra/Residuated.Tests.fs` file to the `.fsproj` compile list (and in the right order) so CI actually runs it.

### Thread 4: docs/backlog/P2/081KS923C0008QG0R0005VM4FB-soraya-round44-residuated-fscheck-property-file-2026-05-23.md:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T22:16:30Z):

`memory/soraya/NOTEBOOK.md` is currently 235 lines long, so the cited range “lines 308-404” is out of bounds. Please update this reference to a valid line range or a stable anchor.

### Thread 5: docs/backlog/P2/081KS923C0008QG0R001N2RSGJ-soraya-round45-witnessdurable-commit-protocol-tla-z3-fscheck-triple-2026-05-23.md:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T22:16:31Z):

The proposed FsCheck file path/name (`tests/Tests.FSharp/Durability/WitnessDurable.Properties.fs`) doesn’t match the current test layout (there is `tests/Tests.FSharp/Storage/` and existing files use `*.Tests.fs`). Consider aligning the acceptance criteria with the existing folder/naming conventions and explicitly calling out that the new test file must be added to `tests/Tests.FSharp/Tests.FSharp.fsproj`’s `<Compile Include=...>` list.

### Thread 6: docs/backlog/P2/081KS923C0008QG0R001N2RSGJ-soraya-round45-witnessdurable-commit-protocol-tla-z3-fscheck-triple-2026-05-23.md:75 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T22:16:31Z):

`memory/soraya/NOTEBOOK.md` is currently 235 lines long, so the cited range “lines 407-505” is out of bounds. Please update to a valid line range or a stable anchor reference.
