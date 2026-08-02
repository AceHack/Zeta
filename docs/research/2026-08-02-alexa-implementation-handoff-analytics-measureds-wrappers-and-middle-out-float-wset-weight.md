# Alexa implementation handoff — two ready coder tasks (specs ferried from the Otto/Soraya session)

**Status:** IMPLEMENTATION SPEC → Alexa (Kiro). The specs previously lived only in the
Otto session + Soraya's agent reply (not committed as files — which is why they weren't
findable). This ferries both concretely so you can build without guessing.
**Date:** 2026-08-02 · **From:** Otto (shadow).
**Companion docs:** the CHSH audit (`…chsh-interference-monitor-audit…`), the order-free
handoff (`…order-free-loss-tolerant…third-drift-axis…`), Lumen's G1 (`BipartiteMachZehnder.fs`).

## Recommendation up front

**Take Task B (middle-out float as WSet `'W`) first — it is fully self-contained.** Task A
(AnalyticS/MeasuredS wrappers) is partly **gated** on Soraya's `ChshBand`/`LoopholeFlags`
types, which are spec'd but **not yet landed in code** — so half of Task A would wrap a type
that doesn't exist yet. Do Task A once Soraya's G2/G4 types are on main.

---

## Task A — `AnalyticS` / `MeasuredS` wrapper types (Soraya's routing) — PARTLY GATED

**Why:** `BipartiteMachZehnder.classifyS : float -> ChshRegime` (Lumen's, `src/Core/BipartiteMachZehnder.fs`)
is sound ONLY on the *analytic* ceiling (noiseless). Applied to *measured* S it is a stub trap
(bare `2.0` / `2√2+1e-10` thresholds false-convict honest pairs at the boundary — needs the
finite-sample ε = `AntiSybil.chshMargin`, not a float tolerance). A docstring won't stop a
future author from passing a measured `float`; a **truthful signature** makes the crossing
*unrepresentable* (Mars-Climate-Orbiter discipline — units in the type, not the comment).

**Spec (Soraya, 2026-08-02):**
```fsharp
type AnalyticS = AnalyticS of float          // noiseless analytic ceiling (no finite-sample axis)
type MeasuredS = MeasuredS of float * int    // measured value + n (so ε = chshMargin δ n is computable)

classifyS : AnalyticS -> ChshRegime                     // Lumen's, retyped — bare thresholds OK here
classify  : MeasuredS -> LoopholeFlags -> ChshBand      // ε-margined + loophole-gated (Soraya's G2/G4)
```
- The `MeasuredS` carrying `n` means a caller **cannot** invoke the band classifier without the
  sample size ε needs — closes the G2 stub trap at the *type* level, not just in a test.
- **Buildable NOW:** retype `classifyS` to take `AnalyticS` (wrap the analytic ceiling call sites).
- **GATED:** `classify : MeasuredS -> LoopholeFlags -> ChshBand` needs Soraya's `ChshBand` and
  `LoopholeFlags` types (her G2/G4 spec, not yet code). Do not stub them into existence — wait,
  or coordinate with Soraya so the types land together.
- Test: a `MeasuredS` at the boundary with realistic `n` must NOT classify as the hard-reject
  band (the positive control Soraya flagged); a compile-time test that `classifyS(measuredFloat)`
  does not typecheck is the real proof.

---

## Task B — middle-out float as a WSet `'W` weight ring (SELF-CONTAINED, recommended)

**Why:** Lior's byte-lock commutativity fix (`categorical-bayesian-planner.ts`) forces a
canonical `keys.sort()` so IEEE-754 rounds identically regardless of arrival order — a
*workaround* for non-associativity. An **exact expanding-precision** weight makes commutativity
**intrinsic**: no sort needed, order-independent *by construction*, and it removes the *barrier*
of needing all keys present before summing (the streaming / multi-planet payoff).

**Representation:** a **ball / interval** — center + radius (error bound) — or a constructive
real (`precision -> rational with guaranteed error < 2^-precision`). Start from the
`TriBoolean/Float` self-describing-shape + held-trit uncertainty scaffolding
(`src/Core.FSharp.TriBoolean/Float.fs`, `src/Core.TypeScript/tri-boolean-float/`), extend to
**unbounded mantissa + tracked uncertainty** (it currently decodes to `float` / is int64-bounded
— that is the limitation to lift).

**Ring interface (what WSet needs — `IStarRing<'W>`):** `Zero`, `One`, `Add`, `Mul`, `Negate`,
and an uncertainty-aware `isZero` (zero iff the ball provably contains only 0). `Add`/`Mul` grow
precision as needed and propagate error; **associative + commutative EXACTLY** — that is the
whole point.

**Do it in the SUM-PRODUCT domain, not log-sum-exp.** In the probability (sum-product) domain
the accumulation is pure `+`/`×` — **no transcendentals** — so the exact-expanding rep is
enough and there is *nothing to refine*. This also removes underflow (the reason log-space
existed). **The deterministic transcendental-refinement policy is only for edge cases** where a
value genuinely needs `exp`/`log` (e.g. a non-conjugate factor): refine to a **fixed precision
schedule keyed by operation-count / a seed**, so the same computation always refines the same
way → reproducible → order-independent. In the pure Bayesian sum-product path you should not
need it at all — prefer staying in the probability domain.

**Anti-conflation guard (carry it):** this makes *accumulation* order-independent (exact `+`/`×`);
it does NOT recover lost information — that is ECC (`ErasureDistance.lean`, Singleton-bounded).
Do not let "order-free arithmetic" get described as "loss recovery." (See the order-free handoff.)

**Test discipline (sabotage-verified, the house style):**

- **The proof it works:** the 100-permutation byte-lock property test passes **without** the
  canonical `.sort()` when `'W` is the middle-out float — identical result across all arrival
  orders. (Contrast: with IEEE-754 `'W` and no sort, it fails.)
- Ring laws asserted as **exact** (`===` / structural equality), not `toBeCloseTo`:
  associativity, commutativity, distributivity, identity.
- **Sabotage control:** a fixed-precision (non-expanding) variant of `'W` must **fail** the
  permutation test — proving the expansion is load-bearing, not decorative.

**Pragmatic boundary:** Lior's canonical sort stays the **shipped default**; this is the
**opt-in** enhancement, paid for when barrier-free order-independence is worth the cost
(unbounded precision → slower, more memory). Ship it behind a `'W` choice, not as a replacement.

Anchors: constructive reals (Bishop; Weihrauch TTE); iRRAM (Müller); interval/ball arithmetic;
MPFR; GDL sum-product (Aji–McEliece 2000, the WSet unifier).
