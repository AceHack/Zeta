## Purpose

The z-set-algebra capability specifies the two foundational data structures the
Zeta factory builds on: the **Z-set** — a finitely-supported signed multiset
(a map from keys to signed integer weights) that forms an abelian group under
addition — and the **IndexedZSet** — a Z-set of `(key, value)` pairs grouped by
key for efficient key-wise access. It pins the observable behaviour of the
construction, group, and relational operators over both structures and the
algebraic laws those operators satisfy. This spec is language-agnostic: it
describes observable behaviour, not any particular runtime or host-language
surface. Implementation-specific types, signatures, and representation
invariants live in `profiles/<lang>.md`.

The four DBSP stream operators (delay `z^-1`, integration `I`, differentiation
`D`, incremental-distinct `H`) and the chain-rule identity are specified by the
sibling `operator-algebra` capability; this capability is restricted to the
data-model layer those operators consume.

## Requirements

### Requirement: Z-set is a finitely-supported signed multiset

A Z-set over a key type MUST behave as a finitely-supported map from keys to
signed integer weights, with the invariant that a key is never present with a
zero weight in any exposed representation, and that operations are purely
functional (every operation returns a new Z-set without mutating its inputs).

#### Scenario: look-up of an absent key returns zero

- **WHEN** the weight of a key not present in a Z-set is requested
- **THEN** the result MUST be `0`
- **AND** the look-up MUST NOT raise an exception

#### Scenario: a key driven to zero weight is pruned

- **WHEN** an operation produces a weight of `0` for some key
- **THEN** that key MUST NOT appear in the resulting Z-set's exposed entries
- **AND** iterating the result MUST NOT yield that key

#### Scenario: operations do not mutate inputs

- **WHEN** any operator is applied to one or more Z-sets
- **THEN** the input Z-sets MUST be observably unchanged afterward
- **AND** the operator MUST return a distinct result value

### Requirement: Z-set entries normalise to ascending key order

A Z-set MUST present its entries in strictly ascending order under the declared
key comparer at every observable boundary (equality, iteration, serialization),
and equality MUST be independent of the order in which entries were supplied.

#### Scenario: equality ignores insertion order

- **WHEN** two Z-sets are constructed from the same `(key, weight)` pairs in
  different orders
- **THEN** they MUST compare equal
- **AND** their entry sequences MUST be identical after normalisation

#### Scenario: iteration yields ascending keys

- **WHEN** a Z-set's entries are iterated
- **THEN** for every pair of adjacent entries `(k_i, w_i)` and
  `(k_{i+1}, w_{i+1})` the comparer MUST report `k_i < k_{i+1}`

### Requirement: Z-set operations form an abelian group under addition

Addition (`add`), negation (`neg`), and subtraction (`sub`) MUST satisfy the
abelian-group laws pointwise over keys, and MUST preserve the no-zero-weight
invariant.

#### Scenario: adding a key and its negation yields empty

- **WHEN** a Z-set containing `(k, +1)` is added to a Z-set containing `(k, -1)`
- **THEN** the resulting Z-set MUST be the empty Z-set
- **AND** iterating its entries MUST produce zero entries

#### Scenario: empty is the additive identity

- **WHEN** the empty Z-set is added to any Z-set `a`
- **THEN** the result MUST equal `a`

#### Scenario: addition is associative and commutative

- **WHEN** Z-sets `a`, `b`, and `c` are given
- **THEN** `(a + b) + c` MUST equal `a + (b + c)`
- **AND** `a + b` MUST equal `b + a`

#### Scenario: subtraction is addition of negation

- **WHEN** Z-sets `a` and `b` are given
- **THEN** `a - b` MUST equal `a + (-b)` for every key's weight

### Requirement: scalar scaling distributes over addition

The scaling operator MUST multiply every key's weight by an integer scalar and
MUST distribute over addition, with a scalar of `0` producing the empty Z-set.

#### Scenario: scaling distributes over addition

- **WHEN** Z-sets `a` and `b` and an integer scalar `n` are given
- **THEN** `n · (a + b)` MUST equal `(n · a) + (n · b)`

#### Scenario: scaling by zero produces empty

- **WHEN** any Z-set is scaled by `0`
- **THEN** the result MUST be the empty Z-set

### Requirement: weight arithmetic overflow is observable

A sequence of operations that would drive any single key's accumulated weight
outside the supported signed-integer range MUST surface a checked-arithmetic
failure rather than silently wrapping around.

