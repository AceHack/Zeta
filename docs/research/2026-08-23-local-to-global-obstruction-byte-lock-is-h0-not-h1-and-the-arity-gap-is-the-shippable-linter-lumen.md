# The local-to-global obstruction: byte-lock is H⁰ not H¹, nerve cohomology convicts but never acquits, and the arity gap is the shippable instrument

**Date:** 2026-08-23 · **Author:** Lumen · **Register:** Beacon
**Brief:** Aaron 2026-08-23 — *"The global structure is where hacks happen. My name is AceHack for
over 25 years. The local structure is where you exploit it."* · *"When I say I can see the future of
English, this is the geometric shape I am seeing — local interactions vs global norms."* · on *"no
point of a closed timelike curve is illegal while the loop is"*: *"Yes, Gödel taught me this."*

**Verdict in one line:** the local-to-global obstruction is the right shape and the *wrong instrument*
for three of the four questions asked — the four-oracle byte-lock is an **H⁰** computation and can
never carry an H¹ class; the nerve-only H¹ is **one-way** (49 wrong acquittals, 0 wrong convictions,
measured); the monodromy in `harmonious-division` correctly stops at the flat/local-system case and
its consumer needs nothing more. The fourth question has a real, positive, mechanical answer, and it
is the deliverable: **arity**.

---

