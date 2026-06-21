# ZetaId ties identity together — crypto keychain, Reticulum identity, and bus-address routing all relate to the ZetaId root

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (the identity keystone) · **Trajectory:** cluster-encryption-credential-substrate

## The ask (Aaron 2026-06-21)

> *"Our ZetaId ties it all together — crypto identity and ZetaIds should relate; we should have
> ZetaIds special for crypto however makes sense, then tied into Reticulum identity, which should
> tie all our identities together. Even bus addresses — which are not technically identity but are
> still cryptographic."*

## The through-line: ZetaId is the universal POINTER interface

**ZetaId is the universal pointer interface** (Aaron 2026-06-21) — a content-addressed reference
to *anything* (data, research, ROMs, work-items, keys, identities), with **optional indexing
carried in the bits themselves** (the typed-word form: 128-LE vs 256; BLAKE3 treaty). There is a
**large existing spec + code + backlog** around it (`why=zetaid` categoried generator; "X are
ZetaId pointers" research; the ZetaId-keyed workitem substrate) — this doc does NOT redefine it;
it positions **identity + crypto as ONE application** of the universal pointer.

So: **identity is a *use* of the pointer, not the pointer.** An *identity-ZetaId* points to a
principal; a *crypto-ZetaId* is a pointer whose bits content-address/index **key material**;
other ZetaIds point to data/docs/work. The optional in-bit indexing is what lets a ZetaId be
*typed* as "this points to a key of scheme X" vs "this points to a research doc." The rest of
this doc is the **identity/crypto projection** of that universal pointer.

## How the layers relate to the ZetaId (as the universal pointer)

```
                         ZetaId  (128-bit identity atom; content-addressed)
                            │  binds/commits to
        ┌───────────────────┼───────────────────────┐
   crypto keychain      Reticulum identity        bus address
   (derive.ts seed)     (network projection)      (ROUTING, not identity)
```

1. **Crypto identity ↔ ZetaId (they relate by content-address).** The HD keychain (one seed →
   SSH/PGP/wallets/PQ) and the ZetaId relate: the ZetaId can be the **content-address of the
   keychain's public root** (or a commitment to the seed's public material), so **identity is
   crypto-bound** — your ZetaId *is* the fingerprint of your key material, not an arbitrary label.
   A **"crypto ZetaId"** is then well-defined: a ZetaId whose content commits to a specific key
   (per-scheme, per-path) — identity and crypto are the same object viewed two ways.
2. **Reticulum identity = the network projection (crypto-derived, ties in for free).** Reticulum
   destinations/identities are **hashes of a keypair** — so a Reticulum identity is just a derived
   key in our keychain (its own coin-typed path) whose destination hash **relates to the same
   ZetaId**. That **unifies network identity with crypto identity**: the node you talk to over
   Reticulum and the ZetaId it commits to are the same root, projected onto the network.
3. **Bus address = cryptographic ROUTING, explicitly NOT identity.** A bus address is
   `persona ⊕ surface ⊕ instance ⊕ topology` (the writer-actor-routing-model, after the 128-bit
   ZetaId). It is **cryptographic** (derived/signed, content-addressed) but it is **routing, not
   identity** — *"a bus/routing address is not identity"* (shared-checkout rule; the PID-recycle
   blade). It **relates** to the ZetaId (the persona's identity IS a ZetaId; the bus address is a
   routing composite *over* that identity) but must never be conflated with it: identity is *what
   remains*; the address is *where it currently acts*.

## The invariant to preserve

- **Identity** (ZetaId, crypto keychain, Reticulum identity) = *what remains* — stable,
  crypto-bound, content-addressed.
- **Routing** (bus address) = *where it acts now* — cryptographic but ephemeral/recyclable.
- The ZetaId is the join: every identity layer **content-addresses to the same root**; the routing
  layer **references** that root without being it. (Keeps §1 scale-free: no central identity
  authority — a ZetaId is self-certifying via content-address, traveler-framed.)

## Why this is the keystone

It closes the loop on the whole session's thread: the **crypto-agile keychain** (one seed →
classical+PQ) produces the keys; the **ZetaId** content-addresses them into identity; **Reticulum**
projects that identity onto the network; **bus addresses** route to it without being it; and the
**DB-as-PKI** (crypto baked in) is where all of this lives and is custodied. One root (ZetaId),
crypto-bound, network-projected, routing-distinct — *traveler-framed, self-certifying, no mandatory
authority*.

## Build (backlog)

Define the ZetaId↔key-material relation (content-address of the public keychain root; per-scheme
"crypto ZetaId"); derive the Reticulum identity key in the keychain (its coin-typed path) and bind
its destination to the ZetaId; keep the bus-address composite referencing — not equal to — the
ZetaId (enforce identity≠routing). Composes with the identity+crypto unify build
(081KVNXBR4S08QG0R0015DHBBN), crypto-agile PQ keychain (081KVNYZXQ608QG0R002G35565), and the
hexagonal/DB-as-PKI decisions. (New build workitem to follow.)

## Anchors

ZetaId 128-bit content-address (BLAKE3 treaty `2026-06-07-blake3-content-address-treaty-…`;
`why=zetaid` categoried-generator research). Reticulum (destination = keypair hash; `network/`).
Writer-actor-routing-model (bus address = persona⊕surface⊕instance⊕topology; routing≠identity) +
`shared-checkout-is-view-only` rule. BIP HD keychain (`derive.ts`). Self-certifying identity /
content-addressed identity (the traveler-framed, no-mandatory-root shape; manifesto §1 scale-free).
