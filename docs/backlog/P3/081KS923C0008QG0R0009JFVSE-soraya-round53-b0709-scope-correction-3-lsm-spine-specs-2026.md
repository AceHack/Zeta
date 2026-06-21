---
id: 081KS923C0008QG0R0009JFVSE
priority: P3
status: open
title: "Soraya round-53 scope-correction — 081KS923C0008QG0R0032VJZPF enumeration under-counted by 3 LSM-tree Spine specs (Spine.als + SpineAsyncProtocol.tla + SpineMergeInvariants.tla)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: scope-correction
composes_with:
  - docs/backlog/P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md
  - tools/alloy/specs/Spine.als
  - tools/tla/specs/SpineAsyncProtocol.tla
  - tools/tla/specs/SpineMergeInvariants.tla
  - docs/research/verification-registry.md
---

# 081KS923C0008QG0R0009JFVSE — 081KS923C0008QG0R0032VJZPF scope-correction: 3 LSM-tree Spine specs missed in original enumeration (Soraya round-53 hand-off)

## Origin

Soraya's eighth autonomous routing tick (2026-05-23 — round 53, post-PR #4790 merge of 081KS923C0008QG0R002CVSTJV). NOT a duplicate of 081KS923C0008QG0R0032VJZPF; an explicit scope-correction sub-finding.

## Finding

081KS923C0008QG0R0032VJZPF (round 42) enumerated **11 unregistered specs**. Soraya round 53 re-audit identified **14 unregistered**: 081KS923C0008QG0R0032VJZPF missed the **LSM-tree Spine cluster** — three artifacts with established literature anchor (O'Neil, Cheng, Gawlick, O'Neil 1996 *Acta Informatica* LSM paper):

| Spec | Tool | Target | Anchor |
|---|---|---|---|
| `tools/alloy/specs/Spine.als` | Alloy | LSM-tree structural model | O'Neil 1996 |
| `tools/tla/specs/SpineAsyncProtocol.tla` | TLA+ | Spine async protocol behavioural model | O'Neil 1996 |
| `tools/tla/specs/SpineMergeInvariants.tla` | TLA+ | Spine merge invariants safety | O'Neil 1996 |

None of the 3 appear in `docs/research/verification-registry.md`; none appear in 081KS923C0008QG0R0032VJZPF's enumeration list.

## Coverage ratio correction

081KS923C0008QG0R0032VJZPF (round 42) reported coverage ratio **0.52** with the framing "7 registered / 11 unregistered". That framing was incomplete on both axes: the enumeration missed the LSM-tree Spine cluster, and the denominator arithmetic mixed file-counts with theorem-entry counts.

Round-53 on-disk truth (file-level, uniform unit-of-measure):

- **19 TLA+ specs** in `tools/tla/specs/*.tla`
- **3 Alloy specs** in `tools/alloy/specs/*.als`
- **2 Lean spec files** in `tools/lean4/` (excluding the `Lean4.lean` library root) — `Lean4/DbspChainRule.lean` + `ImaginaryStack/ToyModel.lean`
- **24 verification artifacts total**
- **6 registered files** in `docs/research/verification-registry.md` (5 TLA+ files + `DbspChainRule.lean` carrying 2 theorem entries)
- **18 unregistered files** (24 − 6) — 081KS923C0008QG0R0032VJZPF enumerated 11 of these; this row surfaces the 3 missed Spine specs (Spine.als + SpineAsyncProtocol.tla + SpineMergeInvariants.tla), bringing the visible-to-this-PR count to 14; the remaining 4 (e.g., `ImaginaryStack/ToyModel.lean`) are tracked under sibling Soraya hand-offs (081KS923C0008QG0R002RH3EH8 etc.)
- **File-level coverage ratio for round 53: 6 / 24 ≈ 0.25** — worse than 081KS923C0008QG0R0032VJZPF's claimed 0.52, correct direction (auditor surfacing latent debt that the round-42 enumeration also under-counted)

## Distinct from prior session findings

This is a **scope-correction** on an existing row (081KS923C0008QG0R0032VJZPF), NOT a new umbrella. Specifically:

