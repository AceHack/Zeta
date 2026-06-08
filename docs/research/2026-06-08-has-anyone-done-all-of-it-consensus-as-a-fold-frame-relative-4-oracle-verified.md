# Has anyone done *all of it*? Consensus-as-a-fold, frame-relative, 4-oracle-verified — the strands vs the whole

**Aaron, 2026-06-08 (#7064):**

> "Most people close over one compiler; I'm closing over at least 4 (+ ANTLR free grammars, maybe Python/
> Scala/Kotlin/Go/Java). Better to use the free grammars *in reverse* to generate from our what-remains
> format — but we're using closing-over-4 + the bit-treaties + the serializers + the math to verify with
> little human intervention. Has anyone done all the proof we have about distributed systems AND taken the
> banana-split fold over everything to make everything observable and traveler-frame/jurisdiction-relative
> — where even consensus is a fold?"

**Honest answer: every strand is deeply studied and named; the *integrated whole* is a composition no one
has assembled (as far as I can find).** Anchor-to-human-prior-art demands we name the shoulders — here they
are, strand by strand.

## "Consensus is a fold" — the strongest prior-art hit

This is real and named, via lattices/monotonicity:

- **CALM theorem** (Hellerstein & Ameloot; *Keeping CALM*) — a program has a coordination-free (consensus-
  free) distributed implementation **iff it is monotone**. Monotone computation = a **fold over a
  join-semilattice**. So "consensus as a fold" is precisely the lattice/monotone-dataflow story.
- **Lattice agreement** (Attiya, Herlihy, …) — agreement as **joining a semilattice** (a fold), strictly
  weaker than consensus, often coordination-free. The literal "consensus-ish as a fold."
- **CRDTs** (Shapiro et al.) — state merge = an idempotent/commutative/associative **join-fold**; eventual
  agreement *is* the fold. **Bloom/Bud** (Conway, Alvaro) — monotone logic; **LVars** (Kuper) — lattice
  variables; **Lasp** (Meiklejohn) — CRDT dataflow. All "agreement as lattice fold."
- So Zeta's "even consensus is a fold" sits on CALM + lattice agreement + CRDT-join — a defensible,
  named position, not a coinage.

### Sharper (Aaron #7065): consensus = the *weave* = the symmetric fold of two threads over query/CRDT, with Bayesian convergence on unordered events

