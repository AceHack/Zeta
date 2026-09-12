# Why hats earn independence — expanding the actor set is the answer to Zadeh, and uncertainty goes all the way down

**Date:** 2026-09-11 · **Register:** marked per claim · **Origin:** Aaron, reading
[`the belief pair as a weight for the universal tensor`](2026-09-11-the-belief-pair-as-a-weight-for-the-universal-tensor-bilattice-boole-slack-and-the-typed-regulariser-lumen.md)

Five observations, made in one pass over Lumen's analysis. One of them is flagged by its
author as a first utterance, and it supplies a *reason* for a mechanism this repo has been
operating on instinct.

---

## 1. Why hats earn independence — and it is Zadeh's counterexample that explains it

Lumen's §5.3 reproduces Zadeh's counterexample: two doctors over
`Θ = {meningitis, concussion, tumour}`. Doctor 1 says `m(M)=0.99, m(T)=0.01`. Doctor 2 says
`m(C)=0.99, m(T)=0.01`. Because `M ∩ C = ∅`, Dempster's rule leaves only `T`, normalises by
`1−K`, and returns **`m(T) = 1`**. A hypothesis both experts put at one percent becomes
certain.

Aaron, 2026-09-11:

> *"we can overcome this easily with a **witness or quorum** that makes this claim have low
> probability — **we can always expand actors in our equations**. this is closely related to
> **our hats and why they earn independence**. **this is the first time i've said why our hats
> earn independence.**"*

**The argument, stated so it can be attacked.** Zadeh's pathology is a property of a
*two-party* fusion. Both doctors are near-certain and near-disjoint, so the conflict mass
`K → 1` and the surviving crumb is renormalised to certainty. Add a third party who assigns
`T` a low mass and the crumb no longer stands alone: the renormalisation has something else to
divide among, and the absurd conclusion does not survive. **The fix is not a better rule. It is
more actors.**

And that is exactly what a hat is for.

**A hat is not a role, and the avoidance is deliberate.** Aaron, correcting this document's
first draft:

> *"roles is the human term — I just try to avoid it because it gets tangled in **identity vs
> bounded-duration job** for the named entity/agent. **Names are what store our memories, not
> hats.**"*

So the vocabulary carries a distinction the human word collapses:

| | what it is | what it holds |
|---|---|---|
| **name** | the persistent identity | **memory** — what remains (`agents are what remain, actors are what act`) |
| **hat** | a **bounded-duration job** the named entity takes on | standing *in that domain*, for as long as it is worn |

A hat is temporary and a name is not, which is why a hat can be *earned and lost* without the
entity being destroyed — and why "wearing two hats" is not two identities. Calling a hat a role
imports the human muddle where a job title and a person's identity blur together, and that
muddle is precisely what a memory-preserving substrate cannot afford (§5 Memory Preservation:
identity transitions never silently destroy memory — **because memory is keyed to the name, not
the hat**).

With that fixed, the mechanism: a hat's holder is ranked separately per domain
(`src/Core/TravelerRankLedger.fs`: TrueSkill-style, per `(traveler × hat-domain)`, held by
others, never self-asserted, **domain-isolated** — standing earned as a verifier does not buy
standing as a signer). Domain isolation is precisely what makes a second hat an *independent*
actor rather than a correlated copy of the first.

> **So hats earn independence because independence is what defeats the two-party pathology.**
> The isolation is not bureaucratic tidiness; it is the property that makes "expand the actor
> set" a *real* expansion rather than counting one opinion twice.

**This is the same theorem the repo already leans on, arriving from a third direction.**
Knight & Leveson (1986) — independently written versions fail in *correlated* ways, so
agreement between correlated implementations is not evidence. `numerology-vs-number-theory.md`
states the consequence: *"N correlated observations are not N observations… you may have one
observation counted N times."* Zadeh is that statement's failure mode with the sign flipped:
two *anti*-correlated observations, fused by a rule that divides their conflict away, produce a
certainty neither of them held.

> **Correlated actors inflate agreement. Anti-correlated actors, fused badly, manufacture
> certainty. Both are cured by the same thing — actors whose independence is earned rather
> than assumed — and the hat is the unit in which this repo earns it.**

