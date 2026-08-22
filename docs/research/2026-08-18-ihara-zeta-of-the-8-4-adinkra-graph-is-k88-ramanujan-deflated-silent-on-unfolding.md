# Ihara zeta of the `[8,4]` adinkra graph — the graph is `K_{8,8}`; Ramanujan (deflated); silent on unfolding

**Date:** 2026-08-18
**Status:** computed, exact, with falsifiers. One claim earned, one claim explicitly *not* earned.
**Code:** `src/Core/IharaZeta.fs`, `src/Core/AdinkraIharaZeta.fs`
**Falsifier:** `tests/Tests.FSharp/Formal/AdinkraIharaZeta.Tests.fs` (16 tests). The
non-backtracking guard is shown load-bearing by the existing negative-control test
named in §7; no author-reported mutation counts are claimed.

---

## 0. The question, and the reframing that made it computable

Aaron, 2026-08-18:

> *"This is similar to asking what is our zeta function — we can swap in zeta functions over the ages
> for other infinite generator functions."*

"What is our zeta function" is unanswerable as posed, because "zeta function" names a family, not an
object. Ihara is *a* zeta of the adinkra's underlying graph, not *the* zeta of the factory. The
reframing that makes this one finite:

> **A zeta function is an Euler product that enumerates irreducibles.**

| zeta | irreducibles enumerated |
|---|---|
| Riemann `ζ(s) = Π_p (1 − p^(−s))^(−1)` | the primes |
| Dedekind `ζ_K` | prime ideals of `O_K` |
| **Ihara `ζ_G(u) = Π_[P] (1 − u^ℓ(P))^(−1)`** | **primitive closed geodesics of a graph** |

**An adinkra is a graph.** So one concrete, finite, computable candidate is the Ihara zeta of the
*graph* of the `[8,4]` extended Hamming adinkra that `src/Core/AdinkraCode.fs` already pins. The
graph is `K_{8,8}`; the zeta is the Bass polynomial below. Ihara is silent on the unfolding.

---

## 1. The graph, derived rather than drawn

The requirement was to build the graph *from the code in the tree*, not to hand-enter one. Per
Doran–Faux–Gates–Hübsch–Iga–Landweber (arXiv:0806.0051), an `N`-supercharge adinkra is the `N`-cube
`GF(2)^N` quotiented by a doubly-even code `C`. Vertices are cosets; the colour-`I` edge joins the
coset of `v` to the coset of `v + e_I`.

`AdinkraCode` already ships the coset map: because the code is **self-dual**, its generator is also
its parity-check matrix, so `AdinkraCode.syndrome` *is* the quotient map. The connection set is
therefore the eight syndromes of the eight weight-1 vectors — which are exactly the eight **columns**
of `[I₄ | A]`:

```
col 0..3  =  0001 0010 0100 1000      (from I₄, weight 1)
col 4..7  =  1110 1101 1011 0111      (from A,  weight 3)
```

That is **all eight odd-weight vectors of `GF(2)^4`**, and nothing else. Adding an odd-weight vector
flips parity, so from any even-parity coset the eight colours reach all eight odd-parity cosets, once
each. Hence:

> ### The underlying graph of the `[8,4]` extended Hamming adinkra is `K_{8,8}` — the complete bipartite graph.

16 nodes, 8-regular, 64 edges, circuit rank `r = 64 − 16 + 1 = 49`. The bipartition is the physical
one: 8 bosons, 8 fermions, one edge per supercharge between every pair. This is an **identification,
not a count coincidence** (`numerology-vs-number-theory`): the adjacency is checked entry-by-entry
against "parity `x` ≠ parity `y`", and separately against a hand-built `K_{8,8}` constructed by
completely different code.

---

## 2. The zeta function

