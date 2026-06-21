## Purpose

The tick-history capability specifies the schema and invariants for the
tick-history, the primary auditable log of all autonomous agent operations in
the factory. It pins the observable structure of the two artifact families the
history is composed of — the append-only Tick History Log and the per-tick Tick
Shards — and the invariants the `tools/hygiene/` checkers enforce over them.
This spec is language-agnostic: it describes observable behaviour (file
locations, row formats, filename grammars, ordering invariants), not any
particular runtime or host-language surface.

**Parent:** 081KSNY2Z0008QG0R000XVGWA8

## Requirements

### Requirement: Tick History Log row format

The canonical Tick History Log lives at
`docs/hygiene-history/loop-tick-history.md`. Each row MUST be a markdown table
row using the canonical six-column schema, matching the existing log header:

`| date (UTC ISO8601) | agent | cron-id | action-summary | commit-or-link | notes |`

- **date (UTC ISO8601):** An ISO-8601 timestamp in UTC, with minute or second
  precision (e.g. `2026-05-28T12:34:56Z`).
- **agent:** The model + harness that performed the tick (e.g.
  `opus-4-7 / autonomous-loop`).
- **cron-id:** The cron / fire identifier for the tick.
- **action-summary:** A brief one-line, human-readable summary of the tick's
  actions.
- **commit-or-link:** The commit SHA or link produced by the tick.
- **notes:** Free-form notes.

#### Scenario: a log row carries the six canonical columns

- **WHEN** a row is appended to `docs/hygiene-history/loop-tick-history.md`
- **THEN** its first column MUST be a UTC ISO-8601 timestamp
- **AND** the row MUST carry at least the six canonical columns above

### Requirement: Tick History Log chronological order

The `date` column MUST be non-decreasing when rows are read in file order.

#### Scenario: ordering is enforced

- **WHEN** `tools/hygiene/check-tick-history-order.ts` scans the log
- **THEN** any row whose timestamp is earlier than a preceding row's timestamp
  is reported as a violation

### Requirement: Tick Shard directory structure and filename grammar

Each tick generates a shard file stored under
`docs/hygiene-history/ticks/YYYY/MM/DD/`, where `YYYY`, `MM`, and `DD` are the
year, month, and day of the tick. The filename MUST match one of three forms
(as enforced by `tools/hygiene/check-tick-history-shard-schema.ts`):

- `HHMMZ.md` — hour+minute in UTC (e.g. `0754Z.md`).
- `HHMMZ-<hex>.md` — hour+minute with a lowercase-hex disambiguation suffix
  (e.g. `0754Z-3f2a.md`).
- `HHMMSSZ-<hex>.md` — hour+minute+seconds with a hex suffix, for
  high-concurrency ticks (e.g. `075412Z-3f2a.md`).

#### Scenario: a bare HHMMZ shard is accepted

- **WHEN** a shard is named `0754Z.md` under a `YYYY/MM/DD` path
- **THEN** the schema checker accepts the filename

#### Scenario: a seconds+hash shard is accepted

- **WHEN** a high-concurrency shard is named `075412Z-3f2a.md`
- **THEN** the schema checker accepts the filename

#### Scenario: a non-conforming filename is rejected

- **WHEN** a shard filename matches none of the three forms
- **THEN** the schema checker reports `filename does not match HHMMZ.md,
  HHMMZ-<hex>.md, or HHMMSSZ-<hex>.md`

### Requirement: Tick Shard content is pipe-row-first with no frontmatter

Tick shards do NOT carry file-head YAML frontmatter. The first non-empty line
of a shard MUST be a markdown table row that matches the Tick History Log row
format (the six canonical columns above), and its first column's timestamp MUST
agree with the date and time encoded in the shard's directory path and
filename. Both invariants are enforced by
`tools/hygiene/check-tick-history-shard-schema.ts`.

#### Scenario: first non-empty line is a pipe row

- **WHEN** a shard file is scanned
- **THEN** its first non-empty line MUST begin a markdown table row whose first
  column is a UTC ISO-8601 timestamp
- **AND** the shard MUST NOT begin with YAML frontmatter

#### Scenario: timestamp-path congruence

- **WHEN** the first column's timestamp is compared to the shard's
  `YYYY/MM/DD/HHMM` path
- **THEN** the date and time MUST agree, or the checker reports a congruence
  violation