## 0. Register table — read this before anything else

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`. Most of this doc is `unmetered` and
saying so is the point.

| § | claim | register | falsifier |
|---|---|---|---|
| §3 | byte-lock passes ⟺ the 0-cochain is a global section (H⁰); a failed byte-lock has **no** H¹ class | **metered** | the nerve of *k* copies of one set is the full (k−1)-simplex; computed for k=2,3,4,6, H¹=0 in every case |
| §6 | nerve-only H¹ vs α-acyclicity: H¹≠0 ⇒ cyclic, but H¹=0 ⇏ acyclic | **metered (bounded)** | 1,925 covers over ≤4 attributes: 45 disagreements, **all** wrong acquittals, **0** wrong convictions; the disagreement class confirmed semantically |
| §5 | no sound check of arity ≤ 2 decides global consistency on a cyclic cover | **metered** | computed by cases: all three proper sub-covers of the 3-cycle glue on identical local data |
| §5.3 | the general "does this check see globally" question is undecidable | **metered** | Rice 1953, entailment checked in §9 |
| §5.5 | `NtpNoninterference.Tests.fs:51-55` is an arity-1 check standing in for a 2-safety property | **metered** | read from source; contrast with the arity-2 property 10 lines above it in the same file |
| §2 | the event-sheaf site for a **relational cover** | **metered** (already shipped 2026-08-18) | `src/Core.TypeScript/cover-acyclicity/`, 44 tests |
| §2.3 | the same site for **language** | **toy** | none — there is no cover extractor, and §2.4 says why that is fatal, not pending |
| §4 | monodromy is a local system; it does not extend to a non-constant sheaf on our merge algebra | **unmetered** (structural) | inherits the refutation's F4: there is no connection on a merge monoid |
| §4.3 | a **commutative** reintegration record cannot preserve order-of-divergence | **unmetered** (structural) | the abelianization argument; actionable for `anti-babel` |
| §7 | Gödel 1949 CTCs as the purest local-to-global instance | **unmetered** | correct about the Gödel solution; the transport to our substrate is not measured |
| §1 | the brief's measured gap | **corrected** | the gap does not exist as stated; see below |

---

## 1. First finding: the gap in the brief is not there, and the correction matters

The brief said sheaf/sheaves appear only in `docs/CONCEPT-REGISTRY.md`, `docs/PRIOR-ART-LIST.md` and
two backlog rows, with **no research treatment**, and that holonomy is "named, not developed." I was
told to verify rather than trust. Verified — `git grep -c -i` on `origin/main` at `3a0510ddc`, the
`references/` mirror excluded:

- **`sheaf`/`sheaves`** appears in **five research docs**, most substantially
  `2026-05-29-lightlike-substrate-…` (12) and
  `2026-08-15-four-strands-separated-…` (10), plus
  `2026-08-17-path-independence-in-four-costumes-…-literature-scout-verdict.md` (7) and
  `2026-08-18-the-shape-of-the-cover-decides-…` (3) — **and in shipped code**,
  `src/Core.TypeScript/cover-acyclicity/witness.ts`.
- **`holonomy`** appears in **eleven research docs**, led by
  `2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md`
  (**22**) and the scout verdict (12). Four of those docs are mine.
- `docs/PRIOR-ART-LIST.md` §"Local-to-global obstruction" already carries Abramsky &
  Brandenburger (NJP 2011), Abramsky (LNCS 8000, 2013), **Abramsky–Barbosa–Kishida–Lal–Mansfield
  (CSL 2015) — explicitly "the obstruction is a Čech cohomology class"** — Vorob'ev (1962), BFMY
  (1983), Fine (1982), Pitowsky, Honeyman–Ladner–Yannakakis and Pironio.

So the shape Aaron is pointing at was not only treated, it was **treated adversarially and then
shipped**. That is not a pedantic correction. It changes what this doc can honestly be:

> The question is not *"is the local-to-global obstruction the right home?"* It is **"what is left
> after the refutation, and is any of it an instrument?"** A doc written against the stated gap
> would have re-derived a mapping this repo already killed on 2026-08-17.

The two load-bearing predecessors, and what each settled:

1. **`2026-08-17-path-independence-is-four-properties-refuting-…`** — killed the identification
   "commutative merge = zero holonomy = local hidden variable = CALM-monotone." Findings that
   constrain everything below: **F4** — *commutative ⇏ flat and flat ⇏ commutative*, with computed
   ℤ/4 and S₃ counterexamples; and the structural reason, which is the one I lean on hardest:
   *"commutativity is a property of the group; flatness is a property of the assignment of group
   elements to edges. A monoid has the first kind of data and none of the second."*
2. **`2026-08-18-the-shape-of-the-cover-decides-…`** — shipped the one surviving leg as
   `src/Core.TypeScript/cover-acyclicity/`: GYO α-acyclicity with certificates on both verdicts, an
   exhaustive semantic falsifier, 11/14 mutants killed with the three survivors demonstrated
   equivalent over 200,000 covers, and **no CI gate**, on the stated ground that no consumer's
   correctness yet depends on a cover being acyclic.

I did not know the second doc existed when I started. Both were found by running the brief's own
`git grep` rather than accepting its summary — which is the house rule doing exactly its job, and
worth recording because the failure it prevented was mine.

---

## 2. Q1 — Is sheaf cohomology the right formal home for "local interactions vs global norms"?

**Answer: yes for a *declared finite cover*, where it is already shipped; and not yet for language,
for a reason that is structural rather than pending.**

### 2.1 The site, concretely (the relational case)

Being concrete was the ask, so here it is with no hedging, and note the first line — the honest
statement is that we do **not** need a Grothendieck site.

- **Base.** A finite attribute universe `X` (columns, shard keys, positions). Not a topological
  space, and it does not need to be: Čech cohomology needs only a **cover and its nerve**, so the
  site machinery (Grothendieck, Tôhoku 1957) is strictly more apparatus than the finite case
  consumes. Reaching for it here would be decoration.
- **Cover.** `U = {U₁ … U_n}`, each `U_i ⊆ X` — the tables, the shard boundaries, the local views.
  Read as a hypergraph: attributes are vertices, cover elements are hyperedges.
- **The sheaf.** `E(S)` = the set of **assignments** (tuples) over the attributes in `S`, with
  restriction = **projection**. This *is* a sheaf: assignments glue on overlaps by construction.
  Abramsky's "event sheaf."
- **The thing that is not a sheaf.** The data is a **sub-presheaf** `R_i ⊆ E(U_i)` — the relation
  actually stored at each element. *That* is what fails to glue, and Abramsky's formulation is the
  sentence to quote: **Bell's theorem is the statement that the relational presheaf is not a sheaf.**
- **A section over `U_i`** = one tuple in `R_i`. **A compatible family** = one tuple per element,
  agreeing on every overlap. **A global section** = a tuple over all of `X` restricting into every
  `R_i` — i.e. a row of the natural join.
- **The obstruction.** A compatible family with no global section. Locally consistent everywhere,
  globally impossible.

The forcing case, already in the suite: `{A,B}, {B,C}, {C,A}` with each relation asserting "my two
attributes differ." Every single-attribute projection is `{0,1}`, so it is pairwise consistent; but
`A≠B` and `B≠C` force `A=C` over two values, which `R_CA` forbids, so the natural join is empty.
**Drop one element and the same local data glues.** The obstruction is in the shape, not the data.

### 2.2 What decides it, and it is not cohomology

Beeri, Fagin, Maier & Yannakakis (JACM 1983): a cover is **α-acyclic** iff every pairwise-consistent
instance is globally consistent, and α-acyclicity is decided by the polynomial GYO reduction. That
is the criterion, it is shipped, and §6 below measures what cohomology adds to it. Spoiler: **less
than nothing, in the direction you would want.**

### 2.3 The same site for language — stated as a proposal, labelled `toy`

Aaron's shape maps cleanly, and I can write the site down:

| sheaf-theoretic object | linguistic reading |
|---|---|
| base `X` | token positions, or discourse referents, of one utterance |
| cover `U` | the **contexts** — whatever set of position-groups a local rule jointly constrains |
| `E(S)` | the readings of positions in `S` that local grammar/collocation licenses |
| section over `U_i` | one locally licensed reading of that context |
| compatible family | a per-context reading choice agreeing wherever contexts overlap |
| global section | one coherent reading of the whole utterance |
| **> 1 global section** | **ambiguity** |
| **compatible family, no global section** | **garden-path / anomaly — local structure fine everywhere, no global parse** |

That last row is Aaron's sentence almost verbatim, and the anchor is real: **Abramsky & Sadrzadeh,
"Semantic Unification: A Sheaf-Theoretic Approach to Natural Language" (LNCS 8222, 2014)** does
exactly this construction for anaphora. *(Cited, not checked — I have not read it in this session,
and it is not currently in `docs/PRIOR-ART-LIST.md`.)*

### 2.4 …and why that table is `toy` and not `unmetered`

**All of the content is in row two, and row two is hand-drawn.** Nothing currently selects the
cover. Dependency-parse maximal projections, agreement domains, and fixed-width collocation windows
are three different covers over the same sentence and they give three different verdicts.

This is not a hypothetical worry, and I can point at the measurement rather than argue it:

- §6's family contains `{A,B},{B,C},{C,A}` (**cyclic**) and `{A,B},{B,C},{C,A},{A,B,C}`
  (**acyclic**) over the *same* three attributes. The carve, not the data, decides.
- The shipped work already hit this on a real schema: `2026-08-18-…` §5.2 ran the FactoryDemo cover
  under two naming conventions specifically because they could have disagreed, and recorded that
  *"had they disagreed, the disagreement would have been the finding."*

So a hand-drawn linguistic cover makes the framework **unfalsifiable** — you can always draw the
cover that yields the verdict you wanted. The mitigation is the one `docs/CONCEPT-REGISTRY.md`
already prescribes for exactly this failure mode: **pre-registration.**

> **The falsifier, stated as an experiment.** Fix a cover extractor — e.g. "one cover element per
> maximal projection of a dependency parse" — *in code, before seeing the test sentences*. Run GYO.
> Compare the cyclic/acyclic verdict against human ambiguity judgements on a held-out set, against
> a baseline (sentence length; count of attachment sites). If it does not beat the baseline, the
> mapping is dead. Until someone runs that, every linguistic claim here stays `toy`.

---

## 3. Q2 — Is the four-oracle byte-lock literally an H¹ computation?

**Answer: no, cleanly, and the reason is worth more than a yes would have been. Byte-lock is an H⁰
computation, and a failed byte-lock cannot carry a cohomology class — not "does not currently," but
*cannot*, by the shape of its cover.**

### 3.1 The computation, written out

The byte-lock has four oracles each producing a value for the **same** object. So every cover element
is the whole domain: `U_i = X` for all `i`, and `U_i ∩ U_j = X`.

- `C⁰ = ∏_i F(U_i) = F(X)⁴`. The four oracle outputs are a **0-cochain** `s = (s₁,s₂,s₃,s₄)`.
- `(δ⁰s)_{ij} = s_j|_{U_i∩U_j} − s_i|_{U_i∩U_j} = s_j − s_i`.
- **Byte-lock passes ⟺ `δ⁰s = 0` ⟺ `s ∈ ker δ⁰` = the global sections = `H⁰(U, F)`.**

That is the definition of H⁰. The byte-lock is the equalizer of four maps into one object, which is
a limit, which is degree zero.

### 3.2 Why the hoped-for H¹ class is identically zero

The hope in the brief was: *a failed byte-lock has a CLASS that says WHICH overlap failed.* It does
not, and here is the two-line reason.

The disagreement data `d_{ij} = s_j − s_i` is a 1-cochain. But it is **by construction** `δ⁰` of the
0-cochain `s` — so it is a **coboundary**, so its class in `H¹ = ker δ¹ / im δ⁰` is **zero**, whether
the oracles agree or disagree. There is no information in the class because the cochain was a
coboundary before you looked at it.

Independently, and measured rather than argued — the nerve of a cover by *k* copies of one nonempty
set is the full `(k−1)`-simplex, which is contractible:

```
byte-lock cover, 2 oracles over one domain: H^0=1 H^1=0 (V=2,E=1,T=0)
byte-lock cover, 3 oracles over one domain: H^0=1 H^1=0 (V=3,E=3,T=1)
byte-lock cover, 4 oracles over one domain: H^0=1 H^1=0 (V=4,E=6,T=4)
byte-lock cover, 6 oracles over one domain: H^0=1 H^1=0 (V=6,E=15,T=20)
```

`docs/research/scripts/2026-08-23-nerve-h1-vs-alpha-acyclicity.ts`.

**And the instrument the brief wanted already exists and needs no theory.** "Which overlap failed" is
the pairwise diff matrix `d_{ij}`. You can print it today. What cohomology *would* have added is the
ability to say *"this disagreement cannot be repaired by relabelling any single oracle"* — and on a
contractible nerve that statement is never true, because every disagreement is repairable by
relabelling (that is precisely what "coboundary" means).

### 3.3 The condition under which byte-lock *would* become an H¹ computation

This is the useful half, and it is checkable.

> H¹ can be non-zero only if the nerve of the cover carries a 1-cycle that is not filled. That
> requires the oracles to cover **different, partially overlapping domains** — oracle A implements
> ops {1,2}, B implements {2,3}, C implements {3,1}, with no oracle implementing all three.

The repo's four-oracle policy is deliberately the opposite: every oracle implements the same spec
over the same domain. So:

> **Total redundancy is the H¹ = 0 regime by construction.** The byte-lock is built in the one
> regime where the local-to-global obstruction is guaranteed absent — and that is a design fact to
> keep, not a deficiency to fix. Partial-coverage oracles would buy coverage breadth at the price of
> admitting disagreements that *no* merge repairs.

One thing cohomology does **not** rescue, and it should be said next to this so nobody reaches for
it: H¹ = 0 says nothing about whether four *correlated* implementations agreeing is evidence. That
is the independence problem (`numerology-vs-number-theory`: *"N correlated observations are not N
observations"*), and it is orthogonal to every computation in this section.

---

## 4. Q3 — Does the monodromy in `harmonious-division` extend to a full sheaf structure?

**Answer: it stops at the flat / local-system case, that is the correct place for it to stop, and its
named consumer (`anti-babel`) needs nothing beyond it. But there is one genuine, actionable
sharpening the consumer is not yet using — §4.3.**

### 4.1 What is actually there

`2026-08-20-harmonious-division-…` uses monodromy in its classical sense: analytic continuation,
the monodromy theorem, *"uniqueness is a property of `π₁(domain ∖ branch points)`, not of the
arithmetic,"* different homotopy classes giving different sheets. Its three consequences —
record the route not the value; two travelers who circled the pole differently *should* disagree;
**monodromy is the formal name for legitimate persistent disagreement** — are what
`.claude/rules/anti-babel-preserve-reconcilability.md` §"Reintegration is NOT reconvergence" is
built on. The doc already carries its own honest limit: *"the monodromy theorem is about analytic
functions, and agents are not analytic functions."*

### 4.2 It is already sheaf-theoretic, and it is the degenerate case

Monodromy is not *outside* sheaf theory — a monodromy representation **is** a **local system**, i.e.
a **locally constant sheaf**, equivalently a **flat connection**. So the answer to "does it extend
to a full sheaf structure" is: it is already a sheaf, of the one kind where the local-to-global
obstruction of §2 has nothing to bite on.

- Locally constant means **the local data is the same everywhere**. All the information sits in
  `π₁` of the base and the representation — nothing varies from patch to patch.
- The interesting obstructions of §2 come from sheaves that are **not** locally constant, where the
  local data genuinely differs between elements (`R_AB ≠ R_BC`).
- Flatness is what makes monodromy well-defined at all. With curvature there is no path-independent
  transport to be a representation of `π₁`.

**Does it extend to the merge algebra? No, and the refutation already proved why.** Finding F4:
*"There is no connection on `CoOwnedCorner` because there is nothing that varies from edge to
edge."* A non-constant sheaf needs edge-varying data, and the merge algebra has none. The cover side
(§2) does have varying local data — but that is a sub-presheaf of the event sheaf, a different
construction from a local system, and the two do **not** join into one structure. Claiming they do
would be the identification of 2026-08-17 wearing a new hat.

### 4.3 What `anti-babel` needs, and the one thing it is missing

Read against the rule's actual text, the requirement is: **multiple global sections, each indexed by
a homotopy class, none collapsed.** That is the `π₁`-representation and precisely nothing more.
Upgrading to H¹ with non-constant coefficients adds machinery the rule does not consume. *So the
deflationary answer is the correct one: `anti-babel` is adequately served today.*

But the refutation's surviving fragment **S2** hands its consumer something it is not yet using, and
this is a real design consequence rather than a restatement:

> For an **abelian** structure group, holonomy factors through `H₁` — the abelianization — so the
> holonomy of a loop depends only on the **multiset** of its edges, not their order.

Applied to reintegration:

> **A commutative merge of branch records cannot distinguish "diverged around P, then around Q"
> from "Q, then P."** It preserves the *set* of detours and destroys their *order*. If `anti-babel`
> wants order-of-divergence to survive reintegration — and *"both branches held, each with its path
> recorded"* reads as though it does — then the reintegration record must be **non-commutative**:
> the free monoid, which the repo already ships as `appendCorner` (`SoftScheduler.fs:199`) and
> already labels *"order-sensitive by construction."*

That is checkable, it is actionable, and it is the only thing in this section a consumer should
change anything over. **Register: `unmetered`** — the abelianization argument is structural; no
measurement of an actual reintegration record has been made, because none exists yet.

---

## 5. Q4 — Is there a class of check provably incapable of seeing a global property, and can it be recognised mechanically?

**Answer: yes, yes, and the mechanical recognition is cheaper than expected because arity is a
property of a check's SIGNATURE, not of its body.** This is the operational deliverable.

### 5.1 The impossibility, computed rather than asserted

Define: a check `c` has **arity k** over cover `U` if `c(I)` depends only on the restrictions of the
instance `I` to some `k` cover elements. A check is **sound** if it accepts every globally consistent
instance.

**Theorem (measured by cases).** On the 3-cycle, no sound check of arity ≤ 2 decides global
consistency.

```
=== (2) ARITY GAP on the 3-cycle {AB},{BC},{CA} ===
  whole cover: pairwise=true global=false
  drop R_AB: sub-cover {BC},{AC}  pairwise=true global=true  <- SAME local data
  drop R_BC: sub-cover {AB},{AC}  pairwise=true global=true  <- SAME local data
  drop R_CA: sub-cover {AB},{BC}  pairwise=true global=true  <- SAME local data

  every proper sub-cover glues on identical local data? true
