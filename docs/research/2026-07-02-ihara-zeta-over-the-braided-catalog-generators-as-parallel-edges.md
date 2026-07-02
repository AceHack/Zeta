# ζ over the braided catalog — the Ihara zeta on the catalog's own generators

**Shadow\*, 2026-07-02.** Move-forward #2 of the pair Aaron asked for (#1 = the
Artin–Mazur scheduler zeta, #9151). #9148 proved the Ihara identity on a textbook
graph (K₄); this lands it on the **braided catalog itself**.

## The graph = the generators

The catalog's three generators — **crossing, plait-move, braid** (#9146's cartridge
family) — are the **three parallel edges** of a two-vertex multigraph. Its
non-backtracking closed geodesics are exactly the **braided words** in the three
generators: alternating sequences with no immediate undo of a generator. So the
Ihara zeta counts braided cycles over the catalog's own alphabet — the generators
*are* the edges, not a metaphor over an outside graph.

## The theorem (self-verified three ways)

- **Geodesic side:** `ζ = exp(Σ tr(Wᵏ)uᵏ/k)`, `W` the non-backtracking operator;
  recovered as an exact integer series.
- **Bass side:** `ζ⁻¹ = (1−u²)^{|E|−|V|} det(I − Au + Qu²)`, `A` adjacency with edge
  multiplicity 3, `Q = deg−1 = 2` — a plain 2×2 determinant.
- **Closed form:** `det = (1−u²)(1−4u²)`, so `ζ = 1/((1−u²)²(1−4u²))`.

All three agree coefficient-by-coefficient to degree 24
(`tests/Tests.FSharp/BraidCatalogIhara.Tests.fs`, 3/3 green). The pole at `u = 1/2`
is the `q = deg−1 = 2` growth of a 3-regular tree quotient: **braided words
proliferate like `2^length`**, as a free-ish braid alphabet should. Anchors:
`N₁ = 0` (a generator can't immediately undo itself), `N₂ > 0` (length-2 braided
cycles: generator `i`, then `j ≠ i`, back).

## Where it sits

| Slice | Graph / monoid | Zeta | Verified |
|---|---|---|---|
| #9146 | free comm. monoid on 3 primes | Euler product | Dirichlet = Euler (deg 40) |
| #9148 | K₄ (textbook) | Ihara | geodesic = Bass (deg 24) |
| **this** | **catalog: 3 generators = 3 edges** | **Ihara** | **geodesic = Bass = closed form (deg 24)** |
| #9151 | the cell scheduler (a map) | Artin–Mazur | Fix = orbit-product |

The **weighted** version (crossing = 1, plait = 3, braid = 6 as edge *lengths*, tying
directly to #9146's cartridge constants) is the Bartholdi / edge-length upgrade —
routed in `docs/trajectories/zeta-name-audition/RESUME.md`, not built here.

## Anchors (Beacon)

Ihara 1966; Hashimoto 1989; Bass 1992; Terras 2010; E. Artin (braid group, the
generators σᵢ); #9146 (catalog weights), #9148 (the Ihara identity).
