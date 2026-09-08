# Durable-Room Finite Result-Receipt Contract v1

**Status:** implementation contract; **no result receipt has been emitted**.
**Register:** `toy` / source-owned finite catalogue observation.
**Parents:** `zeta.max-decorrelate-reconcile/admission/v1` and the durable-room preflight contract.

> **Key rule.** A result receipt may report only an observed outcome over the already frozen three-entry catalogue and one named immutable admission receipt. It does not establish a continuum optimum, ARC ability, physics, social communication, mutual empowerment, or general intelligence.

## 1. Required immutable inputs

The implementation must receive one canonical `admission/v1` receipt whose state is `eligible-for-separate-result-review`, the exact source revision named in that receipt, and the same source-owned preflight bundle. The receipt must bind all thirteen preflight controls, canonical F#/Python agreement, the fixed carrier and anchor, the fixed ordered catalogue, the fixed integer distance metric, reconciliation witnesses, declared prior-memory acceptance, current-candidate preload refusal, and `chshSidecar: absent`.

Any absent, mismatched, unresolved, reordered, substituted, or otherwise unverified input emits `unmeasured`; it must never be repaired by default, guessed from source, or silently replaced.

## 2. Canonical result receipt

The canonical UTF-8 `zeta.max-decorrelate-reconcile/result/v1` receipt includes:

```text
schema, sourceRevision, admissionReceiptSha256
carrierId, anchorBytesSha256, catalogueSha256
orderedCandidateEvidenceDigests, controlManifestDigest
resultState, observedCatalogueEntries
noPassingCandidateReason | empty
canonicalReceiptSha256
```

`resultState` is exactly one of:

| State                       | Meaning                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `observed-finite-catalogue` | Every immutable input is verified; the receipt reports each frozen catalogue entry’s already-declared metric and reconciliation outcome. |
| `no-passing-candidate`      | Every immutable input is verified and no entry satisfies the already-declared reconciliation predicate.                                  |
| `unmeasured`                | An admission or evidence requirement is absent, inconsistent, unresolved, or unverifiable.                                               |

The receipt reports the entire ordered catalogue. It must not emit `bestCandidate`, `winner`, `argmax`, an optimization result, a tie-break, or a claim that any finite entry is globally maximal.

## 3. Required controls

The implementation must reject or emit `unmeasured` for admission-receipt substitution, result/admission revision mismatch, candidate omission or reorder, metric/witness substitution, unresolved final state, missing prior-memory acceptance, missing current-candidate preload refusal, absent control observation, CHSH-sidecar injection, and any selection field injection. F# emission and independently authored Python verification must agree on raw canonical bytes and reject each mutation.

## 4. Non-claims

This contract does not authorize ARC evaluation, policy training, online-learning quality claims, agent ranking, a physical interpretation, `2√2` targeting, a societal objective, or transfer/generalization claims. It is only the next evidence boundary for a declared finite source-owned catalogue.

## References

- [`Durable-room result-admission gate contract`](2026-09-08-durable-room-result-admission-gate-contract.md)
- [`Durable-room preflight contract`](2026-09-08-durable-room-maximal-decorrelation-reconciliation-preflight-contract.md)