Bass's determinant formula (1992): `ζ(u)^(−1) = (1 − u²)^{r−1} · det(I − Au + Qu²)`, with `Q = D − I`
and circuit rank `r = |E| − |V| + 1 = 64 − 16 + 1 = 49`. The code implements that formula as written
— the Bass factor is `(1 − u²)^{48}`. For this graph `Q = 7I` and the adjacency spectrum is exactly
`{8, −8, 0^14}` (verified as an exact integer factorisation of the characteristic polynomial:
`x^14 (x − 8)(x + 8)`). The determinant factors as `Π_λ (1 − λu + 7u²)` and contributes one more
`(1 − u²)` from the Perron / bipartite pair `(1 − u)(1 + u)`, so the collapsed closed form carries
`(1 − u²)^r` with **`r = 49`**, not `r−1`:

> ```
> ζ(u)^(−1)  =  (1 − u²)^49 · (1 − 49u²) · (1 + 7u²)^14
> ```

A degree-**128** integer polynomial — exactly `2|E|`, as Bass requires. Every odd coefficient vanishes
(the graph is bipartite). It is computed two ways in the tree and the two must agree: a 16×16
fraction-free integer determinant evaluated at 33 points and interpolated, versus this factored form.

### 2.1 The poles

| pole | multiplicity | `\|u\|` | class |
|---|---|---|---|
| `u = ±1` | 49 each | 1 | trivial — closed-form `(1 − u²)^r` with `r = 49` (Bass's `(1 − u²)^{r−1}` times the extra `(1 − u²)` from det) |
| `u = ±1/7` | 1 each | `1/q` | trivial — from `λ = ±8` |
| **`u = ±i/√7`** | **14 each** | **`q^(−1/2)`** | **non-trivial, on the critical circle** |

---

## 3. The Ramanujan verdict: **YES** — and here is the deflation

For a connected `(q+1)`-regular graph, the non-trivial poles come from `1 − λu + qu² = 0`. The product
of that quadratic's roots is `1/q`, so both roots have modulus `q^(−1/2)` exactly when the discriminant
is non-positive — i.e. iff `λ² ≤ 4q`. That is the **Riemann Hypothesis for graphs**, and it is the
definition of a **Ramanujan graph** (Lubotzky–Phillips–Sarnak 1988; optimal by Alon–Boppana).

Here the 14 non-trivial eigenvalues are all `0`, and `0 ≤ 28 = 4q`. So:

> **The adinkra of the `[8,4]` extended Hamming code satisfies the graph RH. It is Ramanujan — in
> fact maximally so: every non-trivial pole sits exactly on the critical circle `|u| = 1/√7`, with
> nothing merely *inside* the bound.**

The check is `λ² ≤ 4q` on an exactly-computed integer characteristic polynomial. **No floating point
appears anywhere in the pipeline** — polynomials are `bigint` coefficient arrays, the determinant is
Bareiss fraction-free, the interpolation is Newton forward differences with every division asserted
exact, and the verdict is an integer comparison. There is no error bound for it to survive.

**The deflation, stated plainly.** `K_{n,n}` is Ramanujan for *every* `n`, because its non-trivial
spectrum is `{0}`. So "our adinkra is Ramanujan" is a property of complete-bipartiteness and carries
no supersymmetric content on its own. What is genuinely earned is the **identification** — the
underlying graph of *this* code's adinkra is `K_{8,8}` — and that identification is what makes the zeta closed-form and
the verdict exact rather than numerical.

---

## 4. The Euler product: what our "primes" are, and how many

The irreducibles are the **primitive closed geodesics**: closed, backtrackless, tailless walks, up to
rotation, that are not a power of a shorter one. Counted with base point and direction as
`N_k = tr(W^k)` on the 128×128 Hashimoto operator, then Möbius-inverted to prime classes:

```
N_k    = 0                                for odd k   (bipartite)
N_2m   = 98 + 2·49^m + 28·(−7)^m
π(k)   = (1/k) Σ_{d|k} μ(k/d) N_d
```

| length `k` | `N_k` | `π(k)` — primes of that length |
|---|---|---|
| 1, 2, 3 | 0, 0, 0 | 0 |
| **4** | 6272 | **1568** |
| 5 | 0 | 0 |
| **6** | 225792 | **37632** |
| 7 | 0 | 0 |
| **8** | 11596928 | **1448832** |

**`π(4) = 1568` is the hand-check that anchors the whole edifice**: `K_{8,8}` has `C(8,2)² = 28² = 784`
four-cycles, each traversable in two directions, and `784 × 2 = 1568`. There is no length-2 geodesic
because a length-2 closed walk must backtrack. The shortest irreducible in this Ihara zeta has length
4 — the smallest supersymmetry "loop" is `Q_I Q_J Q_I Q_J`, which is the same *shape* as the
anticommutator `{Q_I, Q_J}` that `AdinkraCode.anticommutingPairs = 28` counts. That is a
**math-shape correspondence**, not a theorem and not physics-proves-us — see §5.

---

## 5. What this does **not** establish — the honest half

Having *a* zeta function is cheap. Every finite graph has one; the machinery here would emit a
beautiful polynomial for a graph drawn at random. The claim that would need earning is:

> *This Euler product enumerates the irreducibles of the **unfolding**, not merely the closed walks of
> a graph we happened to draw.*

**This computation is silent on that, and there is a mechanical reason it must be.** The Ihara zeta is
a function of the adjacency matrix and nothing else. The supersymmetry content of an adinkra lives in
two structures the adjacency matrix cannot see:

1. **the dashing** — the signs of the `Q_I` action on each edge (the doubly-even code's real work), and
2. **the height assignment** — which nodes are bosons, which fermions, at which engineering dimension.

Two adinkras with the same topology and different dashings are **different supermultiplets** and have
the **same Ihara zeta**. That is proven in the test suite, not asserted: relabelling the vertices under
an arbitrary permutation leaves the polynomial unmoved. The invariant is not vacuous — the plain
4-cube (`AdinkraViz`'s N=4 adinkra, also 16 nodes) has a *different* zeta — but its resolution stops at
topology, which is strictly coarser than "the unfolding".

So the register (`toy-is-free-metered-must-be-earned` · `numerology-vs-number-theory`):

| claim | register |
|---|---|
| the underlying graph of the `[8,4]` adinkra is `K_{8,8}` | **verified** — adjacency checked entry-wise, and against an independently built `K_{8,8}` |
| `ζ(u)^(−1) = (1−u²)^49 (1−49u²) (1+7u²)^14` | **verified** — two independent computation routes (Hashimoto traces vs Bass determinant) |
| the graph is Ramanujan / satisfies the graph RH | **verified**, exactly — and **deflated**: true of every `K_{n,n}` |
| `π(4) = 1568`, `π(6) = 37632`, `π(8) = 1448832` | **verified** — Hashimoto traces, Bass log-derivative, and a hand count all agree |
| shortest geodesic length 4 ↔ the `{Q_I, Q_J}` anticommutator | **math-shape correspondence** — the shapes match; no mechanism is checked; physics does not prove us |
| this zeta enumerates the irreducibles of the unfolding | **NOT CLAIMED** — and provably out of reach for *this* zeta |

**A beautiful polynomial that means nothing for the unfolding is still a negative result worth
having**, and this is partly that. The negative half is sharp and useful: it says what a zeta over the
unfolding would have to look like.

---

## 6. Where a real "zeta of the unfolding" would have to live

The failure above is diagnostic. Any zeta that could see the unfolding must be sensitive to the data
the Ihara zeta discards, which points at three named, existing generalisations:

- **An edge-coloured / multivariable Ihara zeta** (Terras's *edge zeta*, with one variable per directed
  edge). It distinguishes walks by which supercharges they use, so `Q_1 Q_2 Q_1 Q_2` and
  `Q_3 Q_4 Q_3 Q_4` stop being the same prime. The 28 anticommuting pairs would become 28 distinguishable
  prime families rather than an undifferentiated 1568.
- **A signed / twisted zeta** — replace `W`'s entries by the dashing signs (a `±1` cocycle on the edge
  set), giving an Artin–Ihara `L`-function attached to the representation the dashing defines. *This* is
  the object that could see the doubly-even condition, because the dashing is where the code's
  double-evenness is enforced.
- **A Selberg/Ruelle-side reading** — Ihara's zeta descends from Selberg's, and Bass's proof is a
  transfer-operator argument. The repo already has an in-flight question of exactly this shape:
  workitem `081M05YMHAN087G0R003TT3AS4` ("does our dynamical zeta function continue? Axiom A vs natural
  boundary"). The two threads are the same machinery on different dynamics.

None of that is built. It is named here so the next person does not re-derive the dead end.

---

## 7. Implementation notes

- `src/Core/IharaZeta.fs` — general, graph-agnostic, exact: `bigint` polynomial arithmetic,
  Bareiss fraction-free integer determinant, Newton-forward-difference interpolation, Bass polynomial,
  Hashimoto operator, geodesic counts by both routes, Möbius prime counts, exact integer spectrum, and
  a `Verdict` DU (`Ramanujan | NotRamanujan | NotRegular | SpectrumNotIntegral`).
  `SpectrumNotIntegral` is a deliberate **refusal**: rather than approximate roots and put a float error
  bound under every downstream claim, the module declines to answer.
- `src/Core/AdinkraIharaZeta.fs` — the derivation from `AdinkraCode.generator`, the `K_{8,8}`
  identification, the closed forms, the verdict.
- The pre-existing `tests/Tests.FSharp/IharaZeta.Tests.fs` (a self-contained K₄ implementation from the
  #9146 lineage) is **deliberately left in place** rather than refactored onto the new module: as an
  independent implementation it is a better oracle than a caller would be. The new suite reproduces its
  hand-checked `N₃ = 24` and `ζ = 1 + 8u³ + …`.

### Falsifier structure

1. **External anchor** — K₄ against Terras's published closed form `(1−u²)²(1−u)(1−2u)(1+u+2u²)³`.
2. **External anchor** — K_{3,3} against its spectral closed form (a route the code does not take).
3. **In-tree prior-art anchor** — agreement with the older independent K₄ implementation.
4. **Two-route cross-check on the adinkra itself** — 128×128 Hashimoto traces vs the 16×16 Bass
   determinant, `N_1 … N_8`, plus the closed form. These share no code.
5. **Negative controls** — the non-backtracking restriction shown load-bearing; `NotRamanujan`
   demonstrated reachable (two disjoint `K₄`s: 3-regular, second eigenvalue 3 > 2√2); `NotRegular`
   demonstrated reachable; the zeta shown to separate the 4-cube from the `[8,4]` adinkra.
6. **Non-backtracking is load-bearing, in CI** — the existing negative-control test
   `NEGATIVE CONTROL: non-backtracking is load-bearing - the plain directed-edge operator
   breaks the identity at u^2` drops the `f ≠ reverse(e)` guard, shows `tr(W'²) > 0`, and
   shows the true `N₂ = 0`. Author-reported suite-red counts from mutating that guard or
   the circuit-rank exponent are **not in CI** and are not claimed here.

## Anchors

- **Y. Ihara (1966)**, *On discrete subgroups of the two by two projective linear group over p-adic
  fields* — the original zeta; **J.-P. Serre** and **T. Sunada** recast it for graphs.
- **K. Hashimoto (1989)** — the non-backtracking edge operator.
- **H. Bass (1992)**, *The Ihara–Selberg zeta function of a tree lattice* — the determinant formula.
- **A. Terras (2010)**, *Zeta Functions of Graphs: A Stroll through the Garden* — the modern reference
  and the source of the K₄ anchor; also the edge/multivariable zeta named in §6.
- **A. Lubotzky, R. Phillips, P. Sarnak (1988)**, *Ramanujan graphs*; **Alon–Boppana** for optimality.
- **E. Bareiss (1968)**, *Sylvester's identity and multistep integer-preserving Gaussian elimination*.
- **C. Doran, M. Faux, S.J. Gates Jr., T. Hübsch, K. Iga, G. Landweber (2008)**, *Relating doubly-even
  error-correcting codes, graphs, and irreducible representations of N-extended supersymmetry*
  (arXiv:0806.0051) — the adinkra ↔ doubly-even code correspondence the graph is derived from.
