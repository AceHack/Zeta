---
id: 081M01400RZ087G0R000PS3VJG
type: task
state: backlog
priority: P2
slug: heatreceipt-rails-render-a-blind-counter-as-a-genuine-zero-n
title: "HeatReceipt rails render a blind counter as a genuine zero (no fidelity channel on zeta.heat.receipt.v1)"
created: 2026-08-14T21:49:04.671Z
depends_on: []
composes_with: []
---

# HeatReceipt rails render a blind counter as a genuine zero (no fidelity channel on zeta.heat.receipt.v1)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M01400RZ087G0R000PS3VJG-*.md` glob. -->

The last unfixed member of the fail-dangerous class from
081M00TYT8N087G0R003MPMRX9 / 081M010WYE5087G0R003J89QVF. Filed rather than fixed,
deliberately — see "Why this was not just done" below.

## The defect

`heatReceiptFromRow` (`src/Core.TypeScript/darkhall-ui/heat.ts`) builds all three
receipt channels through the **lossy** accessor:

```ts
heatPpm: heatReceiptPpm(row.heatRejected),
pressurePpm: heatReceiptPpm(row.backpressured),
storagePpm: heatReceiptPpm(row.storageErrors),
```

`heatReceiptScale` knows whether each count was in-domain; `heatReceiptPpm`
discards that and returns `0`. `HeatReceipt` has no channel to carry it, so
`renderHeatReceipt` (`darkhall-tv.ts`) paints `--heat:0.000000` for a blind or
negative or `NaN` counter — **identical to a genuine "no heat this tick"**, which
is the reassuring reading.

Measured against `origin/main@0cb3642eb`:

```
heatReceiptPpm(0)        = 0   scale.fidelity = "exact"
heatReceiptPpm(NaN)      = 0   scale.fidelity = "out-of-domain"
heatReceiptPpm(Infinity) = 0   scale.fidelity = "out-of-domain"
heatReceiptPpm(-1)       = 0   scale.fidelity = "out-of-domain"
```

Four inputs, one picture. Same shape as the `temperatureBand` pin, in the
under-alarming direction: a broken counter renders as a quiet one.

## Why this was NOT just done

The fix wants a `fidelity` field on `HeatReceipt`, and `HeatReceipt` publishes
`zeta.heat.receipt.v1`. Adding a required field to a published `v1` schema
unilaterally is **exactly the divergence 081M010WYE5087G0R003J89QVF §2 is open
about**: 081M00TYT8N087G0R003MPMRX9 added a required `fidelity` to TypeScript's
`TemperatureReadout` while F#'s did not get one, and both still declare
`zeta.temperature.readout.v1`. Repeating that move on a second schema in the same
week would be the same error with a different noun.

**Checked, and it is the easier case than `TemperatureReadout`:** `HeatReceipt`
has **no** F#, Q# or treaty counterpart — `rg` over `src/Core/Heat.fs`,
`src/Core.QSharp.ReferenceOracle/HeatSignals.qs` and `heat-signals-treaty.json`
finds nothing for `HeatReceipt` / `heat.receipt`. So no oracle disagrees today and
the values are free to move. What still needs deciding is the _schema_ question,
not the _values_ question.

## Decide, then do one of

- add `fidelity: ChannelFidelity` and keep `v1`, on the grounds that no other
  oracle implements the schema (record that reasoning, since it is the whole
  justification); or
- bump to `zeta.heat.receipt.v2`; or
- declare fidelity an encoder-local diagnostic excluded at the serialisation
  boundary, and surface it on the rendered element only.

Whichever is chosen, it should be settled **together with**
081M010WYE5087G0R003J89QVF §2, because they are one decision — _is `fidelity` part
of the wire contract or a rendering-local diagnostic?_ — asked about two schemas.

## Then surface it

`renderHeatReceipt` in `src/Core.TypeScript/darkhall-ui/darkhall-tv.ts` should mark
a non-`exact` receipt the way the temperature lane now does
(`data-temperature-fidelity` + a worded suffix + a CSS override), so the fault is
legible rather than merely present in the value.

## Also still open (recorded, not re-filed)

`thermalPpm = max(heat, uncertainty, pressure)` remains the non-injective fold of
081M00TYT8N087G0R003MPMRX9 defect 4 — see 081M010WYE5087G0R003J89QVF §3.
