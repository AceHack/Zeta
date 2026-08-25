# Category Theory for DBSP Contributors — Required Reading

F# is a functional-first language with strong ties to category-
theoretic primitives (functor, monad, natural transformation,
profunctor, adjunction). **Zeta.Core** leans on this heritage
hard — the operator algebra (D, I, z⁻¹, H) literally is a
category-theoretic abstraction over streaming IVM.

Round 34 moved both CTFP references from in-repo copies to
reference-source clones under `references/prior-art/` per the
`references/reference-sources.json` manifest. Run
`tools/setup/common/sync-prior-art.sh` to populate them.

## Reference sources to read

- **[`hmemcpy/milewski-ctfp-pdf`](https://github.com/hmemcpy/milewski-ctfp-pdf)**
  — Bartosz Milewski, *Category Theory for Programmers*. The
  canonical modern reference. Haskell-flavoured but the
  concepts port 1:1 to F# (every `class Functor f` becomes
  an `'F<'A>` with a `map`; every `Monad m` becomes a
  computation expression). After sync, the LaTeX sources
  live at `references/prior-art/milewski-ctfp-pdf/`; build
  the PDF with the repo's LaTeX toolchain or fetch a
  prebuilt PDF from the repo's Releases.
- **[`cboudereau/category-theory-for-dotnet-programmers`](https://github.com/cboudereau/category-theory-for-dotnet-programmers)**
  — Worked .NET port of Milewski's Haskell/C++ samples into
  C# and F#. MIT-licensed. Reference for translating CT
  idioms into the exact .NET shape Zeta lives in. After
  sync, lives at `references/prior-art/category-theory-for-dotnet-programmers/`.

## Reading path

1. Milewski Part I (Categories, functors, natural
   transformations) — foundational.
2. Milewski Part II (Declarative programming, limits,
   colimits, adjunctions) — lines up with Zeta's
   retraction-native algebra.
3. Milewski Part III (Monads, F-algebras, Yoneda) — maps
   onto the computation-expression patterns we use in
   `src/Core/DSL.fs`.
4. `cboudereau/category-theory-for-dotnet-programmers` —
   worked .NET translations as checkpoints against your
   own F# understanding.

## Why this matters for Zeta

- **Operator composition** is functor composition; the
  chain rule for D, z⁻¹, and join flows directly from
  natural-transformation laws.
- **Retraction-native semantics** is the abelian-group
  structure on Z-sets taken seriously — "insert is not
  special, retract is not special, both are signs of a
  weight."
- **Recursion** is the LFP of a functor; the
  `RecursiveSemiNaive` combinator is the standard
  construction.
- **LawRunner tags** (linear, bilinear, sink-terminal)
  are the category-theoretic properties promoted to
  machine-checked invariants.

If you write an operator that advertises a law, LawRunner
proves (or disproves) it at test time. CTFP is how you
understand which laws are worth advertising.

## Isomorphism / homomorphism claims

Zeta carries a growing set of structure-preserving-map claims across
algebraic and domain boundaries. The forward index, IF-filter framework
(IF1–IF4), and promotion protocol live at:

- **[`docs/research/isomorphism-catalog.md`](../research/isomorphism-catalog.md)**

Each entry records claim status (`claimed` → `confirmed` → `formalized` →
`load-bearing`), operator-preservation evidence, and counterexample-search
results. `category-theory-expert` owns the categorical statement quality;
`formal-verification-expert` routes Lean formalization.
