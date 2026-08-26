# Durable Room-Evidence Live Feed Contract

**Status:** implementation contract. This document specifies a repository-visible feed of persisted room-evidence audit envelopes. It does not assert that any live receipts exist at publication time.

## Purpose and boundary

A room is a time-bounded verification environment. `DurableRoomEvidenceAuditLedger` already persists immutable receipt-plus-audit envelopes locally, but a static GitHub Pages room cannot read a browser-local `ZetaStorageCell`. The feed is therefore an explicitly replicated, versioned **view** of envelopes that have already been durably persisted by an emitting runtime. It is not a replacement storage path and it does not create facts.

The viewer must distinguish four outcomes. These outcomes are observability states, not evidence signs or identity verdicts.

| Retrieval outcome | Meaning                                                                  | Viewer behavior                                                              |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `ready`           | A valid non-empty manifest and every referenced envelope were retrieved. | Render each envelope’s evidence sign and four audit registers.               |
| `empty`           | A valid manifest contains no entries.                                    | State that no durable receipt has been emitted into this feed.               |
| `unavailable`     | The manifest or a referenced envelope could not be retrieved.            | State that the feed is unavailable; do not replace it with a sample.         |
| `malformed`       | Retrieved bytes do not satisfy the declared manifest or envelope shape.  | Surface a teaching error with the failed field/path; do not fold the record. |

> **No-data discipline:** An empty or unavailable feed is not a negative observation, a retraction, an unresolved causal event, or a disputed identity. It is retained as a viewer state only.

## Artifact shape

The emitter publishes `docs/room-evidence/index.json` after successful durable append. The index contains immutable, content-addressed references; its entries may be reordered without changing their individual identities.

```json
{
  "schema": "zeta.room-evidence-live-feed-index.v1",
  "entries": [
    {
      "eventId": "<event identity>",
      "auditContentKey": "<ZetaStorageCell content key>",
      "receiptContentKey": "<ZetaStorageCell content key>",
      "file": "room-evidence/<event identity>.json"
    }
  ]
}
```

Each `file` contains the exact `encodeRoomEvidenceAuditEvent` JSON envelope. The index is only a discovery manifest: it does not authorize a signer, establish global identity, or prove that an unseen competing event does not exist.

## Required validation

An emitter must validate an envelope with `decodeRoomEvidenceAuditEvent` before publication, and must refuse an index entry whose `eventId` differs from the envelope’s `delta.eventId`. The browser viewer repeats schema and cross-reference checks for display safety, but its parsing does not substitute for the durable ledger’s content-address verification.

The source of authority remains decomposed into four registers:

| Register          | Envelope source                                           | Viewer must not collapse it into         |
| ----------------- | --------------------------------------------------------- | ---------------------------------------- |
| Evidence sign     | `receipt.weight`                                          | witness authority or transport status    |
| Content integrity | receipt-bound `delta.contentFingerprint` and content keys | event identity                           |
| Causal continuity | `audit.continuity` after a genuine fold                   | proof that partitions cannot hide events |
| Genesis authority | local `AuditGenesisAuthority` verdict                     | a global roster or universal identity    |

## Falsifiers and teaching errors

The implementation must have tests that fail if an empty feed is presented as a receipt, if a missing file becomes a synthetic `−1`, if a manifest event ID does not bind its envelope, or if duplicate manifest IDs are silently folded. A malformed index must name the failed field and leave the already-retrieved entries outside any new fold.

The next production step is an emitting adapter that writes the manifest only after `DurableRoomEvidenceAuditLedger.append` returns both content keys. This contract intentionally does not fabricate that adapter, its signer, its witness roster, a room episode, or a live receipt.
