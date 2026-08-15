---
id: 081M005CGB7087G0R0031328CY
type: task
state: done
priority: P2
slug: wire-bnn-persistence-so-the-society-bnn-survives-the-tick-bo
title: "wire bnn-persistence so the society BNN survives the tick boundary"
created: 2026-08-14T12:54:07.975Z
completed: 2026-08-15T15:36:48.262Z
depends_on: []
composes_with: []
---

# wire bnn-persistence so the society BNN survives the tick boundary

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M005CGB7087G0R0031328CY-*.md` glob. -->
## The state today (checked 2026-08-14)

`src/Core.TypeScript/bayesian/bnn-persistence.ts` exists, is tested (15 tests), and its
header names **docs/observe-events/bnn-state.json** as living "in the same G-set as the
society evolution events, so the BNN state is version-controlled alongside the society
state" -- i.e. it was written FOR the society runner.

`saveBnnState` and `loadBnnState` have **zero call sites** anywhere in the repo.
**docs/observe-events/bnn-state.json** has never existed. The path was drawn and never
soldered at either end.

## Why this is the blocking dependency for a non-empty PriorHint list

`society-evolution-runner.ts` now publishes only evidence-backed hints
(`evidenceBackedPriorHints`), which is `[]` on every tick because a fresh 30-minute CI
process has absorbed nothing. It is also why `heatReadout.trend` is `indeterminate`:
a derivative needs two beliefs and only one exists per process.

## Both ends, or neither

Wiring only `loadBnnState` restores a prior from a file nothing writes -- the same
defect with an extra file read. The slice has to include a WRITER, and the writer needs
something to write: the society runner absorbs nothing today, so the real question is
which process owns the society-scale BNN and what feeds it.

## Guards the wiring must carry

- `local-time-never-enters-the-shared-fold`: a restored belief steering the shared
  evolution fold, selected by wall-clock recency, is exactly the leak that rule names.
  The trend readout is local display; keep it out of the shared conclusion.
- Idempotency (#6): re-loading the same state must not re-count it.
- The restored `nu` must be the STORED one, not the constructor default (#10563 fixed
  three defects on that branch already).

## Resolution (2026-08-15)

Both ends soldered in `society-bnn.ts`. Load `bnn-state.json` from the event dir
(or start from the prior). Absorb THIS generation as one `calibration`
observation keyed by event id — not a re-fold of the log, because the persist
format does not carry the envelope guard. Save only once `obsCount > 0`.

`evolve()` does not read the BNN. Transport trend stays `indeterminate` until
that dimension is fed. After the first tick, `evidenceBackedPriorHints` publishes
`calibration` with the real obsCount. Restored `nu` is the stored one.
