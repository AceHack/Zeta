---
name: Incomplete Source-Set Regeneration Hazard + Workflow Null-Result Audit Signal — class names + controls (Amara naming, Otto incident, 2026-04-28)
description: Amara 2026-04-28T20:00Z named two reusable classes after Otto's PR #683 work. (1) Incomplete Source-Set Regeneration Hazard — "regenerate from sources" tooling becomes destructive when the source set is incomplete; control is `--check` / `--stdout` / diff-preview first, force-write only after completeness is proven. (2) Workflow Null-Result Audit Signal — `gh run list --workflow=<path>` returning `[]` for an existing workflow is a reusable audit signal, not a conclusion; inspect six diagnostic questions (too-new-to-fire / disabled / non-default-branch / cron-mismatch / event-trigger-incompatible / wrong-identifier-filter). Both fold into task #269 cadenced-counterweight-audit.
type: feedback
---

# Two Amara-named classes from PR #683 work

## Source

Amara 2026-04-28T20:00Z review of Otto's PR #683 close-out
insight (forwarded by Aaron via /btw aside style). Amara
sharpened two reusable patterns into named classes with
explicit controls.

## Class 1 — Incomplete Source-Set Regeneration Hazard

### Definition

When tooling **regenerates a canonical artifact from a set of
source files**, the regeneration is destructive if the
source-set is **incomplete**. The artifact loses any content
that was supposed to be in the artifact but isn't yet
represented in the sources.

### Concrete incident (Otto 2026-04-28T19:51Z)

- Tool: `tools/backlog/generate-index.sh`
  (with `BACKLOG_WRITE_FORCE=1`).
- Source set: per-row files under `docs/backlog/PN/B-NNNN-*.md`.
- Canonical artifact: `docs/BACKLOG.md`.
- Source-set state: **incomplete migration in progress** (per
  B-0061; the legacy stockpile of un-migrated rows is still
  embedded in the artifact and is NOT yet represented in
  per-row files).
- What happened: ran the generator → it wrote a 108-line
  auto-generated stub that drops the un-migrated content →
  17000+ lines clobbered.
- Caught: by `git diff --stat` immediately after commit,
  before push.
- Recovery: `git checkout HEAD~1 -- docs/BACKLOG.md` + commit
  amend.
- Net cost: 1 minute of recovery work; no published damage.

### The control (Amara's prescription)

Generators that overwrite canonical state need:

1. **`--check` mode first** — fails if the regenerated output
   would differ from the canonical state. Safe to run; never
   writes.
2. **`--stdout` / diff-preview second** — print the
   regenerated content (or diff against canonical) without
   writing. Lets the operator inspect the proposed change.
3. **Force-write only after migration/source-completeness is
   proven**. The "force" flag is gated by an explicit human
   or automated assertion that the source-set is now complete.

This matches the existing counterweight taxonomy:

- **Cheap prevention**: `--check` mode in CI lint job (catches
  drift between sources and artifact without ever writing).
- **Cadenced detect+repair**: periodic `--check` runs on the
  artifact; failure = either source-set still incomplete OR
  artifact has been hand-edited and needs re-regeneration.
- **Defense-in-depth for high-cost misses**: pre-push hook +
  branch-protection + this-row's-discipline.

### Generalizes to

Anywhere a generator regenerates a canonical artifact from a
multi-file source set:

- `docs/BACKLOG.md` ← per-row backlog files (this incident)
- `docs/MEMORY.md` (in-repo if/when one exists) ← per-memory
  files
- Generated docs (e.g. API reference) ← source code annotations
- Any "compile multiple files into one canonical bundle" tool

For each: identify the canonical artifact + its source set,
verify completeness invariant, design `--check` / `--stdout`
modes, gate force-write.

## Class 2 — Workflow Null-Result Audit Signal

### Definition

When `gh run list --workflow=<path>` (or equivalent) returns
`[]` (no runs) for a workflow that **exists in the repository**,
the empty result is **a reusable audit signal, not a
conclusion**. Inspect the cause before drawing conclusions.

### Concrete incident (Otto 2026-04-28T19:46Z)