The precise shape: consensus = **the weave** (the Loom, #6980) = the **symmetric (commutative/associative)
fold of two threads** (zip-over-two-CRDTs, #6993; the symmetric form #7048) **over query/CRDT state** —
and the convergence is **Bayesian on *unordered* events**. Each piece anchors:

- **Symmetric fold of two threads = the weave.** Two streams/branches woven by a commutative+associative
  merge — a CRDT join over the queries' results. Order-of-arrival irrelevant by construction (that's the
  *symmetric* form, #7048): "they may see things in different order but proofs say they converge" (#6993).
- **Bayesian convergence on unordered events has an exact anchor.** Order-independent Bayesian update is
  **de Finetti exchangeability** (an exchangeable event sequence has an order-independent posterior).
  And — the deep one — **the sufficient statistics of an exponential family form a commutative monoid**
  (conjugate-prior update = combine sufficient statistics), so a **Bayesian update *is* a commutative
  monoid fold** — order-free *by construction*, exactly a CRDT join. So "Bayesian convergence on unordered
  events" = exponential-family-sufficient-statistic monoid + de Finetti — a *Bayesian CRDT*: the merge is
  a belief update, commutative, convergent. (In-repo: `BeliefConvergence.fs`, `Zeta.Bayesian`.)
- **So consensus-as-fold, fully stated:** weave two threads by a symmetric fold whose combine is a
  commutative Bayesian update (exponential-family sufficient statistics) over query/CRDT state; unordered
  events converge to the same posterior (de Finetti) — agreement *is* the fold, and it's Bayesian. This is
  stronger than plain lattice-join consensus: the lattice element is a *belief*, the join is *Bayes*.

Prior art for the *combination* (CRDT ⊕ Bayesian commutative update) is thin and recent — there are
"Bayesian CRDTs" / commutative probabilistic aggregation sketches, but **consensus framed as a Bayesian
symmetric-fold weave over one observable stream, frame-relative** is again the *integration* Zeta is
claiming, standing on de Finetti + exponential-family-monoid + CRDT.

## "Everything observable as a fold" — DBSP / differential dataflow / coalgebra

- **DBSP** (Budiu et al. 2022) — incremental computation *as algebra* (Z-sets; the derivative); the
  in-house substrate. **Differential dataflow** (McSherry). **Datalog / recursive queries.** Everything-
  as-fold-over-a-stream is exactly this lineage (#7058 hylo/bialgebra).
- **Coalgebra** (Rutten; Jacobs) — observation-defined objects; streams as the final coalgebra (#7054).

## "Frame / jurisdiction-relative" — no global frame

- **Lamport** — relativity of simultaneity in distributed systems (no global clock); causal order only.
- **Local-first software** (Kleppmann et al.) — CRDT-based, no central authority, each node its own frame.
- **Causal/causal+ consistency**; **TravelerFrame** (in-repo) — the explicit no-global-causal-order model
  (manifesto §4). "Jurisdiction-relative" (policy/locality-relative) generalizes frame-relative to *who
  decides* — less standard as a named primitive, but built on causal + local-first.

## "All the proof, with little human intervention" — verified + cross-checked distributed systems

- **Verified consensus**: **Verdi** (Coq-verified Raft, Wilcox et al.), **IronFleet** (MSR — verified
  distributed systems end-to-end), **Disel**, **Velisarios** (verified BFT). The "proof corpus" exists.
- **Empirical**: **Jepsen** (Kingsbury) — the cross-implementation correctness check.
- Zeta's lever is *different*: **4 language oracles + bit-treaties (byte-lock seeds) + 4 serializers +
  DST** as a **differential / cross-oracle** proof with minimal human proof-writing — closer to "agreement
  by construction + differential testing across implementations" than to a single Coq proof. (BP-16
  cross-check; the seed treaty.)

## "Free grammars in reverse — generate from what-remains"

Using the grammar **generatively** (canonical format → N languages), not just to parse:

- **Invertible / bidirectional syntax** — Rendel & Ostermann, *Invertible Syntax Descriptions* (parse AND
  print from one grammar); biparsers; **Boomerang** (bidirectional lenses for strings). The reverse-grammar
  idea is named.
- **One-IDL → N-languages codegen** — protobuf / ASN.1 / Thrift / Cap'n Proto generate many languages from
  one schema; **generative F# type providers** (the "reified type provider" #earlier). Zeta's
  what-remains-format → 4 langs is this, with the bit-treaty as the byte-lock contract.

## The verdict (positioning)

Each strand is established. **What I cannot find is the *assembled whole*:** one substrate where
**consensus, data, schema, files, and (planned) asm are ALL banana-split folds over one observable DBSP
stream**, made **traveler-frame/jurisdiction-relative**, and **cross-verified across 4 language oracles +
bit-treaties + serializers + math with minimal human intervention** — *and* closing over 4+ compilers
(with reverse-grammar codegen) rather than one. The novelty is the **integration**, not the parts:
CALM-fold-consensus ⊕ DBSP-fold-everything ⊕ local-first-frame-relative ⊕ verified/differential-by-
construction ⊕ multi-compiler-closure. That is a defensible "we stand on all these, and the synthesis is
ours" claim — exactly the Mirror→Beacon compression (the coined whole survives because each part anchors).

## Honest scope (peel)

A **positioning / prior-art synthesis** (no code) answering Aaron's "has anyone done all of it?" It names
the shoulders for each strand and locates Zeta's novelty in the *integration*. It does NOT claim the whole
is *built* — much of it is the in-flight work this session (folds over db/file/table/catalog, the stored-
proc/interface synthesis, the asm executor #7063 unbuilt) plus the existing substrate (DBSP, CRDT,
TravelerFrame, 4-oracle/seed-treaty). A claim of *novelty* should get a `naming-expert` + Ilyana + human
review before any outward use (it's an outward-facing/load-bearing claim).

## Anchors (Beacon)

- **Consensus-as-fold:** CALM (Hellerstein/Ameloot), lattice agreement (Attiya/Herlihy), CRDTs (Shapiro),
  Bloom/Bud (Alvaro/Conway), LVars (Kuper), Lasp (Meiklejohn).
- **Consensus = symmetric weave + Bayesian convergence (#7065):** de Finetti exchangeability (order-
  independent posterior); exponential-family **sufficient statistics as a commutative monoid** (conjugate
  update = monoid fold ⇒ Bayesian update is a CRDT join); "Bayesian CRDT" / commutative probabilistic
  aggregation; the Loom weave (#6980), zip-over-two-CRDTs (#6993), symmetric fold (#7048);
  `BeliefConvergence.fs`, `Zeta.Bayesian`.
- **Fold-everything / incremental:** DBSP (Budiu 2022), differential dataflow (McSherry), Datalog;
  coalgebra (Rutten/Jacobs).
- **Frame-relative:** Lamport (relativity of simultaneity), local-first (Kleppmann), causal consistency;
  `TravelerFrame` (in-repo), manifesto §4.
- **Verified / cross-checked distributed systems:** Verdi, IronFleet, Disel, Velisarios; Jepsen.
- **Reverse/bidirectional grammars + codegen:** Rendel & Ostermann; Boomerang; protobuf/ASN.1/Cap'n Proto;
  generative type providers.
- Internal: #7050 (forced RX / fold-everything), #7054 (banana split law), #7058 (hylo/bialgebra), #7063
  (asm executor), the 4-oracle / seed-treaty / bit-treaty / DST disciplines, `TravelerFrame.fs`.
