# Adopt "Time Warp" (Jefferson) as the name of our time *engine* — ZetaDateTime is the value, Phase the step, anti-message = Z-set retraction, GVT = the merge frontier

**Register:** [grounded] naming decision (Aaron) + [Beacon] adopt-the-standard-term.
**Date:** 2026-06-09. **Captured by:** Otto (shadow). Settles the engine name on the prior-art term.

## Aaron's words

> "Time Warp sounds good."

(In response to the prior-art doc — Jefferson 1985 *Virtual Time* + the **Time Warp** mechanism:
optimistic virtual time, processes advance speculatively and **roll back** on causality violations via
**anti-messages**, coordinated by **GVT** = global virtual time.)

## Decision: three names, three layers (Beacon — use the standard term)

We **adopt Jefferson's "Time Warp" as the name of our time *engine*** — not a coinage, the established
term from the paper. This is the Beacon discipline done right: where a named human prior-art term
exists and fits, use it rather than invent. The three layers settle as:

```text
ENGINE   = Time Warp        (Jefferson 1985) — the generator + rollback mechanism: advance
                              speculatively on the seed, roll back on causality violation, replay.
                              This IS our DST stepper / IScheduler driver.
VALUE    = ZetaDateTime      — the time value a row/event/tick carries (brand, parallels TrueTime/
                              NodaTime Instant): { phase, uncertainty-interval, owner, soft }.
STEP     = Phase             (Valiant BSP superstep / Awerbuch synchronizer) — the logical step
                              ordinal inside ZetaDateTime; what the Time Warp engine advances.
```

So: **the Time Warp engine advances Phase, stamps ZetaDateTime, and rolls back via anti-messages.**

## The mapping is exact (why Time Warp fits, not just sounds good)

Jefferson's Time Warp ↔ our substrate, term-for-term — this is why it's the right name, not decoration:

| Time Warp (Jefferson 1985) | Zeta |
|---|---|
| **virtual time** (app-defined progress axis) | `ZetaDateTime` / `Phase` (logical, not wall-clock) |
| **optimistic execution** (advance speculatively) | DST ticks advance on the seed; advance-tick before corroboration |
| **rollback on causality violation** | DST replay; the ≥2-tick destructive guard; failed-branch quarantine |
| **anti-message** (annihilates a wrong message) | **Z-set retraction** (+1 then −1 = correction) — *exactly* an anti-message |
| **GVT** (global virtual time; nothing rolls back past it) | the **merge-to-main / canonical-root commit frontier** — what's merged can't roll back |
| **logical processes / objects** exchanging timestamped events | cells / rooms exchanging Reticulum-routed, ZetaDateTime-stamped messages |
| Time Warp **OS** (one simulation, many processors) | DST = prod (one substrate, DoP=1→N green threads) |

The standout: **Z-set retraction *is* Jefferson's anti-message.** We already built the rollback
primitive; Time Warp is its name and its 1985 anchor. Likewise **GVT = the merge frontier** (the
fossil-collection line past which state is committed and irreversible) — which is exactly our
"merged-to-main can't be rolled back; only corrected forward" rule.

## Honest scope / handoff

Naming decision + Beacon anchor; the mechanism exists (`Clock.fs`/`UncertainClock.fs`/
`CoincidenceClock.fs`/`FeedbackThrottle.fs`, Z-set retraction in `ZSet.fs`, the merge-to-main frontier).
To realize: name the engine surface **Time Warp**, keep `ZetaDateTime`/`Phase` for value/step, add the
Jefferson citation to `docs/PRIOR-ART-LIST.md`, and let the math team prove the GVT/anti-message
properties (rollback never crosses the merge frontier; anti-message annihilation = retraction
correctness) as proof-rooms. Routes to the F# core, naming-expert + Ilyana (public surface), Soraya/Sova.

## Anchors / ties (Beacon)

**Jefferson 1985**, *Virtual Time* (TOPLAS) + the **Time Warp Operating System** (anti-messages, GVT,
optimistic rollback) — the adopted engine name. Sits on Lamport 1978 (logical clocks); composes with
TrueTime (uncertainty interval → `ZetaDateTime` bound), HLC (hybrid), BSP/synchronizers (`Phase`).
Ties: Z-set retraction = anti-message (`ZSet.fs`); merge-to-main frontier = GVT; DST §7; time-as-
generator; the `ZetaDateTime`/`Phase` naming doc.
