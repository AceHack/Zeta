# Durable Room Genesis Authority Contract

**Decision.** Persist receipt content and audit-event identity together in a versioned, content-addressed envelope, but evaluate genesis authority only through an injected local roster and signature-scheme port. Evidence sign, content integrity, causal continuity, and genesis authority remain four independent registers.

## Scope

`RoomEvidenceReceipt` remains the signed uncertainty-bearing fact consumed by the durable room fold. `RoomEvidenceAuditEvent` adds an emitter-local logical sequence, predecessor chain, content fingerprint, optional sequence-zero binding, and optional witness. The envelope is written through `ZetaStorageCell`; the existing `DurableRoomEvidenceLedger` still persists the exact receipt payload.[1][2]

The adapter derives the audit key from `roomEvidenceAtomKey(receipt)` and binds the receipt weight, posterior mean, and precision through `mintContentFingerprint`. It mints event identity separately from content identity, so exact redelivery is idempotent while two logical emissions of identical content retain multiplicity.[1][3]

## Local Authority Mapping

The sequence-zero witness signs canonical, domain-separated bytes over the complete `AuditGenesisBinding`. `LocalRosterGenesisAuthority` delegates signature verification to the existing `SignatureScheme` boundary and uses only the caller's roster. It holds no private key material and performs no network or global-roster lookup.[3][4]

| Local observation                                                                                                                   | Genesis register |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| No persisted witness, unknown signer, or unaccepted scheme                                                                          | `unresolved`     |
| Binding mismatch, local key-fingerprint mismatch, malformed signature, invalid signature, or conflicting witnesses at one reference | `disputed`       |
| Exact binding, matching local roster key, accepted scheme, and verified signature                                                   | `witnessed`      |

Two observers with different local rosters may classify the same persisted envelope differently. This is intentional and falsifies any reading of the register as universal identity.

## Conformance Controls

The DREGA suite demonstrates that a witnessed sequence-zero event persists and folds without collapsing the other registers; an observer lacking the key retains the same event as unresolved; missing witnesses remain unresolved; invalid signatures, substituted bindings, key-fingerprint mismatches, and conflicting witness atoms are disputed; out-of-order children remain causally unresolved until their predecessor arrives; `-1` receipts remain retractions; exact replay is idempotent; same-content distinct emissions preserve multiplicity; and receipt tampering invalidates the event binding.

## Non-Claims

This contract does not establish a global identity roster, partition omniscience, key custody, key rotation, revocation, secrecy, privacy, thermodynamic reversibility, or physical conservation. The included acceptance-path tests use a deterministic injected verification scheme to exercise the hexagonal boundary; a deployment must inject its selected real signature implementation and locally maintained public roster.

## References

[1]: ../../src/Core.TypeScript/observe/room/durable-room-evidence-audit.ts "Durable room-evidence audit adapter"
[2]: ../../src/Core.TypeScript/observe/room/durable-room-evidence.ts "Durable uncertain room-evidence ledger"
[3]: ../../src/Core.TypeScript/research/zero-crossing-evidence-audit.ts "Zero-crossing evidence audit"
[4]: ../../src/Core.TypeScript/observe/signed-stamp.ts "Local-roster signature verification port"
