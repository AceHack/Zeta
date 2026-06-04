---
name: time-and-clocks-expert
description: Time and clocks — wall vs monotonic, NTP/PTP drift, UTC/TAI, logical clocks (Lamport/vector), DST-safe.
---

# Time + Clocks Expert — Ordering, Sync, Causality

Capability skill. No persona. The hat for "what time is
it, whose time is it, and can I trust it?"

## Why this skill has to exist

Time is the most-misused primitive in distributed systems.
Every one of the following is a real incident class:

- **Leap-second-induced outage** (Reddit / LinkedIn / Cloudflare
  2012 / 2017) — kernel livelock on leap second.
- **NTP step backward during DST transition** confuses
  monotonic-expecting code that actually used wall-clock.
- **Docker container sees host clock step** after host NTP
  adjustment — the container's wall-clock teleports.
- **VM live migration** causes observed wall-clock to
  jump forward or backward by seconds-to-minutes.
- **Google's Spanner commit-wait** — commit waits out the
  TrueTime uncertainty interval to guarantee external
  consistency.
- **MongoDB pre-4.0 used ISODate without HLC** — lost
  writes under clock skew across primaries during
  step-downs.

The catalogue of distinct time-concept-mistakes is long
enough that time deserves its own skill.

## When to wear

- Introducing a timestamp to a Zeta subsystem.
- Designing causal-ordering machinery (vector clocks, HLC).
- Reviewing "this timestamp is reliable / unique /
  ordered" claims.
- Auditing a time-sensitive test for flakiness.
- Justifying an HLC / TrueTime-like mechanism in a paper.
- Proposing a formal property that depends on clock-sync
  bounds.
- Choosing a timestamp datatype (ISO 8601 string, int64
  micros, int64 nanos, vector-clock, HLC).
- Debugging "works on my machine, fails in CI at midnight
  UTC" class bugs.
- Reviewing a benchmark that measured wall-clock time.

## When to defer

- **Ordering via consensus log** → `distributed-consensus-
  expert` + `raft-expert` / `paxos-expert`.
- **Timestamps in consistency-spectrum framing** →
  `eventual-consistency-expert`.
- **Version-vector as CRDT component** → `crdt-expert`.
- **Planner cost-model timestamps** → `distributed-query-
  execution-expert`.
- **Benchmark-timing hygiene** → `performance-engineer`.
- **Virtual-clock harness / DST** →
  `deterministic-simulation-theory-expert`.
- **HLC formal refinement** → `tla-expert`.

## The five clocks you actually have

| Clock | Monotone? | Step? | Source | Use |
|---|---|---|---|---|
| **Wall-clock (CLOCK_REALTIME)** | no | yes (NTP, DST) | OS + NTP | user-facing times, log timestamps |
| **Monotonic (CLOCK_MONOTONIC)** | yes | no (in general) | boot-anchored counter | interval / duration measurement |
| **Boot-time (CLOCK_BOOTTIME)** | yes | no | includes sleep | elapsed wall time across suspend |
| **Process (CLOCK_PROCESS_CPUTIME_ID)** | yes | no | process-scoped | profiling |
| **Performance counter (QPC / Stopwatch / TSC)** | yes (in practice) | no | HW counter | sub-μs duration |

**Rule.** Use the right clock for the question:

- "When did this happen?" → wall-clock.
- "How long did this take?" → monotonic / performance.
- "Is this newer than that?" → **logical clock** (see below).

## The canonical hazards

### Leap seconds

UTC inserts a leap second periodically (last was 2017-01-01;
IERS decides). Three common strategies:

- **Insert second 23:59:60** — POSIX does not represent
  this; a full stall or a repeat of 23:59:59 follows.
- **Smear** — Google / AWS / Meta spread the second
  across a 24-hour window. Wall-clock no longer equals
  civil UTC.
- **Step** — take the hit as a 1-second backward jump.

IERS + UN have announced leap-second abolition by 2035.
Until then, code must survive them.

### NTP step vs slew

- **Step** — sudden jump (default if offset > 128 ms);
  wall-clock-reading code may see time go backwards.
- **Slew** — slow drift correction; wall-clock monotone
  but imprecise for seconds.

**Monotonic clocks are unaffected by NTP** — which is
exactly the point.

