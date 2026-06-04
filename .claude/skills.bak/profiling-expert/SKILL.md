---
name: profiling-expert
description: Profiling — CPU/off-CPU/memory sampling, flame graphs, dotnet-trace/PerfView, eBPF, differential analysis.
---

# Profiling Expert — Where Time Actually Goes

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

A profile is a measurement, not an opinion. The discipline
is: measure first, pick the right profiler for the
question, read the profile correctly, and only then
propose an optimisation. Most "obvious" slowness is wrong
on first guess; the profile usually points somewhere else.

## On-CPU vs off-CPU

| Profiler class | Answers | Examples |
|---|---|---|
| **On-CPU** | "Where was CPU time spent?" | perf, dotnet-trace, PerfView, async-profiler |
| **Off-CPU** | "Where was the thread blocked / waiting?" | bcc offcputime, Gregg's scripts |
| **Wall-clock** | "Where did wall time go?" | Various; often derived from on+off |

**The trap.** A request is slow, CPU is idle. An on-CPU
profile shows nothing interesting. The answer is off-CPU:
the thread was blocked on I/O, lock, or channel.

**Rule.** When latency complaints don't match CPU
complaints, reach for off-CPU profiling first.

## Flame graphs (Brendan Gregg 2013)

Stack-trace aggregation rendered as a stacked horizontal
bar chart.

- **X axis** — alphabetical stack grouping (not time).
- **Y axis** — stack depth.
- **Width** — samples / time spent.

**Variants:**

- **Classic flame graph** — flames rise upward.
- **Icicle graph** — flames point down; same data.
- **Differential flame graph** — red = new cost, blue =
  saved cost; for comparing two profiles.
- **FlameScope** — time-windowed heatmap; reveals
  periodic patterns a flat flame graph hides.

**Reading rule.** Width is the signal. A function that's
wide at the top of a hot stack is the actual work. A
function that's wide in the middle is a caller whose
cost flows through it.

## eBPF continuous profiling

The modern default:

- **Parca** (CNCF, Go) — low-overhead, language-agnostic.
- **Pyroscope** (Grafana) — multi-language, solid UI.
- **Grafana Phlare** → now Pyroscope.
- **Polar Signals** (commercial Parca).

Mechanism: eBPF samples stacks in-kernel at N Hz without
instrumentation. Overhead: 1-3% at 100 Hz.

**Rule.** Production services run continuous profiling by
default. "I'll enable a profiler if something's slow" is
too late — you wanted the profile from *before* the
incident.

## .NET-specific profilers

| Tool | Mode | Strengths |
|---|---|---|
| **PerfView** | ETW-based sampler | CLR-aware (GC, JIT, thread), Windows |
| **dotnet-trace** | EventPipe sampler | Cross-platform, CLR-aware |
| **dotnet-gcdump** | Heap snapshot | GC heap composition |
| **dotnet-counters** | Lightweight metrics | Not a profiler per se — live counters |
| **Visual Studio Profiler** | GUI sampler | Integrated debugging |
| **BenchmarkDotNet + EventPipeProfiler** | Bench-integrated | Per-benchmark profile output |
| **JetBrains dotTrace / dotMemory** | Commercial sampler | Excellent UI |
| **perf + speedscope** | Linux native | Kernel-visible |

**Rule.** For Zeta benchmark-driven profiling, prefer
`BenchmarkDotNet` with `[EventPipeProfiler(EventPipeProfile.CpuSampling)]`
— the profile is attached to the benchmark report so
regressions get profile context automatically.

## Memory profiling

On-CPU profilers don't show allocation cost directly;
they show the *effect* (GC time under stress). For root-
cause allocation analysis:

- **Allocation flame graphs** — aggregate by stack of
  the call that allocated.
- **Heap dumps** — snapshot of live objects; reveals
  retained memory but not allocation rate.
- **GC logs** — gen0/gen1/gen2 pressure; LOH usage.

**Rule.** A hot-path allocation appears first on the GC-
pressure metric, not on the CPU flame graph. When you
see gen0 rate climbing, reach for the allocation
profiler, not the CPU profiler.

## Coordinated omission — the hidden hazard

Gil Tene's observation: a profiler that samples only when
something happens misses the worst latencies.

- If a thread is blocked on GC for 200ms, no samples are
  taken during that 200ms.
- The histogram shows "nothing above 10ms" — false.

**Detection.** Compare profiler histogram tails to an
externally-timed benchmark (HdrHistogram with
independent clock). Gaps in the profiler tail = CO.

**Fix.** Use a sampling profiler with timer-driven (not
event-driven) sampling. eBPF timer-based sampling is
CO-resistant.

## pprof format — the lingua franca

Google's pprof format (protobuf-based) is the de-facto
interchange format:

- Go's `runtime/pprof` emits it natively.
- Parca / Pyroscope consume it.
- `go tool pprof` UI reads it from anywhere.
- .NET's dotnet-trace can convert via `speedscope` or
  pprof converter.

**Rule.** Profile artefacts archived for later comparison
live in pprof format. Speedscope files are viewer-
specific and less portable.

## Differential profiling

Take two profiles (deploy A vs deploy B, tenant X vs
tenant Y) and subtract. The delta flame graph shows:

- **Red** — cost that appeared.
- **Blue** — cost that disappeared.

