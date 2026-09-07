# Finite Attestation Consent-and-Expiry Verifier Contract

**Status:** proposed finite verifier contract; no consent artifact, authority grant, vote, or consensus result is admitted by this document.

## Key recommendation

> Implement only a verifier for a **single declared scope**, a **single bound attestation**, and an **explicit caller-supplied evaluation instant**. The verifier may report whether the declared scope is within the signed subject window at that instant. It must never turn that result into permission, authority, a vote, a societal decision, or a claim that a human or agent subjectively consented.

## 1. Purpose and non-purpose

The existing attestation record binds a roster-authorized signing key to a named event set, attestor, attested subject, claim, and subject window. It explicitly does not prove event genuineness, key custody over time, signing time, consent, authority, or consensus. The existing retraction record is an append-only signpost to a mechanically re-derived error; it likewise claims no authority. This contract adds no contrary interpretation.

The proposed `zeta.attestation-consent-expiry-receipt/v1` therefore verifies a narrow **structural relation** only: a caller-declared scope identifier and caller-provided evaluation instant are compared against one already-bound attestation record and that record's signed `windowStart` and `windowEnd` fields. It is a provenance-and-time-scope report. It is not a consent detector.

| Proposed outcome             | Exact meaning                                                                                                                           | Explicit non-meaning                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `within-declared-window`     | The input attestation is bound to the named roster key and the supplied instant is inclusively within the parsed signed subject window. | Consent, permission, authority, approval, safety, truth, or a vote. |
| `expired-declared-window`    | The input is bound, but the supplied instant is after the signed subject-window end.                                                    | Revocation, wrongdoing, withdrawal of consent, or loss of identity. |
| `not-yet-declared-window`    | The input is bound, but the supplied instant precedes the signed subject-window start.                                                  | An invalid signature or a future right.                             |
| `defer-provenance-not-bound` | The input is structurally valid but does not have a roster-bound attestation verdict.                                                   | A negative factual claim about the writer or subject.               |
| `refuse-*`                   | The verifier cannot establish one required finite structural condition.                                                                 | A hidden fallback, default approval, or inferred social outcome.    |

## 2. Frozen v1 subject model

The v1 verifier is deliberately independent of policy admission, MiniGrid, contextual-grid, NCI, scheduler choice, and trust folding. The only candidate subject is a canonical `AttestationRecord` accepted by `verifyAttestationRecord` with status `bound` using a supplied immutable persona-key roster.

The v1 input bundle has exactly the following fields:

```text
schema                  = "zeta.attestation-consent-expiry-receipt/v1"
attestationRecordBytes  = raw UTF-8 bytes of one canonical input record
attestationRecordSha256 = SHA-256 over those exact raw bytes
rosterBytes             = raw UTF-8 bytes of the persona-key roster source set
rosterSha256            = SHA-256 over its canonical manifest, not directory order
scopeId                 = lowercase ASCII token, max 128 bytes
evaluationInstant       = explicit RFC 3339 UTC instant supplied by the caller
evaluationMode          = "local-status-only"
```

`evaluationInstant` is **not** inserted into the signed attestation bytes, the shared evidence fold, an attestation identity, or an event ordering rule. It is a caller-owned observation parameter for a local status query. Two callers using different evaluation instants may report different expiry statuses while retaining the same provenance evidence; this is expected and must never produce a shared-state conflict.

The only v1 `scopeId` admissible to an implementation fixture is `attestation-window-observation`. It names the query being made, not a right granted by a signer. New scopes require a new schema version and a separate contract.

## 3. Required verifier order

The verifier must proceed in this order and stop at the first refusal/defer condition.

