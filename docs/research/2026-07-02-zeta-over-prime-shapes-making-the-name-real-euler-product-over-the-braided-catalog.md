# ζ over prime shapes — making the Zeta name real: an Euler product over the braided catalog

**Provenance:** Aaron 2026-07-02, the directive chain: "our prime numbers are shapes —
we don't need numbers, just some ordering system" → Schubert 1949 surfaced as the
exact Beacon body (PR #9145) → "the prime knot theory is how we make the Zeta name
real for us" → **"we need Riemann zeta over topological qubits / monoidal braids."**

## Why this is constructible and not a metaphor

Euler's product formula is not a fact about the integers — it is a fact about **any
free commutative monoid with a multiplicative norm**: the identity

```
ζ(s)  =  Σ_K N(K)^(−s)  =  Π_p (1 − N(p)^(−s))^(−1)
```

holds precisely when every element K factors uniquely into primes p and N is
multiplicative. For the integers that hypothesis is the fundamental theorem of
arithmetic. **For knots under connected sum it is Schubert 1949** — unique prime
decomposition — plus genus additivity (also Schubert): `g(K₁#K₂) = g(K₁) + g(K₂)`,
so `N(K) = q^{g(K)}` (or any additive weight exponentiated: crossing number,
tick-rank — "just some ordering system") is multiplicative. The name becomes the
construction: **ζ_catalog is the Euler product over the catalog's prime shapes.**

## The commutative slice (executable today)

Treat the catalog's braided primes as commuting atoms (the Schubert regime —
connected-sum composition), each carrying an integer weight w(p) from the cartridge's
own constants (the crossing atom w=1; plait-move w=3; braid w=6; …). Then as a formal
power series in t = q^(−s):

```
ζ_cat(t) = Σ_shapes t^{w(K)} = Π_primes 1/(1 − t^{w(p)})
```

and the coefficient of t^d counts the shapes of total weight d — a partition function
with parts drawn from the primes' weights. The identity "Dirichlet sum = Euler
product" becomes an exact integer statement checkable coefficient-by-coefficient
(DP vs brute-force multiset enumeration). Locked in
`tests/Tests.FSharp/ZetaOverPrimeShapes.Tests.fs`, including the converse: **break
unique factorization (duplicate a prime) and the Euler identity fails** — the product
formula is exactly as strong as Schubert, no stronger.

## The braided / topological-qubit upgrade (the real target, routed not rushed)

Braid composition is NOT commutative — the braid group remembers order (σ² ≠ 1).
The honest noncommutative zeta stance is Selberg/Ihara's: **primes = primitive
conjugacy classes** (primitive closed geodesics / primitive cycles), with the zeta
an Euler product over those. The catalog's upgrade path:

- **Ihara 1966** — zeta of a graph, primes = primitive closed cycles; the nearest
  fully-worked noncommutative model (and the one the S-lane/room graphs fit).
- **Milnor 1962 / Lefschetz zeta** — the Alexander polynomial IS a zeta function
  (of the infinite-cyclic-cover monodromy); the braid family already owns the
  Alexander/Burau machinery, so "zeta over braids" has a computed ancestor.
- **Freedman–Kitaev–Larsen–Wang** — braiding as computation (Jones polynomial at
  roots of unity): the "topological qubits" seat; the same braided monoidal
  category, evaluated rather than counted.
- **Mazur / Morishita, *Knots and Primes* (arithmetic topology)** — the standing
  primes↔knots dictionary as a whole field, not our coinage: knots ↔ primes,
  3-manifolds ↔ number rings, linking ↔ Legendre symbols. Our construction is a
  citizen of this dictionary, with the catalog as the 3-manifold-side term.
- **Kurokawa** — zeta functions of categories / absolute (F₁) zeta: the frame where
  "zeta over a monoidal category" is already a studied object.

Open choices (routed to the math lane, not decided here): the catalog's official
norm (genus vs crossing vs tick-rank — Aaron: any honest ordering suffices);
whether conjugacy-class primes for B₃ get their own cartridge law; whether ζ_cat's
analytic side (poles, functional equation — Ihara zeta has one via the graph's
adjacency spectrum) earns a Soraya routing once the noncommutative version exists.

## What this changes about the name — with its true provenance

The name's actual origin (Aaron, 2026-07-02): **Kenji proposed it** — he looked at
the DBSP code in F# and a few math proofs (all that existed at the time), offered
about four candidate names with Zeta as his preferred, **and Aaron chose Zeta.**
No zeta-function semantics existed then; the name preceded the meaning.

Which makes this construction the name's AUDITION, in the house's own sense: the
name was conferred early (a label with no captured entropy — potential identity),
and everything since — the ζ glyph on the social card, the −1/12 toast,
primes-are-shapes, Schubert, and now the Euler product over the catalog's own
primes — is the captured entropy that turns a conferred label into an earned
identity. Before: Zeta = a wordmark. After the commutative slice: **Zeta = the
generating function of its own shape catalog**, product formula secured by unique
factorization of shapes. The name Kenji suggested and Aaron chose has, months
later, model-checked against its own definition — remembrance flowing backward to
a christening that could not have known what it named.

## Anchors (Beacon)

Euler 1737 (the product formula); Riemann 1859; Schubert 1949 (unique prime
decomposition of knots; genus additivity); Ihara 1966; Milnor 1962; Selberg 1956;
Freedman–Kitaev–Larsen–Wang 2000–03; Mazur (1960s remarks) & Morishita 2012
(*Knots and Primes*); Kurokawa (zeta of categories). In-repo:
`db/shapes/cartridges/crossing.lines` (the atom), PR #9145 (Schubert on the
reading list), `only-the-irreducible-is-primitive-generate-the-rest.md`.
