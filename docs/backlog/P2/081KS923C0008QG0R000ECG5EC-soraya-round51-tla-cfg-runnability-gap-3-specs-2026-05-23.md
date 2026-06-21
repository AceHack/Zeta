---
id: 081KS923C0008QG0R000ECG5EC
priority: P2
status: open
title: "Soraya round-51 hand-off — author 3 missing TLA+ `.cfg` files (AsyncStreamEnumerator / ConsistentHashRebalance / DictionaryStripedCAS) — runnability gap distinct from 081KS923C0008QG0R0032VJZPF registry gap"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: tooling-gap
composes_with:
  - tools/tla/specs/AsyncStreamEnumerator.tla
  - tools/tla/specs/ConsistentHashRebalance.tla
  - tools/tla/specs/DictionaryStripedCAS.tla
  - tools/tla/specs/OperatorLifecycleRace.cfg
  - docs/backlog/P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md
---

# 081KS923C0008QG0R000ECG5EC — Author 3 missing TLA+ `.cfg` files (Soraya round-51 hand-off)

## Origin

Soraya's sixth autonomous routing tick (2026-05-23 — round 51, after rounds 47-48 substrate-honest holds + round 49 duplicate-of-081KS923C0008QG0R0032VJZPF hold + round 50 filed as 081KS923C0008QG0R002RH3EH8 PR #4783 MERGED).

## Finding

Three TLA+ specs exist in `tools/tla/specs/` BUT have **no companion `.cfg` file**, making them **not model-checkable** by TLC:

| Spec | LOC | `.cfg` present? | Target |
|---|---|---|---|
| `tools/tla/specs/AsyncStreamEnumerator.tla` | 71 | ❌ | F# IAsyncEnumerator contract (state-machine + concurrency) |
| `tools/tla/specs/ConsistentHashRebalance.tla` | 63 | ❌ | Consistent-hash / Jump-Memento wrapper (state evolution of bucket assignment) |
| `tools/tla/specs/DictionaryStripedCAS.tla` | 59 | ❌ | DiskBackingStore stripe-CAS (multi-writer race) |

TLA+ specs without `.cfg` files are **invisible to CI gate** — TLC cannot be invoked without `SPECIFICATION` + `INVARIANT` blocks + bounded constants in a `.cfg`. The specs look like coverage but provide zero runtime verification.

## Distinct from 081KS923C0008QG0R0032VJZPF

081KS923C0008QG0R0032VJZPF's body enumerates "11 unregistered specs" at the **registry-coverage axis** (Class 0 drift in `verification-registry.md`). This row is the **runnability axis**: a spec can be registered yet still unrunnable for lack of `.cfg`. The two axes compose; neither subsumes the other.

After 081KS923C0008QG0R0032VJZPF + 081KS923C0008QG0R000ECG5EC both land: 3 new TLA+ specs enter CI gate, +3 numerator on the portfolio metric, denominator stable, ratio improves.

## Routing decision (Soraya)

- **Primary tool**: TLA+/TLC (already correctly chosen for state-machine safety + concurrency interleaving; gap is the missing `.cfg` that gates TLC invocation)
- **Cross-check**: not yet warranted at routing scope; landing `.cfg` first is the prerequisite for any cross-check work (cross-checks per BP-16 require a runnable spec)
- **Wrong-tool cost if obvious-but-wrong choice is picked**: deferring `.cfg` authoring and instead writing FsCheck "approximations" for these three invariants would miss the concurrency interleavings (the very bug class TLC catches that FsCheck does not) — CPU-month to reproduce on real hardware

## TLA+-hammer bias guard

TLA+ IS the right primary for all three:

- **AsyncStreamEnumerator** — state-machine on `idle/moving/ready/disposed` + concurrency invariant on Dispose-during-MoveNext
- **DictionaryStripedCAS** — multi-writer CAS race on stripes; interleaving-sensitive deadlock detection
- **ConsistentHashRebalance** — state evolution of bucket-to-node assignment during rebalance; concurrent-reader-during-rebalance safety

Routing table row "state-machine safety invariant" + "concurrency race" both point at TLC. No FsCheck-only or Z3-only escape here. The guard fires the **CONFIRMING** direction: stay with TLC.

## Acceptance criteria

1. Three new `.cfg` files under `tools/tla/specs/` mirroring the shape of the existing peer `OperatorLifecycleRace.cfg`:
   - `AsyncStreamEnumerator.cfg` — SPECIFICATION Spec; INVARIANT Safety; bounded constants Consumers=2, MaxSteps=4
   - `ConsistentHashRebalance.cfg` — SPECIFICATION Spec; INVARIANT Safety; bounded constants Keys=4, MaxBuckets=4
   - `DictionaryStripedCAS.cfg` — SPECIFICATION Spec; INVARIANT Safety; bounded constants Stripes=3, Keys=4, Writers=2
2. CI wiring step to add the three new specs to the TLC gate job (alongside existing `.cfg` set)
3. Each `.cfg` validated to TLC-run cleanly locally (`tools/tla/tla2tools.jar` against pinned Java)
4. After 081KS923C0008QG0R0032VJZPF registry rows land, this row's `.cfg` work makes those three specs **gate-eligible + portfolio-numerator-incrementing**

## Effort

S each, total ≈ M (one evening). Assignee: kenji.

## Composes with

- [`tools/tla/specs/AsyncStreamEnumerator.tla`](../../../tools/tla/specs/AsyncStreamEnumerator.tla) — target needing `.cfg` (71 LOC)
- [`tools/tla/specs/ConsistentHashRebalance.tla`](../../../tools/tla/specs/ConsistentHashRebalance.tla) — target needing `.cfg` (63 LOC)
- [`tools/tla/specs/DictionaryStripedCAS.tla`](../../../tools/tla/specs/DictionaryStripedCAS.tla) — target needing `.cfg` (59 LOC)
- [`tools/tla/specs/OperatorLifecycleRace.cfg`](../../../tools/tla/specs/OperatorLifecycleRace.cfg) — existing peer `.cfg` for shape reference
- [`docs/backlog/P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md`](081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md) — composes-with: registry rows must also land; 081KS923C0008QG0R0032VJZPF + 081KS923C0008QG0R000ECG5EC together close both axes (registry + runnability) for these specs
- `memory/soraya/NOTEBOOK.md` round-51 entry (pending append)

## Substrate-honest framing

The specs are well-formed TLA+ (Soraya verified syntactic shape). The gap is purely the runtime-config (`.cfg`) that gates TLC invocation. Without `.cfg`, the specs are **prose-grade documentation of intent**, not machine-checked verification. The fix is bounded engineering work (~1 evening) that converts intent-documentation into operational verification coverage.
