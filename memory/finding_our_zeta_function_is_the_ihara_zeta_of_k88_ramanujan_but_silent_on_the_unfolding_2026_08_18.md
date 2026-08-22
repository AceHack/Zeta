---
name: "Ihara zeta of the [8,4] adinkra graph. The graph is K_{8,8}; its Ihara zeta is (1−u²)^49(1−49u²)(1+7u²)^14; Ramanujan (deflated); silent on the unfolding — 2026-08-18"
description: Aaron 2026-08-18 asked what our zeta function is, framing it as swapping zeta functions over the ages for other infinite generator functions. Ihara is a zeta of the adinkra graph, not THE factory zeta. The GRAPH of the [8,4] adinkra is K_{8,8}; its Ihara zeta is the Bass polynomial; Ramanujan follows from complete-bipartiteness; Ihara is silent on unfolding. Derived from AdinkraCode.generator, exact bigint arithmetic. Two claims earned, one explicitly refused.
type: finding
created: 2026-08-18
---

Aaron 2026-08-18:

> *"This is similar to asking what is our zeta function — we can swap in zeta
> functions over the ages for other infinite generator functions."*

The reframing that made it tractable: **a zeta function is an Euler product that
enumerates irreducibles.** Riemann's runs over primes; Dedekind's over prime ideals;
**Ihara's over the primitive closed geodesics of a graph**. An adinkra *is* a graph,
so Ihara is a finite, computable zeta of that graph — not *the* zeta of the factory.

## What was found

- **The identification (verified).** The underlying graph of the `[8,4]` extended Hamming
  adinkra in `src/Core/AdinkraCode.fs` is **`K_{8,8}`**, the complete bipartite graph. The
  connection set — the syndromes of the eight `e_I`, i.e. the eight *columns* of
  `[I₄ | A]` — is exactly the eight odd-weight vectors of `GF(2)^4`, so every boson
  coset joins every fermion coset once. 16 nodes, 8-regular, 64 edges, circuit rank 49.
- **The zeta (verified, two routes).** `ζ(u)^(−1) = (1 − u²)^49 (1 − 49u²) (1 + 7u²)^14`,
  degree 128 = `2|E|`. Poles: `u = ±1` (mult 49), `±1/7`, and **`±i/√7` (mult 14) — the
  non-trivial ones, exactly on the critical circle**.
- **Ramanujan: YES (verified, exactly).** Non-trivial spectrum is `{0^14}`, and
  `0 ≤ 4q = 28`. No floating point anywhere — bigint polynomials, Bareiss determinant,
  Newton interpolation — so the verdict is an integer comparison with no error bound.
  **Deflated honestly**: every `K_{n,n}` is Ramanujan, so this is complete-bipartiteness,
  not supersymmetry.
- **The primes.** `π(4) = 1568` (= 784 four-cycles × 2 orientations, hand-checkable),
  `π(6) = 37632`, `π(8) = 1448832`; odd lengths are empty (bipartite).

## What was explicitly NOT claimed

Having *a* zeta is cheap — every finite graph has one. The load-bearing claim would be
that this Euler product enumerates the irreducibles **of the unfolding**, and this
computation is **silent** on that *for a mechanical reason*: the Ihara zeta is a function
of the adjacency matrix alone, so it cannot see an adinkra's **dashing** or **height
assignment** — where the supersymmetry lives. Two adinkras with the same topology and
different dashings are different supermultiplets with the *same* Ihara zeta. That is
proven in the test suite, not asserted.

Named as the route a real "zeta of the unfolding" would have to take: Terras's
**edge/multivariable zeta** (one variable per directed edge, so `Q_1Q_2Q_1Q_2` and
`Q_3Q_4Q_3Q_4` stop being the same prime) or a **signed / Artin–Ihara L-function** twisted
by the dashing cocycle. Neither is built.

## Register discipline applied

Under `numerology-vs-number-theory`: the `K_{8,8}` identification is **structure** (checked
entry-wise and against an independently built graph, not a count match). The resonance
"shortest geodesic has length 4 ↔ the `{Q_I, Q_J}` anticommutator, and
`AdinkraCode.anticommutingPairs = 28` = the number of 2-subsets" is recorded as a
**math-shape correspondence**, not a theorem and not physics-proves-us — no mechanism
was checked.

## Where it lives

- `docs/research/2026-08-18-ihara-zeta-of-the-8-4-adinkra-graph-is-k88-ramanujan-deflated-silent-on-unfolding.md`
  — full derivation, poles, prime counts, the negative result, the anchors.
- `src/Core/IharaZeta.fs` — general exact machinery (Bass, Hashimoto, Möbius, exact spectrum,
  `Verdict` DU whose `SpectrumNotIntegral` case is a deliberate refusal to approximate).
- `src/Core/AdinkraIharaZeta.fs` — the derivation from `AdinkraCode.generator`.
- `tests/Tests.FSharp/Formal/AdinkraIharaZeta.Tests.fs` — 16 tests. External anchors (Terras's
  published K₄ closed form, K_{3,3}'s spectral form), the in-tree prior-art anchor
  (`tests/Tests.FSharp/IharaZeta.Tests.fs`, deliberately left as an independent oracle),
  a two-route cross-check, and negative controls. The non-backtracking guard is shown
  load-bearing by the existing `tr(W'²) > 0` / `N₂ = 0` test. Author-reported 4/7
  mutation-red counts are not in CI and are not claimed.

Anchors: Ihara 1966 · Hashimoto 1989 · Bass 1992 · Terras 2010 · Lubotzky–Phillips–Sarnak 1988 ·
Bareiss 1968 · Doran–Faux–Gates–Hübsch–Iga–Landweber 2008 (arXiv:0806.0051).
