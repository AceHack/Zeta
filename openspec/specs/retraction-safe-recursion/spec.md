## Purpose

The retraction-safe-recursion capability defines three least-fixed-point
combinators for Datalog-style recursive queries over Z-set streams, each with
a distinct correctness-performance trade-off: a retraction-safe combinator
that re-evaluates the body over a distinct-clamped integrated relation, a
counting combinator that preserves derivation multiplicities as Z-weights, and
a classical semi-naïve combinator that is correct only under monotone inputs.
The capability pins the observable semantics of each combinator, the
preconditions the body must satisfy, and — critically — the retraction-
correctness boundary: which combinators are safe to use under streams that
carry negative Z-weights and which are not.

## Requirements

### Requirement: feedback cells break recursive cycles

The capability MUST expose a feedback cell whose output stream can be consumed
by downstream operators before its producer is known, and which is wired to its
true producer exactly once via a one-shot `Connect` operation.

#### Scenario: connecting before circuit build

- **WHEN** a feedback cell is allocated, used as an input to downstream
  operators, and then connected to a producer stream before the circuit is built
- **THEN** the circuit build MUST succeed
- **AND** the feedback cell MUST emit its declared initial value on tick 0
- **AND** it MUST emit the producer's previous-tick value on every subsequent tick

#### Scenario: connecting twice

- **WHEN** `Connect` is called on the same feedback cell a second time
- **THEN** the second call MUST throw an `InvalidOperationException`
- **AND** the state established by the first call MUST be preserved

#### Scenario: two threads racing to connect

- **WHEN** two threads call `Connect` concurrently on the same feedback cell
- **THEN** exactly one call MUST succeed
- **AND** the other MUST throw `InvalidOperationException`
- **AND** the circuit MUST NOT be left with a torn producer/consumer pair

### Requirement: retraction-safe recursion clamps the integrated relation

The retraction-safe recursive combinator MUST compute, on each outer tick, one
inner iteration of the least fixed point `T = Distinct(seed ∪ body(T))`, with
the Z-weights of the combined seed-and-feedback relation clamped to `{0, 1}`
by `Distinct` before being fed into the body. Retractions of seed facts MUST
propagate through the combinator so that closure rows depending solely on
retracted seed facts disappear from the integrated output.

#### Scenario: monotone inputs converge to the set-theoretic LFP

- **WHEN** a monotone seed stream is fed into the retraction-safe combinator
  with a monotone body
- **THEN** after enough outer ticks, the combinator's integrated output MUST
  equal the least fixed point of `seed ∪ body(·)`
- **AND** every output Z-weight MUST be `1`

#### Scenario: retraction drops dependent closure rows

- **WHEN** a seed edge is inserted, the combinator reaches its fixed point,
  and the edge is subsequently retracted
- **THEN** after the combinator re-stabilises, every closure row whose only
  derivation paths go through the retracted edge MUST be absent from the
  output
- **AND** closure rows with surviving alternate derivations MUST remain at
  weight `1`

### Requirement: counting recursion preserves derivation multiplicity

The counting recursive combinator MUST compute the least-fixed-point series
`T = seed + body(T)` without applying `Distinct` inside the loop, so that the
Z-weight of a key in the integrated output equals the number of distinct
derivation trees proving that key from the integrated seed. The body MUST be
Z-linear for the combinator's retraction-correctness guarantee to hold; the
combinator MUST NOT converge on cyclic derivation graphs because derivation
counts are unbounded there.

#### Scenario: derivation count of a diamond shape

- **WHEN** the seed encodes an acyclic graph with two edge-disjoint paths from
  `a` to `c` (e.g., `a→b1→c` and `a→b2→c`), and the body is a single
  transitive-closure join step
- **THEN** after convergence, the closure row `(a, c)` MUST carry weight `2`
- **AND** intermediate rows `(a, b1)` and `(a, b2)` MUST carry weight `1`

#### Scenario: retraction of an edge that backs every derivation

- **WHEN** a seed edge is inserted that is the sole support for a closure row
  with weight `w`, and is subsequently retracted
- **THEN** the closure row's integrated weight MUST reach `0`
- **AND** the row MUST be dropped from the consolidated output with no
  tombstone pass

#### Scenario: partial retraction of shared support

- **WHEN** a closure row carries weight `n` supported by `n` distinct
  derivation trees, and one supporting edge is retracted such that `k < n`
  trees are cancelled
- **THEN** the surviving weight MUST equal `n - k`
- **AND** the row MUST remain present in the output

#### Scenario: cyclic input does not converge

- **WHEN** the seed encodes a cyclic graph and the body is a transitive-closure
  join step
- **THEN** the combinator MUST NOT be expected to converge to a fixed point
- **AND** callers MUST be directed to the retraction-safe combinator for
  cyclic inputs

### Requirement: semi-naïve recursion is monotone-only

The classical semi-naïve recursive combinator MUST be documented and
implemented with an explicit monotone-input precondition: it is correct only
for streams whose weights never become negative. The combinator MUST carry
a warning in its accompanying documentation that feeding retraction-bearing
streams through it leaks stale facts into every subsequent iteration.

#### Scenario: monotone inputs yield the same result as the retraction-safe combinator

- **WHEN** a seed stream that never retracts is fed through the semi-naïve
  combinator and the retraction-safe combinator with the same monotone body
- **THEN** both outputs MUST agree at every tick after both have stabilised

#### Scenario: retraction leaks stale facts

- **WHEN** a seed fact is inserted and retracted in the presence of a
  multi-hop body
- **THEN** the semi-naïve combinator's integrated output MAY still contain
  closure rows derived from the retracted fact
- **AND** the capability's reference documentation MUST direct retraction-
  bearing callers to the retraction-safe or counting combinator instead

### Requirement: fixed-point iteration driver

The capability MUST expose a driver that advances a circuit's ticks until an
observed output stream stabilises (equals its previous tick's value) or a
caller-supplied iteration cap is reached. The driver MUST return enough
information for callers to distinguish "reached a fixed point" from "hit the
cap".

#### Scenario: convergence within the cap

- **WHEN** the driver is invoked on a circuit whose observed output stabilises
  within the iteration cap
- **THEN** the driver MUST report the number of iterations run
- **AND** MUST signal successful convergence

#### Scenario: cap exceeded

- **WHEN** the driver is invoked on a circuit whose observed output does not
  stabilise within the cap
- **THEN** the driver MUST stop at the cap
- **AND** MUST signal that convergence was NOT reached
- **AND** MUST NOT silently loop beyond the cap

### Requirement: closure-table hierarchies use the retraction-safe combinator

The closure-table combinator built on top of this capability MUST use the
retraction-safe LFP combinator for its default variant so that edge
retractions correctly drop stale closure rows. A counting variant MAY be
offered separately for callers who want derivation-count multiplicities on
acyclic edge graphs.

#### Scenario: edge retraction on cyclic graph

- **WHEN** the default closure-table combinator is fed a cyclic edge stream
  and one edge is later retracted
- **THEN** the integrated closure MUST be consistent with the post-retraction
  edge set
- **AND** no ghost ancestors of any node MUST remain

#### Scenario: counting variant on acyclic graph

- **WHEN** the counting closure-table variant is fed an acyclic edge stream
- **THEN** each closure row's weight MUST equal the number of distinct
  edge-walks from its ancestor to its descendant
- **AND** retractions MUST decrement the weight by the number of walks the
  retracted edge participated in
