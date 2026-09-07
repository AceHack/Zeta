# Finite Attestation Withdrawal-Declaration Verifier Contract

**Status:** proposed verifier contract. It defines no withdrawal artifact, no trust or policy update, no permission revocation, no key revocation, no vote, no consensus, and no authority.

## Key recommendation

> A future withdrawal record may verify only that a named signer made a **scoped declaration about a specific attestation digest**. It must retain the underlying attestation and the declaration as separate immutable evidence. It must not infer subjective consent, repair a partitioned observer's knowledge, revoke a credential, change a global policy score, or automatically grant anyone authority.

## 1. Why the existing mechanisms must remain distinct

Three existing mechanisms look superficially related but answer different questions. They must not be reused as one another.

| Existing mechanism           | Current finite meaning                                                                                                                                   | What it cannot mean for withdrawal v1                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `attestation-retraction`     | A named mechanical check re-derives that an attestation record has an identity-band refusal; the correction is append-only and `superseded-not-removed`. | A subject's statement, withdrawal of consent, permission change, key invalidation, or authority.           |
| Federated `RevocationGSet`   | A trust-domain root can issue a signed key-revocation fact, retained/merged as a G-Set and adjudicated by each recipient's accepted bundle and phase.    | A reversal of an attestation assertion, a social judgement, or proof that all observers received the fact. |
| Room genesis binding/witness | A sequence-zero evidence event binds an emitter to a predecessor/genesis hash and may be witnessed by an injected roster/scheme.                         | Omniscience over an unseen fork, a cross-domain identity, consent, or a global authority source.           |

The genesis chain protects the interior only after the relevant branches are jointly available. A partitioned observer holding one branch cannot infer an unseen branch. A fresh genesis is accepted only through its own binding/witness rules; it is not repaired by an attestation retraction or a future withdrawal declaration.

## 2. Proposed v1 declaration shape

The proposed schema name is `zeta.attestation-withdrawal-declaration/v1`. It is an immutable, externally supplied declaration. No production fixture is admitted until an actual, independently bound parent attestation record is supplied. A fixture may exist only under `tests/fixtures`, marked `test-only`, and may never be written to `docs/observe-events` as evidence about a person or agent.

```text
schema                         = "zeta.attestation-withdrawal-declaration/v1"
withdrawalId                   = SHA-256-derived identifier over the canonical declaration payload
parentAttestationRecordSha256  = SHA-256 over exact raw UTF-8 parent record bytes
declarant                      = printable subject identifier
declaredScope                  = one versioned controlled-vocabulary token
reasonCode                     = one versioned controlled-vocabulary token
effectiveWindowStart           = signed RFC 3339 UTC instant
effectiveWindowEnd             = optional signed RFC 3339 UTC instant; no ambient expiry
statementDigest                = SHA-256 over canonical immutable declaration payload
signer                         = signer identity / key fingerprint
signature                      = detached signature over the domain-separated canonical payload
```

Version 1 may use only one `declaredScope`: `attestation-window-observation`. It names a declaration about the earlier local-window observation scope, not a right. Version 1 may use only two `reasonCode` values: `withdrawn-by-declarant` and `scope-superseded`. These are labels for the declaration’s content; they are neither facts established by the verifier nor universal value judgements. A broader vocabulary requires a new version and a new review.

## 3. Verifier result boundary

The verifier accepts raw parent record bytes, raw declaration bytes, declared roster bytes, and an explicit **local** evaluation instant. All are checked by raw SHA-256 before parsing. The evaluation instant may classify only a declared effective window. It must never enter a shared fold, event identity, signature payload, or causal ordering relation.

