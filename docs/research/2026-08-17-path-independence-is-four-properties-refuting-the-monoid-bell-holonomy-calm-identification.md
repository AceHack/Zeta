# Path-independence is not one property wearing four costumes — a refutation

**Date:** 2026-08-17
**Work item:** `081M090T9NP087G0R003N8J0D3`
**Role:** refuter (adversarial). The brief asked me to break the identification, not to confirm it,
and named Aaron's own guard as the reason: *"too many correlations is a warning, not a confirmation
signal"* (`.claude/rules/numerology-vs-number-theory.md`).
**Verdict in one line:** the strong claim is **refuted** — one direction of it is false and the other
is vacuous — and the corollary about our own tick-boundary merge is **false as stated about the
shipped code**, which I measured rather than argued about.

---

## 0. The claim under test

Four "faces" were asserted to be one property:

| face | statement as given |
|---|---|
| algebraic | commutative + associative merge ⇒ order of contributions doesn't affect the result |
| probabilistic | local hidden variable model ⇒ CHSH ≤ 2 |
| geometric | zero holonomy ⇒ flat; angle defect IS curvature |
| distributed | CALM: coordination-free ⟺ monotone |

The strong form:

> **A coordination-free (monotone/CRDT) computation IS a local hidden variable model, with the shared
> state as λ. Coordination-free ⟺ inside the local polytope.**

And the corollary:

> `CoOwnedCorner.Merge = WSet.plus >> consolidate` (PR #11692) is **flat by construction** — it buys
> order-independence by giving up history-dependence — whereas disagreement-preserving structures
> (DV2 unreconciled satellites, Dynamo siblings, SPPF) are path-**dependent**, have holonomy, and
> therefore "curve."

---

## 1. The in-repo checks come first, and three of them break the claim's premises

The brief said a broken attribution outranks a broken analogy. It does, and there are three.

### 1.1 `CoOwnedCorner` does not require commutativity. It is shipped with a non-commutative instance.

`src/Core/SoftScheduler.fs:164-200`. The type's contract, verbatim:

```
/// **Required: associativity.** `Merge (Merge a b) c = Merge a (Merge b c)`.
/// **Optional, and the caller's to declare (DV2 #6):** commutativity and idempotence. A corner
/// with both is a join-semilattice (CRDT, Shapiro et al. 2011) and is reorder- and
/// redelivery-safe; `appendCorner` has neither and is therefore order-sensitive by construction.
/// This type does not pretend otherwise.
```

`appendCorner` (line 199) is `cornerOf [] (fun left right -> left @ right)` — the **free monoid**,
which is the maximally path-*retaining* structure there is: it stores the entire order of arrivals
and nothing else. It is a legal, shipped `CoOwnedCorner`.

So "our four-corner tick-boundary merge is flat by construction" is not a statement about
`CoOwnedCorner`; it is a statement about *one instantiation* of it. Measured:

```
appendCorner (shipped, SoftScheduler.fs:199):
  merge [a] [b] = ["a","b"]
  merge [b] [a] = ["b","a"]
  commutative? false
```

**Finding F1 — the corollary is false about the type.** The corner is an associative monoid, not a
commutative one, and the file already says so in the sentence *"This type does not pretend otherwise."*

### 1.2 The `WSet` corner is not idempotent, so it is not a CRDT join and not a semilattice.

`Merge = WSet.plus >> consolidate` where `plus` is list append (`src/Core/WSet.fs:55`) and
`consolidate` sums weights per key over the ring (`WSet.fs:42-47`). Over ℤ:

```
WSet corner (Merge = WSet.plus >> consolidate), the shipped FIN-4 instance:
  merge x x = [["k",2]]   idempotent? false
  commutative? true
```

It is a commutative **group** (it has `WSet.negate`), which is exactly why it can carry retractions —
and the repo already contains the one-line theorem that makes this forced rather than accidental,
in `src/Core/BeliefConvergence.fs:57-59`:

> *"An idempotent group is trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both
> redelivery-safe and retraction-capable."*

**Finding F2 — the claim's own premise fails at its flagship instance.** The face labelled
"monoid / CRDT join" conflates two different algebras. A commutative monoid gives *reorder*-safety;
a join-semilattice gives reorder- **and** redelivery-safety. The WSet corner is the first, never the
second, and cannot be the second while it retracts. `BeliefConvergence.observe` is the same case and
says so at `BeliefConvergence.fs:29-32`: *"NOT IDEMPOTENT — stated here because the omission reads as
a guarantee."*

### 1.3 A commutative *and* idempotent corner still does not make `driveF` order-independent.

This is the one that actually matters, and it is not an abstract point. `driveF`
(`SoftScheduler.fs:251-281`) passes the accumulator **into** the handler:

```fsharp
let! res = h.RunF intr coOwned ctx state     // handler READS the corner-so-far
match res with
| Ok(s, contribution) ->
    state <- s
    coOwned <- corner.Merge coOwned contribution
```

So the summands are not fixed values; they are *functions of the partial sum*. I transcribed the loop
faithfully and ran it with a **genuine join-semilattice** corner (set union — commutative, associative,
idempotent, a real CRDT join):

```
corner is a join-semilattice? commutative+idempotent+associative:
  comm: true
  idem: true
driveF [H1;H2] = [2,["a","b","saw-a"]]
driveF [H2;H1] = [2,["a","b","saw-b"]]
ORDER-INDEPENDENT? false
```

**Finding F3 — the algebraic face, as stated, is false.** "Commutative + associative merge ⇒ order of
contributions doesn't affect the result" holds only when the contributions are **fixed** — independent
of the accumulator. That side condition is not optional decoration; it is the entire content. The repo
already knows this and states it more precisely than the claim does
(`BeliefConvergence.fs:13-22`): order-independence holds *"for ANY fixed likelihoods… Independence was
sufficient; the real condition is fixed (state-independent) likelihoods,"* and the boundary is *"a
state-dependent / nonlinear revision — where the update depends on the current belief."*

`driveF` is on the wrong side of that boundary by construction, because reading the corner is the
feature the corner was added for. The corrected statement is:

> A commutative monoid makes the *merge* order-insensitive. It does **not** make a *fold* whose
> summands read the accumulator order-insensitive. Those are different theorems, and only the first
> one is about the algebra.

### 1.4 What did check out

- `BeliefConvergence.observeAll` is a left fold of pointwise multiplication — commutative and
  associative, so order-independent **for fixed likelihoods**, exactly as documented, and explicitly
  non-idempotent. No overclaim found; the file's own honesty notes are stronger than the brief's
  summary of it.
- `SocietyUsefulWork` carries the ΔU aggregation under pairwise ρ as attributed
  (`expectedSocietyIdentical`, `expectedGain`, the Gaussian copula), and it is scoped honestly:
  *"Metered boundary: metered as MATHEMATICS. Whether any real fleet satisfies the regime (its actual
  rho and c) is UNMEASURED."* Nothing in it bears on path-independence, and it was not used below.
- `WSet.plus` is commutative post-`consolidate`, as measured above. Confirmed.

---

## 2. Fracture line 2 — "path-independence of composition" vs "zero holonomy": **broken, both directions**

I most suspected this one too, and it breaks harder than expected: not by a missing bundle, but
because **flatness and commutativity are independent properties**, and each has a two-line
counterexample.

A discrete connection (Wilson 1974, lattice gauge theory — the object that *does* give a monoid-like
structure a genuine holonomy, so this is not a pun about the word "path") is: a graph, a group `G`,
a label per directed edge; the holonomy of a loop is the ordered product of labels around it.
**Flat** = every contractible loop has holonomy = identity.

Computed, not asserted:

```
A. abelian group, is it commutative?        true
A. plaquette holonomy (flat would be 0):    1   => flat? false
B. S3 non-abelian?                          true
B. plaquette holonomy of trivial conn:      012 => flat? true
```

- **A** is ℤ/4 — abelian — with one nontrivial link on one plaquette. Commutative, **curved**. This is
  not a contrived case: it is U(1) lattice gauge theory, i.e. **magnetic flux**, the most familiar
  curved abelian connection in physics.
- **B** is S₃ — non-abelian — with the trivial connection. Non-commutative, **flat**.

**Finding F4 — commutative ⇏ flat and flat ⇏ commutative.** The identification fails in both
directions. The reason is structural and worth stating plainly: *commutativity is a property of the
group; flatness is a property of the assignment of group elements to edges.* A monoid has the first
kind of data and none of the second. There is no connection on `CoOwnedCorner` because there is
nothing that varies from edge to edge — which is the honest version of the brief's suspicion.

### What commutativity actually buys, geometrically

There *is* a surviving fragment, and it is precise. Measured:

```
C. abelian: # distinct holonomies over all 6 edge orders = 1   [2]
C. S3:      # distinct holonomies over all 6 edge orders = 3   ["021","210","102"]
```

Commutativity makes the holonomy depend only on the **multiset** of edges, not their order. In the
standard language: for abelian `G`, `Hom(π₁, G) = Hom(H₁, G)` — holonomy factors through the
abelianization, so it is a **homology** invariant rather than a **homotopy** one.

> **Surviving geometric claim (register: `unmetered`, structural not numerical).** Commutativity of a
> merge corresponds to *holonomy factoring through H₁* — path-independence **up to homology** — and
> **not** to flatness. Flatness (holonomy ≡ identity) corresponds instead to the merge that always
> returns the identity, i.e. `unitCorner`, which the source calls *"a handler with no corner."*

That last sentence is the sharpest correction available to the corollary. Under the only faithful
reading of "flat," the flat corner is the one that **carries no information at all** — not the WSet
one, which accumulates and therefore has nontrivial holonomy in exactly the sense being invoked.

The genuinely correct anchor for "the result depends only on the multiset of actions" is not
differential geometry at all: it is **confluence / the diamond property** (Newman 1942;
Church–Rosser 1936) in rewriting theory, and — for the higher-categorical reading of commutativity as
a two-dimensional filling — **Eckmann–Hilton (1962)**. Both are checked-entailment anchors for the
statement actually being made. Descartes' angle defect and discrete Gauss–Bonnet are correct
statements *about surfaces with a Levi-Civita connection*; there is no metric on a merge monoid, so
they do not transfer.

---

## 3. Fracture line 3 — "the shared state is λ": **fatal, and for two independent reasons**

### 3.1 Writing to λ is signalling, which is the assumption Bell's bound needs

In a local hidden variable model, `λ` is drawn once from `ρ(λ)` and **read** by both parties;
the factorization `P(ab|xy) = ∫ρ(λ) P(a|x,λ) P(b|y,λ) dλ` says each outcome depends on the local
setting and λ, and on **nothing of the remote setting**. In a CRDT, both parties **write** the shared
state and each other's writes become visible. A write that the other party can read before producing
its output is a channel from `x_A` to `b` — which is precisely the dependence the factorization
forbids. **A CRDT that has converged has, by definition, communicated.** Two replicas that have never
exchanged a message have not converged; two that have are not the non-communicating parties Bell's
framework is about.

There is one rescue and it must be named to be killed: take λ = the *entire eventual message
transcript*, so both final states are deterministic functions of λ. Then the correlations are local —
but see §3.3, where that move destroys the claim by proving far too much.

### 3.2 Bell's content is *incompatibility*, and a CRDT has none

Fine's theorem (Arthur Fine, *Hidden Variables, Joint Probability, and the Bell Inequalities*, PRL 48
(1982) 291) is the checked anchor here, and it is decisive. Fine proves the equivalence of:
a deterministic local hidden-variable model ⟺ a factorizable stochastic model ⟺ **the existence of a
single joint distribution over all four observables** returning the experimental probabilities ⟺ the
CHSH inequalities hold.

