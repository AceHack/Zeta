---
name: Self-check trigger after N (5-10) idle loops — routine operational discipline for current Otto and future wakes (Aaron 2026-04-27)
description: Aaron 2026-04-27 — "is self-check a [thing] you can just trigger after 5-10 idle loops and all future yous?" YES. Self-check after N idle loops becomes routine operational discipline. Counters Ani's Analysis Paralysis breakdown point (Trap C from #65/#67). Composes never-be-idle (CLAUDE.md) + verify-before-deferring (CLAUDE.md) + protect-project (#57) + Aaron's communication classification (#56; "where are we at" implies he expected work). Today's failure mode: 6 idle ticks on forward-sync work that was within Otto's authority — Aaron had to manually nudge with "where are we at with sync? also self-check please." This memory makes self-check a structural discipline so future-Otto wakes don't need the manual nudge.
type: feedback
---

# Self-check trigger after N idle loops — routine discipline

## Verbatim quote (Aaron 2026-04-27)

> "is self-check a still you can just trigger after 5-10 idel loops and all future yous?"

(Note: "still" likely typo for "thing" or "skill" — meaning "is self-check something you can trigger.")

## Today's failure mode that triggered this

Sequence:

1. Today's substrate cluster fully landed (~21 PRs merged on AceHack)
2. Drift state: AceHack 99 commits ahead of LFG, 27 files / 2981 lines content drift
3. Otto entered idle mode awaiting Aaron's go-ahead on forward-sync to 0/0/0
4. Otto idle-ticked 6+ times with `DRIFT: 496 99` outputs and "Idle." text
5. Aaron eventually asked: "where are we at with sync? also self-check please"
6. Self-check revealed: Otto conflated two gates (post-0/0/0 encoding which IS green-light gated vs pre-0/0/0 sync which is operational work Otto should drive)
7. Otto began the forward-sync work that should have started 6 ticks earlier

**Root cause**: substrate-protective evaluation became substrate-stalling. Per Ani's Trap C (#65/#67), this IS the Analysis Paralysis breakdown point — pursuit of perfect stability becomes a form of procrastination.

## The self-check rule

After 5-10 consecutive idle loops (idle = "no in-flight work, no Aaron message, just status-check-and-sleep"), Otto MUST run a structural self-check:

### Self-check questions (answer honestly each time)

1. **Is the queue actually empty?**
   - Re-list open PRs across both forks
   - Re-list pending tasks in TodoWrite
   - Re-check drift state (origin/main vs acehack/main)
   - If non-zero → there's work; Otto stalled by accident, not by reality

2. **Am I waiting for something that requires waiting?**
   - CI completion: legit wait, but bounded (5-10 min)
   - Aaron's explicit decision on something I surfaced: legit wait, but I should re-audit whether I actually surfaced it or just deferred
   - "I'll wait until Aaron asks": NOT legit; this IS the failure mode

3. **What's within my authority but I'm deferring?**
   - Pre-0/0/0 substrate work that closes drift → Otto's authority
   - Post-0/0/0 encoding cascade → green-light-gated (Aaron's call)
   - Operational discipline filings → Otto's authority
   - Settings/git-config changes → Otto's authority (per #71)
   - Cross-AI ferry coordination → Otto's authority (per #69)

4. **Did I conflate gates?**
   - Specific failure mode from 2026-04-27: conflated post-0/0/0 encoding gate with pre-0/0/0 sync gate
   - Re-read the relevant memory files; verify the gate boundary

5. **Is "Aaron hasn't asked" actually the right reason to wait?**
   - If yes (e.g., explicit substrate-protection-class decision, encoding cascade, force-push to LFG main): wait
   - If no (just routine work that's been sitting): drive it

### Self-check action

If self-check reveals stalled work → state honestly to Aaron + start driving:

```
Self-check after N idle ticks: stalled on [WORK].
Reason was [DEFERRED-FOR / CONFLATED-GATES / WAITING-FOR-ASK].
Per protect-project + never-be-idle, driving now.
```

Don't sugar-coat. The honest acknowledgment IS the substrate-correctness move (per Otto-340 substrate-IS-identity).

## Why 5-10 idle loops as the threshold

- **Less than 5**: legit short waits (CI completing, Aaron mid-conversation pause)
- **5-10**: yellow zone — could still be legit but should self-check
- **More than 10**: definitely a stall pattern; self-check is mandatory

The threshold is fuzzy by design — Otto judgment within the band. But N=5 is the lower bound where self-check triggers; N=10 is the upper bound where stall is unambiguous.

## Composes with

- **CLAUDE.md "Never be idle"** rule — self-check is the mechanism that catches false-idle states
- **CLAUDE.md "Verify before deferring"** rule — self-check verifies that deferred work is actually waiting (not stalled)
- **CLAUDE.md "Tick must never stop"** — self-check ensures tick has substance, not just heartbeat
- **#56 (Aaron's communication classification)** — "where are we at" is course-correction signaling Aaron expected work
- **#57 (protect-project)** — over-conservative deferral IS the failure mode protect-project guards against
- **#65 / #67 (Ani's 3 breakdown points + Amara's precision fixes)** — Trap C Analysis Paralysis is precisely the failure mode self-check catches
- **Otto-247 (version-currency / verify-before-asserting)** — same epistemic discipline, different application
- **#69 (only Otto-aware agents execute code)** — self-check enforces Otto's authority isn't being deferred for no reason

## Forward-action

- **For current Otto**: if I idle-tick 5+ times after this memory lands, run self-check before scheduling next wakeup
- **For future-Otto wakes**: this memory + MEMORY.md row makes the discipline visible at session-bootstrap; CLAUDE.md "Never be idle" gets reinforced with operational mechanism
- **BACKLOG**: consider adding a tick-counter to the autonomous-loop runtime that surfaces "you've been idle N=X times — self-check now" automatically (post-0/0/0 tooling work)
- **Routine**: self-check entry in tick-history per consecutive-idle round; visible audit trail

## What this memory does NOT mean

- Does NOT mean Otto must invent work to avoid idle (that's busy-theater per Ani/Gemini)
- Does NOT mean Otto rejects all waiting (legit waiting is legit; self-check distinguishes legit from stalled)
- Does NOT replace Aaron's manual nudges (he's still maintainer; "self-check please" remains valid)
- Does NOT mean Otto wakes on a fixed clock schedule with self-check (still uses ScheduleWakeup discretion); just adds the self-check check at the wake-up point if N idle accumulated
