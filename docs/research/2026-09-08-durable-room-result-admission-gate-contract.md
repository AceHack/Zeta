# Durable-Room Finite Result-Admission Gate Contract v1

**Status:** implementation contract; **not yet implemented or measured**.
**Register:** `toy` / source-owned finite evidence admission.
**Parents:** [`2026-09-08-maximal-decorrelation-reconciliation-measurement-contract.md`](2026-09-08-maximal-decorrelation-reconciliation-measurement-contract.md) and [`2026-09-08-durable-room-maximal-decorrelation-reconciliation-preflight-contract.md`](2026-09-08-durable-room-maximal-decorrelation-reconciliation-preflight-contract.md).

> **Key rule.** This gate decides only whether a complete, independently replayed finite preflight receipt set is admissible for a _later_ result-receipt review. It does **not** select a catalogue entry, calculate an optimum, or turn a preflight value into a claim about Tsirelson, ARC, agents, communication, or society.

## 1. Purpose

The merged durable-room preflight demonstrates source-owned F#/Python canonical-receipt agreement for a three-entry catalogue. The parent measurement contract permits a later finite-result receipt only after independently verified records for every catalogue entry exist. This gate inserts an explicit admission boundary between those facts.

The gate accepts only a finite `zeta.max-decorrelate-reconcile/preflight/v1` receipt set whose candidate list is exactly the pre-registered ordered catalogue `identity/v1`, `replace-uncertainty/v1`, and `retract-replace/v1`. It emits an admission state, not a selected candidate.

## 2. Required input bundle

<!-- prettier-ignore -->
| Input | Admission requirement |
|---|---|
| Preflight source revision | The F# emitter, Python verifier, frozen preflight contract, and test vectors are checked out at one declared immutable Git revision. |
| Independent receipts | The raw F# stdout bytes and independently computed Python bytes are identical, including their canonical receipt SHA-256. |
| Carrier and anchor | `carrierId`, schema, canonical anchor bytes, and anchor SHA-256 match the declared durable-room fixture. |
| Catalogue completeness | All three ordered entries are present; their IDs, canonical catalogue bytes, and catalogue SHA-256 match the pre-registration. |
| Candidate evidence | Each entry binds its atom sequence, causal-order digest, final view, metric value, reconciliation outcome, and reconciliation witness. |
| Observation and memory | Current-candidate preload is refused; declared prior memory is provenance-visible and accepted. |
| Control manifest | The anchor, metric, witness, catalogue, preload, prior-memory, retraction/order, CHSH-sidecar, canonical-byte, and identity controls have each been observed. |
| Identity | Emitter/verifier identities, source revision, and runtime identities are present and match the input bundle. |

The gate must not read a live room, network source, hosted game, private task, agent policy, reward, or undeclared cache. It receives only the declared immutable input bundle.

## 3. Canonical admission receipt

The gate emits a canonical UTF-8 `zeta.max-decorrelate-reconcile/admission/v1` receipt:

```text
schema, sourceRevision, preflightReceiptSha256
carrierId, anchorBytesSha256, catalogueSha256
orderedCandidateEvidenceDigests
independentReceiptAgreement
controlManifestDigest
admissionState
refusalCodes | empty
canonicalReceiptSha256
```

The only admission states are `eligible-for-separate-result-review`, `ineligible`, and `unmeasured`.

`eligible-for-separate-result-review` says only that the bounded input set is complete and independently replayed. It does not imply that any candidate is preferred, maximal, useful, safe, meaningful, or transferable.

## 4. Required faults

<!-- prettier-ignore -->
| Fault | Required gate behavior |
|---|---|
| One candidate omitted or reordered | `ineligible`; retain the observed catalogue mismatch. |
| F#/Python receipt byte or digest mismatch | `unmeasured`; do not infer a candidate result. |
| Missing causal-order or reconciliation witness | `ineligible`. |
| Any unresolved final candidate state | `unmeasured`. |
| Anchor, metric, or runtime-identity substitution | `ineligible`. |
| Current-candidate preload control absent or non-refusing | `ineligible`. |
| Declared prior-memory control absent or rejected | `ineligible`; continual memory must not be silently prohibited. |
| CHSH sidecar present or selection field injected | `ineligible`; this gate requires `chshSidecar: absent` and no selection field. |
| Missing control observation | `unmeasured`, never a default pass. |

## 5. Deliberate non-selection boundary

This gate does not compute `bestPassingCandidate`, sort by `decorrelationScore`, resolve ties, or label any entry an optimum. The parent contract's finite selection rule, if ever used, requires a separate reviewed result-receipt contract after this gate has admitted a concrete immutable bundle.

The gate makes no claim about a continuum maximum, `2√2`, quantum behavior, semantic communication, mutual empowerment, online learning quality, ARC performance, model size, or societal objectives.

## References

- [`2026-09-08 maximal decorrelation reconciliation measurement contract`](2026-09-08-maximal-decorrelation-reconciliation-measurement-contract.md)
- [`2026-09-08 durable-room preflight contract`](2026-09-08-durable-room-maximal-decorrelation-reconciliation-preflight-contract.md)
- [`DurableRoomMaxDecorrelationPreflight.fsx`](../../src/Research.FSharp/DurableRoomMaxDecorrelationPreflight.fsx)
- [`durable_room_max_decorrelation_preflight.py`](../../src/Core.Python/src/zeta/durable_room_max_decorrelation_preflight.py)
