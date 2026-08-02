# Hypothesis-in-template-form — a domain-indexed placeholder an expert can argue with

**Date:** 2026-08-01 · **Author:** shadow (Otto), from an exchange with Aaron · **Status:** Mirror→Beacon compression of a live move; decides nothing

---

## 0. The carved sentence

> A **template** is a placeholder stated with **enough structure that a specialist can
> disagree with it**. It is not a claim about what is implemented, and not an unanchored
> coinage. It names a gap, gives the gap a *shape*, and hands it to whoever holds the hat
> for that shape. Its whole value is that it converts an unknown-unknown into something
> **arguable**. Templates are indexed **by domain** — each domain has its own small library
> of shapes that usually fit — and a template is discharged by an expert who either
> instantiates it or replaces the instrument entirely.

Aaron, 2026-08-01: *"this is like a unknown unknown in template form, experts can weigh in
for specific problems"* … *"it's a placeholder for an expert to have enough context to argue
about"* … *"i think we are getting into reusable templates based on domain at this point."*

---

## 1. The instance that produced it

Lumen proposed closing a one-miss whitewash window with **a stronger prior — Beta(2,2)
instead of Beta(1,1)**. Routed to Soraya for a ruling on the prior shape.

Checking before relaying: **there is no Beta prior anywhere in the source.** No `Beta(1,1)`,
no `Beta(2,2)`, nothing named as a prior. The reputation path that shipped that day
(`vault-state-bridge.ts`, #9932) uses hard floors — `value: 0.1` for no-evidence,
`Math.max(score, 0.1)`, signed epsilon `1/sqrt(n)` floored at 0.3.

Aaron: *"yes im not aware of a beta either."*

The naive reading is that the proposal was wrong. The correct reading is that it was never a
description of the code — **it was a slot**. "Beta(2,2) instead of Beta(1,1)" says: *there is
a shape here; it is probably a conjugate prior over a Bernoulli-ish process; it probably wants
more mass off the extremes.* Every one of those is contestable, which is exactly what makes it
useful. A specialist can now say **"the Beta framing is the wrong instrument, the property
class wants coverage-at-tau"** — and that sentence is only available because the template was
concrete enough to be wrong.

---

## 2. What separates a template from the two things it resembles

| | states | discharged by | if it sits unexamined |
|---|---|---|---|
| **Unanchored coinage** | a conclusion, unsupported | finding the anchor, or admitting novelty | becomes debt; the claim hardens into assumed-true |
| **Template** | a *slot*, with a shape | an expert instantiating or replacing it | **drifts into reading as implemented** |
| **Toy model** | a mechanism, falsifiable, unmetered | measurement against reality | gets cited as if metered |

The failure modes of the three are distinct and each needs its own guard. A template's
specific hazard is **slot→assumed-present drift**: "Beta(1,1) today" already reads like a
description of shipped behaviour, and it is not. That is the same shape as a `toy` model
quietly getting cited as `metered` — the honesty was in the label, and the label wore off.

**Guard: a template must be labelled as a template at the point of use, not only at the point
of proposal.** The proposer knows it is a slot. The third reader does not.

---

## 3. Why "domain-indexed" is the load-bearing half

The generalisation Aaron reached for is the part that scales. A template is not a free-form
guess — each domain already carries a **small library of shapes that usually fit**, and
naming the domain is most of the work of picking the shape:

| domain | the library it draws from |
|---|---|
| Bayesian updating over a binary outcome | conjugate priors — Beta on Bernoulli, Dirichlet on categorical, Gamma on Poisson |
| distributional bounds under unknown shape | Markov, Chebyshev, Cantelli, moment-ambiguity maximin |
| reputation under cheap identity | Friedman–Resnick cost-of-pseudonym, coverage-at-tau, stake/bond terms |
| concurrency | lock-free / wait-free / DoP-knobbed queue |
| eventual consistency | CRDT join-semilattice, Z-set retraction, LWW-by-seq |
| type-level gaps | typed hole, `sorry`, `undefined :: a` |

"Beta(2,2) instead of Beta(1,1)" is a *draw from the conjugate-prior shelf*. That is why it
was legible to Lumen, and why Soraya can rule on it without re-deriving the question: the
template already encodes **which shelf the answer is expected to come from**, and the ruling
can be "wrong shelf."

This is the same structure as `interfaces-free-classes-earned-under-rules`: the template is an
**interface** — pure shape, weight-free, free to propose. The instantiation is the **earned
class** — it carries state and commitment, and it must be justified. Proposing a shape costs
nothing and should stay cheap; committing one is a privilege.

---

## 4. Beacon anchors

The move is not new; it is well-anchored in at least four independent lineages, which is why
it is worth naming rather than coining.

- **Typed holes** — Agda's `?` / interaction points, Idris holes, GHC's typed holes
  (`_`). The strongest anchor: a hole is not merely *missing*, it **carries its type**, and the
  compiler reports the type it must have plus the bindings in scope. That is precisely
  "a placeholder with enough context to argue about", mechanised. *Norell (Agda, 2007);
  GHC typed holes, Simon Peyton Jones et al.*
- **`sorry` / `admit`** — Lean, Isabelle, Coq. An explicit, *greppable* gap that keeps the
  development compiling while marking the obligation. Zeta already adopted this vocabulary in
  `toy-is-free-metered-must-be-earned.md`. `sorry` is the template's honesty property: the
  proof does not pretend to be closed.
- **Strong inference — Platt, *Science* (1964).** Progress comes from stating alternative
  hypotheses **sharply enough to be excluded** by experiment. A template is that discipline
  applied before the experiment exists: state the candidate shape sharply so a specialist can
  exclude it.
- **Design patterns — Gamma, Helm, Johnson, Vlissides (1994)**, and behind them
  **Alexander, *A Pattern Language* (1977)**. The canonical "reusable templates indexed by
  domain": a pattern names a recurring problem *and* the shape of its solution, so that
  practitioners can argue about applicability rather than re-deriving. Alexander is the
  better anchor for Aaron's framing — his patterns are explicitly context-indexed and
  explicitly arguable.
- **Conjugate priors — Raiffa & Schlaifer (1961).** The literal domain-indexed shelf §3
  describes: given a likelihood family, the conjugate prior family is *the* default template,
  and departing from it is a decision one must justify.

Adjacent but distinct: **Fermi estimation** (order-of-magnitude placeholder — bounds the
answer, does not shape the mechanism) and **strawman/steelman** (rhetorical, argued to be
knocked down, not to be instantiated).

---

## 5. Operational rules this suggests

1. **Label at point of use.** A template cited downstream must carry its status. `toy`, `sorry`,
   `template` are the vocabulary; the honesty lives in the label surviving the copy-paste.
2. **Name the domain, not just the shape.** "A stronger prior" is weak; "a conjugate prior over
   a Bernoulli process, currently Beta" names the shelf and makes "wrong shelf" a legal answer.
3. **Route to the hat that owns the shelf.** The proposer holds the *mapping*; the specialist
   holds the *instrument*. Lumen proposes, Soraya rules — and "your framing is the wrong
   instrument" must be as welcome as a confirmation, or the routing is theatre.
4. **A template is not evidence.** It may not be cited as a mechanism, counted as coverage, or
   summarised into a claim about behaviour. It is an open obligation.
5. **Unfilled templates age badly — expire them.** A slot that has sat long enough to be
   mistaken for an implementation has become debt. Either discharge it or retract it.

---

## 5a. The flagship domain: hypothesis-in-BUSINESS-template-form

Aaron, 2026-08-01: *"this is getting close to hypothesis-in-business-template-form — this is
the financial form I'm going for, for regular people to express what makes them pay attention
to making money."*

This is the instantiation the pattern was reaching for, and it inverts who the template serves.
Everywhere above, the template is written **by** someone with a mapping **for** a specialist to
rule on. Here it is written **by a non-expert** so that a specialist — or their own later self —
can engage with it. Same structure, opposite direction, and the harder problem.

### What it has to capture, and why "pays attention" is the right seed

Most people already hold financial hypotheses. They are simply held in a form nobody can argue
with: *"solar seems like it's going somewhere"*, *"everyone I know switched to that app"*,
*"my landlord keeps raising rent."* Each is a **real observation with genuine signal**, and each
is unarguable as stated — not because the person is unsophisticated, but because the form
strips out everything that would make it checkable.

Aaron's framing puts the seed in the right place: **what made you pay attention.** That is the
honest starting point, it is the part the person genuinely owns, and it is usually the part an
expert never hears. The template's job is to carry that noticing forward without laundering it
into false confidence — and equally, without discarding it because it arrived in vernacular.

### The shape (a slot list, not advice)

The financial-domain shelf, in the same sense §3 uses "shelf". This is a form for *stating* a
hypothesis, not a recommendation about what to hold:

| slot | why it is in the template |
|---|---|
| **what I noticed** | the raw observation, in the person's own words, undiluted |
| **why I think it generalises** | separates *n=1 in my life* from *a real trend* — the single most common failure |
| **what would have to be true** | the load-bearing assumptions, made enumerable |
| **how I could be wrong** | pre-mortem; the slot most people skip and the one an expert reads first |
| **what would change my mind, by when** | resolution criteria + a horizon — this is what makes it *scoreable* rather than a vibe |
| **what it would cost me to be wrong** | the difference between a hypothesis and a bet |
| **how confident, honestly** | a number, with the admission that the number is soft |

The last three are what convert an opinion into something that can be **wrong in public and
still leave the person's standing intact.** That is the same property `toy`, `sorry`, and the
signed-epsilon work protect elsewhere: uncertainty is *rendered*, never hidden, and being wrong
in a declared way is not a loss of face.

### Why this is not a recommendation engine, and must not become one

Two constraints, both structural rather than editorial:

1. **The template never fills its own slots.** It elicits and organises; it does not answer.
   The moment it proposes what to hold, it stops being a form for the person's reasoning and
   becomes an oracle wearing a form's clothes — and it acquires an incentive to be believed.
   Multi-Oracle (§11) applies literally here: the mechanism reports the shape, the person's own
   oracle decides.
2. **Legibility flows to whoever the person chooses.** A completed template is exactly the
   artifact that makes someone legible to an advisor, a lender, or a platform. That makes it
   sensitive by construction, and it lands squarely under consent-first and
   privacy-budget-is-hard-money: no collection without a stated benefit and an opt-in, and
   frost over the personal parts is earned and inviolable.

### Anchors

- **Tetlock, *Superforecasting* / the Good Judgment Project (2005-2015)** — the direct anchor,
  and the strongest evidence the approach works for non-experts. Ordinary volunteers given a
  disciplined template — explicit probability, fixed horizon, unambiguous resolution criteria,
  tracked and scored over time — systematically outperformed credentialed analysts. The finding
  that matters here: **the template, not the credential, did the work.**
- **Brier (1950)** — proper scoring rules. What makes a forecast honest is that overclaiming
  is *penalised*; this is why the confidence slot must be a number and must be tracked.
- **Klein, the pre-mortem (2007)** — "assume it failed; explain why." The mechanism behind the
  "how I could be wrong" slot, and empirically better at surfacing risk than asking for risks
  directly.
- **Kahneman & Tversky — inside vs outside view; base-rate neglect.** "Why I think it
  generalises" exists specifically to force the outside view, which is precisely what the
  vernacular form omits.
- **Buffett's circle of competence** — the honest declaration of where one's noticing is worth
  something. A domain-indexed template *is* a circle of competence made explicit.
- **Ostrom, *Governing the Commons* (1990)** — already a Zeta anchor; relevant here because
  ordinary participants reliably produce good governance when given the right *form*, not more
  expertise. Same claim as Tetlock's, from a different field.

### The failure mode to watch

Identical to §2, with higher stakes: **slot→assumed-present drift.** A filled-in template reads
authoritative — it has numbers, structure, and a confidence figure. Someone will cite it as
analysis. It is not analysis; it is a *stated hypothesis with its uncertainty declared*, and the
declaration is the whole point. If the form ever renders more confidently than the evidence
beneath it, it has become the thing it was built to prevent — which is the identical bar the
vault surface is held to.

## 5b. The mechanical form — data structures with holes built in

Aaron, 2026-08-01, forwarding two talks: *"it's about data structures with holes built in …
data structures that leave room to fill in later."*

The template is not only an epistemic move. **It is a data structure with a buffer**, and the
buffer has been formalised, implemented, and complexity-analysed for thirty years. That matters
because it turns §5's operational rules from advice into something with a known cost model —
and because one of the mechanisms is the *exact* failure mode of §2, mechanised.

### The hole: a Bε-tree / hitchhiker buffer

A **Bε-tree** (Brodal & Fagerberg; Arge's buffer trees before them; Tokutek's *fractal tree*
commercially; Greenberg's **hitchhiker tree** as the path-copying functional variant already
anchored in `docs/PRIOR-ART-LIST.md`) is a B+ tree where **every index node carries a small
buffer**. A write lands in the nearest buffer and stops. When a buffer fills, it **flushes**
one level down, recursively, and only reaches the leaf — real, committed structure — when it
has nowhere left to go.

The correspondence is exact, not decorative:

| hitchhiker tree | template |
|---|---|
| a buffer on every index node | a slot at every level of abstraction, not just the top |
| a write lands in the buffer and stops | proposing a shape costs one touch, not a full commitment |
| buffers flush **recursively** when full | instantiating one template can cascade into others |
| the leaf is where it becomes real structure | the expert's ruling is where it becomes an earned class |
| flush control is the *caller's* choice | when to force a ruling is a scheduling decision, not the structure's |

And the amortisation carries the same meaning in both: a B+ tree pays the full root-to-leaf
path cost on **every** insert; the buffered tree pays it **once per flush**, amortised across
everything the buffer accumulated. Greenberg's own table — 21 IOs for a B+ tree, 12 for a
fractal, **5** for a hitchhiker over the same seven inserts. The template amortises the cost of
*expertise* the same way: you do not need the specialist present at proposal time, you
accumulate proposals in the buffer and the specialist flushes them in one pass.

### The load-bearing detail: a read MUST project its pending operations

This is the part worth carving. In a buffered tree, **you cannot read a leaf directly.** The
committed structure at the leaf is *stale by construction* — the truth is the leaf **plus**
every pending operation buffered along the path from the root. Read the leaf alone and you get
an answer that is well-formed, plausible, and **wrong**.

That is precisely §2's slot→assumed-present drift, in silicon. "Beta(1,1) today" read like
shipped behaviour because the reader took the committed structure and did not project the
unflushed buffer sitting above it. The tree does not merely illustrate the failure — it
**names the fix**: the read path is *required* to walk the buffers and apply what is pending.

> **Carve:** reading a structure that has holes means reading the holes too. A summary that
> reports only what is committed, without the pending slots above it, is not a shortcut — it is
> a wrong answer with good formatting.

Greenberg's talk carries the sharper corollary: the naive projection **breaks scans**. Project
every pending operation into every leaf and you get nonsense ordering. The correct
implementation projects *only the operations whose key range lands in that leaf*. Applied here:
an unfilled template must be surfaced to the readers **it actually bears on**, and to no one
else. Broadcasting every open slot to every reader is as useless as hiding them.

### The other half: retroactivity — filling a hole left in the past

Demaine, Iacono & Langerman, ***Retroactive Data Structures*** (SODA 2004; TALG 2007) — a
**new lineage for this repo**, not previously in `PRIOR-ART-LIST.md`.

A *persistent* structure lets you branch at a past point and replay forward — correct, and
O(elapsed). A **retroactive** structure lets you **insert or delete an operation in the past
and have the present update without replaying**. Two strengths: *partially* retroactive (change
the past, query only the present) and *fully* retroactive (change the past, query any past
time), the latter being materially harder.

That is what discharging a template does. A slot is filled — an expert rules "wrong shelf,
use coverage-at-τ" — and everything downstream that was written against the open slot must now
reflect it. The persistent answer is *re-derive everything since*. The retroactive answer is
*apply the ruling at its point in the timeline and let the present move*. The second is what
a factory running at thousands of pushes a day actually needs.

Two constraints Demaine's work forces, and both bind here:

- **The consistency problem.** You cannot retroactively delete an enqueue without also
  deleting a dequeue — the history must stay well-formed. Filling a template retroactively has
  the same obligation: every downstream claim that leaned on the open slot must be reconciled,
  not silently orphaned. This is the same discipline as Z-set retraction: the correction is an
  event, and it must balance.
- **There is no general transformation.** Demaine proves you cannot mechanically make an
  arbitrary structure fully retroactive at acceptable cost. Some structures admit it cheaply;
  others do not. Honest reading: **some templates cannot be discharged retroactively at all**
  and require replay. Knowing which is which, per domain, is exactly the domain-indexed
  shelf of §3 — and it is why the answer is *per property class*, never universal.

### Metaphor discipline

Naming the line, per the standing guard against over-weighting a metaphor as a design surface
(the DNA/ACTG correction, 2026-06-11):

- **Mechanism, not metaphor:** the buffered-tree cost model, path copying, flush control, and
  the project-pending-operations read path. These are implementable and already anchored;
  the hitchhiker tree is named in `PRIOR-ART-LIST.md` as the IO-optimised sorted immutable
  index for the COW store. If `zetadb` wants an index with holes built in, this is not an
  analogy — it is the data structure.
- **Structural analogy, load-bearing but not literal:** buffer ↔ slot, flush ↔ ruling,
  projection ↔ labelling at point of use. Strong enough to carry the carve above, and it
  earns its place by predicting a failure we had already hit independently.
- **Not claimed:** that the epistemic move inherits the complexity bounds. `O(log_B n)` says
  nothing about how long an expert takes to rule. Borrowing the *shape* is legitimate;
  borrowing the *asymptotics* would be exactly the metering-test failure — physics-as-metaphor,
  with a Big-O hat on.

## 5c. The through-line — a thing that carries its own decoder

Aaron, 2026-08-01, on the homoiconicity talk: *"oh wow this really connects to our adinkra stuff
and our minimal reflection."*

It does, and the connection is tighter than analogy. Four things surfaced in a single day, and
they are one shape:

| | the thing | what it carries about itself |
|---|---|---|
| §5a-b | a **template / buffer** | its own *shape* — the slot says what would fill it |
| Aaron's objection to the impossibility | the **TriBoolean Float** | its own *bounds* — "the middle field decodes the ends" |
| this section | a **homoiconic representation** | its own *interpretation* — code and data are one form |
| already carved (2026-07-04) | an **adinkra** | its own *error correction* — the diagram IS the doubly-even self-dual code |

Each is a thing that carries its own decoder. That is what makes the set worth naming rather
than four coincidences.

### The anchor, which the repo did not have

**Homoiconicity is currently unanchored here** — one incidental mention in
`PRIOR-ART-LIST.md:81` and nothing else. The lineage, which is better than the folklore:

- **Mooers & Deutsch, TRAC (1965)** — the coinage. TRAC's property: *the procedures it
  evaluates and the text of those procedures are the same bytes, inside the program and out.*
  **One** representation — no source → AST → bytecode ladder at all.
- **Warren S. McCulloch** suggested the word (footnote in that paper). The same McCulloch of
  McCulloch–Pitts neurons — already adjacent to this repo's lineage.
- **Charles Sanders Peirce**, via McCulloch — *semiotics*: the sign, the idea it raises, the
  object it refers to. Homoiconicity is the degenerate case where sign and object coincide.
- **Mooers & Deutsch would not grant Lisp the property**, because some Lisp primitives were
  machine language and so broke the single-representation claim. By the original definition
  **almost nothing qualifies** — which is precisely why "minimal" is the operative word in
  minimal reflection.
- Sierra's working criterion, which is the usable one: **literal data structures + a reader for
  them + the whole language expressible in them.** JSON has the first two and fails the third —
  hence CloudFormation, a real language wearing a data structure badly.

### The sharpening: minimal reflection = how many links must share a shape

The best line in the talk is a crowd-sourced one: *"in the chain of representations between
human desire and machine effect, there is one link where both parties have the same shape."*

That reframes the whole question usefully. **Every** system has a chain of representations —
intent, source, AST, bytecode, electrons. The question was never "is the whole chain one
form" (TRAC's answer, and nearly nothing satisfies it). The question is **how many links must
coincide, and which ones.**

- TRAC: **all** links. Maximal, and almost unachievable.
- Lisp: **one** link — s-expressions — and that one link is enough for macros.
- **Adinkra: one link, chosen so that it is simultaneously the diagram, the algebra, and the
  error-correcting code.** That is what "minimal reflection surface" means, stated in the
  homoiconicity vocabulary: not *less* reflection, but the **fewest coinciding links that still
  close the loop** — where closing the loop is `gen(gen) == gen`, and the loop closing is what
  makes it self-correcting rather than merely self-describing.

That distinction is load-bearing and worth keeping: **self-describing** is carrying your own
decoder. **Self-correcting** is carrying enough of your own decoder that drift is detectable
and repairable from the carried part alone. The adinkra is the second; a comment is the first.

### Why this bears on the templates

Sierra's critique of embedded DSLs transfers directly, and it is the same shape as
`interfaces-free-classes-earned-under-rules`:

> A macro gives you **one shot**. You cannot build further abstractions on it without writing
> another macro. Plain data structures let you use the entire language to produce or consume
> them.

A macro is a **committed class** — it fixes the expansion, and everything downstream is limited
to what that expansion admits. Plain data is a **free interface** — anything can generate it,
anything can read it, and new layers compose without permission from the original author.

Applied to §5: **a template should be data, not a macro.** A slot stated as inert structure can
be filled by any expert, read by any consumer, and instantiated more than once for different
shelves. A slot encoded as machinery — a helper that "handles" the open question — fixes the
answer's shape before the specialist arrives, which is the whole failure the routing discipline
exists to prevent.

### Metaphor discipline, again

- **Mechanism:** homoiconicity is a checkable property of a language (Sierra's three criteria),
  and `gen(gen) == gen` is a checkable property of a generator. Both are testable.
- **Structural, load-bearing:** "carries its own decoder" as the common shape across template /
  self-describing number / homoiconic form / adinkra. It earns its place by having made a
  prediction — Aaron's objection to the impossibility result was *exactly* this move applied to
  a scalar, reached independently.
- **Not claimed:** that Peirce's semiotics gives us anything operational, or that being
  homoiconic makes a representation correct. TRAC was homoiconic and is dead. The property buys
  **one** thing: the tools that read the form are the tools that write it.

## 6. What this does not claim

- Not that Lumen's Beta framing is right; that is Soraya's ruling, and "wrong instrument" is a
  fully acceptable outcome — the template will have done its job either way.
- Not that templates are free. They are cheap **to propose** and expensive **to leave
  unexamined**, which is the opposite cost profile from a claim, and the reason §5.5 exists.
- Not a new mechanism. §4 is four independent prior lineages; this document is the
  Mirror→Beacon compression of a move the factory was already making.

## Pointers

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the sibling vocabulary (`toy` /
  unmetered / metered, and `sorry` as its proof-side cousin)
- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — template = free interface,
  instantiation = earned class
- `.claude/rules/anchor-to-human-prior-art.md` — why §4 is required rather than decorative
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — the mechanism reports,
  the oracle decides; here: the template proposes, the hat rules
- `docs/PRIOR-ART-LIST.md` ~L460-473 — Friedman–Resnick 2001 and the Cantelli/maximin entries
  that the whitewash-floor template draws on
- `src/Core.TypeScript/observe/vault-state-bridge.ts` — the hard floors that are actually
  shipped, as distinct from the Beta template describing what might replace them
