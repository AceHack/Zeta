---
name: skill-tune-up rankings use the Anthropic eval harness (grader/analyzer/comparator), not static line-count / by-inspection scans; same rule applies to skill-expert and any other "which skill is worst" ranker
description: Standing rule. When ranking skills by tune-up urgency or "worst performance", always use the Anthropic skill-creator plugin's eval harness (automated grading via agents/grader.md, failure analysis via agents/analyzer.md, A/B comparison via comparator agents, benchmark HTML via eval-viewer/generate_review.py). Do not rank by line count, BP-NN citation inspection, or static heuristics alone — those are "guessing" per Aaron's explicit correction. The retuned skill-tune-up SKILL.md (commit baa423e) already wraps this harness; use it.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

When the factory needs to know *which skill is currently
worst-performing* — whether via `skill-tune-up` (Aarav),
`skill-expert`, or any future ranker — the ranking **must**
exercise the Anthropic `skill-creator` plugin's eval harness.

The harness, at `plugin:skill-creator` (shipped by Anthropic,
`~/.claude/plugins/cache/claude-plugins-official/skill-creator/`):

- `scripts/run_loop.py` — iteration loop that fans out
  test-case subagents with-skill + baseline in the same
  turn.
- `agents/grader.md` — automated pass/fail grading of
  assertions against run outputs.
- `agents/analyzer.md` — failure-class / pattern-recognition
  pass surfacing gaps the aggregate stats hide.
- Comparator agents — side-by-side A/B between two skill
  versions (pre-retune vs post-retune, or skill-A vs
  skill-B).
- `scripts/aggregate_benchmark.py` + `eval-viewer/
  generate_review.py` — produces `benchmark.json` +
  `benchmark.md` + an HTML viewer for human inspection of
  both qualitative outputs and quantitative pass-rate /
  time / token deltas.

