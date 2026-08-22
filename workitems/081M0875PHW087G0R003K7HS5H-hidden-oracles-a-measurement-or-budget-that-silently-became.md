---
id: 081M0875PHW087G0R003K7HS5H
type: task
state: backlog
priority: P2
slug: hidden-oracles-a-measurement-or-budget-that-silently-became
title: "Hidden oracles: a measurement or budget that silently became the thing deferred to"
created: 2026-08-17T15:59:17.564Z
depends_on: []
composes_with: []
---

# Hidden oracles: a measurement or budget that silently became the thing deferred to

Aaron 2026-08-17, on the `--min-age-min 20` triage:

> "this is a good audit, a hidden oracle, we should always be on the lookout where the
> measurement or the limit/budget becomes the oracle silently, we don't want to do this
> by accident, this is accidental hierarchy or control"

## The defect class

A **hidden oracle** is a measurement, limit, threshold, or budget that has silently
become the thing being deferred to. Nobody granted it authority; it acquired authority
because a number had to be picked and the picked number now decides outcomes.

It is the §11 Multi-Oracle Principle failing quietly. Per
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`, deference you can route
around is an **oracle** (chosen) and deference you cannot is a **hub** (enforced) — and a
hidden oracle fails that exit test *without anyone noticing*, because nobody knew there
was a choice to make. Per
`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`, the mechanism is supposed
to report the fact and let the caller's oracle attach the meaning; a hidden oracle is a
mechanism that quietly attached the meaning itself.

## The discriminator is ATTRIBUTION, not existence

A budget is not a defect. Manifesto §4 requires bounds and `SimLoop` states the principle
outright ("no one gets to run for infinity"). What separates a policy dial from a hidden
oracle is whether anyone chose the value **on the record**.

The positive control is `MAX_GRANT_SPAN_PHASES = 65536` in
`src/Core.TypeScript/key-custody/key-custody.ts`, which documents itself as *"adopted
rather than independently chosen … a policy dial and remains the maintainer's to
retune"*. That names who holds the authority, so the authority is not hidden.

The canonical negative is `required-check-started.ts --min-age-min 20`: gate start latency
is ~28 min, so 20 was not measuring "stalled", it was *defining* it — three false
positives (#11387 / #11389 / #11401) against one true positive (#11369). **The fix in
#11445 is the shape worth copying: the cure was to replace the number with a fact** (run
existence became the discriminator).

## Shipped here

`src/Core.TypeScript/hygiene/audit-hidden-oracles.ts` (+ `.test.ts`) — a detector for
numeric constants that (a) gate an outcome and (b) carry no attribution for their value,
plus the same test applied to `*.baseline.json` debt ledgers.

Findings are **reported, not enforced**. Turning an untriaged inventory of unattributed
numbers into a merge gate would install the audit as the very thing it detects.

### The detector's own thresholds, and why none of them is a dial

A hidden-oracle detector containing a hidden oracle is the joke that writes itself. Every
decision inside it is a **category judgement** with no number to turn:

| decision | how it avoids a dial |
|---|---|
| attribution window | the contiguous comment block above the declaration, the trailing comment, and any comment naming the identifier — **no line distance** |
| gating evidence | appears in **at least one** relational comparison — the non-vacuity boundary, not a tuned count |
| verdict tier | the gating line, or the **immediately following non-blank line**, hard-fails — not "within N lines" |
| liveness floor | 1, for the reason already on file in `audit-scan-floor-routes.ts`: one is the only value that is not a guess |
| ranking | ordinal tiers derived from the exit test (Hirschman 1970) — no weights, no score |
| `BUDGET_WORDS` / `ATTRIBUTION_MARKERS` | enumerable rosters with per-entry justification — a declared scope, not a tuned parameter |

### Measured (2026-08-17, mutation both directions on real repo files)

- **Sensitivity 14/14** — strip the attribution comments off every constant that currently
  passes, and every one of them flags.
- **Specificity 110/110** — inject a provenance comment above every constant that currently
  flags, and every one of them goes quiet.
- Corpus: 3,125 files, 124 gating numeric constants, 110 unattributed, 14 attributed.

Two real detector bugs were found by reading the audit's own output rather than by
testing: an F# `[<Literal>]` attribute broke the attribution window (reporting
`BusRegime.HonestCeilingRho` as bare while it carries a full Tsirelson-fraction
derivation), and `let mutable` was being read as a budget when it is an accumulator. Both
have regression tests.

## Follow-up (NOT done here — fixing is separate work, and some findings are legitimate)

1. **Triage the VERDICT tier (7 rows)** — these gate a hard failure with no exit.
   `BONSAI_MAX_DEPTH = 1024`, `MAX_EXPR_DEPTH = 128`, `MAX_KEY_ID_BYTES = 128`,
   `MAX_REASON_BYTES = 512`, `FerryThrottler.MaxBatchSize = 256`. Most likely want one
   sentence of provenance each, not a value change.
2. **`observe/chooser.ts:148-149`** — `oracleThreshold = config.oracleThreshold ?? 0.9`
   and `composerThreshold ?? 0.7` decide when to defer to the oracle tier. Highest-value
   single row in the report: an unattributed number choosing when an oracle is trusted.
3. **`audit-tick-shard-relative-paths.baseline.json`** — the only baseline with no in-file
   provenance; the other two carry `_doc` / `description` saying "shrink-only". A ratchet
   that does not say it is a ratchet is one PR away from being raised to make a failure go
   away.
4. **The anonymous-literal class is not detected at all.** `src/Core/Transaction.fs:86`
   reads `if attempts > 1024 then` with no named constant (line 87 repeats the literal in
   the failure message). Arguably the worst form of this defect, and out of reach of an
   attribution test because there is nothing to attach the attribution to. Naming it is
   the prerequisite for attributing it.
5. **Possible rule.** This may warrant a `.claude/rules/` entry. That surface is under a
   cooling-period razor and is the maintainer's call, so it is **proposed here, not
   added** — no rule file is touched by this work.

## Corrections to the framing this was scoped from

- `MIN_REGISTRY_ROWS` in `lint-local-clock-fields-never-read.ts` was cited as an instance.
  **Neither the constant nor the file exists on `main`** (`rg MIN_REGISTRY_ROWS` → no
  hits; no `hygiene/*clock*` file). Recorded rather than quietly dropped.
- `TickBudget` is a `SimLoop.Stopped` case, not a constant; the value is
  `SimLoop.defaultBudget` (`MaxLaps = 1_000`, `MaxTicks = 1_000_000`). `CellScheduler.fs`
  carries no budget at all — it documents the *deliberate omission* of one, which is
  itself an attributed choice.
- `EXPECTED_RETAINED_SHELL` is a string roster with no numeric literal, so it is out of
  this detector's scope by construction.

## Pointers

- `src/Core.TypeScript/hygiene/audit-hidden-oracles.ts` · `.test.ts`
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — the exit test
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — detection ≠ verdict
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the same earned-privilege shape
- `src/Core.TypeScript/hygiene/audit-scan-floor-routes.ts` — the "1 is the only non-guess" precedent
