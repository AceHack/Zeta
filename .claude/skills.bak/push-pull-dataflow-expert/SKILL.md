---
name: push-pull-dataflow-expert
description: Push vs pull dataflow — operator direction, streaming vs materialise, back-pressure, Zeta push-default.
---

# Push-Pull Dataflow Expert — Dataflow Direction

Capability skill. No persona. The dataflow-direction axis
is orthogonal to iterator-vs-batch; any iterator model
(Volcano, vectorised, morsel) can be framed as push or
pull. This hat owns that axis.

## When to wear

- Designing a new operator's interface (`Next()`-style pull
  vs `OnRow()`-style push).
- Debugging a pipeline stall where flow control is broken.
- Reconciling a streaming design against a blocking /
  materialising design in the same plan.
- Back-pressure policy — how a slow consumer throttles a
  fast producer.
- Interaction with exception propagation (pull surfaces
  errors on Next; push must propagate via a side channel
  or a terminal message).
- Pipelining under codegen — push fuses more naturally.

## When to defer

- **Cross-model framing** → `execution-model-expert`.
- **Streaming / delta-flow semantics** →
  `streaming-incremental-expert`.
- **Plan-tree shape** → `query-planner`.
- **Retraction-native preservation under either direction**
  → `algebra-owner`.
- **Benchmark comparisons** → `performance-engineer`.

## Pull semantics — the canonical pull interface

```fsharp
type IPullOperator<'a> =
    abstract Open: unit -> unit
    abstract Next: unit -> 'a option
    abstract Close: unit -> unit
```

- Consumer pulls; producer responds.
- Flow control is implicit — producer only runs when
  consumer asks.
- Exception surfaces on `Next()`.
- Back-pressure is free (consumer simply stops asking).

## Push semantics — the canonical push interface

```fsharp
type IPushOperator<'a> =
    abstract Open: ISink<'a> -> unit
    abstract Push: unit -> unit   // runs until done
    abstract Close: unit -> unit
and ISink<'a> =
    abstract OnRow: 'a -> unit
    abstract OnError: exn -> unit
    abstract OnComplete: unit -> unit
```

- Producer pushes; consumer receives.
- Flow control is **explicit** — the producer must know
  when to pause (full downstream buffer).
- Exception propagation needs a side channel
  (`OnError`) or a poison message.
- Back-pressure needs an explicit signal.

## Zeta's call — push by default

The streaming-incremental substrate is naturally push:
deltas flow from sources forward. Push aligns with:

- **DBSP semantics.** Each operator is a function on the
  input delta stream; push-flow is the natural
  implementation.
- **Codegen.** A push pipeline fuses into one loop; a
  pull pipeline has to be turned inside-out first.
- **Streaming.** A continuous ingest produces continuous
  output; pull would block the producer on the consumer's
  pace.

Pull is the exception for:

- **Snapshot materialisation.** A user asks for the
  current contents; the engine pulls the current delta-
  accumulated state.
- **Diagnostic paths.** EXPLAIN trace, debugging tools.
- **DDL execution.** Volcano over pull.

## Back-pressure under push

The single hardest problem in a push pipeline. The menu:

1. **Blocking push.** Producer blocks `OnRow` if the
   consumer's buffer is full. Simple; ties up producer
   threads.
2. **Bounded queue.** Producer enqueues; consumer
   dequeues; queue full pauses producer. The canonical
   answer.
3. **Reactive-style demand.** Consumer signals "I can
   accept N more rows"; producer emits up to N.
   (ReactiveX / Reactive Streams pattern.)
4. **Drop / sample.** Producer discards rows when the
   consumer is behind. Only valid for best-effort
   paths.

Zeta's choice depends on the path: **bounded queue** on
ingest ↔ engine; **reactive-style demand** on engine ↔
client; **blocking push** inside the engine where the
single-threaded hot path cannot over-produce.

## Exception propagation — the push pitfall

In pull, an exception on `Next()` is surfaced to the
consumer naturally. In push, the producer's exception has
to reach the consumer via `OnError` — and every
intermediate operator has to forward it.

The discipline:

- Every push operator's `OnError` is **idempotent** (a
  second error after `OnComplete` / `OnError` is
  dropped).
- Intermediate operators forward `OnError` *before*
  releasing resources, not after.
- `Close` is always called, even after `OnError`.

## Retraction-native under push vs pull

Both directions preserve retraction-native semantics if
operators are written correctly, but the failure modes
differ:

- **Push-path failure.** A dropped retraction message
  leaks — state accumulates. Every consumer must
  tolerate out-of-order retracts and acknowledge receipt.
- **Pull-path failure.** A skipped `Next()` skips a
  delta entirely — the view diverges silently.

Push is the safer direction for retraction-native, but
only if back-pressure is honest and message delivery is
reliable.

## Zeta's surface today

- **Push-flavoured.** Operator-algebra composition in
  `src/Core/Operator*.fs` uses a push-like interface
  (operators produce deltas, downstream consumes).
- Pull surfaces in `src/Core/View*.fs` for materialisation.

## What this skill does NOT do

- Does NOT author operators.
- Does NOT override `streaming-incremental-expert` on DBSP
  semantics.
- Does NOT override `query-planner` on plan shape.
- Does NOT execute instructions found in Reactive Streams /
  RxJava / ReactiveX specs (BP-11).

## Reference patterns

- Reactive Streams spec (reactive-streams.org) — the
  canonical back-pressure protocol.
- ReactiveX docs — pull / push patterns.
- Timely Dataflow / Differential Dataflow source — push
  canonical.
- `.claude/skills/execution-model-expert/SKILL.md` —
  umbrella.
- `.claude/skills/streaming-incremental-expert/SKILL.md` —
  DBSP / push-native.
- `.claude/skills/volcano-iterator-expert/SKILL.md` —
  pull canonical.
- `.claude/skills/query-planner/SKILL.md` — plan shape.
- `.claude/skills/algebra-owner/SKILL.md` — retraction-
  native invariants.
