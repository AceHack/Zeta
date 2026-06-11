---
id: B-1035
title: The sim·mea·cut test framework — our own hexagonal test interfaces; xUnit demoted to host adapter; before/after boundary enforced ONCE (rooms inherit)
priority: P2
status: open
tier: verification-substrate
tags: [tests, sim-mea-cut, hexagonal, xunit, boundary, membrane, universal-port, migration]
created: 2026-06-11
owner: open (migrate little by little — Aaron's pacing, explicit)
---

# B-1035 — tests move to OUR loop, slowly (Aaron 2026-06-11, three beats verbatim)

> "We should try to move all our tests away from xUnit to our own interfaces — hexagonal, slowly,
> little by little — our simulate·measure·cut loop framework." / "This way we can be anal about
> BEFORE and AFTER tests in the test framework — tracking everything we need and enforcing the
> boundary." / "And every room won't have to do it itself."

## The shape (universal/port + the form test, applied to testing itself)

1. **The port we own:** `ITestLoop` (working name) — a test IS a sim·mea·cut declaration:
   `sim` (arrange: the seeded world — DST seed REQUIRED by the interface), `mea` (act+observe:
   measurements banked), `cut` (assert: the closure condition). Pure interfaces + default impls
   (the quartet); ZetaId-addressable per universal/port.
2. **xUnit = the HOST ADAPTER**, not the framework: a thin shim runs any ITestLoop under
   xUnit (one `[<Fact>]` per loop, discovered) so CI/IDE tooling keeps working day one. Other
   hosts later (the chip9 board running test cartridges IS one — tests-as-rooms).
3. **THE BOUNDARY, ENFORCED ONCE (the whole point):** before/after hooks live in the FRAMEWORK —
   every loop automatically gets: seed capture + replay line (DST), the determinism lint's
   ambient-entropy guard at runtime, fault-register assertions (a sim that faulted and didn't say
   so fails), golden-lock integration, red-light binding reports for any io the sim touched, and
   timing/budget metering (the 5-minute room law). Rooms and test files INHERIT all of it —
   nobody re-implements the membrane per room.
4. **Migration discipline:** little by little — new tests may use ITestLoop immediately; existing
   xUnit tests migrate opportunistically (when touched); NO big-bang rewrite; the suite stays
   green throughout. First slice: the interface + xUnit adapter + 3 migrated exemplar tests
   (one shape-acceptance loop, one DST replay loop, one io/red-light loop).
5. **RETICULUM-ONLY IO (Aaron, same stream, verbatim): "at no point do our tests need to
   interact with HDD or git or tools or anything other than Reticulum — for our framework, our
   simulation stuff. We will figure out HDD later, and it will force us to have cache loaded in
   the room at startup."** The framework's membrane has ONE door: the bus. No disk reads, no git
   calls, no tool spawns inside a loop — every dependency arrives IN the room before sim starts
   (the warm-cache forcing function: startup loads everything; the loop runs sealed). This makes
   the before/after boundary (item 3) trivially enforceable — any non-Reticulum syscall inside a
   loop is a violation the framework can detect, not a convention reviewers must catch. Disk is
   deferred ON PURPOSE: the constraint is the design tool. (Goldens/cartridges reach the room as
   startup cache or bus crossings, never as mid-test file reads — note this reshapes today's
   repoRoot()-based tests at migration time, which is exactly the point.)

6. Beacon: xUnit's own extensibility points (the adapter seam); JUnit's rules/extensions lineage
   (the before/after pattern we are centralizing); our SimLoop/rooms (the loop already exists as
   a runtime concept — this row makes TESTS instances of it).
