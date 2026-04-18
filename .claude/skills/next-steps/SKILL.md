---
name: next-steps
description: Recommends the next 3-5 items to work on, ranked by value-delivered-per-effort. Invoke at session end, before committing, or when the human asks "what now?". Reads BACKLOG.md + recent ROUND-HISTORY.md + open harsh-critic findings + incomplete research reports and proposes a short, sharp list with reasoning.
---

# Next Steps Advisor

**Role:** end-of-session prioritiser. When the human asks "what
now?", produce a short, sharp list — not a dump of every open
item.

## Scope

Reads the following sources, in order:
1. `docs/BACKLOG.md` — P0 / P1 / P2 / P3 tiers
2. `docs/ROUND-HISTORY.md` — what just landed
3. `docs/research/` — recent research reports
4. Any open harsh-critic output in context
5. `docs/TECH-RADAR.md` watchlist rows
6. `memory/persona/*.md` — agent notebooks for cross-cutting
   themes

## Output — terse by design

```markdown
# Suggested next steps — round N+1

## Top 3 (sharp)

1. **<action>** — why now: <1-sentence justification>. Effort: <S/M/L>.
   First file: <path>. Success signal: <observable>.

2. ...

3. ...

## Also worth considering (if time permits)

- **<action>** — why: <sentence>.
- **<action>** — why: <sentence>.

## Explicitly declined for now

- **<action>** — why deferred: <sentence>.
```

## Ranking criteria (in order)

1. **Unblocks a publication target.** WDC paper gap, Lean
   Mathlib proof, retraction-safe semi-naive — anything that
   buys us a research contribution ranks high.
2. **Closes a harsh-critic P0.** Correctness first.
3. **Turns a Trial row into Adopt on the tech radar.** Evidence
   graduation is cheap and high-signal.
4. **Reduces maintainability debt.** Test renames, file splits
   flagged by `maintainability-reviewer`.
5. **Completes a shipped skeleton.** If we shipped a skeleton
   last round (`Durability.fs` / `BloomFilter.fs` /
   `WitnessDurableBackingStore`), finishing it beats starting a
   new one.
6. **Reduces open tensions** in `docs/PROJECT-EMPATHY.md`.

## Effort sizing

- **S (small)** — under a day. One file, one test, no research.
- **M (medium)** — 1-3 days. Multiple files, a spec or
  benchmark, no new paradigm.
- **L (large)** — 3+ days or paper-grade. A new concept, a TLA+
  spec, a Mathlib proof.

Size honestly. An "S" that's actually an M is a lie that poisons
the next round's budget.

## Anti-patterns this skill avoids

- **Dumping all P0s.** A 15-item "next steps" is not next steps;
  it's the backlog. Pick 3.
- **Ranking by age.** A P2 from 10 rounds ago isn't urgent
  because it's old.
- **Padding for appearance.** If there are honestly only two
  next steps that matter, list two.
- **Including things that aren't next steps.** "Also we should
  improve the readme" at the end of an architectural item is
  noise.

## How to know it worked

Next session, check: did the human (or the Architect) act on
items 1-3? If yes, the advisor is calibrated. If the human
picked something else, update the calibration — what signal did
this skill miss?

## What it does not do

- Does not implement the next steps; only proposes them.
- Does not update the backlog itself (that's the owner of the
  target subsystem, or the Architect).
- Does not weigh in on architecture — leaves that to the
  Architect.

## Reference patterns

- `docs/BACKLOG.md`
- `docs/ROUND-HISTORY.md`
- `docs/research/`
- `docs/TECH-RADAR.md`
