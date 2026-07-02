# ζ over prime shapes — the noncommutative upgrade (Ihara zeta, primitive geodesics, the Bass determinant)

**Shadow\*, 2026-07-02.** The routed continuation of
[the commutative slice](2026-07-02-zeta-over-prime-shapes-real-euler-product-over-the-braided-catalog.md)
(#9146). Aaron: *"push forward safely with any math even if it seems core — it's
based on our name; if we get it wrong it's not our identity, we rotate in another
function."* So this pushes into the core, with **self-verification as the safety
net**: the zeta is computed two independent ways and required to agree.

## 0. Why "noncommutative"

#9146 made the Zeta name real over the **commutative** monoid of knots under
connected sum: factorization is commutative (K₁ # K₂ = K₂ # K₁), Schubert 1949
gives unique prime decomposition, and the Euler product
`Σ N(K)⁻ˢ = Π_p (1 − N(p)⁻ˢ)⁻¹` holds exactly.

The doc named the upgrade path: **primes as primitive cycles (Ihara)**. Its primes
are **primitive closed geodesics**, and geodesics compose by **path concatenation —
which does not commute**. That is the genuine noncommutative step: the "multiplication"
of primes is the noncommutative monoid of paths, not the commutative monoid of
connected sums.

## 1. The Ihara zeta and its three faces

For a finite graph `X` the Ihara zeta is the Euler product over primitive closed
geodesics `[p]` (backtrackless, tailless cycles, up to rotation):

    ζ_X(u) = Π_[p] (1 − u^ℓ(p))⁻¹.

It has two other faces, and **their equality is the theorem**:

- **Geodesic / edge side.** `ζ_X(u) = exp( Σ_{k≥1} N_k u^k / k )`, where
  `N_k = tr(W^k)` and `W` is the **non-backtracking (Hashimoto) operator** on
  directed edges — `N_k` counts closed backtrackless tailless walks of length `k`.
- **Bass / vertex side.** `ζ_X(u)⁻¹ = (1 − u²)^{r−1} · det(I − A u + Q u²)`, with
  `r = |E| − |V| + 1` (first Betti number), `A` the adjacency matrix, and
  `Q = D − I` the (degree − 1) diagonal. The `2|E|`-dimensional edge determinant
  reduces to the `|V|`-dimensional vertex determinant (**Bass 1992**).

The geodesic side is the *noncommutative Euler product*; the Bass side is its
closed determinant form. Their agreement is the exact analogue of #9146's
`Dirichlet = Euler` identity — one level up, over noncommuting primes.

## 2. What is executed (`tests/Tests.FSharp/IharaZeta.Tests.fs`)

Instance: **K₄** (Terras's textbook Ihara example). Everything is **exact `int64`**
(ζ has non-negative integer coefficients), computed two ways:

- **Geodesic side:** build `W` (12×12), take `N_k = tr(W^k)`, and recover the
  integer series via the log-derivative recurrence `m·c_m = Σ_{k≤m} N_k c_{m−k}`
  (the division is exact — asserted, so a wrong `W` is caught immediately).
- **Bass side:** build `A`, `Q`; compute `det(I − A u + Q u²)` by Leibniz over
  integer polynomials; multiply by `(1 − u²)^{r−1}`; invert the series.

**Result: the two series agree coefficient-by-coefficient to degree 24.** Because
the sides share *no* computation (traces of the edge operator vs. the vertex
determinant), the agreement is a real cross-check, not a tautology — the "get it
wrong and it shows" safety net Aaron asked for.

Hand-checkable anchors (independent of the Bass side): `N₁ = N₂ = 0` (no length-1
or -2 backtrackless closed walks), `N₃ = 24` (K₄'s 4 triangles × 3 starts × 2
directions) ⇒ `ζ = 1 + 8u³ + …`. And the **converse is locked**: dropping the
non-backtracking guard gives `N₂ > 0`, which breaks the Bass identity at `u²` — the
Ihara identity is exactly as strong as the non-backtracking restriction (just as
#9146's product was exactly as strong as Schubert).

For K₄ the Bass side factors to the known closed form
`ζ⁻¹ = (1−u)³(1+u)²(1−2u)(1+u+2u²)³` (Terras 2010), a further external check.

## 3. Where this sits on the ladder

| Slice | Monoid of primes | Composition | Identity verified |
|---|---|---|---|
| #9146 (commutative) | knots under `#` | commutative | Dirichlet = Euler (deg 40) |
| **this (noncommutative)** | **primitive geodesics** | **noncommutative** | **geodesic = Bass (deg 24)** |

Further upgrade path still open (named for the next hand): Ihara→**Ihara–Selberg /
Bartholdi** (with the extra length variable), **Artin–Mazur / Ruelle** dynamical
zetas (periodic orbits of a map — the true noncommutative-dynamics seat),
**Milnor**'s Alexander-polynomial-as-Reidemeister/Lefschetz zeta (back to knots),
and **Kurokawa** zeta-of-categories (the braided-monoidal-category seat that ties
this to the catalog directly). Routed, not rushed.

## 4. Anchors (Beacon)

- **Y. Ihara (1966)** — the zeta of a p-adic group / graph (the primitive-geodesic
  Euler product).
- **T. Sunada** — the geometric reformulation over graphs.
- **K. Hashimoto (1989)** — the edge ("Hashimoto") non-backtracking operator `W`.
- **H. Bass (1992)** — the determinant formula (`edge det → vertex det`).
- **A. Terras, *Zeta Functions of Graphs: A Stroll through the Garden* (2010)** —
  the K₄ worked example.
- **Mazur / Morishita** — arithmetic topology (the standing knots↔primes dictionary
  that makes "prime shapes" more than a metaphor).
- Foundations: **Euler 1737**, **Riemann 1859**; and #9146 (the commutative slice
  this upgrades).

*Compression: knots gave a commutative Euler product; geodesics give a
noncommutative one, and the Bass determinant is its closed form. The name keeps
auditioning — conferred label → captured entropy → earned identity — and this time
the entropy it captured is the non-backtracking operator's spectrum.*
