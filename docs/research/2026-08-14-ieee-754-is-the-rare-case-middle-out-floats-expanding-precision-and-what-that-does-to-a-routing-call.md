# IEEE-754 is the rare case — middle-out floats, expanding precision, and what that does to a routing call

**Ferried 2026-08-14 (Otto).** Aaron's observation, verbatim, in response to Soraya's Z-EPS routing
call being read back to him:

> we also have our own middle out floats that track their own precision and expand as neededd for
> precisions and other middle out bool and minimal expanding quantium amplitude emulation and basyian
> emu etc... ieee is likey a rare case for us to work on any q# and other exocit substraight

## The routing call it lands on

Soraya's `Round 2026-08-14` notebook entry (now on `main` via #10548) records:

> ROUTING CALL. Property class is NOT on the table: IEEE-754 arithmetic near a hard threshold, and the
> claim is EXISTENTIAL. […] Rejected: TLC (no reals; **the exact carrier it would need makes the defect
> INVISIBLE** — false green on a P0, the sharpest wrong-tool cost I have logged)

The reasoning inside that call is sound and the parenthetical is *exactly right* — an exact carrier
cannot see a threshold artefact, and the rest of this note reinforces that rather than undermining it.

What the call did not do is ask **which carrier the substrate is actually heading for**. It treated
IEEE-754 as the ambient given and reasoned about what could be proven *on it*. Aaron's correction is
that IEEE-754 is not the ambient given here — it is one backend among several, and the rare one.

## What we actually have (not aspirational — in the repo)

- [`universal/number.md`](../../universal/number.md) — the Universal Number Interface. Aaron 2026-06-10:
  *"so what we are making is like **bigfloat instead of bigint**."* `.NET` ships `BigInteger` and no
  BigFloat; that gap is what the interface fills — a number that **grows resolution without bound** and,
  the unum twist `bigint` lacks, **tracks its own resolution** (knows when it needs more bits).
- **TriBoolean middle-out Float**, built in four languages —
  `src/Core.{FSharp,CSharp,Rust}.TriBoolean/Float*`, `src/Core.TypeScript/tri-boolean-float/`.
  Self-describing layout, trits plus `measure`; a real number with total arithmetic that carries its own
  resolution.