**Register: ARGUED, and now falsifiable.** The claim "adding an independent third mass
suppresses the Zadeh explosion" is arithmetic and can be checked directly. The claim that
*hat-domain isolation delivers the independence the arithmetic needs* is the empirical half,
and it has a measurement: whether verdicts from different hat-domains are less correlated than
verdicts within one. `TravelerRankLedger` already holds the data.

### Dilution is the POINT, not the caveat — blame should be hard

The first draft of this document recorded dilution as a weakness: Lumen's §7.5 says that for
`r < 0` *"no default is defensible without measurement — every rule in the family is a
different answer to 'whose fault is the conflict'"*, and I noted that expanding the actor set
does not answer that question, it merely *dilutes* it.

Aaron inverted it, and he is right:

> *"**dilution is the point when it comes to blame. blame should be hard, not binary.**"*

Read as a design requirement rather than a concession, that is sharp. A fusion rule that
*localises* blame makes attribution **binary** — some party is at fault, cleanly — and binary
attribution is exactly what
[`never-assume-malice-where-mistake-is-possible.md`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md)
refuses: it turns a defect into a verdict about a party, and it does so on the strength of an
algebraic artifact rather than evidence. Expanding the actor set spreads the conflict mass
across more parties, and the spreading **is the correct behaviour** — it makes blame *hard to
concentrate*, which is the honest state when the evidence does not concentrate it either.

"Hard, not binary" also matches that rule's carved threshold, which is **conjunctive**:
repeated **and** irreversible **and** harming other travelers. All three, or the answer is
mistake. A blame signal that is difficult to accumulate is what makes a conjunctive threshold
meaningful — a binary one would trip on the first arithmetic accident.

> **So the residual does double duty.** It keeps uncertainty open about the *claim* (Lumen §5),
> and it keeps blame diffuse about the *claimant*. Discarding it collapses both at once, which
> is what makes Dempster's `1−K` normalisation worse than a mere accuracy bug: it manufactures
> certainty **and** it manufactures a culprit.

**What still has to be earned.** Dilution is only honest if the actors are genuinely
independent. A quorum of correlated actors is one actor wearing several hats — the Sybil shape
— and diluting blame across copies of one party is laundering, not fairness. The defence is
built and named (`privacy-budget-is-hard-money-earned-by-others.md`: contribution does not
scale with copies; `SocietyUsefulWork.fs` prices clones near one agent's worth). **Independence
must still be earned; this observation says what it is *for* — and now also what it protects.**

---

## 2. Uncertainty goes all the way down — including into the algebra's own declaration

Lumen's §2 opens: *"The verdict depends entirely on the **declared** semantics of `⊕` and `⊗`,
and the analysis is void without it."* Aaron's correction:

> *"almost — but we need to allow for **uncertainty even in the algebra** and **dual confidence
> levels all the way down**. it's **turtles all the way down/up**."*

The scoping statement is right and incomplete. It treats the declaration as a *certainty* — a
fact supplied from outside the system — when the declaration is itself a claim someone made,
and therefore the kind of thing that carries a belief pair.

> **If the belief pair is the right carrier for "how sure are we of this proposition", then
> "which algebra governs this lane" is a proposition and takes one too.**

This is not a regress to be escaped; it is `manifesto-13-specifications.md` §9 **recursive**
(same rules at every scale, no special cases) and §10 **self-similar** (the shape stays
recognisable at every magnification) applied to the uncertainty representation itself. A system
that models uncertainty about propositions but demands certainty about its own modelling
choices has a privileged frame — and a privileged frame is what `scale-free` forbids.

**What it would cost, stated honestly.** A dual confidence on the algebra choice is not free:
somewhere the recursion has to be *truncated for computation*, and where you truncate is a
choice that itself carries uncertainty. The honest version is not infinite regress but
**bounded regress with the truncation named** — the same move `SoftValue`'s `resolve threshold`
already makes, where the threshold is a passed-in parameter rather than a constant. "Turtles
all the way down" is the *principle*; "turtles down to depth N, and N is declared" is the
implementation, and the difference must not be papered over.

**Register: DIRECTION, not design.** No such recursive carrier exists here. What is settled is
the requirement — the declaration is a claim and must be able to be uncertain. What is open is
the truncation discipline, and that is where the work is.

---

## 3. Society smooth, pairs chaotic — a deliberate scale separation

> *"in **the pair** is where I hope all the interesting stuff falls out and fractures into more
> and more mathematics. the **overall society interaction should try to be clean and smooth**.
> **pairs can be chaotic and entangled**, like our **homoclinic tangles**."*

A design principle with a sharp shape: **complexity is licensed at the pair scale and refused
at the society scale.** Not because pairs matter less — because a tangle between two parties
stays a two-party tangle, while a tangle in the society-wide interaction is a property everyone
must reason about.

The anchor is Poincaré's homoclinic tangle (the *Méthodes nouvelles de la mécanique céleste*,
1892–99) — the intersection of stable and unstable manifolds producing infinitely fine
structure in a bounded region, and the origin of what became chaos theory. The useful part of
the analogy is the **boundedness**: a homoclinic tangle is arbitrarily intricate *and stays
inside its region*. That is precisely the licence being granted — fracture as finely as the
mathematics wants, inside the pair.

