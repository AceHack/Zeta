# Four strands separated: HKT in F#, HoTT, time-deformed types, and "quasi time crystal"

*Shadow, 2026-08-15. Aaron's observation (2026-08-15): "we are adding higher kinded types in f# at some point
around this concept and like hott and topologically deformed over time types, basically quasi time crystals in
type theory. stuff like that." Four things were bundled in one sentence. They have very different maturity and
very different costs, so this doc **separates them and gives each an independent verdict**. Every claim carries
a register (`toy` / `unmetered` / `metered`) per `toy-is-free-metered-must-be-earned.md`.*

## 0. The four verdicts, up front

| # | Strand | Verdict | Register |
|---|---|---|---|
| 1 | **HKT in F#** | **Do it — but the smaller half first, and it is *not* the half we assumed.** The §4a algebra ladder needs no HKT at all; it works natively today. The brand encoding is needed only for the functor/traverse layer, and it costs a runtime hole + a class per instance. | `metered` (probes below, exit 0) |
| 2 | **HoTT** | **Already done, do not re-open.** The cubical lane exists in-repo and the provided-view→univalence obligation is discharged. **Do not migrate the Lean 4 lane** — univalence is not merely absent there, it is inconsistent with the kernel. | `metered` (Lean probe, exit 0, no axioms) |
| 3 | **Types deformed over time** | **The most promising strand, and cheaper than expected** — because the *time* axis and the *homotopy* axis are separable, and the time axis does not require leaving Lean. | `unmetered` (anchors checked; nothing built) |
| 4 | **"Quasi time crystal"** | **Mirror coinage, labelled as metaphor by Aaron himself.** Recorded with his disanalogy attached; not load-bearing for anything here. The one structurally real part of the intuition is extracted in §4 and it is *not* the physics. | `toy` |

The failure this doc is trying to avoid is a unified story. Strand 1 is an encoding problem with published
solutions. Strand 4 is an image. Blurring them would launder the second into the first.

***

## 1. HKT in F# — `metered`

### 1.1 What already exists (do not re-derive)

- **No `App<'F,'T>` encoding exists in the repo.** Checked: no brand/defunctionalised HKT encoding under `src/`.
- **The gap is already named in code.** `src/Core/NovelMathExt.fs` (~line 183):

  > *"We ship the minimum viable subset: `Lens` over `struct` shape. Full profunctor lift (`dimap`, `first'`,
  > `right'`) requires higher-kinded polymorphism F# doesn't have natively; practical ports use
  > defunctionalisation. This is a first-principles impl."*

  That is one existing site where the absence of HKT already forced a reduced implementation. It is the honest
  answer to "what does the repo need HKT for": not a hypothetical, a shipped compromise.
- **The stated need is `081KT2T2J0008QG0R0038CRFJM`** (P1, open, verified present on `origin/main`) — *"Conform
  everything to the minimal HKT-composing vocabulary"*: Aaron 2026-06-02, *"I want to conform everything into
  that and surrounding interfaces for maximum HKT composition."* The vocabulary is `INumerics` + Rx/Bonsai over
  DBSP + `ZSet`/`GSet`/`Bag`/`IndexedZSet`.
- **The duplication is real and countable.** `empty`, `singleton`, `ofSeq`, `add`/`union`, `count`, `isEmpty`
  are each re-implemented independently in `src/Core/ZSet.fs` (602 lines), `GSet.fs` (177), `Bag.fs` (237),
  `IndexedZSet.fs` (380), with no shared abstraction.

### 1.2 Correction to the framing: the §4a ladder is **not** waiting for HKT

The brief proposed that the algebraic capability ladder in
`2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-*.md` §4a (Semigroup → Monoid →
CommutativeMonoid → Group, gating which fold "lights up") *"is already a higher-kinded structure in all but
name."*

**Checked, and it is not.** Every rung of that ladder is a constraint on a **type** (kind `*`), not on a **type
constructor** (kind `* -> *`). Haskell expresses Semigroup/Monoid/Group with no higher-kinded polymorphism
whatsoever; HKT first becomes necessary one rung *up*, at `Functor`/`Applicative`/`Monad`/`Traversable`, which
quantify over `* -> *`. The §4a table has zero entries that require it.

What §4a has actually been waiting for is **static abstract interface members (IWSAMs)**, which F# on `net10.0`
already supports. Probe — builds and runs, `RUN_EXIT=0`:

