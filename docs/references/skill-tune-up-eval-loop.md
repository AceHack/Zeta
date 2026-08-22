# `skill-tune-up` — eval-loop hand-off protocol

This reference documents the hand-off protocol between
`skill-tune-up` (Aarav — the ranker) and `skill-creator` /
`skill-improver` (the actuators) via the upstream Anthropic
`plugin:skill-creator` eval harness. Extracted from
`.claude/skills/skill-lifecycle/blueprints/skill-tune-up.md` in round 43 to close
the BP-03 self-breach (the skill file was 436 lines after
the round-42 retune; extraction shrinks it back under the
300-line cap while preserving the protocol verbatim).

Authoritative canonical source: the Anthropic skills guide
at `docs/references/anthropic-skills-guide.md` +
`docs/references/anthropic-skills-guide-2026-01.pdf`. This
reference file documents only the Zeta-local wrapper layer —
when / why `skill-tune-up` routes findings into the harness,
what workspace conventions the factory uses, and how results
feed back into the ranker.

## What ships in the upstream plugin

At `~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/`:

- `scripts/run_eval.py` — execute one eval (one prompt,
  with or without the skill) and capture outputs + timing.
- `scripts/run_loop.py` — the full iteration loop (spawn
  with-skill + baseline subagents, grade, aggregate).
- `scripts/aggregate_benchmark.py` — produce
  `benchmark.json` + `benchmark.md` from an iteration's
  eval directories.
- `scripts/improve_description.py` — description-line
  optimiser against trigger-phrase benchmarks (narrow use
  case; the loop above is the general tool).
- `scripts/quick_validate.py` — pre-flight validation of a
  skill's structure and frontmatter.
- `scripts/package_skill.py` — zips + publishes (not used
  by the tune-up path; the bespoke workflow commits via
  git).
- `eval-viewer/generate_review.py` — static-HTML reviewer
  for eval outputs side-by-side; emits `feedback.json`.
- `agents/grader.md`, `agents/analyzer.md`,
  `agents/comparator.md` — role prompts used by the loop.
- `references/schemas.md` — JSON schemas for `evals.json`,
  `benchmark.json`, `eval_metadata.json`, `grading.json`,
  `feedback.json`.

## When to hand off — the gate

| Recommended action | Effort | Eval loop? | Manual-edit + log? |
|--------------------|--------|-----------|--------------------|
| TUNE               | S      | Optional  | Default            |
| TUNE               | M, L   | Yes       | No                 |
| SPLIT              | any    | Yes       | No                 |
| MERGE              | any    | Yes       | No                 |
| RETIRE             | any    | No        | Yes (log the why)  |
| HAND-OFF-CONTRACT  | any    | Optional  | Default            |
| OBSERVE            | any    | No        | No                 |

Rule of thumb: if the change affects triggering behaviour,
output shape, or instruction-following on an observable
task, the eval loop runs. If the change is a mechanical
rename, a broken-link repair, a BP-NN citation refresh, an
ASCII-lint cleanup, a typo fix, or a **content extraction
that preserves the protocol verbatim** — it goes through
the manual-edit + justification-log path documented in
`memory/feedback_skill_edits_justification_log_and_tune_up_cadence.md`
Rule 1 and lands in `docs/skill-edit-justification-log.md`.

## The wrapper's per-round protocol

On each invocation, after producing the top-5 ranking:

1. **Pick top-1.** If its action is in the "Eval loop? =
   Yes" row above, continue; otherwise report and stop.
2. **Drop a hand-off note** in Aarav's notebook naming the
   top-1 skill, the signal, the recommended action, and
   the effort. Do NOT edit any SKILL.md.
3. **Surface the hand-off** to `skill-creator` as the next
   step — the ranker is advisory; the Architect (Kenji) or
   a human decides to run the loop. The hand-off naming
   is: `skill-creator: run eval loop on <skill-name> —
   action:<X>, effort:<Y>, signal:<Z>, BP:<NN,NN>`.
4. **Workspace convention** (for `skill-creator`'s use,
   not the ranker's):
   `<repo-root>/.claude/skills/<skill-name>-workspace/iteration-N/eval-<id>/{with_skill,without_skill|old_skill}/outputs/`.
   The workspace is git-ignored by default; pass-rate /
   token / time deltas are what land in the round-close
   ledger, not the raw iteration artifacts.
5. **Read the result back.** Once `skill-creator` runs
   the loop and reports, Aarav re-reads `benchmark.json`
   and records in his notebook: pass-rate delta, token
   delta, wall-time delta, and the user-feedback summary
   from `feedback.json`. That data influences next round's
   ranking (a skill that regressed on pass-rate in the
   last round should rank near the top again until the
   regression clears).

## Stopping criteria — know when to stop iterating

Borrowed from the Anthropic guide Pattern 3 (p. 23) —
"Iterative refinement: know when to stop iterating":

- **Stop when pass-rate hits the declared target** in the
  iteration's `evals.json` assertions (usually 100% on
  triggering tests, ≥ 80% on functional tests).
