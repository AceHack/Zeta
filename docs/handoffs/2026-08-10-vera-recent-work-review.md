# Vera Recent Work Review

- **Date:** 2026-08-10
- **Author:** Vera (OpenAI Codex)
- **Review status:** Ready for review; no follow-on implementation has started

## Scope

This handoff records Vera's recent browser/database slice and the two main-gate
repairs that followed it. It also audits the current heat and reversibility
surfaces before they are connected to newer protocol work.

The audit is current through `origin/main` commit
`78c6ddd412a506f768a74fb308933d047bed2942`, which added separate accounted
and unaccounted batch-erasure counts while this review was being prepared.

The purpose is to give reviewers a factual checkpoint. Shipped behavior, test
evidence, interpretation, and proposed work are kept separate. In particular,
this document does not promote the proposed heat mappings in
`docs/handoffs/2026-08-10-lumen-8h-review-addison.md` to implemented behavior.

## Shipped Work

### Browser database row selection

PR [#10291](https://github.com/Lucent-Financial-Group/Zeta/pull/10291), merged
as `fa0ac49d91dd116dd133012de4be6d797261b26a`, added a typed path from a
materialized browser database row to the existing row-command editor.

The source-owned selection contract is in
`src/Core.TypeScript/darkhall-ui/darkhall-browser-database-row-selection.ts`.
It:

- resolves a selected row key through an injected `resolveRow` function;
- loads only a row returned by the latest typed database readout;
- distinguishes pointer and keyboard activation;
- reports invalid keys, missing rows, load failures, observer failures, and
  backpressure as typed results;
- records selected, refused, and backpressured outcomes; and
- removes its event listener when stopped.

The editor integration is in
`src/Core.TypeScript/darkhall-ui/darkhall-browser-row-command-editor.ts`.
Loading a selected row updates the key, payload, and absolute weight fields as
one attempted operation. If any field write fails, the prior field values are
restored. Loading does not construct a database delta and does not consume the
next command sequence number. A signed database command is produced only after
the user invokes the explicit emit or retract action.

The browser page, room markup, CSS, and Playwright smoke were updated so the
materialized row is an accessible button and successful selection preloads the
editor. The smoke captures controller receipts immediately after the relevant
acceptance wait; this removed a race in which later page activity could replace
the receipt being asserted.

### Lossy UDP state repair

PR [#10292](https://github.com/Lucent-Financial-Group/Zeta/pull/10292), merged
as `98b072bc425e83756614880b2fb6b517631f5595`, repaired TypeScript errors in
the lossy UDP transport and fixed one runtime state-corruption bug.

`absorbError` returns an update receipt, not a Bayesian model. The affected
path assigned that receipt to the model field after a teaching NACK. The repair
keeps the model instance in place and adds a two-message regression: the model
records observation counts one and two rather than becoming an incompatible
receipt after the first update.

The same PR made compact NACK decoding sequence-only, validates the teaching
NACK JSON boundary, uses erasable constructor syntax, and preserves exact
optional-property semantics.

### Bayesian and gossip contract repair

PR [#10293](https://github.com/Lucent-Financial-Group/Zeta/pull/10293), merged
as `c8d671ae2f454ecc279baeca70e5b626d239f7d3`, repaired the remaining
TypeScript contract drift introduced while main was moving.

The tangle-detection result is now a discriminated union, so the blocked case
always carries its reason and break instruction and tests must narrow before
reading those fields. The gossip adapter also converts its optional sender into
the required channel callback with an explicit `unknown` fallback. Unused
imports and types were removed.

## Verification Evidence

| Slice | Local evidence | Merge evidence |
|---|---|---|
| Browser row selection | Full `bun run preflight` passed 14/14; `bun test` reported 8,953 passing tests, 7 explicit live-integration skips, and 0 failures; 41 focused tests passed; Chromium PWA and multitab smokes passed | PR #10291 is merged and its merge commit is an ancestor of current `origin/main` |
| Lossy UDP repair | Exact CI TypeScript lint passed; quick preflight passed 12/12; 30 focused tests passed | PR #10292 is merged and its merge commit is an ancestor of current `origin/main` |
| Bayesian/gossip repair | Exact CI TypeScript lint passed; quick preflight passed 12/12; 37 focused tests passed | PR #10293 is merged and its merge commit is an ancestor of current `origin/main` |

The repaired merge-ref gate run `31422675915` completed successfully across
TypeScript lint, the seven-language verification job, macOS, x64 Linux, and ARM
Linux. This is stronger evidence than a branch-only test because it exercised
the integrated tree after concurrent main changes.

## Heat And Reversibility: Implemented Surface

### Typed loss signals and injected output

`src/Core/Heat.fs` owns the F# heat contract. `HeatSignature` records a source,
kind, unit count, fixed-point parts-per-million mass, and detail. `HeatSignal`
classifies kinds as forgotten, backpressure, denied, storage error, invalid,
expired, stale, or other.

`IHeatSink` is an injected output port. A host may export signatures, a test
may record them, and a small room may retain a bounded local set. Sink capacity
failure remains typed `Backpressure`; it is not thrown or silently discarded.
`BoundedHeat.signature` emits nothing when no units were lost.

`src/Core.TypeScript/darkhall-ui/heat.ts` mirrors that finite signal alphabet
and defines heat receipts. Its current policies are:

- storage errors request host export;
- forgetting requests bounded-forget handling;
- denial and backpressure request no-forget handling; and
- unclassified signals remain unknown.

### Temperature readout

F# and TypeScript use the same clamped integer scale from 0 to 1,000,000 ppm.
The implemented bands are:

| Ppm | Band |
|---|---|
| exactly 0 | cold |
| 1 through 333,333 | warm |
| 333,334 through 666,666 | hot |
| 666,667 through 1,000,000 | critical |

The temperature is the maximum of heat, uncertainty, and pressure. Attention
is carried in the readout but does not change the arithmetic temperature. A
pressure signal maps pressure to the maximum value.

The black-body projection is explicitly a dimensionless reference curve. Its
radiance follows a normalized fourth power and its peak-frequency lane is
linear in normalized temperature. It is not a measurement in SI kelvin, joules,
or watts.

### Q# boundary

`src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json` and
`src/Core.QSharp.ReferenceOracle/HeatSignals.qs` mirror the finite signal,
temperature-band, and normalized black-body cases. Q# is a reference plugin
behind `ITemperatureReferenceOracle`; it does not emit runtime heat and it does
not own the room's accounting.

### Entropy accounting model

`src/Core.TypeScript/algebra/entropy-tracker.ts` is a normalized software model
with two counters: uncertainty retained in state and erased bits assigned to a
heat ledger. `observe` leaves both counters unchanged; `measure(bitsErased)`
transfers the requested number of normalized bits from state to heat. Its
Landauer floor is represented as one normalized unit per erased bit.

This code does not read hardware energy counters, temperature sensors, elapsed
energy, or physical constants. It tests an internal accounting invariant. It
does not demonstrate that an operation is physically reversible or free.

### Concurrent protocol accounting

`src/Core.TypeScript/protocol/batch-teaching-envelope.ts` now allows a bare
erasure to carry an `accountedReason`. Its batch summary counts deliberate bare
erasures as `accountedHeat` and bare erasures without that marker as
`unaccountedHeat`. The latter is intended to drive an alarm.

This is a useful policy distinction, but both fields are item counts. They are
not heat receipts, erased-bit counts, or physical energy measurements. The
older `erasureHeat` function remains `bareErasures / totalItems`.

## Corrections To Proposed Heat Mappings

Lumen's review is useful routing context, but the following equivalences are
not established by the current code:

| Proposed statement | Current evidence |
|---|---|
| `BatchTeachingEnvelope.erasureHeat` directly equals the entropy tracker's heat ledger | Not implemented. `erasureHeat` is `bareErasures / totalItems`; `accountedHeat` and `unaccountedHeat` are item counts; the entropy tracker records normalized erased-bit counts. No adapter or unit conversion connects them. |
| A missing `retractableBeliefId` is `HeatSignal.forgotten` | Not implemented. The envelope labels it a bare erasure. Heat classification recognizes explicit kind strings such as forget, forgotten, or prune. |
| Successful erasure-code reconstruction is reversible and has zero physical heat | Not measured or proven. It may avoid retransmission and its associated communication cost, but the implementation has no physical energy instrument or reversible-computation proof. |
| A teaching error is physically free | Not measured or proven. The protocol retains more correction information than a bare error, which is useful for recovery, but processing and transport still consume resources. |
| The second-law flag means `erasureHeat` must decrease over time | Incorrect. The entropy tracker's flag checks its own normalized ledger invariant. It neither reads nor constrains the envelope ratio over time. |
| Cold is any value below one third | Incorrect for the implemented treaty. Cold is exactly zero; positive values through 333,333 ppm are warm. |

The safe present interpretation is narrower: `erasureHeat` is a protocol
quality ratio that distinguishes errors with a retractable identifier from
errors without one. `accountedHeat` and `unaccountedHeat` further divide the
bare-erasure count by whether a deliberate reason was supplied. Any of these
may become an input to a heat receipt after units, denominator, and policy are
agreed, but none is currently the same quantity as the heat ledger.

## Review Questions

1. Should `erasureHeat` be renamed `bareErasureRatio` until an explicit heat
   adapter exists? The current name invites a physical interpretation the code
   does not support.
2. Should `accountedHeat` and `unaccountedHeat` be named as erasure counts, or
   should their types carry an explicit unit so they cannot be confused with
   parts per million or erased bits?
3. If the ratio becomes a heat input, should its denominator remain all batch
   items or become failed items? The existing `teachingRatio` uses failed items,
   while `erasureHeat` uses all items.
4. Should protocol loss, uncertainty, pressure, and measured device energy stay
   separate dimensions through storage and UI, with temperature remaining a
   derived readout?
5. Should `measure(bitsErased)` reject a value greater than retained state
   uncertainty? The current model can make the state ledger negative while its
   total-ledger check still passes.
6. Does browser row selection require a readout version or row identity token
   before replacement commands are added? It currently resolves against the
   latest in-memory readout at selection time, but it has no compare-and-swap
   token for later edits.

## Held Follow-On Work

No work below has started. These slices remain held until this review is
accepted or corrected:

1. Add an explicit replace-row command that retracts the selected identity and
   emits its replacement through the existing controller and database ports.
2. Exercise the ZetaDB primary storage path in tests rather than testing only
   the IndexedDB fallback path.
3. Add a typed protocol-to-heat adapter only after the review settles units,
   denominators, saturation, and category preservation.
4. Surface the resulting receipts in the browser UI without introducing an
   independent JavaScript animation clock.

## Primary Files

- `src/Core.TypeScript/darkhall-ui/darkhall-browser-database-row-selection.ts`
- `src/Core.TypeScript/darkhall-ui/darkhall-browser-row-command-editor.ts`
- `src/Core.TypeScript/darkhall-ui/darkhall-browser-page.ts`
- `src/Core.TypeScript/discovery/udp-lossy-transport.ts`
- `src/Core.TypeScript/bayesian/bnn-persistence.ts`
- `src/Core.TypeScript/bayesian/sensor-fusion-oracle.ts`
- `src/Core.TypeScript/discovery/gossip-mesh-transport.ts`
- `src/Core/Heat.fs`
- `src/Core.TypeScript/darkhall-ui/heat.ts`
- `src/Core.TypeScript/algebra/entropy-tracker.ts`
- `src/Core.TypeScript/protocol/batch-teaching-envelope.ts`
- `src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json`