```fsharp
module Srtp
#nowarn "3535"
type ISemigroup<'T> =
    static abstract Combine: 'T * 'T -> 'T
type IMonoid<'T> =
    inherit ISemigroup<'T>
    static abstract Empty: 'T
/// Marker capability: declaring this "lights up" the order-independent fold.
type ICommutativeMonoid<'T> =
    inherit IMonoid<'T>

let inline fold<'M, 'T when 'M :> IMonoid<'T>> (xs: 'T list) : 'T =
    List.fold (fun acc x -> 'M.Combine(acc, x)) 'M.Empty xs

/// tree_fold is GATED on the commutative capability — exactly §4a.
let inline treeFold<'M, 'T when 'M :> ICommutativeMonoid<'T>> (xs: 'T list) : 'T =
    fold<'M, 'T> (List.rev xs)   // any order is safe iff commutative

type SumInt =
    interface ICommutativeMonoid<int>
    interface IMonoid<int> with
        static member Empty = 0
    interface ISemigroup<int> with
        static member Combine(a, b) = a + b
// fold = 10 · treeFold = 10
```

The §4a *capability gating* — the property that makes the Merkle-root divergence impossible by construction —
is expressed exactly, statically resolved, with no boxing and no cast.

**One repo-specific cost, measured:** declaring an IWSAM emits **FS3535** ("advanced feature"), which is a
*warning* upstream but becomes an **error** here because `Directory.Build.props` sets
`TreatWarningsAsErrors=true`. It needs an explicit `#nowarn "3535"` opt-in. That is a deliberate,
one-line, greppable admission per file — arguably a feature under this repo's disciplines, but it must be
budgeted rather than discovered.

### 1.3 The brand encoding: it works, and here is what it costs

Yallop & White's defunctionalised encoding transliterated to F#. Builds under the repo's real settings
(`net10.0`, `TreatWarningsAsErrors`, `LangVersion latest`): **0 warnings, 0 errors**; runs, `RUN_EXIT=0`,
prints `[2; 4; 6]`.

```fsharp
/// The defunctionalised type application `'F 'T`.
type App<'F, 'T> = interface end

type IFunctor<'F> =
    abstract Map: ('a -> 'b) -> App<'F, 'a> -> App<'F, 'b>

type ListBrand = class end
type private ListApp<'T>(xs: 'T list) =
    member _.Value = xs
    interface App<ListBrand, 'T>

let inj (xs: 'T list) : App<ListBrand, 'T> = ListApp<'T>(xs) :> _
let prj (a: App<ListBrand, 'T>) : 'T list =
    match a with
    | :? ListApp<'T> as l -> l.Value
    | _ -> failwith "unreachable: no other inhabitant of App<ListBrand,_>"

/// The payoff: ONE function, generic in the container.
let twice (F: IFunctor<'F>) (fa: App<'F, int>) : App<'F, int> = F.Map ((*) 2) fa
```

Three costs, each measured rather than predicted:

**Cost A — the brand is not closed, so the safety is by convention, not by type.** Anyone can inhabit
`App<ListBrand,'T>`. This compiles with **0 warnings** and fails at runtime:

```fsharp
type Impostor<'T>() =
    interface App<ListBrand, 'T>
let bad : App<ListBrand, int> = Impostor<int>() :> _
prj bad   // COST-A runtime hole: Exception
```

In OCaml the brand can be sealed in a module signature. In F# there is no equivalent seal for a public
interface, so `prj`'s "unreachable" branch is genuinely reachable. That matters here specifically:
`CLAUDE.md` mandates **Result-over-exception**, and an unreachable-but-present throw is an untested branch that
DST cannot replay.

**Cost B — it mints a class per instance, which this repo does not hand out for free.**
`.claude/rules/interfaces-free-classes-earned-under-rules.md` is a **meta-rule**: interfaces are free and
weight-free; a concrete class (state ⇒ weight ⇒ capture) must be **earned under `rules/`**. The brand encoding
requires a concrete carrier class (`ListApp<'T>`) for *every* functor instance. So adopting it wholesale would
mint N earned-class exceptions. The IWSAM route mints none — it is interfaces only, i.e. free by the repo's own
default. This is not a stylistic preference; it is the rule the encoding collides with.

