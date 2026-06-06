---
id: B-0717
zetaid: 081KSBMG30008QG0R003B46GWG
priority: P2
status: open
title: "Soraya round-57 hand-off — LSM Spine cluster registry-rows + BP-16 cross-check pair (SpineAsyncProtocol candidate-P0 TLA+/code-drift gap)"
created: 2026-05-24
last_updated: 2026-05-24
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: cross-check-gap
composes_with:
  - docs/backlog/P2/B-0709-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md
  - docs/backlog/P3/B-0716-soraya-round53-b0709-scope-correction-3-lsm-spine-specs-2026-05-23.md
  - tools/alloy/specs/Spine.als
  - tools/tla/specs/SpineAsyncProtocol.tla
  - tools/tla/specs/SpineMergeInvariants.tla
  - docs/research/verification-registry.md
---

# B-0717 — LSM Spine cluster: registry-rows + BP-16 cross-check pair (Soraya round-57 hand-off, post-B-0716-merge)

## Origin

Soraya's ninth autonomous routing tick (2026-05-24 — round 57, immediately post-merge of PR #4791 / B-0716 P3 scope-correction at 00:06:45Z).

Re-engagement trigger fired per rounds 54+55+56 named conditions. Soraya re-engaged at trigger-firing and surfaced substantive routing follow-up that B-0716 didn't fully cover.

## Finding

B-0716 amended B-0709's enumeration from 11 → 14 unregistered specs (added LSM Spine cluster: `Spine.als` + `SpineAsyncProtocol.tla` + `SpineMergeInvariants.tla`). PR #4791 MERGED the backlog enumeration correction.

**The registry-row execution payload is still pending.** `docs/research/verification-registry.md` has **zero `Spine` matches** as of this row's authoring. The 3 LSM Spine specs are still unregistered.

Additionally, Soraya's round-57 BP-16 cross-check triage on the Spine cluster identified a **candidate-P0 TLA+/code-drift gap** on `SpineAsyncProtocol.tla` that warrants paired-tool coverage with FsCheck.

## Two bounded subitems (separable; both ship within B-0709 umbrella)

### Subitem (a) — Registry-row capture for the 3 Spine specs

Continuation of B-0709 execution payload. Same shape as the 11 already-registered specs.

Per-spec routing (confirmed correct on-disk):

| Spec | Property class | Primary tool | Routing |
|---|---|---|---|
| `tools/alloy/specs/Spine.als` | Structural shape (LSM levels, sorted runs, no-cycles) | Alloy | Correctly routed |
| `tools/tla/specs/SpineAsyncProtocol.tla` | State-machine safety + concurrency (async compaction/flush interleavings) | TLA+ | Correctly routed |
| `tools/tla/specs/SpineMergeInvariants.tla` | State-machine safety invariant (merge preserves sortedness + total-key-set) | TLA+ | Correctly routed |

**Acceptance**: 3 new registry rows in `docs/research/verification-registry.md` citing O'Neil 1996 paper anchor + per-spec preconditions + audit cadence.

**Effort**: S. **CI-gate**: yes (verification-drift-auditor scan should detect on next cadence).

### Subitem (b) — BP-16 cross-check on SpineAsyncProtocol (candidate-P0)

Routing triage by criticality:

- `Spine.als` → P1 (structural drift detectable on review; single-tool sufficient)
- `SpineAsyncProtocol.tla` → **candidate-P0** (concurrent flush/compact interleavings with merge-invariant violation = silent data corruption shape)
- `SpineMergeInvariants.tla` → P1 (merge violation surfaces as failing read-back acceptance test; single-tool sufficient unless implementation non-trivially changes)

**The wrong-tool cost if SpineAsyncProtocol stays single-tool TLA+ with no FsCheck pair**: classic TLA+/code-drift — the spec models an abstraction of the F# `Spine` implementation; if the implementation evolves (e.g., compaction-scheduling change) without TLA+/spec update, the spec still passes TLC but no longer constrains real code. FsCheck property running actual `Spine` insert/compact/read under threading would catch the drift in CI.

This is the same gap class round 42 named for `InfoTheoreticSharder` pre-triple (now closed by the existing pattern).

**Acceptance**: FsCheck property file `tests/Tests.FSharp/Algebra/Spine.AsyncProtocol.Properties.fs` (mirrors PR #4780's residuated-lattice analog shape — just shipped 980/980) exercising the real `Spine` F# implementation under simulated async flush/compact interleavings, asserting the TLA+ merge invariants on the executing code path.

**Effort**: S. **CI-gate**: yes once added.

## TLA+-hammer guard

N/A for subitem (a) — registry capture, not tool routing.

For subitem (b): the guard fires the **INVERSE** direction (consistent with B-0712 framing). TLA+ IS the right primary for SpineAsyncProtocol (concurrent flush/compact interleavings); but the candidate-P0 criticality argues for paired-tool coverage to close the TLA+/code-drift class specifically. FsCheck-only would miss the interleavings; TLA+-only misses the code-drift. Both compose; neither suffices alone.

## Coverage impact

After both subitems land:

- 3 new registered specs (Spine cluster); portfolio numerator +3
- 1 new FsCheck cross-check on candidate-P0 spec; BP-16 coverage at +1 paired-tool
- TLA+/code-drift class closed on async compaction (silent data corruption shape prevented)

## Composes with

- [`docs/backlog/P2/B-0709-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md`](B-0709-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md) — umbrella
- [`docs/backlog/P3/B-0716-soraya-round53-b0709-scope-correction-3-lsm-spine-specs-2026-05-23.md`](../P3/B-0716-soraya-round53-b0709-scope-correction-3-lsm-spine-specs-2026-05-23.md) — B-0709 scope-correction (PR #4791 MERGED 00:06:45Z); B-0717 IS the follow-up execution payload + cross-check triage
- [`tools/alloy/specs/Spine.als`](../../../tools/alloy/specs/Spine.als) + [`tools/tla/specs/SpineAsyncProtocol.tla`](../../../tools/tla/specs/SpineAsyncProtocol.tla) + [`tools/tla/specs/SpineMergeInvariants.tla`](../../../tools/tla/specs/SpineMergeInvariants.tla)
- [`docs/research/verification-registry.md`](../../research/verification-registry.md)
- PR #4780 (peer Otto implementing B-0711 Residuated FsCheck — same shape as subitem (b) needs)
- B-0710 / B-0711 / B-0712 (sibling cross-check rows from rounds 43-45)
- `memory/persona/soraya/NOTEBOOK.md` round-57 entry (pending append)

## Substrate-honest framing

Subitem (a) is mechanical follow-up to B-0716 (which corrected the enumeration); B-0716 did NOT execute the registry-row authoring. Subitem (b) is genuinely-new BP-16 routing triage that B-0709/B-0716 didn't surface — it required the LSM Spine cluster to be in-scope before the criticality assessment could run.

This row is filed under P2 because subitem (b) is candidate-P0 in BP-16 terms (silent data corruption shape on async compaction); the registry-row work in subitem (a) is P3-shaped but bundles cleanly with (b) under the Spine-cluster umbrella.

Per Aaron's 2026-05-23 21:30Z policy-flip: Otto auto-ships immediately. Kenji owns execution.
