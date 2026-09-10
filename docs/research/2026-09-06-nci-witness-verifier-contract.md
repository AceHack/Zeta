# Finite NCI Witness Verifier and Recorded-Consensus Deferral Contract

**Status:** Proposed contract.  
**Date:** 2026-09-06.  
**Decision:** The first admissible `nci-preservation` basis is a verifier for one
byte-pinned, bounded TLC run: `NciNonUrgency`. It is not an NCI floor, a proof of
social legitimacy, a policy reward, or permission for automated action.

## 1. Decision and non-claims

This contract makes one narrow predicate available: **does a supplied witness say
that the repository-pinned TLC invocation accepted the supplied finite
`NciNonUrgency` model and configuration?** It retains refusal whenever any
load-bearing identity or recorded verdict differs. A successful predicate is a
fact about this finite state space and this checker invocation only.

The bounded model has three named travelers, one arrival per traveler, an
adversarial urgency bit, and fairness assumptions. It checks `TypeOK` and
`NoCoercion`, and it checks `Responsive` as a temporal property. Its model
comments explicitly declare the scope as bounded and fairness-conditioned.
Nothing in this contract establishes an NCI floor over production executions,
private-variable safety, consent, ethics, urgency policy, a general noninterference
theorem, or an authority to select a policy.

The existing policy-admissibility `nci-preservation` label remains a **defer**
until the caller presents a valid witness under this contract. A valid witness
still cannot change an action, relax another guard, score a policy, or grant
authority; it only changes that one label from `defer-basis-not-implemented` to
`witness-observed` in a caller-owned receipt.

## 2. Pinned subject

The subject is exact raw bytes, not a model name or a prose description. The
first witness class is fully identified by the following values.

| Field                           | Required value                                                      |
| ------------------------------- | ------------------------------------------------------------------- |
| Witness class                   | `zeta.nci-witness/v1`                                               |
| Model id                        | `NciNonUrgency`                                                     |
| Model source                    | `src/Core.TLA/specs/NciNonUrgency.tla`                              |
| Model SHA-256                   | `3444cb6e66904406460143a27fc8932f30aac4b4d78ad37d09f59dfc0822319f`  |
| Configuration source            | `src/Core.TLA/specs/NciNonUrgency.cfg`                              |
| Configuration SHA-256           | `98e80eeef8949ffd598cd29cc7ad44dc70eae1636dea6f3cf2b7954bc62340b9`  |
| Registry source                 | `registry/tlc-models.json`                                          |
| Registry SHA-256                | `44f1ca2feb2c7ba9cab47f06d2fcd60c097ef6d55ed602299f0e1a645791de54`  |
| Registry tier                   | `gate`                                                              |
| Expected result                 | `valid`, exit code `0`                                              |
| Expected exhaustive state count | `512`                                                               |
| TLC jar source                  | `src/Core.TLA/tla2tools.jar`                                        |
| TLC jar SHA-256                 | `71546dff3897a01b0ee4fa64135d9f5e9384d2b7e47b3cc20a16b655b0eb4f86`  |
| Required banner                 | `TLC2 Version 2026.05.18.174321 (rev: 8ba1027)`                     |
| JVM arguments                   | `-Xms64m -Xmx4g -XX:+UseSerialGC`                                   |
| TLC arguments                   | `-workers 1 -config NciNonUrgency.cfg NciNonUrgency`                |
| Deadlock control                | Configuration-owned `CHECK_DEADLOCK FALSE`; no `-deadlock` argument |

The configuration binds `Travelers = {ta, tb, tc}`, `EventBudget = 1`,
`AllowForce = FALSE`, and `TrustUrgency = FALSE`. It requests the state
invariants `TypeOK` and `NoCoercion`, and the temporal property `Responsive`.
Changing any one of these values is a different experiment and must create a
new witness class or version; it cannot reuse this witness label.

The command line is assembled only by the existing pinned registry path:

