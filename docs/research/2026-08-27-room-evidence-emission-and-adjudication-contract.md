# Room Evidence Emission and Local Adjudication Contract

> **Status:** bounded implementation contract. The selected first path is a deterministic receipt emitted by the existing thirty-minute heartbeat lane. This document does not claim that a heartbeat proves a task outcome, signer identity, global consensus, privacy, or continuous availability.

## 1. Decision and Scope

The first production-shaped receipt is emitted by the existing `agent-heartbeat.yml` matrix lane after a heartbeat's ordinary observable-event append has completed. The lane remains the clock source; this contract does not add a second scheduler or make a separate process authoritative.

Each emitted record is explicitly a **heartbeat observation**. It records that the named lane executed the declared deterministic receipt generator over its current local inputs. It is not a fabricated room episode, not a claim that an external reviewer accepted the observation, and not a substitute for an action/outcome trace.

| Property           | Required first implementation                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Trigger            | Existing thirty-minute `agent-heartbeat.yml` matrix run only.                                             |
| Atom               | One signed `+1` room receipt per successful generator invocation; all uncertainty fields remain explicit. |
| Event identity     | A `DurableRoomEvidenceAuditLedger` event with emitter sequence and predecessor linkage.                   |
| Genesis            | Sequence zero carries a local public-key binding and a verifier result; unknown remains unresolved.       |
| Persistence        | Atom, audit envelope, and witness bytes are stored through the existing `ZetaStorageCell` path.           |
| Publication        | The static `docs/room-evidence/index.json` lists only parser-validated record references.                 |
| Duplicate behavior | Same logical event is idempotent. A distinct emission must have a distinct logical position.              |

## 2. No-Data and Failure Discipline

The manifest stays an empty array until a real automation run produces a valid record. No fixture, example, test vector, or UI simulation may be published as a feed entry.

| Observed condition                 | Feed outcome                  | Teaching outcome                                                                       |
| ---------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| No emitted records                 | `empty`                       | “No persisted room receipt has been published.”                                        |
| Manifest unavailable               | `unavailable`                 | “Retrieve the declared static index and retry; do not infer no data.”                  |
| Manifest or entry fails validation | `malformed`                   | “Reject this reference; publish a corrected manifest entry.”                           |
| Valid receipt and audit envelope   | `discovered`                  | Render the signed atom and its separate four-register audit state.                     |
| Witness unavailable                | Audit genesis is `unresolved` | Retain the atom and request a local witness; do not infer either trust or conflict.    |
| Competing valid local witnesses    | Audit genesis is `disputed`   | Retain both witness atoms and emit a separately signed correction/adjudication record. |

## 3. Local Disputed-Witness Adjudication

An adjudication record is an additional immutable atom. It must reference the conflicting witness fingerprints, the prior audit envelope, the local verifier decision, and a **new generator rule** describing how a later evaluator should proceed. It never deletes the prior record or mutates an already stored atom.

The first implementation may issue only one of these local teaching dispositions:

1. `request-local-witness`: no verifier could establish the binding;
2. `retain-conflict`: two distinct verifier-accepted bindings appeared for one claimed genesis; or
3. `replay-with-correction`: a separately signed correction identifies the new generator and binds the correction to the disputed record.

The disposition is not a global verdict. It is local evidence for later replay.

## 4. Deferred Alternatives

### 4.1 Manually Triggered Receipt Run

A workflow-dispatch entry point may call the same pure generator, ledger writer, manifest validator, and adjudication code. It would accept a human-supplied, named invocation label and record that label as an explicit input. This is the conservative demonstration route because its initiation is visible; it remains deferred so the initial system has one emission source and one cadence.

### 4.2 Immediate-Ingestion Receipt Service

An event receiver may accept transport data and write receipts as messages arrive. It requires explicit ingress authentication, durable replay protection, availability and backpressure policies, secret management, and a lifecycle boundary for the persistent service. It is deferred until the system has actual sub-minute transport observations that cannot honestly wait for the heartbeat cadence.

## 5. Falsifiers

The implementation is defective if any of the following occurs:

- it publishes a fixture while no heartbeat has generated a receipt;
- a duplicate logical emission yields a second durable audit atom;
- a malformed manifest reference appears as `discovered`;
- a missing witness is reported as witnessed or disputed;
- a visible competing witness is silently overwritten;
- an adjudication changes an existing atom instead of adding a signed correction atom; or
- the static room renders a claim of a live receipt while the manifest is empty or unavailable.

## 6. Non-Claims

This contract does not establish a global identity registry, defeat network partitions, authenticate a person merely from a workflow credential, or show that the receipt stream has a physical energy, entropy, or thermodynamic interpretation. It specifies only a retained, replayable local evidence path.