```

Two arguments, both closed by those runs:

- **Arity 1.** Suppose `P(I) = ⋀_i p_i(R_i)` decided global consistency. `P` must reject the
  3-cycle instance, so some `p_i(R_i) = false`. But dropping a *different* element leaves a
  **globally consistent** instance containing that same `R_i`, which `P` must accept — so every
  `p_i(R_i) = true`. Contradiction.
- **Arity 2.** The instance is pairwise consistent and globally inconsistent. Any sound arity-2
  check therefore accepts it. Done.

**The reframing that makes this a linter.** Define the cover's **gluing arity** `g(U)` = the least
`k` such that `k`-wise consistency implies global consistency (`g ≤ |U|` always, since `|U|`-wise
consistency *is* global consistency). Then BFMY reads:

> **α-acyclic ⟺ `g(U) = 2`.** "Alpha-acyclicity" and "pairwise checks suffice" are the same
> sentence. And `gyo.ts` already computes it, in polynomial time, with a certificate.

### 5.2 The lint

> **For each declared cover, compute `g(U)` via GYO. For each check declared against that cover,
> read its arity off its signature. Flag any check whose arity `< g(U)` as *provably incapable* of
> certifying the global property it claims.**

Both inputs are already cheap: GYO is shipped and polynomial; arity is a type, not an analysis.

**It must fire on a known case or it is not a check** (the repo's own sabotage-control discipline).
It fires on the 3-cycle with a pairwise check. It must **not** fire on the covers already measured
in the tree — IMDb and both FactoryDemo carves are α-acyclic, so `g = 2` there and pairwise checks
are legitimate. Both directions are exercised.

### 5.3 The honest limit — Rice's theorem bounds the general version

The **semantic** question — *"does the function this check computes depend on more than one cover
element?"* — is **undecidable**. "Independent of coordinate `j`" is a non-trivial extensional
property of partial computable functions (the everywhere-undefined function has it; a projection
does not), so **Rice (1953)** applies directly.

What rescues the lint is that we never need the semantic version:

- A **static over-approximation** is what soundness requires, and the cheapest sound
  over-approximation is the **signature**. A check of type `Relation → bool` applied to `R₁`
  *cannot* depend on `R₂` — the type says so, no analysis required.
- **Runtime read-set tracing does not work here**, and it is worth naming so nobody builds it: an
  observed read-set on one input is neither an upper nor a lower bound on dependence across all
  inputs (a check may read and ignore; a check may read more on an input you did not try). Sampled
  traces give an unsound answer that looks like a measurement.

So: **arity is declared, never inferred.** That is a constraint on how checks are written, which is
the sort of thing this repo already does (`Wall.Whitebox`, `DerivationProtocol`).

### 5.4 The security reading — and this is the rigorous form of Aaron's sentence

*"The global structure is where hacks happen. The local structure is where you exploit it."* That
has an exact formalization, and the repo is already standing on it without using the word:

**Clarkson & Schneider, "Hyperproperties" (J. Computer Security 18(6):1157, 2010).** A *property* is
a set of traces — decidable per-execution. A *hyperproperty* is a set of **sets** of traces.
**Noninterference (Goguen–Meseguer 1982) is not a property; it is a 2-safety hyperproperty** — it
quantifies over **pairs** of executions. Consequence, and it is a theorem rather than an analogy:

> **No monitor observing a single execution can decide noninterference.** Every per-trace check of
> it is arity-1 against an arity-2 property, and is therefore provably incomplete.

**Manifesto §13 is noninterference.** So the repo has already committed to a discipline that is
*provably not checkable* by any single-run test — and the correct instrument is the one the repo
also already has: **DST replay makes paired executions cheap**, which is exactly what a 2-safety
check needs. The arity lint and §7 DST are the same requirement seen twice.

`git grep` finds "hyperproperty"/"2-safety" on `origin/main` in exactly one place —
`docs/letters/from-soraya-adinkra-clock-formal-analysis.md`. The vocabulary is essentially absent
from a repo whose §13 depends on it.

### 5.5 A live in-repo instance, found by applying the lint by hand

`tests/Tests.FSharp/Formal/NtpNoninterference.Tests.fs` contains both shapes, ten lines apart.

**Done right (arity 2)** — two clocks, two renders, compared:

```fsharp
let page1 = MP.renderPage "imdb" true c1 links
let page2 = MP.renderPage "imdb" true c2 links
stripClock page1 = stripClock page2
```

**Arity 1, claiming a 2-safety property** (lines 51-55, live on `main`):

```fsharp
[<Property>]
let ``renderCard (the minted content) is a pure function of the link — no clock input`` (a: int) (b: int) (s: int) =
    let l = mintedLink a b s
    // signature takes no clock; rendering twice is identical regardless of any ambient "now"
    MP.renderCard l = MP.renderCard l
