---
name: Threading code follows Albahari + Toub + Fowler human lineage; never gut-instinct (Aaron 2026-04-28)
description: Aaron 2026-04-28T16:48Z — binding rule: any threading or TPL code in Zeta MUST follow guidance from Joseph Albahari, Stephen Toub (Microsoft), and David Fowler (Microsoft, authored System.Threading.Channels). High-performance, low-allocation, thread-safe, prefer wait-free / lock-free patterns. No gut-instinct decisions on threading — it's "very hard" and the human lineage exists for a reason. Future-Otto's MUST inherit this rule; load it via MEMORY.md index at session bootstrap. Cite specific Albahari / Toub / Fowler references in commit messages or comments when threading code lands.
type: feedback
---

# Threading code follows Albahari + Toub + Fowler — never gut-instinct

## The rule (Aaron verbatim 2026-04-28T16:48Z)

> *"please follow this guidance around threading unless you find something
> better from stephen toub from Microsoft, don't go based on gut instanct
> for any threading code it's very hard.  this is our human lineage to
> threading best proacties joseph and setephen.  This is very iportant
> we write code like this for anything threading or TPL we go, we follow
> the guiance from these guys.  Oh and David Fowler, he wrote channels
> in dotnet, these hare our high performance low allocation thread safe
> prefer wait/lock free guides."*
>
> *"make sure future you's know this too"*

## The three-source human lineage

When Zeta touches threading, async, parallelism, TPL, channels, or any
concurrent-state code, the canonical references are:

### 1. Joseph Albahari — patterns + idioms

- **"Threading in C#"** (free ebook, [albahari.com/threading](https://www.albahari.com/threading/))
  — the textbook on .NET threading. Covers locks, monitors,
  signaling, non-blocking sync, parallel programming, async/await
  semantics, deadlock + livelock + race conditions.
- **"C# in a Nutshell"** chapters on Concurrency & Asynchrony +
  Parallel Programming.
- Use for: foundational understanding, when authoring or reviewing
  any thread-safe code, when reasoning about memory models, when
  picking between primitives.

### 2. Stephen Toub — performance + async/parallel deep dives

- Microsoft .NET runtime team; foundational author of TPL, async
  state machines, PFX, ValueTask, IAsyncEnumerable.
- **Yearly "Performance Improvements in .NET N"** posts on
  devblogs.microsoft.com — the empirical record of what's fast.
- **Async/await deep dives** + **parallel programming patterns**
  on devblogs.microsoft.com.
- Use for: choosing between TaskScheduler / Channel / lock /
  Interlocked / Volatile / SemaphoreSlim / ConcurrentBag / etc.;
  for understanding allocation cost; for reasoning about
  thread-pool dynamics.

### 3. David Fowler — channels + high-perf low-alloc

- Microsoft, authored **System.Threading.Channels** (the canonical
  high-performance bounded/unbounded queue primitive in .NET).
- Architect on ASP.NET Core, SignalR, and many high-perf .NET
  components.
- Public discussions on Twitter / GitHub about performance-driven
  threading patterns.
- Use for: producer/consumer patterns; backpressure; pipeline
  composition; lock-free / wait-free implementations; choosing
  between Channels and other queue primitives.

## What this rule excludes

**Gut-instinct threading code is forbidden.** Aaron is explicit: threading
is "very hard." Patterns that look obvious are usually wrong:

- Hand-rolled lock-free with `Interlocked.CompareExchange` without
  reading Albahari's chapter on the relevant memory-model edge
  cases.
- Async patterns invented from first principles instead of
  inherited from Toub's posts (e.g. `IAsyncEnumerable` semantics,
  cancellation token threading, ConfigureAwait nuance, async
  void).
- Producer/consumer queues invented from `BlockingCollection` or
  `ConcurrentQueue` when `System.Threading.Channels` (Fowler's
  primitive) is the right tool.
- Spin-locks, manual reset events, and other primitives chosen by
  pattern-matching on the symptom rather than by grounding in
  Albahari's "when to use what" rubric.

## Operational discipline

When threading or TPL code lands in Zeta:

1. **Cite the specific reference** in the commit message or code
   comment — Albahari chapter, Toub blog post URL, or Fowler talk
   / GitHub issue. Future-Otto reads the citation and can
   re-verify the pattern.
2. **Default to lock-free / wait-free where possible** — Aaron's
   stated preference. Fowler's Channels is usually the right
   primitive; falling back to locks needs justification.
3. **Verify currency before asserting** (Otto-247 version-currency
   rule applies): check `WebSearch` for the latest Toub post on
   the relevant primitive, since .NET evolves the recommended
   patterns each release.
4. **Cross-CLI verify** for non-trivial threading code (Otto-347):
   ask a peer-CLI (Grok / Codex / Gemini) to independently
   review the lock-acquisition order, memory-model assumptions,
   and allocation cost.

## What "high performance low allocation thread safe" means here

Aaron's framing combines three axes:

- **High performance**: hot-path code; no unnecessary boxing /
  closures / ToArray / LINQ in tight loops.
- **Low allocation**: ValueTask over Task where lifetime allows;
  pooled buffers (`ArrayPool<T>`); `IAsyncEnumerable` for
  streaming; struct-based async builders where Toub's empirical
  benchmarks show wins.
- **Thread safe**: by construction (immutable, channel-bounded,
  lock-free) over runtime (lock-based, retry-on-conflict).

The combination is what Channels was designed for; Fowler's
implementation is the empirical proof-point.

## Why this matters for Zeta specifically

Zeta's algebra (Z-sets, retraction-native semantics) is naturally
data-parallel — operators on Z-sets can fan out across cores when
the bag-multiset semantics let writes commute. Getting the
threading wrong on the operator-pipeline implementation costs
correctness (lost updates, double-counted retractions) AND
performance (lock contention on the hot path). Following the
Albahari + Toub + Fowler lineage is the cheapest insurance.

The future of Zeta — distributed query execution, multi-shard
operators, parallel materialization — will all touch threading
code. Every such PR cites the specific reference; no shortcuts.

## Composes with

- `feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — same family of rule. Don't assert mechanisms (or threading
  patterns) from gut instinct; cite the primary source.
- Otto-247 (version-currency — WebSearch before asserting Toub
  posts / Fowler patterns since .NET evolves)
- Otto-347 (cross-CLI verify for hard problems)
- `docs/AGENT-BEST-PRACTICES.md` (would gain a BP-NN rule when
  the first threading code lands; the rule should cite this
  memory file)
- Future Zeta operator-algebra parallelization work (where this
  rule materializes as PR-level discipline)