```text
cd src/Core.TLA/specs && java -Xms64m -Xmx4g -XX:+UseSerialGC \
  -cp ../tla2tools.jar tlc2.TLC -metadir <ephemeral-directory> \
  -workers 1 -config NciNonUrgency.cfg NciNonUrgency
```

`<ephemeral-directory>` names TLC scratch data and is not receipt identity. The
command has no ambient timeout, local clock field, or external input. A caller
may time-bound the enclosing process with an attributed tick envelope, but that
envelope neither changes the checker argv nor turns an incomplete run into a
successful witness.

## 3. Canonical receipt

A receipt is UTF-8 JSON with one final LF. Its object-key order is exactly the
order shown below. Strings are ASCII where field syntax permits; digests are
lowercase hexadecimal. A writer must emit no extra fields. Numeric fields are
base-10 integers, never exponent or decimal forms.

```json
{
  "schema": "zeta.nci-witness/v1",
  "modelId": "NciNonUrgency",
  "modelSha256": "…",
  "configSha256": "…",
  "registrySha256": "…",
  "jarSha256": "…",
  "banner": "…",
  "argv": "…",
  "expect": "valid",
  "exitCode": 0,
  "completion": "Model checking completed. No error has been found",
  "distinctStates": 512,
  "checkedInvariants": ["TypeOK", "NoCoercion"],
  "checkedProperties": ["Responsive"],
  "scope": "bounded-three-traveler-event-budget-one-fairness-conditioned",
  "verdict": "witness-observed"
}
```

The exact implementation expands each ellipsis to the values in Section 2 and
sets `argv` to the canonical invocation line. It does not copy arbitrary
checker output into shared state. `completion` is the required checker marker;
the full local stdout/stderr is diagnostic-only, may contain machine paths, and
is deliberately not content-addressed by this receipt.

Two independently exercised repository surfaces must agree on the receipt bytes:
the F# TLC gate and the TypeScript `run-tlc.ts` CLI. They presently share the
registry/argv constructor and the same TLC implementation, so this agreement is
**cross-surface replay, not independent formal proof or independent checker
diversity**. A later independent checker must be named and benchmarked in a new
contract; it cannot be implied by this one.

## 4. Required verifier behaviour

The verifier loads the raw bytes from a caller-supplied repository root and
rejects before accepting a receipt if any requirement below is not met.

| Condition                                                                                 | Required result                    |
| ----------------------------------------------------------------------------------------- | ---------------------------------- |
| Unknown schema, model id, or unclaimed config                                             | `refuse-unknown-witness`           |
| Any source, registry, or jar digest differs                                               | `refuse-identity-mismatch`         |
| Registry entry is not gate-tier, valid, exit-0, worker-1, or config-owned deadlock policy | `refuse-registry-mismatch`         |
| Java/JAR unavailable before TLC runs                                                      | `defer-toolchain-unavailable`      |
| JVM fails before TLC banner                                                               | `defer-checker-did-not-run`        |
| Banner differs                                                                            | `refuse-checker-identity-mismatch` |
| TLC exit, completion marker, or exhaustive state count differs                            | `refuse-verdict-mismatch`          |
| Receipt is malformed, reordered, incomplete, or has a different canonical byte sequence   | `refuse-receipt-mismatch`          |
| Input differs but an old receipt is supplied                                              | `refuse-stale-witness`             |
| Every required value agrees                                                               | `witness-observed`                 |

`defer-checker-did-not-run` is deliberately distinct from a failing formal
model. A JVM memory reservation failure says nothing about the model, whereas a
completed run with an invariant violation is a result that must remain visible.
Retries, if used, are bounded and permitted only when the JVM did not start;
a model verdict, a wrong banner, or a missing completion marker is never
retried into apparent success.

## 5. Required fault controls

Before a witness can become a committed example, tests must observe all of the
following failures.

