# Durable-Room Maximal-Decorrelation/Reconciliation Preflight Contract v1

**Status:** implementation preflight contract; **not yet implemented or measured**.
**Register:** `toy` / source-owned finite conformance.
**Parent boundary:** [`2026-09-08-maximal-decorrelation-reconciliation-measurement-contract.md`](2026-09-08-maximal-decorrelation-reconciliation-measurement-contract.md).

> **Key rule.** This preflight can establish only that two independently authored emitters agree on one declared finite durable-room receipt calculation and its fault controls. It cannot establish a continuum optimum, a Tsirelson value, quantum behavior, mutual empowerment, agent quality, ARC ability, or societal communication.

## 1. Purpose and scope

The parent contract requires an independently checkable finite carrier before any result may name a best passing catalogue entry. This document freezes the smallest source-owned candidate: `zeta.durable-room-evidence/v1`, as implemented by `durable-room-evidence.ts` at the declared Git revision.

The preflight is **score-free**. It must emit every catalogue entry and its verification status, but it must not select a winner, rank an agent, make an ARC call, access network material, train a learner, or report a claimed optimum. Its only positive result label is `conformant-preflight`.

## 2. Pinned finite anchor corpus

The anchor consists of the exact `RoomEvidenceReceipt` fields in the DRE fixture below. Its canonical bytes are the UTF-8 output of the existing `encodeRoomEvidenceReceipt` function; the implementation receipt must carry those bytes and their SHA-256 digest, not a hand-retyped serialization.

<!-- prettier-ignore -->
| Field | Pinned value |
|---|---|
| `schema` | `zeta.durable-room-evidence/v1` |
| `roomId` / `roomFingerprint` | `chip9-arc-room` / `room:arc-v1` |
| `channelFingerprint` | `channel:udp-a` |
| `spectrumSlice` / `signatureSplit` | `rainbow:blue` / `split:agent-a` |
| `runId` / `episodeId` / `factId` | `run-1` / `episode-1` / `fact-1` |
| `sourceArtifact` | `sha256:trajectory-1` |
| `weight` | `+1` |
| `uncertainty` | `meanPpm=650000`, `precisionPpm=20` |
| `solved`, `actionCount`, `elapsedMs` | `true`, `11`, `200` |
| `actionBudget`, `timeBudgetMs` | `32`, `500` |

The corpus also names the exact signed retraction of this atom and the DRE-3 replacement pair from `durable-room-evidence.test.ts`. No other room, task, transport payload, or external data is lawful input. A current-candidate payload becomes readable only at the receipt’s declared first lawful observation; injected answer-bearing material before that event is refused.

## 3. Finite catalogue and declared calculations

The ordered catalogue is `identity/v1`, `replace-uncertainty/v1`, and `retract-replace/v1`.

<!-- prettier-ignore -->
| Candidate | Lawful transform | Required reconciliation predicate | Expected status |
|---|---|---|---|
| `identity/v1` | Retain the positive anchor atom unchanged. | The independently folded view is resolved and equals the anchor’s solved/action/uncertainty tuple. | `pass` |
| `replace-uncertainty/v1` | Use the DRE-3 `−1` old-atom plus `+1` replacement atom. | The fold is resolved and exactly equals the declared replacement tuple. | `pass` |
| `retract-replace/v1` | Deliver the DRE-3 retraction before its matching old assertion, then the assertion and replacement. | The intermediate fold is explicitly unresolved; the complete causal replay resolves to the replacement tuple. | `pass` |

`decorrelationScore/v1` is the non-negative integer

```text
abs(meanPpm(anchor) - meanPpm(candidateResolvedView))
+ abs(precisionPpm(anchor) - precisionPpm(candidateResolvedView))
+ abs(actionCount(anchor) - actionCount(candidateResolvedView))
```

The value is a declared finite state-distance only. It has no semantic, physical, or social interpretation. The preflight records the values but makes **no best-candidate selection**. `chshSidecar` is exactly `absent` and must not be introduced by either implementation.

## 4. Independent roles and canonical receipt

The F# emitter and independently authored Python verifier must each implement the pinned corpus, ordered catalogue, integer metric, reconciliation predicate, canonical UTF-8 JSON receipt, SHA-256 digest, and result ordering without invoking the other language or the TypeScript fold implementation at runtime. They may use the committed TypeScript fixture only as a source specification.

Each receipt must bind: implementation identity and revision, runtime identity, canonical anchor bytes and SHA-256, canonical catalogue bytes and SHA-256, candidate ID, atom sequence, causal-order digest, intermediate unresolved status where required, final folded view, metric value, reconciliation witness, `chshSidecar: absent`, and the receipt digest. The wrapper must fail if the independent receipt bytes or digest differ.

## 5. Required observed faults

<!-- prettier-ignore -->
| Fault | Required observation |
|---|---|
| Anchor-byte or anchor-hash mutation | Verification refuses the receipt. |
| Metric mutation | The reported metric changes or a metric-witness mismatch is refused. |
| Reconciliation-witness mutation | The candidate becomes refused or unresolved. |
| Catalogue omission or reordering | The catalogue digest changes and comparison is refused. |
| Current-candidate preload | Refused before the first lawful observation. |
| Declared prior-memory atom | Accepted and provenance-visible; it is not globally banned. |
| Retraction before assertion | Retained as unresolved, never silently negative or reconciled. |
| Delivery-order mutation | Produces the same complete canonical outcome or an explicit unresolved state. |
| CHSH-sidecar injection | Refused because this preflight requires `absent`. |
| Cross-language bridge | The wrapper refuses any F#/Python process bridge or receipt reuse. |

## 6. Decision boundary

The only admissible preflight outcomes are `conformant-preflight`, `unmeasured`, and `refused`. A successful preflight authorizes only a separately reviewed result-receipt implementation. It does not authorize winner selection, a claim that one candidate maximally decorrelates anything beyond this finite catalogue, or any claim about `2√2`, ARC, intelligence, agents, language, physics, or society.

## References

- [`durable-room-evidence.ts`](../../src/Core.TypeScript/observe/room/durable-room-evidence.ts)
- [`durable-room-evidence.test.ts`](../../src/Core.TypeScript/observe/room/durable-room-evidence.test.ts)
- [`maximal-decorrelation reconciliation measurement contract`](2026-09-08-maximal-decorrelation-reconciliation-measurement-contract.md)
