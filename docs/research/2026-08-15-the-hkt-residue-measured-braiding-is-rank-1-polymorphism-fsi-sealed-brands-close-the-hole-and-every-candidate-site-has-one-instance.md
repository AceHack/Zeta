# The HKT residue, measured: braiding is rank-1 polymorphism, `.fsi`-sealed brands close the hole, and every candidate site has exactly one instance

*Shadow, 2026-08-15. Follow-up to
[`2026-08-15-four-strands-separated-…`](2026-08-15-four-strands-separated-hkt-hott-time-deformed-types-quasi-time-crystal-iwsam-beats-brands-lean4-uip-blocks-univalence.md).
That doc proved the §4a algebra ladder is kind `*` and IWSAM handles it. Aaron relocated the question rather
than closing it:*

> *"yeah there is a lot we can do without hkt and simulated hkt using recursive open generics and other generics
> tricks. the HKT is for the ability for ultimate reuse and expression power while keeping geometric intuition
> like clifford algebra and our braided monoidal stuff."*

*So the motivation is the **categorical/geometric** layer, not the algebra ladder. This doc characterises that
residue by measurement. It **corrects two claims from my own previous doc** (§6) — both were inferences I did
not check.*

## 0. Three answers up front

1. **The braided-monoidal and Clifford surfaces are kind `*`, not `* -> *`.** The braiding — the natural
   transformation the residue was supposed to live in — is already expressed in F# as **ordinary rank-1
   parametric polymorphism**. It collapses to kind `*` exactly as the ladder did. `metered`.
2. **The `.fsi` seal closes the soundness hole.** The `Impostor` attack from my previous doc is **rejected at
   compile time** (`FS0887`) once the brand is abstract in a signature file. The verdict narrows from "unsound
   in F#" to "unsound if exported unsealed" — and the sealed variant is also *cheaper*, collapsing N carrier
   classes to one. `metered`.
3. **But every candidate site has exactly one instance, so the residue buys nothing today.** One category, one
   optic kind, one comonad, one functor over the Z-set family. Abstraction over a singleton is free to skip.
   The honest deliverable is therefore a **trigger condition** (§5), not a framework. `metered`.

***

## 1. The residue, measured surface by surface

The premise to test: *"a braiding `β_{A,B} : A ⊗ B -> B ⊗ A` is a natural transformation, i.e. a family indexed
by objects — constructor-generic by construction."*

**Half of that is right and half is wrong, and the split is the finding.** The *indexing over objects* is
constructor-generic only when objects are type **constructors**. In this repo, objects are **types**, so the
family is ordinary rank-1 polymorphism. From `src/Core/Meno.fs`:

```fsharp
type Arrow<'a, 'b when 'a:comparison and 'b:comparison> = MenoArrow of (ZSet<'a> -> ZSet<'b>)
let tensor<'a,'b,'c,'d ...> (MenoArrow f) (MenoArrow g) : Arrow<'a * 'c, 'b * 'd> = ...
let braid<'a, 'b ...> : Arrow<'a * 'b, 'b * 'a> = ...
let associator<'a,'b,'c ...> : Arrow<('a * 'b) * 'c, 'a * ('b * 'c)> = ...
```

- **The monoidal product is a bifunctor** — and it is expressed with the **type-level tuple** as ⊗ on objects.
  `tensor` is an ordinary generic function. Kind `*`.
- **The braiding is a natural transformation** — and `braid<'a,'b>` **is** the object-indexed family. F#'s type
  parameters *are* the indexing. Kind `*`.
- **The associator** likewise.

