## Purpose

The durability-modes capability defines the declarative knob a caller uses to
pick its backing-store correctness/throughput trade-off, the factory that maps
a chosen mode to a concrete backing-store implementation, and the feature-flag
gating that keeps research-preview modes off by default. The capability
provides four named durability modes — in-memory-only, OS-buffered, stable-
storage, and witness-durable — each with an honestly advertised recovery
property; it pins the resolution rules for the feature-flag evaluator; and it
commits to an offline-safe evaluator that never reads the network or an
uninvited configuration file.

## Requirements

### Requirement: named durability modes with honest recovery properties

The capability MUST expose four named durability modes and, for each, MUST
return a string advertising the recovery guarantee a caller can count on
today. The advertised string MUST reflect what currently ships, not merely
what the mode is named for.

#### Scenario: in-memory-only recovery property

- **WHEN** the recovery property for the in-memory-only mode is queried
- **THEN** the returned string MUST state that there is no recovery and the
  store is process-local

#### Scenario: OS-buffered recovery property

- **WHEN** the recovery property for the OS-buffered mode is queried
- **THEN** the returned string MUST state that writes survive a process crash
- **AND** MUST state that recent writes may be lost on a host crash

#### Scenario: stable-storage recovery property reflects shipped behaviour

- **WHEN** the recovery property for the stable-storage mode is queried
- **THEN** the returned string MUST name the mode's advertised contract
- **AND** MUST acknowledge that the shipped behaviour is OS-buffered until the
  per-save durability path lands
- **AND** MUST NOT claim a guarantee the shipped implementation does not yet
  provide

#### Scenario: witness-durable recovery property

- **WHEN** the recovery property for the witness-durable mode is queried
- **THEN** the returned string MUST mark the mode as a research preview
- **AND** MUST state that no shipped durability guarantee is offered until the
  protocol is specified and proven

### Requirement: backing-store factory maps a mode to an implementation

The capability MUST expose a factory that takes a chosen durability mode
together with the parameters needed by any disk-backed mode (a working
directory, a witness directory, and an in-memory quota) and returns a backing
store whose runtime behaviour matches that mode.

#### Scenario: in-memory-only yields an in-memory backing store

- **WHEN** the factory is invoked with the in-memory-only mode
- **THEN** the returned backing store MUST keep all batches in process memory
- **AND** MUST NOT create any file in the supplied working directory

#### Scenario: OS-buffered yields a disk-backed store

- **WHEN** the factory is invoked with the OS-buffered mode
- **THEN** the returned backing store MUST persist batches to the supplied
  working directory
- **AND** the saved-then-loaded batch MUST equal the original under the
  capability's batch equality semantics

#### Scenario: stable-storage yields disk-backed behaviour today

- **WHEN** the factory is invoked with the stable-storage mode
- **THEN** the returned backing store MUST provide at least OS-buffered
  semantics
- **AND** the recovery-property string MUST acknowledge the stable-storage
  contract is not yet fulfilled

### Requirement: witness-durable gated by an explicit feature flag

Selecting the witness-durable mode from the factory MUST require the
`witnessDurable` feature flag to be enabled. When the flag is not enabled,
the factory MUST refuse the witness-durable mode with an error that names the
flag the caller needs to set.

#### Scenario: factory refuses witness-durable without the flag

- **WHEN** the factory is invoked with the witness-durable mode and the
  `witnessDurable` flag is disabled
- **THEN** the factory MUST raise an `InvalidOperationException`
- **AND** the exception message MUST identify witness-durable as a research
  preview
- **AND** MUST direct the caller to the OS-buffered mode as the usable default

#### Scenario: factory returns a skeleton store with the flag set

- **WHEN** the factory is invoked with the witness-durable mode and the
  `witnessDurable` flag is enabled
- **THEN** the factory MUST return a backing store whose type advertises the
  witness-durable mode
- **AND** any `Save` call on the returned store MUST throw
  `NotImplementedException` with a message stating that the protocol is not
  yet implemented
- **AND** the throw MUST happen before any state mutation on the store so
  retries do not leak memory or side-effects

### Requirement: feature-flag evaluator resolution order

The feature-flag evaluator MUST resolve a flag's boolean value by the
following ordered rules, taking the first match:

1. A programmatic override set by the caller.
2. A per-flag environment variable named `DBSP_FLAG_<UPPER_NAME>` whose value
   is interpreted as `true` when it is `1`, `true`, `on`, or `yes`
   (case-insensitive).
3. The meta-environment-variable `DBSP_FLAG_RESEARCHPREVIEW`, which — when
   true — enables every flag whose lifecycle stage is research preview.
4. The default, which MUST be `false`.

#### Scenario: programmatic override wins over env var

- **WHEN** the per-flag env var for a research-preview flag is set to `1` and
  the caller programmatically sets the flag to `false`
- **THEN** the evaluator MUST return `false`

#### Scenario: per-flag env var wins over meta-flag

- **WHEN** the meta-environment variable is set and the per-flag env var is
  set to `0` or `false`
- **THEN** the evaluator MUST return `false` for that flag

#### Scenario: meta-flag does not enable experimental flags

- **WHEN** the meta-environment variable is set and a flag is in the
  experimental lifecycle stage
- **THEN** the evaluator MUST return `false` for that flag unless the
  per-flag env var or a programmatic override also enables it

#### Scenario: default is off

- **WHEN** no programmatic override, no per-flag env var, and no meta-flag
  relevant to this flag is set
- **THEN** the evaluator MUST return `false`

### Requirement: feature-flag evaluator is offline-safe

The feature-flag evaluator MUST NOT, at any point during evaluation, open a
network connection, read a configuration file the caller did not explicitly
hand it, or contact a centralised flag-management service. Flag resolution
MUST be a pure function of programmatic overrides and environment variables.

#### Scenario: evaluation makes no network call

- **WHEN** any flag is evaluated in a process with no network access
- **THEN** the evaluation MUST succeed
- **AND** MUST NOT hang waiting on a network operation
- **AND** MUST NOT throw a network-origin exception

#### Scenario: programmatic override is concurrent-safe

- **WHEN** one thread sets a flag override and another thread reads the same
  flag
- **THEN** the read MUST return either the prior value or the new value
- **AND** MUST NOT return a torn or partially-published value

### Requirement: flag lifecycle stages

Every feature flag MUST be classified into one of the three lifecycle stages:
experimental, research preview, or stable. The meta-environment variable
MUST enable research-preview flags only; it MUST NOT enable experimental
flags; and a stable-stage flag MUST, for exactly one release, unconditionally
read as `true` (with a warning on first read) before its definition is
removed from the code base entirely.

#### Scenario: witness-durable flag is classified as research preview

- **WHEN** the stage of the `witnessDurable` flag is queried
- **THEN** it MUST be `ResearchPreview`
- **AND** the flag MUST be mentioned in the feature-flag reference
  documentation alongside the durability mode it gates

#### Scenario: retired flag warns before removal

- **WHEN** a previously research-preview flag graduates to stable
- **THEN** for exactly one release the flag MUST read `true` unconditionally
- **AND** the first read per process MUST emit a warning directing callers to
  remove the opt-in
- **AND** in the next release the flag case, its env-var mapping, and its
  documentation row MUST be removed together
