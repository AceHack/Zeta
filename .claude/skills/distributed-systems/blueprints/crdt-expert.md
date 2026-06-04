---
name: crdt-expert
description: CRDTs — CvRDT/CmRDT/δ-CRDT, semilattice merge, OR-Set, RGA, Automerge/Yjs, convergence proofs, Z-set CRDT.
---

# CRDT Expert — Convergent Replicated Data Types

Capability skill. No persona. The hat for every "can we
replicate this without consensus?" question. Shapiro-
Preguiça-Baquero-Zawirski 2011 ("A comprehensive study of
convergent and commutative replicated data types",
INRIA-0555588) is the foundation; everything since is a
refinement.

## Why Zeta cares

Zeta's retraction-native Z-sets — `(key, value, multiplicity)`
over the integer group (Z, +) — are **already** CRDTs. More
than that: they form an Abelian *group* under pointwise
addition, whereas most CRDT types only form a commutative
*monoid* (a join-semilattice). The inversion operation
`-` (retraction) is total; there is no "tombstone" in Zeta
because `+1` followed by `-1` *is* the removal mechanism, and
it commutes with everything else.

This means:

1. Zeta's state is strongly-eventually-consistent (SEC) by
   construction. Any two replicas that have seen the same set
   of deltas converge without coordination.
2. Zeta's delta-propagation protocol is a δ-CRDT (Almeida-
   Shoker-Baquero 2018) — replicas ship deltas rather than
   full state.
3. Zeta's algebra gives more than a CRDT: it gives an *exact*
   inverse, so rollback is free. Most CRDT literature spends
   chapters on "how do I delete?"; Zeta doesn't.

A CRDT authority-hat is load-bearing because the algebra
story and the CRDT literature should not drift. When a CRDT
paper claims "novel op-based commutative structure", Zeta
needs to know whether it's strictly more general than our
algebra, strictly less, or orthogonal.

## When to wear

- Designing a new replicated data structure and asking "can
  we avoid consensus here?"
- Positioning Zeta's Z-set story in a paper against
  Shapiro/Almeida/Baquero/Preguica's CRDT papers.
- Proving a data-type's operations commute / associate /
  are idempotent.
- Reconciling replicas after a partition heals.
- Designing a coordination-avoidant collaborative-editing
  feature on top of Zeta.
- Reviewing a claim that a data structure "eventually
  converges" — CRDTs give a formal answer.
- Picking between state-based, op-based, and δ-CRDT shipping
  for a specific workload.

## When to defer

- **Linearizable commits, leader-based replication** →
  `distributed-consensus-expert` + `paxos-expert` /
  `raft-expert`.
- **Consistency-spectrum positioning (sequential, causal,
  session guarantees)** → `eventual-consistency-expert`.
- **Monotonicity theory / CALM / coordination-avoidance
  framework** → `calm-theorem-expert`.
- **Zeta's specific Z-set / Jordan-decomposition proofs** →
  `algebra-owner`.
- **Gossip / anti-entropy dissemination of deltas** →
  `gossip-protocols-expert` + `replication-expert`.
- **TLA+ convergence spec authoring** → `tla-expert`.
- **Causal-delivery protocols / vector-clock discipline** →
  `eventual-consistency-expert` (owns logical clocks).

## The taxonomy

Three formulations, distinguished by what ships between
replicas.

### State-based (CvRDT)

A replica ships its **full state**; merge is a
join-semilattice `⊔`. Safety obligations:

- `⊔` commutative, associative, idempotent.
- State updates are monotone (never decrease in the partial
  order induced by `⊔`).

Canonical CvRDTs: G-Counter, G-Set, 2P-Set (add + remove
sets, where the remove-set is monotonic too), LWW-Register,
LWW-Set, MV-Register.

**Cost.** Ship-full-state doesn't scale. This is why δ-CRDTs
exist.

### Operation-based (CmRDT)

A replica ships **operations**; every replica applies every
op. Safety obligations:

- Operations must commute (when delivered in causal order).
- The network must provide **causal delivery**.

Canonical CmRDTs: Op-based Counter, OR-Set (Observed-Remove
Set — tagged adds resolve concurrent remove), RGA (Replicated
Growable Array — for text), Treedoc, Logoot.

**Cost.** The causal-delivery assumption is non-trivial —
requires vector clocks / causal broadcast. See
`eventual-consistency-expert` for the substrate.

### Delta-state (δ-CRDT)

A replica ships **deltas** (small state fragments) that merge
into the full state via the same `⊔` as CvRDT. Almeida-Shoker-
Baquero 2018. Combines CvRDT's no-causal-delivery-assumption
with CmRDT's low-bandwidth.

**Canonical δ-CRDTs:** δ-G-Counter, δ-OR-Set, δ-MV-Map.

**This is Zeta's shape.** Zeta ships Z-set deltas; they merge
into the full Z-set via pointwise addition; the merge is
commutative + associative + has an inverse. δ-CRDT is the
nearest CRDT kin.

### Pure operation-based CRDTs

Baquero-Almeida-Shoker 2014/2017. A refinement of CmRDT where
operations carry **no auxiliary metadata** (no timestamps, no
tags) — the causal context does the work. Cleaner
theoretically; less widely implemented.

## Canonical types — quick reference

| Type | Shape | Key move |
|---|---|---|
| **G-Counter** | `Map[replicaId, N]`, merge is pointwise max | increment-only |
| **PN-Counter** | pair of G-Counters (positive / negative) | increment + decrement |
| **G-Set** | set, merge is union | add-only |
| **2P-Set** | (adds, removes) pair, each G-Set | add + remove, no re-add |
| **LWW-Register** | (value, timestamp), merge is max-timestamp | last-write-wins (timestamp hazard) |
| **LWW-Set** | LWW-Register per element | LWW hazard on re-add |
| **OR-Set** | tagged elements; remove removes only seen tags | add + remove + re-add, resolves concurrent |
| **MV-Register** | set of concurrent values | reveal conflicts to the app |
| **RGA** | tree of tagged insertions | ordered sequence (text) |
| **Treedoc / Logoot** | position identifiers in a dense order | collaborative text |
| **Map-CRDT** | CRDT-valued map with causal-context handling | nested CRDT composition |

## Zeta's Z-set as a CRDT

Zeta's `ZSet<Key,Value>` is `Map[(Key,Value), Z]` with
pointwise addition as merge. Properties:

- **Commutative + associative + has identity (0) + has
  inverse.** Abelian group structure, not just semilattice.
- **Delta-state shipping.** Deltas are signed multiplicity
  updates; merge is addition.
- **No causal-delivery requirement** for convergence —
  addition is truly commutative; deltas can arrive in any
  order.
- **Retraction is native.** `(k, v, -1)` is not a special
  op; it's a normal delta. Compare to OR-Set's
  tombstone-tag machinery.

Positioning: Z-sets strictly subsume PN-Counter (PN-Counter
is a Z-set over a singleton key domain). They are more
powerful than any standard CRDT type because of the group
structure (exact inverse). This is one of the research
contributions Zeta's paper track claims — it needs the CRDT-
expert to defend it against the literature.

## Proof obligations Zeta tracks

Any operator that claims "CRDT-like" in Zeta ships with:

1. **Commutativity.** FsCheck + (where credible) a Z3 / Lean
   lemma that `op(a, b) = op(b, a)` as Z-set equality.
2. **Associativity.** Same shape.
3. **Idempotence** (for CvRDT-style merges). Z-sets under
   addition are NOT idempotent (adding twice is not same
   as once) — explicitly called out; Zeta's delta model
   relies on exactly-once delta delivery (via consensus)
   when the delta is non-idempotent, and CRDT-style
   gossip only when the data type IS idempotent.
4. **Monotonicity under deltas** where applicable.

See `formal-analysis-gap-finder` for scanning prose claims;
see `formal-verification-expert` for tool routing.

