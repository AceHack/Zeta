# Rename as a rolling migration — content-addressed code, Bonsai, and the forced pair again

**Date:** 2026-08-11 · **From:** Aaron (*"if we were running on zetadb and zetafs it would be a rolling
change with our 0 downtime schema evolution — cause that will apply to code too when code can be
versioned as naturally as data"* → *"once everything is content addressed the new and old versions can
live side by side and callers can update their reference at will"* → the Reaqtor/Bonsai anchor) ·
**Recorded by:** Otto (shadow)

**What this is:** the concrete motivating case for treating code as versioned data, produced by two
renames that had to be stop-the-world and did not have to be. Anchors checked, not cited.

---

## 0. The case, and it happened today rather than being imagined

Two renames landed 2026-08-11 — `Judges → Withheld` (`89d828027`) and
`SybilVerdict → DistinctnessReadout` (`f4e769356`). Both were *semantically empty*: no behaviour
changed, no test changed meaning, the compiler proved equivalence. Both were nonetheless
**atomic, stop-the-world edits**: an F# record field cannot be aliased, so every call site had to
change in one commit or the tree would not build.

That is the whole argument in one observation. **A change with zero semantic content still required
a coordinated cutover**, because the name is embedded in every reader rather than referenced by them.

Note what the tooling did *not* give us. This is not a Git limitation — Git versions the *file*
perfectly well. It is that the *unit of reference* is a name resolved at compile time, so there is no
way for a caller to say "I want the version of this thing I was built against" while another caller
says otherwise.

## 1. Bonsai — the existence proof, and it is production-hardened

Aaron's anchor: **Reaqtor** (github.com/reaqtive/reaqtor), MIT, .NET Foundation, Rx-based, "in
development for over a decade" and powering services across Bing and M365; **Bart De Smet** credited
in its history. Different implementation from ours, same load-bearing idea.

**Nuqleon vs Bonsai, since Aaron flagged it** (*"i think it's under the nuqleon name … nuqleon and
bonsai are similar/same maybe"*): checked — **nested, not synonymous**. **Nuqleon** is the broader
library ecosystem inside Reaqtor; **Bonsai** is its expression-tree component, namespaced
`Nuqleon.Linq.Expressions.Bonsai`. "It's under Nuqleon" is right; the specific thing we want is Bonsai.

Checked against its own documentation, Bonsai is stronger than a serialization format — it is *"a
lightweight object model for expression trees with a lightweight representation of **reflection**."*

- Bonsai trees are **"not compiled code but rather a description of the original structure of the
  expression"** — the computation is *data* in the strict sense, not an opaque artifact.
- It ships **slim, data-oriented counterparts** to the .NET types — `ExpressionSlim`, `TypeSlim` —
  convertible to and from real expressions.
- **Typing is optional / alternative**, explicitly to allow typing systems beyond CLR constraints and
  **"to enable interoperability with different languages."**
- Bonsai trees **have been deserialized in native code and interpreted in C++, or converted to
  strings eval-able in JavaScript**; any language with first-class quotation can produce them.
- In production at Microsoft for years, powering distributed event processing.

**The reflection half is the part that matters most here, and I would have missed it.** Bonsai does
not only make *code* data; via `TypeSlim` it makes the *type and member metadata* data too. A system
whose reflection layer is itself a serializable value is self-describing all the way down — which is
the line this repo is already on, arrived at independently.

## 1a. Aaron's duality — `DynamicValue` ⇄ Bonsai/Rx, and it resolves cleanly

> *"we already have a lot of this code for bonsai too, we are making our own IR too … we figured that
> DynamicValue and bonsai/rx are kind of duals."*

Checked in-tree, and the claim is understated. The IR surface already exists: `ZetaIrV1`, `ZetaIrV2`,
`ZetaIrCanonicalizer`, `ZetaIrNormalizer`, `GrammarIr`, `MixIr`, `GeneratorIrRegistry`, alongside
`Rx.fs`. `DynamicValue` is documented as *"the universal self-describing-payload primitive … for
shapes that are NOT known at compile time."*

The duality is Meijer's, lifted one level:

| | what remains (pull) | what acts (push) |
|---|---|---|
| the object | `IEnumerable` | `IObservable` |
| **its self-description** | **`DynamicValue`** — a *value* carrying its own shape | **Bonsai** — a *computation* carrying its own structure |

So `DynamicValue` is the self-description of **data at rest**, and Bonsai is the self-description of
**computation in flight**. They are duals in exactly the Rx sense, one meta-level up: each is the
reflective form of one side of the `IEnumerable`⇄`IObservable` pair.

### The formal name for it: **μF and νF** (Aaron, confirming intent)

> *"earlier you said i took Meijer's concepts and applied them to the meta level — this is exactly
> what i was trying to do, his μF and νF."*

Stated as designed intent rather than a correspondence noticed afterwards, and it names the structure
precisely. For a functor `F`:

- **`μF`** — the **initial algebra**, least fixed point. Finite, inductive data. Consumed by a
  **catamorphism** (fold). The `IEnumerable` / *what remains* side.
- **`νF`** — the **terminal coalgebra**, greatest fixed point. Potentially infinite, coinductive
  process. Produced by an **anamorphism** (unfold). The `IObservable` / *what acts* side.

Meijer's duality **is** the `μ`/`ν` duality; Rx is its programming-language surface.

**`DynamicValue` is literally a `μF`.** Its case set — `Null | Bool | Int | Float | String | Bytes |
Array of DV | Object of (string × DV)` — is the initial algebra of exactly that shape functor. Not
"like" one.

**And Bonsai is the sharp part, because it is not simply the `νF`.** A `νF` is potentially infinite,
so it cannot be serialised, shipped, stored or diffed. What Bonsai serialises is a **finite `μ`
description of a potentially-infinite `ν` process** — an expression tree that *denotes* a standing
query. That is precisely why it can be versioned and content-addressed at all, and it is the bridge
between the two sides rather than one of them:

> **You cannot store a `νF`. You can store its `μ` generator, and unfold it on arrival.**

Which is this repo's own
`only-the-irreducible-is-primitive-generate-the-rest` <!-- STALE-REF: ../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md -->
in categorical dress: keep the finite generator, produce the behaviour. The rule and the Rx lineage
turn out to be the same statement about `μ` and `ν`, reached from two directions.

**Where the soft regime lands:** `SoftValue` is a normalised distribution over `DynamicValue`
candidates — a **measure on `μF`**. The soft regime is probability over the initial algebra, which is
why its `observe` is a fold-shaped Bayesian update and why the idempotence question bites there and
not on the `ν` side.

Anchors: **Meijer, Fokkinga & Paterson**, *Functional Programming with Bananas, Lenses, Envelopes and
Barbed Wire* (1991) — cata/ana and the `μ`/`ν` pair; **Hagino** (categorical datatypes);
**Rutten**, *Universal Coalgebra* (2000); **Jacobs**, *Introduction to Coalgebra*; **Turi & Plotkin**
(bialgebraic semantics — the algebra/coalgebra interaction Bonsai's bridge sits on).

**Two consequences worth having.** First, this is why a self-modelling database needs *both* — reflect
over the rows and you get self-describing data; reflect over the queries and you get self-describing
computation; a stored procedure is the place they must meet. That is exactly the **ying-yang** in
Aaron's *"ying yang stored procs fully having the F# and other language and IR code used based on the
content addresses"* — the two duals, named as such before the correspondence was written down.

Second, **the duality closes rather than merely rhyming**: Bonsai's `TypeSlim` is a *type described as
a value*, which is `DynamicValue`-shaped. The reflective layer of the code side lands in the data
side's representation. That is a structural meeting point, not an analogy, and it is the concrete
place to start if we want our IR to interoperate with the Bonsai model rather than merely resemble it.

So "code as data, cross-language, at scale, for a decade" is not aspirational. It exists, it is MIT,
and it descends from the Rx lineage this repo already anchors to.

**And the structure/context split is the same DV2.0 partition we already apply elsewhere:** the tree
shape changes at a different rate than the type-and-member context that resolves its names. Splitting
them is what makes the shape addressable independently — which is the precondition for the next step.

## 2. Content-addressing is what turns versioning into *coexistence*

Aaron's completion of the argument, and it is the operative sentence:

> **Once everything is content-addressed, the new and old versions can live side by side and callers
> can update their reference at will.**

Why that follows rather than being a wish: under content-addressing, a version is not a *state* a
thing is in, it is an *identity*. `Withheld` and `Judges` are different content, therefore different
addresses, therefore **both exist** — not sequentially, but simultaneously and permanently. Nothing
was overwritten, so nothing needs migrating.

The cutover disappears because the thing that made it necessary — a single mutable binding every
reader shared — is gone. What remains is a per-caller **reference**, updated independently, at
whatever moment each caller chooses. Expand/migrate/contract stops being a *protocol you run* and
becomes *the default state of affairs*.

This is manifesto §5 (Memory Preservation) applied to code: an identity transition never silently
destroys the prior version, because it never touched it.

## 3. The forced pair, arriving for the third time today

The structure here is one this session already derived twice, and its reappearance is the reason to
trust it:

| | immutable half | mutable half |
|---|---|---|
| `TwoTimescaleFold` | shared join-semilattice over an evidence **set** | Z-set **delta log** (group, invertible) |
| `SymmetricEndurance` / `EnduranceFold` | `Withheld` **set** of corroboration facts | claim magnitude that rises and collapses |
| **code-as-data (here)** | **content-addressed versions** — append-only, idempotent, mergeable | **references** — a caller can move one, and move it back |

The same one-line theorem forces the split each time: **an idempotent group is trivial**
(`a + a = a ⇒ a = e`). Content-addressed storage must be idempotent — storing the same bytes twice is
storing them once, which is exactly what makes redelivery and reconciliation free. Therefore it
**cannot** have inverses; you cannot un-store a version. So the retraction has to live somewhere else,
and it lives in the reference: pointers move, and can move back.

**Rollback is a reference operation, not a content operation.** That is not a design preference; it is
what the theorem leaves available.

## 4. What this would take here, in dependency order

1. **An IR that is a description, not compiled bytes** — the Bonsai role. The repo's `gen/` line and
   the `GeneratorIrRegistry` are the existing surface; Bonsai's structure/context split is the design
   to copy, and its optional typing is what would let F#, C#, TS and Rust oracles share one artifact.
2. **Content-address it**, so a version is an identity rather than a state.
3. **References become first-class and per-caller**, which is the actual behaviour change — and the
   point at which a rename stops being a cutover.
4. **ZetaDB stored procs hold the addressed code** (Aaron's *"ying yang stored procs fully having the
   F# and other language and IR code used based on the content addresses"*), joining this to the
   dual-use hard/soft self-modelling database line.

## 5. Falsifiers — so this is a quotient, not a decoration

- **"Content-addressing makes coexistence free"** — refuted if two versions of a thing can be
  content-addressed and still not coexist, e.g. because some ambient registry maps a *name* to exactly
  one address. Then the mutable binding merely moved and nothing was gained. **This is the likeliest
  failure mode and the thing to design against.**
- **"Rename becomes a rolling migration"** — refuted by a semantically-empty change that still forces
  simultaneous caller updates under content-addressing.
- **"The forced pair applies"** — refuted by a content store that is both idempotent and supports
  un-storing, which the theorem says cannot exist; if one appears, the theorem is being misapplied.
- **"Bonsai's model transfers"** — refuted if our IR cannot be made language-agnostic without carrying
  full type information, which would collapse Bonsai's optional-typing property and with it the
  cross-oracle sharing.

## 6. Anchors (checked 2026-08-11)

- **Reaqtor** — <https://github.com/reaqtive/reaqtor> · MIT, .NET Foundation, Rx-based, 10+ years,
  Bing/M365 production. **Bart De Smet** credited in its history.
- **Bonsai** — <https://reaqtive.net/documentation/nuqleon/nuqleon.linq.expressions.bonsai> ·
  <https://reaqtive.net/documentation/nuqleon/nuqleon.linq.expressions.bonsai.serialization> ·
  <https://reaqtive.net/blog/2021/05/sequences-linq-rx-reaqtor-part-05-remotable-expressions>
- **Erik Meijer** — Rx / `IEnumerable`⇄`IObservable` duality; the lineage Bonsai sits in, and an
  existing root anchor in this repo.
- **Manifesto §5** (Memory Preservation) · **§8** (DV2.0, the structure/context change-rate split) ·
  **§12** (idempotency, which content-addressing satisfies by construction).

## 7. Pointers

- `89d828027`, `f4e769356` — the two renames that motivated this
- [`…delay-is-the-decoupling-operator…`](2026-08-10-delay-is-the-decoupling-operator-timescale-separation-differentiation-and-entropy-metered-into-privacy-budget.md)
  §2b — the idempotent-group theorem, derived
- `src/Core/TwoTimescaleFold.fs` — the forced pair in code
- `src/Core/GeneratorIrRegistry.fs` · `gen/` — the IR surface step 1 would build on
- `docs/research/2026-06-10-the-end-goal-dual-use-hard-soft-self-modeling-database-…` — the ZetaDB
  stored-proc line this joins
