---
id: 081KTWFYCB108QG0R000R6DP13
type: task
state: in-progress
priority: P2
slug: the-ben-verb-benchmark-as-easy-as-measure-timing-memory-inje
title: "The ben verb — benchmark as easy as measure; timing/memory injected interfaces living with rooms/cartridges; GRADE the ComplexityRegistry's predictions"
created: 2026-06-11T23:23:00.000Z
depends_on: []
composes_with: []
---

# The ben verb — benchmark as easy as measure

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTWFYCB108QG0R000R6DP13-*.md` glob. -->

Migrated from the accidental legacy `B-1039` row so the item lives on the current
ZetaId workitem surface instead of extending the frozen sequential backlog.

Owner note: open; slice 2 of B-1035's framework; pairs with Naledi's bench lane.

Tags: benchmark, ben, sim-mea-cut, testloop, complexity, prediction, rooms, chip8, di-verbs,
hexagonal.

## Ben(chmark) joins the verb set

> "We should make ben(chmark) work as easy as measure — it's just injected: the extra interfaces
> or whatever we need. Timing tests and memory use and stuff that LIVE WITH the room/cartridges.
> We should see how good our PREDICTION is around this. For all our stuff — rooms in dotnet and
> the chip8 emu we have."

## The shape (the quartet, applied)

1. **`ben` is a VERB beside `sim·mea·cut`** — same static-DI wiring (B-1028 style): a room/test
   that wants metering declares the interface; the FRAMEWORK injects the meter (B-1035's
   before/after boundary already owns the rim — ben extends it with timing + allocation capture).
   Rooms inherit; nobody hand-rolls a stopwatch.
2. **Ambient honesty:** wall-time and GC counters are ambient entropy — they live ONLY at the
   boundary (the determinism lint's allowlisted-edge pattern; the double-run check ignores ben
   output by construction: metering never enters the measurement equality).
3. **The RED LIGHT on the meter:** a ben-bound room SHOWS it (`[REC ●] ben LIVE …`) — being timed
   is being observed; consent surface, same law as every io binding.
4. **THE PREDICTION GRADE (the new jewel):** ComplexityRegistry already DECLARES O(time)/O(space)
   per (artifact, op) — those are PREDICTIONS. ben runs the artifact at n, 2n, 4n; the growth
   ratios infer the empirical class; compare to the declared class → a per-artifact verdict:
   CONFIRMED / TIGHTER-THAN-DECLARED / **VIOLATED** (a violation = a priced bug: the WHY lied,
   same class as the spiral's court escape). The shelf-wide lint gains a brother: every Derived
   cost can graduate to MEASURED.
5. **Hexagonal seniors:** BenchmarkDotNet (.NET's senior bench oracle) as adapter B behind OUR
   port for the dotnet rooms (theirs calibrates ours' timer); the chip8 emu side needs no wall
   clock at all — its native meter is TICKS + Frame-map sizes (deterministic benchmarking:
   instruction counts are exact, replayable, DST-clean — the emu is the EASY case).
6. **Lives with the cartridge:** a `ben` line kind (budget + the declared class to grade against)
   so a cartridge ships its own performance expectations — and the gate can refuse a cartridge
   whose measured class violates its declared one.

Beacon: BenchmarkDotNet; Hoefler & Belli (SC '15, benchmarking rigor); our ComplexityRegistry
(the predictions) + Naledi's measure-before-proposing register. First slice: tick-count ben for
the chip8 emu (exact, no ambient) + ONE dotnet room through a BenchmarkDotNet-backed adapter +
the n/2n/4n grader over three registry rows.

## Progress, slice 1, 2026-06-11

Ben.fs SHIPS — the exact chip8 tick meter
(Steps/MemEntries/DisplayLit/Extra/StackDepth/Faulted, deterministic) + the GRADER
(infer doubling-ratio growth class; grade = Confirmed/Tighter/Violated). Two REAL predictions
graded CONFIRMED with exact cost proxies (treemap tiles = O(children); IBLT build work = n·k via
the table's own count sum); falsifiers prove Violated/Tighter/refusal. Dogfooded through
ITestLoop. Remaining: dotnet wall/alloc meters behind the boundary + red light; BenchmarkDotNet
senior adapter; the cartridge `ben` line kind + gate refusal.

## Progress 2 (2026-06-11): the math team's critique APPLIED — infer rewritten to log₂-log₂ OLS slope + R² ≥ 0.99 + minimum-span (≥8×) + band-gap REFUSAL (n^1.5 returns None — no fabricated bugs) + Loglinear class; Tighter advisory below 32× span; Violated bug-grade criteria documented. Their tautology note on the slice-1 proxies stands: the treemap/IBLT grades validate the GRADER PIPELINE on exact cardinality, not the time column — true time grading needs the alloc/instruction meters. The deterministic APM answer landed: Ben.allocBytes (GC.GetAllocatedBytesForCurrentThread — exact, warmup-gated, replay-equal, tested); wall time stays statistical (BenchmarkDotNet senior lane; EventPipe/dotnet-trace/PerfView = offline lane). Search-by-O landed in ComplexityRegistry (parseO degree+logs; searchTimeAtMost/searchSpaceAtMost; unsearchable() keeps blind spots visible).

## Progress 3 (2026-06-11) — pro(file) joins the verbs; THE VACUUM MODEL

Aaron: "now lets have ben and pro(file) and all in our framework — air tight, vacuum tight, only
memory and index loaded into memory, in our MUMPS; if cached you get it."

`pro` is the verb set's next member (sim·mea·cut·ben·pro), and the architecture falls out of the
B-1035 sealed-room clause: **the room stays vacuum-tight; profilers watch THROUGH THE GLASS.**
EventPipe is out-of-process by design — `dotnet-trace`/`dotnet-counters` attach from OUTSIDE the
seal without injecting a syscall into the loop, so Reticulum-only IO survives profiling
(observation without contamination; the red light still names the watcher). INSIDE the vacuum,
only the deterministic meters run: `chip8Ticks` and `allocBytes` (replay-equal, double-run
checked). THE MUMPS REGISTER (Aaron's anchor): M's globals ARE the database — memory-resident,
index + data as one sparse tree, no file door at query time. Our warm-cache-at-startup clause
(B-1035, Reticulum-only IO) is that discipline by another name — memory + index loaded at room
boot, then the loop runs sealed; "if cached, you get it." Our Map-keyed frames/ledgers already
have the globals shape.

Beacon: MUMPS/M (Octo Barnett & Neil Pappalardo, Massachusetts General Hospital, 1966; ANSI
X11.1-1977) — the memory-mapped hierarchical-global lineage; .NET EventPipe (out-of-process
tracing, the diagnostics-IPC design) — observation that never enters the observed process's
code path.

## Progress 4 (2026-06-11) — the cartridge `ben` line + gate refusal SHIP

A room now states its own cost prediction in-file: `ben	draw	shape.dynamicvalue	O(children)`
(kind=ben, name=operation, fields=[artifact; predicted time O]). `ComplexityRegistry.benCheck`
cross-checks the in-file claim against the registry — an unparseable O, a missing registry row, or
a prediction that DISAGREES with the registry's declared time all REFUSE; the shelf sweep in
ShapeAcceptance.Tests gates every cartridge the moment it lands (same blade as THE GOLDEN LOCK).
`ben` joined MediaLines knownKinds (the near-miss lint had rightly flagged it as one letter from
`gen`) + a structural lint (artifact + predicted O required). softvalue/dynamicvalue/triboolean
carry the first three lines. Runtime grading (Confirmed/Tighter/Violated) stays Ben.grade's lane;
remaining: dotnet wall/alloc-statistical meters behind the boundary + red light; the BenchmarkDotNet
senior adapter; the pro verb's out-of-process EventPipe lane (Progress 3).