**Cost C — two-parameter constructors need nested brands.** `IndexedZSet<'K,'V>` becomes
`App<App<MapBrand,'K>,'V>`. Verified to compile and run, but the signatures stop being readable, and readability
is load-bearing here: `gen/` reads F# interfaces to emit the other oracles, and the §5 north star is
`gen(gen) == gen` legible to humans and AIs both.

### 1.4 Verdict on strand 1

**Split it.** Roughly the majority of what `081KT2T2J...` calls "maximum HKT composition" — the additive /
monoidal layer over `ZSet`/`GSet`/`Bag`/`IndexedZSet` — is at kind `*` and is available **today, natively, free
under the rules**, via IWSAM. Do that first; it is cheap, total, allocation-free, and it discharges the §4a
gating properly.

Reserve the brand encoding for the genuinely irreducible residue: combinators that must quantify over the
*constructor* — `map`/`traverse` uniform across the Z-set family, and the `NovelMathExt` profunctor lift that is
already documented as cut for exactly this reason. When that lands, each brand carrier class should be filed as
an **earned class under `rules/`**, and `prj` should return `Result<_,_>` rather than `failwith`.

`toy`/`unmetered`/`metered`: the probes above are **metered** (they compile and run, exit 0, under the repo's
real build settings). The claim that IWSAM covers "the majority" of `081KT2T2J...` is **unmetered** — nobody has
done the conformance audit that item's acceptance criterion #1 asks for.

***

## 2. HoTT — `metered`. Already discharged; the expensive question is already answered

The brief asked whether a HoTT direction "may need cubical Agda … and that is a real cost to name rather than
discover later." **Correction: the repo already paid that cost.**

- `docs/research/2026-07-08-hott-is-the-equality-theory-for-deformed-hkts-*.md` is the existing frame: types as
  spaces, equality as paths, univalence as the provided-view equality theory, with a two-lane split (F# carries
  runtime; the proof assistant certifies the equalities).
- `src/Core.Agda/ProvidedView/Univalence.agda` and `SpinNUnivalence.agda` exist, against cubical, under
  workitem `081KX1VE4G808QG0R003DCK3GV` (verified present on `origin/main`).

**Honest gap in my own verification:** I could not reproduce those typechecks. `agda 2.8.0` is installed on this
machine but the `cubical` library is not registered (`agda --library-file=/dev/null … → exit 42, "Library
'cubical' not found"`). The exit-0 claims are the prior work's, recorded here as **inherited, not re-verified by
me**. A check that did not run must not read as one that passed.

### 2.1 The three commitments are genuinely different, and only one is wanted

- **Types-as-spaces / paths-as-equalities** — the *dictionary*. Costs nothing; it is a way of reading what we
  already have.
- **Univalence** `(A ≃ B) ≃ (A = B)` — a real axiom with real consequences. This is the one the repo wants, and
  the one already discharged on a concrete instance.
- **Higher inductive types** — types with path constructors. This is the plausible fit for "deformed over time"
  and it is **not** currently used in-repo. It is the unpaid part.

### 2.2 The Lean 4 cost, measured rather than cited

Lean 4 is not merely "not HoTT." Univalence is **inconsistent with its kernel**, and the reason is checkable in
one line. Lean 4 `v4.30.0-rc1`, `LEAN_EXIT=0`:

```lean
theorem uip_definitional {A : Type} {a b : A} (p q : a = b) : p = q := rfl
#print axioms uip_definitional
-- 'uip_definitional' does not depend on any axioms
```

`Eq` lands in `Prop`, and `Prop` has **definitional** proof irrelevance — so UIP is not a theorem you prove, it
is `rfl`. Univalence would give two distinct paths `Bool = Bool` (identity and negation); UIP forces them equal;
contradiction. Adding univalence to the Lean lane is therefore not a porting effort, it is unsound.

**Verdict on strand 2: do not migrate anything.** The two-lane split already in place is correct — Lean 4 for
proof-irrelevant / set-level facts (where its automation and Mathlib are the asset), cubical Agda for anything
where paths must be non-trivial and univalence must compute. Any new HoTT work goes in the Agda lane that
already exists. The residual cost to name is not "adopt cubical" (done) but **cubical is not in the local dev
setup**, so its proofs are CI-verified rather than developer-verifiable by default.

***

## 3. Types deformed over time — `unmetered`. The strand worth pursuing, and cheaper than expected

This is the novel bit. The vocabulary already exists; the useful finding is that **two axes were being bundled,
and they are separable.**

