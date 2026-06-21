---
name: Skill flywheel + expansion flywheel + parallel-tracks substrate — three flywheel-class questions Aaron surfaced 2026-05-02
description: 2026-05-02; Aaron asked three load-bearing questions about flywheel dynamics during daily backlog work. (1) Is the skill flywheel active? — partially; skill router active, skill bodies dormant. (2) What process turns daily churn into expansion-while-shrinking? — dual-loop: consume-loop closes rows, produce-loop surfaces N≥0 new rows; flywheel condition E[N]>1; mostly Aaron-Otto-bidirectional today, four substrate-rules waiting on automation. (3) Parallel tracks via the team? — substrate exists (worktree isolation + Task subagent + PR gate + depends_on graph + named personas); orchestrator gap (no dispatcher, no same-tick race handler, no cross-agent channel, no resource accounting). Coverage of depends_on backfill IS prerequisite to safe parallel-ops.
type: feedback
---

# Skill flywheel + expansion flywheel + parallel-tracks substrate — Aaron 2026-05-02

## Origin

Aaron 2026-05-02, in the autonomous-loop maintainer channel mid-session, asked:

> *"yeah so while in daily work is the skill flywheel active? what process will turn you daily backlog churn into a flywheel of expansion while the backlog is shrinking so it will expand at the same time? also when you start chruning through the backlog i'm sure you can have many parallel tracks going you have a large team if you can keep them from stepping on each other in git."*

Three distinct flywheel-class questions in one message. Each gets its own answer because they operate at different layers (skill-invocation cadence; backlog dual-loop dynamics; team-parallelization substrate).

## Q1 — Skill flywheel during daily work

**Honest answer: partially active — and Aaron's same-message correction (2026-05-02) is that "partial" is the wrong frame; "should-be-much-more-active" is the right frame.**

### Aaron's corrective (verbatim, same exchange)

> *"you can close 100 rows without invoking a single specialist skill. you should not if you like editing code and there is an expert for that code? memory can only scale so far as a flywheel and it's just for your not your whole team skills are for everyone and even other ageng harnesses."*

Three load-bearing points:

1. **"you should not [close rows without invoking specialist skills when there's an expert for the surface]."** Reporting "partially active" as a state is wrong; the discipline rule is ACTIVATE more, not REPORT more accurately.
2. **Memory scales as a flywheel only for the agent producing it.** Each agent's per-session memory is private. The factory's bench has 18+ named agents/personas; my memory-and-rule flywheel doesn't transfer to Soraya's session, or Aminata's, or a Codex peer-harness session.
3. **Skills are the shareable substrate.** Skills run across the team AND across harnesses (Codex, Cursor, Gemini-CLI, future-team-members). A skill body is durable team-scale substrate; a memory file is durable per-agent substrate. Different scaling axis.

This corrective composes structurally with the decision-archaeology gap (081KQJZR90008QG0R002D6XYHB) — Aaron's framing there was *"is that a skill?"*, not *"should you write a memory about it?"*. Same load-bearing point at the substrate-class layer: when something is universally useful, the right shape is a skill, not a memory.

### What this changes operationally going forward

Before editing code / docs / config / skills in a specialist's domain, INVOKE the specialist:

| Surface I'm touching | Specialist that should review |
|---|---|
| F# / C# code (correctness, perf, public API) | `harsh-critic` (Kira) and/or `maintainability-reviewer` (Rune) |
| Public API surface on shipped libraries | `public-api-designer` (Ilyana) |
| Security-relevant change | `threat-model-critic` (Aminata) and/or `security-researcher` (Mateo) |
| Hot-path / zero-alloc / perf-sensitive code | `performance-engineer` (Naledi) |
| Formal-verification specs | `formal-verification-expert` (Soraya) |
| OpenSpec capability | `spec-zealot` (Viktor) |
| New skill / skill modification | `skill-expert` (Aarav) — and `skill-creator` for the body |
| Library-consumer-facing change (NuGet / README / API names) | `user-experience-engineer` (Iris) |
| Contributor-facing change (CONTRIBUTING / install / build loop) | `developer-experience-engineer` (Bodhi) |
| Agent-facing change (CLAUDE.md / AGENTS.md / cold-start) | `agent-experience-engineer` (Daya) |
| Per-commit alignment signal | `alignment-auditor` (Sova) |
| Adversarial payload / prompt-injection-relevant | `prompt-protector` |
| Subagent dispatch on independent work | `Task` tool with the right `subagent_type` |

The cost of generalist-Otto-everywhere isn't just bugs Otto misses; it's substrate that won't propagate to other agents/harnesses. **Specialist invocations build team-shareable evidence; memory builds per-agent evidence.** Both have value but they scale differently.

The original line below remains accurate as a description of state pre-correction, kept for the substrate's archaeology:

### Inventory of skill use this session (n = 1 session, illustrative)

