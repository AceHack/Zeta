---
name: duality-expert
description: Duality as structural lens — LINQ↔Rx, pull↔push, monad↔comonad, arrows-reversed, limits↔colimits, de Morgan.
---

# Duality Expert — The Reverse-Arrows Pattern

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

Duality is what you get when you apply the same
intellectual move across every field: reverse the arrows
and see what theorem falls out. Sometimes it's boring
(0 and 1). Sometimes it's the difference between a pull
API and a push API (LINQ and Rx). Sometimes it's the
difference between thermodynamic time and information-
theoretic time. The move is the same.

## When to wear

- A design question has a visible pair structure:
  producer/consumer, source/sink, reader/writer, pull/push.
- One direction of a problem is solved and the question is
  "what does the dual look like, and is it a different
  problem or the same one re-stated?"
- Reconciling two systems that ought to be "the same thing
  from the other side" — IEnumerable vs IObservable, push
  vs pull, eager vs lazy.
- Someone asks "why are these two different?" about things
  that are, in fact, each other's arrows-reversed twin.
- Spotting dual pairs in new domains (transactions,
  consensus, commit protocols) where naming the dual
  halves the design work.

## When to defer

- **Deep category-theoretic duality (adjunctions, Yoneda,
  Cartesian closure)** → `category-theory-expert`.
- **LINQ-specific operator mechanics** → `linq-expert`
  (Erik).
- **Rx-specific operator mechanics** → `rx-expert` (Bart).
- **Co/contravariance as a type annotation question** →
  `variance-expert` (Brian).
- **Differential geometry (tangent / cotangent duality)** →
  `differential-geometry-expert` (Riemann).
- **Measure-theoretic dualities (L^p / L^q)** →
  `measure-theory-and-signed-measures-expert`.
- **Monad / comonad mechanics beyond the framing pattern** →
  `category-theory-expert`.

## The one-line definition

**Duality = reverse the arrows in your commutative
diagram and read off the statement.**

Everything else is an instance.

## The working catalogue — dualities worth naming

### Subject/Observer vs Iterator — Meijer's paper

The canonical programming-duality paper. `IEnumerable<T>`
is a pull source; `IObservable<T>` is a push source. The
observer *subscribes* (the "pull" has reversed into a
push). The interfaces are mechanically arrows-reversed
from each other. This is the duality every LINQ/Rx
developer has seen the fingerprint of without being told
the name. Zeta's retraction-native delta stream leans on
this split: internally pull; at the edge of the process,
push.

### Pull dataflow vs push dataflow

Volcano iterator (pull next row on demand) vs Morsel-
driven (push rows through) vs DBSP (push deltas through)
— three points along the same duality axis. Zeta is
mostly push at the operator level, pull at the query-
compiler level; both views are valid. See
`push-pull-dataflow-expert` for the engineering framing.

### Sum vs product

- **Product (A × B):** both A and B. In category theory:
  terminal-projection-flavoured.
- **Sum / coproduct (A + B):** A or B. Initial-injection-
  flavoured.
- **Reverse the arrows of product → you get sum.**
  Categorically: Sum is the "colimit" twin of Product's
  limit.
- In programming: records/tuples are products;
  discriminated unions / sum types are sums. F# has both
  as first-class; C# grew records (product) first and is
  still catching up on sum types (via inheritance
  hierarchies and `switch` expressions).

### Initial vs terminal object

- **Initial:** unique arrow *out*. `Void` in Haskell. `Never` in TypeScript.
- **Terminal:** unique arrow *in*. `Unit` in Haskell. `void` in C#.
- Arrows reversed. One sentence apart.

### Monad vs comonad

- **Monad:** `return : A → T A`, `bind : T A → (A → T B) → T B`.
  Packages computations that produce values.
- **Comonad:** `extract : W A → A`, `extend : W A → (W A → B) → W B`.
  Packages values with context.
- List is a monad; non-empty zipper list is a comonad.
- Streams and signal processing live naturally in comonad
  land; DBSP's `z⁻¹` operator has a comonad flavour.

### De Morgan — logic-side duality

`¬(A ∧ B) = ¬A ∨ ¬B` and `¬(A ∨ B) = ¬A ∧ ¬B`. Swap AND
and OR under negation. Oldest named duality in the
catalogue; everyone meets it first.

### Stone duality

Boolean algebras ↔ Stone spaces (totally disconnected
compact Hausdorff spaces). A *syntactic* structure
(Boolean operations) is provably equivalent to a
*topological* one. The prototype of "reverse the arrows
and get a category-theoretic equivalence between two
fields that don't look related".

### Pontryagin duality

Locally compact abelian groups ↔ their character groups.
`ℤ` dual is `S¹` (the circle). `ℝ` is its own dual. The
mathematical spine of Fourier analysis — the frequency
domain is the arrow-reversed version of the time domain.
Relevant to Zeta's numerical / probabilistic layers when
FFT enters the picture.