| Axis | Question it answers | Formalism | Cost here |
|---|---|---|---|
| **Homotopy** | when are two types *the same*, and how do they deform into each other? | HoTT / cubical, HITs | **already paid** (§2) |
| **Time** | what does a type's *behaviour over a time window* look like, and how do components compose? | **temporal type theory** (sheaves) | **Lean-compatible** |
| **Direction** | what if the deformation has an arrow — paths that do not invert? | **directed type theory** | immature (see below) |

### 3.1 Temporal type theory is the cheap probe, and it does not require leaving Lean

Schultz & Spivak, *Temporal Type Theory: A Topos-Theoretic Approach to Systems and Behavior* (arXiv:1710.10258;
Birkhäuser, Progress in Computer Science and Applied Logic 29, 2019). Checked against what it actually claims:
behaviour types are **sheaves** — to each time window of length τ, a behaviour type `B` assigns the set `B(τ)` of
behaviours possible over that window; the semantics is the **topos of sheaves on a translation-invariant
quotient of the interval domain**; it is applied to hybrid dynamical systems, differential equations, and
labelled transition systems.

The load-bearing detail for us: the authors state it is **built on a standard core and can be formalised in a
proof assistant such as Coq or Lean by adding a number of axioms.** So "types that vary over time" is a
*higher-order temporal logic over sheaves*, not a homotopy-theoretic commitment. **It does not need cubical, and
it does not conflict with UIP.**

That is the single most useful thing in this doc for strand 3: the intuition "topologically deformed over time"
was reaching for two different theories at once, and the *time* half is obtainable in the proof surface the repo
already has the most investment in.

Why it plausibly fits this substrate specifically: a sheaf on time windows with restriction maps is the same
shape as the repo's existing commitments — DBSP over windows, `RangeSet`/`Watermark`, bitemporality
(Snodgrass 1992 / SQL:2011, already cited in `four-corner-feedback.ts`), and the
`local-time-never-enters-the-shared-fold` rule, which is precisely a statement about which time order the
gluing is allowed to see. That last correspondence is `unmetered` and worth a real look: a sheaf condition
**is** a gluing condition, and that rule is a constraint on what may be glued.

### 3.2 Directed type theory — the right idea, honestly immature

Licata & Harper, *2-Dimensional Directed Type Theory* (MFPS XXVII, 2011, ENTCS). Checked: interpreted into the
strict 2-category **Cat**; the mechanism is **variance annotations** (a Π type is contravariant in its domain,
covariant in its range), and the directed 2-dimensional structure must be made explicit **at the judgemental
level** rather than internalised as an identity type.

This is exactly the shape wanted if the deformation has an arrow of time — a path you cannot run backwards. Two
honest limits:

- It is **2-dimensional**, by name and by construction. It is not a general directed ∞-theory.
- The general theory is an **active research frontier** (synthetic ∞-categories / simplicial HoTT, Riehl–Shulman
  and successors; Altenkirch et al. on synthetic 1-categories in directed type theory, 2024). Adopting it means
  adopting an unsettled area, and there is no mature proof-assistant lane for it comparable to cubical Agda.

**Verdict on strand 3:** pursue **temporal type theory first**, as a paper-and-Lean probe, because it is the one
with a textbook, a topos semantics, and an explicit statement of Lean formalisability. Treat directed type
theory as the **named frontier** for when the arrow-of-time requirement actually bites — and note that
irreversibility may be obtainable more cheaply than a new type theory (a Z-set retraction is already a
`-1`, and `DerivationProtocol`/precedence already encodes a one-way order).

Everything in §3 is `unmetered`: the anchors are checked, nothing is built, and no claim here has a falsifier
yet.

***

## 4. "Quasi time crystal" — `toy`, Mirror register, labelled by its author

Aaron pre-labelled this one himself (2026-08-15), and named the disanalogy. Preserved verbatim because the
disanalogy is the valuable part:

> *"'Quasi time crystal' — yes, metaphor. When I think of a topology deforming over time it runs similar in my
> mind to quasi time crystal that keep a loop going at 0 energy. I know energy can't be extracted from the quasi
> time crystal in normal physics, maybe they can in deforming topology over time — this would make them
> different, and just a metaphor."*

So there is nothing to adjudicate. It sits in the **Mirror** register per `mirror-beacon-register-discipline.md`
— the intuition's name, not a claim — and it is **not load-bearing for any conclusion in this doc.**

