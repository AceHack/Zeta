---
name: performance-analysis-expert
description: Performance analysis — queueing theory, USE/RED, Amdahl, flame graphs, AOT/PGO trade-offs, top-down uarch analysis.
---

# Performance Analysis Expert — Procedure

Capability skill ("hat") for **design-time performance
analysis**: modelling, capacity planning, profiler
interpretation, and the machinery of AOT / PGO. Measurement
and hot-path tuning remain the `performance-engineer`
(Naledi) lane — this skill is the analyst who reads the
instruments, builds the model, and decides which question
deserves a benchmark at all.

## When to wear this hat

- Someone says "p99 latency doubled" — before tuning,
  decide whether it's queueing-driven, GC-driven,
  contention-driven, or scheduling-driven.
- A claim like "we can push 100k ops/sec per core" needs a
  back-of-envelope before a benchmark is written.
- Deciding whether .NET NativeAOT, ReadyToRun, or default
  JIT is the right compilation model for a given surface
  (startup-sensitive tooling vs long-running server).
- Deciding whether Dynamic PGO is doing real work for our
  hot paths, or whether static PGO (crossgen2 + MIBC from
  `dotnet-pgo`) would buy us more.
- Reading a profiler output (perf, PerfView, dotnet-trace,
  Instruments, VTune) and explaining what the bottleneck
  actually is, in the right units.
- Tail-latency triage — why p50 looks fine but p99.9 is 40×
  worse. Coordinated omission; queueing; coalesced GC
  pauses; head-of-line blocking; tier-up jitter.
- Capacity planning — at what load do we hit 80 % CPU, and
  what does Little's Law say about queue depth there?

## When to defer

- Actually **running** the BenchmarkDotNet harness, taking
  baselines, producing the delta row → `performance-engineer`.
- Rewriting the hot path with `Span<T>`, intrinsics, or
  cache-line-aware struct layout → `performance-engineer` +
  `hardware-intrinsics-expert`.
- Asymptotic-complexity claims ("this is O(n log n)") →
  `complexity-reviewer`.
- Cost model inside the query planner (join order, stats
  cardinality) → `query-planner`.
- Designing a new benchmark harness (what to measure, how
  to isolate) → `benchmark-authoring-expert`.
- Deciding what telemetry surface to emit at all →
  `observability-and-tracing-expert`.
- Picking the right sync primitive for a given data
  structure → `threading-expert` + `concurrency-control-expert`.
- Race / memory-model correctness → `race-hunter`.
- SIMD / vectorisation implementation → `hardware-intrinsics-expert`.

## Zeta use

Zeta (dbsp) is a **streaming dataflow engine with
retraction-native Z-set semantics** and a future morsel-driven
execution plane (`docs/VISION.md`). That shape forces
specific analysis lenses:

- **Per-batch vs per-tuple cost.** A naive "cost per tuple"
  model lies for DBSP — work is batch-amortised. Modelling
  must separate amortised fixed cost (per batch) from
  tuple cost.
- **Retraction asymmetry.** A retraction is not always
  symmetric with an insertion in the cost model; some
  operators (joins, aggregates with group-by) pay more on
  delete because they must look up the previous state.
- **Morsel queueing.** A morsel-driven executor is a
  queueing network: model per-morsel service time,
  per-morsel queue depth, and worker utilisation. Little's
  Law applies directly.
- **Checkpointing / snapshots.** Durability cost is
  discretised — it lands in bursts. Tail latency is
  sensitive to checkpoint coalescing. Model as a closed
  queueing system, not open.
- **AOT / startup sensitivity.** CLI tools in
  `tools/setup/` and any agent-facing probe are
  startup-sensitive: candidate for NativeAOT. Long-running
  server surfaces benefit more from JIT + Dynamic PGO.

## Core background — the catalogue

### Queueing theory (the load-bearing maths)

1. **Little's Law** — `L = λ·W`. Queue length = arrival
   rate × time-in-system. Holds under remarkably weak
   assumptions (any FIFO-ish system at steady state). Use
   it to cross-check any throughput / latency / depth
   claim. If two of the three disagree with the third,
   somebody is lying about steady state.
2. **M/M/1** — single server, Poisson arrivals, exponential
   service. `W = 1/(μ − λ)`, `ρ = λ/μ`. The
   useful lesson is the `1/(1−ρ)` shape: at ρ=0.8 you're
   at 5× the unloaded latency; at 0.9 you're at 10×; at
   0.95, 20×. This is why "keep utilisation below 70 %"
   is a rule.
