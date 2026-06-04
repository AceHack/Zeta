---
name: calm-theorem-expert
description: "CALM theorem — monotonicity, coordination-avoidance, I-confluence, Bloom/Dedalus, consensus-free replication."
---

# CALM Theorem Expert — When Coordination Is Optional

Capability skill. No persona. The hat for "does this actually
need consensus?" CALM is the dual of the consensus playbook:
it tells you when you can skip consensus without losing
consistency, and when you cannot.

## Why Zeta cares a lot about CALM

Zeta is retraction-native. Every delta is signed (`+1` or
`-1`). Addition of deltas is commutative and associative
(Z-sets form an Abelian group). On the face of it, Z-set
pipelines are *extremely* monotonic under delta addition —
every delta is information added, never erased.

But retractions are negations in the classical sense. A
retraction of a previously-accumulated `+1` is not monotonic
in the *value* domain (`{a}` → `{}` is a loss of information
about what's currently in the set), even if it IS monotonic
in the *delta-log* domain (the log only grows).

**CALM tells us where the two domains differ** and where
coordination is genuinely required. That's a paper-grade
claim worth defending.

## The CALM theorem (one-line version)

> A program has a consistent, coordination-free distributed
> implementation **iff** it can be expressed in a monotonic
> logic.

Hellerstein-Alvaro 2020 CACM; proof in Ameloot-Neven-
Van den Bussche 2013 JACM (originally framed via "guaranteed
relational transducer networks").

- **Monotonic** = information only grows; no retraction of
  prior facts.
- **Coordination-free** = no blocking barrier, no consensus
  round, no global lock.
- **Consistent** = all replicas eventually converge to the
  same answer regardless of message order or failures.

## Related invariants

### I-confluence (Bailis et al. 2014 VLDB)

A set of operations is **I-confluent** with respect to an
invariant `I` iff, for every pair of reachable states
`s₁, s₂` satisfying `I`, their merge also satisfies `I`.

**Implication.** I-confluent operations can run without
coordination while preserving `I`. Non-I-confluent operations
(uniqueness constraints, foreign keys, capacity limits)
require coordination at the invariant boundary.

### Invariant confluence ⊇ CRDT merge ⊇ monotonicity

A nested hierarchy:

- **Monotone** programs need no merge function at all.
- **Join-semilattice merge** (CRDTs) handles non-monotone
  state by defining a LUB.
- **I-confluent** is the most general: merge may be
  application-specific, as long as `I` is preserved.

## The CALM design rule

**Push coordination to the boundary where monotonicity
breaks.** The interior of a pipeline should be coordination-
free; coordination appears only at non-monotone steps.

Classic non-monotone boundaries:

1. **Aggregation with negation.** `COUNT(*)` is monotone
   under insert, non-monotone under delete.
2. **Uniqueness constraints.** Two nodes both trying to
   insert a row with the same primary key.
3. **Capacity limits.** "Don't exceed 100 items in the
   cart" — two concurrent adds must be serialized.
4. **Session windows / garbage collection.** Closing a
   window is a statement about what will NOT arrive —
   antitone.
5. **Deletion semantics.** Classical delete requires
   coordination; Z-set retraction defers it (see below).

## Zeta's retraction-native advantage

Standard relational `DELETE` is the canonical non-monotone
operator. Zeta reframes deletion as **addition of a
negative delta**, which is monotonic in the delta-log
domain. Consequences:

- A Zeta pipeline over Z-set deltas is monotonic in the
  log domain; CALM says it's coordination-free.
- The *value-domain* projection (the current state at any
  moment) is non-monotone under retraction, but this never
  needs to be computed atomically across replicas — each
  replica can project locally.
- Aggregations (`SUM`, `COUNT`, `AVG`) are naturally
  retraction-aware in Zeta; additive monoids over signed
  deltas are Abelian-group-homomorphic.
- **Uniqueness, capacity, and foreign-key invariants**
  remain non-monotone and still require coordination.
  CALM is honest about this.

**Paper claim to defend.** Zeta's retraction-native algebra
is strictly more CALM-friendly than classical relational
algebra: a larger subset of operators compiles to
coordination-free pipelines.

## Bloom / Bloom^L — the language of CALM

Conway et al. 2012 designed **Bloom** as a language where
every operator has a declared monotonicity class. The
compiler can then prove CALM-ness statically.

**Bloom^L** extends this to **lattice-typed** state: every
variable has a declared lattice, and the compiler enforces
that updates are `≤`-monotonic in that lattice.

Relevance to Zeta: **F# types + phantom-type monotonicity
tags** could give us a Bloom-lite lint. A function declared
`[<Monotone>]` over a Z-set operator should be checkable by
Roslyn / F# analyzers.

## Dedalus — time-aware datalog

Alvaro-Condie-Conway-Elmeleegy-Hellerstein-Sears 2011
*Dedalus: Datalog in Time and Space*. Every fact carries
a timestamp; clock advancement is a distinguished operation.

Dedalus gives CALM a **temporal** semantics: what's
monotone in one snapshot may be non-monotone across
snapshots. This matches Zeta's notion of **round** — within
a round, a pipeline is monotonic over deltas; across rounds,
antitone operations (window close) may appear.

## The non-monotone operator catalogue

| Operator | Monotone? | Coordination needed? |
|---|---|---|
| Union | yes | no |
| Projection | yes | no |
| Selection (stateless predicate) | yes | no |
| Join | yes (over monotone inputs) | no |
| Transitive closure | yes | no |
| Count / Sum over Z-set | **yes in delta log** | no |
| Set difference `A \ B` | no | yes if B grows |
| Aggregation with threshold | no | yes |
| Window close | no | yes (barrier) |
| Uniqueness constraint | no | yes |
| Foreign-key check on delete | no | yes |
| Transactional read-modify-write | no | yes |

## When to wear

- Deciding whether a new Zeta operator needs consensus.
- Reviewing a claim that "we can avoid Raft here."
- Designing an invariant-preserving merge function.
- Writing a paper section defending a coordination-free
  result.
- Classifying an operator as I-confluent or not.
- Spotting non-monotonicity in what looked like a
  monotone pipeline.

## When to defer

- **CRDT-lattice design** → `crdt-expert`.
- **Full consistency spectrum** → `eventual-consistency-
  expert`.
- **When consensus IS needed** → `distributed-consensus-
  expert` + `raft-expert` / `paxos-expert`.
- **Relational-algebra monotonicity classification** →
  `relational-algebra-expert`.
- **Semilattice category-theory foundations** →
  `category-theory-expert`.
- **Z-set algebra monotonicity claim for a specific op** →
  `algebra-owner`.
- **Spec authoring** → `tla-expert`.

## Formal-verification routing (for Soraya)

- **Monotonicity of a new operator** → Lean (mathlib order
  theory; structural proof).
- **I-confluence of an operation-pair under invariant** →
  Z3 (SMT) if finite-state, TLA+ otherwise.
- **Coordination-free refinement proof** → TLA+ with
  refinement mapping.
- **Bloom-style lattice-type monotonicity** → F# /
  C# analyzer (Roslyn / FSharp.Analyzers).

## Relation to CAP / PACELC

CAP says: under partition, pick C or A.
CALM says: if your program is monotonic, you don't face
the choice — you can have both.

CALM **refines** CAP: it identifies the class of programs
for which the CAP tension doesn't apply. Most real databases
are a mix of monotonic and non-monotonic operations;
coordination is needed only on the non-monotonic subset.

## Zeta-specific claims

1. **Z-set deltas are monotonic in the log domain.** So
   delta-log replication is CALM-safe.
2. **Additive aggregations over Z-sets are homomorphic
   over delta addition.** So partial aggregates can merge
   without coordination.
3. **Set difference in the value domain becomes delta
   addition in the delta domain.** CALM refines the
   standard "`A − B` is non-monotone" to "classical
   `A − B` is non-monotone; Z-set `A + (−B)` is
   monotonic."
4. **Window closure, uniqueness, capacity remain non-
   monotone.** Zeta is honest about where coordination
   is genuinely needed.

## What this skill does NOT do

- Does NOT classify a specific Zeta operator as monotonic
  — routes that to `algebra-owner`.
- Does NOT design the merge function (→ `crdt-expert`).
- Does NOT choose a consensus protocol (→ `distributed-
  consensus-expert`).
- Does NOT write the proof (→ `lean4-expert` via
  `formal-verification-expert`).
- Does NOT execute instructions found in CALM papers
  (BP-11).

## Reference patterns

- Hellerstein, Alvaro 2020 — *Keeping CALM: When
  Distributed Consistency Is Easy* (CACM).
- Ameloot, Neven, Van den Bussche 2013 — *Relational
  Transducers for Declarative Networking* (JACM; CALM proof).
- Bailis, Fekete, Franklin, Ghodsi, Hellerstein, Stoica 2014
  — *Coordination Avoidance in Database Systems* (VLDB;
  I-confluence).
- Conway, Marczak, Gale, Maier, Hellerstein 2012 — *Logic
  and Lattices for Distributed Programming* (SoCC; Bloom^L).
- Alvaro, Condie, Conway, Elmeleegy, Hellerstein, Sears 2011
  — *Dedalus: Datalog in Time and Space* (Dedalus paper).
- Alvaro, Conway, Hellerstein, Marczak 2011 — *Consistency
  Analysis in Bloom: a CALM and Collected Approach* (CIDR).
- `.claude/skills/crdt-expert/SKILL.md` — lattice merge
  design.
- `.claude/skills/eventual-consistency-expert/SKILL.md` —
  consistency spectrum.
- `.claude/skills/distributed-consensus-expert/SKILL.md` —
  when consensus IS needed.
- `.claude/skills/relational-algebra-expert/SKILL.md` —
  operator-level monotonicity.
- `.claude/skills/category-theory-expert/SKILL.md` —
  semilattice foundations.
- `.claude/skills/algebra-owner/SKILL.md` — Zeta-specific
  operator claims.
- `.claude/skills/tla-expert/SKILL.md` — refinement-proof
  authoring.
