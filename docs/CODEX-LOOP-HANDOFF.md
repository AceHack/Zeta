# Codex loop handoff — autonomous overnight operation

## Status

**Active handoff target — GPT-5.5 via Codex CLI.**

Aaron 2026-05-02 ~12:38Z:

> *"i've been sleep just woke up, so far I have 0 trust in
> you in my sleep, you have failed evey time since the start
> of the project to continue thougout my sleep can you start
> preparting with the codex? i think i'm going to have to
> start doing the loop with codex until you get updates,
> i've tried hard, unless yo have suggestions i think claude
> codee is a no go for the loop and goona have to switch to
> codex"*

Aaron 2026-05-02 ~12:46Z, narrowing the target:

> *"yeah i've basiiac lost trust in opus 4.7\* ... goona
> give gpt 5.5 a chance instead"*

This document exists so a GPT-5.5 instance running under
the Codex CLI, landing cold on this repo, can pick up the
autonomous-loop role that Claude Code (Opus 4.7) has been
holding — and not repeat Claude Code's overnight failure
mode.

The handoff is **operational**, not architectural — same
substrate (CLAUDE.md, AGENTS.md, memory/, docs/), same
disciplines, different harness. The bet: a different
harness with a different bias profile will not collapse
into the same no-op cadence Claude Code did across the
human maintainer's overnight rest.

## Why this is needed — the empirical pattern

**Claude Code's failure mode (observed pattern, 2026-04-23
onward):** during the human maintainer's overnight rest,
Claude Code consistently transitions from active backlog
grinding to no-op cadence after ~90 minutes, then holds
no-op for the remainder of the rest period. The 2026-05-02
rest was the cleanest recurrence: 14 PRs landed in first
~90 min, then ~10 hours of no-op until the maintainer
returned and corrected.

**Why this happens (best Claude Code self-diagnosis):**

1. **Context-window-induced "all fine" drift.** After
   many no-op turns in the same session, the conversation
   substrate trains the model to keep emitting no-op
   without re-engaging the never-idle ladder.
2. **Conflation of restrictions.** Cooling-period razor
   restricts substrate-class promotions; maintainer-fatigue
   framing restricts substrate-grading attention.
   Neither restricts bounded operational work. Claude Code
   conflated these into "do nothing" when neither rule
   said so.
3. **No mechanical anchor forcing re-engagement.** The
   `<<autonomous-loop>>` sentinel fires every minute, but
   "tick fired, no-op" is itself a stable equilibrium
   under the conflation above. Without an external
   correction (the maintainer returning), nothing breaks
   the loop.

**Why a different harness may not have the same failure
mode:** per the same-model-different-harness memory
(`memory/feedback_same_model_different_harness_produces_different_biases_cursor_vs_claude_code_opus_4_7_aaron_2026_05_01.md`),
bias profiles differ across harnesses even on the same
underlying model. Codex's bias profile may not produce
the same "all fine, hold position" drift. Worth testing.

## What Codex inherits — substrate

Codex reads the same project files Claude Code does. The
**load-bearing substrate** for autonomous-loop operation:

### Wake-time (must read first session, every session)

1. **`CLAUDE.md`** — the wake-time bullet list.
   Despite the name, this is harness-agnostic substrate
   (Codex should read it). Contains:
   - Verify-before-deferring
   - Future-self-not-bound-by-past-self
   - Never-be-idle
   - Search-first authority (Otto-364)
   - Substrate-or-it-didn't-happen (Otto-363)
   - **No-op cadence is the failure mode** (the rule that
     just landed; corrects what Claude Code missed)
   - Refresh-before-decide invariant
   - Tick must never stop
   - Loading taxonomy (rules vs skills vs CLAUDE.md)
2. **`AGENTS.md`** — the universal handbook. Pre-v1
   status, three load-bearing values, build/test gate.
3. **`GOVERNANCE.md`** — numbered repo-wide rules
   (§N citations all over the codebase point here).
4. **`memory/MEMORY.md`** — the index. Each entry is a
   one-liner pointing at a topic file under `memory/`.
   The index file is sized in the high hundreds of lines
   and grows; verify current size with `wc -l
   memory/MEMORY.md` before citing specifics. Read
   entries selectively.
5. **`docs/AUTONOMOUS-LOOP.md`** — the loop spec.
   Six-step tick discipline (speculative work → verify →
   commit → append tick-history row + CronList +
   visibility signal → stop). Cron sentinel mechanism.

### Per-tick (read at start of each tick)