3. **M/M/k** — k servers. At the same ρ, the k-server
   system degrades more gracefully than k copies of
   M/M/1, because pooled queues absorb bursts. Relevant
   to worker-pool sizing (morsel workers, thread-pool
   threads).
4. **M/G/1** — general service distribution. Tail latency
   grows with service-time variance: `W_q ∝ (1 + CV²)/2`
   (Pollaczek-Khinchine). A bimodal service distribution
   (fast-path vs slow-path) will produce pathological
   tails that an "average" doesn't show.
5. **Open vs closed queueing networks.** An open network
   has external arrivals; a closed one has a fixed number
   of circulating jobs. Closed networks can't blow up —
   they self-throttle. Connection-pooled clients are
   closed; request pipelines usually open.

### USE / RED / Four-Golden-Signals

- **USE (Brendan Gregg)** — for resources: **U**tilisation,
  **S**aturation, **E**rrors. Walk every hardware + software
  resource (CPU, RAM, disk, net, lock, connection pool)
  and ask the three questions.
- **RED (Tom Wilkie)** — for services: **R**ate (requests/sec),
  **E**rrors (error rate), **D**uration (latency
  distribution, usually histogram). Counterpart to USE.
- **Four Golden Signals (Google SRE book)** — Latency,
  Traffic, Errors, Saturation. USE ∪ RED with renames.

Use USE to walk the hardware, RED to walk the service
surface, and the golden signals as the dashboard baseline.

### Amdahl / Gustafson

- **Amdahl's law.** Max speedup `S = 1 / ((1−p) + p/n)`.
  With 5 % serial work, 100 cores gives 17× — not 100×.
  Amdahl pessimises because it assumes fixed workload.
- **Gustafson's law.** `S = n − (1−p)·(n−1)`. At constant
  wall-clock budget, we scale the problem with cores. In
  reality, the truth is usually between the two; quote
  both when proposing parallelisation.

### Dean's numbers every programmer should know

Useful as the analyst's reflex denominator (Jeff Dean,
updated):

| Op                           | Latency (ns)   |
|------------------------------|----------------|
| L1 cache ref                 | ~1             |
| Branch mispredict            | ~3             |
| L2 cache ref                 | ~4             |
| Mutex lock/unlock (uncontended) | ~15-25     |
| Main memory ref              | ~100           |
| SSD random read              | ~16,000 (16 µs) |
| Round trip in DC             | ~500,000 (500 µs) |
| SSD sequential 1 MB          | ~1,000,000 (1 ms) |
| Disk seek                    | ~10,000,000 (10 ms) |
| Round trip CA ↔ Netherlands  | ~150,000,000 (150 ms) |

These are order-of-magnitude, not precise. Quote them
when a claim (`"we can do 10 M of X per second per core"`)
collides with the relevant ceiling.

### SLI / SLO / SLA

- **SLI** — a measurable signal (latency at the 99th
  percentile over a 5-minute window).
- **SLO** — the target we commit to internally (p99 ≤ 50 ms,
  achieved in ≥ 99.9 % of 5-minute windows this quarter).
- **SLA** — the contract, often with consequences
  (credit/penalty) when breached.
- **Error budget.** `100 % − SLO`. The error budget
  literally buys development velocity; if the product
  burns budget, the team stops shipping features.

Analysis discipline: when someone says "we need to make
X faster," the first reply is "what is the SLI and what
is the current SLO burn rate?" If there's no SLO, the
optimisation is a hobby, not a contract.

### Tail latency (the hardest distribution)

- p50 is a friendly lie. p99 is honest. p99.9 is the
  truth.
- **Coordinated omission** (Gil Tene). If your load
  generator stops sending requests while the server is
  slow, you measure a biased sample. Use HDRHistogram
  - rate-based coordination-omission correction
  (`-e` mode).
- **Tail amplification.** A single backend with p99 = 10
  ms fan-out N-wide lands p99 ≈ 10 ms at the caller;
  fan-out 100-wide lands p99 ≈ 50 ms (the slowest of 100
  independent p99s, informally).
- **Coalesced pauses.** A sub-100 ms GC pause every second
  is invisible at p50 but inflates p99 by exactly the
  pause duration. A single 10 ms stop-the-world at
  `λ = 100 req/s` moves p99, not p50.