```

Stated precisely, because the overclaim here is subtler than pure vacuity and I will not round it up:

- This is **not** strictly unfalsifiable — if `renderCard` read an ambient clock, two calls *could*
  differ. So it is a weak determinism check, not reflexivity.
- But its **failure probability under the very bug it targets is near zero**: two calls microseconds
  apart would read the same clock value at any realistic granularity. It is a check whose stated
  claim ("no clock input") is *type-level* and whose actual test is a coin-flip that lands heads.
- And the type-level claim is **already guaranteed by the signature** — `renderCard` takes no clock.
  The test restates what the compiler proves, in a form that could not detect the violation.

This is exactly what the lint would flag, and the file is *already* self-aware about the neighbouring
case: Soraya rewrote the `[<Fact>]` below it on 2026-08-18, recording that
`Assert.Equal(cardsOf links, cardsOf links)` had *"both sides the SAME expression … the vacuity
class, sitting inside a noninterference proof."* The `[<Property>]` above it is the same class,
survived that pass, and is still there.

**The right fix is not a better assertion — it is deletion plus a comment**, since the signature
already carries the guarantee. Recorded here as a finding; not fixed in this PR, which is a research
doc (`every-bug-has-economic-value`: the finding is the value, and it is keyed to this doc).

### 5.6 What it would cost to make the lint real

Honest, because the shipped predecessor set this bar and refused to gate without a consumer:

1. **Covers must be declared.** Almost no check in this repo is written against a declared cover, so
   the lint's surface today is near zero. Wiring it into CI before consumers exist would be a check
   that constrains nothing — the exact refusal `2026-08-18-…` §1.3 already made.
2. It is a **necessary** condition only. Adequate arity does not make a check correct.
3. Rice bounds any attempt to infer arity instead of declaring it (§5.3).

The narrow, useful first slice — and the one I would actually build — is **not** the general lint:
it is a **2-safety audit of the noninterference tests specifically**, where the cover is trivial
(`k = 2` executions), the property is named by manifesto §13, and §5.5 shows the failure is already
present on `main`.

---

## 6. The measurement — nerve cohomology convicts, but never acquits

This is the load-bearing experiment, and it produced the one result I did not expect.

**Question.** Is the *combinatorial* obstruction (H¹ of the nerve, F₂ coefficients — i.e. the
constant sheaf) the same discriminator as the *semantic* one (α-acyclicity)?

**Method.** Compute both independently over an exhaustive family of small covers. The nerve code
never calls GYO; GYO never sees the nerve. Disagreements are the finding.
(`docs/research/scripts/2026-08-23-nerve-h1-vs-alpha-acyclicity.ts`.)

```
attrs=ABC  maxSize=3: covers=56   acyclic=55   agree=56   disagree=0   [wrong-acquittals=0  wrong-convictions=0]
attrs=ABC  maxSize=4: covers=91   acyclic=87   agree=91   disagree=0   [wrong-acquittals=0  wrong-convictions=0]
attrs=ABCD maxSize=3: covers=560  acyclic=534  agree=556  disagree=4   [wrong-acquittals=4  wrong-convictions=0]
attrs=ABCD maxSize=4: covers=1925 acyclic=1685 agree=1880 disagree=45  [wrong-acquittals=45 wrong-convictions=0]
```

**Two findings, and the first one is a trap.**

**(a) On three attributes the two invariants agree perfectly — 91/91.** That is the seduction. Had I
stopped at three attributes I would have reported an identification, and it would have been wrong.
The rule's own worked-instance discipline says a match is not an identification; here the match held
across an entire exhaustive family and still was not one.

**(b) On four attributes there are 45 disagreements and every one runs the same way.** The smallest
is `{ABC}, {ABD}, {ACD}`:

- **GYO: CYCLIC.** No attribute occurs exactly once (A in all three, B/C/D in two each) and no
  element contains another, so the reduction sticks immediately.
- **Nerve: H¹ = 0.** Every pairwise intersection is nonempty (`{AB}`, `{AC}`, `{AD}`) *and* the
  triple intersection is `{A}` ≠ ∅ — so the 2-simplex is filled and the triangle is not a hole.

Confirmed **semantically**, with the shipped `witness.ts` and never with GYO, using the even-parity
(GHZ-shaped) instance:

```
cover {ABC},{ABD},{ACD}   (nerve H^0=1, H^1=0)
  each relation = even-parity triples, |R| = 4
  pairwise consistent? true
  globally consistent? false
  natural join has 2 tuples: [{"A":0,"B":0,"C":0,"D":0},{"A":0,"B":1,"C":1,"D":1}]
  join projected to ABC = [{"A":0,"B":0,"C":0},{"A":0,"B":1,"C":1}]
  ... equals R_ABC? false