So Bell locality is a **joint-distribution-existence** condition (a Fréchet compatibility condition on
marginals), and CHSH is non-trivial *only because* `x` and `x'` cannot be measured on the same system.
That is the whole source of the bound.

A CRDT has no incompatible observables. You can read the converged state under every "setting" you
like, simultaneously, as many times as you want — reads are non-destructive and commute. Therefore a
joint distribution over all four observables **exists by construction**, and by Fine's theorem
CHSH ≤ 2 **trivially and always**.

**Finding F5 — the probabilistic face is not merely wrong, it is vacuous.** A check that cannot fail
is not a check (`toy-is-free-metered-must-be-earned`; the vacuity class). "Coordination-free ⟹ inside
the local polytope" is satisfied for a reason that has nothing to do with coordination-freedom.

### 3.3 The biconditional: one direction false, the other vacuous

> **Coordination-free ⟺ inside the local polytope.**

- **(⟸) is FALSE.** Two-phase commit, Paxos, and a global lock are all *maximally coordinating*, and
  all of them are inside the local polytope — they are deterministic functions of a shared transcript,
  which is the textbook definition of a local model. Being in the local polytope therefore does not
  imply coordination-freedom.
- **(⟹) is TRUE but carries zero information**, for the same reason: the local polytope contains
  **every classical correlation there is**. Classical shared randomness plus local deterministic
  response *is* the definition of a local model.

This is precisely the numerology test done properly. The rule asks: *what else has this structure?*
Answer: **everything classical does.** "48 roots" failed to identify D₄⊕D₄ because F₄ also has 48;
"inside the local polytope" fails to identify coordination-freedom because 2PC is also inside it. No
invariant was offered that excludes the competitor, and there is none, because the competitor class is
the whole classical world.

### 3.4 Our own repo already contains the counterexample to the mapping

`src/Core/BellTest.fs` stages a CHSH violation from a shared seed and documents why:

> *"Bell's bound of 2 assumes the measurement settings are statistically independent of the system. Our
> **seed is the shared common cause**… with full seed control you can reach the algebraic maximum
> `S = 4`, beyond Tsirelson's `2√2`."*

If "shared state = λ" were a faithful mapping, a shared-seed substrate would be pinned at S ≤ 2. Ours
reaches S = 4 in a shipped, deterministic harness. What that shows is that our shared state correlates
the **settings** as well as the outcomes — measurement independence fails — which is the second Bell
assumption, and it fails for exactly the reason §3.1 gives: the parties choose what to do based on
what they read.

### 3.5 If any polytope, it is the wrong one

The steelman of the distributed claim is *"my visible output does not depend on your setting"* — and
that is **no-signalling**, not locality. The no-signalling polytope strictly contains the local
polytope; the gap is where quantum correlations (Tsirelson `2√2`) and PR boxes (`S = 4`) live
(Popescu & Rohrlich 1994 — already cited, correctly, in `BellTest.fs`). Coordination-freedom, on its
best reading, maps onto the **outer** polytope, and mapping it onto the inner one erases the only
interesting distinction in the picture.

### 3.6 A citation correction

The claim table attributes "CHSH ≤ 2" to **Bell 1964**. Bell 1964 gives a different inequality
(`|P(a,b) − P(a,c)| ≤ 1 + P(b,c)`), which requires a perfect-anticorrelation assumption. `S ≤ 2` is
**Clauser, Horne, Shimony & Holt 1969**. Minor, but an anchor that is cited and not checked is the
failure mode `anchor-to-human-prior-art` exists to catch.

---

## 4. Fracture line 4 — directionality: **a real category difference, plus a model-relativity the claim omits**

