## Purpose

The operator-algebra capability defines the core data-model and stream operators
that every other capability in the library builds on: the Z-set abelian group,
its signed-weight retraction semantics, and the four stream operators — delay
(`z^-1`), integration (`I`), differentiation (`D`), and incremental-distinct
(`H`) — together with the algebraic laws that make incremental view maintenance
compositional. It also specifies the bilinearity of join and the chain-rule
identity `Q^Δ = D ∘ Q ∘ I` from the DBSP paper. This spec is language-agnostic:
it pins the observable behaviour of the algebra, not any particular runtime or
host-language surface.

## Requirements

### Requirement: Z-set as a finitely-supported signed multiset

A Z-set over a key type MUST behave as a finitely-supported map from keys to
signed 64-bit integer weights, with the invariant that a key is never present
with a zero weight in any exposed representation.

#### Scenario: adding a key and its negation yields empty

- **WHEN** a Z-set containing `(k, +1)` is added to a Z-set containing `(k, -1)`
- **THEN** the resulting Z-set MUST be the empty Z-set
- **AND** iterating its entries MUST produce zero entries

#### Scenario: look-up of an absent key

- **WHEN** the weight of a key not present in a Z-set is requested
- **THEN** the result MUST be `0`
- **AND** the look-up MUST NOT raise an exception

#### Scenario: equality ignores insertion order

- **WHEN** two Z-sets are constructed from the same `(key, weight)` pairs in
  different orders
- **THEN** they MUST compare equal
- **AND** their entry sequences MUST be identical after normalisation

### Requirement: Z-set operations form an abelian group under addition

Addition, negation, and subtraction on Z-sets MUST satisfy the abelian-group
laws (associativity, commutativity, identity, inverse) pointwise over keys, and
the group operations MUST preserve the "no zero-weight entries" invariant.

#### Scenario: group identity is the empty Z-set

- **WHEN** the empty Z-set is added to any Z-set `a`
- **THEN** the result MUST equal `a`

#### Scenario: subtraction is addition of negation

- **WHEN** Z-sets `a` and `b` are given
- **THEN** `a - b` MUST equal `a + (-b)` for every key's weight

### Requirement: `z^-1` is a strict one-tick delay

The delay operator MUST emit on every tick the value its input carried on the
previous tick, and MUST emit a declared initial value on the very first tick.
The delay operator MUST be strict — i.e., it MUST break feedback cycles for the
topological schedule so that the circuit builder can accept DAGs that would
otherwise contain a cycle.

#### Scenario: first tick emits the initial value

- **WHEN** a circuit with a delay is stepped for the first time with input `x0`
- **THEN** the delay's output at tick 0 MUST equal the declared initial value
- **AND** the input `x0` MUST be captured as the state for tick 1

#### Scenario: subsequent ticks emit the previous input

- **WHEN** the circuit is stepped again with input `x1`
- **THEN** the delay's output MUST equal `x0`
- **AND** stepping again with `x2` MUST emit `x1`

### Requirement: integration accumulates by the group operation

The integration operator on a stream carrying values from an abelian group MUST
publish, at tick `t`, the running sum over the group of every input value
observed at ticks `0..t` inclusive, using the declared zero as the starting
accumulator.

#### Scenario: integration of a Z-set delta stream

- **WHEN** an integration operator receives, in order, the delta Z-sets
  `{(k,+1)}`, `{(k,+1)}`, and `{(k,-1)}`
- **THEN** its outputs at ticks 0, 1, 2 MUST be the Z-sets
  `{(k,+1)}`, `{(k,+2)}`, and `{(k,+1)}` respectively
- **AND** feeding an additional `{(k,-1)}` at tick 3 MUST produce the empty Z-set

### Requirement: differentiation is the inverse of integration on causal streams

The differentiation operator MUST publish, at tick `t`, the group difference
between the current input value and the input value at tick `t-1`, using the
declared zero for `t=0`. The identities `D ∘ I = id` and `I ∘ D = id` MUST hold
for any causal input stream.