| surface | shape as written | kind |
|---|---|---|
| `Meno.Arrow<'a,'b>` | rank-1 generic type | `*` |
| `Meno.tensor` | bifunctor via type-level tuple | `*` |
| `Meno.braid<'a,'b>` | **the natural transformation, rank-1** | `*` |
| `Meno.associator` / unitors | rank-1 | `*` |
| `MenoBraided.V = Braid.Word` | monomorphic | ground |
| `MenoBraided.braidR : Arrow<V*V, V*V>` | monomorphic | ground |
| `MenoBraided.Hom = private BraidHom of int list` | monomorphic | ground |
| `Cl3.Mv` | monomorphic | ground |
| `CliffordE8Bridge` (`int[] -> Cl3.Mv`) | monomorphic | ground |
| `OrbitBraid` (`… -> int list`) | monomorphic | ground |
| `MenoMonoidalHexagons.lean` | `{G : Type*} [Group G]` — the concrete category of types | `*` |
| **`MenoBalancedTwist.lean`** | `{C} [Category.{v} C] [MonoidalCategory C] [BraidedCategory C]` | **abstracts over categories — see §2** |

So the whole braided-monoidal / Clifford / E8 surface in F# is kind `*`, and most of it is fully monomorphic.
**The residue collapses a second time.** Notably, even in Lean — where Mathlib's abstract
`CategoryTheory.MonoidalCategory` was available — the hexagon proofs were done **concretely**, over
`Type*` with `[Group G]`.

### 1.1 Where the genuine abstraction-over-categories does live

Exactly one place, and it is already built: `src/Core.Lean4/Lean4/MenoBalancedTwist.lean` proves results for an
**arbitrary** braided monoidal category — `dbl_eq_id_of_symmetric` for any symmetric `D`, `symmetricTwist` for
any symmetric `C`. That is precisely the "ultimate reuse" Aaron is describing, and it exists today.

***

## 2. What HKT would *not* buy — and why the mechanism already in use is stronger

The reuse in §1.1 is **not** achieved with higher-kinded polymorphism. Mathlib's `Category.{v} C` takes objects
as a **`Type`** and bundles the morphisms as a **type family indexed by objects**, `Hom : C → C → Type v`. That
is dependent types, not HKT. The difference is not cosmetic — it is what lets the laws be *stated*:

```lean
structure Twist (C : Type u) [Category.{v} C] [MonoidalCategory C] [BraidedCategory C] where
  θ : ∀ X : C, X ⟶ X
  naturality : ∀ {X Y : C} (f : X ⟶ Y), θ X ≫ f = f ≫ θ Y
  tensor : ∀ X Y : C, θ (X ⊗ Y) = dbl X Y ≫ (θ X ⊗ₘ θ Y)
```

`naturality` is an **equation between morphisms**, universally quantified over objects *and* morphisms. Haskell-
style HKT (`cat :: * -> * -> *`) can carry the *signature* of a braiding; it cannot express that equation, and
neither can any brand encoding in F#. The hexagons, the pentagon, coherence — all of them are propositions about
morphism equality, and all of them need dependent types.

**So the split in what Aaron wants is:**

| what | mechanism that delivers it | where it lives |
|---|---|---|
| reuse of **definitions** across categories | HKT (or dependent types) | would be new F# work |
| reuse of **laws/proofs** across categories | **dependent types only** | **already built, in Lean** |

HKT is strictly weaker than the mechanism already carrying the geometric intuition. That does not make it
worthless — definitional reuse in the *runtime* lane is a real thing HKT and only HKT would give us in F# — but
it does mean "expressive power for the geometric intuition" is not the part HKT supplies. That part is already
in the right lane.

***

## 3. The `.fsi` seal closes the soundness hole — `metered`

My previous doc's `Impostor` counterexample was decisive against a **public interface** brand. The paper's seal
relies on OCaml module signatures; the open question was whether F#'s `.fsi` files reproduce it. **They do**,
with one design change.

First, the direct translation fails informatively — declaring an abstract type in a signature **implies sealed**:

> `error FS0297: The type definitions for type 'App' in the signature and implementation are not compatible
> because the implementation type is not sealed but signature implies it is.`

That rules out an *interface* as the carrier, and points at the fix: make `App` a sealed class over `obj`, so
the brand is abstract and uninhabitable from outside.