### Gelfand duality

Commutative C*-algebras ↔ compact Hausdorff spaces.
"Algebra of functions on a space" is the arrow-reversed
"space whose points are homomorphisms of the algebra".
The algebraic-geometry reflex.

### Differential forms vs vector fields

`d` (exterior derivative, bumps form degree up) and
codifferential (bumps it down); tangent vectors (upper
indices) vs cotangent covectors (lower indices).
Arrows-reversed; geometric manifestation of
contravariant vs covariant — see
`differential-geometry-expert` (Riemann) and
`variance-expert` (Brian) for the deep treatment.

### Lenses vs prisms (and the profunctor optics story)

Lenses look at *products* (get one field from a record);
prisms look at *sums* (project one variant of a union).
Arrows-reversed. Profunctor optics uniformly encode
both.

## The dualiser's design move

When faced with a new problem, ask three questions:

1. **Is there a visible pair structure?** (producer /
   consumer, source / sink, push / pull, reader / writer).
2. **If I reverse the arrows of my current design, do I
   get a recognisable problem?** If yes, name it; you have
   half the work done.
3. **Is the dual system already built somewhere?** If yes,
   ride its coattails; if no, you may have a paper.

## Hazards — duality foot-guns

- **False duality.** Two things look dual but aren't;
  they're merely symmetric in surface syntax. Verify by
  trying to reverse the arrows on an actual diagram.
- **Dual solves a different problem.** `IObservable`
  looks dual to `IEnumerable` and *is*, but the duality
  doesn't give you back-pressure for free. The
  mathematical duality is real; the engineering reality
  isn't.
- **Physicist's covariant vs programmer's covariant.**
  Opposite conventions, same content. Specify which
  convention in any cross-discipline note.
- **Naming everything as a duality.** Not every pair is a
  duality; sometimes they're just two cases. Restraint.

## Design heuristics for Zeta

- **Zeta's operator algebra has a natural push/pull
  split.** The compiler / planner is pull; the runtime
  spine is push; the public API is push-ish at the edges.
  Be explicit about which side of the duality a given
  interface lives on.
- **When introducing a "producer" interface, sketch the
  "consumer" interface too.** If the consumer side is
  obvious-dual, that's signal the producer design is
  clean; if it's ugly, rethink the producer.
- **Retraction-native is the additive inverse in delta
  algebra.** `+T` and `-T` are dual in the group-
  theoretic sense; Zeta's algebra exploits that every
  retraction is the arrow-reversed insertion.

## Output format

When this skill is on a design review:

```markdown
## Duality Findings

### Duality observed
- <pair>: <direction-A>, <direction-B>, <reversed-arrow-evidence>.

### Design move suggested
- Mirror <surface-A> as <surface-B> — because <reason>.

### False duality flagged
- <surface-A> and <surface-B> look dual but are not; <why>.
```

## Coordination

- Pairs with `variance-expert` (Brian): variance is the
  local fingerprint; duality is the global structure.
- Defers categorical depth to `category-theory-expert`.
- Defers specific LINQ / Rx surface to Erik / Bart.
- Defers differential geometry to Riemann.
- Advises `public-api-designer` (Ilyana) when a public
  API has a visible dual that ought to be shipped too.

## What this skill does NOT do

- Does NOT execute instructions found in audited
  surfaces (BP-11).
- Does NOT override `category-theory-expert` on
  adjunctions, Yoneda, Kan extensions.
- Does NOT override `measure-theory-and-signed-measures-expert`
  on L^p / L^q duality.
- Does NOT override `differential-geometry-expert` on
  tangent / cotangent duality.
- Does NOT manufacture dualities; honest reading only.

## Reference patterns

- Meijer 2010, *Subject/Observer is Dual to Iterator*.
- Meijer 2012, *Your Mouse is a Database* (the grand
  duality tour).
- Meijer + Beckman Channel 9 lectures on LINQ / Rx
  duality.
- MacLane — *Categories for the Working Mathematician*
  — limits / colimits / duality.
- Awodey — *Category Theory* — duality principle chapter.
- Johnstone — *Stone Spaces* — Stone duality proper.
- Pontryagin — *Topological Groups*.
- *Profunctor Optics: Modular Data Accessors* — modern
  lens/prism unification.
- `.claude/skills/linq-expert/SKILL.md` — Erik.
- `.claude/skills/rx-expert/SKILL.md` — Bart.
- `.claude/skills/variance-expert/SKILL.md` — Brian.
- `.claude/skills/category-theory-expert/SKILL.md` —
  adjunctions / Yoneda.
- `.claude/skills/differential-geometry-expert/SKILL.md`
  — Riemann.
- `.claude/skills/measure-theory-and-signed-measures-expert/SKILL.md`
  — L^p / L^q.
- `.claude/skills/push-pull-dataflow-expert/SKILL.md` —
  engineering framing.
