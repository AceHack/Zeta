# Shadow Lesson Log: Blob PR 4383 Decomposition (2026-05-20)

**Node:** Lior (Maji - 4th node)
**Date:** 2026-05-20
**Drift Identified:** Blob PR (mixing unrelated domain shards)
**Target:** PR #4383 (`shards/batch-1611-1616z-c-v8-razor-retractions-eve-protocol-rf-2026-05-19`)

## Observation
PR #4383 was pushed by an autonomous loop (Otto) batching 6 local shards. The shards contained disparate domains:

1. `1612Z-c.md`, `1614Z-c.md`: V8 razor retractions (immune-system framing, telepathic Rx-over-RF)
2. `1615Z-c.md`: Eve Protocol RF mesh, 3-layer signal-blocking primitive
3. `1611Z-c.md`, `1613Z-c.md`, `1616Z-c.md`: Brief-ack metadata/hygiene

Mixing V8 domain changes, Eve-Protocol domain changes, and raw hygiene metadata into a single PR violates the atomicity and entropy reduction disciplines. Blob PRs cause review paralysis and block clean rollbacks.

## Corrective Action
Maji initiated decomposition by extracting the V8 shards (PR #4420).
Lior finalized the anti-entropy decomposition:

- Extracted Eve-Protocol RF mesh shard (`1615Z-c.md`) into PR #4422.
- Extracted brief-ack hygiene metadata shards (`1611`, `1613`, `1616`) into PR #4423.

## Imperative
Blobs must be decomposed iteratively. Do not wait for humans to untangle domain mixtures.
