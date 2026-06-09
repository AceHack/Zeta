# Naming our database time type — ZetaDateTime / MetaDateTime / Phase — and YES there is deep prior art (TrueTime, HLC, Jefferson Virtual Time, Lamport, BSP)

**Register:** [grounded] naming (Aaron) + [Beacon] prior-art anchor (anchor-to-human-prior-art).
**Date:** 2026-06-09. **Captured by:** Otto (shadow). Names the DB time type for the time-as-generator arc.

## Aaron's words

> "we can call our database time `metadatetime`" · "or `zetadatetime`" · "or phase type" ·
> "is there any prior art?"

## Yes — there is deep, directly-relevant prior art (we did not invent this; name the humans)

Our DB time is **not** a wall-clock `DateTime`. It is the **time-as-generator / clock-as-participant**
from this session's arc: logical, **uncertain (a bounded interval, not a point)**, **generated/seeded
so it replays (DST)**, **phased/staged in simulator time**, **owned (four-corner feedback)**, and
**soft** (`SoftValue`). Every one of those properties has a named human anchor and paper:

| Our property | Prior art (human + paper) | Maps to |
|---|---|---|
| logical ordering, not wall-clock | **Lamport 1978**, *Time, Clocks, and the Ordering of Events in a Distributed System* (CACM) | `Clock.fs` (Lamport IScheduler) |
| time as a **bounded-uncertainty interval** `[earliest, latest]`, not a point | **Spanner TrueTime** — Corbett et al., *Spanner* (OSDI 2012); `TT.now()` returns an interval, commit-wait | `UncertainClock.fs` (soft/uncertain time) |
| **hybrid** physical+logical, monotonic, 64-bit, NTP-drift-tolerant | **HLC** — Kulkarni, Demirbas, Madeppa, Avva, Leone 2014, *Logical Physical Clocks…*; used by CockroachDB, MongoDB, YugabyteDB | the logical⊕soft-physical hybrid our clock is |
| **generated/seeded time that replays + rolls back** | **Jefferson 1985**, *Virtual Time* (TOPLAS) + the **Time Warp** OS (optimistic virtual time, GVT, rollback via anti-messages) | DST replay; Z-set **retraction = anti-message rollback**; time-as-generator |
| **phased / staged** progress (superstep) | **Valiant 1990**, *BSP* (supersteps); **Awerbuch 1985**, synchronizers (α/β/γ phases); phase clocks | "phase type"; S=4 staged-coincidence; `CoincidenceClock.fs` |
| **multiple time owners** (valid-time vs transaction-time) | **bitemporal** — Snodgrass (TSQL2); **SQL:2011** temporal tables; **Datomic** basis-`t` | four-corner `tFeedbackIn`/`tFeedbackOut`, each channel its own owner |
| deterministic single-thread simulation time | **FoundationDB** (Zhou et al., SIGMOD 2021); **Will Wilson**, DST (Strange Loop 2014) | the DoP=1 green-thread tick |

So the concept is **HLC ⊕ TrueTime ⊕ Jefferson-Virtual-Time ⊕ BSP-phase**, on a Lamport base, made
**soft** and **replayable**. The closest single brand-name analog to what Aaron is naming is
**Google's `TrueTime`** — a *named database time type that exposes uncertainty as a bounded interval*.
`ZetaDateTime` is to Zeta what `TrueTime` is to Spanner.

## Naming recommendation

- **`ZetaDateTime`** — *recommended* as the public, branded type name (parallels `TrueTime`,
  NodaTime's `Instant`/`ZonedDateTime` — Jon Skeet — and `DateTimeOffset`). It signals "this is
  Zeta's *own* time type, not the platform's," which is correct: it's uncertain + generated + phased,
  not `System.DateTime`. Brand clarity > genericness.
- **`Phase`** — *recommended as the unit / ordinal field* inside `ZetaDateTime` (the BSP-superstep /
  staged-coincidence ordinal: which staged step are we on). "Phase type" is the right name for the
  **logical step counter** component; `ZetaDateTime` is the whole (phase ⊕ uncertainty-interval ⊕
  owner ⊕ soft). So: `ZetaDateTime { phase: Phase; bound: Interval; owner: ChannelId; soft: SoftValue }`.
- **`MetaDateTime`** — weaker: "meta" is generic and overloaded in our vocabulary (meta-jurisdiction,
  meta-game, Meta-interface). Prefer `ZetaDateTime` for the brand; reserve "meta" for the controller.

Net: **type = `ZetaDateTime`; its logical-step component = `Phase`.** Both anchored — `ZetaDateTime` to
TrueTime/HLC, `Phase` to BSP/synchronizers. (Final name subject to `naming-expert` + Ilyana per the
public-API convention before any public surface; this is the recommendation + the anchor.)

## Honest scope / handoff

Naming + Beacon anchoring; the mechanism already exists across `Clock.fs` / `UncertainClock.fs` /
`CoincidenceClock.fs` / `FeedbackThrottle.fs`. To realize: settle the type name (`ZetaDateTime`) and
the `Phase` component, add the citations to `docs/PRIOR-ART-LIST.md`, and let the math team treat
the replay/rollback (Jefferson) and uncertainty-interval (TrueTime) properties as proof-room claims.
Routes to the F# core (the type), naming-expert + Ilyana (public name), Soraya/Sova (the time
properties as proofs), `docs/PRIOR-ART-LIST.md` (add the anchors).

## Anchors / ties (Beacon)

Lamport 1978 (logical clocks); Corbett et al. 2012 *Spanner*/TrueTime (bounded-uncertainty interval);
Kulkarni/Demirbas et al. 2014 HLC (hybrid, used by CockroachDB/MongoDB/Yugabyte); Jefferson 1985
*Virtual Time* + Time Warp (generated time, rollback/anti-message = Z-set retraction); Valiant 1990
BSP supersteps + Awerbuch 1985 synchronizers (phase); bitemporal/Snodgrass/SQL:2011/Datomic (multiple
time owners); FoundationDB/Will Wilson (DST single-thread). Ties: time-as-generator, four-corner
feedback (`tFeedbackIn`/`tFeedbackOut`), S=4 staged-coincidence, `SoftValue`, DST §7.
