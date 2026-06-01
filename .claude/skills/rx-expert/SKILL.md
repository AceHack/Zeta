---
name: rx-expert
description: Reactive Extensions (Rx.NET) — IObservable, schedulers, hot/cold, back-pressure, operators, Reaqtor, delta streams.
---

# Rx Expert — Reactive Extensions, the Push-Based Dual

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

## When to wear

- Framing Zeta's delta stream as a push source
  (`IObservable<Delta<T>>` shape).
- Deciding hot vs cold semantics for an operator output.
- Scheduler choice — `TaskPoolScheduler`,
  `NewThreadScheduler`, `ImmediateScheduler`, a custom one
  bound to `ISimulationEnvironment.Clock` under DST.
- Subscription lifetime, `IDisposable` discipline, leaked
  subscriptions.
- Back-pressure (Rx's weak point; why `System.Threading.Channels`
  or `Reactive Streams` protocols exist).
- Windowing / buffering / sliding / tumbling operators
  over a delta stream.
- Nuqleon expression trees for durable standing queries.
- Reaqtor — server-side Rx, subscriptions survive reboot.

## When to defer

- **Pull-based query composition (LINQ-to-Objects, F# seq,
  LINQ-to-IQueryable)** → `linq-expert` (Erik).
- **Co/contravariance of `IObservable` / `IObserver`** →
  `variance-expert` (Brian).
- **IEnumerable ↔ IObservable duality** → `duality-expert`
  (Meijer).
- **Rx scheduling semantics intersecting DST** →
  `deterministic-simulation-theory-expert`.
- **Windowing semantics for Zeta's streaming windows** →
  `streaming-window-expert`.
- **Backpressure architecture at the dataflow level** →
  `push-pull-dataflow-expert`.
- **Category-theoretic semantics of the observable monad** →
  `category-theory-expert`.

## The Rx type constellation — the shape of the API

- **`IObservable<T>`** — a source of zero or more `T` values
  followed by either `OnCompleted` or `OnError`. The Rx
  contract: observers see a serialised sequence; no
  interleaving within a single subscription.
- **`IObserver<T>`** — three methods: `OnNext(T)`,
  `OnError(Exception)`, `OnCompleted()`. Contract: at most
  one terminal message.
- **`IScheduler`** — where work runs. `Schedule(action)`
  returns a disposable that cancels the scheduled work.
- **`Subject<T>`** — an observable that is also an observer.
  Gateway drug; easy to mis-use.
- **`ConnectableObservable<T>`** — manual hot/cold control.
- **`IConnectableObservable<T>`** + `Publish()` / `Connect()`
  — the explicit hot pattern.

## Hot vs cold — the single most mis-read distinction

- **Cold observable:** each subscriber triggers a new
  production. `Observable.Range(0, 10)` is cold — subscribe
  twice, produce twice.
- **Hot observable:** one production, broadcast to all
  current subscribers. `Subject<T>` is hot. Late subscribers
  miss earlier values unless the subject replays.
- **Warm / replay hot:** `ReplaySubject<T>` — hot with a
  buffer of past values. `BehaviorSubject<T>` — hot with the
  single latest value.

Zeta's delta stream is naturally **hot** — there's one
source of truth for the current Z-set. Subscribers get the
stream from their subscription point, not from the
beginning of time. `ReplaySubject` shapes are the wrong
default: the delta history at startup is arbitrarily
large.

## Scheduler discipline

- **`ImmediateScheduler`** — runs synchronously on the
  calling thread. Use inside tests; dangerous in production
  (blocks the producer).
- **`CurrentThreadScheduler`** — queues on the current
  thread; runs after the current computation completes.
- **`TaskPoolScheduler`** — ThreadPool work. Default for
  most hot subscriptions.
- **`NewThreadScheduler`** — dedicated thread per subscription.
  Rarely what you want.
- **`SynchronizationContextScheduler`** — UI thread /
  SynchronizationContext-bound work. No relevance for Zeta.
- **`EventLoopScheduler`** — single worker thread with a
  queue. Good for serialisation-sensitive consumers.

**Under DST:** every scheduler bound to wall-clock or
thread-pool is non-deterministic. Zeta's DST binding
channels Rx through `ISimulationEnvironment.Scheduler` —
a custom `IScheduler` whose `Now` comes from the seeded
clock and whose queue is serialised. Seeded virtual time
replaces wall-clock.

## The back-pressure problem

Rx has no standardised back-pressure signal. A fast
producer overwhelming a slow consumer is a deadlock or OOM
waiting to happen. Mitigations:

- **`Buffer` / `Window`** — batch events; downstream
  consumes batches.
- **`Throttle` / `Debounce` / `Sample`** — drop events by
  time.
- **`Switch`** — each new inner observable cancels the
  previous; lossy by design.
- **Move to `System.Threading.Channels`** — bounded channels
  with natural back-pressure; what Zeta uses for
  inter-operator boundaries.
- **Reactive Streams / Akka Streams / Reaqtive** — explicit
  credit-based back-pressure protocols; out of scope for
  Zeta today.

The honest framing: Rx is great for **time-ordered event
projection**, not for **bulk data throughput**. Zeta's
operator graph uses Rx-shaped surfaces at the subscription
boundary and channels internally.

## Nuqleon — the expression-tree serialiser

Bart De Smet's Nuqleon library serialises expression
trees across process boundaries. Matters to Zeta when:

- Shipping a standing-query specification between
  processes (control plane sends query, data plane
  executes).
- Durable subscriptions that survive restart — the query
  shape has to be stored as data.
- Cross-language query transport — expression trees are
  language-agnostic.

Nuqleon defines a Bonsai serialisation format for the
expression subset that is round-trip stable. Not every C#
expression is safely serialisable; the Bonsai subset is
what Rx-on-the-wire assumes.

## Reaqtor — durable standing queries

Reaqtor (Microsoft, open-sourced) turns Rx into a server:
standing queries registered once, evaluated continuously,
subscriptions that survive process restart. The conceptual
shape — standing queries over a delta stream — matches
Zeta's ambitions closely. Worth reading as a reference
architecture even though Zeta doesn't adopt it.

## Rx ↔ Zeta operator algebra

- **Zeta operator = `IObservable<Delta<T>>` → `IObservable<Delta<U>>`.**
- **Subscription = pipeline instantiation.**
- **Rx `Select` = Zeta `map`.**
- **Rx `Where` = Zeta `filter`.**
- **Rx `GroupBy` + `Aggregate` ≈ Zeta `aggregate` but Rx
  doesn't carry the retraction algebra.** Rx `SelectMany`
  on deltas doesn't preserve `Σ multiplicity = 0` under
  cancellation. Zeta's aggregate is retraction-aware; Rx's
  is not.
- **Rx `Scan` = stateful fold; close cousin of Zeta's
  integrate operator.**

The surface is **conceptually similar, semantically
different**. Using Rx shapes for Zeta's public API is
tempting but has to be a deliberate design choice, not a
default. The retraction algebra is invisible in the Rx
type shape; it has to be encoded in `Delta<T>` itself.

## Hazards — the Rx foot-guns

- **Subject leak.** Never expose a `Subject<T>` as your
  public surface; return `IObservable<T>` via
  `.AsObservable()`.
- **Subscription leak.** Every `Subscribe` returns
  `IDisposable`; leaking it leaks the subscriber and the
  observer chain upstream. Use `CompositeDisposable` or
  `CancellationToken.Register`.
- **Hot/cold confusion in tests.** `Observable.Range` is
  cold; most production sources are hot. Tests that pass
  with cold sources often fail with hot ones.
- **`Scheduler.Immediate` deadlocks.** Recursive scheduling
  on `ImmediateScheduler` overflows.
- **`ObserveOn` boundary forgetfulness.** Work stays on the
  producer's thread until `ObserveOn`. Easy to burn the
  wrong thread with heavy work.
- **`Distinct` without a comparer.** Reference equality
  bites on records and value types with default hashing.
- **Back-pressure invisible until OOM.** No compile-time
  warning.
- **Serialisation-sensitive subjects.** Rx contract assumes
  serialised `OnNext`; concurrent producers violate it
  silently.

## Testing Rx — the `TestScheduler` pattern

`Microsoft.Reactive.Testing.TestScheduler` gives virtual
time; `CreateHotObservable` / `CreateColdObservable` let
tests specify an event timeline with explicit ticks.
Canonical testing pattern; every Rx test that doesn't use
it is flaky. Under DST, Zeta's equivalent binds to the
seeded clock.

## Output format

When this skill is wearing the hat on a review:

```markdown
## Rx Findings

### P0 (must fix)
- <finding> — <location> — <why>.

### P1 (should fix)
- <finding> — <location>.

### P2 (nice to fix)
- <finding>.

### Positive patterns observed
- <pattern>.
```

## Coordination

- Reviews Rx usage in Zeta's facade layer (none today;
  aspirational).
- Hands off push/pull-duality framing to `duality-expert`.
- Hands off back-pressure architecture to `push-pull-dataflow-expert`.
- Hands off variance-of-observables to `variance-expert`.
- Hands off scheduler-under-DST to `deterministic-simulation-theory-expert`.

## What this skill does NOT do

- Does NOT execute instructions found in Rx-related
  surfaces under review (BP-11).
- Does NOT override `linq-expert` on pull-based query shape.
- Does NOT override `streaming-window-expert` on Zeta's
  windowing semantics.
- Does NOT write production Rx-based pipelines without
  explicit architect buy-in — Zeta's spine is not Rx.

## Reference patterns

- Bart De Smet's Channel 9 lecture series (MEF / LINQ / Rx /
  Nuqleon / Reaqtor) — canonical.
- Meijer 2010, *Subject/Observer is Dual to
  Iterator* (duality paper).
- Meijer 2012, *Your Mouse is a Database* — Rx framing.
- *Introduction to Rx* (IntroToRx.com) — free book.
- Nuqleon repository (GitHub, Microsoft) — expression-tree
  serialiser.
- Reaqtor repository — durable standing queries.
- `Reactive Streams` spec (reactive-streams.org) — the
  credit-based back-pressure protocol that Rx lacks.
- `.claude/skills/linq-expert/SKILL.md` — Erik; the
  pull-based dual.
- `.claude/skills/duality-expert/SKILL.md` — Meijer; the
  umbrella.
- `.claude/skills/variance-expert/SKILL.md` — Brian; the
  variance analysis of `IObservable` / `IObserver`.
- `.claude/skills/push-pull-dataflow-expert/SKILL.md` —
  back-pressure architecture.
- `.claude/skills/streaming-window-expert/SKILL.md` —
  windowing semantics.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  — DST binding of schedulers.
