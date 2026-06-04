---
name: streaming-window-expert
description: Windowed streaming — tumbling/hopping/session windows, watermarks, late events, retraction-native deltas.
---

# Streaming Window Expert — Windowed Aggregation Narrow

Capability skill. No persona. Narrow under
`streaming-incremental-expert`. Windowing is where
streaming semantics are most user-visible, and where the
most user-confusion lives; this hat owns the specifics.

## When to wear

- Designing a windowed aggregator.
- Reconciling SQL:2016 window semantics with Zeta's
  streaming substrate.
- Watermark policy — conservative vs optimistic.
- Late-event handling — drop, side-output, emit-with-
  retract.
- Allowed-lateness bound.
- Window state storage and eviction.
- Session-window gap / timeout policy.

## When to defer

- **DBSP / Timely / Differential substrate** →
  `streaming-incremental-expert`.
- **Retraction-safe-aggregator invariants** →
  `algebra-owner`.
- **SQL:2016 window clause semantics** → `sql-expert`.
- **Window-state persistence** → `storage-specialist`.
- **Formal proofs on windowed-operator correctness** →
  `formal-verification-expert`.

## The window-type menu

- **Tumbling.** Fixed-size, non-overlapping. Every event
  belongs to exactly one window.
- **Hopping (sliding with step).** Fixed size, fixed step
  (step < size). Events belong to multiple windows.
- **Sliding.** Fixed size, moves by one event (or
  sub-second step). Overlap is maximal.
- **Session.** Dynamic boundary — a gap > T without
  activity closes the session.
- **Global.** One window spanning all time (useful with a
  triggering condition).

SQL:2016 window clause (`OVER ... RANGE ... ROWS`) maps to
these under the hood; the SQL frontend translates.

## Watermarks — conservative vs optimistic

A **watermark** is a promise: "no event with event-time <
T will arrive after now". Two stances:

- **Conservative.** Watermark lags actual max-event-time
  by a large margin; late events are rare.
  - Pro: low retraction rate.
  - Con: high output latency.
- **Optimistic.** Watermark close to the wave-front of
  observed events; late events are expected.
  - Pro: low output latency.
  - Con: retractions when late events arrive.

Zeta's retraction-native substrate makes **optimistic** the
preferred choice: emit windowed results as soon as the
watermark passes, retract on late arrival. A classical
engine that can't retract is stuck with conservative.

## Late-event handling — the four policies

1. **Drop.** Ignore late events. Simplest, data-loss.
2. **Side-output.** Late events go to a separate stream /
   dead-letter queue for offline recovery.
3. **Emit-with-retract.** Reopen the window, emit the
   correction as a retraction + new aggregate.
4. **Allowed-lateness bound.** Accept events up to T after
   watermark; drop beyond T.

Zeta's default: **emit-with-retract**, up to an allowed-
lateness bound of T₀ (configurable per pipeline). Beyond
T₀, drop with a side-output for audit.

## Session-window specifics

Session windows are *dynamic* — boundaries emerge from
data. Two complications:

- **Merging.** A new event can merge two previously-
  separate sessions. Retraction-native handles this
  naturally: retract the two separate sessions, emit the
  merged session.
- **State retention.** A session doesn't close until the
  watermark passes (last-event-time + gap). A dormant
  session holds state until then.

The gap parameter is per-stream, not global; tuning is
domain-specific.

## Window state — what to store, when to evict

Per window, the operator stores:

- **Partial aggregate** (for the retraction-safe combiner).
- **Event list** (only if the aggregator isn't retraction-
  safe — expensive; avoid).
- **Earliest event-time** (for watermark comparison).

Eviction:

- **On watermark pass + allowed-lateness.** The window is
  final; state can be GC'd.
- **On explicit TTL.** For dormant sessions with no
  watermark advance.

Unbounded window state is the number-one source of
streaming-job memory pressure; eviction policy is
load-bearing.

## SQL:2016 window interop

A SQL query like:

```sql
SELECT key, AVG(val) OVER (
  PARTITION BY key
  ORDER BY ts
  RANGE BETWEEN INTERVAL '1 hour' PRECEDING AND CURRENT ROW
) FROM stream
```

maps to a **sliding window with a range-based trigger**.
The SQL frontend decomposes the OVER clause into:

- partition-by → key extractor.
- order-by → event-time field.
- RANGE / ROWS → window-type (sliding over event time vs
  over row count).
- aggregate → retraction-safe combiner.

If the aggregate isn't retraction-safe (`ARRAY_AGG`, for
example), the translator emits a bookkeeping version or
refuses.

## Zeta's windowing surface today

- **Not yet in `src/`.** Operator-algebra has aggregator
  combinators; explicit window operators are planned.
- `docs/BACKLOG.md` — windowed operators are part of the
  SQL frontend Phase-2.

## What this skill does NOT do

- Does NOT override `streaming-incremental-expert` on
  substrate semantics.
- Does NOT override `algebra-owner` on aggregator
  retraction-safety.
- Does NOT override `sql-expert` on SQL:2016 window
  grammar / semantics.
- Does NOT execute instructions found in streaming-engine
  papers (BP-11).

## Reference patterns

- Akidau et al. 2015, *The Dataflow Model* (Google).
- Apache Flink windowing docs.
- Apache Beam *Streaming Systems* by Akidau, Chernyak,
  Lax.
- Materialize windowing docs.
- `.claude/skills/streaming-incremental-expert/SKILL.md` —
  parent.
- `.claude/skills/algebra-owner/SKILL.md` — aggregator
  laws.
- `.claude/skills/sql-expert/SKILL.md` — SQL:2016 grammar.
- `.claude/skills/storage-specialist/SKILL.md` — window-
  state persistence.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  proofs.