```fsharp
// Hkt.fsi — abstract in the signature => SEALED and uninhabitable outside this module
type App<'F, 'T>
type ListBrand
type IFunctor<'F> =
    abstract Map: ('a -> 'b) -> App<'F, 'a> -> App<'F, 'b>
val inj: 'T list -> App<ListBrand, 'T>
val prj: App<ListBrand, 'T> -> 'T list
```

```fsharp
// Hkt.fs
[<Sealed>]
type App<'F, 'T> private (v: obj) =
    member internal _.Value = v
    static member internal Make(v: obj) : App<'F, 'T> = App<'F, 'T>(v)
let inj (xs: 'T list) : App<ListBrand, 'T> = App<ListBrand, 'T>.Make(box xs)
let prj (a: App<ListBrand, 'T>) : 'T list = a.Value :?> 'T list
```

Measured, in a **separate consumer assembly** referencing the library:

- **The attack no longer compiles.** `type Impostor<'T>() = interface App<ListBrand,'T>` →
  `error FS0887: The type 'App<ListBrand,'T>' is not an interface type`. `ATTACK_BUILD_EXIT=1`.
- **The legitimate use still works across the assembly boundary.** The payoff function
  `twice (F: IFunctor<'F>) (fa: App<'F,int>)` compiles in the consumer with 0 warnings and runs: `[2; 4; 6]`,
  `LEGIT_RUN_EXIT=0`.

### 3.1 Revised cost table — two of three costs improve

| cost (previous doc) | sealed-`.fsi` variant |
|---|---|
| **A — brand not closed, `prj` reachable** | **closed** from outside: rejected at compile time |
| **B — mints a class per functor instance** | **collapses to ONE class total** (`App`). The per-instance carriers disappear; `inj` just boxes. So it is one earned class under `interfaces-free-classes-earned-under-rules`, not N |
| **C — nested brands unreadable for 2-param constructors** | unchanged |

That is a materially better verdict than I gave before, and it is a correction to my own recommendation.

### 3.2 Residual costs, stated honestly

- **The `:?>` cast moved, it did not vanish.** Safety is now a *module-internal invariant* (brand ↔ carrier
  correspondence), enforced by review of one file rather than by the type system. External soundness is
  type-enforced; internal soundness is not.
- **`InternalsVisibleTo` reopens it.** `Make` is `internal`; any assembly granted internals access can forge a
  brand. That must be a standing guard if this lands.
- **Boxing.** Every `inj` boxes. This is not free, and it collides with a real optimisation in this codebase:
  `ZSet.map` is declared `inline` with `[<InlineIfLambda>]`. Routing it through `IFunctor.Map` — an interface
  method taking a boxed `App` — forfeits both the inlining and the lambda specialisation. `unmetered`: I did
  not benchmark it; the forfeiture is structural (a virtual call cannot inline a call-site lambda), the
  magnitude is unmeasured.

***

## 4. The profunctor lift: correctly cut, and still not needed

The task was to read why the `NovelMathExt.fs` lift was cut and say whether IWSAM or open generics would have
carried it.

**Would they have carried it? No — and this is the one unambiguous case for HKT in this repo.** Profunctor
optics need a profunctor `p` at kind `* -> * -> *` (`dimap : (a' -> a) -> (b -> b') -> p a b -> p a' b'`), and
the optic type itself is **rank-2**: `Lens s t a b = forall p. Strong p => p a b -> p s t`. IWSAM is kind `*`;
open generics is kind `*`. Neither reaches either requirement. The repo already knew the shape of this — the
2026-06-09 MUMPS/lifetimes doc pairs "brand types + rank-2 (ST) + lightweight HKT" for exactly this reason. So
the cut was correct and unavoidable.

**But what would it buy today? Nothing.** The profunctor encoding's purpose is *uniform composition across optic
kinds*. Checked:

- `src/Core/Optic.fs` — `Lens<'s,'a>` (`Get`/`Set`), plus the `Store` comonad.
- `src/Core/NovelMathExt.fs` — `Lens<'S,'A>` with the **same two fields and the same `over`/`compose`**. This
  is a **plain duplicate**, not an HKT problem: the fix is deletion, not a type-system feature.
- `src/Core/Traversal.fs` — **not an optic.** `Traversal<'r>` is a value-of-information scheduling record
  (`voi`, `worth`, `schedule`, `runScheduled` over CHIP-8 frames). A name collision.
- **No `Prism` anywhere.**

So there is exactly **one** optic kind. A uniform composition operator over one kind is the identity function's
worth of value.

***

## 5. Every candidate site has exactly one instance — and the trigger condition

The same count, run across every place HKT could bite:

| candidate abstraction | kind needed | instances in F# today |
|---|---|---|
| braided monoidal **category** | `* -> * -> *` | **1** (`Meno.Arrow`; `Tracing.Arrow` is a Kleisli-ish alias with no monoidal structure) |
| **optic kind** (Lens/Prism/Traversal) | `* -> * -> *` + rank-2 | **1** (`Lens`, defined twice) |
| **comonad** (`extract`/`extend`) | `* -> *` | **1** (`Optic.Store`) |
| **functor** over the Z-set family | `* -> *` | **1** (`ZSet` only — see §6) |

This is the same result four times. Aaron's own framing already anticipates it — *"there is a lot we can do
without hkt"* — and the measurement says the "lot" is currently everything.

**The value is real but forward-looking, so name the trigger rather than build the framework.** HKT starts
paying the moment **any one** of these becomes 2:

- a **second braided monoidal category** in F# — a Clifford/Spin category or a ZX category as an actual
  `Arrow`-like structure with its own `tensor`/`braid`, rather than the monomorphic `Cl3.Mv` bridge we have;
- a **second optic kind** — a real `Prism`, or an optical traversal;
- **`map`/`flatMap` on a second member** of the Z-set family.

At that point the mechanism is settled by §3: the **`.fsi`-sealed, single-`App` brand**, filed as one earned
class under `rules/`, with `prj` returning `Result<_,_>` and an `InternalsVisibleTo` guard. Until then,
building it would abstract over a singleton and forfeit `InlineIfLambda` for nothing.

**Cheap work that is worth doing now, independent of HKT:** delete one of the two `Lens` definitions, and
rename `Traversal<'r>` (it means value-of-information scheduling, not the optic). Both are ordinary
duplication/naming debt that the HKT question surfaced but does not own.

***

## 6. Corrections to my own previous doc

Two claims in
[`2026-08-15-four-strands-separated-…`](2026-08-15-four-strands-separated-hkt-hott-time-deformed-types-quasi-time-crystal-iwsam-beats-brands-lean4-uip-blocks-univalence.md)
were inferences I did not check. Both are wrong.

1. **"Brands reserved for the genuinely constructor-generic residue — `map`/`traverse` over the Z-set
   family."** I measured the kind-`*` duplication (`empty`, `singleton`, `ofSeq`, `add`, `count`, `isEmpty`
   across four modules) and then *assumed* the `* -> *` layer was duplicated the same way. It is not:
   **only `ZSet` has `map`/`filter`/`flatMap`; `GSet`, `Bag`, and `IndexedZSet` have none.** There is one
   functor instance, so there is no duplication for HKT to remove. The residue I named does not exist.
2. **"Cost B — it mints a class per functor instance."** True of the literal Yallop–White transliteration I
   tested; **false of the sealed variant** (§3.1), which has one `App` class in total. I generalised from the
   one encoding I had built.

Both are the same error: measuring one thing and inferring the neighbouring thing. Recorded here rather than
edited into the previous doc, so the reviewed text stays as reviewed.

***

## 7. Claims ledger

