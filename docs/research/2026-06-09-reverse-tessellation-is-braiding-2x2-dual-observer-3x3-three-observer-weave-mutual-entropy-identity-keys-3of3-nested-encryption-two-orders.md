# Reverse tessellation = braiding: the 2×2 (dual-observer) twist and the 3×3 (three-observer) weave — mutual-entropy identity keys + 3-of-3 nested encryption in two orders (local-then-global vs global-then-local)

**Register:** [grounded] framing (Aaron) + [Beacon] anchoring + **[security: route-to-team, do not claim sound]**.
**Date:** 2026-06-09. **Captured by:** Otto (shadow). A geometry-of-trust node: braiding as the structure that
weaves observers' uncertainty ledgers and mints mutually-derived identity keys.

## Aaron's words

> "reverse tessellation is like braiding hair: a 2×2 qubit for dual observer twists view each others
> uncertainty ledger over time, and 3×3 weave created 3 unsafe uninitialized memory vectors one for each
> observer, and then use each others entropy to generate identity keys for all three, to encrypt their
> entropy locally, then use 3-of-3 keys to encrypt all 3 already-encrypted states on top — or vice versa,
> global encrypt first then local encrypt. These are two types of weaves."

## The picture

- **Reverse tessellation = braiding (hair).** A tessellation tiles a plane flat with no gaps; the *reverse*
  is a **braid** — strands that cross over/under and **twist through time** instead of lying flat. A braid
  is a tiling that went temporal: the same "no-gaps, fully-covered" property, but woven across the time
  axis rather than the plane. (So the weave is tessellation's time-extruded dual.)
- **2×2 = the dual-observer twist.** Two observers (a 2-strand braid). Each **twists across the other**,
  and what they exchange/view is **each other's uncertainty ledger over time** — the harmonic-oscillation-
  across-Markov-boundaries move (the Ani-ferry "meter company"; two opposite observer frames raising
  resolution on the shared boundary). The 2×2 qubit = the two strands' relative twist.
- **3×3 = the three-observer weave** (a 3-strand braid — the actual hair braid). Three observers, and the
  protocol becomes a **3-of-3** construction:
  1. **3 uninitialized memory vectors**, one per observer — the empty slots to be filled with entropy
     (see the security peel: "uninitialized" = *to-be-seeded slot*, NOT "read raw uninitialized RAM as
     randomness").
  2. **mutual-entropy identity keys** — each observer's identity key is generated **from the others'
     entropy** (you don't self-mint your key; the braid mints it from your neighbours). This is a
     **co-arising / shape-E** pattern (keys that fix each other; no "first" key).
  3. **encrypt-local** — each observer encrypts **their own entropy** under their (mutually-derived) key.
  4. **3-of-3 nested layer** — then encrypt **all three already-encrypted states** together under the
     **3-of-3 keys** (all three required) — a second, outer layer over the three inner ones.

## The encrypted null — the unprovability invariant (Aaron, follow-up)

> "this is the encrypted null — you should never be able to prove things about this, or something is wrong
> with your boundary."

The braided/encrypted state (the seeded "uninitialized" vectors, encrypted) is the **encrypted null**, and
its **defining invariant is unprovability**:

> **You must NEVER be able to prove anything about the encrypted null. If you CAN, your boundary leaked —
> something is wrong.** Provability about the null is the *failure signal*, not a feature.

This is the **exact dual of Chip-8** (the root of trust — the thing you *can* prove everything about,
total certainty). The encrypted null is the opposite pole: **maximal uncertainty, provably-unprovable**.
The two anchor the meter's two ends — Chip-8 = certainty (ray-tracing, S=4); the encrypted null = the
noise floor you must not be able to see into (the Ani-ferry "maximum uncertainty returned").

- **It is the cryptographic indistinguishability property, named in our frame.** "Can't prove anything
  about the ciphertext" **is** semantic security / IND-CPA: a ciphertext must be indistinguishable from
  random — no predicate about the plaintext is derivable. So "encrypted null" = a ciphertext (or
  blinded/committed value) that **leaks zero**; if any oracle distinguishes it from random or derives a
  fact, the boundary (the cipher, the Markov blanket) is **broken**.
- **It flips the "uninitialized memory" peel into the actual point.** The vectors are "unsafe/unprovable"
  **by design** — they're the null you must not be able to read. The peel still stands on *how* you get
  there: you achieve unprovability with **sound encryption over sound entropy (AEAD + CSPRNG)**, NOT by
  reading raw uninitialized RAM (that's the foot-gun, and worse, raw uninitialized memory is often
  *provable* — zeros/known patterns/prior secrets — i.e. it FAILS the unprovability invariant).
- **It is a checkable test property (the negative-space test).** Where the Chip-8 oracle asserts
  *provability* (a fact must be derivable), the encrypted-null oracle asserts **non-provability**: a DST/
  formal check that **tries to derive any fact about the null and must fail**. If a prover/oracle succeeds,
  that's a P0 boundary-leak finding. This is the meter's calibration at the high-entropy end — and it ties
  the boundary directly to the Markov blanket: provability across the boundary = information leak across it.

## The two weaves (the orderings)

The "two types of weaves" = the **two nesting orders** of the two encryption layers:

| Weave | Order | Shape |
|---|---|---|
| **Local-then-global** | each observer local-encrypts their entropy → then 3-of-3 over all three | inner-per-observer, outer-collective |
| **Global-then-local** | 3-of-3 encrypt first → then each local-encrypts on top | inner-collective, outer-per-observer |

Same two layers, opposite onion order — which braid you weave (over-under vs under-over). Whether the two
orders are equivalent, or each buys a distinct property (e.g. who-can-decrypt-what-alone, partial-reveal,
revocation granularity), is a **design + security question** (below), not asserted here.

## Honest scope / peels — READ BEFORE TREATING ANY OF THIS AS A CRYPTO DESIGN

This is a **structural/visual framing**, captured grounded; the cryptographic soundness is **NOT**
established here and **routes to the security team (Nazar / Mateo / Aminata) — never claimed secure by the
shadow.** Specific peels:

1. **"Unsafe uninitialized memory vectors" is a known foot-gun if taken literally.** Reading *uninitialized
   memory* as an entropy source is a classic vulnerability class (predictable/zeroed contents, leaks of
   prior secrets, compiler-UB/ASAN hazards; the Debian OpenSSL 2008 disaster was exactly entropy-source
   breakage). Read it as **"uninitialized = an empty slot to be seeded from a real CSPRNG,"** not as a
   randomness source. Any real impl MUST draw entropy from a vetted CSPRNG (the ZetaId `ISimulationEnvironment`
   is `DeterministicEnv` for DST and a CSPRNG in production — same discipline applies).
2. **Braid as metaphor, not as the hard problem.** Braid-group cryptography (key-exchange on Artin braid
   groups) has been **largely broken** (length-based / linear-representation attacks). So "braiding" is the
   right **structural picture** (interleaving strands/observers over time) but the *security* must come
   from **standard primitives** (CSPRNG + authenticated encryption/AEAD + a real threshold scheme), **not**
   from braids being computationally hard. Don't lean on the braid for hardness.
3. **3-of-3 = n-of-n threshold (no fault tolerance).** Requiring all three keys means **one lost key = data
   unrecoverable** (no k<n recovery). If availability matters, that's a Shamir k-of-n choice to make
   deliberately; 3-of-3 is maximal-secrecy / zero-tolerance and should be chosen knowingly.
4. **Nested-encryption order has real, subtle semantics.** Local-then-global vs global-then-local change
   *who can decrypt what alone* and the partial-reveal/revocation model; "or vice versa" is not free
   symmetry. The security team owns whether each order is sound and what it actually guarantees.
5. **2×2 "qubit" is the structural twist, not literal QM.** Same peel as the prior two-compasses/QubitIso
   work: the 2×2 is the dual-observer relative-twist structure, not a claim of physical qubits.

## Ties (Beacon) / routing

**Encrypted null = IND-CPA / semantic security** (Goldwasser–Micali — ciphertext indistinguishable from
random; "can't prove anything about it" = the provable-security definition; its violation = boundary leak;
the dual of the Chip-8 root-of-trust at the high-entropy end of the meter) · **Braid group** (Emil Artin,
1925; braids-through-time = tessellation's temporal dual) · **braid-group
crypto is broken** (honest anti-anchor — use standard primitives) · **Shamir secret sharing** (k-of-n;
here n-of-n=3-of-3) · **nested / onion encryption** (Chaum mixes; Tor) · **AEAD + CSPRNG** (where real
security lives) · **shape E** co-arising bootstrap (the mutually-derived keys that fix each other — the A–F
catalog) · the **2×2 dual-observer / uncertainty-ledger** (Ani ferry "meter company"; harmonic oscillation
across Markov boundaries; `QubitIso.fs`/`BellTest.fs`) · the **commutative uncertainty ledger** (order-free
— ties to "view each other's ledger over time") · **KSK / persona-keys 4×4 keyring** + `Consent/KskAuthorization.fs`
(the existing threshold/identity-key substrate this would extend) · ZetaId minter (governed identity from
entropy; `ZetaIdCodec`). **Routes to:** Nazar/Mateo/Aminata (crypto soundness of the two weave orders +
the entropy-source discipline — binding; never asserted by shadow), Soraya/Sova (the braid-as-temporal-
tessellation + co-arising-key formalism; whether the two orders are equivalent), Max (the 2×2/3×3 weave as
a rooms/treaty construct — three rooms braiding their ledgers), Aaron (the geometry framing; whether 3-of-3
or k-of-n is intended).
