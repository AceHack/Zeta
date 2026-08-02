# Caveat (b) — `min(RTT)/2` is unsound for asymmetric planetary orbits

**Status:** MEASUREMENT-MODEL FIX → Lumen / BusRegime owner.
**Date:** 2026-08-02 · **From:** Otto (shadow), routing confirmed by Soraya · **Advisory.**
**Criticality:** P2 — not a blocker on any current gate, but must be resolved before
`BusRegime.OutOfCone` verdicts are used as evidence in a multi-planet deployment.
**Parent:** the G1–G4 audit (`docs/research/2026-08-02-chsh-interference-monitor-audit-*.md`);
Otto's symmetric-path flag (confirmed by Soraya this session).

---

## The problem

`BusRegime.bestOneWayMs` (`src/Bayesian/BusRegime.fs:42`) and its TypeScript twin
`bestOneWayMs` (`src/Core.TypeScript/discovery/bus-meter.ts:62`) both compute the
fastest observed one-way crossing as:

```fsharp
// BusRegime.fs:42
/// Fastest observed one-way crossing (ms) — min(RTT)/2 under the stated symmetric-path
/// assumption.
let bestOneWayMs (meter: Meter) : int option =
    match meter.RttSamplesMs with
    | [] -> None
    | xs -> Some(List.min xs / 2)
```

The halving `RTT / 2` is correct **only when the outbound and return paths are symmetric**
— i.e., when the one-way latency A→B equals B→A. This holds on terrestrial TCP links
to a good approximation (routing is nearly symmetric, speed-of-light dominates on
continental distances). It **fails on asymmetric planetary orbits**.

Earth–Mars light-travel time varies from roughly 3 minutes (conjunction) to 22 minutes
(opposition) depending on orbital phase, and the two directions are **not equal at any
given instant** because the planets are moving. At the moment of a probe round-trip:

- The probe travels Earth→Mars while Mars is at position P₁.
- The ack travels Mars→Earth while Mars has moved to position P₂.

The outbound one-way latency is `d(Earth, Mars@P₁) / c`, and the return latency is
`d(Mars@P₂, Earth) / c`. These are **different distances** — the difference is the
distance Mars travels during the round-trip, which at orbital velocity ~24 km/s over a
~6-minute round-trip is on the order of 8,640 km, corresponding to ~29 ms of additional
light-travel asymmetry. At opposition (22-minute round-trip) the asymmetry grows to
~190 ms.

Dividing the measured RTT by 2 therefore **misattributes the asymmetry to both
directions equally**, producing a one-way estimate that is wrong in both directions:
it underestimates the slower direction and overestimates the faster direction.

---

## The unsound direction: false `OutOfCone` → false leak conviction

The `BusRegime` verdict is used in `AntiSybil` to determine whether a super-quantum
correlation is **evidential** (one process wearing two faces) or merely **fakeable**
(coordination honestly bought with a fast bus). The logic is:

```fsharp
// BusRegime.fs:82-84
Evidential = above && regime = OutOfCone
FakeableInCone = above && regime = InCone
```

The unsound direction is `OutOfCone` when the path is actually `InCone`. If
`min(RTT)/2` **overestimates** the true fastest one-way crossing (because the
asymmetric return path was faster than the outbound), then `bestOneWayMs` returns a
value larger than the actual fastest signal, and `regimeOf` declares `OutOfCone` when
a real signal path existed that beat the deadline. This produces a **false
`Evidential = true`** — a false leak conviction against an honest pair that simply
communicated over a fast asymmetric channel.

The symmetric case (underestimating the fastest one-way) is the conservative direction:
it declares `InCone` when the path might actually be `OutOfCone`, which suppresses
evidence rather than manufacturing it. That is the safe failure. The asymmetric case
can go the other way.

Concretely: if the Mars→Earth return path is significantly faster than Earth→Mars
(e.g., during a favourable orbital configuration), the measured RTT is dominated by the
slow outbound leg, and `RTT/2` overestimates the fast return leg. The meter therefore
**misses the fast path** and may declare `OutOfCone` when the fast return path alone
would have been sufficient to beat the deadline τ.

---

## Scope and ownership

This is a **measurement-model fix**, not a statistics fix. It is in the same audit as
caveat (a) (autocorrelation) but is a separate concern:

| Caveat | What is wrong | Who owns the fix |
|---|---|---|
| (a) | `chshMargin` Hoeffding bound assumes i.i.d. rounds; real streams autocorrelate → margin too small | Math team (Soraya named Hiroshi) |
| (b) | `min(RTT)/2` assumes symmetric paths; planetary orbits are asymmetric → one-way estimate wrong | **Lumen / BusRegime owner** |

The fix is a physics / measurement-model judgment call, not a proof obligation. Soraya
confirmed this routing: "the symmetric-path assumption I flagged in the audit — she
confirmed it and named the unsound direction."

---

## The fix space (Lumen's to choose)

Three candidate approaches, in increasing complexity:

**Option 1 — Directional probes (preferred for correctness).** Instead of measuring
RTT and halving, measure the one-way latency directly in each direction using
synchronized clocks (e.g., PTP/IEEE 1588 or a Zeta versionstamp exchange). Store
`outboundMs` and `returnMs` separately in `Meter`; `bestOneWayMs` returns
`min(outboundMs)` for the A→B direction and `min(returnMs)` for B→A. This eliminates
the halving assumption entirely. Requires clock synchronization between the two nodes,
which is non-trivial at planetary scale but is the only fully correct solution.

**Option 2 — Asymmetry bound (conservative correction).** Retain the RTT measurement
but add an asymmetry budget `δ` (ms) derived from the known orbital geometry and
velocity. The corrected one-way estimate is `RTT/2 − δ` (conservative: assume the
fast direction is faster by at most δ). This keeps the current probe protocol but
requires an orbital-mechanics oracle to supply δ. For Earth–Mars, δ can be computed
from the current ephemeris; for terrestrial links, δ = 0 recovers the current behavior.

**Option 3 — Widen the cone conservatively.** Treat `min(RTT)/2` as an **upper bound**
on the fastest one-way crossing (not an estimate), and declare `OutOfCone` only when
`min(RTT)/2 > deadlineMs + δ_max`, where `δ_max` is a worst-case asymmetry budget for
the deployment context. This is the most conservative option: it suppresses some true
`OutOfCone` evidence (safe direction) and never manufactures false `OutOfCone`. For
terrestrial deployments, `δ_max = 0` recovers current behavior.

---

## What does NOT fix this

**Changing the prior in `CalibrationLedger` does not help.** The whitewash window in
the calibration system (Beta(2,2) prior, k=3 clamp floor) is a separate concern
documented in `calibration-ledger.test.ts:356-399`. That gap is in the posterior
update, not in the regime measurement. The real whitewash window for the calibration
system was the epsilon-sign / peer-count P2 issue in `vault-state-bridge.ts`, which
shipped in #9958.

**The gossip soundness rule is not affected.** `GossipTelemetry` merges are monotone
toward in-cone (a gossiped crossing can only add an observed fast path, never remove
one). This property is preserved regardless of the asymmetry fix chosen: if anything,
directional probes make the gossip merge more precise, not less sound.

---

## Boundaries (honest)

This caveat applies **only when the deployment spans links with measurable path
asymmetry** — specifically, planetary-scale links where orbital motion creates
directional latency differences. On terrestrial links the symmetric-path assumption
is a reasonable approximation and the current code is sound for practical purposes.

The code already states the assumption explicitly in both files:

```fsharp
// BusRegime.fs:42 — "min(RTT)/2 under the stated symmetric-path assumption"
```

```typescript
// bus-meter.ts:62 — "RTT/2 under the stated symmetric-path assumption"
```

The fix is to either replace the assumption with directional measurement (Option 1),
add an asymmetry budget (Option 2), or widen the cone conservatively (Option 3). The
choice depends on the deployment context and the availability of clock synchronization.

---

## Anchors (Beacon)

Mills 1985 (NTP RTT/2 one-way estimate — the same assumption, terrestrial context);
Toner–Bacon 2003 (one bit fakes super-quantum in-cone — the reason the cone matters);
Hensen et al. 2015 (loophole-free Bell test — the locality loophole is the exact gap
this caveat addresses at planetary scale). In-repo: `src/Bayesian/BusRegime.fs:42`
(`bestOneWayMs`), `src/Core.TypeScript/discovery/bus-meter.ts:62` (`bestOneWayMs`),
`src/Bayesian/GossipTelemetry.fs` (gossip soundness rule); the G1–G4 audit doc;
caveat (a) doc (`2026-08-02-caveat-a-chsh-margin-autocorrelation-*.md`).