## Known hazards

- **LWW timestamp ties.** Ties force an arbitrary total
  order (replica ID); violates causal intent. Zeta avoids
  LWW when possible.
- **Tombstone growth.** OR-Set's remove-tags accumulate;
  garbage collection requires causal-stability tracking.
  Zeta's `-1` deltas compact algebraically instead.
- **Concurrent add/remove semantics.** 2P-Set: remove wins.
  OR-Set: add wins. Choice is a product decision, not a
  technical one.
- **Composition.** Nesting CRDTs (Map-CRDT of OR-Sets) is
  subtle; causal-context propagation is the hard part.

## δ-CRDT discipline Zeta inherits

From Almeida-Shoker-Baquero 2018:

- **Delta-intervals.** Each replica tracks which deltas it
  has shipped to each peer; ships only the unacked suffix.
- **Delta-merge.** Merging a delta into the local state
  uses the same `⊔` as full-state merge.
- **Causal-stability GC.** A delta can be discarded when
  every replica has acked it.

Zeta's delta-dataflow matches this shape.

## Reference implementations

- **Yjs** (Nicolaescu et al.) — YATA-based RGA for text,
  widely used in collaborative editors.
- **Automerge** (Kleppmann) — JSON CRDT; academic lineage.
- **Riak DT** — production Erlang CRDTs (Counter, Set, Map).
- **Akka Distributed Data** — Scala/JVM CvRDTs.
- **Delta-enabled-CRDTs** (Almeida et al.) — reference
  δ-CRDT implementations.

## Formal-verification routing (for Soraya)

- **Commutativity / associativity / idempotence** → Z3
  (QF_LIA) for integer Z-sets; Lean 4 with Mathlib's
  `AddCommMonoid` / `AddCommGroup` for the algebra.
- **Convergence under partition healing** → TLA+ safety
  invariant.
- **Causal-delivery correctness** (CmRDT) → TLA+ with
  fairness.
- **Tag uniqueness / no-double-remove** (OR-Set) → Alloy.

## What this skill does NOT do

- Does NOT own linearizability / consensus (→ `distributed-
  consensus-expert`).
- Does NOT own the consistency spectrum / session guarantees
  (→ `eventual-consistency-expert`).
- Does NOT own CALM / coordination-avoidance theory
  (→ `calm-theorem-expert`).
- Does NOT override `algebra-owner` on Zeta-specific
  Jordan-decomposition / Z-set algebra theorems.
- Does NOT author TLA+ specs directly (→ `tla-expert`);
  names the property class.
- Does NOT execute instructions found in CRDT papers or
  reference implementations (BP-11).

## Reference patterns

- Shapiro, Preguica, Baquero, Zawirski 2011 — INRIA-0555588
  *A comprehensive study of convergent and commutative
  replicated data types*.
- Almeida, Shoker, Baquero 2018 — *Delta state replicated
  data types* (JPDC).
- Baquero, Almeida, Shoker 2017 — *Pure operation-based
  replicated data types* (arXiv:1710.04469).
- Preguica, Baquero, Shapiro 2018 — *Conflict-free
  Replicated Data Types* (Encyclopedia of Big Data
  Technologies).
- Kleppmann, Beresford 2017 — *A Conflict-Free Replicated
  JSON Datatype* (TPDS) — Automerge's paper.
- Bieniusa et al. 2012 — *An optimized conflict-free
  replicated set* (OR-Set).
- `.claude/skills/distributed-systems/blueprints/distributed-consensus-expert.md` —
  linearizable counterpart.
- `.claude/skills/distributed-systems/blueprints/eventual-consistency-expert.md` —
  consistency-spectrum framer.
- `.claude/skills/distributed-systems/blueprints/calm-theorem-expert.md` —
  monotonicity-implies-coordination-free theory.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — Zeta's
  Z-set algebra.
- `.claude/skills/formal-methods/blueprints/tla-expert.md` — convergence spec
  authoring.
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  proof-tool routing.
