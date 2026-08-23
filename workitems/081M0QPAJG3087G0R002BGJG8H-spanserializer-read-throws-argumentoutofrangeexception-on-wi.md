---
id: 081M0QPAJG3087G0R002BGJG8H
type: bug
state: backlog
priority: P2
slug: spanserializer-read-throws-argumentoutofrangeexception-on-wi
title: "SpanSerializer.Read throws ArgumentOutOfRangeException on windows-2025 under the full suite — mechanism unknown"
created: 2026-08-23T16:12:42.371Z
depends_on: []
composes_with: []
---

# SpanSerializer.Read throws ArgumentOutOfRangeException on windows-2025 under the full suite — mechanism unknown

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QPAJG3087G0R002BGJG8H-*.md` glob. -->

## The observation (measured, not inferred)

`Zeta.Tests.Storage.SpanSerializerTests."single-entry Z-set round-trips with
positive weight"` threw `System.ArgumentOutOfRangeException :
Arg_ArgumentOutOfRangeException` at `src/Core/Serializer.fs:70` on
**windows-2025**, gate run **32646515868**, job **97211695103**, head
`4ac632b8f75b2333d46a7f3c4382c34809f4372e`, 2026-08-23T15:00:19Z.

Facts read off that log, not reasoned about:

- It was the **only** failing test in the run. The 3-entry and 100-entry
  round-trip tests in the same class **passed** in that same execution.
- `windows-11-arm` passed the same commit.
- The test took 5 ms; the assembly was ~93 s into a `dotnet test Zeta.sln`
  with several test hosts running concurrently on a 4-CPU runner.

## Rate, measured over 120 gate runs on `main`

2026-08-22T01:49Z → 2026-08-23T15:50Z (~38 h):

| leg | concluded | failures |
|---|---|---|
| `build-and-test (windows-2025)` | 69 | **2** |
| `build-and-test (windows-11-arm)` | 69 | 0 |

The two windows-2025 failures are this one and run 32649813169, which is an
external network failure (`scoop install qemu` — `qemu.weilnetz.de` refused the
connection in `tools/setup/install.ps1`), not a product defect. So the
`continue-on-error` Windows lane is currently absorbing **one** product failure:
this one.

## What has been ruled OUT (each by a measurement, not by reading)

1. **Single-threaded arithmetic.** `Write` derives the 4-byte count header and
   the payload length from the SAME `ReadOnlySpan` local, so the header and the
   payload can never disagree by construction. The test's writer is a fresh
   `System.Buffers.ArrayBufferWriter<byte>` — GC-allocated, not pooled, not
   shared with anything.
2. **The buffer-pool hypothesis (a shared pool mutated concurrently).** Audited
   every `Pool.Freeze` call site in `src/Core` (16 of them): none freezes a
   RENTED array. `ZSet.ofSeq` rents, fills, `Pool.FreezeSlice` (which allocates
   exact and copies) and only then returns the buffer — the ownership contract
   in `Pool.fs` holds at every site. The one site that looked suspicious,
   `Shard.fs:178`, freezes a `Pool.AllocateExact` buffer, not the rented one
   nearby. Note also that a pool race would corrupt entry CONTENT, not the count
   header, so it cannot produce this exception shape.
3. **Concurrency in the serializer path itself.** A direct stress harness
   (`ZSet.ofSeq` → `Write` → wire-invariant check → `Read`, plus `ArrayPool`
   churn on the same `ZEntry<int64>` pool) ran **~250 M round-trips** across
   8–16 threads on macOS arm64 in four configurations — default, `gcServer=1`,
   `TieredCompilation=0` (JIT straight to full opt), and `JitStress=2` — with
   **zero** invariant breaks.

## Direct reproduction attempt ON windows-2025 (the failing platform)

A throwaway branch (`diag/spanserializer-windows-repro`, run 32650672659, job
97221646468) built the solution with the gate's own command on windows-2025 and
then:

1. **Targeted stress**, the serializer path alone: 8 threads × 60 s,
   `ServerGC=true`, 4 vCPU — **41,543,447 round-trips, 0 invariant breaks**.
2. **Twelve consecutive full-solution `dotnet test Zeta.sln` runs**, each carrying
   an added 200,000-iteration in-suite round-trip test (2.4 M more round-trips
   inside the real suite, under the real parallelism) — **0 SpanSerializer
   failures, the invariant test passed 12/12**.

**Not reproduced.** ~44 M round-trips on the exact platform and 12 full-suite
executions did not produce it, against an observed field rate of ~1 in 35 legs.

Side observation from that loop, worth knowing but not a product defect: from the
second iteration onward, 506 `Zeta.Tests.Git.*` tests fail with
`UnauthorizedAccessException` deleting their temp repo directories. Running the
suite REPEATEDLY IN PLACE on Windows is not idempotent — the previous iteration's
git objects are still locked/read-only. It never bites the gate, which runs the
suite once per job.

## What is still OPEN

For the exception to fire, the count in the header must disagree with the bytes
that follow it — and nothing in the single-threaded path can produce that. So
the live candidates are all *below* the F#: memory written by a neighbour, or a
codegen difference on windows-x64 (`TieredPGO` + `ServerGarbageCollection` are
both on repo-wide in `Directory.Build.props`, and in the full suite this method
is hot enough to be tier-1 rejitted, which it never is in isolation — that is
the one difference between "full suite" and "runs alone" that is not
scheduling).

**Not reproduced.** Do not close this on a streak of green.

## What shipped alongside (and what it does NOT claim)

- `SpanSerializer.Read` and `TlvSerializer.Read` now validate the wire-supplied
  count before slicing/allocating, and fail closed with a message naming both
  numbers. The next occurrence therefore carries its own evidence instead of a
  parameterless `Arg_ArgumentOutOfRangeException`. **This is diagnosis, not a
  fix** — if the count is being corrupted, it will still be corrupted.
- `SpanSerializer.Tests.fs` checks the wire invariant between `Write` and `Read`
  and dumps `srcCount / header / written / hex` when it breaks.

## Next step when this fires again

The message will say whether the header was wrong (`hdr <> srcCount` — corruption
before/at write) or the buffer was short (`written <> 4 + hdr*16` — corruption of
the writer's own bookkeeping). Those point at different mechanisms; today we
cannot tell them apart, which is why the guard went in.
