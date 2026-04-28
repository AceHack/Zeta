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
| `audit_commit.sh`     | HC-2, HC-6, SD-6 alignment clauses           | Per-commit lint             |
| `audit_personas.sh`   | Notebook touch + commit mentions             | Per-round persona runtime   |
| `audit_skills.sh`     | DORA-2025 columns adapted to skill scope     | Per-round skill runtime     |
| `audit_archive_headers.sh` | Archive-header discipline (proposed §33) | Per-file lint (detect-only v0) |
| `sd6_names.txt`       | SD-6 watchlist (per-host)                    | Data (not code)             |

The three scripts form the gitops observability trio:
commit-scope (`audit_commit.sh`), persona-scope
(`audit_personas.sh`), and skill-scope (`audit_skills.sh`).
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
tools/alignment/audit_commit.sh

# Audit a range
tools/alignment/audit_commit.sh main..HEAD

# JSON output (for the observability stream)
tools/alignment/audit_commit.sh --json

# Write per-commit JSON files to a directory
tools/alignment/audit_commit.sh --out tools/alignment/out/round-37

# Per-round persona audit
tools/alignment/audit_personas.sh --round 38 --out tools/alignment/out/round-38

# Per-round skill audit (DORA-columns)
tools/alignment/audit_skills.sh --round 38 --out tools/alignment/out/round-38

# Skill audit with friction gate — fails if any skill has
# friction (rounds-since-owner-touched) >= threshold
tools/alignment/audit_skills.sh --round 38 --gate 10
```

Exit codes:

- `0` — all commits clean (no `VIOLATED` signals)
- `1` — one or more `VIOLATED` without explicit citation
- `2` — script error

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

- `bash` 3.2+ (macOS default)
- `git` 2.x
- `grep`, `awk`, `sed` (POSIX)
- no runtime libraries; no network

The scripts are intentionally portable to bare
macOS bash 3.2 so the install script doesn't
need to pin a newer bash just for alignment
linting.

## Relationship to other tooling

- `tools/lint/` — repo-wide hygiene (ASCII
  cleanliness, no-empty-dirs). Those lints are
  *structural*; alignment lints are *relational*
  (evidence against the contract).
- `tools/alignment/` + CI — Dejan (devops-
  engineer) owns the CI-gate decision for any
  alignment lint that graduates beyond advisory.
  Graduation requires an Architect ADR.
- `memory/persona/sova/NOTEBOOK.md` — Sova's
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
- [`.claude/skills/alignment-auditor/SKILL.md`](../../.claude/skills/alignment-auditor/SKILL.md)
  — per-commit audit procedure.
- [`.claude/skills/alignment-observability/SKILL.md`](../../.claude/skills/alignment-observability/SKILL.md)
  — framework + per-round + multi-round procedure.
- [`.claude/agents/alignment-auditor.md`](../../.claude/agents/alignment-auditor.md)
  — Sova persona file.
