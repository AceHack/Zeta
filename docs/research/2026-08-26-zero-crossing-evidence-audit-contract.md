# Zero-crossing evidence-audit contract

**Status:** pre-registered engineering conformance experiment. This document makes no thermodynamic, Landauer, cryptographic-erasure, privacy-budget, or decorrelation claim.

## Decision

The selected next experiment measures a narrow property of canonical Z-sets: whether a canonical net state can distinguish a key that never appeared from a key whose asserted evidence was later exactly retracted. It will also test whether an explicit, append-only delta audit preserves that distinction without changing the Z-set’s commutative fold.

This is the smallest executable form of the surviving observation in the external zero-crossing brief: zero is not physically privileged by the group operation, but an unlogged zero-crossing can remove the evidence needed to distinguish absence from cancelled history.

## Existing facts used as premises

The current TypeScript Z-set stores only nonzero signed integer weights. `ofEntries` and `union` drop a key exactly when its summed weight is zero. Negative weights remain valid stored values; they represent an in-flight retraction rather than absence.

The current `DurableRoomEvidenceLedger` already persists signed, uncertainty-bearing room receipts and folds them commutatively. This experiment stays beneath its room-specific schema so it can test the general canonicalization boundary directly.

An audit must distinguish an **event identity** from a **content recognizer**. The former is minted at emission time from an emitter namespace, a **logical** monotone sequence, the prior event hash, and the content fingerprint; the latter recognizes/validates payload sameness. A content-derived key cannot represent multiplicity: two genuine same-content emissions would compact as one fact.

The sequence is a logical counter, never a wall-clock timestamp. Local time may govern retransmission and UI freshness, but it must not affect the shared evidence fold. The predecessor hash makes two visible uses of the same `(emitterId, emitterSeq)` structurally detectable as a chain fork. Under partition, a receiver holding only one branch cannot infer that another branch exists; after unioning retained evidence, the conflicting logical position fails closed.

## Hypotheses

| ID | Statement | Result that would falsify it |
|---|---|---|
| `ZA-1` | For known delta `b`, `a ↦ a + b` is invertible in the Z-set group even when a key crosses zero. | A canonical counterexample where `subtract(add(a,b),b) != a`. |
| `ZA-2` | The current canonical implementation omits zero-weight keys, so canonical net state alone cannot distinguish `never asserted` from `asserted then exactly retracted` when both fold to empty. | An implementation change that retains a zero-weight key, allowing a canonical-state-only discriminator. |
| `ZA-3` | An append-only audit of signed deltas distinguishes those histories while the canonical materialized Z-set still converges by commutative addition. | Two distinct retained event sets with different audit records but the same audit root, or different delivery orders with different canonical net state/root. |
| `ZA-4` | G-set union discards duplicate multiplicity under a shared identity key; this is idempotent compaction, not proof of physical erasure. | A duplicate-preserving G-set union under the same identity key. |
| `ZA-5` | A same-content second emission with a distinct minted event identity remains distinct, while a redelivery of the same event remains idempotent. | Same-content events with distinct logical sequences produce the same audit root, or a duplicate delivery changes it. |
| `ZA-6` | A locally visible reuse of one logical `(emitterId, emitterSeq)` position with different event hashes is detected as a chain fork. | Two visible branches at the same logical position fold without a failure. |

## Non-claims

The experiment must reject attempts to infer heat, Landauer cost, attacker cost, secrecy, decorrelation, or an obligation to make an audit irreversible. It establishes only a data-model boundary: canonical Z-set state is a net view; audit identity is additional retained information.

## Required controls

The test suite must include: exact positive/negative cancellation; a retraction that remains negative and therefore present; reordered equivalent deltas; a tampered audit entry that changes the audit root; a same-event replay that leaves the root unchanged; same-content separate emissions that change it; an out-of-order event whose predecessor is locally missing; a visible chain-fork control; and a G-set duplicate-compaction control. The cancellation test is not enough on its own because it can self-certify the property being asserted.

## Integration consequence

Rooms must preserve signed receipt atoms in the durable ZetaDB/DAGFS manifest whenever they need to explain a zero-crossing. A materialized room view may omit net-zero facts; the manifest must not be mistaken for that view. The manifest key must name a minted event, not only content. The room-evidence contract therefore supports correction, multiplicity, and auditability without claiming that either correction or recording has a physical cost.

## Review input

This contract was narrowed after review of the external zero-crossing brief: [`2026-08-25-the-zero-crossing-brief-for-external-physics-review-lumen.md`](https://raw.githubusercontent.com/Lucent-Financial-Group/Zeta/67a19413a0dd745379eb84262e92d0d9f35cf8ad/docs/research/2026-08-25-the-zero-crossing-brief-for-external-physics-review-lumen.md). Its central irreversibility claim is recorded there as refuted; this contract preserves only the auditability question and rejects thermodynamic inference.

The identity discipline is an instantiation of [`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md): a detector recognizes sameness but cannot assign identity. The logical-time prohibition follows [`local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md): local clocks are excluded from shared evidence identity and folding.