- 081KS923C0008QG0R0032VJZPF is the umbrella (round 42); this row amends its enumeration without superseding it
- 081KS923C0008QG0R003GHCG1P/081KS923C0008QG0R0005VM4FB/081KS923C0008QG0R001N2RSGJ (rounds 43-45) — different cross-check axes
- 081KS923C0008QG0R002RH3EH8 (round 50) — Lean exploratory artifact (different artifact)
- 081KS923C0008QG0R000ECG5EC (round 51) — TLA+ runnability (different axis)
- 081KS923C0008QG0R002CVSTJV (round 52) — Lean axiom-registry (different artifact + scope)

P3 priority because 081KS923C0008QG0R0032VJZPF is already filed and Kenji owns the umbrella; integration-time cost of authoring the Spine rows alongside the other 11 is near-zero.

## Routing decision (Soraya)

- **Primary tool**: existing TLA+/TLC for `SpineAsyncProtocol` + `SpineMergeInvariants`; existing Alloy for `Spine.als` (no tool change needed — failure is at registry layer, identical class to 081KS923C0008QG0R0032VJZPF/081KS923C0008QG0R002RH3EH8/081KS923C0008QG0R002CVSTJV)
- **Cross-check**: warranted only after registry rows land (per BP-16 cross-check triage)
- **Wrong-tool cost at TOOL axis**: zero (tool choices on-disk are correct)
- **Cost at REGISTRY axis**: the auditor `verification-drift-auditor` cannot flag future Class 1/2/3 drift on 3 specs that aren't even registered as needing audit

## TLA+-hammer guard

N/A — finding is enumeration completeness on existing umbrella, not tool routing. On-disk tool choices for Spine cluster are correct (Alloy for structural / TLA+ for behavioural; both appropriate).

## Acceptance criteria

1. 081KS923C0008QG0R0032VJZPF's body amended (in-place edit OR follow-up commit) to enumerate 14 unregistered specs instead of 11 — add Spine cluster (Spine.als + SpineAsyncProtocol.tla + SpineMergeInvariants.tla)
2. When Kenji executes 081KS923C0008QG0R0032VJZPF, all 14 rows land in `verification-registry.md` (not just the original 11)
3. Each Spine row cites O'Neil 1996 paper anchor + brief preconditions diff
4. Coverage ratio metric refreshed in 081KS923C0008QG0R0032VJZPF's body using file-level uniform unit-of-measure: 6 / 24 ≈ 0.25 baseline for round 53 (correcting 081KS923C0008QG0R0032VJZPF's mixed-unit 0.52)
5. `verification-drift-auditor` skill can now audit Spine specs against paper-fidelity (currently invisible to it)

## Effort

S (3 additional rows in the same registry-row-authoring pass that 081KS923C0008QG0R0032VJZPF already requires). Marginal cost over 081KS923C0008QG0R0032VJZPF-as-filed: near-zero.

## Composes with

- [`docs/backlog/P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md`](../P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md) — umbrella row this corrects
- [`tools/alloy/specs/Spine.als`](../../../tools/alloy/specs/Spine.als) — missed target #1
- [`tools/tla/specs/SpineAsyncProtocol.tla`](../../../tools/tla/specs/SpineAsyncProtocol.tla) — missed target #2
- [`tools/tla/specs/SpineMergeInvariants.tla`](../../../tools/tla/specs/SpineMergeInvariants.tla) — missed target #3
- [`docs/research/verification-registry.md`](../../research/verification-registry.md) — destination
- 081KS923C0008QG0R003GHCG1P / 081KS923C0008QG0R0005VM4FB / 081KS923C0008QG0R001N2RSGJ / 081KS923C0008QG0R002RH3EH8 / 081KS923C0008QG0R000ECG5EC / 081KS923C0008QG0R002CVSTJV (sibling Soraya hand-offs this session)
- `memory/soraya/NOTEBOOK.md` round-53 entry (pending append)

## Substrate-honest framing

081KS923C0008QG0R0032VJZPF's enumeration was incomplete (under-counted by 3 specs in the same LSM-tree cluster). This is the auditor's own first-pass-incompleteness, surfaced by re-audit. Filing as scope-correction (not supersession) keeps 081KS923C0008QG0R0032VJZPF's umbrella intact while pinning the actual on-disk truth. The auditor's job is surfacing debt; surfacing the gap in its OWN earlier enumeration is the same discipline applied recursively.
