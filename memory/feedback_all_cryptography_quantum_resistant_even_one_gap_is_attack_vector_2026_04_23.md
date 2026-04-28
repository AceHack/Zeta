---
name: All factory cryptography must be quantum-resistant (PQC); even one classical-crypto gap is an attack vector; currently minimal crypto in-tree so this is forward-looking mandate
description: Aaron 2026-04-23 *"any crypto graphy we decide to use should be quantium resisten, even one place we don't use it could be a place for attack, we really don't have much any encryption yet so this is just a note for the future when we do"*. Hard rule for future crypto adoption. Even a single classical-primitive gap creates an adversarial lever (store-now-decrypt-later; downgrade attacks; hybrid-protocol confusion; third-party lib dependencies that use classical under the hood). Composes with Aaron's prior PQC research (lattice-based crypto, NIST FIPS 203/204/205/206) and with Aaron's Itron nation-state-resistant PKI background.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# All factory cryptography must be quantum-resistant

## Verbatim (2026-04-23)

> fyi any crypto graphy we decide to use should be quantium
> resisten, even one place we don't use it could be a place
> for attack, we really don't have much any encryption yet
> so this is just a note for the future when we do

## Rule

**Every cryptographic primitive adopted by the factory
must be quantum-resistant (post-quantum cryptography,
PQC).** Classical primitives (RSA, ECDSA, DH, ECDH,
classical signatures, AES without post-quantum KEM
wrapping in vulnerable contexts) are prohibited as
factory-default choices from this point forward.

The rule applies to:

- **Key exchange / KEMs** — ML-KEM (Kyber) or equivalent
  NIST FIPS 203 KEMs.
- **Signatures** — ML-DSA (Dilithium) or SLH-DSA
  (SPHINCS+) per NIST FIPS 204 / 205. FN-DSA (Falcon)
  per NIST FIPS 206.
- **Identity + attestation** — lattice-based identity
  (IBE / HIBE) over classical-pairing-based.
- **Zero-knowledge proofs** — lattice-based ZK
  (LatticeFold / Ligero / Brakedown) over pairing-based
  SNARKs (Groth16 / Plonk).
- **Hash-based signatures** — XMSS, LMS, SPHINCS+ are
  acceptable; classical RSA-signing is not.
- **Hybrid schemes** — acceptable where PQC primitives
  are combined with classical for defense-in-depth
  (IETF hybrid-KEM pattern); classical-only is not.

## Why

### 1. Even one classical gap is an attack vector

Aaron's framing is load-bearing: *"even one place we don't
use it could be a place for attack."* Adversaries compose
weaknesses across a system:

- **Downgrade attacks** — adversary forces the weakest
  protocol the system supports. A single classical
  fallback path becomes the default attack surface.
- **Confused-deputy / lib-chain** — a dependency deep in
  the stack uses classical crypto under the hood even
  when the top-level API is advertised as PQC. One
  library's classical primitive exposes the whole system.
- **Store-now-decrypt-later** — classical-encrypted data
  collected today can be decrypted when large quantum
  computers arrive. Future-secret-rotation doesn't fix
  already-exfiltrated ciphertext. Even "not
  load-bearing" classical-encrypted storage becomes
  tomorrow's disclosure.
- **Protocol-composition weaknesses** — a PQC-KEM over
  a classical-authenticated channel is only as strong
  as the classical auth.

One classical-crypto gap ruins the whole PQC posture.

### 2. Aaron's Itron background informs the mandate

Aaron has **nation-state-resistant PKI + secure boot
attestation + hardware escrow** experience from Itron
(per `user_aaron_itron_pki_supply_chain_secure_boot_background.md`,
per-user memory). He has built supply-chain-resistant
crypto infrastructure. His 2026-04-23 directive is not
hypothetical — it's the rule he'd apply to his own work.

### 3. Composes with the existing lattice-based-crypto
research pointer

Aaron 2026-04-19 already commissioned a lattice-based
cryptographic identity verification literature review
(per `user_lattice_based_cryptographic_identity_verification.md`
in per-user memory). That memory names the 2026 mainline
PQC stack (NIST FIPS 203/204/205/206), the relevant
primitives (Kyber / Dilithium / Falcon / SPHINCS+), and
the retraction-native-fit considerations (W3C VC status
lists over append-only CRL/OCSP).

This 2026-04-23 directive is the **mandate that elevates
the research pointer to hard rule**. The earlier memory
described the options; this one closes the door on
classical.

