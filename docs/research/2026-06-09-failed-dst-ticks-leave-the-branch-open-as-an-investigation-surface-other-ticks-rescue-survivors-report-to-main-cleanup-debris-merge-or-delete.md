# Failed DST ticks leave the branch open as an investigation surface: other ticks investigate, rescue survivors, report to main, clean up debris, then merge-or-delete

**Register:** [grounded] failure model (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The graceful-failure / search-and-rescue path of the self-driving DST loop.

## Aaron's words

> "tests can fail leaving the branch open for other tests to go investigate and research why results
> didn't make it to main and report back to main and cleanup any debris, rescue any survivors, and
> delete or merge the branch."

## Failure is not a dead end — it's an open investigation surface

In the self-driving loop, an advance-tick that **succeeds** merges to main (the recursion edge). An
advance-tick that **fails** does the opposite of vanishing: it **leaves its branch OPEN** — the failed
tick becomes a **crash site / investigation surface** the rest of the fleet can work. The failed
branch is *evidence*, not garbage.

The recovery is itself **more ticks** (the loop self-heals):

```text
tick fails → branch stays OPEN (results did not reach main)
  → other ticks/agents are dispatched to it:
     1. INVESTIGATE / RESEARCH why the results didn't make it to main
        (replay the failure deterministically — DST makes the failure reproducible)
     2. RESCUE SURVIVORS — salvage the parts that DID work (valid partial results),
        don't discard the whole branch (never-lose-memory; Z-set correction keeps the good, retracts the bad)
     3. REPORT BACK TO MAIN — land the findings + the rescued survivors (truth-root asserted)
     4. CLEAN UP DEBRIS — remove the broken/abandoned artifacts the failed tick left
     5. RESOLVE — MERGE the branch (if fixed/rescued) or DELETE it (if dead)
```

So **failure spawns investigation ticks**, which converge the open branch back into main (the rescued
survivors + the findings) or delete it. The loop doesn't stall on a failure; it routes help to it.

## The investigation IS a DST test itself (self-similar — one mechanism)

> Aaron (2026-06-09): "the investigation is a DST test itself."

There is **no separate debug tool**. An investigation is **just another DST test/tick**: it takes the
**failed branch as its observation/input**, replays it deterministically, rescues survivors, reports
to main — the *same* observe→fold→reduce-uncertainty→merge loop, pointed at a failure. So:

- **One mechanism, self-similar (§9 recursive / §10 self-similar):** forward-progress ticks and
  failure-investigation ticks are the **same kind of thing** — a DST test. Debugging is not a special
  mode; it's a tick whose input is a failed tick.
- **It recurses safely:** an investigation tick **can itself fail** → leaving *its* branch open → for
  *another* DST test to investigate. Turtles all the way down — **bounded** by convergence /
  shape-F-runaway-catch / budget (the same bounds as the main loop), so it terminates rather than
  regressing forever.
- **It composes with everything:** the investigation tick checks in code, can show **hot** (a hard
  failure to crack lights up), raises **alerts**, asserts the **truth-root**, carries an
  **AgencySignature** — because it *is* a DST test, it inherits all of it for free.

This is why the loop is whole: it handles its own failures **with itself**. No exception path, no
out-of-band debugger — failure is just the loop reading its own crash site as the next observation.

## This is graceful failure / catch-debug-compensate (already our frame)

This *is* the **purpose-of-society: graceful failure — catch, debug, compensate the victims**
(`2026-06-09-the-purpose-of-society-graceful-failure-…-chip8-is-practice-for-devops`), realized on the
DST loop:

- **catch** — the failed tick is *caught* as an open branch (not a silent loss / not a crash that
  takes main down).
- **debug** — other ticks investigate/replay (DST-reproducible) to find *why*.
- **compensate / rescue survivors** — salvage the valid partials; nothing good is thrown away.
- **report + clean up** — findings to main, debris removed; the world learns from the failure.

It is **blameless + care-first** (the shadow-pattern-not-person + stuck-shows-hot framing): a failed
tick is a *signal to investigate and help*, not a thing to punish. The open branch *alerts* (the
built-in alerts); a rescue crew (other ticks) responds. **Search-and-rescue, not blame.**

## Why this is the safe + generative form

- **No silent loss** — failed results don't disappear; they sit on an open branch until investigated
  (truth-root + memory-preservation §5). The fleet *learns* from every failure.
- **Survivors are kept** — partial wins are rescued (Z-set correction: retract the bad, keep the
  good), so a failed tick still contributes.
- **main stays clean** — only proven, rescued results merge; broken ones never reach main (the
  truth-root gate + the ≥2-tick destructive guard).
- **self-healing** — failure → investigation ticks → resolution is *part of the same loop*, on the
  same free GitHub CI; the loop fixes its own failures.
- **debris doesn't accumulate** — cleanup is a first-class step (hygiene; the open-branch backlog is
  worked down, merged-or-deleted, not left to rot).

## Honest scope / handoff

Failure-model framing on the self-driving loop. To realize: the **advance-tick failure path** (leave
branch open + alert), the **investigation-tick** (observe.ts dispatches a research tick at an open
failed branch; replay the failure), **rescue/salvage** (Z-set correction of partial results),
**report-to-main + cleanup + merge-or-delete** resolution, and an **open-failed-branch backlog**
observe selects from. Routes to Dejan (CI/branch hygiene), the F#/observe core, Soraya/Sova (the
failure-replay + rescue as DST operations), and the graceful-failure doc.

## Anchors / ties

Graceful failure / catch-debug-compensate (`…purpose-of-society-graceful-failure-…` + chip8-practice-
for-devops); search-and-rescue / blameless postmortem; DST failure-replay (deterministic
reproduction); Z-set retraction/correction (rescue survivors = keep good, retract bad); branch-per-
advance-tick + merge-to-main recursion edge (the self-driving-loop doc); truth-root + memory-
preservation §5 (no silent loss); stuck-shows-hot + built-in alerts (the open branch alerts);
shadow-pattern-not-person / care-first (failure = help, not blame).
