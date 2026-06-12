## Purpose

The retraction-native capability specifies the principles and guarantees of Retraction-Native Semantics, a core architectural pattern in the Zeta factory. Under this model, all mutations are represented as the application of a signed delta rather than destructive in-place updates. 

This model relies on the group addition and inverse properties of the underlying Z-Set algebra (specified in `openspec/specs/z-set-algebra/spec.md`) to guarantee that deletions can be clean, reversible, auditable, and replayable, and that counterfactual queries can be evaluated efficiently.

## Requirements

### Requirement: Mutations are represented as signed deltas

All insertions and deletions in a retraction-native collection MUST be represented as the application (addition) of a signed delta. Destructive updates are prohibited.

#### Scenario: Insertions are positive deltas

- **WHEN** an element `e` is added to a collection
- **THEN** it MUST be represented as a delta containing the element with a positive weight `+w`
- **AND** applying this delta to the collection MUST increase the weight of `e` by `w`

#### Scenario: Deletions are negative deltas

- **WHEN** an element `e` is removed from a collection
- **THEN** it MUST be represented as a delta containing the element with a negative weight `-w`
- **AND** applying this delta to the collection MUST decrease the weight of `e` by `w`

### Requirement: Retractions satisfy invertibility (cancellation)

Applying a retraction delta of the same magnitude as a prior insertion delta MUST return the collection to its original state (modulo compaction metadata), satisfying the group inverse property.

#### Scenario: Addition and negation cancel to empty

- **WHEN** a delta `d` is applied to a collection
- **AND** the negated delta `-d` is subsequently applied
- **THEN** the net effect of both applications MUST be the identity (no change to the collection)
- **AND** any element added by `d` MUST be pruned from the collection if its weight returns to `0`

#### Scenario: Counterfactual queries are evaluated via inverse deltas

- **WHEN** the state of a collection is queried as if a past delta `d` had never occurred
- **THEN** the system MUST be able to construct the counterfactual state by adding the inverse delta `-d` to the current state
- **AND** this operation MUST run in time proportional to the size of the delta `O(|d|)` rather than the size of the collection

### Requirement: Graph operations are retraction-native

A directed graph represented over a Z-Set of edges MUST support retraction-native edge addition and removal.

#### Scenario: Edge addition increases edge weight

- **WHEN** an edge `(source, target)` is added to a graph with weight `w`
- **THEN** the graph edge Z-Set MUST accumulate `(source, target)` with positive weight `+w`

#### Scenario: Edge removal retracts edge weight

- **WHEN** an edge `(source, target)` is removed from a graph with weight `w`
- **THEN** the graph edge Z-Set MUST accumulate `(source, target)` with negative weight `-w`
- **AND** if the resulting edge weight becomes `0`, the edge MUST be pruned from the graph

#### Scenario: Removal before addition produces anti-edges

- **WHEN** an edge `(source, target)` is removed from an empty graph or a graph where it is absent
- **THEN** the edge Z-Set MUST accumulate `(source, target)` with negative weight `-w` (an anti-edge)
- **AND** subsequently adding the same edge with weight `w` MUST result in an empty graph (complete cancellation)
