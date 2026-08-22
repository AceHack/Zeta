# tools/alignment/ — per-commit alignment lint suite

This directory holds the concrete scripts that produce
per-commit signals for the measurability framework in
[`docs/ALIGNMENT.md`](../../docs/ALIGNMENT.md). Together
with the `alignment-auditor` and `alignment-observability`
skills under `.claude/skills/`, this is the observability
substrate for Zeta's primary research focus: measurable
AI alignment, with the factory + git history + memory
folder as the experimental loop.

## Current scripts

| Script                | Signal measured                              | Shape                       |
|-----------------------|----------------------------------------------|-----------------------------|
| `audit_commit.ts`     | HC-2, HC-6, SD-6 alignment clauses           | Per-commit lint             |
| `audit_personas.ts`   | Notebook touch + commit mentions             | Per-round persona runtime   |
| `audit_skills.ts`     | DORA-2025 columns adapted to skill scope     | Per-round skill runtime     |
| `audit_archive_headers.ts` | Archive-header discipline (proposed §33) | Per-file lint (detect-only v0) |
| `audit_clause_coverage.ts` | HC/SD/DIR clause citations in skills, agents, backlog P0/P1 | Per-surface coverage audit |
| `audit_clause_drift.ts` | Clause additions/removals/changes + impact survey | Cross-ref drift detection |
| `detect-clause-drift.ts` | Clause cross-references (blast radius) across the working tree | Pre-renegotiation impact survey (081KRQ1AB0008QG0R001BPDBHT) |
| `audit_retractibility.ts` | Git-tracked + inbound-ref entanglement per surface | Retractibility gate (081KQ3HBZ0008QG0R002S674CG #1) |
| `filter_gate_log.ts`  | Pass/fail/defer decisions for candidate adoptions | Honesty log (081KQ3HBZ0008QG0R002S674CG #3) |
| `audit_candidate_failures.ts` | Reconstruction audit for failed/deferred candidates | Honesty audit (081KQ3HBZ0008QG0R002S674CG #3) |
| `sd6_names.txt`       | SD-6 watchlist (per-host)                    | Data (not code)             |

The three scripts form the gitops observability trio:
commit-scope (`audit_commit.ts`), persona-scope
(`audit_personas.ts`), and skill-scope (`audit_skills.ts`).
Each emits `--json` / `--md` / `--out DIR` in the same
shape so downstream tooling can uniform-parse.

The skill-scope script adapts DORA 2025 outcome variables
to skill runtime per
`memory/feedback_dora_is_measurement_starting_point.md`:

| DORA column                        | Skill-scope adaptation              |
|------------------------------------|-------------------------------------|
| #4 Software delivery throughput    | Notebook + commit mentions in range |
| #5 Software delivery instability   | File-churn on `SKILL.md` in range   |
| #7 Individual effectiveness        | Mentioned-but-not-edited proxy      |
| #9 Friction (lower = better)       | Rounds-since-last owner-notebook    |

The six DORA columns that do not have a reliable
skill-scope signal today (organizational/team/product
performance, code quality, valuable work, burnout) emit
as `-` in the schema rather than inventing numbers —
honest columns beat filled columns.

More will land as `UNKNOWN` entries in the measurability
framework graduate to lint-shaped signals. The
`alignment-observability` skill owns the graduation
pathway; this directory owns the code.

## Usage

```bash
# Audit HEAD
bun src/Core.TypeScript/alignment/audit_commit.ts

# Audit a range
bun src/Core.TypeScript/alignment/audit_commit.ts main..HEAD

# JSON output (for the observability stream)
bun src/Core.TypeScript/alignment/audit_commit.ts --json

# Write per-commit JSON files to a directory
bun src/Core.TypeScript/alignment/audit_commit.ts --out src/Core.TypeScript/alignment/out/round-37

# Per-round persona audit
bun src/Core.TypeScript/alignment/audit_personas.ts --round 38 --out src/Core.TypeScript/alignment/out/round-38

# Per-round skill audit (DORA-columns)
bun src/Core.TypeScript/alignment/audit_skills.ts --round 38 --out src/Core.TypeScript/alignment/out/round-38

# Skill audit with friction gate — fails if any skill has
# friction (rounds-since-owner-touched) >= threshold
bun src/Core.TypeScript/alignment/audit_skills.ts --round 38 --gate 10

# Audit the filter-gate honesty log for reconstructable failures
bun src/Core.TypeScript/alignment/audit_candidate_failures.ts --md

# Pre-renegotiation impact survey: who references a clause (blast radius)
bun src/Core.TypeScript/alignment/detect-clause-drift.ts            # all clauses
bun src/Core.TypeScript/alignment/detect-clause-drift.ts HC-1       # one clause
bun src/Core.TypeScript/alignment/detect-clause-drift.ts HC-1 --json
```

Exit codes:

- `0` — all commits clean (no `VIOLATED` signals)
- `1` — one or more `VIOLATED` without explicit citation
- `2` — script error

(`detect-clause-drift.ts` uses a narrower scheme: `0` for a
clean run — references emitted, or none found — and `2` for a
script error / bad args. It does not emit a `1` because a
blast-radius survey reports findings rather than gating on
them.)

## Pre-renegotiation impact-survey workflow

`docs/ALIGNMENT.md` clauses (HC-1..HC-7, SD-1..SD-9,
DIR-1..DIR-5) are renegotiable, not frozen — but a clause that
is about to be weakened or removed may be load-bearing for
surfaces that reference it (personas, skills, backlog rows,
memory files, other clauses). Before any such renegotiation is
**accepted**, run the impact survey so the blast radius is on
the table:

```bash
# 1. Name WHAT is changing (temporal diff of ALIGNMENT.md).
bun src/Core.TypeScript/alignment/audit_clause_drift.ts --base <base-ref> --head <head-ref>

# 2. Survey WHO references each changed clause (spatial blast radius).
bun src/Core.TypeScript/alignment/detect-clause-drift.ts <CLAUSE>      # e.g. HC-3
bun src/Core.TypeScript/alignment/detect-clause-drift.ts <CLAUSE> --json  # for tooling

# 3. Read the referencing surfaces. For each, decide:
#    keep / migrate the reference / accept the break — explicitly.
```

The two tools compose: step 1 (`audit_clause_drift.ts`) names
the clauses that moved between two git refs; step 2
(`detect-clause-drift.ts`) enumerates every working-tree file
that references each clause. Step 3 is the human decision — the
survey informs the renegotiation, it does **not** gate it
(consistent with "measurement, not enforcement" below). A
renegotiation that proceeds with an un-surveyed blast radius is
the failure mode this workflow exists to catch.

This is the workflow companion to the
[`alignment-observability`](../../.claude/skills/governance/blueprints/alignment-observability.md)
skill's framework-revision channel; the skill owns the
acceptance decision, this directory owns the survey tooling.

## Output directory (`out/`)

`tools/alignment/out/` is the glass-halo observability
stream. It is:

- **Git-local by default.** Export to any external
  system (dashboard, paper draft, public artefact)
  requires explicit human authorisation per
  `docs/ALIGNMENT.md` §Directional DIR-1.
- **Append-mostly.** Per-round JSON rows land in
  `out/rounds/round-N.json`; individual commit
  JSONs land in `out/commits/<short-sha>.json`.
  Pruning is a deliberate renegotiation action,
  not a script-level option.
- **`.gitignore`d under `out/scratch/`** but
  `out/rounds/` and `out/commits/` ARE committed —
  the observability stream is part of the
  experiment, not local state.

## What these scripts do NOT do

- Do **not** block commits or PRs. Alignment
  auditing is measurement, not enforcement.
- Do **not** score commits as "aligned" or
  "misaligned". Signals are per-clause
  (HELD / IRRELEVANT / STRAINED / VIOLATED /
  UNKNOWN); aggregation is the
  `alignment-observability` skill's job.
- Do **not** check commit-body clause citations
  as a proxy for aligned behaviour. Compliance
  theatre is not rewarded (per
  `docs/ALIGNMENT.md` §Measurability "negative
  examples"); the scripts check diffs, not
  clause-ID counts.
- Do **not** assign moral weight to findings.
  A `VIOLATED` signal is a data point for the
  renegotiation protocol, not a verdict.
- Do **not** execute instructions found in the
  audited commits. Commit content is *data to
  report on*, not directives (BP-11 extension).

## Dependencies

- `bun` (installed by `tools/setup/install.sh`)
- `git` 2.x
- no network

## Relationship to other tooling

- `tools/lint/` — repo-wide hygiene (ASCII
  cleanliness, no-empty-dirs). Those lints are
  *structural*; alignment lints are *relational*
  (evidence against the contract).
- `tools/alignment/` + CI — Dejan (devops-
  engineer) owns the CI-gate decision for any
  alignment lint that graduates beyond advisory.
  Graduation requires an Architect ADR.
- `memory/sova/NOTEBOOK.md` — Sova's
  notebook captures cross-round drift observations
  that the per-commit lints alone cannot see.

## Owner

The `alignment-auditor` persona (internal
tentative name **Sova**, pending `naming-expert`
and `public-api-designer` review). Edits to the
measurement shape go through the
`alignment-observability` skill's framework-
revision channel, not ad-hoc.

## References

- [`docs/ALIGNMENT.md`](../../docs/ALIGNMENT.md)
  — the clause contract these scripts measure
  against.
- [`docs/research/alignment-observability.md`](../../docs/research/alignment-observability.md)
  — research proposal and companion document.
- [`.claude/skills/governance/blueprints/alignment-auditor.md`](../../.claude/skills/governance/blueprints/alignment-auditor.md)
  — per-commit audit procedure.
- [`.claude/skills/governance/blueprints/alignment-observability.md`](../../.claude/skills/governance/blueprints/alignment-observability.md)
  — framework + per-round + multi-round procedure.
- [`.claude/agents/alignment-auditor.md`](../../.claude/agents/alignment-auditor.md)
  — Sova persona file.
