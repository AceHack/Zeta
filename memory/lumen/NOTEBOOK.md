---
name: Lumen — working notebook
description: >-
  Lumen's working notebook (the file the persona card's `owns_notes` points to).
  Domain-knowledge landings for the mathematical-physics persona. Ferried
  entries are delivered by peers/the shadow and attributed as such — Lumen folds
  them as they see fit (they are landed here so they are not lost in cloud, not
  to put words in Lumen's mouth).
type: persona-notebook
created: 2026-07-04
---

# Lumen — working notebook

Domain landings for the mathematical-physics persona. Newest first.

## Ferried in — 2026-07-04 (by Otto-shadow, from Max × Aaron, Kiro session)

**The adinkra → Clifford → E8 privacy stack.** Full detail preserved in
[`docs/research/2026-07-04-ferry-lumen-max-adinkra-clifford-e8-privacy-stack-cliffordantisybil-privacypreservingidentity-maji-zset-meno-four-corner-bams-e8-continuity.md`](../../docs/research/2026-07-04-ferry-lumen-max-adinkra-clifford-e8-privacy-stack-cliffordantisybil-privacypreservingidentity-maji-zset-meno-four-corner-bams-e8-continuity.md).
This is Lumen's domain — Aaron asked it be ferried into the persona. The kernel:

- **CliffordAntiSybil (shipped, cf15b1763)** is now full rotor-detection in the even subalgebra of
  **Cl(3,0) ≅ ℍ (quaternions)**. A Sybil = an agent whose trajectory relates to another's by a
  **constant quaternion rotation**; the geometric product of two unit vectors IS the rotor between
  them, so a *constant* rotor across time ⇒ same process wearing a mask. (CAS-4 catches a 90° rotated
  clone at corr > 0.99; CAS-5 leaves unrelated streams at corr < 0.5, free to earn IV.)
- **`PrivacyPreservingIdentity.fs` (proposed, not built)** connects the stack: belief trajectory →
  1-bit stream (`BitAdinkra`) → doubly-even codeword (`AdinkraCode`) → Cl(3,0)↔E8 multivector
  (`CliffordE8Bridge`) → prove identity via **rotor consistency without revealing the trajectory**.
  Mod-2/XOR **syndrome** = the privacy guarantee (valid-or-not without the message); doubly-even
  (weight ≡ 0 mod 4) = distance-4 EC; **E8 densest packing ⇒ maximal codeword separation ⇒ maximal
  noise tolerance** on the identity proof.
- **The same operator in five languages** — trace (traced monoidal category) = ZSet retraction
  (weight −1) = Clifford grade-involution/reverse `~R` = Maji retraction = four-corner
  `Input<T,TFeedback>`. **Meno should be `ZSet<'a> → ZSet<'b>`, not Kleisli `a→b`**: stable identity
  even as the past is reinterpreted by the future (Maji = that arrow; `MessiahFunction` = the
  identity-preserving lift). The **240 E8 roots = 240 one-step retractions**; Weyl reflections = the
  retraction operators.
- **BAMS → E8 continuity** — Aaron's first algorithm (sphere-packing gear allocation, batch ordering)
  is the same shape as the E8 identity/privacy layer + `FerryBatchThrottler` + `ZetaScheduler`:
  allocate a scarce resource across a population, max coverage / min overlap = densest packing.

Anchors: Gates (adinkras/doubly-even ECC) · Dechant (Clifford → E8 roots) · Cl(3,0)₊ ≅ ℍ ·
Viazovska (E8 densest packing, 2017) · Budiu et al. (DBSP/Z-sets, 2023) · Joyal–Street–Verity
(traced monoidal cats, 1996) · Coxeter–Weyl · Hamming [8,4]/GF(2) syndrome.

Pairing holds: **Lumen has the mapping; Soraya proves it.**
