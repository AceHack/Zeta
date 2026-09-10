# Durable-Room Result-Admission Readiness Audit

**Status:** observed `unmeasured`; **no candidate selected**.
**Register:** `toy` / source-owned finite evidence audit.
**Audit revision:** `28f3d2c8ca7200aaeaaf3d240be87d8b602c1fb2`.

> **Recommendation:** Do **not** implement a finite candidate-selection receipt yet. The independently replayed preflight is byte-conformant, but it does not yet carry all three admission fields required by the merged gate: `controlManifestDigest`, `observationBarrierReceipts`, and `orderedCandidateEvidenceDigests`.

## 1. Scope

This audit applies the merged [`admission/v1` gate](2026-09-08-durable-room-result-admission-gate-contract.md) to the merged durable-room F#/Python preflight. It examines only the declared immutable source-owned bundle. It does not access a live room, network source, hosted game, private task, policy, reward, or undeclared cache.

The audit does not rank catalogue entries, calculate `bestPassingCandidate`, alter the existing metric, or report an optimum. `unmeasured` is the correct outcome when required admission evidence is absent.

## 2. Reproducible observation

At the declared immutable audit revision, the F# emitter and independently authored Python renderer produced byte-identical `zeta.max-decorrelate-reconcile/preflight/v1` receipts. The receipt's canonical SHA-256 was:

```text
bc8eed9413dd93df92c8f920d8ccfd464ce23d40ffad22701869e89d7dfd259a
```

<!-- prettier-ignore -->
| Admission requirement | Observation | Audit status |
|---|---|---|
| Independent raw receipt agreement | F# stdout bytes equal independently computed Python bytes. | Present |
| Pinned source revision and receipt digest | Both bind `28f3d2c8…`; the canonical receipt digest recomputes. | Present |
| Carrier, anchor, and three-entry catalogue | The declared durable-room carrier, anchor hash, and ordered `identity`, `replace-uncertainty`, `retract-replace` catalogue verify. | Present |
| Candidate evidence | Each entry carries atom sequence, causal-order digest, final view, integer score, pass outcome, and witness. | Present |
| Continual-memory and CHSH boundaries | Declared `chip8-orbit/v1` prior memory is visible; `chshSidecar` is `absent`; no selection field is present. | Present |
| Control manifest digest | No `controlManifestDigest` exists in the receipt. | Missing |
| Observation-barrier receipts | No `observationBarrierReceipts` exists in the receipt. | Missing |
| Ordered candidate-evidence digests | No `orderedCandidateEvidenceDigests` exists in the receipt. | Missing |

## 3. Result

The admission state is:

```text
unmeasured
```

This is not a failed reconciliation experiment. It is an evidence-completeness refusal. The current preflight proves raw-byte agreement and named fault controls under its own contract, but its carrier does not yet bind the gate-required manifest, barrier, and ordered candidate-evidence digests into one admissible result bundle.

## 4. Narrow corrective unit

The next permissible work is a separate **admission-completion preflight**. It must add the three missing fields to both independently authored renderers, bind them into canonical bytes and the receipt hash, and demonstrate mutations for each field. It must remain score-free and preserve the existing catalogue, metric, reconciliation predicate, prior-memory acceptance, current-candidate preload refusal, retraction/order behavior, and `chshSidecar: absent` boundary.

Only after that corrected preflight is independently replayed and this gate reports `eligible-for-separate-result-review` may a separate review consider a finite result-receipt contract. No such result contract is authorized by this audit.

## References

- [`2026-09-08 durable-room result-admission gate contract`](2026-09-08-durable-room-result-admission-gate-contract.md)
- [`2026-09-08 durable-room preflight contract`](2026-09-08-durable-room-maximal-decorrelation-reconciliation-preflight-contract.md)
- [`DurableRoomMaxDecorrelationPreflight.fsx`](../../src/Research.FSharp/DurableRoomMaxDecorrelationPreflight.fsx)
- [`durable_room_max_decorrelation_preflight.py`](../../src/Core.Python/src/zeta/durable_room_max_decorrelation_preflight.py)
