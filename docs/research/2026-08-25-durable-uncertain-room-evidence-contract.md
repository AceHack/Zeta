# Durable uncertain room evidence: ZSet, DBSP, ZetaDB, and Adinkra recovery

> **Key design decision:** A room observation is an immutable, content-addressed **evidence atom** with an integer ZSet weight and an uncertainty payload. A correction is not mutation: it is `−1` for the exact superseded atom plus `+1` for a replacement atom. Derived room state is a DBSP fold over the durable atom relation.

## Scope

Rooms are the plain-language, time-bounded verification boundary. They declare a scope, action/time budgets, and a success predicate. The receipt layer must allow later observations to revise an earlier room result without replaying the emulator, deleting history, or conflating two different room/channel contexts.

The durable substrate is the existing ZetaDB/DAGFS dual-path `ZetaStorageCell`: a canonical receipt payload is content-addressed with a Merkle key, written to the primary ZetaDB path, mirrored to its fallback, and optionally propagated through the transport cell. The content address binds the atom body; it does not establish author identity.[1]

## Atom model

Each `RoomEvidenceReceipt` carries the following stable grouping and disambiguation fields:

| Field | Purpose |
|---|---|
| `roomId`, `roomFingerprint` | Human-facing room identity and immutable room/version identity. |
| `channelFingerprint` | Metered channel identity; prevents a receipt from one channel changing another channel’s room state. |
| `spectrumSlice`, `signatureSplit` | Explicit rainbow/fingerprint disambiguation labels. They are opaque strings in v1; they are not yet cryptographically verified signatures. |
| `runId`, `episodeId`, `factId` | Run/episode address and immutable fact identity. |
| `weight ∈ ℤ \ {0}` | ZSet delta: `+1` assertion, `−1` retraction. |
| `uncertainty` | A mean in ppm and an integer precision contribution. Both `+1` and `−1` atoms carry it. |
| `elapsedMs`, `actionCount`, budgets, `solved` | Metered visual/usefulness outcome. |

`factId` identifies a **particular asserted fact**, not an episode in general. A correction must retract the old `factId`/payload with `−1` and assert a new fact with a new `factId`. This avoids silently overwriting what was previously believed.

## Folding semantics

The base relation is a canonical ZSet over atom keys. Sorting and summing integer weights makes delivery order irrelevant. A `−1` that arrives before its matching `+1` is retained as a negative in-flight entry; when the delayed assertion arrives, the key cancels to zero and disappears. This is exactly the existing ZSet retraction law, not a special recovery path.[2]

The room view groups active atoms by `(roomFingerprint, channelFingerprint, spectrumSlice, signatureSplit, runId, episodeId)`. It folds the uncertainty payload as signed sufficient statistics:

`precision = Σ(weight × precisionPpm)` and `naturalMean = Σ(weight × precisionPpm × meanPpm)`.

If total precision is positive, the derived mean is `naturalMean / precision`; otherwise the view is `unresolved`. That refusal is essential: a retracting receipt may arrive first, but it may not be treated as negative confidence or a completed room outcome.

## Durability and transport

Atoms are persisted before they become fold input. The persistence API returns the Merkle key; replay reads stored atoms and repeats the same order-independent fold. Existing peer receipt exchange already authenticates a batch’s *content hash* and accepts bounded receipt batches over a transport-agnostic request/reply port.[3]

The Adinkra adapter is deliberately thinner: it serializes one atom, sends it through `LossyUdpChannel`, and accepts only CRC-valid/recovered payloads from the existing `[8,4,4]` channel. The channel corrects erasures; it does not mint a room result, prove identity, or infer missing semantic evidence. An unrecoverable block produces a missing atom, and anti-entropy/peer exchange may later supply it.

## Required conformance checks

The implementation must prove by executable tests that:

1. Delivery permutations—including `−1` before `+1`—converge to the same net room view.
2. An exact `+1`/`−1` pair cancels both its uncertainty and its measured action/time outcome.
3. A replacement correction preserves the original atom and changes only the derived view.
4. Different spectrum or signature-split labels never cancel each other.
5. A negative precision total produces `unresolved`, not a numeric posterior.
6. Persist/replay retains the Merkle address and produces the same canonical root.
7. A receipt framed through the existing Adinkra channel reaches the same persistence/fold boundary after recovery; malformed payloads are refused.

## Honest boundary

The v1 contract is a durable commutative **evidence** foundation. It does not yet verify a cryptographic author signature, execute CHIP-9, resolve semantic task equivalence, or turn a room’s visual outcome into scientific competence. Those are later consumers of the durable evidence relation, not properties to smuggle into its storage or ECC layer.

## References

[1] [`zeta-storage-cell.ts`](../../src/Core.TypeScript/browser-node/zeta-storage-cell.ts)

[2] [`z-set.ts`](../../src/Core.TypeScript/z-set/z-set.ts)

[3] [`browser-database-receipt-peer-exchange.ts`](../../src/Core.TypeScript/browser-node/browser-database-receipt-peer-exchange.ts)