## Currently in-tree

Minimal crypto is in-tree today:

- Content-addressable hashing (SHA-256) in various
  places — not adversarially-resistant crypto, but
  content-addressability; not subject to this rule.
- CRC32C hardware-accelerated for Zeta's integrity
  checks — not crypto; error-detection.
- No key exchange, no signatures, no encrypted
  storage, no encrypted wire protocols.

Aaron's framing acknowledges this: *"we really don't
have much any encryption yet so this is just a note for
the future when we do."* The rule is **forward-looking**;
no current codebase is in violation.

## How to apply

### Before adopting any cryptographic primitive

1. **PQC-first check.** Is the primitive quantum-resistant?
   If yes, proceed under this rule. If no, stop and reach
   for the PQC alternative.
2. **Dependency audit.** If adopting a library that
   provides the primitive, audit its dependency chain
   for classical-crypto usage under the hood. Reject
   libraries that advertise PQC externally but use
   classical internally.
3. **ADR requirement.** Every crypto adoption lands
   under `docs/DECISIONS/YYYY-MM-DD-crypto-*.md` with
   explicit justification of PQC choice + rejection
   rationale for classical alternatives considered.
4. **Hybrid acceptance** — classical-PQC hybrids are
   acceptable for defense-in-depth during transition
   periods (2026 is such a period industry-wide);
   classical-only is not. Document the hybrid's PQC
   half explicitly.
5. **Third-party services using classical internally** —
   even when Zeta / factory code itself doesn't use
   classical, dependencies that do (TLS 1.2 without
   hybrid KEX, classical CAs, etc.) count as
   classical-gap exposures. Flag and track; replacement
   pressure applies.

### Exception protocol

Any classical-crypto adoption requires:

1. **Explicit ADR** naming why PQC is not acceptable
   here (not abstract — specific reason: library
   maturity, performance, interop requirement).
2. **Maintainer sign-off** (Aaron) because classical
   crypto crosses the payment-free / ops boundary —
   security posture is maintainer-scope.
3. **Exception memory** cross-referenced from this rule.
4. **Replacement plan** with timeline.

Exception without all four items is a violation of this
rule.

## What this is NOT

- **Not a demand to retrofit** — the factory currently
  has no crypto in violation. This rule applies to
  *adoption*, not to pre-existing code (of which there
  is essentially none).
- **Not a ban on content-addressable hashes** — SHA-256
  for content addressing, BLAKE3 for fast hashing,
  CRC32C for error-detection are not cryptographic
  adversarial uses.
- **Not a ban on random-number generation** — CSPRNG
  seeding from OS entropy is still fine; PQC concern is
  about primitives built on CSPRNG output, not the
  CSPRNG itself. Though CSPRNGs that depend on classical
  crypto under the hood warrant audit too.
- **Not a claim of expertise** — this rule captures
  Aaron's direction; detailed PQC implementation depth
  remains in the lattice-based-crypto research pointer
  + future expert-skill work (`security-researcher` /
  `threat-model-critic` roles are the right home for
  detailed review).
- **Not a requirement to ship PQC now** — the mandate
  is forward-looking per Aaron's phrasing. First crypto
  adoption lands under this rule; subsequent adoptions
  inherit it.

## Composes with

- `user_lattice_based_cryptographic_identity_verification.md`
  (Aaron's 2026-04-19 research pointer; this rule
  mandates the options that memory catalogs)
- `user_aaron_itron_pki_supply_chain_secure_boot_background.md`
  (Aaron's Itron nation-state-resistant-PKI background;
  substrate calibrating the why)
- `docs/security/THREAT-MODEL.md` (the threat model
  should list store-now-decrypt-later + downgrade +
  classical-dependency-chain as PQC-adoption drivers
  once this rule is absorbed in-repo)
- `.claude/skills/security-researcher/SKILL.md`
  (Mateo — proactive scouting for PQC primitives +
  classical-dependency-chain risks)
- `.claude/skills/threat-model-critic/SKILL.md`
  (Aminata — reviews the threat model; PQC posture is
  an adversary capability the model must account for)
- `docs/FACTORY-TECHNOLOGY-INVENTORY.md` (Open follow-up
  §5 captures the future PQC-clean? column)
- `docs/TECH-RADAR.md` — classical crypto primitives
  should land at Hold explicitly; PQC primitives at
  Assess → Trial → Adopt as they're evaluated
