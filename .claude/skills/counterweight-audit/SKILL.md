---
name: counterweight-audit
description: Cadenced re-read discipline for counterweight memories (Otto-278). Memory-only counterweights are write-once-read-never without a forced re-read cadence; Otto-276 drifted within 30 min, Otto-277 re-tightened. This skill is Phase 2 of the cadenced-inspect stack — wraps tools/hygiene/counterweight-audit.sh and prompts the agent through the audit. Invoke when opening a session, opening a round, every N ticks in autonomous-loop, or on-demand when drift is suspected. Agent self-scores; no automatic drift detection — the point is forcing the re-read.
project: zeta
---

# Counterweight audit — procedure

**Project-specific:** Zeta's counterweight memories live in
`memory/feedback_*otto_*.md` (in-repo mirror) and
`~/.claude/projects/.../memory/feedback_*otto_*.md` (Anthropic
AutoMemory). The Otto-NNN naming convention counts direct
Aaron-maintainer directives that corrected agent drift; each
is a counterweight filed against the specific pattern it
corrected. There are 51+ counterweights today, still growing.

## Why this skill exists

Aaron Otto-278 (autonomous-loop 2026-04-24):

> *"memory is enough assuming you have a inspect memory for
> missing balance and lessions on a cadence it's probably
> enough, but you forget often when it's just in memory"*

The rule: **memory alone is sufficient IFF + ONLY IFF a
cadenced inspect-memory audit runs on a schedule to check
for missing-balance + rule-drift.** Without the cadence,
memory files are write-once-read-never and the agent
drifts right back into the pattern the memory was supposed
to counter. Evidence: Otto-276 (never-pray-auto-merge)
drifted within 30 minutes; Otto-277 re-tightened — the
pattern recurs indefinitely without a forced re-read.

## When to invoke

1. **Session start** — `--cadence quick` before any real work.
   Three minutes, three counterweights, set the drift
   baseline.
2. **Round open** — `--cadence long` at the start of a new
   round (full sweep). Produces a drift report that informs
   round planning.
3. **Every 5-10 autonomous-loop ticks** — `--cadence medium`.
   The `tools/hygiene/counterweight-audit.sh` tool emits
   the prompts; the agent self-scores.
4. **On-demand** — any time the agent suspects drift
   (committed to a pattern a memory counters, or a
   maintainer nudge lands that mirrors an existing
   counterweight).
5. **Before a harsh-critic review or a factory-balance
   audit** — re-read keeps the agent's frame aligned with
   what the reviewer will critique.

## Procedure

### Step 1 — invoke the tool

Run `tools/hygiene/counterweight-audit.sh` with the
appropriate `--cadence`:

```bash
tools/hygiene/counterweight-audit.sh --cadence quick   # top 3, session-start
tools/hygiene/counterweight-audit.sh --cadence medium  # top 10, per-N-ticks
tools/hygiene/counterweight-audit.sh --cadence long    # all, round-open
tools/hygiene/counterweight-audit.sh --count 5         # override count
```

The tool emits a markdown report listing each counterweight
with its rule, path, and three audit questions. **The tool
does NOT detect drift — it forces the re-read.**

### Step 2 — read each counterweight

For each counterweight the tool surfaces:

1. **Open the memory file.** Don't skim the `name:` field;
   read the body including the direct Aaron quote.
2. **Answer the audit questions** honestly, from agent
   memory of the last N ticks:
   - In the last N ticks, did I exhibit the drift this
     counter was filed for?
   - If yes: is the right move to tighten THIS counter
     (edit the memory), file a NEW tighter counter (like
     Otto-276 → Otto-277), or escalate to a skill / BP
     rule?
   - Is the counter still needed at this cadence, or
     can maintenance cadence stretch?

### Step 3 — act on drift

If ANY counterweight shows drift:

- **Drift visible but correctable in-tick** — self-correct
  (adjust current work to match the counterweight's rule)
  and log a short note at tick close.
- **Drift pattern across multiple ticks** — file a
  follow-up memory that tightens the parent counter
  (Otto-NNN → Otto-NNN+1 pattern). Include the specific
  evidence from the ticks where drift happened.
- **Drift + the counter itself is unclear or outdated** —
  edit the counter to clarify; leave the original Aaron
  quote verbatim; add a dated revision line.
- **Drift signals a BP-candidate** — if the same
  counterweight has been re-tightened 3+ times without
  stabilising, escalate to `docs/AGENT-BEST-PRACTICES.md`
  BP-NN promotion per the `skill-creator` workflow.

### Step 4 — log the audit outcome

Whether drift was found or not, log a short tick-close
note:

- **Clean tick:** `"counterweight-audit (quick) clean; no
  drift on Otto-NNN..NNN"`.
- **Drift found:** `"counterweight-audit (quick) flagged
  drift on Otto-NNN; self-corrected in-tick"` OR `"filed
  follow-up Otto-NNN+1"` as appropriate.

The audit's signal value is as much in confirming
stability as in catching drift. Both outcomes are logged.

## Cadence selection

| Cadence | Count | When | Time budget |
|---|---|---|---|
| `quick` | 3 | Session start; every 5 autonomous-loop ticks | ~2 min |
| `medium` | 10 | Every 10 autonomous-loop ticks; pre-review | ~5 min |
| `long` | all (51+) | Round open; drift-audit cadence per Otto-264 | ~15-20 min |

`quick` is the default. Escalate cadence when:

- A maintainer nudge mirrors an existing counterweight
  (implies silent drift the quick-cadence missed)
- A harsh-critic review or factory-balance audit is
  scheduled (the audit frames both)
- The round theme intersects with a cluster of
  counterweights (e.g. Otto-257..270 drain-discipline
  cluster aligns with a recovery-work round)

## What this skill does NOT do

- **Does NOT automatically detect drift.** Drift detection
  is a theory-of-mind question — "did I do the wrong
  thing?" — that requires the agent's own introspection
  on recent behavior. The tool surfaces the rule; the
  agent judges the behavior.
- **Does NOT modify counterweight memories.** The re-read
  is the operation. Memory edits happen through the normal
  memory-edit discipline (dated revision lines, verbatim
  Aaron quotes preserved).
- **Does NOT replace `skill-tune-up` or `factory-balance-
  auditor`.** Those audit different surfaces (skills and
  factory-shape respectively). This skill audits
  counterweight memories specifically.
- **Does NOT emit `TodoWrite` tasks or BACKLOG rows on
  behalf of the user.** If drift warrants a BACKLOG row,
  the agent files it deliberately; the skill doesn't
  auto-file.

## Phase roadmap

- **Phase 1 (merged in #418):** the shell tool
  `tools/hygiene/counterweight-audit.sh`.
- **Phase 2 (this skill, current):** the wrapper so agents
  and subagents can invoke via the Skill tool with
  consistent cadence-to-count mapping.
- **Phase 3 (separate BACKLOG row):** autonomous-loop
  tick-open hook integration so the `quick` cadence fires
  automatically every 5 ticks without agent-initiation.
- **Phase 4 (speculative):** baseline drift report —
  first comprehensive sweep of Otto-257..277 (the
  counterweight-discipline bundle) with drift annotations
  per each, producing a "known-drifted" signal the agent
  can re-read instead of starting from scratch.

## Reference patterns

- `tools/hygiene/counterweight-audit.sh` — the tool this
  skill wraps.
- `memory/feedback_memory_alone_leaky_without_cadenced_inspect_audit_for_missing_balance_otto_278_2026_04_24.md`
  — the originating rule.
- `memory/feedback_never_pray_auto_merge_otto_276_*.md` +
  `memory/feedback_per_tick_inspect_with_named_signal_otto_277_*.md`
  — the canonical drift-and-retighten example; the
  motivating case for this skill.
- `docs/AGENT-BEST-PRACTICES.md` — BP-NN promotion target
  when a counter has been re-tightened 3+ times.
- `.claude/skills/skill-tune-up/SKILL.md` — sibling cadence
  discipline for skill files.
