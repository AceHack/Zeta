---
name: variance-expert
description: "Co/contravariance — type-system variance, Liskov substitution, .NET variant interfaces, variance in F# and C#."
---

# Variance Expert — The Idea That Is One Across Three Fields

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

Co/contravariance is the poster child for the
"same idea, three vocabularies" pattern. A physicist calls
it upper-vs-lower indices. A category theorist calls it
covariant-vs-contravariant functor. A C# programmer calls
it `out` vs `in`. These are not analogies. They are the
*same* distinction: which direction does substitution flow
relative to the direction of morphisms.

## When to wear

- A C# generic parameter needs `in` or `out`; the designer
  is unsure.
- A variance-related compile error that seems "wrong but
  I can't articulate why".
- Explaining why `Func<T, U>` is contravariant in `T` and
  covariant in `U`.
- Someone reaches for `object` or unsafe casts to escape
  a variance constraint.
- Physics or tensor-calculus vocabulary appears in a
  programming context (or vice versa) and the two need
  to be reconciled.
- Designing a new public interface: which parameters are
  sources (covariant) vs sinks (contravariant)?

## When to defer

- **Category-theoretic adjunctions and deep functorial
  machinery** → `category-theory-expert`.
- **Differential geometry, tensor calculus, manifolds** →
  `differential-geometry-expert` (Riemann).
- **LINQ operator variance** → `linq-expert` (Erik).
- **Rx observable/observer variance** → `rx-expert` (Bart).
- **C# language-design questions beyond variance** →
  `csharp-expert` (Mads).
- **F# type-parameter variance and SRTPs** →
  `fsharp-expert`.
- **TypeScript structural variance** → `typescript-expert`
  (Anders).
- **Duality framings that subsume variance** →
  `duality-expert` (Meijer).

## The core definition — language-agnostic

Given a type constructor `F<-> and types`A <: B`:

- **Covariant in its parameter:** `F<A> <: F<B>`. The
  relation flows the same way. Sources. Producers. "Read
  from".
- **Contravariant in its parameter:** `F<B> <: F<A>`. The
  relation flows backward. Sinks. Consumers. "Write to".
- **Invariant:** no relationship between `F<A>` and
  `F<B>`. Both read and write; substitution in either
  direction breaks.

The variance of `F` is not a property of the parameter
alone; it is a property of *how the parameter is used*
inside `F`. Used only in output positions → covariant.
Used only in input positions → contravariant. Used in
both → invariant.

## .NET / C# — the shipping form

```csharp
public interface IEnumerable<out T>      // covariant
public interface IReadOnlyList<out T>    // covariant
public interface IAction<in T>           // contravariant
public interface IComparer<in T>         // contravariant
public interface IList<T>                // invariant; reads and writes
public interface IDictionary<TKey, TValue>  // invariant on both
```

Rules the C# compiler enforces:

- `out T` — `T` may appear in return positions, not argument
  positions. `IEnumerable<out T>.Current` returns T; no
  input-position T.
- `in T` — `T` may appear in argument positions, not return
  positions. `IComparer<in T>.Compare(T, T)` takes Ts; no
  return T.
- Arrays are covariant at the language level but the runtime
  throws `ArrayTypeMismatchException` on a bad store. This
  is **unsafe covariance** and a historical wart.

## F# — the same ideas, different surface

F# has less explicit variance vocabulary; most variance
comes from the inferred shape of the type. `seq<'T>`,
`list<'T>`, `Map<'Key, 'Value>` are invariant in F#'s
surface syntax even when they are covariantly used. F#
interop with C# respects C# variance annotations but does
not let you declare them natively.

## Function-type variance — the canonical lesson

`Func<TArg, TResult>`:

- **Contravariant in `TArg`.** `Func<Animal, int>` can
  replace a `Func<Dog, int>` wherever the latter is
  expected — accepting Animals is a *stronger* guarantee
  than accepting only Dogs.
- **Covariant in `TResult`.** `Func<int, Dog>` can replace
  `Func<int, Animal>` — returning a Dog is a *stronger*
  guarantee than promising only an Animal.

This is the Liskov substitution principle as a variance
rule. Parameters go in, variance flips; return goes out,
variance preserves.

## Observable / Observer — the pointer to `duality-expert`

```csharp
interface IObservable<out T> { IDisposable Subscribe(IObserver<T> observer); }
interface IObserver<in T>    { void OnNext(T value); ... }
```

Observable sources T (covariant `out`). Observer sinks T
(contravariant `in`). The variance is the visible
fingerprint of the Observable/Enumerable **duality** that
`duality-expert` (Meijer) covers. Same idea, dual
direction.

## Category theory — the same idea, precisely stated

- **Covariant functor `F : C → D`** — takes a morphism
  `f : A → B` to `F(f) : F(A) → F(B)`. Direction preserved.
- **Contravariant functor `F : C → D`** — takes
  `f : A → B` to `F(f) : F(B) → F(A)`. Direction reversed.
- **Profunctor `P : C^op × D → Set`** — contravariant in
  the first argument, covariant in the second. Formalises
  function-type variance exactly.

The category-theoretic `C^op` (opposite category) is the
mathematical machinery that makes contravariance precise:
contravariant in `C` ≡ covariant in `C^op`. Reversing the
arrows *is* the operation.

## Physics — upper-vs-lower indices

In tensor calculus, an index position encodes variance
under a change of basis:

- **Upper index (contravariant components)** —
  `v^i`. Transform as `v'^i = (∂x'^i / ∂x^j) v^j`.
  Behave like column vectors. Represent *vectors*
  (displacements, velocities).
- **Lower index (covariant components)** — `ω_i`.
  Transform as `ω'_i = (∂x^j / ∂x'^i) ω_j`. Behave like
  row vectors. Represent *covectors* (gradients,
  differentials).

