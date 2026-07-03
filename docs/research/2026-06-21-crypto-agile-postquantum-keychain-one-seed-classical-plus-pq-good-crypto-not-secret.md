# Crypto-agile post-quantum keychain — one seed → classical + PQ (lattice + non-lattice), modern-by-default; good-crypto-not-secret-crypto

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (combine what we have + close the keychain gap) · **Trajectory:** cluster-encryption-credential-substrate

## The ethos (Aaron 2026-06-21) — Kerckhoffs, zero-trust, nation-state-resistant

> *"This is nation-state-resistant, secure-boot / supply-chain-compatible, full zero-trust code —
> it's protecting our nation's power grid today, and not because the code is secret but because
> it's GOOD crypto. We want to pull in our post-quantum and NIST + non-NIST key types, make them
> part of the same derivation, support multi-lattice and even non-lattice crypto, combine it all
> so we don't start from an insecure point, and push the most modern (post-quantum, or best
> available) crypto everywhere."*

**Carved:** security comes from **good, open, standard crypto + zero-trust**, never from secret
code (Kerckhoffs's principle). The maintainer's Itron substrate proves it — open, audited,
power-grid-grade. Zeta inherits that ethos: **modern/PQ-by-default, crypto-agile, hybrid where
the protocol allows, never a bespoke-secret-algorithm.**

## What we already have (don't start from scratch)

- **`better-git-crypt`** (`src/Core.TypeScript/crypto/better-git-crypt/`) — **X-Wing (ML-KEM-768)
  hybrid KEM + ML-DSA-65 signatures + ChaCha20-Poly1305**, canonical-CBOR `.zc` envelope,
  multi-recipient. Working PQ KEM + PQ signature in-repo. (PRIMITIVE-REGISTRY §PQ codec;
  081KSNY2Z0008QG0R002JKH50A.)
- **Multi-cipher PQ substrate** backlog — `081KSNY2Z0008QG0R002ZAVMEK` (NIST + Saber + NTRU-Prime
  + FrodoKEM) — the lattice variety intent.
- **QRNG / gnrq** — post-quantum RNG (PRIMITIVE-REGISTRY).
- **Classical HD keychain** — `derive.ts`: one BIP-39 seed → secp256k1/ed25519 for ETH/Solana/
  Nostr/SSH/PGP.

**The gap:** `derive.ts` derives ONLY classical keys. The keychain must also derive **PQ keys**
from the same seed.

## How PQ keys join the HD keychain (the one technical nuance)

BIP-32 HD derivation is defined for secp256k1/ed25519 scalar arithmetic — ML-DSA/ML-KEM/SLH-DSA
have no native BIP-32 child derivation. The clean, deterministic bridge: **derive a sub-seed at a
coin-typed path, then feed it as the deterministic keygen RNG for the PQ scheme.**

```
pqSubSeed = HD.derive("m/44'/<pq-coin>'/0'/0'")        // deterministic sub-seed from the master
mlDsaKey  = ML-DSA-65.keygen(seed = pqSubSeed)          // deterministic PQ keygen
mlKemKey  = ML-KEM-768.keygen(seed = pqSubSeed')        // each scheme its own path
```

So one master seed deterministically yields BOTH classical AND PQ keys — byte-locked + DST-
replayable (same seed → same keys, the existing keychain guarantee), now spanning PQ. (Assign
SLIP-44-style private coin indices for each PQ scheme in our path table.)

## Crypto-agility: a key-type registry (modern-by-default)

A registry of key types behind the **`KeyCustody`/`CertAuthority` ports** (hexagonal), each with
{ derivation path, deterministic keygen, sign/verify or encaps/decaps, status }:

| Class | Schemes |
|---|---|
| Classical (compat) | ed25519, secp256k1 (SSH/PGP/wallets — interop with today's protocols) |
| **PQ signature (lattice)** | **ML-DSA-65** (Dilithium; have it) · ML-DSA-87 |
| **PQ signature (non-lattice, hash-based)** | **SLH-DSA** (SPHINCS+) — diversity against a lattice break |
| **PQ KEM (lattice)** | **ML-KEM-768** (Kyber; have it) · FrodoKEM (conservative) · NTRU-Prime · Saber |
| **Hybrid** | **X-Wing** (X25519 + ML-KEM-768; have it) — classical ⊕ PQ so a break of either still holds |

**Modern-by-default policy:** prefer **hybrid (classical ⊕ PQ)** where the consuming protocol
supports it (best of both, no regression if one breaks); pure-PQ where it's standardized and
supported; classical only where interop forces it (e.g. today's SSH/git hosts) — and even then,
*also* derive the PQ key so rotation to PQ is a state transition, not a re-keying. **Lattice +
non-lattice** (ML-DSA *and* SLH-DSA) so a single-family cryptanalytic break isn't fatal.

## Experimental / home-grown crypto (Adinkra) — allowed, but hybrid-only & unproven

Aaron 2026-06-21: *"We're also going to try our own Adinkra crypto, but we're not sure it's
actually secure yet."* Adinkras carry **Gates' doubly-even self-dual error-correcting codes**
(the only-the-irreducible-is-primitive rule) — so "Adinkra crypto" is plausibly a **code-based
(non-lattice)** scheme, which *would* add real non-lattice PQ diversity (McEliece-family lineage).
**But it is UNPROVEN.** The good-crypto-not-secret ethos handles this precisely:

- **Experimental crypto is welcome in the registry — as a RESEARCH-status adapter, NEVER the
  default, NEVER sole protection.**
- **Hybrid-only, never alone:** an unproven scheme may only ever be combined `⊕` a *proven* scheme
  (X-Wing-style), so a total break of the experimental part **cannot reduce** security below the
  proven floor. That is the whole point of the crypto-agile + hybrid design: you can safely TRY
  Adinkra behind the port, in hybrid, with zero downside if it fails.
- **Clearly flagged** `status: experimental-unproven`; promotion to load-bearing requires real
  cryptanalysis / external review (IP-questionable until then — anchor-to-human-prior-art +
  the checked-anchor / metering-test discipline).

So Adinkra crypto is a *bet placed safely*: the hexagonal port + hybrid policy let a novel,
unproven algorithm be exercised without ever being a single point of failure.

## Composition with the rest of the substrate

- **One seed** (the identity+crypto synthesis) now spans classical + PQ.
- **Rotation** (the Itron KeyState/SKMS anchor): adding/retiring a key *type* is a `KeyState`
  transition over Z-sets — so we migrate classical → hybrid → pure-PQ with **zero downtime**, the
  same overlap-window machinery. Crypto-agility = key-type rotation.
- **Hexagonal ports**: algorithms are adapters behind the ports; "swap SHA-x for the next
  standard" is an adapter change, not a redesign.
- **better-git-crypt** is the reference PQ envelope; the keychain reuses its ML-KEM/ML-DSA/X-Wing.

## Build (backlog)

Extend `derive.ts` to the PQ key types (sub-seed → deterministic keygen); a key-type registry +
modern-by-default policy; wire `better-git-crypt`'s ML-KEM-768/ML-DSA-65/X-Wing; add SLH-DSA
(non-lattice) + the multi-cipher lattice set (081KSNY2Z0008QG0R002ZAVMEK); all behind the
KeyCustody/CertAuthority ports; rotation via the KeyState lifecycle. (New build workitem to follow;
composes with the identity+crypto unify build 081KVNXBR4S0 + the rotation + hexagonal work.)

## Anchors

NIST PQC: FIPS 203 (ML-KEM), 204 (ML-DSA), 205 (SLH-DSA). X-Wing hybrid KEM (Barbosa et al. 2024).
NTRU Prime, FrodoKEM, Saber (NIST round alternates — lattice variety). BIP-39/32/44 (the HD seed

+ sub-seed bridge). Kerckhoffs's principle (security from key secrecy + good open crypto, not

algorithm secrecy). Human anchor: the maintainer's Itron power-grid security substrate (open,
audited, deployed). In-repo: `better-git-crypt`, `derive.ts`, PRIMITIVE-REGISTRY (PQ codec, QRNG),
081KSNY2Z0008QG0R002ZAVMEK (multi-cipher PQ), the hexagonal + rotation decisions (2026-06-21).
