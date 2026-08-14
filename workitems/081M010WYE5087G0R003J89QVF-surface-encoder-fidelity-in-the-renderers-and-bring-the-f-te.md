---
id: 081M010WYE5087G0R003J89QVF
type: task
state: backlog
priority: P2
slug: surface-encoder-fidelity-in-the-renderers-and-bring-the-f-te
title: "Surface encoder fidelity in the renderers and bring the F# TemperatureReadout to parity"
created: 2026-08-14T20:54:58.245Z
depends_on: []
composes_with: []
---

# Surface encoder fidelity in the renderers and bring the F# TemperatureReadout to parity

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M010WYE5087G0R003J89QVF-*.md` glob. -->

The **named residual** of 081M00TYT8N087G0R003MPMRX9 scope items 3 and 4. Those fixes made the
information available and typed; they did not put all of it on a screen. Recording exactly what is
still unsurfaced, so the fix is not read as more complete than it is.

## 1. `fidelity` / `verdict` reach no rendered surface

`heat.ts` now returns `HeatReceiptScale.fidelity`, `TemperatureBandReading.verdict`,
`BlackBodyRadianceReading.fidelity` and `TemperatureReadout.fidelity`. Only the last of these is
carried by a value the renderer already receives, and **no renderer reads any of them yet.**

Consequence, stated plainly: `src/Core.TypeScript/darkhall-ui/darkhall-room.ts:561-564` still paints
a saturated or out-of-domain reading identically to an exact one. The *live* pin-at-`critical` lie is
gone because the channel was widened (the ceiling moved from 16 units to 65 536, so realistic counts
no longer saturate at all) — but if a count ever does exceed the ceiling, or a `NaN` reaches the
readout, the picture is still silent about it.

Wanted: a `data-fidelity` attribute (or equivalent) on the temperature surface, and a visibly distinct
treatment for `saturated` / `out-of-domain` — the same move `SocietalDoraSvg.brokenBar` now makes in
F#, where an out-of-range gauge renders red and labelled `out-of-range` instead of as a plausible bar.

## 2. `zeta.temperature.readout.v1` now differs between oracles

TypeScript's `TemperatureReadout` gained a required `fidelity` field. **F#'s
`TemperatureReadout` (`src/Core/Heat.fs:202`) did not**, and both still declare schema
`zeta.temperature.readout.v1`.

This is a real cross-oracle divergence introduced by 081M00TYT8N087G0R003MPMRX9 and it is called out
rather than left to be discovered. Nothing currently fails: the treaty
(`src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json` `temperatureCases`) pins field *values*,
not the key set, and no test compares the two shapes. That absence is itself worth noting — a treaty
that cannot notice one oracle growing a field is not checking what it appears to check.

Decide, then do one of:
- add the equivalent to F# (and Q# where applicable) and keep `v1`; or
- bump to `v2` if the field is deemed part of the wire contract; or
- declare `fidelity` an encoder-local diagnostic that is explicitly NOT part of the schema, and
  exclude it at the serialisation boundary.

Whichever is chosen, add the missing key-set conformance check so the next divergence fails loudly.

## 3. `thermalPpm` remains a non-injective fold

`max(heat, uncertainty, pressure)` — defect 4 in the parent work-item, untouched here. The cause is
unrecoverable from the number and is currently mitigated only because `TemperatureReadout` carries
all three channels alongside it. Left as-is deliberately; recorded so the mitigation is understood to
be a mitigation.