| Mutation                                                                  | Must not be accepted as                      |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| Flip `TrustUrgency` to `TRUE` or alter any model byte                     | The existing valid witness                   |
| Change `AllowForce`, `EventBudget`, traveler set, or cfg property list    | The existing valid witness                   |
| Substitute the jar or registry/banners                                    | The existing checker identity                |
| Add `-deadlock`, remove `-config`, or change workers                      | The pinned invocation                        |
| Alter expected state count, completion marker, or exit code               | A valid result                               |
| Remove a receipt field or reorder canonical receipt keys                  | A canonical receipt                          |
| Supply a valid NCI receipt to `recorded-consensus` or a policy score call | Evidence of consent, consensus, or authority |

The existing `TrustUrgency = TRUE` and `AllowForce = TRUE` configurations are
the model's own teeth: they make `NoCoercion` false. That negative result proves
the selected finite witness is discriminating with respect to those guards; it
does not prove other NCI properties or production behaviour.

## 6. Recorded-consensus is specified as a refusal class only

`recorded-consensus` is **not implemented** by this contract. Its future record
must be separate from this NCI witness and must at minimum name: a version;
a subject digest; a closed, immutable participant-record set; every participant
attestation's bound/unbound/refused verdict; an ordinally canonical order;
an explicit rule identifier; a declared decision or observation label; and a
scope/expiry field that is not folded through ambient receive time.

The record cannot use a bare vote count, a self-asserted agent name, an unsigned
attestation, or an unbound attestation as evidence of consensus. It must not
produce an automatic authority grant, override a participant outside its declared
scope, or select a policy. Current behaviour is therefore exactly:

```text
recorded-consensus -> defer-basis-not-implemented
```

Existing `Consensus.decide` is a deterministic vote-resolution function with an
ordinal tie-break; it is not an immutable consent record. `LocalConsensus` is a
finite Gaussian query with caller-supplied beliefs and threshold; it is not a
consensus protocol. Bound attestations prove named-key provenance over an event
set, not event genuineness, consent, agreement, or legitimacy. None may be
silently promoted into this deferred class.

## 7. Integration boundary

The policy-admissibility adapter can consume only this finite output shape:

| Basis label          | Allowed verifier outcome | Adapter result                                       |
| -------------------- | ------------------------ | ---------------------------------------------------- |
| `nci-preservation`   | `witness-observed`       | `witness-observed`; no policy selection effect       |
| `nci-preservation`   | Any refusal or defer     | Same named refusal/defer; no policy selection effect |
| `recorded-consensus` | Any input in v1          | `defer-basis-not-implemented`                        |
| Any other basis      | Any input                | Existing basis refusal/defer                         |

No claim may use `witness-observed` without citing the model id, receipt digest,
finite scope, fairness condition, and checker identity. The model's result can
be rendered in the evidence room only after its independently replayed receipt
and fault controls are committed; its UI must state that it is a finite formal
witness, not a global NCI floor.

## 8. Implementation gate

Implementation may begin only after this contract is merged. The first slice
must be an F# or TypeScript verifier plus a separately authored Python receipt
checker, a committed valid witness, and the mutations in Section 5. It must
invoke the existing registry command and preserve the present gate. It must not
edit the TLA model, its configuration, consensus execution, attestation records,
or policy selection as part of this slice.

## References

1. [NciNonUrgency model](../../src/Core.TLA/specs/NciNonUrgency.tla)
2. [NciNonUrgency configuration](../../src/Core.TLA/specs/NciNonUrgency.cfg)
3. [Pinned TLC registry](../../registry/tlc-models.json)
4. [TLC command-line verifier](../../src/Core.TypeScript/formal-verification/run-tlc.ts)
5. [F# TLC gate](../../tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs)
6. [Bound-attestation verifier](../../src/Core.TypeScript/observe/attestation-record.ts)
7. [Deterministic vote-resolution helper](../../src/Core/Consensus.fs)
8. [Local Gaussian consensus query](../../src/Bayesian/LocalConsensus.fs)