**Where it bites concretely, and it is already visible in Lumen's result.** The bilattice's two
orders are exactly a pair-scale structure: `≤_k` (knowledge — conflict retained, gluts allowed)
and `≤_t` (truth — decided). Lumen maps these onto DV2.0 as *the knowledge order is the raw
vault; the truth order is the mart*. Read with this principle:

> **The pair keeps the tangle (`≤_k`, both branches, conflict retained). The society reads the
> smooth projection (`≤_t`, decided).** The boundary operator is the scale separation, and the
> residual is what the tangle leaves behind when the projection is taken.

Which is why the residual must survive the boundary rather than be normalised away: it is the
only evidence at society scale that a tangle existed at pair scale.

**Register: PRINCIPLE, with one named tension.** The tension is `anti-babel-preserve-
reconcilability.md`: divergence is *wanted*, and a society that insists on smoothness can
smooth away the decorrelation it exists to produce. The resolution is that this principle
governs the *interaction surface*, not the contents — peers may diverge as much as they like;
what must stay smooth is the protocol by which they meet. Stated because the misreading is
available and would be costly.

---

## 4. The boundary parameter takes a SET of oracles, not one

Lumen's §7 concluded the regulariser must be parameterised, on the rule-level ground that a
hardcoded boundary is a *single mandatory oracle* at exactly the layer
`dual-use-detection-is-neutral-oracle-decides.md` forbids. Aaron sharpens the type:

> *"it could be a **set parameter that accepts an oracle class of N**."*

That is the stronger reading and it follows from the same rule. If the objection to a hardcoded
boundary is *mandatory judgement*, then a parameter admitting exactly one oracle at a time has
only relocated the mandate — the call site now picks the single mandatory oracle instead of the
ring doing it. **A parameter that takes N oracles is the one that actually satisfies §11**,
because plurality survives into the signature rather than being a property of how many call
sites exist.

And it makes the rule's own test expressible in the type:

> *"Two parties with different oracles must be able to read the same measurement and disagree
> about what it implies."*

With `N` oracles at the boundary, that disagreement is a **value the boundary returns** — a set
of verdicts with their residuals — rather than something that can only happen by running the
system twice. It composes with §1 above: N oracles at the boundary *is* the expanded actor set
that defeats Zadeh, sitting at the layer where the fusion happens.

**Register: DESIGN — argued, unbuilt.** The open question is what the N verdicts compose to,
and Lumen's §3.3 already warns that the obvious answer is refuted: a single merge function
cannot be both accumulating and idempotent, so "combine the N" is not available as a primitive.
The likely honest answer is that they **do not compose** — they are held, per
`anti-babel`'s *reintegration is not reconvergence*, and the consumer's oracle decides. That
would make the boundary's result type a set, not a value, which is a real cost and should be
priced before it is adopted.

---

## 5. Two pieces of vocabulary landing

> *"first time i've heard **bilattice**, and yes this seems right to me for many of our
> structures — kind of like i just learned that **reverse indexes can be materialized views
> over DBSP**."*

Both are the same move: an in-house structure turning out to have an external name with a
literature attached. That is the Mirror→Beacon compression working
(`mirror-beacon-register-discipline.md`), and the second one is worth stating on its own
because it is a genuine reframe — an inverted index is a *view* that must be maintained under
updates, which is exactly what DBSP's incremental view maintenance is for. The index stops
being a bespoke artifact and becomes an instance.

