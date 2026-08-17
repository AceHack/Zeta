# `db/emus/chip8/orbits/` — memoized orbits of `Chip8Cow.step`

One text artifact per **run key** (`romSha256 ⊕ seed ⊕ loadAddr ⊕ dialect ⊕ stepMapVersion`). Run 1
computes a ROM's deterministic trajectory; the result is written here; run 2 *consults* it instead of
recomputing. Written by `src/Core/Chip8CrossRunStore.fs`; read by that module and by the TypeScript
parity reader `src/Core.TypeScript/chip9/chip8-cross-run-store.ts`.

## Register (read this before writing about these files)

Aaron's framing is that run 1 "can affect the start of the 2nd run" in a *"2nd retrocausal way"* — the
**Mirror** register, quoted in full in the design doc. The **Beacon** register is **memoization of a
deterministic transition function over a finite state space**. Nothing propagates backward in time.
The interesting property is real but ordinary: a *finite* description (`μ`, `λ`, a few snapshots) can
answer questions about an *unbounded* future.

- Michie, *"Memo functions and machine learning"*, Nature **218**, 19–22 (1968) — the memo table.
- Eventual periodicity: any `f : S → S` on finite `S` has `f^(μ+λ)(s₀) = f^μ(s₀)` with `μ + λ ≤ |S|`
  (pigeonhole + determinism) — the "rho" shape.
- Brent, *"An improved Monte Carlo factorization algorithm"*, BIT **20**, 176–184 (1980) §7 — the
  `(μ, λ)` detector.

## Why text, and why these are not golden vectors

All state is hex-in-JSON per `.claude/rules/no-binary-in-proof-lineage.md`: a 4096-byte memory dump is
exactly the tempting binary blob that rule forbids, so memory is stored as sparse `addr:byte` hex pairs
and every scalar as hex. Each file is diffable and mergeable in a `git` diff.

These artifacts are **caches, not proofs**. Deleting the directory loses only recomputable work; the
tests do not read from it. What makes a cache safe to trust is the `bodyDigest` — the reader
recomputes it and **refuses** a mismatch, in both languages.

## Reading a file

| field | meaning |
|---|---|
| `key` | content-derived run identity. No wall clock, no counter, no path (`local-time-never-enters-the-shared-fold`). |
| `budget.maxSteps` / `budget.attribution` | the bound that produced this result **and who set it**. An unattributed bound is refused before any work runs. |
| `verdict` | `closed` (a cycle was **observed**) or `open-at-bound` (the walk hit the bound). **Never conflate these.** |
| `mu` / `lambda` | tail and cycle length, under `closed` only. |
| `terminalKind` | `cycle` · `halt` · **`awaiting-input`** — an `FX0A` stall is a fixed point of the pure step map, not a halt. |
| `checkpoints[]` | `step`, `stateDigest`, and a canonical `snapshot`. |
| `bodyDigest` | SHA-256 over the canonical body; the reader's refusal test. |

**`open-at-bound` is the honest verdict, not a failure.** `Chip8Cow`'s `Rng` is a 2^64 additive counter
carried inside the frame, so a ROM executing `CXNN` in a loop cannot revisit a state until that counter
wraps — measured: no repeat in 10^6 steps. A reader asked for a step beyond an open orbit's recorded
prefix **refuses**; answering would promote the precompute budget into a claim about the machine.

## Committed artifacts (seed 0, the ROMs in `roms/chip8/`)

| ROM | μ | λ | terminal |
|---|---|---|---|
| `zeta-selfloop.ch8` | 0 | 1 | halt |
| `zeta-arith.ch8` | 3 | 5 | cycle |
| `zeta-draw-h.ch8` | 4 | 1 | halt |
| `mikolay-delay-timer-test.ch8` | 16 | 1 | awaiting-input |
| `mikolay-random-number-test.ch8` | 15 | 1 | awaiting-input |

Regenerate: `Chip8CrossRunStore.precompute` with an attributed budget; the filename is
`artifactFileName key`, so a rewrite is an upsert of identical bytes (idempotency #6).

## Pointers

- `docs/research/2026-08-17-chip8-cross-run-superdeterministic-memo-store-orbit-memoization-not-retrocausality.md`
- `src/Core/Chip8CrossRunStore.fs` · `tests/Tests.FSharp/Chip8CrossRunStore.Tests.fs`
- `src/Core.TypeScript/chip9/chip8-cross-run-store.ts` (+ `.test.ts`) — the TS reader/verifier parity
- `src/Core/SoftChip8.fs` — `lookAhead`, the *within-run* half this completes
