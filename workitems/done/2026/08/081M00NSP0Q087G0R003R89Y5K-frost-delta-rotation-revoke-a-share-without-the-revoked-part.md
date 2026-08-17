---
id: 081M00NSP0Q087G0R003R89Y5K
type: task
state: done
priority: P2
slug: frost-delta-rotation-revoke-a-share-without-the-revoked-part
title: "FROST delta rotation: revoke a share without the revoked party's cooperation"
created: 2026-08-14T17:40:56.983Z
completed: 2026-08-17T14:46:20.917Z
depends_on: []
composes_with: []
---

# FROST delta rotation: revoke a share without the revoked party's cooperation

The body was never written; the work shipped anyway. This is the outcome record,
written at completion so the claim is legible without reading three modules.

## What shipped

- **#10670** — `tools/setup/persona-keys/frost-delta-rotation.ts` (the key change)
  and `key-epoch-ledger.ts` (the knowledge), + research
  `docs/research/2026-08-14-delta-rotation-revocation-is-a-key-change-gset-ledger-and-the-20-site-autonomous-replacement-protocol.md`.
- **This PR** — `chainGapProbe`: a stalled verifier can tell it is stalled.

## The property, stated so it cannot be read as more than it is

`g_i(0) = u_i + δ_i` with `δ_i` fresh and private, so `A' = A + [δ]B`. The revoked
holder is revoked **by absence from `newIndices`**: it contributes nothing, is asked
for nothing, and receives no subshare. Nothing about the revocation depends on its
cooperation. That is the title's requirement and it is met.

**Cryptographically enforced.** After the rotation the revoked holder's material
signs `A`, and `A` is retired. Its old share is a point on the old polynomial `F`
and it holds no point of `H`. A verifier checking against `A'` rejects it (DR-5).
An adversary holding the *entire* old secret still cannot sign under `A'` (DR-6),
because it does not know `δ` — and it cannot learn `δ` from `[δ]B = A' − A`.

**Bookkeeping, not enforcement.** `retiredIndices` in a transition statement is a
label. It refuses the operator error of retiring an index while still issuing it a
share (DR-8) and of letting a retired index help retire itself (DR-9), but it is
not what kills the old share — the key change is. A rotation with `zeroDelta` and
a non-empty `retiredIndices` is refused for exactly this reason (DR-10): preserving
the group key revokes nothing, whatever the list says.

**Also bookkeeping: a participant index is a SLOT, not a party.** `retiredIndices`
records vacated slots, and slots are reusable — index 3 retired at epoch 2 and
re-issued to a different party at epoch 5 reads as "retired" forever in the fold's
grow-only union. Nothing depends on this today; it would matter to any policy that
tried to use `retiredIndices` as an identity blocklist. It should not be used that
way. (Open, deliberately not fixed here.)

## What an old-share holder can still do

1. **Sign under `A`** — and anything still pinned to `A` accepts it. The key change
   is immediate; the *knowledge* is eventually consistent (caveat 5 / KL-11).
2. **Reconstruct the OLD secret** given a threshold of other old shares. Delta
   rotation does not un-share the retired key; it retires it. Anything ever signed
   or encrypted under `A` stays within reach of an old-threshold coalition forever.
   Rotation is not re-encryption.
3. **Verify the transition**, and compute `[δ]B = A' − A`. Both are public by design.
4. **Nothing under `A'`** — not with `t−1` old shares, not with all `n` of them.

## Named dependencies — NOT solved by this item

- **Confidential subshare transport** (WireGuard / headscale). `k` subshares
  addressed to one recipient reconstruct that recipient's new share.
  `runDeltaRotationInProcess` is a test harness and holds all of them in one address
  space; it is not a ceremony.
- **Tier is L1.** The ceremony takes the share *scalar*. No PKCS#11 mechanism
  computes `λ·s` over the ed25519 scalar field, so hardware seals the share at rest
  between ceremonies and does not make the ceremony scalar-free.
- **Last-mover bias on `A'`** (GJKR): a contributor publishing `Δ_i` last can bias
  the *distribution* of `A'` by ~log2(retries) bits. Bias, not theft. A deployment
  that cares adds commit-then-reveal on `Δ_i`.

## Pointers

- `tools/setup/persona-keys/frost-delta-rotation.ts` — DR-1..DR-20
- `tools/setup/persona-keys/key-epoch-ledger.ts` — KL-1..KL-18