#### Scenario: D composed with I is the identity

- **WHEN** any Z-set delta stream is fed through integration and then
  differentiation in the same circuit
- **THEN** each tick's output MUST equal the corresponding tick's input
- **AND** this MUST hold for retraction-bearing streams (inputs with negative
  weights) as well as monotone streams

### Requirement: chain rule for incrementalization

For any operator `Q` on a group-valued stream, the incrementalized form `D ∘ Q
∘ I` MUST be observably equivalent to applying `Q` to the integrated stream and
then differentiating. When `Q` is linear (i.e., `Q(a + b) = Q(a) + Q(b)` and
`Q(-a) = -Q(a)`), the incrementalized form MUST simplify to `Q` itself on the
delta stream.

#### Scenario: linear operator incrementalizes to itself

- **WHEN** a linear operator (e.g., map, filter, plus, minus, cartesian,
  indexed-join when one side is held fixed) is wrapped in `D ∘ Q ∘ I`
- **THEN** the resulting circuit MUST produce the same delta stream as feeding
  the deltas directly through `Q`
- **AND** this equivalence MUST hold under retractions

### Requirement: bilinearity of join yields the three-term incremental formula

Join on Z-sets MUST be bilinear over the Z-set group: for all Z-sets
`a1, a2, b1, b2`, `(a1 + a2) ⋈ b = a1 ⋈ b + a2 ⋈ b` and
`a ⋈ (b1 + b2) = a ⋈ b1 + a ⋈ b2`. As a consequence, the incremental form of
join MUST be computable as the three-term sum
`Δa ⋈ Δb + z^-1(I(a)) ⋈ Δb + Δa ⋈ z^-1(I(b))` without materialising the full
relations.

#### Scenario: incremental join reproduces batch join

- **WHEN** two delta streams are fed through the three-term incremental join,
  and the same delta streams are also integrated and joined with a batch
  operator
- **THEN** differentiating the batch-joined stream MUST equal the output of the
  incremental form at every tick
- **AND** this MUST hold under interleaved inserts and retractions on either side

#### Scenario: join against an empty side is empty

- **WHEN** either side of an incremental join carries the empty Z-set at tick `t`
  with no prior non-empty history
- **THEN** the incremental-join output at tick `t` MUST be empty

### Requirement: `H` is the boundary-crossing increment of distinct

The incremental-distinct operator `H` MUST, given the integrated history before
the current delta and the current delta, emit only the keys whose integrated
weight crosses the positivity boundary (strictly positive to non-positive, or
non-positive to strictly positive). Its work MUST be bounded by the size of the
delta, independent of the size of the integrated history.

#### Scenario: boundary crossing upward

- **WHEN** a key's prior integrated weight is `0` and the delta carries `(k,+1)`
- **THEN** `H` MUST emit `(k,+1)`

#### Scenario: boundary crossing downward

- **WHEN** a key's prior integrated weight is `+1` and the delta carries `(k,-1)`
- **THEN** `H` MUST emit `(k,-1)`

#### Scenario: no boundary crossing

- **WHEN** a key's prior integrated weight is `+2` and the delta carries `(k,+1)`
- **THEN** `H` MUST NOT emit that key in its output Z-set

### Requirement: retraction-native invariants

Every operator defined by this capability MUST accept streams carrying negative
Z-weights (retractions) and MUST produce the same observable result as
reconstructing the integrated relation from scratch after the retraction. No
operator defined here requires a separate "tombstone" or "delete pass" to honor
a retraction.

#### Scenario: retraction of an inserted fact

- **WHEN** a fact is inserted at tick `t1` and retracted at tick `t2 > t1`
  through any linear operator chain defined by this capability
- **THEN** the integrated output at tick `t2` MUST NOT contain the retracted
  fact
- **AND** no subsequent tick MUST re-surface the retracted fact unless a new
  positive delta for that fact arrives
