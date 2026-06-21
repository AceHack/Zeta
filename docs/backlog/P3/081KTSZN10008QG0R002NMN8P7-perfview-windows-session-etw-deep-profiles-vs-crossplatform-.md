---
id: 081KTSZN10008QG0R002NMN8P7
title: PerfView session on Windows (Aaron) — ETW deep profiles for the dotnet rooms; cross-platform lane = dotnet-trace/EventPipe + TraceEvent
priority: P3
status: open
tier: verification-substrate
tags: [perfview, etw, eventpipe, dotnet-trace, profiling, ben, windows]
created: 2026-06-11
owner: Aaron ("I'll do it next time I'm on Windows")
---

# 081KTSZN10008QG0R002NMN8P7 — the PerfView lane (081KTSZN10008QG0R001F0B5A6's offline-profiling sibling)

The platform facts (Aaron asked): **PerfView the GUI/analyzer is Windows-only** (ETW + .NET
Framework). But its ENGINE is not: `Microsoft.Diagnostics.Tracing.TraceEvent` (the library
PerfView is built on) parses EventPipe traces CROSS-PLATFORM — and collection is cross-platform
via `dotnet-trace` (EventPipe works on macOS/Linux; traces open in PerfView on Windows, or in
SpeedScope/Chrome tracing anywhere). So the lane splits honestly:

- **macOS/Linux (the factory's daily lane):** dotnet-trace collect + dotnet-counters +
  dotnet-gcdump; analyze with TraceEvent or SpeedScope. Deterministic meters stay Ben's
  (ticks + allocBytes); these traces are the STATISTICAL layer.
- **Windows (Aaron's session):** full ETW via PerfView — CPU stacks, GC heap, contention — the
  deepest free profiler .NET has. Targets when he sits down: the chip8 step loop, ZSet
  consolidate, the BP message pass (the rooms most worth a flamegraph).
- Aaron remembered right: the skill EXISTS in this repo —
  `.claude/skills/performance-and-runtime-ops/` (profiling-expert + performance-analysis-expert
  blueprints carry the PerfView procedure). His Windows session uses it as-is.