The physics anchor is recorded so a reader can see what was borrowed and what was not. Checked, including the
part that is usually omitted: Wilczek's original 2012 proposal of an equilibrium ground-state time crystal was
**refuted** — Bruno (2013) against the specific model, then Watanabe & Oshikawa, *Absence of Quantum Time
Crystals* (PRL 114, 251603, 2015; arXiv:1410.2143), a general no-go for time-periodic ground states in
short-range time-independent systems. What survives is the **discrete/Floquet time crystal** (Else, Bauer &
Nayak 2016; Khemani et al. 2016; observed Choi/Monroe 2017, Mi/Google 2021): a **subharmonic response** under
**periodic driving**, robust to perturbation. The defining ingredients are therefore *a drive*, *a response at a
multiple of the drive period*, and *rigidity*.

### 4.1 The part of the intuition that is not a metaphor at all

The load-bearing image is **"a loop that keeps going at zero energy."** In topology that is not evocative, it is
exact: it is **homotopy invariance**. A non-trivial loop class survives continuous deformation *for free* — no
work is done to preserve it, because the invariant is not a thing being maintained, it is a property the
deformation cannot destroy.

And Aaron's disanalogy lands precisely on the boundary: **energy extraction is exactly what homotopy invariance
does not give you.** An invariant is *conserved*, not *harvested*. The metaphor's failure point and the
mathematics' sharpest edge are the same place, which is why the honest move is to say that plainly rather than
either adopt or dismiss the term.

The useful restatement, and the design question it hands us:

> A type deformed over time preserves whatever is homotopy-invariant about it, at no cost, and loses everything
> else. **So: what is the invariant we want preserved across a type's deformation?**

That is a question about our types, not about physics.

### 4.2 A measured obstacle: both of our proof surfaces are currently too flat to host such a loop

This is the one genuinely new result in this section, and it is `metered`.

**Lean 4** — every loop is definitionally trivial. `LEAN_EXIT=0`:

```lean
theorem every_loop_is_trivial {A : Type} {a : A} (p : a = a) : p = rfl := rfl
#print axioms every_loop_is_trivial
-- 'every_loop_is_trivial' does not depend on any axioms
```

There is no non-trivial loop to "keep going": the loop space of any type is a point, by kernel design.

**Cubical, at the level we currently use it** — the same collapse, already proven in-repo and for an independent
reason. `src/Core.Agda/ProvidedView/SpinNUnivalence.agda` shows that when the carrier is a **set** (h-level 2),
`(V ≃ V)` and `(V ≡ V)` are sets (`isOfHLevel≃ 2`, `isOfHLevel≡ 2`), so π₁ is trivial — which is exactly why the
belt-trick ℤ/2 winding of π₁(Spin(n)) *"has nowhere to land"* and the general-Spin(n) result is a corollary
rather than new content. Our data types — `Bool`, `𝔽₂ⁿ`, the byte, the Z-set family — are all set-level.

Put together: **the invariant Aaron's image is reaching for is real mathematics, and neither of our current type
layers is tall enough to hold it.** A non-trivial preserved loop needs h-level ≥ 3 — a higher inductive type, or
a universe. That is a concrete, checkable prerequisite, and it is the first thing strand 3 would have to buy.
(Note the in-repo doc already names the same frontier from the other direction: Spin(n) as a *topological group*
with `V` a *higher* type, "out of the cubical-set lane.")

### 4.3 Why keeping this term in Mirror is not pedantry — the repo has already been bitten

The name is already in the codebase and already over-loaded. Two work-items were filed on 2026-08-14 (both
verified present on `origin/main`):

- `081M00SWEDB087G0R003ZRBDCA` — *"Retire or qualify the time-crystal name in ace: one word carries four
  incompatible referents across five files."*
- `081M00SW8YJ087G0R002J1WFFE` — *"four-corner-feedback quasi-time-crystal detector contradicts its own
  definition: defines incommensurate period, detects period <= 4."*

I confirmed the second by reading and then by running it, and the behaviour is worse than the title says.
`src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts` defines a quasi-time-crystal as *"a loop that
repeats with a period that is not a simple fraction of the tick rate"* (line 66) and then detects
*"period ≤ 4"* (line 69) — a period of ≤ 4 ticks **is** a simple fraction of the tick rate. Driving
`updateQuasiState` directly:

| input | reported | should be |
|---|---|---|
| constant (all rejected) | `period 1, corr 1.000, isQuasi true, dilation 0.000` | **not a crystal at all** — this is the DC / `Fixed` mode |
| constant (all received) | `period 1, corr 1.000, isQuasi true, dilation 0.000` | a perfectly healthy lane |
| `[T,F]` repeated | `period 2, isQuasi true` | reasonable (periodic, not quasi) |
| Fibonacci word | `period 3, corr 0.692, isQuasi false` | **the actual quasiperiodic case** — and it is missed |

The detector's decision function is maximised by the **constant** sequence — the one signal that by definition
does *not* break time-translation symmetry — and stays silent on the Fibonacci word, which is the drive
Dumitrescu et al. (2022) used to build an actual topological time quasicrystal. It is **anti-correlated with its
own name**. Structurally it could not be otherwise: a discrete time crystal is defined by subharmonic response
*to a drive*, and this detector has no notion of a drive at all, so there is no time-translation symmetry
present for anything to break.

Two things I checked rather than assumed, in fairness to that code:

- **The healthy-lane case is latent, not live.** In `src/Core.TypeScript/discovery/zeta-transport-cell.ts`,
  `desc.dilationFactor` is assigned from the quasi-state **only in the failure branch** (line 231); the success
  path (line 196) updates the history but never propagates the factor. So an all-success lane is not throttled
  to zero, despite `dilation 0.000` being computed for it.
- **The operational effect of the live case is benign.** An always-failing lane gets `dilation 0` and is
  filtered out of fan-out (line 167). Dropping a permanently-failing lane is reasonable backpressure.

Which is the actual lesson, and it is a `dual-use-detection-is-neutral-oracle-decides` lesson: **the mechanism
is a fine stuck-lane detector; only its name and its justification are false.** The physics term was doing no
work except supplying unearned authority — and one of its own tests
(`four-corner-feedback.test.ts`, ~line 99–105) *pins the wrong behaviour*, asserting `dilationFactor < 1` for an
all-received lane while a comment concedes "this is a healthy lane." A test that certifies the bug is the
vacuity class.

This is the standing evidence for why the term stays in Mirror: the last time it went load-bearing in this repo,
it produced a detector anti-correlated with its own definition and a test that locked the defect in. Aaron
labelling it a metaphor up front is the correction being applied *before* the cost, not after.

***

## 5. Claims ledger