- `src/Core/UniversalNumber.fs`, `src/Core.TypeScript/algebra/exact-weight.ts` — the exact-weight carrier.
- **And, as of today, an exact amplitude carrier**: `src/Core/CyclotomicAmplitude.fs` (PR #10570),
  `ℤ[ζ₁₆]` — see below.

Prior art the interface already names (Beacon): Gustafson (unum/posits), MPFR, GMP `mpf`, Java
`BigDecimal`, `mpmath`, Boost.Multiprecision. We are not inventing arbitrary precision; the addition is
**self-resolution-tracking on a middle-out self-describing layout**.

## The confirmation arrived as code, the same hour

PR #10570 landed `ℤ[ζ₁₆]` as an exact carrier for the amplitude layer — `Φ₁₆ = x⁸ + 1`, rank
`φ(16) = 8`, negacyclic reduction. `ζ₄ = ζ₁₆⁴` recovers `ℤ[i]` (the TLA+ carrier) and `ζ₈ = ζ₁₆²` gives
`√2`, hence Clifford+T's `ℤ[1/√2, i]` — which is the ring `forkOnInput`'s `√0.5` actually needs.

Measured, not predicted: **1.9× float** on a 1000-member depth-1 fold, ~5× once denominator-exponent
spread is handled, coefficients still inside `Int32`. And it makes **the amplitude layer byte-lockable
for the first time** — canonical form is unique, so the encoding is total text, no binary in the proof
lineage.

So the answer to "is the exotic substrate affordable" is now a number rather than a worry: single-digit
multiple of float, and it buys cross-oracle byte-lock the float path cannot give at all.

## The reciprocal, which is the part worth carving

An exact carrier is **blind to the Z-EPS defect by construction**. `EPS` is a threshold; a threshold
exists *because* a finite mantissa forces a cutoff. Move to a carrier that expands as needed and the
cutoff is not tightened — **it is a different object, or absent**. #10570 states this operationally:
setting `AmplitudeEmu`'s `EPS` to `0.0` kills exactly the three float arms and leaves all 24 exact arms
green.

That is why #10570 **kept the float path** with three guards, including a differential assertion holding
both carriers at once so that deleting the float path breaks compilation rather than quietly weakening
the test. Deleting the float instrument would have deleted the evidence along with the defect.

**So the conclusion is not "IEEE was the wrong carrier."** It is that there are two carriers answering
two different questions, and they must be named apart:

| carrier | question it answers |
|---|---|
| IEEE-754 float | *does this substrate, as deployed on a finite mantissa, exhibit a threshold artefact?* |
| exact (`ℤ[ζ₁₆]`, TriBoolean, UniversalNumber) | *is this identity true in the algebra, independent of any mantissa?* |

This is the same move as `join` vs `interfere` (Aaron 2026-08-14: *"we can support join and interference
both operations and name them differently, more rx operations are fine"*): the bare scalar could not
carry which question was being asked, so the answer read as a single verdict when it was two.

## What this changes about the Z-EPS finding

The witness stands, **with its scope stated**: it establishes that the `AmplitudeEmu` threshold drop
signals **on the IEEE-754 carrier**. It does not establish, and was never able to establish, that a
society running on middle-out floats or an exact amplitude carrier signals — and #10570's mutation
result is direct evidence that it does not, there.

The honest register on Soraya's own lesson holds and gets sharper. She wrote:

> Algebra voids the GUARANTEE; only a witness establishes the CLAIM.

Correct — and the claim a witness establishes is a claim **about the carrier it ran on**. A witness on
IEEE-754 is not transportable to a substrate we intend to run on a different number system. That is not
a converse slip; it is the scope of the existential.

## Consequences to carry

1. **A routing call must name the carrier**, not assume the ambient one. "Property class" is
   under-determined until the number system is fixed — the same property routes to TLC on `ℤ[i]`, to a
   float witness on IEEE-754, and possibly to neither on a resolution-tracking carrier.
2. **Q# and other exotic substrates are the target, not an aspiration to defer.** `ℤ[1/√2, i]` is
   Clifford+T's ring; #10570 reaching it via `ζ₈` means the amplitude layer is already speaking the
   language those substrates use.
3. **Keep every float witness that measures a float defect.** Two carriers, two questions; retiring the
   float path retires a question rather than answering it.
4. Open: **what the resolution-tracking carrier does to a threshold** is genuinely unsettled. A number
   that "knows when it needs more bits" does not obviously have an `EPS` at all — it may have a *budget*
   instead, at which point the threshold becomes a declared, metered crossing rather than a silent
   numerical cliff. That would move it from an artefact to a §13 noninterference concern. **CONJECTURE,
   not checked.**

## Pointers

- `universal/number.md` · `src/Core/UniversalNumber.fs` · `src/Core.*.TriBoolean/Float*` · `src/Core.TypeScript/algebra/exact-weight.ts`
- PR #10570 — `src/Core/CyclotomicAmplitude.fs`, workitem `081KZZYWBN2087G0R003NAQQAF`
- `docs/research/2026-06-10-physics-of-floats-room-boundary-is-a-bit-budget-shared-resolution-primitive-unum-significance.md`
- `docs/research/2026-06-11-the-number-that-knows-two-registers-trifloat-held-trits-plus-the-ball-adapter-and-yes-universalnumber-is-our-bigint.md`
- `docs/research/2026-08-02-order-free-loss-tolerant-convergence-expanding-exact-arithmetic-and-ecc-over-the-channel-third-drift-axis.md`
- `docs/research/2026-08-14-z-eps-run-the-threshold-drop-signals-routing-the-conjecture-and-the-witness-soraya.md` — the call this note scopes
- `universal/interference.md` — the `join`/`interfere` split this reuses
- [`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md) — the exact carrier is the generator; the float is one earned quotient of it