- **Used:** Skill-router lookups (light), Read / Edit / Write / Bash (heavy), CronList, occasional ToolSearch
- **Not used:** `claude-md-steward`, `skill-tune-up`, `prompt-protector`, `data-lineage-expert`, `decision-archaeology` (didn't exist), formal-verification-expert, harsh-critic, code-reviewer specialists, the named-persona agents (Soraya / Aminata / Iris / Bodhi / Daya / Naledi / Hiroshi etc.), `Task` subagent dispatch
- **Weight-of-skills shaping decisions:** estimate ~30% — most behavior comes from CLAUDE.md bullets + memory pointers, not skill bodies

### What the skill flywheel WOULD do if active

Each skill invocation produces:
1. **Compounding-expertise effect** — the persona's accumulated discipline applies to the surface
2. **Notebook update** — the persona records what was found / learned / corrected
3. **Cross-skill referrals** — Soraya routes to Aminata, Iris hands to Samir, etc.
4. **Specialist bug-finding** — bugs the generalist Otto would miss

### Why it's mostly dormant

No mechanism makes skill-INVOCATION proportional to backlog-row-touched. You can close 100 rows without invoking a single specialist skill. The skill router surfaces availability; nothing surfaces obligation.

### Mechanism that would activate it

A pre-commit / pre-merge hook that consults the affected files + change class and emits a *"this change should have been reviewed by Aminata (security surface) / Naledi (perf surface) / Ilyana (public API)"* hint. Skill-invocation-suggestion at PR-author-time. Not blocking — advisory; failure-mode-prevention not gate.

This composes with the post-deploy contributor-onboarding question: a new contributor's PR should automatically get the *"this surface usually wears Bodhi's hat — invoke `developer-experience-engineer` for review"* hint. Currently ad-hoc; should be mechanical.

## Q2 — Backlog churn as flywheel of expansion while shrinking

The dual-loop dynamic Aaron named:

```
LOOP A (consume):  pick row → produce closure delta → close 1 row
LOOP B (produce):  pick row → produce observation → surface N≥0 new rows
```

**Flywheel condition: E[N] across the population > 1.** Below 1: backlog drains. Above 1: backlog grows even while closing. At ~1: steady state.

### Where E[N] > 1 currently comes from in this factory

| Mechanism | What it produces | Active? |
|---|---|---|
| **Copilot review on every PR** | bugs-per-PR findings → some become rows | Yes (~3-9 findings per PR observed this tick across 3 PRs) |
| **Aaron-Otto bidirectional exchange** | gap-naming → rows like 081KQJZR90008QG0R002D6XYHB (decision-archaeology) | Yes — highest yield mechanism |
| **Closure-pass meta-observation** | adjacent gaps surfaced when reading a row to close it | Yes but ad-hoc |
| **Skill-tune-up cadence** | skill-class gaps every 5-10 rounds | Substrate-rule, not auto-running |
| **Gap-of-gaps audit** (the meta-discipline) | meta-gap-class discoveries | Substrate-rule, not auto-running |
| **Hot-file-detector** | hot-spot-class gaps from churn signal | Substrate-rule, not auto-running |
| **External-anchor scouting** | adjacent-tech / industry / paper-class gaps | Manual, sporadic |

Three of the seven mechanisms are auto-active; four are substrate-rules. The flywheel-of-expansion is **partially mechanized**.

### The unbuilt piece

A tick-close ritual that explicitly runs E[N]-producing mechanisms: *"this tick I touched rows X, Y, Z; the meta-observations from each are A, B, C; A becomes a new row; B is already covered; C becomes a memo pointer."*

What would mechanize it fully: a `tools/backlog/expand-from-closure.ts` script that runs at PR-merge-time, scans the closure context (merged PR + commits + diff), and emits candidate-rows for review. Aaron's *largest-mechanizable-backlog-wins* thesis applies recursively — the expansion process itself should be mechanizable.

### Worked example (this session)

This tick alone: 081KQDTYV0008QG0R002H74QXZ first iteration (consume-loop closes-progress on a P0); Aaron's commentary surfaces decision-archaeology (produce-loop emits 081KQJZR90008QG0R002D6XYHB); the conversation about flywheels emits this memo (produce-loop emits a memory file). E[N] for this tick > 1 empirically.

## Q3 — Parallel tracks via the team

You have the substrate. You don't have the orchestrator yet.

### What's there (parallel-tracks substrate)

- **Worktree isolation** — `Agent` tool's `isolation: "worktree"` parameter creates separate working trees so two agents don't fight over the index. Already shipped.
- **Subagent dispatch via `Task` tool** — context-isolated; no shared state between siblings; runs in parallel. Already shipped.
- **PR-based merge gate** — every change lands via PR + auto-merge + required checks. Two parallel agents can't merge incompatible diffs without one rebasing.
- **`depends_on` graph** — what the recent 3 PRs spent backfilling. Lets you topologically order which rows can run in parallel (no shared `depends_on` ancestor in the active set).
- **Branch naming convention** — `<topic>/<descriptor>-<author>-<date>`. Distinct prefixes prevent branch-name collision.
- **Named personas** — Soraya / Aminata / Iris / Bodhi / Daya / Naledi / etc. Each owns a distinct surface; two agents on the same surface ARE the collision; two on different surfaces compose.

### What's NOT there (the orchestrator gap)

- **Backlog dispatcher** — picks N rows from the backlog respecting `depends_on`, assigns each to a worktree-isolated subagent, gates merge order on the graph
- **Same-tick race-condition handler** — when two PRs touch the same file, which one rebases on which? Currently human / Aaron resolves; should be a deterministic merge-order rule
- **Cross-agent communication channel** — when one agent's discovery affects another's work-in-flight, how does that signal propagate without polluting context? Currently absent; would need a structured-message bus (memo-files-as-channel?)
- **Resource accounting** — N parallel agents = N tokens of API budget; budget-aware dispatch is needed before going wide

### Cost of stepping-on, ranked

1. **Same-file edit** — git merge conflict; rebase pattern resolves but adds friction per collision
2. **Same MEMORY.md region** — top-of-file insertions race; resolved by deterministic-ordering insert (newest-first by timestamp, not first-to-write)
3. **Same backlog row** — handled by `id` uniqueness + closure-marker discipline
4. **Same skill or agent file** — `skill-creator` workflow serializes; can't naively parallelize
5. **Same docs/CLAUDE.md / AGENTS.md** — most-canonical surfaces; should serialize through one designated agent (architect role)

### Practical first step toward parallel ops

Pick 3-5 backlog rows whose `depends_on: []` is empty AND whose `composes_with:` doesn't share files. Dispatch each via `Task` with `isolation: "worktree"`. Each lands a separate PR. The `depends_on:` graph is the merge-order substrate.

This hasn't happened yet because depends_on coverage is 21/160 (today). With sparse coverage, the dispatcher would over-assume independence. **Coverage growth IS prerequisite to parallel-ops viability.** Each tick of depends_on backfill is also a tick of parallel-ops capacity unlock.

## What this teaches

The three flywheel-class questions are **distinct mechanisms operating at different layers** but they compose:

- **Skill flywheel** = invocation-cadence layer. Currently low.
- **Expansion flywheel** = backlog-rate layer. Currently above 1 mostly via Aaron-bidirectional; partial mechanization.
- **Parallel-tracks** = throughput layer. Substrate ready; orchestrator unbuilt.

Each has a clear mechanization path:
- Skill flywheel: pre-merge skill-suggestion hook
- Expansion flywheel: `tools/backlog/expand-from-closure.ts` PR-merge-time hook
- Parallel-tracks: worktree-dispatcher building on the depends_on graph

All three are valid backlog rows the next time `skill-tune-up` / `gap-of-gaps audit` / proper-order-pick runs.

## Composes with

- `memory/feedback_largest_mechanizable_automatable_backlog_wins_in_AI_age_inverts_classical_PM_training_prior_aaron_2026_05_02.md` — the meta-thesis the three flywheels each instantiate at different layers
- `memory/feedback_never_idle_speculative_work_over_waiting.md` — proper-order pick discipline + the 2026-05-02 2nd + 3rd refinements (backlog-as-aperiodic-tiling-strange-attractor)
- `memory/feedback_bugs_per_pr_rate_as_immune_system_health_metric_independent_framing_production_otto_aaron_2026_05_02.md` — bugs-per-PR rate IS one of the auto-active expansion-flywheel mechanisms
- `docs/dependency-status.md` (081KQDTYV0008QG0R002H74QXZ first iteration) — composing-substrate; status surface is one of the things the dispatcher needs to consult before going wide (don't dispatch parallel agents into a degraded-GitHub state)
- `docs/backlog/P1/081KQJZR90008QG0R002D6XYHB-decision-archaeology-skill-aaron-2026-05-02.md` — a worked example of the expansion-flywheel: 081KQJZR90008QG0R002D6XYHB was surfaced this session by Aaron-bidirectional-exchange while the consume-loop was running on 081KQDTYV0008QG0R002H74QXZ

## Carved sentences

**Skill flywheel:** *"Skills compound when invoked; they don't compound from sitting in `.claude/skills/`. The flywheel I'm running is more accurately a memory-and-rule flywheel than a skill flywheel."*

**Expansion flywheel:** *"Backlog grows even while closing when E[N>1] new rows surface per row touched. Three of seven mechanisms are auto-active; four are substrate-rules waiting on automation. The expansion process itself should be mechanizable per the largest-backlog-wins thesis."*

**Parallel tracks:** *"You have the substrate. You don't have the orchestrator yet. Coverage of depends_on backfill IS prerequisite to safe parallel-ops; each tick of backfill is also a tick of parallel-ops capacity unlock."*