1. Verify exact raw-byte hashes and strict JSON shapes for the declared record and roster manifests. A changed or missing input refuses; no parsed-object equality substitute is allowed.
2. Validate the schema, fixed scope identifier, evaluation mode, and RFC 3339 UTC instant. Unknown scope or clock mode refuses.
3. Run the existing bound-attestation verifier with the supplied roster. An `unbound` result defers; a structural or signature refusal refuses with a carried reason.
4. Parse the attestation's signed `windowStart` and `windowEnd`. Inverted or unparsable windows refuse even if a legacy input otherwise reached a bound adapter.
5. Compare the explicit evaluation instant with the subject window and emit only `within-declared-window`, `expired-declared-window`, or `not-yet-declared-window`.
6. Render a canonical UTF-8 receipt with fixed key order and a final newline. The receipt must contain no score, permission, authority, grant, threshold, quorum, voter, consensus, or trust-strength field.

## 4. Retraction and revocation boundary

An existing `attestation-retraction` means only `superseded-not-removed` under its own named mechanical basis. It does not encode consent withdrawal, expiry, or authority. Version 1 therefore has no `revoked` success-like outcome.

If a future design needs a revocation concept, it must first supply a separately bound, subject-specific signed statement whose canonical bytes include: the exact input-record digest, an immutable reason vocabulary, an event-set identity, and a signed scope. The new statement must still be reported as **provenance of a declaration**, not automatically converted into authority or social consensus. That future design is outside v1.

## 5. Test fixture and independence rule

The current corpus is explicitly documented as containing no bound attestation records. A v1 positive-path fixture may therefore be used only if it is labelled `test-only`, supplied with a deterministic verifier adapter, and never placed in the durable observe-event corpus as evidence of a real person or agent's consent.

Production verification must operate over an externally supplied actual record and roster. The implementation must never mint a signing key, fabricate a bound attestation, infer a persona's preference, or fall back from `defer-provenance-not-bound` to an affirmative status.

An independently authored Python checker must validate the same finite fixture and canonical result artifact without importing the TypeScript implementation. Cross-language agreement is a conformance check, not proof of consent.

## 6. Required mutation and refusal controls

The first implementation is admissible only if all controls below are observed.

| Mutation or condition                                                                | Required result                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Changed record byte or roster-manifest byte                                          | `refuse-identity-mismatch` before attestation verification.         |
| Missing record or roster file                                                        | `refuse-identity-mismatch`, from a single attempted read.           |
| Unbound record                                                                       | `defer-provenance-not-bound`; never `within-declared-window`.       |
| Invalid signature, subject, or window                                                | Existing named attestation refusal carried into a v1 refusal.       |
| Unknown scope or non-local evaluation mode                                           | `refuse-unsupported-scope` or `refuse-unsupported-evaluation-mode`. |
| Instant before, within, and after the signed window                                  | Three distinct status outcomes.                                     |
| Altered issuer, attested subject, action scope, expiry value, or canonical key order | Canonical receipt verification refuses.                             |
| Added authority, score, threshold, quorum, vote, trust, or consensus field           | Schema/receipt verification refuses.                                |
| Attestation retraction record without a distinct future revocation statement         | No v1 revocation status; report scope remains unchanged.            |

## 7. Non-claims

This contract does not establish consent, free will, subjective intent, user authorization, legal validity, key custody, revocation, safety, NCI preservation, policy quality, trust, a quorum, consensus, or authority. It does not determine what should be allowed. It does not use an ambient clock, rank attestations, mutate evidence, or select policies.

The immediate next implementation may demonstrate only the finite receipt and its refusal paths. Any future authority or consensus proposal needs separate human review, an explicit authority model, independently pinned evidence, consent and withdrawal semantics, third-party harm boundaries, and a benchmark capable of failing.

## 8. Measured test-only conformance

The v1 local-window evaluator is now implemented and independently replayed only against the non-corpus test fixture described in [the conformance result](2026-09-07-attestation-consent-expiry-verifier-conformance-result.md). The fixture and its `test-only-bound-adapter` outcome do not weaken any production admission condition in this contract. Production without an externally supplied bound record still defers rather than returning an affirmative status.