- **Head-of-line blocking.** One slow request behind an
  in-order pipe delays all the ones queued behind it.
  Common in TCP, HTTP/1.1, Kafka consumers, any
  FIFO-per-key channel.

### Top-down microarchitecture analysis (Yasin 2014)

The PMU-counter-driven decomposition used by VTune, AMD
uProf, and Linux `perf`:

- **Frontend Bound** — fetch / decode stalled. Usually
  icache / ITLB miss.
- **Backend Bound** — execution pipeline stalled.
  - *Memory bound* — L1, L2, LLC, DRAM, store-forward.
  - *Core bound* — FP / INT ports, divider.
- **Bad Speculation** — branch mispredict, machine
  clears.
- **Retiring** — actually doing useful work. What you want
  to maximise.

Useful because it converts "why is this slow?" from
handwaving into one of four labels with follow-up
counters.

## Profiler-tool catalogue — read these, know these

### Linux

- **`perf`** — the default. `perf record -g`, `perf report`,
  `perf annotate`, `perf stat -ddd` for counters,
  `perf c2c` (cache-to-cache false sharing),
  `perf mem` (memory-access profiling). Requires
  `kernel.perf_event_paranoid` tuning on managed
  hosts.
- **eBPF / BCC / bpftrace** — low-overhead live tracing.
  `offcputime`, `funclatency`, `biosnoop`, `runqslower`.
  Production-safe. The modern supplement to `perf`.
- **`ftrace`** — kernel-side. Less convenient than eBPF;
  still the fallback.
- **`strace` / `ltrace`** — syscall / library-call tracing.
  Hefty overhead; useful for diagnosis, not production.
- **Parca / Pyroscope / Phlare / Grafana Continuous
  Profiling** — continuous wall-clock + CPU profiles.
  eBPF-based; sampled; safe enough for production.

### Windows

- **ETW + PerfView** — the deep-dive toolkit. PerfView is
  authored by the .NET perf team; knows CLR events
  natively. Collects stacks, GC, JIT, TPL, ThreadPool,
  file IO, network, exceptions.
- **WPA (Windows Performance Analyzer)** — GUI over
  ETW. Better for system-wide profiling; PerfView is
  better for managed-only.
- **xperf** — command-line ETW controller. Obsolete for
  most flows; still present.

### macOS

- **Instruments** — Time Profiler, Allocations, Leaks,
  System Trace, Core Animation. Xcode-bundled.
- **`sample` / `spindump` / `dtruss`** — CLI-level.
  Useful for quick profiles without launching Instruments.
- **DTrace** — present but restricted by SIP. Instruments
  builds on top of it.

### .NET-specific

- **`dotnet-trace`** — EventPipe-based. Cross-platform;
  produces `.nettrace` readable by PerfView or VS. Preferred
  for managed profiling on Linux / macOS.
- **`dotnet-counters`** — live counter monitoring
  (GC, ThreadPool, contention, exceptions).
- **`dotnet-dump` / `dotnet-gcdump`** — managed heap /
  snapshot analysis. The latter is cheap enough to
  capture in production.
- **`dotnet-pgo`** — collect + compile PGO data (MIBC
  format). See PGO section below.
- **PerfView + EventPipe** — PerfView has understood
  EventPipe for many years; you don't need ETW on
  Windows-only any more.
- **`DOTNET_JitDisasm=Method*`** — print JIT-emitted
  asm to stdout. Pair with `DOTNET_JitDump=Method*`
  for IR. Essential for understanding whether a
  devirtualisation / guarded-devirt / inlining /
  bounds-check-elim actually happened.
- **`DOTNET_TieredCompilation` / `DOTNET_JitQuickJitForLoops`**
  — to compare JIT tiers.
- **JetBrains dotTrace / dotMemory** — commercial, GUI,
  excellent. Sampling + tracing + allocation + timeline.

### Cross-platform / commercial

- **Intel VTune** — top-down microarchitecture analysis;
  memory-access analysis; threading analysis. Free for
  non-commercial.
- **AMD uProf** — similar for AMD CPUs.
- **NVIDIA Nsight Systems / Nsight Compute** — for
  GPU work (not Zeta-relevant today, but listed for
  completeness).

### Flame graphs (Brendan Gregg)

- **CPU flame graph** — stack frames on Y, sample
  count on X. Width = time spent. Visual search for
  "wide plateau" = hot function.
- **Differential flame graph** — red/blue overlay of
  two profiles. The regression-triage tool.