Static ranking signals (line count against BP-03, keyword
scans for drift, BP-NN citation-by-inspection, "stale for N
rounds") are **adjuncts**, not substitutes. They are cheap
and fine for notebook observations, but the **top-of-list
claim** — "skill X is the worst-performing this round" —
requires an eval-harness run against concrete test cases.

## Why

Aaron 2026-04-20, correcting a round-42 `skill-expert`
dispatch that ranked skills by BP-03 line-count only:

> *"also when using skill-tune up or skill-expert not sure
> when you are doing now to rank and figure out which skill
> is the worse performance antoopic has tools for that build
> into the plugin too, make sure we are using those bad
> performance skill tools where it makes sense instead of
> trying to guess. We will want to look for best practice
> issues and all that like all of our experts in all of our
> skills should be doing. but just want to make sure we are
> talking advantage of all of the fatures of the anthropic
> skill builder"*

Follow-up: Aaron laid out the specific tool capabilities
(grader agent, analyzer sub-agent, comparator agents for
A/B, benchmark HTML reports, self-reflection
capability) and flagged that we've been under-using them.

Load-bearing reasoning:

- **"Worst" is an empirical claim.** Which skill is actually
  worst depends on outputs under real prompts, not on file
  size. A 642-line skill that produces pass-rate 95% on 20
  test cases is not worst; a 180-line skill that produces
  pass-rate 45% on the same-difficulty set is. Static
  ranking inverts the signal when a skill got fat for good
  reason (explicit reference pointers, worked examples,
  anti-pattern catalogue) but still performs.
- **Anthropic's skill-creator 2.0 is the Paved Road.** The
  harness is shipped as a plugin, invocable via the
  `Skill` tool, with grader / analyzer / comparator agents
  already written. Reinventing it via inspection ranking is
  re-doing work someone else already paid the upfront cost
  for.
- **`.claude/skills/skill-tune-up/SKILL.md` was retuned for
  this.** Commit `baa423e` (Round 42, same round as Aaron's
  correction) grew the file 303 -> 436 lines specifically
  because it's now a thick wrapper over the eval harness
  (scripts/, agents/, references/, PDF). The retune is
  correct; the dispatcher (Kenji / main agent) needs to
  actually *invoke* the retuned workflow, not the pre-
  retune by-inspection workflow.

## How to apply

### When ranking is requested

Invoke `skill-tune-up` or `skill-expert` **and require the
agent to drive the eval harness**. The minimum shape:

1. **Pick a candidate set** — usually the top-N from cheap
   static signals (bloat, staleness, recent user-pain), but
   the set is *input* to the harness, not the conclusion.
2. **Spawn harness runs** — for each candidate, run test
   cases under both the current skill and a baseline (no
   skill OR prior version). The `skill-creator` workflow's
   "Running and evaluating test cases" section is the
   canonical procedure. Use subagents so context doesn't
   pollute.
3. **Grade + analyse** — run the grader agent, then the
   analyzer sub-agent, then (if comparing two versions) a
   comparator agent.
4. **Aggregate** — `python -m scripts.aggregate_benchmark
   <workspace>/iteration-N --skill-name <name>` to produce
   `benchmark.json` + `benchmark.md`.
5. **Rank from benchmark data** — the top-5 for the round
   cites pass-rate, token cost, and analyzer-identified
   failure classes, not line count.

### When ranking is not requested

Static signals (bloat, staleness, BP-NN drift, portability
drift) are still the correct lens for:

- **Notebook observations** (Aarav's running log under
  `memory/persona/aarav/NOTEBOOK.md`).
- **Best-practice-drift audits** (Aaron called these out
  explicitly: "we will want to look for best practice
  issues and all that like all of our experts in all of our
  skills should be doing").
- **Prompt-injection / invisible-Unicode lints** (handled
  by `prompt-protector`, not a performance signal anyway).
- **Portability drift** (criterion #7 on the ranker —
  generic-by-default checks are static by construction).

These feed the **candidate set** going into the harness.
They don't replace the harness.

### Hybrid cadence (the usual case)

- Every invocation: the ranker **always** logs static
  signals to the notebook (cheap, no API cost, no test-
  harness setup).
- Every 3-5 invocations, OR on-demand when a "worst-
  performing" claim needs to be authoritative: the ranker
  exercises the harness against its current top candidates
  and publishes a benchmark-backed ranking.
- The notebook format carries a line for each top-5 entry
  noting `benchmark: <date>` or `benchmark: pending` so the
  Architect can see at a glance whether the claim is
  harness-backed.

## Scope — this applies to

- `.claude/skills/skill-tune-up/` (Aarav's capability
  skill)
- `.claude/agents/skill-tune-up.md` (Aarav's persona)
- `skill-expert` (subagent)
- Any future ranker that claims to identify "worst"
  skills
- Any new-skill vs baseline comparison (per
  `skill-creator`'s own self-test workflow)

## Scope — this does NOT apply to

- Ranking by portability drift (criterion #7) — static by
  definition.
- Prompt-protector BP-10 invisible-Unicode lints — not a
  performance metric.
- Retirement candidates based on N-round staleness — a
  retired skill shouldn't be eval-run, just retired.
- `skill-gap-finder` — finds *absent* skills, no
  candidates to benchmark.
- `copilot-wins.md` review-class calibration — already
  empirical (counting actual wins), not a performance claim
  about a local skill.

## Round-42 remediation follow-through

The round-42 Aarav ranking (committed in `memory/persona/
aarav/NOTEBOOK.md`) is a static-signal audit, not a
harness-backed ranking. Leaving it as-is would embed the
error Aaron corrected against. Three options:

1. **Re-run with harness** — pick top 4 flagged skills
   (performance-analysis-expert / reducer / consent-
   primitives-expert / skill-tune-up self), stand up eval
   test cases for each, run the grader + analyzer, land a
   harness-backed revised top-5 in a round-43 Aarav
   notebook update. Most faithful to Aaron's correction but
   highest cost.
2. **Annotate** — leave the static-signal ranking in place
   but add a notebook preamble labelling it "static signals
   only, not harness-backed; harness run scheduled for
   round N". Cheap, preserves the correction pointer.
3. **Both** — annotate now, schedule harness for round 43.

Lean: option 3. The annotation prevents the current entry
from claiming authority it hasn't earned; the scheduled
harness run closes the gap on the next invocation.

## Interaction with `feedback_tech_best_practices_living_
list_and_canonical_use_auditing.md`

That memory establishes the per-tech expert-skill
responsibility to run internet searches + keep canonical-
use artifacts. This memory is the **tool side** of the
same hygiene stance: use the tools vendors ship rather
than inventing home-grown heuristics. `skill-creator`'s
eval harness is Anthropic's paved road for "is this skill
still good" the same way canonical Microsoft docs /
Mathlib idioms / current F# guidance are the paved roads
for "is this tech used well".

Both memories together describe a single discipline:
**use the vendor-provided instruments; don't guess.**

## Correction notes (why this memory exists)

Round 42 (2026-04-20): I dispatched `skill-expert` (Aarav)
to run the round-42 `skill-tune-up` ranking. The agent
produced a top-5 based entirely on BP-03 line-count
violations and best-practice citation inspection — the
pre-retune ranker logic. Commit `baa423e` this same round
had retuned `.claude/skills/skill-tune-up/SKILL.md` into a
436-line thick wrapper over the Anthropic eval harness
precisely to fix this pattern. I committed the notebook
update (`aarav/NOTEBOOK.md`) and filed a P2 BACKLOG entry
before noticing the miscalibration.

Aaron corrected within the same round: *"make sure we are
using those bad performance skill tools where it makes
sense instead of trying to guess"*. This memory exists so
the next factory instance (and the next `skill-expert`
dispatch) does not repeat the by-inspection pattern when a
"worst" claim is on the table.