#### Scenario: overflow surfaces as a failure

- **WHEN** a group operation would push a key's weight beyond the supported
  signed-integer range
- **THEN** the operation MUST surface a checked-arithmetic failure to its
  caller rather than wrap around modulo the integer width

### Requirement: map, filter, flatMap, and cartesian transform keys

The relational transform operators MUST preserve the no-zero-weight invariant
and MUST combine weights of colliding keys by addition.

#### Scenario: map groups colliding keys by summing weights

- **WHEN** `map` applies a key function that maps two distinct keys
  `k1` and `k2` (with weights `w1` and `w2`) to the same key `k`
- **THEN** the result MUST contain `(k, w1 + w2)`
- **AND** if `w1 + w2` is `0` the key `k` MUST be pruned

#### Scenario: filter retains only matching keys

- **WHEN** `filter` is applied with a predicate
- **THEN** the result MUST contain exactly the entries whose keys satisfy the
  predicate, with their weights unchanged
- **AND** entries whose keys fail the predicate MUST be absent

#### Scenario: cartesian multiplies weights pairwise

- **WHEN** `cartesian` is applied to Z-sets `a` and `b`
- **THEN** the result MUST contain, for every `(ka, wa)` in `a` and
  `(kb, wb)` in `b`, the entry `((ka, kb), wa · wb)`

### Requirement: join is bilinear over the Z-set group

The join operator MUST match entries by a shared key, multiply the weights of
matching entries, and be bilinear — distributing over addition in each
argument independently.

#### Scenario: join multiplies weights of matching keys

- **WHEN** `join` matches an entry of weight `wa` in `a` with an entry of
  weight `wb` in `b` on a shared key
- **THEN** the combined output entry MUST carry weight `wa · wb`

#### Scenario: join distributes over addition

- **WHEN** Z-sets `a`, `b`, and `c` are given
- **THEN** `join(a + b, c)` MUST equal `join(a, c) + join(b, c)`
- **AND** `join(a, b + c)` MUST equal `join(a, b) + join(a, c)`

### Requirement: distinct projects weights to set membership

The `distinct` operator MUST map every key with a non-zero weight to weight
`+1` and drop every key whose weight is `0`, projecting a multiset onto its
underlying set.

#### Scenario: distinct normalises positive and negative weights to one

- **WHEN** `distinct` is applied to a Z-set containing `(k1, +3)` and
  `(k2, -2)`
- **THEN** the result MUST contain `(k1, +1)` and `(k2, +1)`

#### Scenario: incremental distinct tracks set membership across a delta

- **WHEN** the incremental form of `distinct` is given an accumulated Z-set
  and a delta Z-set
- **THEN** its output MUST be the delta to the distinct projection — i.e. the
  change in set membership the delta induces, bounded by the delta's support

### Requirement: IndexedZSet groups a Z-set of pairs by key

An IndexedZSet MUST behave as a Z-set of `(key, value)` pairs that exposes, for
each key, the inner Z-set of values, and MUST be constructible from a flat
Z-set by extracting a key and a value from each entry.

#### Scenario: indexing groups entries under their extracted key

- **WHEN** a flat Z-set is indexed by a key extractor and a value extractor
- **THEN** entries whose extracted key is equal MUST be grouped under that key
- **AND** the inner Z-set for a key MUST carry each grouped value with its
  original weight

#### Scenario: key-wise add merges inner Z-sets

- **WHEN** two IndexedZSets are added
- **THEN** for every key present in both, the inner Z-sets MUST be added
- **AND** keys present in only one operand MUST appear unchanged in the result

#### Scenario: round-tripping through a flat Z-set preserves entries

- **WHEN** an IndexedZSet is flattened back to a Z-set of `(key, value)` pairs
- **THEN** the result MUST carry every `(key, value)` pair with its weight
- **AND** re-indexing that flat Z-set MUST reproduce the original IndexedZSet

### Requirement: IndexedZSet join operates on shared key space

The IndexedZSet join MUST match keys present in both operands, join their inner
Z-sets, and combine matching values through a caller-supplied combiner.

#### Scenario: join is performed per shared key

- **WHEN** two IndexedZSets over the same key space are joined
- **THEN** only keys present in both operands MUST contribute output
- **AND** for each shared key the inner value Z-sets MUST be joined and their
  matching weights multiplied
