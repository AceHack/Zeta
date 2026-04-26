---
name: COUNTERWEIGHT — rapid-fire backlog input triggers CAPTURE-MODE context-switch that drifts away from current primary-drain work; when Aaron (or anyone) hands me several backlog items in succession, reflex is to immediately implement each (memory + BACKLOG row + primary doc + PR), losing focus on the drain that was in flight; RULE: BACKLOG items go in the BACKLOG — that's literally the point; log durable, THEN continue primary drain; don't immediately pivot to implementation of each new item; this session I dropped #147 drain focus mid-session to capture Otto-270/272/273/274 as 4 separate memory files + drafts + PRs, creating a "storm of PRs" (Aaron's words); Aaron Otto-275 2026-04-24 "why did you forget you were in the middle of this making good progress, is it becasue i gave you too many backlog items it made you forget?"
description: Aaron Otto-275 real-learning-lesson counterweight. Rapid-fire directives → context-switch → drain-focus drift. The fix: log but don't immediately implement. Scope-drift is the class. Save durable; save SHORT.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## Pattern is RECURRING, not session-local

Aaron 2026-04-24 precision:

> *"That's a real counterweight-worthy class. let's
> not forget it, this has happened several times."*

**This drift has happened MULTIPLE TIMES across
sessions** — not a one-off. Otto-275 is load-bearing
across the whole factory, not just today's storm.
Each recurrence is evidence the counterweight must
be maintained actively, not filed-and-forgotten
(Otto-264 maintenance cadence applies).

## Sibling balance disciplines (Aaron explicit cross-reference)

Aaron also reminded: *"don't forget about the lost
branch and lost worktree stuff you did for balance
too."*

Otto-275 composes with the earlier session's
recovery-balance work — they are siblings in the
same balance discipline, not separate tracks:

- **Otto-257 clean-default smell detection** —
  finds debris (closed-not-merged PRs, orphan
  branches, stale worktrees, abandoned commits).
  This tick's 19-LOST audit surfaced via Otto-257.
- **Otto-259 verify-before-destructive** — prevents
  bad bulk actions on the debris found by
  Otto-257. Near-miss on worktree prune was
  caught by Otto-259's sample-verification gate.
- **Otto-262 trunk-based-dev** — informs the
  recovery decision (recover-or-prune; don't
  preserve stale branches; TBD default).
- **Otto-275 (this memory)** — keeps focus during
  the recovery work itself (rapid-fire context
  keeps triggering drift from drain to
  capture-mode).

Together they form the **balance stack for
recovery/unfinished-work**:

1. Smell detects (Otto-257)
2. Verify gates destructive action (Otto-259)
3. Trunk-based decides recover-vs-prune (Otto-262)
4. Rapid-fire-discipline keeps focus (Otto-275)

## The rule

**When handed several backlog items in rapid
succession, LOG each one durably (memory file +
BACKLOG row) but DO NOT pivot to immediate
implementation of each.**

**BACKLOG items are BACKLOG — deferred work. Primary
drain continues.**

Direct Aaron quote 2026-04-24:

> *"you got to fix them, this is a real learning
> lesson, why did you forget you were in the middle
> of this making good progress, is it becasue i gave
> you too many backlog items it made you forget?"*

## The class of mistake

- **Primary work in flight**: drain open PRs; #147
  merged; #382/#383 merged; drain subagents working.
- **Rapid-fire directives arrive**: Aaron shares
  multiple backlog-flagged ideas (Otto-270
  event-stream, Otto-272 DST-everywhere, Otto-273
  seed-lock, Otto-274 adoption-staircase).
- **Wrong response** (what I did): each item →
  memory file + refine → Edit adjacent memories →
  open sync PR + BACKLOG row PR + primary-doc PR.
  "Storm of PRs."
- **Right response**: each item → one memory file
  saved durably + one BACKLOG row drafted (can land
  in a batch later) → back to primary drain.

## The discipline

1. **Log durably** — memory file + BACKLOG row draft.
2. **Don't drift** — primary drain continues as the
   active work.
3. **Batch later** — BACKLOG rows land in a single
   periodic commit, not one PR per item.
4. **Ignore the rapid-fire temptation** — the urge
   to "capture each one fully" (implementation +
   primary doc + PR) is the drift. Capture means
   memory file, not PR.

## Composition with prior memory

- **Otto-264** rule of balance — Otto-275 is a
  counterweight filed for this class of drift.
- **Otto-171** queue-saturation — Otto-275
  operationalizes: saturation comes from agent-side
  too (me creating PRs), not just human-side.
- **Otto-225** serial-PR-flow — Otto-275 says: don't
  break this under rapid-fire input.
- **Otto-262** trunk-based-dev — short-lived branches
  is right; but shortness comes from LANDING them,
  not from STARTING MANY of them.
- **Otto-264 no-shortcut** — counterweight-filing
  should be RIGHT not quick; over-filing (a PR per
  backlog item) is a kind of shortcut that produces
  a storm.

## What Otto-275 does NOT say

- Does NOT forbid filing memory for new backlog
  items. Memory-save is cheap + appropriate.
- Does NOT say ignore Aaron's directives. Log + plan
  = respecting the directive; deferring
  implementation = respecting drain primacy.
- Does NOT make all directives defer. Some are
  "fix this now" (Aaron explicit) vs "backlog this"
  (Aaron explicit). Otto-275 is about the latter
  class.

## Direct Aaron quote to preserve

> *"you got to fix them, this is a real learning
> lesson, why did you forget you were in the middle
> of this making good progress, is it becasue i gave
> you too many backlog items it made you forget?"*

Future Otto: when receiving rapid-fire backlog
items, save each as memory durably + draft BACKLOG
row. Do NOT open a PR per item. Do NOT draft a
primary doc per item. Return to primary drain work
immediately. BACKLOG rows land in a single
periodic batch PR per Otto-262 + Otto-225.
