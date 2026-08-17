---
id: 081M087DVKF087G0R002DDHMPR
type: task
state: backlog
priority: P2
slug: chip-8-cross-run-superdeterministic-memo-store-persist-run-1
title: "CHIP-8 cross-run superdeterministic memo store: persist run-1 orbit results so run 2 can consult them"
created: 2026-08-17T16:03:44.879Z
depends_on: []
composes_with: []
---

# CHIP-8 cross-run superdeterministic memo store: persist run-1 orbit results so run 2 can consult them

Aaron 2026-08-17: *"we do this in our chip8 rooms where we can do superdeterministic calculations
based on one run and then save the results for future runs ... this is how we can let the 'future'
affect the past in a 2nd retrocausal way because the 1st run of the game all the way up until the end
can affect the start of the 2nd run of the game through superdeterministic calculations in chip8
memory space"* — and the scope limit in the same breath: *"other calculations may not be tractable,
it's a calculation-by-calculation basis."*

**Mirror register:** his words above, preserved. **Beacon register:** memoization of a deterministic
transition function over a finite state space (Michie 1968; eventual periodicity by pigeonhole; Brent
1980 for the `(mu, lambda)` detector). Nothing propagates backward in time.

`SoftChip8.lookAhead` already answers "where is this machine `n` steps from now" WITHIN a run. This
work item is the cross-run half: write run 1's trajectory down as text so run 2 can consult it.

## Shipped

- `src/Core/Chip8CrossRunStore.fs` — pure writer + reader + orbit walk + cycle reduction. Zero file IO
  (§13: the store is injected, never fetched). Errors are `Result<_, Feedback>`.
- `tests/Tests.FSharp/Chip8CrossRunStore.Tests.fs` — 20 tests; 7/7 mutations killed.
- `src/Core.TypeScript/chip9/chip8-cross-run-store.ts` (+ `.test.ts`) — TS reader/verifier parity that
  independently recomputes the F#-written body digest. 14 tests; 6/6 mutations killed.
- `db/emus/chip8/orbits/` — the committed artifacts for the five ROMs in `roms/chip8/`, plus a README.
- `docs/research/2026-08-17-chip8-cross-run-superdeterministic-memo-store-orbit-memoization-not-retrocausality.md`

## The two findings that shaped it

1. **`Rng` is a 2^64 counter carried inside the frame**, so a ROM executing `CXNN` in a loop cannot
   revisit a state until it wraps. Measured: no repeat in 10^6 steps. Aaron's "may not be tractable"
   is literally true here, so the artifact records a **verdict** (`closed` vs `open-at-bound`) rather
   than always a `(mu, lambda)` pair. Budget exhaustion is a distinct constructor from closure, which
   makes the silent promotion of a bound into a claim unrepresentable rather than merely discouraged.
2. **Three of the five ROMs' "fixed points" are not halts** — two are `FX0A` waiting for a key, which
   `Chip8Cow` models as a no-advance stall. The orbit did not end; the *deterministic segment* ended at
   an input branch. `terminalKind` distinguishes `halt` from `awaiting-input`.

## Deferred

Room-loop auto-consult, the IO adapter, Dark Hall browser injection, a TS writer, and branch
memoization: **081M089ZPAY087G0R001MYXM7N**.

