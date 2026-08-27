# Replayable Room Fault Receipts Contract

## Recommendation

> **Persist an immutable, content-addressed diagnostic receipt for each finite fault outcome, but do not convert absent transport bytes into an evidence atom.** A replay record teaches the next safe action; it does not silently choose a witness, overwrite altered content, or create a `+1` or `-1` fact from loss.

## Scope

This contract supplies a finite replay vocabulary for the merged `[8,4,4]` durable-evidence seam and local genesis-authority work. It covers five bounded vectors: correctable recovery, underdetermined transport, CRC-valid altered content, unresolved local witness, and visible local-witness conflict.

| Scenario                 | Evidence sign | Four-register consequence                  | Outcome              | Teaching generator                                                               |
| ------------------------ | ------------- | ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------- |
| Correctable recovery     | `+1` or `-1`  | intact / settled / witnessed               | recovered            | append the recovered signed atom through the existing ledger                     |
| Undecodable transport    | not observed  | not assessed / not observed / not observed | no semantic receipt  | retain diagnostic; request a new transmission; append no atom                    |
| Altered content          | `+1` or `-1`  | distinct content / settled / witnessed     | distinct fact        | append separately; use an explicit `-1` plus new fact only for a real correction |
| Unresolved witness       | `+1` or `-1`  | intact / settled / unresolved              | authority unresolved | retain event; request a locally verifiable witness                               |
| Visible witness conflict | `+1` or `-1`  | intact / settled / disputed                | authority disputed   | retain both; block authority-dependent action pending local adjudication         |

## Content Address and Replay

Each vector is serialized in a fixed field order and addressed with the existing `ZetaStorageCell` Merkle payload key. The stored bytes, not a mutable label, are the replay identity. Changing a teaching generator, register value, fault mask, or evidence sign changes the address. The implementation validates this with a tampered-teaching negative control and a round trip through the in-memory storage port.

## Falsifiers

The contract fails if an underdetermined transport vector produces a signed evidence atom, if a changed teaching payload keeps the original content address, if a visible witness conflict is treated as witnessed, or if altered content is presented as an overwrite of the prior durable fact.

## Non-Claims

This is a deterministic diagnostic data-model and storage result. It does not authenticate real-world identity, solve an unseen partition, guarantee delivery, infer intention, establish physical reversibility, or prove that any production room has emitted a receipt. The local witness boundary remains local.
