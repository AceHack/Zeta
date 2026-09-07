# Test-Only Attestation Consent-and-Expiry Verifier: Conformance Result

**Status:** finite conformance observation. This result does **not** establish consent, permission, authority, revocation, legal validity, a vote, a quorum, or consensus.

## Key result

> TypeScript and independently authored Python produced the same **358-byte** local-window receipt for one non-corpus, test-only structural fixture. The shared SHA-256 is `3d48dacf910f548964bd584b4c181b8b99a7453dd5e6c7d0ef251c6a02b86b72`. The result means only that the declared test fixture's explicit local observation instant lies inside its declared subject window.

## Fixture identity and observed result

| Field                   | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Fixture location        | `tests/fixtures/attestation-consent-expiry-test-only-record.json`              |
| Fixture SHA-256         | `9eefdc9a33443163c440ed4cb96a5cd91d1986d179e93cf15e985661af0e877f`             |
| Fixture provenance mode | `test-only-bound-adapter`                                                      |
| Scope                   | `attestation-window-observation`                                               |
| Evaluation instant      | `2026-09-07T11:30:00.000Z`                                                     |
| Signed subject window   | `2026-09-07T11:00:00.000Z` through `2026-09-07T12:00:00.000Z`, inclusive       |
| Outcome                 | `within-declared-window`                                                       |
| Receipt bytes / SHA-256 | 358 bytes / `3d48dacf910f548964bd584b4c181b8b99a7453dd5e6c7d0ef251c6a02b86b72` |

The fixture is kept under `tests/fixtures`, not `docs/observe-events`. It names `fixture-attestor` and `fixture-subject`, not a real person, agent, authority, or durable consent artifact. The TypeScript positive path is deliberately supplied by a test-only bound-verdict adapter because the committed corpus contains no production bound attestation record suitable for an affirmative fixture. The Python oracle independently validates the same fixed local-window shape but does not verify an SSH signature or import the TypeScript implementation.

## Controls exercised

| Control                                    | Observed result                                           |
| ------------------------------------------ | --------------------------------------------------------- |
| Explicit instant before the subject window | `not-yet-declared-window`                                 |
| Explicit instant after the subject window  | `expired-declared-window`                                 |
| Unbound record without a test adapter      | `defer-provenance-not-bound`                              |
| Changed raw record bytes                   | `refuse-identity-mismatch` before local status evaluation |
| Unknown scope or non-local evaluation mode | Refusal; no fallback to a shared fold                     |
| Reordered receipt bytes                    | Canonical receipt verification rejects                    |
| Added `authority` field                    | Canonical receipt verification rejects                    |
| Cross-language committed receipts          | Exact byte equality, then independent replay              |

The evaluator never writes the caller-supplied evaluation instant into attestation evidence, an evidence identity, a causal order, or a shared fold. It is a local observation parameter, so different callers may legitimately see different current/expired statuses for the same bound evidence at different instants.

## Verification

The focused TypeScript suite passed **6 tests** and the independent Python suite passed **3 tests**. TypeScript type checking, Prettier, Ruff, Ruff formatting, mypy, and the ACE graph derive/check also passed. The tests cover structure and canonicality; they do not turn the test-only binding adapter into real signature validation.

## Retained limits

The receipt is not a consent detector. A person or agent being named in an attestation, a subject window being current, or a roster key being bound does not demonstrate subjective intent, authorization, key custody, legal effect, safety, authority, trust, or consensus. Existing attestation retractions remain mechanical `superseded-not-removed` signposts and do not create a v1 revocation state.

No authority, permission, score, threshold, quorum, vote, trust, or consensus field is representable in the canonical receipt. `recorded-consensus` remains deferred until a separately reviewed immutable evidence format, withdrawal semantics, accountable authority model, and failing verifier exist.