- Workflow: `.github/workflows/budget-snapshot-cadence.yml`.
- Query: `gh run list --workflow=.github/workflows/budget-snapshot-cadence.yml --limit=5`.
- Result: `[]`.
- Initial conclusion: "the workflow has never fired".
- Actual cause: workflow was committed to LFG main today
  (2026-04-28T16:22Z); cron is `23 16 * * 0` (Sundays only);
  next natural fire is 2026-05-03 (after task #287 deadline);
  too-new-to-fire AND deployment-context-mismatch combined.

### The six diagnostic questions (Amara's checklist)

When `gh run list --workflow=<path>` returns `[]` for an
existing workflow:

1. **Has it ever fired?** — check workflow file's first commit
   date vs cron schedule's first natural fire date.
2. **Is it on the default branch?** — GitHub Actions scheduled
   workflows only run from the default branch. A workflow file
   in a feature branch will never fire on schedule.
3. **Is it disabled?** — public-repo schedules can be disabled
   after inactivity (60+ days no commits to the workflow).
   `gh run list --all` may show runs for disabled workflows
   that the default `gh run list` filters out.
4. **Is the cron valid UTC?** — cron is always UTC; a `0 9 * * *`
   that the author intended as "9am local" fires at the wrong
   time. Validate against `crontab.guru` or similar.
5. **Is the event trigger compatible with this deployment context?**
   — `pull_request_target` from external forks needs different
   permissions; `workflow_run` requires the upstream workflow
   to fire first; `schedule` needs default-branch (see #2).
6. **Are we filtering by the right workflow identifier?** —
   `gh run list --workflow` accepts name (display name from
   YAML), ID (numeric), or filename (path). Mismatched
   identifier returns `[]` even when runs exist.

### The control

Fold the six-question checklist into task #269
(cadenced-counterweight-audit skill). The audit's cadence is
the right home: every audit cycle, walk all workflows in
`.github/workflows/`, query `gh run list`, and run the
six-question check on any that return `[]`.

This matches the counterweight taxonomy's three-phase shape:

- Phase 1: shell tooling (`scripts/audit-workflow-coverage.sh`
  walks all workflows, runs `gh run list`, applies the six
  checks, prints findings).
- Phase 2: skill wrapper (cadenced-counterweight-audit invokes
  the script + interprets findings).
- Phase 3: tick-open hook (auto-runs on session-start when no
  recent audit has been done).

### Critical caveat (Amara's "tiny blade note")

**Don't overfit the signal to two causes.** The original Otto
framing collapsed the six questions to "too-new-to-fire OR
cron-doesn't-fit-deployment-context". That's incomplete —
disabled-workflow and event-trigger-incompatibility are
genuinely distinct failure modes that need their own
inspection.

The class name **Workflow Null-Result Audit Signal** preserves
the broader category; the six questions enumerate the failure
modes; the control invokes them in order.

## Both classes compose with

- `tools/hygiene/sort-tick-history-canonical.py` + the
  Chronological Insertion Polarity Error class
  (`memory/feedback_chronological_insertion_polarity_error_amara_class_name_otto_2026_04_28.md`)
  — same factory-design philosophy: substrate-level controls
  beat vigilance.
- `memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — adjacent: 5 pre-flight disciplines for destructive git
  operations. Generator-clobber is in the same family.
- `memory/feedback_emit_empty_security_result_on_conditional_skip_ci_maturity_pattern_aaron_2026_04_28.md`
  — same shape of CI maturity: design the workflow's coverage
  semantics carefully so the metric is honest.
- `memory/feedback_self_healing_metrics_on_regime_change_factory_design_principle_aaron_2026_04_28.md`
  — same shape of "design the substrate, let the mechanism do
  the work".
- Task #269 (cadenced counterweight-audit skill) — both classes
  are direct entries for this skill's audit catalogue.
- Task #287 (cost-visibility deadline window) — Workflow
  Null-Result class identified the gap that fed B-0085.

## What this is NOT

- **NOT a directive to retrofit `--check` modes everywhere
  immediately.** The discipline applies forward to new
  generators + opportunistically to existing ones during
  substantive changes.
- **NOT a ban on regenerating artifacts from sources.** That's
  the right pattern; the discipline is about the safe-mode
  controls around it.
- **NOT specific to GitHub Actions.** The Workflow Null-Result
  class generalizes to any cadenced workflow / cron / scheduled
  job whose run-history can be empty: GitLab CI, Jenkins,
  CircleCI, internal cron daemons, systemd timers.

## Pickup notes for future-Otto

When you see `gh run list --workflow=<X>` return `[]`:

1. Don't conclude "never fired".
2. Run through the six diagnostic questions.
3. If the cause is too-new-to-fire AND a deadline-window
   matters, file a backlog row asking the maintainer to
   manually dispatch (don't dispatch autonomously — see
   visibility-constraint).
4. If the cause is disabled / non-default-branch / cron-bug /
   event-trigger-bug, the workflow is BROKEN; file as P1+
   factory-hygiene gap.

When you write a new generator that overwrites canonical state:

1. Default mode is `--check` (read-only diff against canonical).
2. Add `--stdout` for preview.
3. Force-write requires explicit flag (`--write` or
   `BACKLOG_WRITE_FORCE=1`-style), and DOCUMENT in the script
   header what completeness invariant the force-write requires.
4. Wire `--check` into CI lint as the cheap-prevention layer.