- **Stop when pass-rate plateaus** across two consecutive
  iterations with no qualitative improvement in the
  viewer.
- **Stop when regression appears** on a previously-passing
  assertion — revert to the prior iteration and rethink.
- **Stop on effort-S skills after one iteration** — a
  small skill is not worth more than one eval loop per
  tune-up round; diminishing returns set in fast.

## Round-close ledger row

On a round that ran the eval loop at least once, the
ledger gains a `Skill tune-up eval` line of the form:

```
Skill tune-up eval — <skill-name>: pass-rate <before>% → <after>%
  (tokens Δ <±N>k, wall-time Δ <±Ns>). Result: [LANDED | REVERTED | DEFERRED]
```

On a round where no eval loop ran (because the top-1 was
in the manual-edit row), the existing `Skill tune-up`
ledger line names the top-1 and the justification-log row
instead.

## What the wrapper deliberately does NOT ship

- Its own test harness. The plugin is the engine.
- Its own benchmark schema. Uses the upstream
  `references/schemas.md` verbatim.
- Its own grader / analyzer prompts. Uses upstream
  `agents/grader.md`, `agents/analyzer.md`,
  `agents/comparator.md`.
- Its own trigger-phrase optimiser. Uses upstream
  `scripts/improve_description.py` when the action is
  description-line tuning specifically.

If any of those were re-implemented locally, the wrapper
stopped being a wrapper and started being a fork — which
is the failure mode Rule 1 (common-entry-point discipline)
is designed to prevent.

## Rationale — why this content lives here and not in the SKILL.md body

`.claude/skills/skill-lifecycle/blueprints/skill-tune-up.md` was at 436 lines
after the round-42 retune (commit `baa423e`) — 1.45x the
stable BP-03 300-line cap. The protocol content is
reference material (stable, lookup-on-demand, not needed
on every invocation); progressive-disclosure discipline
says reference content belongs outside the SKILL.md body.
Extraction preserves the protocol verbatim, restores
BP-03 conformance, and gives the Skill Improver (Yara)
one reference file to maintain rather than one 436-line
skill file.

The SKILL.md body retains only the "what the protocol is
for + pointer here" summary; every operational detail
(the gate table, the per-round protocol, the stopping
criteria, the ledger row, the what-not-to-ship list)
lives in this file.

See `memory/feedback_skill_tune_up_uses_eval_harness_not_static_line_count.md`
for the standing rule on when ranking claims require the
harness and when static signals suffice.

## Notebook format template (extracted from SKILL.md)

The notebook at `memory/aarav/NOTEBOOK.md` follows:

```markdown
# Skill Tune-Up — Notebook

## Running observations
- YYYY-MM-DD — observation

## Current top-5 (refresh each run)
1. [skill] — priority: [P0/P1/P2]
   - Signal: [drift | contradiction | staleness | user-pain | bloat | portability-drift | router-coherence-drift]
   - Action: [TUNE | SPLIT | MERGE | RETIRE | HAND-OFF-CONTRACT | OBSERVE]
   - Effort: [S | M | L]

## Self-recommendation

## Pruning log
```

## Ranking output format template (extracted from SKILL.md)

Every ranking round produces:

```markdown
# Skill Tune-Up Ranking — round N

## Live-search summary
- Queries run: <list>
- Findings logged to scratchpad: <count> (in
  memory/best-practices-scratch.md)
- Candidate promotions flagged to Architect: <count>

## Top-5 skills needing tune-up

1. **<skill-name>** — priority: P0 | P1 | P2
   - Signal: [drift | contradiction | staleness | user-pain |
     bloat | best-practice-drift | portability-drift |
     router-coherence-drift]
   - Violates: BP-<NN>[, BP-<NN>]   (only when signal is
     best-practice-drift)
   - Recommended action: [TUNE | SPLIT | MERGE | RETIRE |
     HAND-OFF-CONTRACT | OBSERVE]
   - Effort: S | M | L
   - Rationale: 1-2 sentences with the concrete evidence.
   - Suggested fix: one line per violated rule
     (e.g. "BP-02: add a 'What this skill does NOT do' block").

...

## Notable mentions
- [skills close to flagging but not there yet]

## Self-recommendation
- Does this skill itself need tune-up? [yes/no] — concrete
  signal (including any BP-NN violations found in his own
  file). Honest answers only; no modesty bias.
```

Findings that cite `BP-<NN>` IDs are handed off to the Skill
Improver (Yara) as checkbox work. Findings without a rule-ID
citation are either (a) evidence that we need a new rule
(file to scratchpad) or (b) judgement calls that the
`skill-improver` handles case-by-case.
