---
id: B-1039
title: The ben verb — benchmark as easy as measure; timing/memory injected interfaces living with rooms/cartridges; GRADE the ComplexityRegistry's predictions
priority: P2
status: open
tier: verification-substrate
tags: [benchmark, ben, sim-mea-cut, testloop, complexity, prediction, rooms, chip8, di-verbs, hexagonal]
created: 2026-06-11
owner: open (slice 2 of B-1035's framework; pairs with Naledi's bench lane)
---

# B-1039 — ben(chmark) joins the verb set (Aaron 2026-06-11, verbatim spine)

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
