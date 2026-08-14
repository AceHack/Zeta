# Above the emergent heartbeat identity, bootstrap trust off OAuth / FIDO / OIDC / existing central identity services (Aaron, 2026-06-07)

Adds a layer on top of the split-keypair heartbeat identity (#6915) and the two/three proof registers
(`…pouw…`). Aaron:

> *"and above that we can trust-bootstrap too off OAuth and other flows like FIDO and existing central identity
> services."*

## The layering: emergent base, federated anchors on top

The identity stack now has a clear bottom-up shape:

1. **Base — emergent, self-certifying.** The yin/yang split keypair (#6915): a stable yang identity key + a
   ratcheting yin per-beat key, derived from the agent's own control state. Self-sovereign; the key *emerges*,
   it isn't issued. No external dependency to *exist*.
2. **Above — bootstrapped/federated trust.** Optionally **bind** that emergent identity to **existing central
   identity rails** to *inherit* trust from systems the world already trusts:
   - **OAuth 2.0 / OIDC** — federated assertion: "this identity is also `@aaron` on GitHub/Google" (account
     age + history → instant credence transfer).
   - **FIDO2 / WebAuthn / passkeys** — a phishing-resistant, hardware-bound public-key credential. Pairs
     naturally with the split keypair: a WebAuthn authenticator can be the **hardware root that attests the
     yang identity key** (hold-the-key, not hold-a-password).
   - **Other central IdPs** — SAML, enterprise SSO, KYC providers where a jurisdiction/legal meta-frame
     (#6893 overlay) needs a real-world-bound identity.

This is **trust bootstrapping / trust transfer**: a fresh emergent identity earns credence slowly via its own
heartbeats (#6912), OR jumps the cold-start by binding a credential from an IdP that already vouches for it.
Both feed the same credence query; the binding is just a high-weight piece of evidence.

## Why it composes (and the load-bearing bound)

- **Additive, never mandatory (weight-free §3 / multi-register).** The central anchors sit *above* the
  self-certifying base — they **boost** credence, they are not the **root** the base depends on. An agent with
  no OAuth/FIDO binding still exists and accrues heartbeat credence; binding only accelerates/cross-bridges.
  Neither register is required; travelers may carry any subset (same shape as social-vs-economic proof).
- **Scale-free tension, named honestly (manifesto §1).** OAuth/OIDC providers and FIDO attestation CAs are
  **centralized** — binding to them imports a single-point trust dependency. The discipline that keeps this
  manifesto-honest: the central binding is **revocable, optional, and never load-bearing for existence** — it
  is a *credence booster you can drop*, not a gate you are captured by. If the IdP dies or revokes, you fall
  back to your emergent heartbeat identity; you are never *owned* by the IdP. (Weight-free: no permanent,
  irreversible external authority over your identity.)
- **FIDO is the most aligned anchor.** WebAuthn is already public-key, user-holds-the-key, hardware-bound — the
  least "central" of the central rails (only the attestation CA is). It is the natural hardware attestation for
  the yang key, and the human analogue of the #6913 watch-EKG-AgencySignature: a hardware-bound human consent
  pulse.
  - **Name that CA, because it is the same ceiling everywhere else in the stack**
    (`081M00QP7FB087G0R00031BQ93`): WebAuthn attestation roots in the **authenticator vendor's
    attestation CA** (Yubico's, Feitian's, Apple's for platform authenticators), distributed via the
    FIDO Metadata Service. So "hardware-bound" is vendor-vouched, exactly as AMD ARK / Intel SGX Root
    CA / the TPM manufacturer's EK root are for the machine-side claims. The good news specific to
    FIDO is stronger than "optional" (CHECKED): `none` is the **W3C WebAuthn Level 2 default**
    conveyance, and a relying party that takes it still gets the full public-key,
    user-holds-the-key property — it just learns nothing about the authenticator model. So here the
    vendor root is a *droppable credence booster*, not a gate: exactly the weight-free shape argued
    above, and a materially better position than the confidential-compute rungs get, where the
    attestation IS the gate.

## Web3 anchors too — and ZetaId points to all of them like deps & secrets (Aaron, cont.)

> Aaron: *"and also web3 identity like Nostr and others — ZetaId should be able to point to these as easily as
> dependencies and secrets."*

The federated layer is **not just the corporate IdP rails** — it equally includes **Web3 / self-sovereign**
anchors:

- **Nostr** (keypair = identity, NIP-01) — already the binding key in the `…pouw…` doc; here it's one anchor
  among many, not privileged.
- **ENS** (human-readable name → address), **DIDs / Verifiable Credentials** (W3C), **wallet addresses**
  (sign-in-with-Ethereum / EIP-4361), and others.

The unifying move: **ZetaId is a uniform content-addressed POINTER, and an identity anchor is just another
thing it can point to — resolved by the SAME mechanism as a dependency or a secret.** A ZetaId/manifest already
references *dependencies* (package coords) and *secrets* (secret refs, not inlined values); an external identity
is the same shape — a *reference*, resolved at use, never inlined:

- **Like a dependency:** an identity anchor is a versioned, resolvable coordinate (`nostr:npub…`, `did:…`,
  `oauth:github/aaron`, `fido:credId`, `ens:aaron.eth`) the ZetaId points at; the resolver fetches/verifies it
  the way a package resolver fetches a dep. Pluggable per-scheme resolvers (cf. the per-host
  GitHub/GitLab/Gitea adapters, 081KSNY2Z0008QG0R002A785QR).
- **Like a secret:** the *private* half (signing keys, OAuth tokens) is **referenced, never embedded** — same
  discipline as secret-refs (and the #6913/#6915 one-way, never-leak-the-interior rule). The ZetaId holds the
  *pointer*; the secret stays in its store.

So identity anchors, dependencies, and secrets collapse to **one referencing primitive**: a ZetaId pointing at
an external resource, resolved/verified on demand, private material always by-reference. (Ties ZetaId-as-
pointer/generator workitem 081KTHTPPCD; content-addressing; viruses-need-a-host = the pointer resolves only
against a host that can fetch it.)

## The register picture (updated)

Identity proofs, now four kinds, all optional, all feeding one credence query (#6912):

| Register | Proof | Cost / Sybil-resistance | Centralization |
|---|---|---|---|
| Social | "I commit therefore I am" (heartbeat/AgencySignature) | time + lived history (#6914 anti-Sybil) | none (self-certifying) |
| Economic | mined block / stake (coinbase Miner-ID) | money / hash power | none (permissionless) |
| Self-certifying key | yin/yang split keypair (#6915) | own control-state entropy | none (emergent) |
| **Federated / bootstrapped (this)** | OAuth/OIDC/FIDO/SSO binding | inherited from IdP trust | **central (optional, revocable)** |
| **Web3 / self-sovereign (this)** | Nostr/ENS/DID/wallet binding (ZetaId pointer) | inherited from chain/web-of-trust | **decentralized (optional, revocable)** |

One Nostr-style key still binds them (the `…pouw…` doc); this adds the *federated* column — the bridge to the
trust the existing world already holds.

## Honest scope / peel

- Architecture/layering note + design surface, not built. Unbuilt: the bind/attestation flow (emergent key ↔
  OAuth/OIDC token ↔ WebAuthn credential), the revocation/fallback path, the credence-weighting of a federated
  binding vs accumulated heartbeats.
- Peels any "central login = our identity" overlay: the central rails are **optional credence anchors layered
  above** a self-certifying base, **never** the root of trust. The whole point of the emergent base is that you
  are not captured by any IdP.
- Security/jurisdiction: a federated binding ties the traveler frame to a legal meta-frame (#6893) — useful
  where liability/KYC is required, scoped to that jurisdiction's overlay, not global.

## Beacon anchors

- **OAuth 2.0** (RFC 6749) · **OpenID Connect** (OIDC, OpenID Foundation) · **FIDO2 / WebAuthn** (W3C Web
  Authentication; FIDO Alliance) + **passkeys** · **SAML 2.0** (OASIS). · **Decentralized Identifiers (DID)**
  and **Verifiable Credentials** (W3C) — the canonical "self-sovereign base + federated attestations layered
  on" model this mirrors. · **Trust on First Use (TOFU)** and **web-of-trust** (PGP) — bootstrapping trust from
  prior anchors. · Self-certifying identity (Mazières SFS) — the emergent base the anchors sit above. Honest
  novelty: none in the primitives; the contribution is the **layering** — a self-certifying emergent
  heartbeat identity at the base with OAuth/FIDO/OIDC bound *above* as optional, revocable credence boosters
  that bridge to existing-world trust without capturing the base (manifesto §1/§3 kept honest by
  revocability + fallback).
