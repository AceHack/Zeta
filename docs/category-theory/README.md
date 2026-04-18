# Category Theory for DBSP Contributors — Required Reading

F# is a functional-first language with strong ties to category-
theoretic primitives (functor, monad, natural transformation,
profunctor, adjunction). **Dbsp.Core** leans on this heritage
hard — the operator algebra (D, I, z⁻¹, H) literally is a
category-theoretic abstraction over streaming IVM.

This directory bundles the two canonical F# / .NET-adjacent CTFP
references so contributors can learn the mental model before
writing code that will be reviewed against its standards.

## Books

1. **`ctfp-milewski.pdf`** — Bartosz Milewski, *Category Theory for
   Programmers*. The canonical modern reference. Haskell-flavoured
   but the concepts port 1:1 to F# (every `class Functor f` becomes
   an `'F<'A>` with a `map`; every `Monad m` a computation expression).
   **2020 v1.3.0** — latest stable, ~500 pages.

2. **`ctfp-dotnet/`** — Clément Bouderaux, *Category Theory for .NET
   Programmers*. Older translation of parts of Milewski to C# + F#.
   Good for readers who want compilable `.cs` and `.fsx` examples.
   Less comprehensive than Milewski; read alongside, not instead of.

## Why we require this

Our operator algebra isn't aesthetic choice — it's **mathematical
necessity**. DBSP's chain rule `D ∘ I = I ∘ D = id` is a Yoneda-
lemma-adjacent identity; Z-sets are the free abelian-group-enriched
functor category over `K`; our semiring-parametric work is enriched
category theory. Code that **doesn't** respect these structures
ends up with subtle correctness holes (retraction bugs, torn reads
across operator boundaries, composition order dependencies). We
catch them in review by checking against the algebraic laws.

## Linting-style expectations

We treat the book's guidance as near-linting — if your PR violates
one of these, the review asks *why*. Acceptable answers are
**"performance hot-path demands it"** with benchmark evidence, or
**"F# lacks HKTs so we defunctionalise here"** with a pointer to
the affected module. Anything else → fix it.

### Structural expectations (Milewski chapters → code patterns)

| Chapter | Concept | What our code looks like |
|---|---|---|
| 2 — Functions | Total, referentially transparent | All public `let` bindings should be pure unless flagged `Unsafe*`; side effects behind `Task` / `ValueTask` / explicit state |
| 3 — Categories | Composition + identity | Pipe-friendly argument order (`Stream.map c f s`, not `Stream.map s f c`) |
| 7 — Functors | `map : ('a -> 'b) -> 'F<'a> -> 'F<'b>` | `ZSet.map`, `Stream.map`, `OutputHandle.map` all have this shape |
| 9 — Natural transformations | Structure-preserving morphism between functors | Our D / I are natural transformations over the delay-shifted stream functor |
| 10 — Monads | `bind : 'F<'a> -> ('a -> 'F<'b>) -> 'F<'b>` | `circuit { }` CE's `Bind`; `Result<_, _>`'s bind chain; `Task`'s `task { }` |
| 18 — Adjunctions | Left adjoint + right adjoint | D ⊣ I (differentiate is left-adjoint to integrate) |
| 20 — Free monads | Defunctionalised effect trees | `Traced.Arrow` is a Kleisli arrow; operators themselves are a *free algebra* over the Op DU |
| 24 — Profunctors | `dimap : (s -> a) -> (b -> t) -> 'P<'a, 'b> -> 'P<'s, 't>` | `Lens<'S, 'A>` in `NovelMathExt.fs`; roadmap: full profunctor optics for nested IVM |
| 29 — Monoids + categories | Every monoid is a one-object category | `Weight` is `(ℤ, +, 0)`; `TropicalWeight` is `(ℤ∪{∞}, min, +∞)`; semiring-parametric Z-sets |

### When to escalate to a reviewer

- You're tempted to use `Exception` for an expected error → use `Result<_, DbspError>` instead (Milewski ch. 5 — Kleisli categories and Maybe)
- You're writing a `type I<T> ...` that's really a functor → make the `map` / `bind` signature explicit
- You're defunctionalising something the book names → cite the named thing in the docstring
- You're writing mutable state → justify with a comment naming the category-theoretic invariant you're preserving

### Things F# *doesn't* have that the book assumes

- **Higher-kinded types (HKTs)** — F# can't express `'F<_>` abstractly. We **defunctionalise**: drop to concrete `'F<'A>` instances (`ZSet<'A>`, `Stream<'A>`), accept the loss of polymorphism, document.
- **Typeclasses** — F# uses **SRTP** (statically-resolved type parameters) + interfaces. Close enough for most laws; less for free-monad tricks.
- **GADTs** — F# has ordinary DUs. For our needs (Op trees, operator algebras) ordinary DUs + tag matching are enough.

### Reading order

1. Milewski ch. 1–3 (Categories, Functions, Composition) — foundational
2. Milewski ch. 7, 10, 18 (Functors, Monads, Adjunctions) — maps 1:1 to `ZSet.map`, `circuit { }`, D⊣I
3. Milewski ch. 24 (Profunctors) — you'll touch this when working in `NovelMathExt.fs` / nested-data IVM
4. **Then** dip into `ctfp-dotnet/` for the F#/.NET-translated examples

## Where this bites our codebase right now

| File | Category-theoretic object | Why |
|---|---|---|
| `Algebra.fs` | Monoid `(ℤ, +, 0)` on Weight | Add / Zero / associativity |
| `ZSet.fs` | Abelian-group-enriched functor over `K` | `add` commutative + associative + inverse, `map` is functorial |
| `NovelMath.fs` | Tropical semiring + lattice | Semiring laws tested in `MathInvariantTests.fs` |
| `NovelMathExt.fs` | Residuated lattice + profunctor-lens stub | `IResiduatedLattice`, `Lens<'S, 'A>` |
| `Crdt.fs` | Semilattice (G-Counter) + commutative monoid (OR-Set, LWW) | Join-semilattice laws |
| `DeltaCrdt.fs` | Delta-morphism between full and δ representations | Natural-transformation-shaped |
| `Recursive.fs` | LFP (least fixed point) in category of monotone functors | Kleene iteration |
| `Dsl.fs` + `FSharpApi.fs` | Free monad over circuit primitives | `circuit { }` CE; Kleisli arrows in `Traced.Arrow` |
| `Incremental.fs` | D ⊣ I adjunction; chain rule `(q1 ∘ q2)^Δ = q1^Δ ∘ q2^Δ` | Proved in `DbspSpec.tla` + Z3 |

When a reviewer says *"this should be a natural transformation"*, they
mean: your function takes a functor and produces the same-shaped
functor with a different type parameter, and **commutes with map**.
Milewski ch. 9 explains why that matters.

## PRs should cite the relevant chapter in doc comments

```fsharp
/// CRDT merge — idempotent commutative monoid over `GCounter`.
/// (Milewski ch. 29 §3 "Monoids as categories"; Shapiro 2011 §4.)
static member Merge (a: GCounter) (b: GCounter) : GCounter = ...
```

That practice keeps the library's math visible and makes refactors
safer — "does the new version preserve the monoid laws?" becomes a
literal test (see `MathInvariantTests.fs`).