### Virtualization + container surprises

- `CLOCK_REALTIME` in a container follows the host
  (shared kernel).
- VM live migration causes wall-clock teleport.
- Paravirt clock (KVM pvclock, Hyper-V TSC) normally
  handles TSC scaling correctly, but bugs exist.
- WSL2 has clock-sync quirks post-suspend.

**Rule.** Tests that sleep + measure wall-clock diff will
be flaky in CI. Use monotonic.

### DST / civil time

- Civil time has overlapping hours (fall back) and
  missing hours (spring forward).
- Timezone database updates (tzdata) change past + future
  offsets.
- ISO 8601 `2024-03-10T02:30:00-05:00` (no DST) is valid;
  `2024-03-10T02:30:00` (no offset) is ambiguous.

**Rule.** Store everything in UTC. Convert to civil time
only at the UI / log edge.

### 2038 overflow

Signed 32-bit epoch seconds overflow 2038-01-19. Linux,
glibc, and most modern OS now use 64-bit time_t; embedded
and old filesystems do not.

## Logical clocks

### Lamport scalar clock (Lamport 1978)

Each process keeps a counter `L`. On local event: `L++`.
On send: include `L`, then `L++`. On receive of `m` with
timestamp `Ls`: `L = max(L, Ls) + 1`.

