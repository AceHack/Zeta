# Computer algebra systems already solved the law-losing tower — FriCAS *branches* the lattice, Sage *withholds* an axiom

**Date:** 2026-09-11 · **Register:** marked per claim · **Origin:** Aaron —
*"can we look up CAS (computer algebra systems) from calculators and try to see what humans
think about this, or is that system too simple?"* · **Work item:** `081M29N1AX9087G0R001GSJD6G`

---

## Verdict, first paragraph

**Aaron's prior is right in both halves, and the split is sharper than expected.** Pocket
calculator CAS is too simple — the structural question does not arise there at all, because a
TI-89 or HP-50g models *expressions and polynomials over a field*, never *a structure with
laws* (§7). But **research CAS is not merely relevant prior art; at least three independent
systems have already solved Zeta's exact problem, and two of them ship the solution in library
code.** FriCAS (Axiom's living descendant) has an `Octonion` domain whose category sits on a
**deliberately separate branch** from the associative one; Sage has an axiom mechanism that lets
its octonion algebra **add unitality while withholding associativity in the same expression**;
GAP defines `IsGroup` as literally `IsMagmaWithInverses and IsAssociative` — capability
conjoined with law. Worth reading in that order. **And the refutation half is just as
important: none of them checks its laws in the type system.** FriCAS carries associativity of
`*` in a `++` comment; Sage's own documentation says an axiom's semantics are *"specified in
the documentation"*. Both arrived at the same disclosure `IStarRing.cs` already makes — *"law
profile carried as documentation, not types"* — and then each paid for it with a **shipped
runtime falsifier**. That last move is the transferable part, and it is the part Zeta is
missing.

---

## 1. Method, and how to read the register marks

Every load-bearing identifier below was read from **primary source** — the `.spad`, `.gd`,
`.gi`, `.py` and `.pyx` files themselves, fetched from the projects' own repositories — not
from documentation summaries and not from memory. Claims are marked:

- **STRUCTURAL** — verified by reading the defining source, quoted here verbatim.
- **REPORTED** — from secondary sources (docs, papers, search results); not read in source.
- **UNKNOWN** — not established. Written as UNKNOWN rather than guessed.

Per [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md), anchors
below are *checked*, not merely cited: each names the file the claim was read from.

**One probe needed a control and got one.** Absence claims below (no `Sedenion`, no
`AlternativeAlgebra`) rest on HTTP 404 from the FriCAS API index. A 404 probe cannot
distinguish *absent* from *base URL broken*, so the control was run: `OctonionCategory`,
`NonAssociativeRing`, `QuaternionCategory`, `Algebra` → **HTTP 200**; `Sedenion`,
`SedenionCategory`, `AlternativeAlgebra`, `JordanAlgebra`, and the deliberate nonsense
`NotARealName` → **HTTP 404**. The probe discriminates.

---

## 2. The comparison table

| System | How a structure is represented | How LAWS are represented | Laws checked / asserted / documented | Structure that LOSES a law going "up" |
|---|---|---|---|---|
| **FriCAS / Axiom** | `Category` (specification) + `Domain` (implementation); categories composed by `Join` | Two mechanisms: **nullary marker categories** (`unitsKnown`) that *are* in the type system, and `++` prose for the big laws | **Documented** in `++` comments; **separately computed** at runtime by `associative?()`, `alternative?()`, … | **The lattice BRANCHES.** `Algebra` (associative) and `NonAssociativeAlgebra` are siblings over a shared parent — §3 |
| **SageMath** | `Category` objects; `Parent` declares its category at construction | **Axioms** — composable, commuting operators on categories (`.Associative()`, `.Unital()`) | **Asserted** by the implementer — *"semantic … specified in the documentation"*; checked by a **sampled** `_test_associativity` in `TestSuite` | **Withhold the axiom.** The octonion algebra applies `.Unital()` and simply never applies `.Associative()` — §4 |
| **GAP** | **Categories** (filters fixed at creation, not computable) | **Properties** (computable, discovered) — a separate kind of filter | **Computed** — `IsAssociative` enumerates all triples | `IsGroup := IsMagmaWithInverses and IsAssociative` — capability ∧ law, conjoined — §5 |
| **Magma (the CAS)** | "Magma" = algebraic structure is *the* primitive; design from universal algebra + category theory | REPORTED — structure-as-type gives strong typing; law representation not read in source | UNKNOWN (source is closed) | UNKNOWN |
| **Maple `Domains`** | Domains are functions returning **tables of operations** | Hierarchy by inclusion (field ⊂ Euclidean ⊂ UFD ⊂ integral domain ⊂ ring) | REPORTED — no law-checking mechanism found | UNKNOWN; the published hierarchy is the *commutative* tower, which never loses a law |
| **Mathematica** | No algebraic type system — term rewriting over expressions | Laws are **rewrite rules**, not properties of a structure | Neither; rules fire or don't | **Does not arise** — the contrast case, §6 |
| **TI-89 / HP-50g / ClassPad** | Expressions and polynomials over ℝ/ℂ/ℚ | None | None | **Does not arise** — §7 |

---

## 3. FriCAS: the branch point, verbatim

This is the direct hit, and it is better than "someone solved this" — the solution is
**thirty-five years old** and sits in a file you can read today.

### 3.1 `OctonionCategory` exists, and its ancestry is the answer

STRUCTURAL, from `src/algebra/oct.spad`, authored **R. Wisbauer, J. Grabmeier, 05 September
1990**:

```spad
)abbrev category OC OctonionCategory
++  OctonionCategory gives the categorical frame for the
++  octonions, an eight-dimensional non-associative algebra,
++  doubling the quaternions in the same way as doubling
++  the Complex numbers to get the quaternions.
OctonionCategory(R : CommutativeRing) : Category ==
  Join(FramedNonAssociativeAlgebra(R), NonAssociativeRing,
       FullyRetractableTo(R), FullyEvalableOver(R)) with
```

And the domain is Cayley–Dickson doubling, literally — STRUCTURAL, same file:

```spad
Octonion(R : CommutativeRing) : Export == Impl where
  QR ==> Quaternion R
  ...
    octon : (QR, QR) -> %
      ++ octon(qe, qE) constructs an octonion from two quaternions
      ++ using the relation {\em O = Q + QE}.
  Impl ==> add
    Rep := Record(e : QR, E : QR)
```

Same construction as Zeta's tower. The interesting part is what happens to the *category*.

### 3.2 The branch: ℍ stays on `Algebra`, 𝕆 leaves it

STRUCTURAL, from `src/algebra/quat.spad`:

```spad
QuaternionCategory(R : CommutativeRing) : Category ==
  Join(Algebra R, FullyRetractableTo R, DifferentialExtension R, ...)
```

STRUCTURAL, from `src/algebra/catdef.spad` — and this line is the whole answer:

```spad
++ The category of associative algebras (modules which are themselves rings).
Algebra(R : CommutativeRing) : Category ==
  Join(Ring, NonAssociativeAlgebra(R)) with
```

**Read that carefully. `Algebra` — the associative one — is defined as `NonAssociativeAlgebra`
PLUS `Ring`.** The associative structure is the *descendant*; the non-associative one is the
*more general ancestor*. So the ℍ→𝕆 step is not a rung added to a chain and it is not a
capability lost. **𝕆 sits closer to the root than ℍ does.**

The same inversion, one level down — STRUCTURAL, `catdef.spad` and `naalgc.spad`:

```spad
Ring() : Category == Join(Rng, SemiRing, NonAssociativeRing, unitsKnown)
Rng()  : Category == Join(NonAssociativeRng, SemiRng) with ...
SemiRng() : Category == Join(NonAssociativeSemiRng, BiModule(%, %), SemiGroup)
NonAssociativeRing() : Category == Join(NonAssociativeRng, NonAssociativeSemiRing) with ...
NonAssociativeRng()  : Category == Join(NonAssociativeSemiRng, AbelianGroup) with
    associator : (%, %, %) -> %
      ++ associator(a, b, c) returns \spad{(a*b)*c-a*(b*c)}.
```

So `Ring` **extends** `NonAssociativeRing`, and the extra thing it brings — via `SemiRng` —
is `SemiGroup`, which is exactly where associativity lives.

**This is the structural answer to Zeta's problem.** The two arrows Zeta drew as opposed:

```
ISemiring ⊂ IRing ⊂ IStarRing     capability ADDED going up
ℝ → ℂ → ℍ → 𝕆 → 𝕊                 laws LOST going up
```

are not opposed in FriCAS, because **the second one is not an ascent.** In the FriCAS lattice
ℝ, ℂ, ℍ are *deeper* (more constrained), and 𝕆 is *shallower*. Losing a law is **moving toward
the root**, which a subtyping lattice expresses natively. The chain only looked
inexpressible because it was drawn upside down.

### 3.3 The honest half: FriCAS does NOT check the big laws in types

STRUCTURAL, `catdef.spad` — and this is the finding that stops this from being a triumphal
report:

```spad
++ the class of all multiplicative semigroups, i.e. a set
++ with an associative operation \spadop{*}.
++
++ Axioms:
++    \spad{associative("*":(%,%)->%)}\tab{30}\spad{ (x*y)*z = x*(y*z)}
SemiGroup() : Category == Magma
```

**`SemiGroup` is defined as *exactly* `Magma`.** Not `Magma with` anything — identical. The
entire difference between "has a binary operation" and "has an associative binary operation"
is the name of the category and a `++` comment. The compiler cannot tell them apart.

That is the *same disclosure* `IStarRing.cs` makes — *"law profile carried as documentation,
not types"* — reached independently, in a purpose-built algebraic type system, by people who
had every incentive to do better. **It is strong evidence that this is a hard boundary, not a
Zeta oversight.**

### 3.4 What FriCAS does instead — and it is what Zeta measured this session

STRUCTURAL, `naalgc.spad`, declared in `FiniteRankNonAssociativeAlgebra`:

```spad
    commutative? : ()-> Boolean
    associative? : ()-> Boolean
    antiAssociative? : ()-> Boolean
    leftAlternative? : ()-> Boolean
    rightAlternative? : ()-> Boolean
    flexible? : ()->  Boolean
    alternative? : ()-> Boolean
    powerAssociative? : ()-> Boolean
    jacobiIdentity? : () -> Boolean
    lieAdmissible? : () -> Boolean
    jordanAdmissible? : () -> Boolean
    noncommutativeJordanAlgebra? : () -> Boolean
    jordanAlgebra? : () -> Boolean
    lieAlgebra? : () -> Boolean
```

Laws are **queryable predicates on the domain**, at runtime, per algebra. And the default
implementations are exhaustive checks over a basis — STRUCTURAL, same file:

```spad
    associative?() ==
      b := someBasis()
      n := rank()
      for i in 1..n repeat
       for j in 1..n repeat
        for k in 1..n repeat
         not zero? associator(b.i, b.j, b.k) =>
```

**This is the falsifier Zeta ran this session.** The measurement recorded in
`081M29N1AX9087G0R001GSJD6G` — refuting associativity by enumerating octonion basis triples
and finding a nonzero associator — is, line for line, FriCAS's shipped default implementation
of `associative?()`. Zeta independently rebuilt a 1991 library function. *(Zeta measured 343 =
7³ triples, i.e. over the imaginary units; FriCAS iterates `rank()³` = 8³ = 512, i.e. over the
full basis including 1. Same predicate, different basis convention — noted so the numbers are
not mistaken for a discrepancy.)*

Note also `leftAlternative?`'s own honest caveat, which is a register mark in 1991 source:

```spad
      ++ Note: we only can test this; in general we don't know
      ++ whether \spad{2*a=0} implies \spad{a=0}.
```

### 3.5 `unitsKnown` — the one mechanism that IS in the type system

STRUCTURAL: `Ring() : Category == Join(Rng, SemiRing, NonAssociativeRing, unitsKnown)` and
`Group() : Category == Join(Monoid, TwoSidedRecip, unitsKnown)`. REPORTED (FriCAS API page,
not read in source): `unitsKnown` is a **category** describing monoids where `recip` returns
`"failed"` only for genuine non-units.

So `unitsKnown` is a **nullary marker category** — no operations, joined in purely as a
type-level tag, testable with FriCAS's `has`. **This is the transferable mechanism** (§8): the
one law-ish fact FriCAS puts in the type system, it puts there as a contentless marker in a
`Join`, not as a member on an interface.

### 3.6 What FriCAS does NOT have

STRUCTURAL (404 probe, controlled per §1): **no `Sedenion` domain, no `SedenionCategory`, no
`AlternativeAlgebra` category, no `JordanAlgebra` category** in the published API index.
`jordanAlgebra?` exists as a *predicate*; there is no category for it.

This matters for Zeta directly. FriCAS's tower **stops at 𝕆**. Zeta's problem statement reaches
𝕊, where the loss is not associativity but **zero divisors** (84 sedenion pairs measured), and
FriCAS offers no worked answer there. The `noZeroDivisors` attribute is mentioned in
`NonAssociativeRng`'s `++` comments as a "Common Additional Axiom", so the vocabulary exists —
whether it is a marker category like `unitsKnown` is **UNKNOWN** (not read in source).

---

## 4. Sage: the cleanest existing answer, and it is one line

Sage's mechanism is **literally named** for this problem, and its octonion algebra is the
worked example.

STRUCTURAL, from `src/sage/algebras/octonion_algebra.pyx`:

```python
from sage.categories.magmatic_algebras import MagmaticAlgebras
...
cat = MagmaticAlgebras(R.category()).Unital().WithBasis().FiniteDimensional()
```

STRUCTURAL, from `src/sage/categories/magmatic_algebras.py`:

```python
r"""
Non-unital non-associative algebras
"""
class MagmaticAlgebras(Category_over_base_ring):
    """
    An algebra over a ring `R` is a module over `R` endowed with a
    bilinear multiplication.
    ...
        :class:`MagmaticAlgebras` will eventually replace the current
        :class:`Algebras` for consistency with
        e.g. :wikipedia:`Algebras` which assumes neither associativity
        nor the existence of a unit
    """
    Associative = LazyImport('sage.categories.associative_algebras', 'AssociativeAlgebras', ...)
```

**Read the octonion line against that class.** The base category assumes *neither*
associativity *nor* a unit. The octonion algebra then adds back `Unital`, `WithBasis`,
`FiniteDimensional` — and **conspicuously never calls `.Associative()`**, which is sitting
right there as an available axiom.

That is exactly the expressiveness Zeta needs: **capabilities and laws are an orthogonal,
independently-composable set, not rungs on one chain.** Axioms commute (`Magmas().Associative().Unital()`
== `Magmas().Unital().Associative()`, REPORTED from Sage's docs), so there is no ordering to
get wrong and no single inheritance chain to contradict.

### 4.1 But Sage does not check them either

STRUCTURAL, verbatim from `src/sage/categories/category_with_axiom.py`:

> We say that an axiom ``A`` is *defined by* a category ``Cs()`` if ``Cs`` defines an
> appropriate method ``Cs.SubcategoryMethods.A``, **with the semantic of the axiom specified in
> the documentation**; for any subcategory ``Ds()``, ``Ds().A()`` models the subcategory of the
> objects of ``Ds()`` satisfying ``A``.

*"Specified in the documentation."* Sage's axiom system — the most sophisticated one
surveyed — carries axiom semantics **in prose**, precisely as `IStarRing.cs` does. Three
independent systems, same boundary.

### 4.2 And Sage pays for it with a falsifier — this is the move to copy

STRUCTURAL, from `src/sage/categories/semigroups.py`:

```python
        def _test_associativity(self, **options):
            r"""
            Test associativity for (not necessarily all) elements of this
            semigroup.
            ...
            By default, this method tests only the elements returned by
            ``self.some_elements()``
            """
```

Every category that declares an axiom ships a `_test_` method run by `TestSuite(x).run()`.
**Declare the law in the type; falsify it in the test suite.** Note the honesty in the
docstring — *"not necessarily all elements"* — a sampled falsifier, named as sampled.

### 4.3 Sage's limitation, and it is Zeta's exact gap

STRUCTURAL, from `all_axioms` in `category_with_axiom.py`: the roster is
`"Flying", "Blue", "Compact", "Differentiable", "Smooth", "Analytic", "AlmostComplex",
"FinitelyGeneratedAsMagma", "WellGenerated", "Bounded", "Facade", "Finite", "Infinite",
"Enumerated", "Complete", "Nilpotent", "FiniteDimensional", "FinitelyPresented", "Connected",
"FinitelyGeneratedAsLambdaBracketAlgebra", "WithBasis", "Irreducible", "Supercommutative",
"Supercocommutative", "Commutative", "Cocommutative", "Associative", "Inverse", "Unital",
"Division", "NoZeroDivisors", "Cellular", "AdditiveCommutative", "AdditiveAssociative",
"AdditiveInverse", "AdditiveUnital", "Extremal", "Trim", "Semidistributive",
"CongruenceUniform", "ChainGraded", "Distributive", "Stone", "Endset", "Pointed", "Stratified"`.

**There is no `Alternative` axiom** (grep for `"Alternative"` in that file: **0** hits). So Sage
can say 𝕆 is *not associative*; it **cannot say 𝕆 is alternative**. The positive law that
actually distinguishes 𝕆 from 𝕊 is inexpressible in Sage's axiom vocabulary.

`NoZeroDivisors` **is** in the roster — so the ℍ/𝕆 → 𝕊 step (losing zero-divisor-freeness) is
expressible in Sage even though the 𝕆 step is not. That is a genuinely useful asymmetry for
Zeta: of the two law-losses in the tower, **the sedenion one has an existing axiom name and the
octonion one does not.**

---

## 5. GAP: the capability/law split made literal

GAP's distinction is the cleanest *conceptual* framing found, and it maps onto Zeta's problem
without translation.

STRUCTURAL, from `lib/magma.gd`:

```gap
DeclareProperty( "IsAssociative", IsCollection );
```

STRUCTURAL, from `lib/grp.gd`:

```gap
DeclareSynonym( "IsGroup", IsMagmaWithInverses and IsAssociative );
```

**A group is a capability (`IsMagmaWithInverses`) conjoined with a law (`IsAssociative`).**
Not a subclass — a conjunction of two independent filters.

The kinds are deliberately different (REPORTED, from GAP's reference manual ch. 13):
**categories** are filters whose values *cannot be computed* and are fixed at object creation;
**properties** are filters whose values *can be computed* and discovered later. That is
precisely the capability-vs-law axis: *what it is made of* is fixed at construction, *what
laws it satisfies* is discoverable.

And GAP computes it — STRUCTURAL, from `lib/magma.gi`:

```gap
InstallMethod( IsAssociative,
    "for a collection",
    [ IsCollection ],
    function( M )
    ...
    # Test associativity for all triples of elements.
    elms:= Enumerator( M );
    for i in elms do
      for j in elms do
        for k in elms do
          if ( i * j ) * k <> i * ( j * k ) then
            return false;
```

**Two independent systems, FriCAS and GAP, both compute associativity by exhaustive triple
enumeration.** Neither tries to put it in the type system. Under
[`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md)
§"meters must be permitted to be plural" — this is two meters agreeing on the *mechanism*, which
is a stronger signal than either alone.

---

## 6. The contrast case: Mathematica

REPORTED. Mathematica's evaluator is a term-rewriting system over expressions; the Wolfram
Language has no algebraic type hierarchy in the Axiom sense. Laws are not properties a
structure carries — they are **rewrite rules that fire or don't**. The question "how do you
express a structure that loses a law" does not arise, because there is no structure to attach
the law to.

Worth stating because it shows the problem Zeta has is **a cost of having a type system at
all.** Mathematica avoids it entirely and pays elsewhere (no static guarantee that `Mul` means
anything in particular). The choice is not "solve it or be sloppy"; it is a real tradeoff, and
the typed systems chose the branch-and-falsify answer.

Maxima, Singular, Macsyma: not surveyed in depth. **UNKNOWN.**

---

## 7. Aaron's literal question: the pocket calculators

**Too simple — and the honest form of "too simple" is that the question does not arise.**

REPORTED (vendor documentation and secondary sources; no source access):

- **TI-89 / TI-92 / Voyage 200** — symbolic differentiation and integration, limits (including
  one-sided and infinite), solving equations in terms of variables, polynomial manipulation.
- **HP-50g** — the above plus symbolic integration via the **Risch algorithm**, integration by
  parts, Fourier expansion, Laplace transform, Sturm sequences, Horner scheme, Lagrange
  interpolation, GCD/LCM, and **Gröbner bases**.
- **Casio ClassPad** — comparable symbolic algebra and calculus. **UNKNOWN** in detail.

Note the HP-50g is not trivial — Gröbner bases and Risch are serious algorithms. But every one
of those capabilities operates on **polynomials and expressions over a field** (ℚ, ℝ, ℂ, with
modular arithmetic available). **There is no user-facing notion of an algebraic structure, no
way to declare a ring and give it laws, and therefore nothing that can lose one.** A pocket CAS
is a very good *calculator over one fixed structure*; the structural-algebra question is
categorically outside it.

So the honest answer to Aaron is: **the calculators are too simple, and that is not a failure
of the search — it is the correct finding, and the reason to look one tier up.** The tier up is
where the answer was, and it had been there since 1990.

---

## 8. What transfers to F#/C#, and what does not

This is the section that keeps "someone solved this" from being mistaken for "we can use their
solution."

### 8.1 Does NOT transfer

- **FriCAS's compile-time category checking.** SPAD's compiler checks domain-satisfies-category
  and resolves by a category lattice with `Join` and conditional membership
  (`if R has OrderedSet then OrderedSet`). **F# and C# have no equivalent.** A design that
  depends on the compiler verifying lattice membership with conditional clauses is not
  importable. Conditional category membership in particular has **no C# analogue at all** —
  an interface implementation cannot be predicated on a type argument's own capabilities.
- **Sage's axiom algebra.** `.Associative()` is a *runtime operator on category objects* in a
  dynamic language, with a memoized lattice built at import time. .NET interfaces are static
  and cannot be constructed by composing axiom names. **The mechanism does not port; only the
  shape does.**
- **GAP's discovered properties.** GAP stores computed property values back onto the object and
  uses them for method dispatch. .NET has no dispatch-on-discovered-property.
- **Anything for 𝕊.** No surveyed system models sedenions (§3.6). Zeta is past the prior art
  at the top of its own tower and should stop expecting to find the answer pre-made.

### 8.2 DOES transfer — three things, in order of confidence

**(a) Invert the drawing. The lattice branches, and it branches downward.** STRUCTURAL from
§3.2: `Algebra = Join(Ring, NonAssociativeAlgebra)`. Losing a law is *moving toward the root*,
which subtyping expresses natively. Zeta's "opposite directions, so single-chain inheritance
cannot express it" is true of the chain **as drawn** and dissolves when 𝕆 is placed *below* ℍ
rather than above it. This is a **free** insight — it costs no new mechanism, only redrawing.

**(b) Nullary marker interfaces, joined — FriCAS's `unitsKnown` (§3.5) and GAP's
`IsGroup = IsMagmaWithInverses and IsAssociative` (§5).** C# supports multiple interface
inheritance, so a law can be a members-free marker:

- `IStarRing<T>` stays the capability floor (unchanged — Add/Mul/Zero/One/Negate/Conj).
- Laws become separate empty markers: an associativity marker, an alternativity marker, a
  no-zero-divisors marker.
- ℍ's type implements the capability interface **and** the associativity marker; 𝕆 implements
  the capability interface and the alternativity marker **but not** associativity; 𝕊 implements
  neither law marker.
- A consumer needing associative `Mul` constrains on the marker, and misuse becomes a
  **compile error** — which is the outcome `IRing.cs` already achieved once for retraction over
  tropical semirings (`081KWG9JQ9H`), by the same move.

This directly addresses the measured defect: `IRing<Sedenion>` compiling with zero objection.
It would still compile — correctly, because 𝕊 *is* a ring-shaped dictionary of operations — but
the matrix-contraction consumer that needs associativity would stop compiling against it.

**The honest limit, stated plainly:** a marker interface is **asserted, never checked**. Nothing
stops someone implementing the associativity marker on 𝕊. That is exactly FriCAS's
`SemiGroup == Magma` (§3.3) and Sage's *"specified in the documentation"* (§4.1). **The marker
does not verify the law; it makes the claim explicit, located, and greppable** — which is
strictly better than a paragraph of `///` prose, and strictly weaker than proof.

**(c) The shipped falsifier — and this is the part with real teeth.** All three systems pair
the unchecked declaration with a runtime check they ship: FriCAS `associative?()`, GAP
`IsAssociative`, Sage `_test_associativity`. Under
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md),
a marker interface with no falsifier is **unmetered** — an assertion that cannot fail, which is
the vacuity class. A marker interface *with* a test that enumerates basis triples and fails when
the marker is wrongly applied is **metered**.

Zeta has already built the measurement (§3.4 — that is what
`081M29N1AX9087G0R001GSJD6G` measured). **It is currently a finding in a work item rather than a
standing test.** The cheapest real improvement available is to make it a test that fails if the
associativity marker is ever applied to a type whose basis triples refute it — turning a
one-time measurement into the falsifier that earns the marker.

---

## 9. Register summary

| Claim | Register | Evidence |
|---|---|---|
| FriCAS has `OctonionCategory` and an `Octonion` domain | **STRUCTURAL** | `src/algebra/oct.spad`, quoted §3.1 |
| `OctonionCategory` joins `FramedNonAssociativeAlgebra` + `NonAssociativeRing` | **STRUCTURAL** | `oct.spad`, quoted |
| `QuaternionCategory` joins `Algebra R` (the associative branch) | **STRUCTURAL** | `quat.spad`, quoted |
| `Algebra = Join(Ring, NonAssociativeAlgebra)` — associative is the descendant | **STRUCTURAL** | `catdef.spad`, quoted §3.2 |
| `Ring = Join(Rng, SemiRing, NonAssociativeRing, unitsKnown)` | **STRUCTURAL** | `catdef.spad`, quoted |
| `SemiGroup() : Category == Magma` — associativity is a comment only | **STRUCTURAL** | `catdef.spad`, quoted §3.3 |
| FriCAS declares 14 law predicates incl. `alternative?`, `flexible?` | **STRUCTURAL** | `naalgc.spad`, quoted §3.4 |
| `associative?()` is computed by exhaustive associator check over a basis | **STRUCTURAL** | `naalgc.spad`, quoted |
| `unitsKnown` is a category used as a marker in `Join` | **STRUCTURAL** (usage) | `catdef.spad` lines for `Ring`, `Group` |
| `unitsKnown`'s own definition/description | **REPORTED** | FriCAS API page; not read in source |
| No `Sedenion`/`AlternativeAlgebra`/`JordanAlgebra` in FriCAS API index | **STRUCTURAL** | Controlled 404 probe, §1 |
| Whether `noZeroDivisors` is a marker category in FriCAS | **UNKNOWN** | Named in `++` comments only |
| Sage octonion declares `MagmaticAlgebras(...).Unital().WithBasis().FiniteDimensional()` | **STRUCTURAL** | `octonion_algebra.pyx`, quoted §4 |
| `MagmaticAlgebras` assumes neither associativity nor a unit | **STRUCTURAL** | `magmatic_algebras.py`, quoted |
| Sage axiom semantics are "specified in the documentation" | **STRUCTURAL** | `category_with_axiom.py`, quoted §4.1 |
| Sage ships `_test_associativity` (sampled) | **STRUCTURAL** | `semigroups.py`, quoted §4.2 |
| Sage has no `Alternative` axiom; has `NoZeroDivisors` | **STRUCTURAL** | `all_axioms`, quoted §4.3 |
| Sage axioms commute | **REPORTED** | Sage docs; not verified in source |
| `IsGroup := IsMagmaWithInverses and IsAssociative` | **STRUCTURAL** | `lib/grp.gd`, quoted §5 |
| `IsAssociative` is a Property, computed by triple enumeration | **STRUCTURAL** | `lib/magma.gd`, `lib/magma.gi`, quoted |
| GAP category-vs-property = uncomputable-at-creation vs computable | **REPORTED** | GAP ref manual ch. 13 |
| Magma (CAS) design rests on universal algebra + category theory | **REPORTED** | Bosma & Cannon; source closed |
| Magma's law representation | **UNKNOWN** | Closed source |
| Maple `Domains` = tables of operations, inclusion hierarchy | **REPORTED** | Maple help + Monagan papers |
| Mathematica has no algebraic type hierarchy | **REPORTED** | Secondary sources |
| TI-89/HP-50g capabilities as listed | **REPORTED** | Vendor docs, secondary sources |
| Casio ClassPad specifics | **UNKNOWN** | Not investigated |
| Maxima / Singular / Macsyma | **UNKNOWN** | Not surveyed |

---

## 10. Beacon anchors

New to this document; §11 adds them to `docs/PRIOR-ART-LIST.md`.

- **Richard D. Jenks & Robert S. Sutor — *Axiom: The Scientific Computation System*,
  Springer-Verlag, 1992.** The canonical statement of the two-level **category / domain**
  design: categories are specifications, domains are implementations, and domain *constructors*
  build domains from domains. Zeta's `IStarRing`-as-specification vs per-tower implementation is
  this design, reinvented. Predecessor system: **Scratchpad II**, IBM T.J. Watson, from 1977
  under Jenks (REPORTED); design also credited to **James H. Davenport**, **Barry M. Trager**,
  **David Y.Y. Yun**, **Victor S. Miller** (REPORTED).
- **Johannes Grabmeier & Robert Wisbauer** — authors of FriCAS/Axiom's `Magma`,
  `MagmaWithUnit`, `NonAssociativeRng`, `NonAssociativeRing`, `NonAssociativeAlgebra`,
  `FiniteRankNonAssociativeAlgebra`, `OctonionCategory` (STRUCTURAL — named in the `++ Author:`
  headers of `naalgc.spad` and `oct.spad`, dated 01 March 1991 and 05 September 1990). **These
  are the humans who solved Zeta's problem**, and they are uncited in this repo until now.
- **Waldek Hebisch** — author of `NonAssociativeSemiRng`, `NonAssociativeSemiRing`, `SemiRng`,
  `SemiRing` (STRUCTURAL, `++ Author:` headers). The semiring layer Zeta's `ISemiring` mirrors.
- **Richard D. Schafer — *An Introduction to Nonassociative Algebras*, Academic Press, New
  York, 1966.** Cited in the `++ Reference:` headers of `NonAssociativeRng`,
  `NonAssociativeRing`, `NonAssociativeAlgebra`, `FiniteRankNonAssociativeAlgebra` — the
  mathematical anchor FriCAS itself declares for these categories (STRUCTURAL).
- **Nathan Jacobson — *Structure and Representations of Jordan Algebras*, AMS, Providence,
  1968.** Cited in the `++ Reference:` headers of `Magma` and `MagmaWithUnit` (STRUCTURAL).
- **I. L. Kantor & A. S. Solodovnikov — *Hypercomplex Numbers*, Springer-Verlag Heidelberg,
  1989, ISBN 0-387-96980-2.** Cited in `OctonionCategory`'s own `++ References:` header
  (STRUCTURAL). The Cayley–Dickson anchor FriCAS chose.
- **Nicolas M. Thiéry et al. — Sage's category-with-axiom framework.** The `all_axioms`
  mechanism; the design note *"blames go to me (Nicolas) for originally comparing categories by
  amount of structure rather than by inclusion"* is STRUCTURAL from
  `category_with_axiom.py` — and is itself a recorded instance of the same drawing error
  diagnosed in §8.2(a).
- **Wieb Bosma & John Cannon — "Programming with Algebraic Structures: Design of the Magma
  Language", ISSAC '94**; and **Bosma, Cannon & Playoust — "The Magma Algebra System I: The
  User Language", *J. Symbolic Computation* 24 (1997), 235–265.** Design from universal algebra
  and category theory; algebraic structure as the strong-typing mechanism (REPORTED).
- **Michael Monagan — Maple's `Domains` package** (early 1990s), parametrized domains as tables
  of operations (REPORTED).
- **The GAP Group — GAP reference manual ch. 13 "Types of Objects", ch. 35 "Magmas".** The
  category/property distinction (REPORTED); the declarations themselves STRUCTURAL from `lib/`.

---

## 11. What this does not settle

- **It does not settle whether marker interfaces are the right answer for Zeta.** §8.2(b) is a
  *design proposal supported by prior art*, not a measured result. It has no falsifier yet and
  is **`toy`** until one exists. The specific untested risk: marker interfaces multiply
  combinatorially (associative × alternative × no-zero-divisors × commutative), and none of the
  surveyed systems faced this in a *nominally-typed, single-dispatch* language.
- **It does not close the sedenion question.** No surveyed system models 𝕊 (§3.6). The
  zero-divisor loss has a *name* in Sage (`NoZeroDivisors`) and no worked implementation
  anywhere found.
- **It does not establish that FriCAS's lattice is well-designed** — only that it exists and
  branches. Whether its `Join`-heavy multiple inheritance is pleasant to maintain at scale is
  **UNKNOWN**; the fact that Sage rebuilt the idea rather than adopting SPAD is weak evidence
  either way and is not read as a verdict.
- **Magma and the Casio ClassPad are genuinely unexamined.** Magma's source is closed; the
  ClassPad was not investigated. Neither absence is evidence.
- **The "35 years earlier" framing is a lineage observation, not a priority claim.** Zeta's
  measurement was made independently; that FriCAS ships the same predicate is convergence, and
  convergence between an independent measurement and a 1991 library function is the *good* kind
  of evidence — two meters, same reading, no shared cause.

---

## Pointers

- `src/Core.Abstractions/IStarRing.cs` — the disclosure this document went looking for prior art
  against (*"law profile carried as documentation, not types"*); §3.3 and §4.1 are the finding
  that two mature systems make the same disclosure.
- `src/Core.Abstractions/IRing.cs` — the precedent for §8.2(b): capability earned via
  subinterface so misuse is a compile error, not a runtime throw (`081KWG9JQ9H`).
- [`interfaces-free-classes-earned-under-rules`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md)
  — interfaces are free; §8.2(b)'s markers are weight-free by construction (no members, no state).
- [`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)
  — FriCAS's `Octonion(R) == Record(e: Quaternion R, E: Quaternion R)` is Cayley–Dickson as a
  *generator*, and `Algebra = Join(Ring, NonAssociativeAlgebra)` is the earned-quotient shape
  this rule names.
- [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — why §8.2(c) is the load-bearing recommendation and §8.2(b) alone is unmetered.
- [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) — the
  register discipline applied throughout §9; the 343-vs-512 note in §3.4 exists because a count
  mismatch left unexplained is how a false discrepancy becomes a belief.