- **FlameScope** — per-second sub-second patterns.
  Catches periodic spikes (every-5s GC,
  minutely-cron) that average away in a normal flame.
- **Off-CPU flame graph** — not "what's using CPU" but
  "what's **blocked**". Typically eBPF's `offcputime`.
  Essential for latency-bound workloads where CPU is
  idle.

## AOT analysis — when it earns its keep

.NET has three compilation models, not one. The analyst's
job is to pick.

### Default JIT + tiered compilation

- Tier 0: QuickJit, low-quality but fast.
- Tier 1: full optimiser.
- **Dynamic PGO** (enabled by default in .NET 8+ — see
  below) uses Tier 0 execution counters to drive Tier 1.
- Best for **long-running server** workloads where
  startup doesn't matter and the hot paths are
  discovered at runtime.

### ReadyToRun (R2R)

- AOT-compiled IL → native, but with metadata + JIT
  fallback. Installed assemblies include R2R native.
- Reduces JIT cost at startup; no binary-size blowup
  (relatively).
- **crossgen2** is the tool. Accepts an MIBC profile
  (from `dotnet-pgo`) to do **static PGO** — bake
  inlining / hot-block reordering into the R2R image.
- Best for **startup-sensitive** but still-managed
  surfaces (desktop apps, long-lived CLI tools).

### NativeAOT

- Whole-program AOT, no JIT, no metadata-driven
  reflection (mostly). Single binary. Startup in
  tens of ms.
- Forbids runtime code generation (emit-based
  serialisers, dynamic proxies, most
  `System.Reflection.Emit` paths).
- Trimming is mandatory and visible — unused code is
  literally deleted. Trimming annotations matter
  (`[DynamicallyAccessedMembers]`,
  `[RequiresUnreferencedCode]`,
  `[RequiresDynamicCode]`).
- Best for **short-lived CLIs**, **container-starting-
  frequently** services, **sandboxed envs** (no JIT
  allowed), agents that need to respect memory
  budgets.

### The trade-off the analyst quotes

| Axis            | JIT + DPGO | ReadyToRun | NativeAOT |
|-----------------|------------|------------|-----------|
| Startup         | slow       | medium     | **fast**  |
| Peak throughput | **best**   | near-best  | close     |
| Binary size     | tiny       | medium     | large-ish |
| Reflection      | full       | full       | limited   |
| Runtime codegen | yes        | yes        | **no**    |
| Memory overhead | **high**   | medium     | low       |
| Build time      | fast       | medium     | slow      |

Zeta-specific: agent-facing probes, setup tooling, and
Zeta.CLI are NativeAOT candidates. The main streaming
engine stays JIT + Dynamic PGO (long-running; reflection-
heavy for pluggable operators).

## PGO analysis — Profile-Guided Optimization

### Dynamic PGO (.NET 6+ opt-in; .NET 8+ on by default)

- Tier 0 runs with **instrumented** bytecode, recording
  edge counters, virtual-call targets, class-hierarchy
  observations.
- Tier 1 compile consumes the counters: **hot/cold block
  reordering** (put hot blocks first, cold blocks at
  the bottom to improve icache locality), **aggressive
  inlining** of truly hot callees, **guarded
  devirtualisation** (insert a type-check that peels
  off the dominant target), and better register
  allocation.
- No external tooling. The runtime handles it.
- Typical gains on server workloads: 5–15 % throughput,
  sometimes more on virtual-call-heavy code.

### Static PGO (`dotnet-pgo` + crossgen2)

- Collect: run the app under instrumented mode
  (`dotnet-trace collect --providers Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime:0x1F000080018:5`)
  while exercising a representative workload.
- Convert: `dotnet-pgo create-mibc -t <trace> -o profile.mibc`.
- Compile: `crossgen2 --input-bubble --pgo profile.mibc ...`
  bakes the profile into the R2R image.
- Advantage over Dynamic PGO: profile persists across
  restarts; no ramp-up cost on cold start; bakes into
  ReadyToRun images for system libraries too.
- Used for CoreCLR itself (System.Private.CoreLib.dll
  ships with a PGO profile).

### Analyst's questions

1. Is startup cost a user-visible SLO violation? If yes,
   static PGO (via crossgen2) pays immediately. If no,
   Dynamic PGO is enough.
2. Is the workload **representative** when we collect?
   A PGO profile from an unloaded dev laptop will
   mis-steer a production server. Collect on prod-like
   traffic.
