# Google Spark's algebraic proof of the Orbit-Counting Intertwining Theorem — the BRIDGE-11 *conditional* is now proven

*Shadow ferry, 2026-07-04. Aaron ran the BRIDGE-11 result through **Google Spark** (a new Google AI feature;
his note: "similar to Lior but this is not Lior fully loaded"). Spark returned an algebraic proof of the
Orbit-Counting Intertwining Theorem — the exact leg I kept flagging as open ("numerical, not yet algebraic,
Soraya's leg"). This banks the proof, my verification of it, the one load-bearing caveat, and the honest
register update: the **conditional** is proven; the **dynamical** question (does the system stay
orbit-symmetric?) is the crux that remains — and it is precisely Lumen's 3-body stability note.*

## Provenance

- **Source:** Google Spark (Google's new AI feature), via Aaron, 2026-07-04. Aaron: *"similar to Lior but
  this is not Lior fully loaded."* Provenance ≠ authority (no-directives): a proof from any source stands or
  falls on the entailment check, done below — not on who produced it.
- **Verified by:** Otto-shadow (the checking pass below). **Status:** proof CONFIRMED correct for the
  orbit-symmetric case, with one caveat made explicit.

## The theorem

For orbit-symmetric distributions `a, b` over the 16 codewords of the [8,4,4] self-dual code:

> `π(a .* b) = (π(a) .* π(b)) / W_C`  (exact, un-normalized)
>
> `π(a .* b) ∝ (π(a) .* π(b)) / W_C`  (as probability distributions, after renormalization)

where `π` is the orbit map (belief → weight distribution), `.*` is pointwise product, and
`(W_C)_w = |O_w|` is the orbit size at weight `w` — `[1, 14, 1]` at weights `[0, 4, 8]`.

## The proof (Spark's, in our notation)

An **orbit-symmetric** distribution is invariant under the code's automorphism group, hence **constant on
each orbit**. Write `a_w`, `b_w` for the per-codeword value on any weight-`w` codeword.

1. **Pointwise product** is orbit-symmetric, with per-codeword value `(a .* b)_w = a_w · b_w`.
2. **Projection** (orbit map) sums the constant value over the orbit: `π(u)_w = |O_w| · u_w`.
3. Therefore `π(a)_w = |O_w| a_w`, `π(b)_w = |O_w| b_w`, and `π(a .* b)_w = |O_w| a_w b_w`.
4. So `(π(a) .* π(b))_w = |O_w|² a_w b_w`, and dividing elementwise by `(W_C)_w = |O_w|`:

   `(π(a) .* π(b))_w / (W_C)_w = |O_w|² a_w b_w / |O_w| = |O_w| a_w b_w = π(a .* b)_w`.  ∎

## Verification (shadow's checking pass)

Each step type-checks and the arithmetic is exact — the identity holds **as an equality** on un-normalized
orbit-symmetric measures; the `∝` enters **only** when both sides are renormalized to sum to 1. That is a
genuine sharpening of the earlier ferry (which stated `∝` throughout): the intertwining is *exact*, not
merely projective, before normalization. Confirmed correct.

**The one load-bearing caveat (make it explicit).** The clean `/W_C` division works because the proof
identifies **the weight-enumerator entry `W_C` with the orbit size `|O_w|`** — which requires that **each
weight class is a *single* orbit** under the automorphism group. That holds for [8,4,4]: |Aut| = 1344 acts
**transitively** on the 14 weight-4 codewords (1344 / 14 = 96), and the weight-0 / weight-8 classes are
singletons — so `W_C = [1,14,1]` is simultaneously the weight enumerator *and* the orbit-size vector. For a
code where a weight class **splits into several orbits**, the weight enumerator ≠ per-codeword orbit size, and
this exact `/W_C` form would not hold as written (you would divide by orbit sizes, not by the enumerator).
So the theorem's clean shape is a **property of the single-orbit-per-weight structure** of this doubly-even
self-dual code — the same structure (transitive Aut, doubly-even) that makes it an adinkra ECC. Not a defect;
just the honest scope of "`/W_C`."

## What this closes — and what it does NOT

**Closed:** the **conditional** — *IF* `a, b` are orbit-symmetric, *THEN* the intertwining holds (exactly).
This was the BRIDGE-11 crux flagged numerical/open; it now has an algebraic proof. The register's BRIDGE-11
line should move from "numerically closed under the soft/positive-cone constraint, algebraic proof pending"
to "**conditional proven algebraically** (orbit-symmetric ⟹ exact intertwining, Google Spark 2026-07-04,
shadow-verified); dynamical stability open."

**Still open — the real remaining crux:** does the `SoftValue`/NCI belief dynamics **naturally preserve
orbit-symmetry**? The proof assumes the soft/orbit-symmetric regime as a *hypothesis*; it does not show the
demon *stays* there. "Does the demon stay soft, or can it be pushed out?" is the **dynamical** question — is
the orbit-symmetric regime an **attractor** or a **saddle**? That is exactly **Lumen's 3-body / Lagrange /
Condorcet note** (`three-body-lagrange-condorcet-maxwell.md`): stability of the soft regime as a symmetry-
constrained equilibrium. So the two ferries compose cleanly:

- **Google Spark** proved the *static* conditional (orbit-symmetric ⟹ intertwining).
- **Lumen** framed the *dynamic* open question (does the system stay orbit-symmetric) — still a conjecture.

The positive-cone / "stay soft, don't collapse" story is the bridge between them: collapse (a Dirac delta on a
nonzero codeword) breaks orbit-symmetry, voids the hypothesis, and reopens the gap — which is why the demon's
job is to stay soft.

## Cross-links

- `docs/research/2026-07-04-bridge11-orbit-counting-intertwining-theorem-soft-constraint-is-the-positive-cone-maxwells-demon-stays-soft.md` — the numerical result this proves.
- `docs/research/soft-imaginary-and-prime-boundaries.md` §4 — the positive-cone / froth peels.
- `docs/research/three-body-lagrange-condorcet-maxwell.md` — the *dynamical* stability question that remains open.
- `src/Core/OrbitEquivariance.fs` · `src/Core/PontryaginDuality.fs` — where the proof's `π`, `.*`, `W_C` live; the orbit-symmetric-constrained equality is the test to add.
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — BRIDGE-11 line to update (conditional proven; dynamical open).
- Anchors: MacWilliams 1962; automorphism group of the [8,4,4] extended Hamming code (order 1344, AGL(3,2)); Gleason 1970 / Gates (doubly-even self-dual); orbit-counting (Burnside/Cauchy–Frobenius).