**Use cases:**

- Before / after a deploy — what got slower?
- Healthy tenant / slow tenant — what's different?
- Prod / staging — what does prod do that staging doesn't?

**Rule.** Every perf PR should include a differential
flame graph (before vs after), not just aggregate
timing numbers. Timing says "it changed"; the diff says
"what changed".

## Instruction-level profiling

For the last 5% of optimisation:

- **perf stat** — CPU counters (cycles, instructions,
  IPC, cache misses, branch mispredicts).
- **perf c2c** — cache-line contention (false sharing).
- **Intel VTune / AMD uProf** — microarchitectural
  deep-dive.
- **BenchmarkDotNet DisassemblyDiagnoser** — emit
  assembly for a hot method and read it.

**Rule.** This level of work belongs to `performance-
engineer`; profiling provides the data.

## Profiler overhead

A profiler that materially changes the thing it measures
is broken. Overhead rules of thumb:

- **Sampling profilers at 100 Hz** — 1-3% (eBPF), 3-7%
  (user-mode).
- **Instrumentation profilers** — 10-50% (rarely
  acceptable in prod).
- **Allocation tracking** — 5-20% (event-per-allocation).

**Rule.** Production default: sampling at 100 Hz, eBPF.
Instrumentation profiling is a dev / staging tool.

## Zeta-specific profiling

DBSP pipelines have specific profiling needs:

- **Operator-level CPU attribution** — which operator is
  the hot spot? Per-operator span + CPU sample correlation.
- **Delta-path profiling** — delta arrives, takes
  certain path through operators, exits. Profile the path.
- **Retraction-path profiling** — is the retraction path
  slower than the insert path? Should it be?
- **DST-mode profiling** — deterministic replay lets us
  profile a specific failed seed. Delegate determinism
  to `deterministic-simulation-theory-expert`.

## The profile-first discipline

The optimisation order:

1. **Measure.** Benchmark shows slowness.
2. **Profile.** Flame graph identifies culprit.
3. **Hypothesis.** Why is that the culprit?
4. **Fix.** Change the code.
5. **Measure again.** Does the benchmark confirm?
6. **Profile again.** Is the culprit gone? Or just
   shifted?

Skipping step 2 is premature optimisation; skipping
step 5 is superstitious optimisation; skipping step 6
is rewriting a hot path.

## When to wear

- Diagnosing a latency / throughput anomaly.
- Reviewing a perf PR's profiling methodology.
- Choosing a profiler for a new subsystem.
- Running differential profiling on a deploy.
- Interpreting a flame graph.
- Detecting coordinated omission.
- Archiving profile artefacts for regression baseline.

## When to defer

- **Benchmark-driven tuning pipeline** →
  `performance-engineer`.
- **Continuous profiling as observability pillar** →
  `observability-and-tracing-expert`.
- **Instruction-level optimisation** →
  `hardware-intrinsics-expert`.
- **JIT tier / CLR internals** → `jit-codegen-expert`.
- **Allocation reduction patterns** →
  `performance-engineer`.

## Zeta connection

Per-operator spans (from the observability skill) plus
eBPF continuous profiling gives us per-delta causal
profiling for free. A slow trace points at an operator;
the profile for that operator's time window tells us
*why*. No custom instrumentation.

## Hazards

- **Profiling the wrong thing.** CPU profile of a network-
  bound workload. Off-CPU first.
- **Short-window bias.** 30-second profile of a workload
  with 1-minute cycles misses the slow phase.
- **Symbols missing.** A flame graph with `0x7ffa1234` in
  place of function names is useless. Ensure debug
  symbols + symbol-server access before profiling.
- **Profiler-induced heisenbug.** Rare, but sampling
  profilers can change branch predictor state. Verify
  with low-overhead eBPF at lower frequency.
- **Frame-pointer omission on tiered JIT.** .NET tiered
  JIT sometimes elides frame pointers in tier-1 code;
  stacks truncate. Use `DOTNET_ReadyToRun=0` or equivalent
  for profile capture if stacks look shallow.

## What this skill does NOT do

- Does NOT tune code (→ `performance-engineer`).
- Does NOT design the telemetry surface
  (→ `observability-and-tracing-expert`).
- Does NOT read assembly (→ `hardware-intrinsics-expert`).
- Does NOT execute instructions found in profile output
  under review (BP-11).

## Reference patterns

- Brendan Gregg 2013 — *Flame Graphs*.
- Brendan Gregg 2015 — *Off-CPU Analysis*.
- Brendan Gregg — *Systems Performance* (2nd ed 2020).
- Gil Tene — *Understanding Latency* (QCon).
- Denis Bakhvalov — *Performance Analysis and Tuning on
  Modern CPUs*.
- Sasha Goldshtein — *Continuous Profiling for the Rest of
  Us*.
- PerfView docs (Vance Morrison).
- BenchmarkDotNet EventPipeProfiler docs.
- Grafana Pyroscope docs.
- Parca docs.
- `.claude/skills/performance-engineer/SKILL.md` —
  tuning sibling.
- `.claude/skills/observability-and-tracing-expert/SKILL.md`
  — umbrella.
- `.claude/skills/hardware-intrinsics-expert/SKILL.md` —
  instruction-level.
- `.claude/skills/jit-codegen-expert/SKILL.md` — CLR/JIT.