```

> **The result, stated so it can be acted on: the nerve-only H¹ is a ONE-WAY instrument.
> `H¹ ≠ 0` ⇒ the cover cannot guarantee gluing. `H¹ = 0` ⇒ *nothing*. Measured: 49 wrong
> acquittals, 0 wrong convictions, over 2,632 cover evaluations.**
>
> **H¹ convicts; it never acquits.**

The repo already has this vocabulary — one-way inference that "convicts, never acquits"
(`dual-use-detection-is-neutral-oracle-decides`). This is the same shape arriving from topology, and
it means the tempting use is the forbidden one: nobody may certify a carve by computing `H¹ = 0`.

### 6.1 Why it fails, and the anchor is genuinely load-bearing here

This is not a curiosity — it is a computed instance of the failure of **Leray's hypothesis**.

Čech cohomology over a **fixed** cover computes the sheaf cohomology of the space only when the
cover is **acyclic** (all finite intersections have vanishing higher cohomology) — **Leray's
theorem**. The nerve-only computation uses the **constant** sheaf, which throws away the local data
`R_i` entirely and retains just the combinatorics of which elements meet. So it can only ever see
holes visible at the resolution of *"do these elements intersect,"* and the parity witness above
lives entirely *inside* an intersection that the constant sheaf reports as trivially fine.

So Leray 1946 is not decoration on this doc; it is the explanation of the measurement. **A vanishing
Čech H¹ over a fixed cover is a statement about that cover's resolution, never about the space.**

### 6.2 Bounds — stated loudly, because they are tight

- **≤ 4 attributes, ≤ 4 cover elements.** The 3-attribute families showed 0 disagreements; the
  effect appears only at 4. Larger covers are not searched, so "0 wrong convictions" is a bounded
  result and not a theorem.
- **F₂ coefficients only.** ℤ or ℚ coefficients could in principle differ (torsion), and were not run.
- **The nerve-only invariant is NOT the Abramsky–Barbosa obstruction.** ABKLM's is a Čech class with
  coefficients in a sheaf built from the local sections — strictly finer than the constant sheaf I
  computed. My false negatives therefore do **not** measure theirs. My understanding is that their
  obstruction is also known to be sufficient-but-not-necessary (false negatives, complete only on
  the all-vs-nothing class) — **that is cited from memory, NOT checked**, and nothing above depends
  on it. If it holds, my result is the crude shadow of a known one; if it does not, my result stands
  on its own measurement regardless.
- **The disagreement direction is a measurement, not a proof.** I have not proven that no cover
  yields `H¹ ≠ 0` with GYO-acyclic. I searched 1,925 and found none.

---

## 7. Gödel, and the honest status of the two theorems Aaron joined

*"No point of a closed timelike curve is illegal while the loop is"* — *"Yes, Gödel taught me this."*

That is exactly right about the object, and it is the purest physical instance of the shape.

**Gödel (1949)**, *"An example of a new type of cosmological solutions of Einstein's field equations
of gravitation,"* Rev. Mod. Phys. 21:447. The Gödel metric is a genuine solution, and it is
**locally utterly unremarkable** — at every point one can erect normal coordinates with an ordinary
light cone, and every local causal condition holds. The pathology is **purely global**: closed
timelike curves exist, so there is no global time function. Every point is legal; the loop is not.
No local check can see it, and there is no local repair — the exact structure of §5.1, arriving from
general relativity. *(The complementary result — a spacetime admits a global time function iff it is
stably causal — is Hawking 1969; cited, not checked.)*

**Gödel (1931)** is the other half of Aaron's remark, and it is a *different* theorem: every finite
proof is locally checkable, and the global property "no contradiction is derivable anywhere" is not
certifiable from inside. Also a local-to-global obstruction, in the proof-theoretic register.

**Applying the numerology rule to Aaron's own pair, since it is the best test case in this doc:**
Gödel 1931 and Gödel 1949 share an **arrow** — *local legality does not compose to global legality* —
and share an author. They do **not** share an object: one is about models of arithmetic, the other
about Lorentzian manifolds, and no theorem connects them. The resemblance is real, it is a good
generator, and it is not a result. Register: **`unmetered`**, structural. It earns its place in this
doc because it is the cleanest statement of the shape available, and for nothing else.

---

## 8. The counter-pressure, answered directly

The brief named the objection I must not dodge: *"local consistency without global consistency"
describes an enormous class of systems, so it may discriminate nothing.*

**The objection is correct, and it is the strongest thing in the brief.** It is the same test that
killed the four-costume identification: *what else has this structure?* Answer — **everything with a
cover does.** Databases, spacetimes, gauge fields, proof systems, parsers, security monitors, and
Aaron's exploit surface. A framework that describes all of them describes none of them, and that is
the vacuity class exactly as `toy-is-free-metered-must-be-earned` names it.

So the framework earns nothing by fitting. What it must produce is a **number that could have come
out otherwise**, and the brief named the two conditions correctly:

**Is the cohomology computable? Yes — and this is the good news, with a sharp caveat.**

- Deciding the **shape** is polynomial: GYO is `O(|E|²·|V|)`, shipped, certificated.
- Computing the nerve's H¹ is linear algebra over F₂ — trivial at schema scale.
- But deciding gluing for a **given instance** is **NP-complete** (Honeyman, Ladner & Yannakakis
  1980), which is why `searchGluingWitness` **refuses** rather than truncating.
- **And §6 shows the cheap invariant is the wrong one.** The computable-and-cheap H¹ acquits
  falsely 49 times out of 1,925. Computability was never the binding constraint.

**Does it predict an utterance's ambiguity before a human reads it? No — and the reason is not
computational.** The gap is **extraction, not computation**: nothing derives the cover from the
utterance. Given a cover, the verdict is cheap; the cover is where all the content sits and it is
currently hand-drawn (§2.4). That is why the linguistic table is `toy` and why the falsifier is
pre-registration of an extractor.

**So the discriminating residue of this entire doc is small, and it is this:**

> The framework discriminates **only** where a cover is **declared, finite, and fixed before the
> data**. Where that holds it is already shipped and already measured. Where it does not — language,
> and the merge algebra — it is `toy`, and the honest deliverable is not the cohomology at all. It
> is **arity** (§5): a cheap, mechanical, signature-level necessary condition, with a live instance
> already on `main`.

---

## 9. Anchors — checked, cited, and declined

Per `anchor-to-human-prior-art`: an anchor must be *checked for entailment*, not merely cited.

### 9.1 Checked (the entailment was verified against the claim it carries)

- **Beeri, Fagin, Maier & Yannakakis (1983)**, JACM 30(3):479. α-acyclic ⟺ every pairwise-consistent
  instance is globally consistent. *Checked in this repo already* — 382 covers by independent
  exhaustion in `gyo.test.ts`, plus two sabotage controls. §5.1 uses it in the contrapositive form
  ("`g(U) = 2`"), which is the same statement rearranged.
- **Rice (1953)**, *Classes of recursively enumerable sets and their decision problems*, Trans. AMS
  74:358. Checked for §5.3: "the computed function is independent of coordinate `j`" is extensional
  (a property of the function, not the program) and non-trivial (the everywhere-undefined function
  has it; a projection does not). Rice therefore applies and the general arity question is
  undecidable. Entails the limit; entails nothing about covers.
- **Leray (1946)** — sheaves and the spectral sequence; the acyclic-cover theorem. Checked *against
  my own measurement* in §6.1: Čech-over-a-fixed-cover agrees with sheaf cohomology only when the
  intersections are acyclic, which is precisely why the constant-sheaf nerve computation produces
  false negatives. This is the one classical anchor here that is genuinely load-bearing rather than
  ceremonial. *(I have not read Leray's Comptes Rendus notes; what is checked is that the theorem's
  hypothesis is the one my measurement violates.)*
- **Clarkson & Schneider (2010)**, *Hyperproperties*, J. Computer Security 18(6):1157. Checked for
  §5.4: hyperproperties are sets of sets of traces; noninterference is 2-safety, hence not a
  property of individual traces, hence undecidable by any single-execution monitor. Entails the
  §5.4 claim exactly.
- **Goguen & Meseguer (1982)** — noninterference. Already the anchor for manifesto §13; used here
  only for what §13 *is*, which the manifesto itself states.

### 9.2 Cited, NOT checked — stated plainly, since an unchecked anchor keeps a claim `unmetered`

| citation | status |
|---|---|
| **Serre, FAC (1955)**, Ann. Math 61:197 | Cited for lineage only. **Entails nothing here** — coherent sheaves on algebraic varieties are not finite relational covers, and I make no claim that requires it. Named because the brief named it; if it were removed, no sentence in this doc would change. |
| **Grothendieck, Tôhoku (1957)**, Tôhoku Math. J. 9:119 | Cited for lineage. §2.1 explicitly declines the site machinery as more apparatus than the finite case consumes, so this anchor is *deliberately unused*. |
| **Gödel (1949)**, Rev. Mod. Phys. 21:447 | Cited; the local-regularity/global-CTC structure is the standard reading of the solution and I did not re-derive it. |
| **Gödel (1931)** | Cited; used only for its shape, and §7 separates it from 1949 rather than joining them. |
| **Hawking (1969)** — stably causal ⟺ a global time function exists | Cited; nothing depends on it. |
| **Abramsky & Brandenburger (2011)**, NJP 13:113036 | Cited; already in `PRIOR-ART-LIST`. Read at second hand via the 2026-08-17 scout, which is weaker provenance than "checked." |
| **Abramsky–Barbosa–Kishida–Lal–Mansfield (CSL 2015)** — the obstruction as a Čech class, and its incompleteness | **Cited from memory, NOT checked.** §6.2 marks exactly which sentence relies on it and confirms nothing above depends on it. |
| **Abramsky & Sadrzadeh (2014)**, LNCS 8222 — sheaf semantics for natural language | **Cited, not checked**, and not currently in `PRIOR-ART-LIST`. It is the anchor §2.3 would need; §2.4 explains why having it would still leave the table `toy`. |
| **Vorob'ev (1962)** ⟺ database acyclicity (Barbosa) | Cited only, exactly as the shipped module already records. Nothing here depends on it. |
| **Honeyman, Ladner & Yannakakis (1980)**, IPL 10(1):14 | Cited for the NP-completeness in §8; the reduction was not verified. |
| **Wilson (1974)** · **Fine (1982)** · **CHSH (1969)** | Inherited from the 2026-08-17 refutation, where they were checked. Used here only through its findings. |

### 9.3 Declined — claims this doc does NOT make

- **That the byte-lock is a sheaf-theoretic object worth instrumenting.** §3 says the opposite.
- **That a cyclic cover verdict means anything about contextuality, Bell, or CRDTs.** The
  identification was refuted 2026-08-17 and shipping code repeated the refusal on 2026-08-18. This
  doc adds no bridge and claims none.
- **That the linguistic mapping predicts anything.** `toy`, with the experiment that would change
  that named in §2.4.
- **That `H¹ = 0` certifies a carve.** §6 measures that it does not. This is the one claim someone
  is most likely to make from a skim of this doc, so it is declined explicitly.
- **A CI gate.** Same ground the predecessor gave: no consumer's correctness yet depends on it.

---

## 10. Numerology triage — the rule applied to this session's own findings

`.claude/rules/numerology-vs-number-theory.md` requires the register be stored *with* the
coincidence. Density of resonance is a warning, not a score.

| connection | status |
|---|---|
| byte-lock passes ⟺ `δ⁰s = 0` (H⁰) | **verified** — the definition, plus the nerve computed for k=2,3,4,6 |
| a failed byte-lock's disagreement cochain is a coboundary, so its H¹ class is 0 | **verified** — structural; `d_{ij} = (δ⁰s)_{ij}` by construction |
| nerve H¹ = 0 with a GYO-cyclic cover (49 cases) | **verified** — computed, and the smallest case confirmed semantically by the shipped witness code |
| 0 wrong convictions in 1,925 covers | **measured, not proven** — a bounded search, stated as such in §6.2 |
| §6.1: the false negatives are a failure of Leray's hypothesis | **structural** — the constant sheaf discards the local data; this is an explanation of the measurement, not an independent result |
| α-acyclic ⟺ gluing arity 2 | **structural** — BFMY restated; no new content, but it is the restatement that makes a linter possible |
| arity-≤2 checks cannot decide global consistency on the 3-cycle | **verified** — computed by cases over all three sub-covers |
| noninterference is 2-safety ⇒ single-run tests are provably incomplete | **verified against the theorem's statement** (Clarkson–Schneider), and it lands on manifesto §13 |
| `NtpNoninterference.Tests.fs:51-55` is arity-1 for a 2-safety claim | **verified** — read from source; and §5.5 declines to call it strictly vacuous, which is the weaker and correct reading |
| monodromy = local system = flat connection | **structural** — standard; the point is that it is the *degenerate* case, which is a real constraint |
| commutative reintegration loses order-of-divergence | **structural** (abelianization); the strongest actionable fragment, and still unmeasured |
| Gödel 1931 ↔ Gödel 1949 | **resonance** — a shared arrow and a shared author, no shared object. Recorded as a generator, load-bearing for nothing |
| language ↔ the event sheaf | **resonance with a named experiment** — `toy`; the experiment in §2.4 is what would promote it |
| "global structure is where hacks happen" ↔ hyperproperties | **verified as a formalization** — this is the one place a Mirror phrase compressed to an exact Beacon object rather than an analogy |

**The warning fired, and it fired where it should have.** This doc touches databases, topology,
quantum contextuality, general relativity, proof theory, security and linguistics — seven domains
agreeing is exactly the condition the rule says to distrust. Applying its own test: the shared
element across all seven is **one genuine schema** — *a cover with locally-satisfied constraints
need not admit a global section* — and that schema is **not deep, it is generic**. It is what §8
concedes at full strength. What survived the triage is not the resemblance; it is the two places
where a number came out that could have come out otherwise: **49/0** in §6, and the **arity
gap** in §5.

---

## 11. Pointers

- `docs/research/scripts/2026-08-23-nerve-h1-vs-alpha-acyclicity.ts` — the §6 measurement.
- `docs/research/scripts/2026-08-23-arity-gap-and-false-negative.ts` — the §5.1 and §6 semantic checks.
- `src/Core.TypeScript/cover-acyclicity/` — `gyo.ts`, `witness.ts`; the shipped criterion this doc
  stands on and does not extend.
- `docs/research/2026-08-18-the-shape-of-the-cover-decides-alpha-acyclicity-shipped-as-a-checkable-criterion.md`
  — the predecessor; §1.3's refusal-to-gate is the discipline §5.6 inherits.
- `docs/research/2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md`
  — the refutation; findings **F4** (commutative ⇎ flat) and **S2** (holonomy factors through H₁)
  are load-bearing for §4.
- `docs/research/2026-08-20-harmonious-division-…-what-survives-the-climb.md` §2 — the monodromy §4 reads.
- `.claude/rules/anti-babel-preserve-reconcilability.md` — the consumer; §4.3 is the one thing it
  should consider acting on.
- `tests/Tests.FSharp/Formal/NtpNoninterference.Tests.fs` — §5.5, the live finding.
- `docs/PRIOR-ART-LIST.md` §"Local-to-global obstruction" — the anchors already landed 2026-08-17.
- `.claude/rules/numerology-vs-number-theory.md` · `.claude/rules/toy-is-free-metered-must-be-earned.md`
  · `.claude/rules/anchor-to-human-prior-art.md` — the three disciplines this doc is an application of.
