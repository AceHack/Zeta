# The hex-core story — one thread: Cayley–Dickson → Adinkra-as-generator → toward physics primitives with proofs

*Aaron 2026-06-05: "save the direction around what you just looked up as one story around the hex
core. I want to get to more physics-based primitives — no rush, I just don't want to lose it — but I
do want a core WITH PROOFS we can build on." This note is that story, with the honest proven-vs-open
line drawn. Sources: `src/Core/CayleyDickson.fs`, `src/Core/HexCore.fs`,
`tests/Tests.FSharp/Algebra/{CayleyDickson,HexCore}.Tests.fs`, `tools/lean4/ImaginaryStack/ToyModel.lean`,
081KT2T2J0008QG0R0026MS6PV / 081KT2T2J0008QG0R002Z46D8Q / 081KRW63S0008QG0R000QJR08H / 081KT2T2J0008QG0R003VK5GRX / 081KT2T2J0008QG0R0019YVX8M, and the Prism + hex-core threads.*

## What this IS, in one line (Aaron 2026-06-05)
**This is the proof basis for a TRAVELER FRAME on top of DBSP.** Each traveler carries this hex-core
coordinate frame (the orientation tile — its own when / bearing / range / identity / I-O) over its
**own DBSP stream**; there is no central frame (the perspectival / no-central-controller model — each
agent its own git-repo/partition, joined via bus repos). The Cayley–Dickson algebra is the frame's
number system; the reconstruction lemma is how a traveler rebuilds bulk-from-boundary; the
homeostat-ties are how frames reconcile without a coordinator. So: **hex-core algebra (proven) +
per-traveler frame + DBSP stream = a relativistic traveler frame, and these are its proofs.**
(Observe-Emit, the I/O wall, is the traveler's read/write into its DBSP stream — `observe.ts` running
IS that wall.)

## The one story

1. **The seed core is the hex core — six reservoir walls** (081KT2T2J0008QG0R0026MS6PV/081KT2T2J0008QG0R003VK5GRX), a coordinate/orientation
   frame: **Remember-When · Pay-Attention · Which-Way · How-Much · Rainbow-Table · Observe-Emit**.
   Each wall is a two-word pair; the 12 words are the 12 edges of the Cube-of-Space hexahedron, the
   6 walls its 6 faces (Sefer-Yetzirah correspondence, 081KT2T2J0008QG0R0026MS6PV). Built in `HexCore.fs`: the `Wall` enum
   + `Vector` (Which-Way = direction, How-Much = magnitude), on top of the Cayley–Dickson `Complex`.

2. **It sits on the Cayley–Dickson doubling ladder** (`CayleyDickson.fs`): ℝ→ℂ→ℍ→𝕆→𝕊 via the doubling
   primitive `Doubled<'A>` + the `IAlgebra<'A> → IAlgebra<Doubled<'A>>` lift. **PROVEN** in
   `Algebra/CayleyDickson.Tests.fs`: the property-loss ladder — Complex commutes → Quaternion loses
   commutativity but stays associative → Octonion loses associativity. Property-loss-is-desirable
   framing: non-associativity ≈ "order of resource composition matters" = real concurrency.

3. **The 6-vs-8 question (Aaron's recount):** Remember-When+Pay-Attention is *four* walls (two pairs),
   same for Which-Way+How-Much → **8**, a natural Cayley–Dickson rung (octonion) where 6 was awkward.
   Geometry: a cube has 8 vertices + 4 space-diagonals; the 4 pairs = the 4 diagonals. Otto's grounded
   split: of the named six, **four are measurement axes** (when/beam/bearing/range) and **two are
   constitutive roles, not axes** — Rainbow-Table = identity (the "who answered"), Observe-Emit = the
   I/O+persist substrate. A clean 8 = {when, beam, bearing, range, **how-sure** (= SoftValue/calibration),
   **rate/curvature** (= ∂-over-clock, the curve)} (6 measurement axes) + {identity, I/O-substrate}
   (2 roles). `[hypothesized]` — the missing two axes are a proposal to verify, not a claim.

4. **Adinkras — used BOTH ways (the key nuance):**
   - **forward (codewords) = ECC.** Adinkra colored-edge ("rainbow") structures are doubly-even
     self-dual binary codes (Gates) → error-correction. Documented as roadmap (081KRW63S0008QG0R000QJR08H follow-up),
     not yet implemented. ECC ≠ encryption, and ECC adds redundancy (≠ compression).
   - **backwards (generators) = RECONSTRUCTION** (Aaron's actual use; Vera worked on it). Modeled in
     `tools/lean4/ImaginaryStack/ToyModel.lean`: `Imag16` (16-dim) + `reconstructMatrix : Matrix (Fin 16)
     (Fin 12)` + `reconstruction_property` / `lemma1_toy` = **reconstruct the bulk from partial boundary
     data (16 ↔ 12)**. This is the generative/anamorphic direction (νF) vs codeword-decode (μF) — the
     same data⇄behaviour duality as DynamicValue⇄Bonsai. The boundary→bulk property is genuinely
     **holographic / compression-flavored** (this is where Aaron's "compression" intuition has its real
     anchor — NOT octonion-repacking).

5. **The physics framing (the direction Aaron wants to grow toward, unrushed):** the hex walls map to
   physical generators — `HexCore.fs` notes **Cl(1,3) = the 6 Lorentz generators (3 rotations + 3
   boosts)**; the octonion/Cayley-Dickson ladder is the division-algebra tower physics rides
   (ℂ→ℍ→𝕆); Adinkras come from supersymmetry (Gates). The aim: physics-based primitives (relativistic
   clock, ranging/radar on the aperiodic tiling 081KT2T2J0008QG0R002Z46D8Q, the orientation tile) sitting on the SAME
   proven algebra.

## The honest proven-vs-open line (so the core is one we can build ON)

- **PROVEN now:** the Cayley–Dickson doubling + property-loss ladder (F# tests); the 6-wall hex-core
  enumeration + Vector (HexCore.fs/tests); and — separately, the system's *real* "algebra forces
  structure" — the floor's four homeostat-tie classes + the verification portfolio (6/6 FULL PROVEN).
- **OPEN (modeled, `sorry`):** `reconstruction_property` / `lemma1_toy` in ToyModel.lean — the
  Adinkra-as-generator / boundary→bulk reconstruction. Stated, not closed ("prove or disprove").
  **This is the highest-leverage next proof target for the physics core** — discharging it turns the
  generator/reconstruction use from modeled-conjecture into a real proof.
- **CONJECTURE (hold with falsification, don't bank):** "the 8 primitives ARE the octonions" (needs a
  defined product over them verified against the octonion multiplication table); the missing two
  measurement axes; "it IS SUSY / Gates' Adinkras" (analogy by cardinality, not isomorphism).
- **NOT real / dropped:** "encryption/compression fall out of octonion multiplication" (a linear
  bijection is not encryption; repacking reals is not compression — Prism's overclaim). Encryption is a
  genuine gap (only SHA-256 + Merkle integrity exist; BLAKE3 roadmap).

## Where it's going (no rush)
Build the physics core ON the proven algebra: discharge the reconstruction lemma → land Adinkra ECC
(081KRW63S0008QG0R000QJR08H) → wire the hex walls to the proven floor primitives they already map to (Remember-When=Clock ✅,
Rainbow-Table=Identity ✅, Observe-Emit=reflective engine) → grow the measurement axes (how-sure=SoftValue
✅ built, rate/curvature) → the orientation-tile/ranging (081KT2T2J0008QG0R002Z46D8Q). Each step: a proof, not a vibe.