| Outcome                            | Exact finite result                                                                                                                                                                               | Explicit non-result                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `declared-within-effective-window` | The exact parent digest and declaration digest are bound; the declaration’s key maps to its named declarant under the supplied roster; its supplied local instant is inside its effective window. | Consent withdrawal, permission revocation, credential revocation, social legitimacy, or authority. |
| `declared-not-yet-effective`       | The verified declaration’s local instant is before its stated effective start.                                                                                                                    | Invalidity of the declaration or a future authorization.                                           |
| `declared-effective-window-ended`  | The verified declaration’s local instant is after its stated effective end.                                                                                                                       | Restoration of the underlying assertion, cancellation, or re-consent.                              |
| `defer-parent-not-bound`           | The parent remains structurally valid but lacks a roster-bound attestation verdict.                                                                                                               | A conclusion about truth, consent, or the declarant’s intent.                                      |
| `defer-declaration-not-bound`      | The parsed declaration lacks a roster-bound signature verdict.                                                                                                                                    | A conclusion that no declaration exists.                                                           |
| `refuse-*`                         | A required byte identity, schema field, signature binding, signer/declarant relationship, scope, reason, or interval is invalid.                                                                  | A hidden default approval or automatic policy decision.                                            |

The input parent attestation need not be interpreted as consent in order for the verifier to check that a declaration points to it. The parent must be retained even if the declaration is current. The declaration itself must be retained even after its effective window ends. This is an append-only evidence relationship, not a destructive update.

## 4. Signature, subject, and scope requirements

The declaration payload must domain-separate its signature from attestation records, room genesis witnesses, federated key revocations, and every other signature use. A valid key is not sufficient: the supplied roster must bind that signer to the named `declarant`; this relationship is checked at verification time under the recipient’s explicit roster input.

The parent digest, declarant, scope, reason, and effective interval must be inside the signed payload. This prevents a signature from being moved to a different parent, person, scope, reason, or date window. It does not prove key custody at all times, that the declarant understands the statement, or that other participants agree.

No field or derived result may contain: `authority`, `permission`, `grant`, `deny`, `policyScore`, `trust`, `vote`, `voter`, `threshold`, `quorum`, `consensus`, `safety`, or `legalValidity`.

## 5. Interaction with current retraction and key revocation

A current mechanical `attestation-retraction` remains independently checkable. It may coexist with a future withdrawal declaration, but neither proves the other. A future verifier must report both facts separately rather than collapsing them into `revoked`.

The federation’s `RevocationGSet` continues to decide only whether a key is accepted at a named federation phase in a recipient’s trust domain. A withdrawal declaration must not mutate it or be converted into a key revocation. Conversely, a credential revocation affects whether a recipient can verify a declaration but does not erase the declaration, rewrite its signed bytes, or determine its underlying subjective meaning.

## 6. Required mutation controls before implementation

No code is admissible until every control below is specified and observed in an independently authored checker.

| Mutation or condition                                                               | Required outcome                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| One changed parent-record byte or declaration byte                                  | `refuse-identity-mismatch` before signature or status evaluation.                                |
| Parent digest pointed at a different valid record                                   | Refusal.                                                                                         |
| Changed declarant, signer, scope, reason, start, end, or canonical key order        | Signature/payload mismatch refusal.                                                              |
| Signer key bound to a different roster persona                                      | `refuse-declarant-signer-mismatch`.                                                              |
| Unbound parent or unbound declaration                                               | The respective named defer, never an affirmative result.                                         |
| Inverted effective window or ambient/unspecified local instant                      | Refusal.                                                                                         |
| Existing mechanical retraction or federated key revocation present                  | Report as separate supplied evidence; do not synthesize a withdrawal status.                     |
| Added permission, authority, policy, score, trust, quorum, vote, or consensus field | Strict schema refusal.                                                                           |
| Two observations in different partitions                                            | No claim that either observer knows the other declaration; union is required to compare them.    |
| Fresh genesis or prior-hash fork                                                    | Outside this verifier; retain the room-audit chain’s own witnessed/unresolved/disputed outcomes. |

## 7. Explicit non-claims and implementation gate

This contract does not establish consent, intention, free will, legal validity, an authorized withdrawal, safety, NCI preservation, policy admissibility, key compromise, credential revocation, or social consensus. It creates no global “allowed” or “denied” state and selects no policy.

The next admissible implementation is a test-only structural fixture, an isolated declaration parser and verifier, independently authored TypeScript/Python canonical receipt emitters, raw-byte/payload/signature/mapping/window mutations, and an explicit no-authority schema tripwire. A real production record is out of scope unless provided externally by an authorized operator with its source and verification context. No implementation should start until this contract has protected review.