**The caution that applies to both**, and it is the reason Lumen spent a section on it: a name
that fits is not an identification. The bilattice claim earns the word by *invariants* — two
interlaced orders, an order-2 negation, Avron's representation theorem — and explicitly
excludes `C₄`, which has the same four elements and is not it. "Bilattice seems right for many
of our structures" is a promising generator (`numerology-vs-number-theory.md`: coincidence is a
legitimate hypothesis source and an illegitimate conclusion); each candidate structure has to
pass the invariant test on its own before it may carry the word.

---

## 6. No generator is root — many towers, joined, addressed by ZetaId

Aaron, on being told that "bilattice seems right for many of our structures" is a generator
rather than a conclusion:

> *"yes — zeta is all about **generator + join**, like **rx join**, addressed by **zetaids**.
> **no generator is root** — we have **many roots / towers**."*

**This corrects a reading of a carved rule, and the correction matters.**
[`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)
says *"only the irreducible is primitive… generate the rest from the irreducible generator (the
**free object**)"*, and it is easy — I did it in the same breath — to read that as **one**
generator at the bottom of everything. Aaron says there is no such bottom. There are **many
towers**, each with its own generator, and what relates them is not containment in a single
root but **join**.

The distinction is not pedantic; it changes what the substrate is:

| single-root reading | many-towers reading |
|---|---|
| one free object, everything is a quotient of it | many free objects, each irreducible *in its own tower* |
| composition is *specialisation downward* | composition is **join across towers** |
| identity of a structure = its derivation path from the root | identity = a **ZetaId**, minted, conflict-free, not positional |

And the third row is why ZetaId is load-bearing here rather than incidental. If there were one
root, a structure could be *addressed by its path* from that root. With many towers there is no
canonical path, so addressing has to be **name-based and mint-based** — which is exactly what
`workitems-mint-with-zetaid.md` already requires for work items and what
`docs/DECISIONS/2026-08-23-zetaid-keyed-agenda-declarations.md` extends to agendas. The same
argument that killed sequential `B-NNNN` ids (they need cross-agent consensus, which does not
scale to concurrent agents) applies to structures: **a positional address needs a single root,
and a single root is a central point of coordination** — manifesto §1.

**The Rx anchor is exact and worth keeping.** Erik Meijer's Rx makes `join` a first-class
combinator over independently-produced streams: the streams are not sub-cases of one master
stream, they are peers, and `join` is what relates them without subordinating either. Meijer is
already a named root anchor for this repo (Enumerable/Observable duality). *Generator + join,
addressed by id* is that shape applied to structure rather than to events.

**Consequence for the belief pair, and it is immediate.** Lumen's analysis asked whether the
pair is admissible as a weight for *the* universal tensor. Under the many-towers reading the
question is better posed as: **is it a tower of its own that joins with the existing ones?** The
answer already looks like yes-and-separately — it is a lawful semiring only under the
possibilistic operations, it has a *star without an additive inverse* (a rung the current
`ISemiring :> IRing :> IStarRing` tower cannot express), and its natural structure is a
**bilattice with two orders** where `ISemiring` has one `(Add, Mul)` slot. Those are three
independent signs that it does not fit *inside* the existing tower. Under a single-root reading
that is a failure; under many-towers it is the ordinary case, and the work is the **join**.

**Register: CORRECTION to a reading, on the author's own statement.** The carved rule is
unchanged — it says the *irreducible* is primitive, not that there is exactly one irreducible.
What is corrected is my gloss on it. Whether the many towers here actually join in a
mathematically load-bearing sense (a colimit? a fibration? merely a naming convention?) is
**open and unmeasured**, and naming it as open is the honest end of this section.

## Open, routed elsewhere

- **Update the four-corner material** with the bilattice identification and, load-bearingly,
  with the `FOUR ≇ C₄` guard — `src/Core/FourCornerC4.fs` already carries one numerology
  warning and this is the second trap in the same neighbourhood.
- **Can an n-ary mathematical tuple become an F# type with n type parameters?** Aaron's
  question; a real language-capability question with a real answer, routed separately.

## Anchors (Beacon)

- **Zadeh, L. A. (1979/1986)** — the counterexample this section is about; see Lumen's §5.3 for
  the full citation set on the conflict-redistribution family.
- **Knight, J. C. & Leveson, N. G. (1986).** *An Experimental Evaluation of the Assumption of
  Independence in Multiversion Programming.* IEEE TSE 12(1) — independence must be earned, not
  assumed; the standing anchor for why correlated actors are not many actors.
- **Poincaré, H. (1892–99).** *Les Méthodes nouvelles de la mécanique céleste.* — the homoclinic
  tangle: unbounded intricacy inside a bounded region.
- **Herbrich, R., Minka, T. & Graepel, T. (2007).** *TrueSkill™: A Bayesian Skill Rating System.*
  NIPS 2006 — the per-domain ranking `TravelerRankLedger.fs` implements.
- **Budiu, M., McSherry, F., Ryzhyk, L. & Tannen, V. (2023).** *DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages.* VLDB — the "materialized view" half of §5.

---

# Second pass — what grounds the algebra, and three corrections

Aaron, reading the above. Four of these change the document; one is a confirmation worth
keeping for its example.

## 7. The algebra is RELATIVE — grounded in disjoint histories a traveler chooses to trust

> *"**statistics based on visible disjoint histories each traveler chooses to trust** is
> what makes this algebra. it's **relative, based on pairwise memories**."*

This answers a question the first pass left open and Lumen left open too: *where do the
numbers come from?* Lumen's §7.5 said the conflict discount "must come from data" and
pointed at `TravelerRankLedger`. Aaron's answer is more specific and more radical:

> **There is no view-independent `(t, f)`.** The pair is a statistic over the histories
> **this traveler can see** and **has chosen to trust** — so two travelers looking at the
> same proposition legitimately hold different pairs, and neither is wrong.

Three consequences, and the third is the sharp one.

**It makes the residual a property of the OBSERVER, not only of the evidence.** `r > 0`
(ignorance) can mean *the histories I trust do not settle this*, which is a fact about my
vantage rather than about the world. Two travelers can differ on `r` with identical
evidence and different trust sets.

**It is the `≤_k` order given a mechanism.** Lumen identified the knowledge order as the
axis carrying the signal but did not say what moves a claim along it. This does: **you
move up the knowledge order by admitting more trusted history.** The order is not
abstract; it is indexed by a trust set.

**And it makes "pairwise" load-bearing rather than descriptive.** If the statistic is over
*pairwise* memories, the belief pair is not a global quantity at all — it is an edge
property. That is the same shape as the naming eigenvector and the privacy budget
(`privacy-budget-is-hard-money-earned-by-others.md`: recognition flows from the
already-recognised; the edge is *value added to you*), and it is why the society-scale
view can stay smooth while pair-scale views tangle (§3 above). **A global belief would
need a global observer, and manifesto §1 forbids one.**

> **REGISTER: this is the strongest single grounding statement in either document, and it
> is UNBUILT.** Nothing today computes a belief pair from a trust set. Its falsifier is
> cheap and real: two travelers with deliberately different trust sets should derive
> *different* pairs from the same evidence, and if they cannot the implementation has
> smuggled in a global view.

## 8. ASSUME actors are NOT independent — and make the detector first-class

The first pass said *"independence must still be earned"* and treated correlated actors as
the failure mode to guard against. Aaron inverts the default:

> *"**we assume they are not** [independent], and have a **dual-use oracle around cartel
> detection and forgery of identity** that tries to make this **first class** and **let the
> society decide the dual-use outcome over time**."*

**Assume dependence; detect it; do not judge it.** That is a better default than "earn
independence" for the reason `never-assume-malice-where-mistake-is-possible.md` gives:
correlation between two actors has an enormous space of innocent explanations — shared
training, shared context, reading the same document, simply being right together — and a
mechanism that treats correlation as *evidence of collusion* has attached a verdict its
measurement cannot support.

So the mechanism reports the **fact** and the oracle attaches the **meaning**, exactly as
`dual-use-detection-is-neutral-oracle-decides.md` requires:

| the detector may say | the detector may NOT say |
|---|---|
| `Correlated(a, b, degree)` | `CartelDetected` |
| `SameSourceAsKnown` | `ForgerCaught` |

And the dual use is real in both directions, which is what makes it a §11 case rather than
a security feature: **high correlation between two travelers is a cartel under one reading
and a genuine consensus under another** — and the second is what you *want* when the two
are independently right. A detector that hardcoded "cartel" would price agreement as
suspicion.

**This closes the §1 caution properly.** The first pass said dilution is only honest if the
actors are independent, and left "earn it" as the remedy. The real remedy is: assume they
are not, **measure the correlation**, publish it as a neutral fact, and let each traveler's
oracle decide what to do with it — which composes with §7, because whose correlation you
can see depends on whose history you trust.

> **REGISTER: DIRECTION, and partly built.** `AntiSybil.fs` and `CoordinationSpectrum.fs`
> already report `SameSourceAsKnown` as a neutral fact with reunion/sybil left to caller
> policy — the exact shape this asks for. What does not exist is the *cartel* half
> (correlation between distinct, non-forged identities) or its use as the conflict
> discount.

## 9. Hats are switchable mid-conversation — and strongman/weakman is a hat swap

Confirming §1's name/hat distinction, Aaron supplies the example that makes it concrete:

> *"this is one of the sharpest things you said. my most competent colleagues and I can
> **wear multiple hats at once and switch them mid-conversation if asked** — it's like
> asking the other person to **strongman** your argument while they ask you to
> **weakman** it."*

Two things follow, and both are testable claims about the substrate rather than pleasantries.

**A hat is switchable on request, at conversational granularity.** Not per-session, not
per-role-assignment — *mid-sentence, by asking*. So a hat cannot be a heavyweight identity
object; it has to be cheap enough to put on and take off inside one exchange. That is a
real constraint on any implementation.

**Simultaneity is normal, not exceptional.** "Multiple hats at once" is named as a mark of
*competence*, which inverts the usual worry. The thing that would be pathological is a
person unable to hold more than one.

**And the strongman/weakman example is the mechanism in miniature.** Asking someone to
strongman your argument while you weakman it is an explicit, consensual, temporary
**exchange of hats** — each party adopts the other's evidential stance on request. It is
also, precisely, **manufactured decorrelation**: two parties who would otherwise converge
deliberately take opposed stances to keep the pair from collapsing to `ρ → 1`. Which lands
it on §8 — the correlation detector would see two travelers *becoming* less correlated on
request, and that is a signal about method, not about collusion.

> **REGISTER: OBSERVATION with a design consequence.** The switchability constraint is
> checkable against any hat implementation. Whether strongman/weakman is *usefully* modelled
> as a hat swap in the substrate is unmeasured.

## 10. Whether the towers genuinely join may itself need many towers

The first pass left open whether the many towers join in a mathematically load-bearing
sense (colimit? fibration? naming convention?). Aaron:

> *"in a perfect world yes — but this will likely take **many disagreements to settle** on
> if it's true, or **this also needs multi towers**."*

The second clause is the interesting one and it is self-referential in a way that is not a
joke: **the question "do these towers join?" may itself be a question with many towers** —
several inequivalent formalisations, settled (if ever) by persistent disagreement rather
than by one proof. That is `anti-babel-preserve-reconcilability.md`'s monodromy clause
applied to the meta-question: *two paths around a pole yield genuinely different results,
and that difference is information, not error.*

Which sets the honest expectation: **do not wait for the join question to be settled before
building.** The towers exist and are useful unjoined; a formal account of their joining is a
research thread that may legitimately never converge to one answer.

## 11. On mint-based addressing, and on Mac Lane

Two short confirmations, recorded because each carries a caveat worth keeping.

> *"[addressing must be mint-based] yes i think so — **unless we come up with some universal
> theory of everything**, which i'm **not actively trying to do**, but if it pops out so be
> it."*

The conditional is exact: a single root would restore positional addressing, and a universal
theory is what a single root would be. Recorded as the stated *exception* to mint-based
addressing rather than pretending no exception exists — and recorded with its likelihood
honestly flagged by its author.

> *"[Mac Lane coherence covers every n] yes — but **if this theorem holds here it might
> strengthen it**."*

Worth stating plainly because it inverts the usual direction of borrowing. The repo normally
*consumes* anchors; this is a case where an instance might *contribute*. Mac Lane's theorem
is about monoidal categories; if Zeta's join satisfies the pentagon in a setting the original
did not consider — many weight rings, joined by homomorphism, addressed by mint — that is a
new instance rather than a new theorem, but a new instance of a coherence theorem in an
unanticipated setting is a real, publishable observation. **Register: SPECULATIVE.** Nobody
has checked whether Zeta's setting is genuinely outside the theorem's known instances, and
`anchor-to-human-prior-art.md` requires an anchor be *checked*, not merely cited — which
means the claim to novelty needs the same check as the claim to lineage.