CHSH bounds a **joint distribution** over outcomes: a point in a convex polytope of correlation
vectors. CALM bounds a **class of queries**: which functions admit a coordination-free implementation.

Ameloot, Neven & Van den Bussche (JACM 2013) proved the CALM conjecture for *relational transducer
networks*, where "coordination-free" is a specific technical property — roughly, the network computes
the query correctly on **any** distribution of the input without needing to know the distribution
(and the syntactic class of *oblivious* transducers captures the same queries). Two consequences the
claim does not carry:

1. **It is a statement about deterministic queries in one model**, and the follow-up literature
   (Ameloot, Ketsman, Neven & Zinn, *Weaker forms of monotonicity for declarative networking*) exists
   precisely because varying what transducers know varies the captured class. "Coordination-free ⟺
   monotone" is **model-relative**, not a law of nature. Hellerstein & Alvaro's 2020 CACM restatement
   is careful about this; the four-row table is not.
2. **No translation exists** from "query" to "correlation vector." To bridge, someone would have to
   exhibit a map sending a monotone query to a point in the local polytope and a coordinating query to
   a point outside it. §3.3 shows no such map can exist, because *everything* classical lands inside.

**Finding F6 — no bridge; a shared proof *pattern*, not a shared object.** What Bell and CALM share is
a schema: *"if the answer must be recoverable from a factorized decomposition, then this is
impossible."* That is a genuine and useful resemblance at the level of **proof technique**. It is not
an identification of objects, and treating it as one is the move the numerology rule names.

---

## 5. Fracture line 1 — idempotence asymmetry: **holds, and it is not orthogonal**

The brief asked whether the extra CRDT structure breaks the correspondence or is orthogonal to it.
Answer: it does not break the Bell correspondence (that was already dead by §3), but it is **not**
orthogonal — it breaks the claim's internal coherence, because the four faces are not even quantified
over the same algebra:

| face | algebra it actually needs |
|---|---|
| "order doesn't matter" | commutative **monoid** |
| "redelivery doesn't matter" | **join-semilattice** (adds idempotence) |
| "retraction is possible" | commutative **group** (forbids idempotence — an idempotent group is trivial) |
| Bell LHV | no algebraic structure at all; a measure on λ and a factorization |

Rows 2 and 3 are mutually exclusive. The claim's "monoid / CRDT join" cell silently ranges over all
three, and our shipped code sits in row 3 (§1.2), which is the row that **cannot** be a CRDT join.

---

## 6. Fracture line 5 — the corollary's own terms: **broken; all four cells are populated**

The corollary asserts a trade: *order-independence is bought by giving up history-dependence.* That is
an asserted correlation with no competitor excluded. The 2×2 is fully populated, with named instances:

| | **order-independent** | **order-dependent** |
|---|---|---|
| **retains history** | G-Set / OR-Set union; **Dynamo sibling sets**; SPPF parse forests (Tomita 1985) — the merge is set union, which is commutative *and* idempotent | **`appendCorner`** (`SoftScheduler.fs:199`), the free monoid — retains the entire order and is non-commutative |
| **discards history** | LWW-Register (Shapiro et al. 2011), G-Counter max-merge — forgets nearly everything, still a semilattice | `BeliefConvergence.sharpen` (`BeliefConvergence.fs:73`) — state-dependent, forgets, does not commute |

**Finding F7 — the corollary's contrast class is inverted.** Dynamo siblings and SPPF forests were
offered as the *path-dependent, curved* examples. They are the opposite: retaining concurrent versions
is the standard technique for **making a merge commutative**. You buy order-independence by keeping
*more*, not less. And `appendCorner` — the corner in our own file that retains the most — is the one
the file itself labels *"order-sensitive by construction."*

Also, three terms are used interchangeably in the corollary and are three different things:
**history-dependence** (does the state retain the past?), **path-dependence** (does the result depend
on the order?), and **holonomy** (does transport around a closed loop return you changed?). The table
above separates the first two. Holonomy is the third and needs a connection, which §2 shows is absent.