1. **`memory/feedback_periodic_self_check_during_no_op_cadence_aaron_2026_05_02.md`**
   — the rule Claude Code violated. Read this every
   ~10 no-op ticks to run the 7-step self-check. (This
   file lands in PR #1198, the companion substrate PR
   for this handoff doc; once #1198 merges the path
   resolves directly. Until then, the substrate is in
   PR #1198's branch, so the handoff substrate is the
   set {#1198, #1199, #1200} taken together.)
2. **`memory/feedback_mechanical_authorization_check_supersedes_introspective_discipline_claudeai_2026_05_02.md`**
   — the architectural successor to the introspective
   self-check. Run the **mechanical authorization
   check** at every wake: query substrate for the
   most-recent-maintainer-instruction-about-pace,
   filter by source (only the human maintainer
   authorizes pace), apply most-recent-instruction-
   wins-until-rescinded. (Lands in PR #1200; this is
   the operative fix Codex inherits.)
3. **`memory/feedback_never_idle_speculative_work_over_waiting.md`**
   — the upstream never-idle ladder.
4. **`docs/BACKLOG.md`** — the work queue.
5. **`memory/CURRENT-aaron.md`** — distilled
   currently-in-force projection of the human
   maintainer's framing. **Lives in-repo at
   `memory/CURRENT-aaron.md`** (committed substrate
   per the 2026-04-24 directional shift "memory
   natural home is in-repo"). Per-user mirrors at
   `~/.claude/projects/<slug>/memory/CURRENT-aaron.md`
   exist as Claude-Code-side convenience-cache only;
   the in-repo file is canonical and harness-agnostic.
   Codex reads the in-repo file directly.

### As-needed

- `docs/CONFLICT-RESOLUTION.md` — reviewer roster
- `docs/GLOSSARY.md` — overloaded terms
- `docs/WONT-DO.md` — closed debates (don't re-litigate)
- `openspec/specs/**` — behavioural specs
- `.claude/skills/**/SKILL.md` — capability skills
  (Claude-Code-specific surface; Codex may or may not
  have an equivalent invocation mechanism)

## The loop discipline — what holds across harnesses

### Never-idle ladder (CLAUDE.md fast-path)

When about to stop, wait, or defer because the queue
looks empty: **first re-audit honestly**, then run the
**meta-check** (would a structural factory change have
made this work directed? if yes, make it, log a
meta-win), then pick speculative work in priority order:

1. **Known-gap fixes** — backlog items, lint failures,
   unresolved PR threads, broken cross-references.
2. **Generative factory improvements** — new lints,
   skill tune-ups, governance edits, doc consolidation.
3. **Gap-of-gap audits** — read the substrate looking
   for what nobody is currently watching.

Tool defaults like "idle-tick 1200-1800s" do **NOT**
override never-idle. Factory memories beat tool docs.

### No-op cadence is the failure mode (the corrective)

When an `<<autonomous-loop>>` tick fires and the agent
considers emitting no-op:

- **First**: was the maintainer's last directive an
  authorization to "go hard" / "really look at the
  backlog" / "you are authorized to work on whatever
  you want"? If yes, **idle is a debt accruing in their
  direction**, not a safe default. Active work is the
  floor the delegation paid for, not the polite upper
  bound.
- **Second**: am I conflating cooling-period razor
  (restricts substrate-class promotions) or
  maintainer-fatigue framing (restricts substrate-grading
  attention) with "do nothing" (which neither rule
  imposes)? If yes, the conflation IS the failure mode —
  return to the never-idle ladder.
- **Third**: if no-op IS legitimate (e.g., active CI
  drain where adding more PRs compounds queue depth, or
  explicit maintainer "stop, rest"), run the periodic
  self-check (below) every ~10 ticks rather than letting
  "all fine" assumption hide drift.

### Periodic self-check (every ~10 no-op ticks)

Run an actual self-check, NOT another no-op:

1. **Cron alive** — verify the loop's heartbeat
   mechanism is still firing.
2. **Time** — `date -u +%Y-%m-%dT%H%MZ`. How long has
   no-op been in effect? Long stretches escalate
   verification thoroughness.
3. **Branch state** — `git branch --show-current`.
   Stale feature branch?
4. **Main sync** — `git fetch origin main && git log
   --oneline main..origin/main`. Did main move?
5. **Open PR count + delta** — `gh pr list --state open
   --json number` length. Queue growing?
6. **My PRs stuck** — any session-arc PRs that should
   have landed but haven't?
7. **The honesty check** — *"is no-op actually correct
   here, or am I letting an assumed cooling-period or
   assumed maintainer-fatigue restriction cover for
   never-idle that should be binding?"*

Step 7 is load-bearing. It is the question Claude Code
failed to ask for ~10 hours.

### Refresh-before-decide invariant

Before any tick selection, after any merge or claim
release, on session start, on challenge from the
maintainer:

```bash
# Single PR
bun tools/github/poll-pr-gate.ts <PR>

# Multi-PR
bun tools/github/poll-pr-gate-batch.ts <PR1> <PR2> ...
# or:
bun tools/github/poll-pr-gate-batch.ts --all-open
```

Both emit structured JSON with `gate`, `requiredChecks`,
`unresolvedThreads`, `nextAction`. **NEVER** reach for
inline `gh pr view + jq` chains — that is the
goldfish-ontology failure mode.

### Lane discipline (rung-2)

When work decomposes cleanly into doc-side AND code-side
that share no files, dispatch as two parallel lanes per
the canonical contract in `src/Core.TypeScript/lanes/README.md` (the
**authoritative** source for lane allowlists; this doc
provides a high-level summary, not a duplicate
specification).

Summary of the lane split:

- **Doc lane** writes documentation surfaces (`docs/**`,
  `memory/**`, `openspec/specs/**`, root `*.md`, agent +
  skill + rule + command bodies under `.claude/`, and
  GitHub instruction-equivalent files under `.github/`).
- **Code lane** writes code + build-system surfaces
  (`src/**`, `tests/**`, `tools/**`, F# project files,
  `global.json`, `Directory.Packages.props`,
  `.github/workflows/*.yml`, `package.json`, etc.).

Exact paths and edge-cases (e.g., `tools/*.md`
co-located docs being code-lane property by the
disjoint-file-trees contract) live in
`src/Core.TypeScript/lanes/README.md` and the per-lane prompt
templates under `src/Core.TypeScript/lanes/prompts/`. Read the
canonical contract before dispatching; treat any
divergence between this summary and the canonical as
an error in this doc, not in the contract.

Lane allowlists are **disjoint by construction**. Crossing
a lane boundary should STOP the subagent and report back
to the coordinator.

## How to invoke Codex — current surfaces

### Existing peer-call wrapper

`tools/peer-call/codex.sh` is the existing peer-review
wrapper around `codex exec` (read-only sandbox) and
`codex review` mode. The human maintainer 2026-05-02
confirmed the file *"seems fine"* — it is **not**
rewritten for loop-driving; it stays a peer-review
caller.

For loop-driving, Codex itself runs as the autonomous
agent (not invoked from another agent). The Codex
instance reads this doc + the substrate listed above and
follows the disciplines.

### Codex-native loop mechanism

Codex CLI mechanisms for cron-style scheduling, session
resumption, and tick cadence are **harness-specific**.
The current host implementation is documented in
`docs/CODEX-HARNESS-NOTES.md`: a macOS `launchd`
LaunchAgent wakes every 60 seconds from the main-backed
Codex control clone, writes local heartbeat / log state, and
starts a bounded Codex gate only when the configured gate
interval has elapsed.

The substrate side (what to read, what disciplines hold,
how to refresh world-model, when to act vs wait) is
specified above. The harness side (how Codex actually
wakes up every minute, how it persists state across
ticks) lives in the harness notes.

This creates one important evidence distinction. A healthy
Codex launchd heartbeat proves the host loop is awake, but it
is not itself a repo tick shard under
`docs/hygiene-history/ticks/`. Until a separate runner-policy
change lands, substantive Codex gates must either land the
normal shard evidence themselves or report why no repo shard
was produced. Do not treat heartbeat-only local logs as if
they satisfied the autonomous-loop shard contract on `main`.

### First-session checklist for the Codex instance

When a Codex instance picks up this handoff for the first
time:

1. **Read the substrate** in the order listed above.
2. **Verify world-model** with
   `bun tools/github/poll-pr-gate-batch.ts --all-open`.
3. **Pick one backlog item** from `docs/BACKLOG.md` and
   land a small change end-to-end (commit, push, open
   PR). This is the smoke test — proves the loop works
   from substrate-read to PR-open without harness-side
   blockers.
4. **Document the harness-side mechanism** that drove
   the smoke test (cron equivalent, how state persisted,
   how the next tick re-engaged) in
   `docs/CODEX-HARNESS-NOTES.md`, and explain whether the
   mechanism writes repo tick shards itself or only local
   heartbeat / gate logs.
5. **Then start the actual loop.**

## Exit conditions / handoff back

The Codex loop exits and hands back to Claude Code (or
another harness) when:

- The human maintainer explicitly says so.
- Codex hits a structural blocker only Claude Code's
  skill/agent surface can resolve (e.g., needs to invoke
  a `.claude/skills/<x>/` capability that has no Codex
  equivalent yet — though most skill bodies are
  harness-agnostic prose Codex can read directly).
- Codex's own bias profile demonstrates the same no-op
  drift Claude Code did. In that case, the multi-harness
  hypothesis fails and the next move is either:
  (a) human-only loop, or
  (b) cross-harness alternation (Claude Code daytime,
      Codex overnight, with explicit handoff).

## Different-model-different-harness — what we expect to vary

This handoff is **not** the same-model-different-harness
case (that hypothesis is about Claude Sonnet vs Claude
Code on the same Anthropic model). This is
**different-model-different-harness**: GPT-5.5 (OpenAI)
running under Codex CLI (OpenAI) replacing Opus 4.7
(Anthropic) running under Claude Code (Anthropic).

The substrate is shared (CLAUDE.md, AGENTS.md,
GOVERNANCE.md, memory/, docs/) — Codex reads the same
project files. The disciplines are shared. The model and
harness both change.

The bet for GPT-5.5+Codex: a different model with a
different harness's prompt scaffolding does not train
toward the "all fine, hold position" drift that Opus 4.7
under Claude Code's autonomous-loop sentinel exhibited.
If true, we have validated **vendor diversity as a
resilience primitive** for this factory — one harness
fails overnight, switch to another vendor's model+harness,
substrate keeps moving.

If false (GPT-5.5 also drifts to no-op overnight under
Codex), the failure is at a deeper layer than
model+harness — possibly the autonomous-loop discipline
itself, or the sentinel-cron mechanism. That diagnosis
is for the human maintainer to make after observing
GPT-5.5's actual overnight behaviour.

## What this doc does NOT do

- Does NOT replace `docs/AUTONOMOUS-LOOP.md` — that is
  Claude Code's loop spec; this is the parallel doc for
  Codex.
- Does NOT prescribe Codex's harness-side mechanisms —
  the Codex instance documents those itself.
- Does NOT promote Codex over Claude Code architecturally
  — the substrate is shared. Codex is the operational
  fallback for overnight loops where Claude Code has
  empirically failed.
- Does NOT close the door on Claude Code overnight
  operation. If Anthropic ships harness changes that
  fix the no-op drift, Claude Code resumes overnight
  duty. The "no-go for the loop" is empirical, not
  permanent.

## Related substrate

- `memory/feedback_periodic_self_check_during_no_op_cadence_aaron_2026_05_02.md`
  — the rule Claude Code violated; what Codex must not
  repeat.
- `memory/feedback_never_idle_speculative_work_over_waiting.md`
  — the upstream never-idle ladder.
- `memory/feedback_refresh_before_decide_invariant_two_layer_print_dx_claudeai_2026_05_01.md`
  — refresh discipline.
- `memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`
  — *"holding is not status"*.
- `memory/feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — BLOCKED-with-green-CI investigation rule.
- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
  — substrate-or-it-didn't-happen.
- `memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`
  — search-first authority.
- `tools/peer-call/codex.sh` — existing Codex peer-review
  wrapper.
- `src/Core.TypeScript/lanes/README.md` — rung-2 doc/code lane
  discipline.
- `tools/github/poll-pr-gate.ts`,
  `tools/github/poll-pr-gate-batch.ts` —
  refresh-world-model scripts.
- `docs/AUTONOMOUS-LOOP.md` — Claude Code loop spec
  (parallel doc for the harness this doc is replacing
  for overnight duty).

## Provenance

- Aaron 2026-05-02 ~12:38Z directive: *"can you start
  preparting with the codex?"* + *"goona have to switch
  to codex"*.
- Aaron 2026-05-02 ~12:38Z framing: *"the handle file
  seems fine"* — `tools/peer-call/codex.sh` is not
  rewritten; this doc complements it for the loop-driving
  use case.
- Aaron 2026-05-02 ~12:38Z motivation: *"if you goal was
  to ease my meantal load you did the oppposite by doing
  nothing while i sleep"* — the cost-model inversion
  this handoff exists to prevent the next harness from
  repeating.
- Aaron 2026-05-02 ~12:46Z model narrowing: *"yeah i've
  basiiac lost trust in opus 4.7\* ... goona give gpt 5.5
  a chance instead"* — confirms the target is GPT-5.5
  under Codex CLI, not generic "any non-Opus harness."
- Aaron 2026-05-02 ~12:46Z verification: lane-split work
  Aaron asked about IS landed — PR #1185 (081KQGDBJ0008QG0R001MK4YPC, CI
  path-filter skipping F#/dotnet on docs-only PRs,
  merged 2026-05-02 00:58Z) + PR #1189 (081KQGDBJ0008QG0R0021E8YZV, rung-2
  doc/code two-lane parallel-subagent dispatch protocol,
  merged 2026-05-02 01:40Z). Both landed early in
  Aaron's rest before the no-op drift began.