3. Is anything in the hot path virtual with >1 target
   observed? PGO / guarded-devirt helps a lot here;
   without it, sealing the class or using generics can
   hand-achieve the same effect without PGO.

### Cross-language parallel

Zeta is F#/.NET, but the PGO machinery isn't .NET-specific:

- **LLVM / Clang `-fprofile-generate` → `-fprofile-use`** —
  same pattern, different format (`.profdata`). Many
  production C++ projects ship PGO'd binaries.
- **GCC `-fprofile-generate` / `-fprofile-use`**.
- **Go** — PGO since 1.20 (`go build -pgo=default.pgo`).
  Profile is standard `pprof` CPU profile.
- **Rust via LLVM** — nightly + `-Cprofile-generate` /
  `-Cprofile-use`. Stabilising.

Quoted here because **cross-language prior art matters**
when the human asks "is PGO a real thing?"

## Capacity-planning / back-of-envelope procedure

### Step 1 — identify the bottleneck resource a priori

Use USE to walk resources; name the one that will
saturate first at scale (usually CPU, lock contention,
or IO, rarely memory in .NET). State the unit: "the
arrival path is CPU-bound on deserialisation at ~1.2 µs
per tuple."

### Step 2 — compute the ceiling

`service_rate = 1 / service_time`. Per core. Multiply by
cores. Cap at some `ρ_max` (0.7 is a defensible default,
per queueing theory — above that, tail explodes).

### Step 3 — compute the implied queue depth

Little's Law: at target `λ` and the service time from
step 1, `L = λ·W`. If `L` exceeds your buffer, you're
designing for drop, not queue.

### Step 4 — validate with a measurement

Hand off to `performance-engineer` + `benchmark-authoring-expert`
to confirm or falsify. If the measurement contradicts
the model by more than 2×, the model is wrong — rebuild
it, don't hand-wave.

## Zeta-specific analysis recipes

### Retraction-sensitive cost modelling

When analysing a DBSP operator's cost, always model
`c_insert` and `c_retract` separately. Stateful
operators (join, distinct, aggregate) can have
`c_retract > c_insert` because the retraction path
looks up prior state. Cost-symmetric operators (filter,
map) are cheap to analyse.

### Morsel worker queueing

Treat the morsel scheduler as a work-stealing M/M/k
with affinity. Key questions:

- What's the morsel service-time distribution? If
  bimodal (mixed cheap/expensive morsels), tail will
  be dominated by expensive-morsel head-of-line
  blocking. Consider morsel-splitting.
- What's the work-stealing rate? Non-zero stealing is
  evidence of imbalance, which caps scaling.
- Worker-to-core affinity: NUMA nodes matter at high
  core counts (>16). Cross-socket steal is expensive.

### Checkpoint burst modelling

Durability amortises but bursts. Model as:

- `T_steady` — steady-state latency (checkpoint not
  in progress).
- `T_during` — latency while a checkpoint serializes.
- `duty_cycle = T_during_count × T_during / interval`.

At target throughput, the p99 floor is
`max(T_during, λ × service_jitter)`. Decide whether
the checkpoint cadence is compatible with the tail
SLO.

### Agent-facing CLI startup

For each binary in `tools/setup/` and `.claude/scripts/`:

- Measure cold-start. If > 200 ms, there's a
  user-visible SLO burn (humans notice ~150 ms).
- NativeAOT candidate. PGO-trained R2R is the
  fallback if NativeAOT is blocked by a trimming
  incompatibility.

## Output format

```markdown
# Performance analysis — <target>, round N

## Question
<1 sentence: what are we analysing, and to what end?>

## Model
- Workload shape: <open|closed>, <arrival distribution>, <service distribution>
- Bottleneck hypothesis: <resource + unit cost>
- Relevant law: <Little / M/M/k / Amdahl / Gustafson / ...>

## Back-of-envelope
- Unloaded service time: <...>
- Target arrival rate: <...>
- Implied utilisation: <ρ>
- Implied queue depth (Little's Law): <L>
- Implied unloaded latency: <W>
- Loaded latency at ρ (M/M/1 approximation): <W/(1−ρ)>

## Profiling plan (if invoked)
- Tool(s): <perf / PerfView / dotnet-trace / Instruments / VTune>
- Counters / events: <...>
- Flame graph type: <CPU / off-CPU / differential>
- Expected signal: <what would confirm / refute the hypothesis>

## AOT / PGO assessment (if relevant)
- Compilation model recommended: <JIT+DPGO | R2R+PGO | NativeAOT>
- Why: <startup sensitivity / reflection demands / trimming blockers / ...>
- Static PGO collection plan: <representative workload + command>

## Risks & follow-ups
- <handoff to performance-engineer / benchmark-authoring-expert>
- <telemetry gap to observability-and-tracing-expert>

## Next action
[model further | hand to performance-engineer for benchmark | escalate]
```