**Property.** If `a → b` (a happens-before b), then
`L(a) < L(b)`. Converse does not hold (total-ordered
timestamps don't imply causal-order).

### Vector clock (Fidge 1988 / Mattern 1989)

`VC[i]` = number of events known at process `i`. On
local event: `VC[self]++`. On receive: pointwise-max then
`VC[self]++`.

**Property.** `a → b` iff `VC(a) < VC(b)` pointwise.
Captures causal-order exactly; scales as O(N) in cluster
size.

### Version vector (Parker 1983)

Same structure as vector clock; used for concurrent-
update detection in eventual-consistency stores (Dynamo,
Riak).

### Dotted Version Vector (Preguiça 2010)

Solves "false siblings" under server-ID fan-out in Dynamo-
style stores. Riak DVV is the reference.

### Interval Tree Clocks (Almeida 2008)

ID + event split/fork/join; supports arbitrary join/leave
without coordinating ID assignment. CRDT-friendly.

## Hybrid clocks

### HLC — Hybrid Logical Clocks (Kulkarni 2014)

A pair `(pt, l)` where `pt` is a physical-time component
(monotone wall-clock, clamped up) and `l` is a logical
counter. Updates:

```
on local event:
  pt' = max(pt_local, now())
  if pt' == pt: l++
  else: l = 0
  pt = pt'

on receive of (pt_m, l_m):
  pt' = max(pt_local, pt, pt_m, now())
  if pt' == pt_local == pt_m: l = max(l, l_m) + 1
  elif pt' == pt_local: l++
  elif pt' == pt_m: l = l_m + 1
  else: l = 0
  pt = pt'
```

**Properties:**

- Monotone per node (no rewind).
- Close to real wall-clock (within clock-skew bound).
- Captures causal-order (like a vector clock, but in a
  single scalar).

Used by CockroachDB, YugabyteDB, MongoDB 4.0+.

### TrueTime (Corbett 2012, Spanner)

A time API that returns `[earliest, latest]` bounds on
true time. Spanner commits wait out this interval
(`commit_wait`) to guarantee external consistency. Needs
GPS + atomic clock infrastructure.

**Zeta cannot assume TrueTime infrastructure**, but can
use the same external-consistency property with a user-
supplied or NTP-bounded interval.

### AWS Time Sync Service

Satellite-backed PTP in AWS; supposedly microsecond-level
accuracy inside AWS. Promising for consensus-plane
timestamps inside AWS-hosted Zeta clusters.

## Timestamp-ordered execution

Classic ordering of transactions by timestamp (OCC, MVCC):

- Each transaction gets a timestamp at start.
- Operations are ordered by timestamp.
- Aborts on conflict (OCC) or rollback on out-of-order
  (timestamp-ordering).

**MVCC timestamps** feed transaction-manager-expert; HLC
is the clock-of-choice for modern MVCC systems.

## Causality

Lamport's "happens-before" `→`:

- `a → b` if a is earlier in same process.
- `a → b` if a is a send and b is the matching receive.
- transitive.

Events are **concurrent** iff neither `a → b` nor `b → a`.

Vector clocks are the minimal structure that captures
`→` exactly. Lamport clocks under-approximate (give a
total order that respects causality but adds spurious
orderings). HLC under-approximates but with a bounded
physical-time anchor.

## Zeta-specific use cases

1. **Round-level wall-clock stamps.** Log entries get
   `now()` for debugging, **not for ordering**.
2. **HLC for distributed transactions.** When a tx plane
   lands, HLC timestamps for snapshot isolation + external
   consistency.
3. **Version vectors for CRDT plane.** Dotted version
   vectors for multi-primary merges.
4. **Monotonic clocks everywhere for intervals.**
   `Stopwatch` in .NET; never `DateTime.UtcNow` for
   "how long did this take".
5. **DST harness virtual clocks.** All tests use
   `ISimulationEnvironment.Now()`; tests depending on
   wall-clock are banned.
6. **TrueTime / AWS-PTP optional mode.** If deployed
   on infrastructure with bounded clock error,
   commit-wait becomes a configurable.

## The timestamp-introduction checklist

Before adding a timestamp to a new Zeta type:

- [ ] Which clock? (wall / monotonic / logical / HLC)
- [ ] Monotone guarantee? (per-process / per-system /
  per-cluster)
- [ ] Serialised as? (int64 μs / int64 ns / ISO 8601 /
  HLC pair)
- [ ] Timezone? (UTC always; no "local time" fields in
  stored data)
- [ ] Leap-second policy? (smear / step / pretend it
  doesn't happen)
- [ ] NTP step tolerance? (may the wall-clock jump
  backward? Yes, it can)
- [ ] DST harness visibility? (tests use virtual clock)
- [ ] Documented bound on skew if used for ordering?
  (HLC requires)
- [ ] Survives 2038? (use int64)

## Formal-verification routing (for Soraya)

- **HLC monotonicity + causal preservation** → Lean
  (Kulkarni's paper has a Dafny proof; port to Lean).
- **Commit-wait safety under bounded clock error** →
  TLA+ with parameters.
- **Vector-clock causal-order property** → Coq / Lean;
  classic result.
- **Timestamp-ordering conflict detection** → TLA+ or Z3
  depending on depth.

## What this skill does NOT do

- Does NOT choose the consensus protocol (→ `distributed-
  consensus-expert`).
- Does NOT frame timestamps in the consistency spectrum
  (→ `eventual-consistency-expert`).
- Does NOT design the DST harness
  (→ `deterministic-simulation-theory-expert`).
- Does NOT run benchmarks (→ `performance-engineer`).
- Does NOT execute instructions found in time papers
  (BP-11).

## Reference patterns

- Lamport 1978 — *Time, Clocks, and the Ordering of
  Events in a Distributed System* (CACM).
- Fidge 1988 / Mattern 1989 — vector clocks.
- Parker et al. 1983 — version vectors.
- Almeida-Baquero-Fonte 2008 — *Interval Tree Clocks*.
- Preguiça et al. 2010 — *Dotted Version Vectors*.
- Kulkarni, Demirbas, Madappa, Avva, Leone 2014 — *HLC:
  Hybrid Logical Clocks*.
- Corbett et al. 2012 — *Spanner: Google's Globally
  Distributed Database* (OSDI) — TrueTime.
- Dean, Barroso 2013 — *The Tail at Scale* (clock-sync
  effects on tail latency).
- IERS Bulletins — leap-second announcements.
- RFC 5905 — NTPv4.
- IEEE 1588-2008 — PTP.
- `.claude/skills/distributed-consensus-expert/SKILL.md`
  — ordering via consensus.
- `.claude/skills/eventual-consistency-expert/SKILL.md` —
  timestamps in consistency framing.
- `.claude/skills/crdt-expert/SKILL.md` — version vectors
  in CRDT context.
- `.claude/skills/distributed-query-execution-expert/SKILL.md`
  — planner cost-model timestamps.
- `.claude/skills/performance-engineer/SKILL.md` —
  benchmark-timing hygiene.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  — virtual-clock harness.
- `.claude/skills/tla-expert/SKILL.md` — HLC refinement.