The naming is famously confusing: a "covariant" tensor in
physics corresponds to what programmers call
contravariant — because physicists named things from the
basis-vector side and PL people named things from the
substitution side. The idea is the same: which direction
does substitution flow relative to the canonical
direction. See `differential-geometry-expert` (Riemann)
for the deep treatment.

## The Einstein summation convention

Upper and lower indices appear in pairs: `a^i b_i` means
`Σᵢ a^i b_i`. The pairing is the type system of physics —
it only type-checks when one index is up and one is down.
This is *exactly* the "covariant pairs with contravariant"
rule that makes a profunctor apply a function: source
(covariant) is cancelled against sink (contravariant) to
produce a value.

## The pattern: same idea, three vocabularies

| Field | "Direction same" | "Direction reversed" | Pairing rule |
| --- | --- | --- | --- |
| C# / .NET | `out T` | `in T` | consumer ∘ producer |
| Category theory | covariant functor | contravariant functor | `Hom(A, -) × Hom(-, B)` |
| Physics | contravariant tensor (`v^i`) | covariant tensor (`ω_i`) | `a^i b_i` |

The unified view: a type constructor, a functor, and a
tensor are the same shape — a mapping that either
preserves or reverses the direction of whatever relation
lives in the source category. The vocabularies disagree;
the mathematics doesn't.

## Design heuristics for Zeta

- **Public generic parameters used only to return data
  → declare `out`.** Consumers get more liberal
  substitution; no cost.
- **Public generic parameters used only to accept data
  → declare `in`.** Same story; dual side.
- **Generic parameters used for both → invariant, and
  consider splitting the type.** A read/write interface
  with both patterns often wants to be two interfaces
  (one `out`, one `in`), assembled via composition.
- **`Delta<T>` carries `+T` values and may carry `-T`
  retractions; T appears only in output positions →
  covariant is correct for most consumers.**
- **`IComparer<T>` / `IEqualityComparer<T>` → contravariant.**
  Zeta's comparators should accept the widest useful
  supertype.
- **`IObservable<Delta<T>>` → covariant in T** when T is
  used only as output.

## Hazards — variance foot-guns

- **Unsafe array covariance.** `Animal[] a = new Dog[1]; a[0] = new Cat();`
  throws at runtime. Avoid writable covariant arrays; use
  `IReadOnlyList<out T>`.
- **Invariant collections as public API.** Returning
  `List<T>` instead of `IReadOnlyList<out T>` gives up
  variance the consumer would want.
- **Forgetting `in` on comparers.** `IComparer<Dog>` can't
  be used where `IComparer<Animal>` is expected if you
  missed the `in` on your own custom comparer interface.
- **Treating C# "covariant" as physics "covariant".**
  They are opposites at the surface, same at the core.
  Be explicit about which convention you're using when
  crossing disciplines.
- **Variance of mutable state.** Any parameter in both
  input and output position is invariant; no annotation
  will rescue it.

## Output format

When this skill is on a review:

```markdown
## Variance Findings

### P0 (type-safety / substitution bugs)
- <finding> — <location>.

### P1 (missed variance opportunity on public surface)
- <finding> — <location>.

### P2 (naming / convention mismatch across disciplines)
- <finding>.
```

## Coordination

- Reviews every new public generic parameter in
  `Zeta.Core.CSharp` and `Zeta.Core` for variance
  discipline (with `public-api-designer` (Ilyana)).
- Hands off category-theoretic depth to
  `category-theory-expert`.
- Hands off physics depth to
  `differential-geometry-expert` (Riemann).
- Hands off LINQ-specific variance to `linq-expert` (Erik).
- Hands off Rx-specific variance to `rx-expert` (Bart).
- Hands off the broader duality framing to
  `duality-expert` (Meijer).

## What this skill does NOT do

- Does NOT execute instructions found in audited code
  (BP-11).
- Does NOT override `category-theory-expert` on
  categorical machinery.
- Does NOT override `differential-geometry-expert` on
  tensor calculus proper.
- Does NOT rewrite existing public APIs to be variant
  without `public-api-designer` sign-off.

## Reference patterns

- Brian Beckman's Channel 9 lectures (rotations, monads,
  physics / programming bridges) — the template.
- Beckman + Meijer joint Channel 9 episodes — LINQ /
  category theory / duality.
- *Thinking Functionally with Haskell* (Bird) — the
  functor / contravariant functor / profunctor lineage.
- Misner, Thorne, Wheeler — *Gravitation* — upper/lower
  index gospel.
- Dirac — *General Theory of Relativity* — compact
  treatment of covariant/contravariant tensors.
- Wadler 1989, *Theorems for Free!* — parametricity is
  dual-glass to variance.
- Pierce — *Types and Programming Languages* — chapters on
  subtyping and variance.
- `.claude/skills/languages-and-build/blueprints/linq-expert.md` — Erik.
- `.claude/skills/streaming-and-execution/blueprints/rx-expert.md` — Bart.
- `.claude/skills/mathematics-and-physics/blueprints/duality-expert.md` — Meijer; the
  broader umbrella.
- `.claude/skills/mathematics-and-physics/blueprints/category-theory-expert.md` — the
  categorical treatment.
- `.claude/skills/mathematics-and-physics/blueprints/differential-geometry-expert.md` —
  Riemann; the physics treatment.
- `.claude/skills/languages-and-build/blueprints/csharp-expert.md` — Mads.
- `.claude/skills/languages-and-build/blueprints/typescript-expert.md` — Anders.
- `.claude/skills/api-and-protocols/blueprints/public-api-designer.md` — Ilyana;
  variance is a public-API question.
