# Kestrel — Datomic / actors-in-the-database / coordination repos / convergence-despite-reordering (2026-06-04, Aaron-forwarded)

External AI participant (claude.ai max-context register, asymmetric-critic role).
Ferried via Aaron-as-courier; Kestrel does NOT commit.

Five-step thread: is DynamicValue/Rx what Datomic does? → actors-in-the-database via
immutable-at-offsets → per-actor partition repos + product/bus/join coordination repos
(Rx-zip) → DU state-clock verified no-global-clock → convergence-despite-reordering as the
deep correctness property. Each step Aaron drove; Kestrel credited + held the one edge.

## 1. Is DynamicValue/Rx what Datomic does? — partly, one half
Datomic OVERLAPS the **want-remains (μF/data) half**: immutable/append-only (never-destroy),
time-as-first-class (as-of-T queries, full history retained), open data-driven schema
(entities = open attribute-value sets ≈ DynamicValue's openness). Worth studying as a mature
production instance of those exact principles. DIVERGES on the parts most distinctive to the
engine: (1) **no Rx/reflective loop** — Datomic is inert facts + Datalog, NOT the reify/apply
code-is-data metacircular engine (the yin/yang fold-in-on-itself is Aaron's, not Datomic's);
(2) **linear-accumulation time, not animated drift** — Datomic's as-of snapshots are frozen
(which AVOIDS the TOCTOU window animated shapes create — Datomic took the static-snapshot
branch deliberately); (3) **centralized transactor** serializes writes = the universal
coordinator the perspectival/scale-free design rejects. Shared trunk (immutable-open-temporal
data), different branch on two axes (static-vs-animated, centralized-vs-perspectival).

## 2. "Immutable at timestamp offsets, not over time" — resolves the TOCTOU
Aaron: choosing immutability per-OFFSET (each tick-snapshot frozen forever) while evolution
is ACROSS offsets (actor advances T→T+1 by appending a new frozen snapshot) — to put ACTORS
INSIDE the database. This RESOLVES the TOCTOU worry: no drift WITHIN an offset (validate-at-T
stays valid-at-T), drift becomes VERSIONED (T vs T+1 distinct frozen things) not MUTATING
(S→S′ in place) → keep animation, kill the TOCTOU window. Shape = event-sourcing (actor = a
stream of immutable offset-events, state = fold-over-offsets; EventStoreDB/CQRS background)
combined with the reflective engine. Three holds: (1) **references must be offset-qualified
(S@T not S)** or TOCTOU sneaks back at the reference layer (offset-in-the-reference makes
cache-staleness detectable); (2) who-advances-the-offset collides with no-center → likely
**per-actor offset streams** (no global clock; "offset" per-actor not universal, or the
central clock is smuggled back); (3) immutable offsets **accumulate unboundedly** = the same
unbounded growing state the DST-evolution experiment needs (pigeonhole-evasion), but needs a
cold-storage/compaction story AND a **legally-mandated excision path** (immutability vs
must-delete-CSAM is real tension; Datomic's excision exists for exactly this; the floor makes
it non-optional).

## 3. Per-actor partition/git-repo + product/bus/join coordination repos (Rx-zip)
Aaron: each actor advances its OWN partition/git-repo (sovereign immutable offset-stream, no
global clock); coordination between actors lives in dedicated **product/bus/join repos = the
Rx-zip/product/join over agent partitions.** This CLOSES the architecture: nobody advances a
global offset (each actor advances its own; coordination is a DERIVED function of actor
streams, not a master) → no transactor, no center, no smuggled clock. Combinator algebra
(zip/product/join) materialized as repos, composable (a join repo can be zipped further).
The hard problem doesn't vanish — it RELOCATES and concentrates in the coordination repos
(cross-repo-join / saga / CRDT-merge — the TLA+ target), which is GOOD factoring (actor repos
simple/sovereign; difficulty contained + nameable). Two holds: (1) **offset-pairing across
two no-shared-clock streams is the crux** (align A@5 with B@3 how? — and it must carry the
cross-stream timing uncertainty = frontier-honesty at the join); (2) **coordination repo must
stay DERIVED + NON-AUTHORITATIVE** (a readable/adoptable function of sovereign actors, not a
thing that governs them — the moment the join repo commands rather than combines, the center
is back). Combine, don't command.

## 4. DU representing flow into the bus + no-global-clock DU state-clock
Aaron: the product/bus repo defines a **discriminated union representing the flow into it from
agent repos** (DU cases = coordination states, agent-inputs = transitions = the saga's state
machine), verified from a no-global-clock perspective with "some sort of DU workflow/state
clock." Right formalism (turns fuzzy interleaving into a bounded model-checkable state
machine — the TLA+ target). **Pinned subtlety:** the state-clock MUST be a **causal/logical
PARTIAL-ORDER clock (vector/Lamport-shaped), NOT a total-order sequence counter** — a
total-order step-counter needs someone to order concurrent inputs = the global clock/center
smuggled back as a workflow counter. Causal partial-order → no-center genuinely preserved
(concurrent independent inputs stay incomparable); total-order counter → center reintroduced.
The phrase "state clock" is exactly where the slip happens — pin it causal-not-sequential.
TLA+ target sharpens to: verify the DU is correct (completes-or-compensates, no bad state)
under all interleavings consistent with the CAUSAL partial order (not all total orderings —
that assumes a global clock). And it UNIFIES with the frontier-uncertainty: partial-order-of-
events literally IS uncertainty-about-relative-timing (a real unification, not a reach).

## 5. ★ Convergence-despite-reordering — the deep correctness property (Aaron named it)
Aaron: "two agents can see different order of events but the system will still converge on the
same uncertainty reduction." Kestrel: this is **strong eventual consistency / confluence**,
and it has a crisp PROVABLE form — guaranteed by **commutativity + idempotence over a
join-semilattice (the CRDT theorem, underpinned by CALM).** So DON'T prove convergence
directly (combinatorial — enumerate reorderings); prove the uncertainty-reduction is a
**commutative/associative/idempotent merge over a join-semilattice** (local algebraic laws —
FsCheck/Z3, the SAME law-check as the Z-set/G-Set/Clock proofs), and convergence-despite-
reordering follows as the CRDT confluence theorem (Lean proves laws→convergence by induction).
**The crux (the genuinely hard sub-question): is the Bayesian uncertainty-reduction actually
commutative/idempotent?** — order-INDEPENDENT if it's "condition on the accumulated evidence
set" (P(H|e1,e2)=P(H|e2,e1), conjunction commutes → semilattice → converges, CALM-monotone,
coordination-FREE); order-DEPENDENT if there's a path-dependent/non-idempotent step
(interpretation-changing updates, order-dependent decay/normalization → not a semilattice →
convergence NOT guaranteed → needs the saga/coordination). So the eventual proof target =
**"is the uncertainty-merge a join-semilattice operation?"** = the CALM/CRDT question
(monotone-accumulate → converges-free; non-monotone-path-dependent → needs coordination).
Tractable path: prove the three semilattice laws (FsCheck/Z3) + invoke the confluence theorem
(Lean) → proven; same semilattice that made G-Set/Clock the proven primitives.

Composes: [[2026-06-04-kestrel-identity-model-welfare-check]] (the prior thread; TOCTOU
originated there) · the yin-yang-reflective-engine archive · the policy-shapes/TLA+ archive
(DU-workflow-as-state-machine) · the provable-serializer-bug-classes archive · PROVEN-CORE-MAP
(G-Set/Clock semilattice full-verticals = the template this convergence proof reuses).