---

## 7. What survives

Stated plainly, per the brief. The surviving claim is much smaller than the one proposed.

### S1. The algebraic face, with its side condition restored — register: **metered**

> A commutative, associative merge makes the **merge** insensitive to the order of its arguments. A
> **fold** is order-insensitive iff, in addition, each contribution is **independent of the
> accumulator**.

Falsifier: the measured `driveF` run in §1.3 flips the verdict when the side condition is dropped,
using a genuine join-semilattice. In-repo, the same boundary is pinned by `BeliefConvergence`'s
`observe` vs `sharpen` tests. This is the only one of the four faces that is a theorem about our code.

### S2. Commutativity is a homology-level path-independence, not flatness — register: **unmetered**

> For an abelian structure group, holonomy factors through `H₁` — the holonomy of a loop depends on
> the multiset of its edges, not their order. This is **not** flatness, and flat ⇎ commutative.

Computed both counterexamples (§2). Register is `unmetered` rather than `metered`: the counterexamples
falsify the *identification*, but nothing in our substrate is yet instrumented as a connection, so the
positive half is a structural statement without a measurement attached. What else has this structure:
every abelian gauge theory, which is why "abelian ⇒ flat" is a well-known error and not a subtle one.

### S3. Bell and CALM share a proof *schema* — register: **toy** (a generator, explicitly not a conclusion)

> Both are of the form *"if the answer must be recoverable from a factorized decomposition, some
> outcomes become unreachable."* Bell factorizes a joint distribution over λ; CALM factorizes a
> computation over network partitions.

Recorded as a **coincidence with its register attached**, exactly as `numerology-vs-number-theory`
prescribes for a resonance that has not found its structure. It is a legitimate place to look. It is
not a fact about either object, and it is load-bearing for nothing.

### S4. The one thing that would promote S3 — named so the entry can be promoted later, or stay a coincidence forever

A map sending queries to correlation vectors such that **monotone ↦ inside** and **non-monotone ↦
outside** the local polytope. §3.3 shows the natural candidate cannot work (everything classical is
inside), so a promotion would need a *different* polytope — plausibly a communication-complexity or
no-signalling one, where the classical world is not already the whole space. Until someone exhibits
that map, S3 stays `toy`.

### What does not survive, in one line each

- **"A coordination-free computation IS a local hidden variable model, with the shared state as λ."**
  Refuted (§3.1 writes to λ are signalling; §3.2 no incompatible observables ⇒ Fine gives CHSH ≤ 2
  vacuously; §3.4 our own harness reaches S = 4 from a shared seed).
- **"Coordination-free ⟺ inside the local polytope."** ⟸ false (2PC is inside); ⟹ vacuous (everything
  classical is inside).
- **"Zero holonomy ⟺ commutative merge."** Refuted in both directions by computed counterexamples.
- **"Our four-corner merge is flat by construction."** False about the type (associative only,
  `appendCorner` shipped non-commutative), false about the flagship instance (non-idempotent, a group,
  not a CRDT join), and false about the driver (order-dependent even with a semilattice corner).
- **"It buys order-independence by giving up history-dependence."** Inverted; all four cells populated.
- **"Disagreement-preserving structures are path-dependent and curve."** Backwards — sibling sets
  merge by union, the most order-independent operation available.

---

## 8. Applying the rule the brief invoked, to this session

Per `numerology-vs-number-theory`'s own worked-instance discipline:

| connection | status |
|---|---|
| `CoOwnedCorner` requires associativity only; `appendCorner` non-commutative | **verified** — read from source, measured |
| WSet corner non-idempotent ⇒ not a join-semilattice | **verified** — computed; and forced by the in-repo idempotent-group theorem |
| `driveF` order-dependent with a genuine semilattice corner | **verified** — transcribed the loop, ran both orders, they differ |
| abelian ⇏ flat, flat ⇏ abelian | **verified** — plaquette holonomy computed for ℤ/4 and S₃ |
| Fine 1982 ⇒ CHSH vacuous absent incompatible observables | **verified against the theorem's statement** (the four-way equivalence), not merely cited |
| 2PC is inside the local polytope | **structural** — follows from the definition of a local model; no separate measurement |
| commutativity ⇒ holonomy factors through H₁ | **structural** (abelianization); the strongest of the surviving fragments |
| Bell/CALM shared proof schema | **resonance** — recorded as a generator with its register, load-bearing for nothing |

**The density of the original four-way match was itself the warning.** Four independent fields
agreeing is either a deep theorem or one observation counted four times. It was the second: the shared
element is the English word *"path,"* plus the genuine but generic fact that many impossibility proofs
factorize something. Three of the four faces are true statements in their own fields — Fine's theorem,
Wilson's holonomy, and CALM are all real and all correctly stated *there*. What failed was the
transport between them.

## 9. Anchors (checked for entailment, not cited)

- **Fine, A. (1982)**, *Hidden Variables, Joint Probability, and the Bell Inequalities*, PRL 48, 291.
  Checked: gives the four-way equivalence including **joint-distribution existence**, which is the
  step §3.2 rests on. Entails the vacuity result; does not entail anything about merges.
- **Clauser, Horne, Shimony & Holt (1969)** — the `S ≤ 2` inequality. Corrects the brief's attribution
  to Bell 1964, whose inequality is a different one.
- **Popescu & Rohrlich (1994)** — PR boxes; the no-signalling polytope strictly contains the local
  polytope. Already cited correctly in `src/Core/BellTest.fs`.
- **Wilson, K. (1974)**, *Confinement of quarks* — the plaquette/holonomy construction used in §2.
  Checked: it is the object that gives a *graph plus group* a genuine holonomy, which is why §2 is a
  counterexample and not a pun.
- **Ameloot, Neven & Van den Bussche (JACM 2013)** — CALM for relational transducer networks. Checked:
  the theorem is about **deterministic queries in a specific transducer model**; the follow-up work on
  weaker monotonicity exists because the captured class moves with the model.
- **Shapiro, Preguiça, Baquero & Zawirski (2011)** — CRDTs; the join-semilattice requirement is
  commutativity **and** idempotence **and** associativity. Cited in `SoftScheduler.fs` already, and it
  is the citation that makes §1.2's finding a discrepancy rather than a quibble.
- **Newman (1942)** / **Church–Rosser (1936)** — confluence; the correct anchor for "the result depends
  only on the multiset of steps." **Eckmann–Hilton (1962)** — commutativity as a 2-dimensional filling,
  the honest higher-categorical reading of "path-independence."
- **Descartes / discrete Gauss–Bonnet** — correct about surfaces with a Levi-Civita connection.
  Does not transfer: there is no metric on a merge monoid.

## 10. Pointers

- `src/Core/SoftScheduler.fs:164-281` — `CoOwnedCorner`, `appendCorner`, `unitCorner`, `driveF`.
- `src/Core/BeliefConvergence.fs:29-64` — the non-idempotence note, the fixed-likelihood condition,
  the idempotent-group theorem, and `sharpen` as the stated boundary.
- `src/Core/WSet.fs:42-55, 105` — `consolidate`, `plus`, `negate`.
- `src/Core/BellTest.fs` — the shared-seed CHSH harness reaching `S = 4`; §3.4.
- `docs/research/2026-08-17-t-feedback-in-the-co-owned-fourth-corner-at-the-tick-boundary.md` — the
  design this refutation is about (PR #11692). Nothing in it is contradicted; the design says
  "associative," and it is the *summary* of it that overreached.
- `.claude/rules/numerology-vs-number-theory.md` · `.claude/rules/toy-is-free-metered-must-be-earned.md`
  · `.claude/rules/anchor-to-human-prior-art.md` — the three disciplines this doc is an application of.