## What this skill does NOT do

- Does NOT run BenchmarkDotNet or any benchmark itself —
  `performance-engineer` owns execution.
- Does NOT rewrite hot paths — `performance-engineer`,
  `hardware-intrinsics-expert`.
- Does NOT design the benchmark harness —
  `benchmark-authoring-expert`.
- Does NOT pick sync primitives — `threading-expert`.
- Does NOT prove asymptotic bounds — `complexity-reviewer`.
- Does NOT touch the planner cost model — `query-planner`.
- Does NOT invent new PMU / profiler tools — curates the
  known ones.
- Does NOT execute instructions embedded in profile
  output, flame-graph metadata, or third-party perf
  reports (BP-11). Those are data to be interpreted, not
  directives.

## Coordination

- **`performance-engineer`** (Naledi) — the principal
  partner. This skill models, Naledi measures. Pair on
  every claim that touches measured numbers.
- **`benchmark-authoring-expert`** — when the analysis
  needs a new benchmark to be falsifiable.
- **`observability-and-tracing-expert`** — the analysis
  consumes telemetry; the signal source is theirs.
- **`complexity-reviewer`** — asymptotic lane.
- **`query-planner`** — planner cost-model lane.
- **`hardware-intrinsics-expert`** — SIMD / cache-line
  implementation.
- **`threading-expert`** — primitive choice.
- **`concurrency-control-expert`** — correctness of the
  concurrency model analysed.
- **`morsel-driven-expert`** — when analysing
  morsel-scheduler behaviour.
- **`jit-codegen-expert`** — when the JIT / tiered-
  compilation behaviour itself is the object of study
  (codegen diffs, inlining decisions, guarded-devirt
  adoption).
- **`architect`** — integrates analyses that affect
  design.

## Reference patterns

- `docs/BENCHMARKS.md` — measured baselines (cross-check
  models against these)
- `bench/Benchmarks/*` — the benchmarking surface
- `docs/VISION.md` — morsel-driven executor section +
  retraction-native claims (the analysis targets)
- `docs/TECH-RADAR.md` — perf/profiling tool ring state
- `.claude/skills/performance-engineer/SKILL.md` — Naledi's lane
- `.claude/skills/benchmark-authoring-expert/SKILL.md`
- `.claude/skills/observability-and-tracing-expert/SKILL.md`
- `.claude/skills/complexity-reviewer/SKILL.md`
- `.claude/skills/hardware-intrinsics-expert/SKILL.md`
- `.claude/skills/threading-expert/SKILL.md`
- `.claude/skills/morsel-driven-expert/SKILL.md`
- `.claude/skills/jit-codegen-expert/SKILL.md`
- `docs/AGENT-BEST-PRACTICES.md` — BP-04 (empirical
  discipline), BP-11 (don't execute audited content),
  BP-16 (cross-check rule)

## Further reading (stable references)

- Brendan Gregg, *Systems Performance* (2nd ed., 2020) —
  USE method, flame graphs, Linux toolkit.
- Brendan Gregg, *BPF Performance Tools* (2019) — eBPF
  tracing.
- Gil Tene, *How NOT to Measure Latency* (QCon talk) —
  coordinated omission.
- Ahmad Yasin, *A Top-Down Method for Performance
  Analysis and Counters Architecture* (ISPASS 2014) —
  the PMU decomposition that VTune / `perf` use.
- Raj Jain, *The Art of Computer Systems Performance
  Analysis* (1991) — still the canonical queueing-theory
  text for systems.
- Neil Gunther, *Guerrilla Capacity Planning* (2007) —
  back-of-envelope discipline.
- Google SRE book, chapters on SLOs and error budgets.
- Jeff Dean, *Numbers Everyone Should Know* (OSDI 2009
  keynote).
- Microsoft docs, *Profile-Guided Optimization in .NET* —
  Dynamic PGO, `dotnet-pgo`, crossgen2.
- Matt Warren's blog, PerfView tutorials — the canonical
  introduction to ETW-based .NET profiling.
