# Zero-crossing evidence-audit contract

**Status:** pre-registered engineering conformance experiment. This document makes no thermodynamic, Landauer, cryptographic-erasure, privacy-budget, or decorrelation claim.

## Decision

The selected next experiment measures a narrow property of canonical Z-sets: whether a canonical net state can distinguish a key that never appeared from a key whose asserted evidence was later exactly retracted. It will also test whether an explicit, append-only delta audit preserves that distinction without changing the Z-set’s commutative fold.

This is the smallest executable form of the surviving observation in the external zero-crossing brief: zero is not physically privileged by the group operation, but an unlogged zero-crossing can remove the evidence needed to distinguish absence from cancelled history.

## Existing facts used as premises

The current TypeScript Z-set stores only nonzero signed integer weights. `ofEntries` and `union` drop a key exactly when its summed weight is zero. Negative weights remain valid stored values; they represent an in-flight retraction rather than absence.

The current `DurableRoomEvidenceLedger` already persists signed, uncertainty-bearing room receipts and folds them commutatively. This experiment stays beneath its room-specific schema so it can test the general canonicalization boundary directly.

## Hypotheses

| ID | Statement | Result that would falsify it |
|---|---|---|
| `ZA-1` | For known delta `b`, `a ↦ a + b` is invertible in the Z-set group even when a key crosses zero. | A canonical counterexample where `subtract(add(a,b),b) != a`. |
| `ZA-2` | Canonical net state alone cannot distinguish `never asserted` from `asserted then exactly retracted` when both fold to empty. | A canonical-state-only discriminator that distinguishes the two histories. |
| `ZA-3` | An append-only audit of signed deltas distinguishes those histories while the canonical materialized Z-set still converges by commutative addition. | Two distinct histories with different audit records but the same audit root, or different delivery orders with different canonical net state/root. |
| `ZA-4` | G-set union discards duplicate multiplicity under an identity key; this is idempotent compaction, not proof of physical erasure. | A duplicate-preserving G-set union under the same identity key. |

## Non-claims

The experiment must reject attempts to infer heat, Landauer cost, attacker cost, secrecy, decorrelation, or an obligation to make an audit irreversible. It establishes only a data-model boundary: canonical Z-set state is a net view; audit identity is additional retained information.

## Required controls

The test suite must include: exact positive/negative cancellation; a retraction that remains negative and therefore present; reordered equivalent deltas; a tampered audit entry that changes the audit root; and a G-set duplicate-compaction control. The cancellation test is not enough on its own because it can self-certify the property being asserted.

## Integration consequence

Rooms must preserve signed receipt atoms in the durable ZetaDB/DAGFS manifest whenever they need to explain a zero-crossing. A materialized room view may omit net-zero facts; the manifest must not be mistaken for that view. The room-evidence contract therefore supports correction and auditability without claiming that either correction or recording has a physical cost.