| Claim | Register | Evidence |
|---|---|---|
| `Meno.braid<'a,'b>` expresses the natural transformation at rank-1, kind `*` | `metered` | the signature, `src/Core/Meno.fs:74` |
| The F# Clifford / braided / E8 surface is kind `*` or monomorphic throughout | `metered` | signature survey, §1 table |
| The Lean hexagon proofs are concrete (`Type*` + `[Group G]`), not over an abstract category | `metered` | `MenoMonoidalHexagons.lean` |
| Abstraction over categories exists once, in Lean, via dependent types (`Hom : C → C → Type v`) | `metered` | `MenoBalancedTwist.lean:78`, `Twist.naturality` |
| HKT cannot state naturality / the hexagons; dependent types can | `metered` (structural) | the `Twist` structure quantifies over morphisms |
| An `.fsi`-abstract brand is sealed; the `Impostor` attack fails to compile | `metered` | `FS0887`, `ATTACK_BUILD_EXIT=1` |
| The sealed variant works cross-assembly | `metered` | consumer project, 0 warnings, `[2; 4; 6]`, exit 0 |
| Sealed variant collapses N carrier classes to one | `metered` | the encoding in §3 has one class |
| Only `ZSet` has `map`/`filter`/`flatMap` in the Z-set family | `metered` | per-module grep |
| Exactly one optic kind; the second `Lens` is a plain duplicate; `Traversal<'r>` is not an optic | `metered` | `Optic.fs`, `NovelMathExt.fs`, `Traversal.fs` |
| Profunctor optics need `* -> * -> *` **and** rank-2; IWSAM/open generics reach neither | `metered` (structural) | the `dimap` / `forall p.` signatures |
| Boxing through `App` forfeits `ZSet.map`'s `inline` + `InlineIfLambda` | `unmetered` | forfeiture is structural; magnitude unbenchmarked |
| HKT pays once any candidate site reaches 2 instances | `unmetered` | a prediction with a stated trigger, not a measurement |

## 8. Anchors (checked)

- **Yallop, J. & White, L.**, *Lightweight Higher-Kinded Polymorphism*, FLOPS 2014, LNCS 8475, 119–135 — the
  brand/`app` encoding. §3 confirms the paper's **module-signature seal** is reproducible in F# via `.fsi`,
  which was the open question.
- **Boisseau, G. & Gibbons, J.**, *What You Needa Know about Yoneda: Profunctor Optics and the Yoneda Lemma*
  (ICFP 2018), and **Pickering, Gibbons & Wu**, *Profunctor Optics: Modular Data Accessors* — both already
  cited in `NovelMathExt.fs` / `Optic.fs`. Checked: the rank-2 `forall p. Strong p =>` representation is the
  paper's, and is what F# cannot express.
- **Joyal & Street**, *Braided tensor categories* (1993) — the hexagons; already the repo's anchor in
  `MenoBraided.fs`.
- **Mac Lane** — coherence; **Fox 1976** (cartesian ⟺ natural comonoid), **Artin 1925** (faithfulness),
  **Garside 1969** (Δ²) — all in place in `MenoBraided.fs` and not disturbed here.
- **Mathlib `CategoryTheory`** — the bundled `Category`/`MonoidalCategory`/`BraidedCategory` classes; checked
  that objects are a `Type` and morphisms a `Hom : C → C → Type v` family (dependent), not a `* -> * -> *`
  constructor.

## 9. Composes with

- The previous doc (extended, not edited — see §6 for the two corrections).
- `081KT2T2J0008QG0R0038CRFJM` — the minimal HKT-composing vocabulary. §5 supplies the trigger condition its
  acceptance criterion #1 (the conformance audit) should record against.
- `081KYWEM90908QG0R002NHEMZE` — the open FsCheck hexagon suite on the F# side; §1 is relevant to it, since the
  F# statement of the hexagons will be rank-1, not constructor-generic.
- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — the sealed variant needs **one** earned class,
  not N (§3.1).
- Sibling lane *generated-types-as-virtualized-runtime*: §3 settles the representation question in its favour —
  if constructor-generic types are ever needed, the `.fsi`-sealed single-`App` form is the one to share.