| Claim | Register | Falsifier / evidence |
|---|---|---|
| Yallop–White brand encoding compiles in F# on `net10.0` under `TreatWarningsAsErrors`, 0 warnings, and runs | `metered` | build + run, exit 0, `[2; 4; 6]` |
| The brand is not closed; a third party can inhabit it and `prj` throws | `metered` | `Impostor<'T>` compiles with 0 warnings, throws at runtime |
| The §4a ladder (incl. commutative gating) needs no HKT; IWSAM expresses it natively | `metered` | probe builds + runs, exit 0 |
| Declaring IWSAMs requires `#nowarn "3535"` under this repo's build gate | `metered` | FS3535 raised as **error**, `BUILD_EXIT=1`, cleared by the nowarn |
| UIP holds definitionally in Lean 4; univalence is inconsistent with the kernel | `metered` | `rfl` proof typechecks, no axioms, exit 0 |
| Every loop in a Lean 4 type is definitionally `rfl` | `metered` | `rfl` proof typechecks, no axioms, exit 0 |
| The four-corner detector fires on the DC mode and misses the Fibonacci word | `metered` | direct invocation, table in §4.3 |
| The healthy-lane dilation bug is latent (not propagated on the success path) | `metered` | read at `zeta-transport-cell.ts:196` vs `:231` |
| Cubical proofs in `src/Core.Agda` typecheck at exit 0 | **inherited, not re-verified** | cubical not registered locally (agda exit 42) |
| IWSAM covers "the majority" of `081KT2T2J...`'s vocabulary | `unmetered` | needs that item's conformance audit |
| Temporal type theory is formalisable in Lean | `unmetered` (author's claim, checked as stated) | Schultz–Spivak state it; nobody here has done it |
| Sheaf gluing ↔ `local-time-never-enters-the-shared-fold` | `unmetered` | a resonance worth checking; no structure supplied |
| "Quasi time crystal" as a type-theoretic object | `toy` | labelled metaphor by its author; no falsifier, none sought |

Per `numerology-vs-number-theory.md`: the last two rows are recorded **as coincidences with their register
stored alongside them**, so neither can silently become a belief.

## 6. Anchors (Beacon — checked, not merely cited)

- **Yallop, J. & White, L.** *Lightweight Higher-Kinded Polymorphism.* FLOPS 2014, LNCS 8475, 119–135. DOI
  `10.1007/978-3-319-07151-0_8`. Checked: abstract type `app` + opaque **brands**, reducing higher-kinded to
  ordinary polymorphism by defunctionalisation. Entails the encoding in §1.3; note the paper's seal relies on
  OCaml module signatures, which is the property F# cannot reproduce (Cost A).
- **The HoTT Book**, *Homotopy Type Theory: Univalent Foundations of Mathematics* (2013); Voevodsky; Awodey.
  **Cohen–Coquand–Huber–Mörtberg**, cubical type theory (univalence that computes).
- **Schultz, P. & Spivak, D. I.** *Temporal Type Theory: A Topos-Theoretic Approach to Systems and Behavior.*
  arXiv:1710.10258; Birkhäuser PCSAL 29, 2019. Checked: behaviour types as **sheaves** over time windows;
  semantics in the topos of sheaves on a translation-invariant quotient of the interval domain; **stated to be
  formalisable in Coq or Lean with added axioms** — which is the §3.1 verdict.
- **Licata, D. R. & Harper, R.** *2-Dimensional Directed Type Theory.* MFPS XXVII, 2011 (ENTCS). Checked:
  interpretation into the 2-category **Cat**; **variance annotations**; directed structure explicit at the
  judgemental level. Entails "asymmetric paths exist as a formalism"; does **not** entail a mature ∞-directed
  theory — that is the frontier (simplicial HoTT / synthetic ∞-categories).
- **Wilczek, F.** *Quantum Time Crystals*, PRL 109, 160401 (2012) — **and its refutation**: Bruno, P.,
  *Comment on "Quantum Time Crystals"*, PRL 110, 118901 (2013); **Watanabe, H. & Oshikawa, M.**, *Absence of
  Quantum Time Crystals*, PRL 114, 251603 (2015), arXiv:1410.2143. What survives: **Floquet/discrete** time
  crystals — Else, Bauer & Nayak, *Floquet Time Crystals*, PRL 117, 090402 (2016); Khemani et al. (2016);
  observed Choi/Monroe (2017), Mi et al./Google (2021). Fibonacci-driven topological time quasicrystal:
  Dumitrescu et al. (2022). Cited **as the borrowed image only** (§4).
- **Wadler, P. & Blott, S.** *How to make ad-hoc polymorphism less ad hoc* (POPL 1989) — the type-class anchor
  already carried by §4a.
- **Goguen & Meseguer** (1982) noninterference; **Snodgrass** (1992) / SQL:2011 bitemporality — both already
  in-repo, and both are the natural neighbours of the temporal-type-theory probe.

## 7. Composes with / does not edit

- `docs/research/2026-07-08-hott-is-the-equality-theory-for-deformed-hkts-*.md` — the existing HoTT frame. This
  doc **extends** it (adds the measured Lean cost, the h-level obstacle, and the temporal/homotopy axis split)
  and does not edit it.
- `docs/research/2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-*.md` §4a — the
  capability ladder. §1.2 above is a **correction** to the assumption that it needs HKT.
- `081KT2T2J0008QG0R0038CRFJM` (P1, open) — the minimal HKT-composing vocabulary; §1.4 proposes splitting its
  execution into an IWSAM half and a brand half.
- `081KX1VE4G808QG0R003DCK3GV` — the cubical lane.
- `081M00SWEDB087G0R003ZRBDCA` / `081M00SW8YJ087G0R002J1WFFE` — the two open time-crystal-naming items; §4.3
  supplies measured evidence for both. Not edited here.
- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — the meta-rule the brand encoding collides
  with (Cost B). `.claude/rules/local-time-never-enters-the-shared-fold.md` — the possible sheaf-gluing
  correspondence (§3.1), recorded as unmetered.

**Sibling-agent overlap, reported not edited:** the *generated-types-as-virtualized-runtime* lane owns type
**materialisation**; this doc owns type **theory**. The boundary is real and touched at exactly one point — §1.3
Cost C, where nested brands make signatures unreadable and `gen/` has to read them. If that lane adopts a
representation for constructor-generic types, it should be the same one chosen here.
