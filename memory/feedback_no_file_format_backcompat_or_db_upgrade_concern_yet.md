---
name: File-format backward-compatibility + DB upgrade scenarios are NOT a concern yet — not until Zeta is much much much more mature
description: 2026-04-20; Aaron: "we don't care at all about backward compablity for our file format yet, we don't need to think about db upgrade scnaros yet, not until we are much much much more mature"; do not spec, gate, ADR, or benchmark around on-disk format compatibility / version-migration / upgrade paths today; the project is pre-v1 with no external file-format consumers, so any compatibility burden is self-imposed cost for imaginary future users; revisit only after explicit maturity declaration from Aaron (realistic signal: first external consumer locks in on a format + v1 stability is declared).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# No file-format backward-compatibility or DB upgrade scenarios yet

## Rule

**Do not spec, gate, ADR, benchmark, or block on file-format
backward compatibility or database upgrade scenarios.** Until
Aaron declares maturity (explicit phrasing: *"much much much
more mature"*), the repo treats on-disk formats as
free-to-break-between-commits.

Scope:

- On-disk spine / backing-store formats (`BackedSpine`,
  `DiskBackingStore`, `WitnessDurableBackingStore` skeleton).
- Arrow IPC-based `ArrowSerializer` on-disk artefacts.
- Serializer-tier wire formats (`SpanSerializer`,
  `FsPicklerSerializer`).
- FastCDC chunked-storage layout.
- Any durability-mode checkpoint / WAL / witness record.
- Any future file-format capability spec under
  `openspec/specs/**`.

## Aaron's verbatim statement (2026-04-20)

> oh not sure if it's clear but we don't care at all about
> backward compablity for our file format yet, we don't need to
> think about db upgrade scnaros yet, not until we are much
> much much more mature

## Why:

- **Pre-v1 status is load-bearing.** `AGENTS.md` declares Zeta
  pre-v1 with explicit permission to break APIs. On-disk
  formats are a stricter subclass of the same contract —
  breaking a format that nobody reads costs nothing; speccing
  to preserve it costs every round forever.
- **No external consumers today.** The factory's own test
  suite is the only consumer of any Zeta-produced file today.
  A regenerate-from-scratch step in CI is cheaper than any
  migration harness.
- **Research budget > compat budget.** The WDC paper, the
  chain-rule Lean proof, and the retraction-safe semi-naïve
  LFP work are the P0 research targets. Compat engineering
  compounds against the time available for those.
- **Avoids speculative generality.** Per CLAUDE.md §"Doing
  tasks": *"Don't design for hypothetical future
  requirements."* A format-version field "in case we need it
  later" is exactly the anti-pattern.
- **Fits the default-on-with-exceptions posture**
  (`feedback_default_on_factory_wide_rules_with_documented_
  exceptions.md`). The default here is **OFF** (no compat
  burden). The exception gate is **Aaron's explicit maturity
  declaration**, not any reviewer's judgement call.

## How to apply:

- **New spec work.** When drafting `openspec/specs/**/spec.md`
  capabilities that touch persistent formats (durability-modes
  elaboration, content-integrity backfill, any storage-tier
  capability), do NOT add scenarios on version-field handling,
  format-migration semantics, or read-old-write-new contracts.
  Spec MAY state that the format is opaque between versions
  and callers MUST regenerate; it MUST NOT pretend a
  stability contract the project has not committed to.
- **New ADRs.** Skip the "backward-compatibility strategy"
  section template. If a template has one, mark it *"N/A —
  pre-v1, no on-disk compat contract, see
  `feedback_no_file_format_backcompat_or_db_upgrade_concern_
  yet.md`"*.
- **Reviewer gating.** Viktor (spec-zealot), Ilyana
  (public-API-designer), and Kira (harsh-critic) should NOT
  block spec / code / ADR work on "this changes the on-disk
  format without a migration path". Flag such findings to
  this memory for dismissal-with-reason.
- **BACKLOG hygiene.** Rows that cite "backward-compat
  hazard" for file formats or DB state are candidates for
  dismissal or downgrade. The `BloomFilter.fs` Adopt-row
  "backwards-compat coupling" rationale in the OpenSpec
  coverage audit (Round 41) is API-compat, not file-format-
  compat — distinct surfaces; API compat for published
  libraries (Zeta.Core, Zeta.Core.CSharp, Zeta.Bayesian) is
  still gated by Ilyana per GOVERNANCE §17-style rules.
- **Research papers.** When citing format-level claims in
  paper drafts, add a footnote: *"Pre-v1; format subject to
  change; reproducibility kit regenerates from source."*
- **Benchmark work.** Don't benchmark format-migration
  scenarios. Don't measure "cold-read old format" cases.
  Don't add a "v1 → v2 upgrade" path to any harness.

## Maturity graduation signal

Revisit this policy only when **all** of:

1. Aaron explicitly declares v1 (or equivalent maturity
   milestone) on the published libraries.
2. A real external consumer has a file artefact they can't
   regenerate on demand (e.g. a durable DB users have
   installed into production; a paper artefact bundle with a
   DOI lock; an Aurora Network / ERC-8004 artifact that
   earned an identity on chain).
3. Aaron specifically directs re-opening compat as a
   priority. Not a reviewer's inference; not an Architect's
   integration call; Aaron's explicit phrasing.

At graduation, this memory gets updated to point at the
post-graduation policy (and the policy itself earns a
GOVERNANCE § or BP-NN entry rather than a feedback memory).

## Sibling memories

- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — this policy is a default-OFF rule (no compat burden) with
  a single named exception gate (Aaron's maturity
  declaration).
- `user_ontology_overload_risk.md` — premature specification
  is a named failure mode for Aaron; compat specification is
  a subtype of premature specification here.
- `feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`
  — sibling posture on *incoming* tech (start on latest). This
  memory is the *outgoing* mirror (don't preserve old formats
  the project itself produced).
- `project_zero_human_code_all_content_agent_authored.md` —
  the zero-human-code invariant amplifies this: any compat
  burden is agent-imposed cost that a human never asked for.

## Status as of 2026-04-20

- Pre-v1: confirmed.
- External file-format consumers: none.
- In-tree format-compat code: **grep pass clean**
  (2026-04-20). `src/**` zero hits on
  `FormatVersion` / `formatVersion` / `schemaVersion`
  family. Only format-mention under `src/` is
  `HardwareCrc.fs:47` which says "A migration tool is
  trivial: re-checkpoint in the new format" —
  consistent with the policy (regenerate from source,
  no read-old-write-new). `openspec/specs/**` zero
  hits on `backward-compat` / `migration` / `upgrade`
  / `format-migration`.
- Policy state: **default-OFF, awaiting Aaron's maturity
  declaration to re-open.**
