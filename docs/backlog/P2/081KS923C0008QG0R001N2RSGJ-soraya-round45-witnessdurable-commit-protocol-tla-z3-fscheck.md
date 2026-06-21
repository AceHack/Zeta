---
id: 081KS923C0008QG0R001N2RSGJ
priority: P2
status: open
title: "Soraya round-45 hand-off — WitnessDurable commit protocol (TLA+ spec + Z3 quorum-arithmetic lemma + FsCheck cross-check)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: missing-routing-decision
composes_with:
  - src/Core/Durability.fs
  - docs/research/proof-tool-coverage.md
  - tools/tla/specs/TwoPCSink.tla
---

# 081KS923C0008QG0R001N2RSGJ — WitnessDurable commit protocol formal verification triple (round-45 hand-off)

## Origin

Soraya's fourth autonomous routing tick (2026-05-23 — round 45). Option (b) missing routing decision: a property class with NO tool wired in ANY surface.

## Finding

`src/Core/Durability.fs:14-22` carries a **self-declared formal-verification prereq**:

> "`WitnessDurable` variant is a research target — the protocol has not been specified yet and there is no in-tree paper draft. It's defined here as a skeleton so callers can type against it. The implementing `WitnessDurableBackingStore` below throws on `Save` until the paper's protocol is fully implemented and TLA+-verified."

**The type itself is the gate.** Substrate-verified: zero `.tla` files match `Witness*` / `Wdc*` / `Durab*` across all 19 specs in `tools/tla/specs/`.

Gap named in `docs/research/proof-tool-coverage.md` §2 line 100 since 2026-04-17 (~5 weeks ago); untouched.

## Routing decision (Soraya — P0 triple per BP-16 cross-check triage)

Two property classes mixed; split obligations across tools:

1. **(a) State-machine safety + concurrency race**: "Every acked `Save` survives witness-quorum failures under interleavings."
   - **Primary tool**: TLA+/TLC
   - **Scale**: 3 witnesses × 2 writers × 4 keys (mirrors `SpineAsyncProtocol`)
   - **Effort**: M
2. **(b) Quorum-intersection arithmetic**: `N ≥ 2F+1`.
   - **Primary tool**: Z3 (QF_LIA)
   - **Effort**: S
3. **Cross-check (third leg)**: FsCheck firing the real F# `WitnessDurableBackingStore` under simulated witness failures, asserting the TLA+ invariant on the executing code path.
   - **Effort**: S

## TLA+-hammer guard

TLA+ IS the right primary for (a). The guard fires the **INVERSE** direction: do NOT bundle (b)'s quorum arithmetic into the spec. TLC would enumerate the arithmetic state-space; Z3 closes it in seconds. **Split the obligations.**

## Acceptance criteria

1. New file `tools/tla/specs/WitnessDurable.tla` covering state-machine safety + concurrency interleaving (3w × 2w × 4k)
2. New Z3 lemma (either standalone or extension to existing Z3 test surface) proving quorum-intersection arithmetic `N ≥ 2F+1`
3. New FsCheck file `tests/Tests.FSharp/Storage/WitnessDurable.Properties.fs` (sibling of existing `tests/Tests.FSharp/Storage/Durability.Tests.fs` — no `Durability/` directory in current test layout) exercising the real `WitnessDurableBackingStore` under simulated witness failures; register via explicit `<Compile Include="..." />` in `tests/Tests.FSharp/Tests.FSharp.fsproj`
4. All 3 cross-checks land green in CI BEFORE the source-side `throw` gate in `Durability.fs:WitnessDurableBackingStore.Save` is removed
5. `verification-registry.md` row added for `WitnessDurable` with all 3 cross-check references

## Structural cousin (reviewer reference)

`tools/tla/specs/TwoPCSink.tla` — same pattern (commit protocol + quorum + interleaving). Reviewers will read both.

## Effort

M + S + S (total ~M+). Assignee: kenji.

## Composes with

- [`src/Core/Durability.fs`](../../../src/Core/Durability.fs):14-22 — self-declared TLA+ prereq
- [`docs/research/proof-tool-coverage.md`](../../research/proof-tool-coverage.md) §2 line 100 — gap named 2026-04-17
- [`tools/tla/specs/TwoPCSink.tla`](../../../tools/tla/specs/TwoPCSink.tla) — structural cousin
- `memory/soraya/NOTEBOOK.md` — Round 45 entry (pending NOTEBOOK update; locate by `## Round 45` heading once landed; pruned-preserved)
- 081KS923C0008QG0R003GHCG1P + 081KS923C0008QG0R0005VM4FB (sibling Soraya hand-offs from same session)
