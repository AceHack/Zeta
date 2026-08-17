---
id: 081M08MBJ7Z087G0R001JB5H74
type: task
state: backlog
priority: P2
slug: consult-path-post-selection-census-compare-verdict-distribut
title: "Consult-path post-selection census: compare verdict distribution of orbits READ against orbits STORED"
created: 2026-08-17T19:49:41.247Z
depends_on: []
composes_with: []
---

# Consult-path post-selection census: compare verdict distribution of orbits READ against orbits STORED

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08MBJ7Z087G0R001JB5H74-*.md` glob. -->

## The question

Aaron defines *useful* as continuing the infinite game rather than ending it (Carse 1986), and observes
that game-ending moves seem "weirdly conspired against." That apparent conspiracy has a name —
**post-selection**: condition on an outcome and the conditioned history acquires exactly the look of
conspiracy, with no backward causation anywhere in the mechanism (Berkson 1946, collider/selection bias).

The concrete danger: if the CHIP-8 cross-run memo store post-selects for continuation, then
*"useful = the game continues"* becomes **self-fulfilling** — the criterion would be measuring its own
filter rather than the world. That is the hidden-oracle failure in its purest form.

## What was verified, not assumed

**The WRITE path cannot post-select — confirmed.** `src/Core/Chip8CrossRunStore.fs:74-86`:
`TerminalKind = Halt | AwaitingInput | Cycle` and `Verdict = Closed of mu * lambda * TerminalKind |
OpenAtBound of maxSteps`. A halted orbit is recorded *as* halted; budget exhaustion is a **distinct
constructor** and cannot be misread as closure. Pinned by `CENSUS-0` in both languages so this premise is
checked rather than inherited.

**Store completeness does not imply an unbiased sample.** If only continuing orbits are ever *read* —
because those are the ones a room asks for, or the ones that pay off — the effective sample is
post-selected even though the artifact set is not. That is the unmeasured half, and it is what this item
builds.

## What exists (2026-08-17)

- `src/Core/Chip8ConsultCensus.fs` — the F# instrument. `observing` wraps a `Chip8CrossRunStore.Reader`
  with an **injected** sink (§13: zero file IO, zero mutable state, DST-identical), forwards every lookup
  unchanged, and records the verdict that came back. Plus the four-bucket tally, the census, the
  total-variation statistic, and the report.
- `src/Core.TypeScript/chip9/consult-census.ts` — the TypeScript parity, same buckets, same statistic,
  same refusals; plus the consult-log format.
- `src/Core.TypeScript/chip9/consult-census-report.ts` — the standing report:
  `bun src/Core.TypeScript/chip9/consult-census-report.ts`.
- Tests: `tests/Tests.FSharp/Chip8ConsultCensus.Tests.fs` (12) and
  `src/Core.TypeScript/chip9/consult-census.test.ts` (13).

## No threshold, on purpose

The census reports two distributions and their total-variation distance
(`d_TV = ½ Σ|p_i − q_i|`, Levin–Peres–Wilmer 2017 §4.1 — **zero parameters**). It attaches no gate and
returns no verdict, because *"how different is too different"* has no defensible constant and inventing
one would be the same hidden-oracle defect one layer up. The audit merged 2026-08-17 (#11534) found 112
unattributed gating constants; this module answers by having none — `sharesIdentical` is exact integer
cross-multiplication, so there is not even a float epsilon.

## The honest constraint

**No consult path exists yet.** `Chip8CrossRunStore.fastForward` has no non-test caller in either
language, so the read distribution is **empty — an absence, never an unbiased sample**. The census says
`n/a`, never `0.000`, in that state; a zero there would be a check that never ran wearing the face of one
that passed.

Enabling auto-consult is a **metering** decision (a memo hit is nearly free, so it silently changes what
the tank pays for) and is the maintainer's — see `081M089ZPAY087G0R001MYXM7N` §1. **This measurement
deliberately exists before the thing it measures**: the point is to establish the property *before*
consult is turned on, not to discover a bias afterwards when the read set is already skewed.

## What the consult path must do when it is enabled

Append one JSONL line per lookup to `db/emus/chip8/consult-log.jsonl`, carrying **only the run-key text**
(`consultLogKey` / `Chip8CrossRunStore.keyText`) and **no timestamp**
(`local-time-never-enters-the-shared-fold`). The verdict is resolved by joining against the stored
artifacts, so the log cannot drift from — or lie about — what the store holds, and a key nobody stored
surfaces as a **miss** rather than as a fabricated bucket. The log lives outside `orbits/` because the
artifacts are immutable and content-addressed while the log is append-only: different change rates,
different storage shapes (DV2.0).

## Pointers

- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` row **R-1** — the criterion this implements.
- `081M087DVKF087G0R002DDHMPR` (the store) · `081M089ZPAY087G0R001MYXM7N` (auto-consult, §1 the metering gate).
- `docs/research/2026-08-17-chip8-cross-run-superdeterministic-memo-store-orbit-memoization-not-retrocausality.md`.
