# The Mercer-closure PSD theorems — "discipline becomes a theorem," proved

**Status: PROVED** (finite-dimensional / kernel-PSD definition; complete elementary proofs below).
**Mechanical witness:** `tests/Tests.FSharp/LinguisticSeedPsd.Tests.fs` — FsCheck properties over
*randomly composed* closure kernels (the witness is a regression CHECK; the proof is THIS document —
per the Math Razor's proof-vs-evidence correction, 2026-06-11).

081KQTPYE0008QG0R0028V263Z's slogan was *"discipline becomes a theorem"*: `LinguisticSeed` exposes ONLY Mercer-closure
operations, so every expressible kernel is positive semidefinite (PSD) by construction. After the Math
Razor's P0 fixes (zero-extension in `dot`; Euclidean `d²` in `ConformalGA.rbfKernel`), the slogan is now
literally a theorem. This document is the proof.

## Definition (kernel PSD)

`k : X → X → ℝ` is **PSD** iff it is symmetric and for every finite sample `x₁,…,xₙ ∈ X` and every
`v ∈ ℝⁿ`:

```
Q(k; x, v)  :=  Σᵢ Σⱼ vᵢ vⱼ k(xᵢ, xⱼ)  ≥  0          (the quadratic form over the Gram matrix)
```

Equivalently: every Gram matrix `K[i,j] = k(xᵢ,xⱼ)` is a PSD matrix. This is `LinguisticSeed.quadForm`.

Throughout, fix an arbitrary finite sample `x₁,…,xₙ` and weights `v`; we show `Q ≥ 0` for each
constructor and that each combinator preserves the property. Symmetry is immediate in every case.

---

## Part I — the base kernels are PSD

### T1. `constant c` (with `c ≥ 0`, enforced by the clamp)

`K = c·𝟙𝟙ᵀ`, so `Q = c·(Σᵢ vᵢ)² ≥ 0`. ∎

(The clamp is load-bearing: for `c < 0` take `n=1, v=(1)`: `Q = c < 0`.)

### T2. `feature φ` — `k(a,b) = φ(a)·φ(b)`

Let `w ∈ ℝⁿ`, `wᵢ = φ(xᵢ)`. Then `K = wwᵀ` and `Q = (vᵀw)² ≥ 0`. ∎

### T3. `dot φ` with **zero-extension** — `k(a,b) = ⟨φ(a), φ(b)⟩` over ragged `float[]`

Zero-extension means there is a **single, pair-independent** feature map
`Φ : X → ℝ^(∞)` (sequences of finite support): `Φ(x)ᵢ = φ(x)[i]` if `i < |φ(x)|`, else `0`.
Then `k(a,b) = ⟨Φ(a), Φ(b)⟩` exactly (the sum over `max` length with zero-padding IS this inner
product), and

```
Q = Σᵢⱼ vᵢvⱼ ⟨Φ(xᵢ), Φ(xⱼ)⟩ = ‖ Σᵢ vᵢ Φ(xᵢ) ‖²  ≥  0.    ∎
```

**Why min-truncation was NOT PSD (the P0):** truncating to `min` length makes the evaluation depend on
the *pair* — there is no single Φ with `k(a,b) = ⟨Φa, Φb⟩` — so the Gram-matrix argument collapses.
Counterexample (pinned in the tests): `φ(x₁) = [1]`, `φ(x₂) = [0, 10]`, `φ(x₃) = [1, 10]`. Under
min-truncation the Gram is `[[1,0,1],[0,1,100],[1,100,101]]`… with `v = (1, 1, −1)` the form goes
negative. Zero-extension restores a fixed Φ ⇒ T3 holds.

### T4. `indicator` — `k(a,b) = [a = b]`

Partition the sample indices by equality class: `{1..n} = ⊎ C₁ … C_m`. The Gram is block-diagonal with
all-ones blocks, so

```
Q = Σ_classes ( Σ_{i ∈ C} vᵢ )²  ≥  0.    ∎
```

---

## Part II — the combinators preserve PSD

### T5. `sum k₁ k₂`

`Q(k₁+k₂) = Q(k₁) + Q(k₂) ≥ 0`. ∎ (Hence the CE builder's `Combine` and `composePacks`'s fold are safe;
`Zero = constant 0` is PSD by T1.)

### T6. `scale c k` (with `c ≥ 0`, enforced by the clamp)

`Q(c·k) = c·Q(k) ≥ 0`. ∎

### T7. `product k₁ k₂` — the **Schur product theorem** (Schur 1911), proved

Let `K₁, K₂` be the Grams over the sample. Since they are PSD they factor: `K₁ = AAᵀ`, `K₂ = BBᵀ`
(e.g. spectral: `A = U√Λ`). Then entrywise

```
(K₁ ∘ K₂)ᵢⱼ = (Σ_p Aᵢ_p Aⱼ_p)(Σ_q Bᵢ_q Bⱼ_q) = Σ_{p,q} (Aᵢ_p Bᵢ_q)(Aⱼ_p Bⱼ_q)
```

so

```
vᵀ(K₁∘K₂)v = Σ_{p,q} ( Σᵢ vᵢ Aᵢ_p Bᵢ_q )²  ≥  0.    ∎
```

(The Hadamard product's Gram is itself a Gram — of the tensor features `Φ₁ ⊗ Φ₂`.)

### T8. `pullback g k` — `k(g·, g·)` for any `g : Y → X`

Any finite sample `y₁,…,yₙ` in `Y` with weights `v` gives
`Q(pullback) = Σᵢⱼ vᵢvⱼ k(g(yᵢ), g(yⱼ))`, which is exactly `Q(k)` over the sample
`g(y₁),…,g(yₙ) ∈ X` with the same `v` — nonnegative because `k` is PSD on **every** finite sample,
repetitions included (PSD needs no injectivity). ∎

### Main theorem (the slogan)

> **Every kernel expressible in `LinguisticSeed` — any composition of `constant`/`feature`/`dot`/
> `indicator` under `sum`/`product`/`scale`/`pullback`, including every `kernel { … }` block and every
> `composePacks` — is PSD.**

*Proof:* structural induction over the expression tree; base cases T1–T4, inductive steps T5–T8. The
module exposes no other constructors (the closure is the API), so non-PSD kernels are *unexpressible*. ∎

That is "discipline becomes a theorem" in its literal form: the type system + module boundary make the
induction hypothesis inescapable.

---

## Part III — the RBF kernel (Schoenberg, proved from Parts I–II)

### T9. `ConformalGA.rbfKernel σ` — `k(p,q) = exp(−‖p−q‖²/σ²)` over the Euclidean parts — is PSD

Write `γ = 1/σ² > 0` and expand `‖a−b‖² = ‖a‖² + ‖b‖² − 2⟨a,b⟩`:

```
exp(−γ‖a−b‖²) = f(a)·f(b)·exp(2γ⟨a,b⟩),     f(x) = exp(−γ‖x‖²).
```

1. `⟨a,b⟩` is PSD (T3 with Φ = the Euclidean coordinates — `euclidSq`'s spatial parts).
2. `exp(2γ⟨a,b⟩) = Σ_{m≥0} (2γ)^m ⟨a,b⟩^m / m!` — each term is a **Schur power** of a PSD kernel
   scaled by a nonnegative coefficient (T7 + T6), each partial sum is PSD (T5), and a **pointwise limit
   of PSD kernels is PSD** (the quadratic form is a finite sum, so `Q(lim) = lim Q ≥ 0`).
3. `f(a)f(b)` is a rank-1 feature kernel (T2), and multiplying by it is a Schur product (T7). ∎

This is the elementary half of **Schoenberg 1938** (`exp(−γd)` PSD for all `γ>0` ⇔ `d` conditionally
negative definite); Euclidean `d²` is CND, which is what step 1–2 instantiates. **The P0 this locks in:**
the old `exp(inner/σ²)` equals this kernel *only on null points* (`inner = −½d²` requires the embedding
invariant); off the null cone the exponent is not `−γ·(a CND d²)` and T9's proof does not apply —
`euclidSq` removes the precondition entirely.

### T10. The conformal identity — `inner (embed x) (embed y) = −½‖x−y‖²` (exact algebra)

```
inner P Q = ⟨x,y⟩ − (½‖x‖²·1 + 1·½‖y‖²) = ⟨x,y⟩ − ½‖x‖² − ½‖y‖² = −½‖x−y‖².    ∎
```

So on embedded points `distSq = −2·inner` is the genuine `d²` (pinned by test to machine precision), and
the null property `inner P P = 0` is the `x = y` case.

## Cited, not proved here

- **Jaccard is PSD** (the salon kernel) — Gower 1971; Bouchard, Jousselme & Doré 2013 give the direct
  PSD proof. Carried as a *cited* base kernel, outside this document's self-contained induction.
- Mercer's theorem itself (the integral-operator/RKHS statement) — Mercer 1909. We only need the finite
  (Gram) characterization above, which is the definition.

## Anchors (Beacon)

Schur (1911), *Bemerkungen zur Theorie der beschränkten Bilinearformen*; Schoenberg (1938), *Metric
spaces and positive definite functions*; Mercer (1909); Gower (1971); Aronszajn (1950), RKHS — the
feature-space reading of T3/T7; Steinwart & Christmann (2008), *Support Vector Machines*, ch. 4 — the
modern textbook home of the closure properties.

## Pointers

- `src/Core/LinguisticSeed.fs` — the closure this proves (after the P0 zero-extension fix).
- `src/Core/ConformalGA.fs` — `euclidSq`/`rbfKernel` (after the P0 Euclidean fix).
- `tests/Tests.FSharp/LinguisticSeedPsd.Tests.fs` — the FsCheck mechanical witness (CHECK, not proof).
- `universal/kernel.md` — the carved Universal Kernel Interface (the closure IS the proof).
- Math Razor findings (2026-06-11) — the two P0s these theorems now lock against regression.
