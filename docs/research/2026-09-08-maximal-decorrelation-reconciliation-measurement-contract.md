# Maximal Decorrelation Subject to Declared Reconciliation — Measurement Contract v1

**Status:** implementation contract; **not yet implemented or measured**.
**Register:** `toy` / falsifiable finite-protocol measurement.
**Source:** Aaron’s 2026-09-08 formulation, _“maximal decorrelation where you can still communicate,”_ carried in the pending [maximal-decorrelation ferry][otto-ferry].
**Decision:** do not derive, encode, target, or discharge `2√2`. Measure a declared finite carrier first.

> **Key rule.** This contract measures the greatest **catalogued** decorrelation whose declared reconciliation predicate passes. It does not claim a continuum optimum, monotonicity, a Tsirelson bound, a quantum process, agent entanglement, mutual empowerment, or a societal objective.

## 1. Purpose and exact boundary

Aaron’s formulation is a constrained extremum rather than a loose two-sided band:

```text
maximize    declared decorrelation
subject to  declared reconciliation still succeeds
```

That shape is worth testing. It is **not** sufficient to select a particular numerical constant. Existing Zeta code establishes an exact integer CHSH identity and a separate ideal-amplitude ceiling oracle; neither one measures whether two protocol participants can reconcile a diverged carrier.[^tsirelson] [^bipartite] The proposed finite experiment must therefore keep three quantities separate:

<!-- prettier-ignore -->
| Quantity | Contract status | What it may say | What it must not say |
|---|---|---|---|
| `decorrelationScore` | A declared deterministic function of two observed finite carrier states. | How far apart the candidate states are under this specific metric. | That every kind of semantic, social, or physical difference has the same value. |
| `reconciles` | A declared Boolean predicate over lawful observations and an explicit anchor set. | Whether the two parties meet this run’s reconstruction criterion. | That they share intentions, beliefs, meanings, or free will. |
| `chshSidecar` | Optional separately measured finite-sample statistic. | An independently reported correlation readout if its own carrier and uncertainty protocol are satisfied. | The objective, the reconciliation predicate, or an interchangeable representation of `decorrelationScore`. |

The existing mutual-empowerment proposal remains a distinct, unimplemented interaction-level design: its proposed objective is joint declared option gain, subject to both parties’ trust floors.[^empowerment] This contract does not promote a successful finite reconciliation run into an empowerment score.

## 2. Required pre-registration

Every run must commit, as canonical UTF-8 bytes, to the following before candidate execution begins. Missing or post-hoc fields make the result **undeclared**, not successful.

<!-- prettier-ignore -->
| Field | Normative requirement |
|---|---|
| `carrierId` and `carrierSchemaVersion` | Name the source-owned finite protocol carrier and its exact schema. The carrier cannot be an unbounded narrative, an ambient process, or an official ARC task. |
| `anchorBytesSha256` | Hash the shared anchor corpus and its canonical byte encoding. Neither participant may read an undeclared external source during a run. |
| `catalogue` | A finite, ordered list of candidate descriptors with explicit IDs; each descriptor specifies its transform, seed, and all public parameters. “Greatest” means greatest passing entry in this finite list only. |
| `decorrelationDefinition` | Versioned metric identifier, domain, range, byte encoding, and rule for ties/non-finite values. The value must be recomputable solely from declared observed state. |
| `reconciliationDefinition` | Versioned predicate identifier and all thresholds, anchors, permitted messages, timeout/tick envelope, and exact success condition. |
| `observationBarrier` | The earliest lawful event at which each candidate carrier becomes readable. Pre-barrier access is rejected. |
| `implementationIdentities` | Emitter and independently authored verifier identities, source revisions, runtime versions, and raw-byte receipt digests. |
| `chshSidecarDefinition` | Either `absent` or a separately versioned finite-sample estimator with sample count, uncertainty interval, settings, and loophole/profile declaration. |

No hidden reward, externally supplied byte cap, private task material, or inferred participant intent may become part of the objective or constraint. The caller-owned tick envelope bounds duration; it does not manufacture a passing reconciliation outcome.

## 3. Candidate execution and receipt

For each catalogue entry, two named roles receive only the committed anchor bytes and the candidate’s lawful messages. Each role emits an append-only event sequence. Correction is represented as an exact `−1` retraction of a prior atom plus a separately identified `+1` replacement; it never rewrites the previous atom in place.

The canonical result carrier is `max-decorrelate-reconcile/v1` and contains, at minimum:

```text
version
runId
carrierId, carrierSchemaVersion, anchorBytesSha256
catalogueSha256, candidateId, candidateParametersSha256
decorrelationDefinition, decorrelationScore
reconciliationDefinition, reconciliationOutcome, reconciliationWitnessSha256
roleEventChainDigests, causalOrderDigest
observationBarrierReceipts
retractionAndReplacementAtoms
emitterIdentity, verifierIdentity, runtimeIdentities
chshSidecar | absent
canonicalReceiptSha256
```

The receipt must record an explicit `unresolved` state when an atom’s predecessor is unavailable. It may not discard, reorder with a guess, or silently treat an unresolved correction as reconciled.

## 4. Decision rule

Let `P` be the set of catalogue entries whose independently verified receipt has `reconciliationOutcome = pass`. The primary result is:

```text
bestPassingCandidate = argmax_{c ∈ P} decorrelationScore(c)
```

with deterministic catalogue-ID tie breaking. If `P` is empty, the result is `no-passing-candidate`. If any required receipt is missing, malformed, unresolved, non-canonical, or disagreement exists between independent verifiers, the result is `unmeasured`.

The result must list every catalogue entry, including failures, rather than report only the selected candidate. A measured finite optimum does **not** imply a global optimum or identify a value with `2√2`; that would require an additional mathematical bridge and independent evidence not present here.

## 5. Required controls

The first implementation is admissible only when all controls below are observed. A green unit test that cannot be falsified by these mutations is insufficient.

<!-- prettier-ignore -->
| Control | Required observation | Refusal or failure condition |
|---|---|---|
| Independent replay | Emitter and verifier serialize identical canonical receipt bytes for the same declared catalogue. | A verifier calls the emitter’s digest, canonicalization, or decision helper. |
| Metric mutation | Mutating an observed candidate state changes the declared score or causes a metric-witness mismatch. | A constant score or an unbound score still verifies. |
| Reconciliation mutation | Removing a required anchor, permitted message, or matching witness makes the declared predicate fail or unresolved. | A reconciliation result passes without its declared witness. |
| Current-candidate preload | Injecting answer-bearing current-candidate material before its observation barrier is refused. | Pre-barrier material is silently available. |
| Declared prior memory | A declared prior-level or cross-game memory atom is accepted and appears with source, acquisition phase, and availability event. | Legitimate continual memory is globally prohibited or silently omitted. |
| Retraction | A retraction before its asserted predecessor remains unresolved; a valid `−1` plus replacement changes only the derived result. | The historical atom is mutated or an unmatched retraction is absorbed. |
| Order mutation | Permuting delivery order while preserving the same causal atoms either yields the same canonical derived result or explicitly records unresolved dependencies. | Arrival order manufactures a false causal order or a different unreported outcome. |
| Catalogue omission | Deleting a failing candidate changes the catalogue hash and refuses comparison to the original run. | A selectively reported winner remains comparable to the full catalogue. |
| CHSH separation | Supplying, changing, or omitting the optional sidecar cannot change `decorrelationScore`, `reconciles`, or the selected candidate. | A CHSH value silently becomes the objective or acceptance predicate. |

## 6. Explicit non-claims and next step

This contract does not measure human communication, semantic grounding, consciousness, societal mutual empowerment, quantum nonlocality, general intelligence, ARC ability, or a physical origin of Tsirelson’s bound. It also does not turn the existing ideal `WSet<ℂ>` ceiling calculation into agent evidence.[^bipartite]

The next engineering unit, after review, is a **source-owned, score-free** F#/Python preflight over one finite carrier and a pinned candidate catalogue. It must first establish raw-byte receipt agreement and every listed control. Only then may a separately reviewed result receipt report a finite best-passing candidate. A no-passing-candidate or `unmeasured` result is an equally valid result.

## References

[^tsirelson]: [`src/Core/Tsirelson.fs`](../../src/Core/Tsirelson.fs) — exact integer-matrix CHSH identity, with irrationality at readout only.

[^bipartite]: [`src/Core/BipartiteMachZehnder.fs`](../../src/Core/BipartiteMachZehnder.fs) — explicitly labels its `WSet<ℂ>` result an ideal-amplitude ceiling, not a claim that agents are qubits.

[^empowerment]: [`2026-08-09 mutual-empowerment bound`](2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md) — design proposal separating interaction-level option gain from calibration.

[otto-ferry]: https://github.com/Lucent-Financial-Group/Zeta/pull/17026
