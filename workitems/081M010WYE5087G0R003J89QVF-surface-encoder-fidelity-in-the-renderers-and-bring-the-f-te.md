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
a saturated or out-of-domain reading identically to an exact one. The _live_ pin-at-`critical` lie is
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
(`src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json` `temperatureCases`) pins field _values_,
not the key set, and no test compares the two shapes. That absence is itself worth noting — a treaty
that cannot notice one oracle growing a field is not checking what it appears to check.

Decide, then do one of:

- add the equivalent to F# (and Q# where applicable) and keep `v1`; or
- bump to `v2` if the field is deemed part of the wire contract; or
- declare `fidelity` an encoder-local diagnostic that is explicitly NOT part of the schema, and
  exclude it at the serialisation boundary.

Whichever is chosen, add the missing key-set conformance check so the next divergence fails loudly.

**Update (shadow, 2026-08-14) — the key-set check now exists; the design call does not.**
`src/Core.TypeScript/hygiene/audit-schema-key-set-parity.ts` compares key sets across oracles for
every schema id bound to a type shape in more than one of them, and it catches this divergence: with
its exceptions file removed it exits 2 naming `fidelity`. The observation in the paragraph above was
confirmed empirically before the tool was written — the three suites that read the heat treaty
(`heat-signals.test.ts`, `darkhall-room.test.ts`, `batch-heat-bridge.test.ts`) report 51 pass / 0
fail / exit 0 with the divergence live, so nothing could see it.

The **choice between the three options is still open and still belongs here.** It is recorded as a
declared exception in `audit-schema-key-set-parity.exceptions.json` pointing at this work-item — an
honest declared divergence rather than a guessed fix in a treaty. A declared exception that stops
matching a live divergence is reported as STALE and fails, so resolving this here will make the
audit demand the exception's removal rather than let it linger.

One input for whoever makes the call: `ChannelFidelity`'s `out-of-domain` case is motivated by
JavaScript `number` admitting `NaN`/`Infinity`, which F#'s `int`-typed `TemperatureReadout.ofPpm`
cannot produce — but `saturated` and negative input are real on both sides, and F#'s
`max 0 |> min MaxPpm` discards them exactly as silently as TypeScript's clamp did before the fix. So
`fidelity` is not purely encoder-local. Also worth weighing: adding a REQUIRED field to an
already-published `v1` is a breaking change by the ordinary schema-evolution rule.

Residual scope of the audit itself (two oracles of four, 6 of 78 schema ids, F# optionality
undetected) is filed as **081M013X907087G0R0037FPC5S**.

---

## Progress — §1 DONE (shadow, 2026-08-14, branch `shadow/fail-dangerous-nan-encoder-paths`)

§2 is untouched (a sibling agent holds the schema question on
`shadow/treaty-cannot-see-key-set-divergence`) and §3 is untouched. All numbers
below were produced by running the code against `origin/main@0cb3642eb`.

### Re-measurement first — two of the reported defects had already been fixed

The brief for this pass listed six fail-dangerous readings. Re-measured before
changing anything, because asserting a stale defect is the failure this work-item
exists to prevent:

| reported                                          | still reproduces on `main@0cb3642eb`?                                                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `temperatureBand(NaN \| Infinity \| -1) = "cold"` | **partly, and by design** — the bare accessor still returns `cold` (the four tokens are a four-oracle treaty and must not move), but `temperatureBandReading(NaN).verdict = "out-of-domain"` now separates it from `temperatureBandReading(0).verdict = "in-range"` |
| `heatReceiptPpm(NaN \| Infinity) = 0`             | **partly, and by design** — accessor still `0`; `heatReceiptScale(NaN).fidelity = "out-of-domain"` vs `heatReceiptScale(0).fidelity = "exact"`                                                                                                                      |
| F# `pct(nan)` → a confident 0% bar                | **NO — fixed.** `pct` no longer exists; `UnitInterval.tryOf nan = None` and `render` emits `brokenBar`                                                                                                                                                              |
| F# `pct(infinity)` → a confident 100% bar         | **NO — fixed.** Same route                                                                                                                                                                                                                                          |

`dotnet test --filter "FullyQualifiedName~SocietalDoraSvg"` → `Failed: 0, Passed:
10`, exit `0`. The F# half of the brief was already discharged by
081M00TYT8N087G0R003MPMRX9 and is reported as such rather than re-fixed.

### The live defect, which is worse than what was reported

Fixing the encoders did not make the fidelity channel survive **composition**.
`darkhall-room.ts` fed the lossy accessor straight into `temperatureReadout`:

```
heatRejected=0         scale.fidelity=exact          -> ppm=0 -> readout.fidelity=exact
heatRejected=NaN       scale.fidelity=out-of-domain  -> ppm=0 -> readout.fidelity=exact
heatRejected=Infinity  scale.fidelity=out-of-domain  -> ppm=0 -> readout.fidelity=exact
heatRejected=-1        scale.fidelity=out-of-domain  -> ppm=0 -> readout.fidelity=exact
```

The encoder **knew**, and the readout reported `exact` anyway. That is strictly
worse than the silence it replaced: an unwired fidelity field does not merely omit
the fault, it **positively asserts** a faithfulness nothing measured. A field that
can only ever say `exact` is the vacuity class — a check that cannot fail — and it
is more dangerous than no field, because an operator or an agent can now cite it.

### What changed

- **`worstFidelity` + `FIDELITY_SEVERITY` (`heat.ts`)** — a declared severity
  order (`exact` < `below-resolution` < `saturated` < `out-of-domain`) and a max
  over it. Idempotent, commutative, associative, so it folds over a _set_ of
  inputs and arrival order cannot change a rendered verdict.
- **`temperatureReadout` takes `upstreamFidelity?`** — an _argument_, not a schema
  field; `TemperatureReadout`'s shape is deliberately unchanged so as not to
  collide with the sibling agent holding §2. The readout takes the worst of what
  it can see and what it is told.
- **`darkhall-room.ts` encodes via `heatReceiptScale`**, not `heatReceiptPpm`, and
  forwards all four fidelities.
- **`data-temperature-fidelity`** on the room element, the TV lane and the dweller
  element; a worded suffix (`· SENSOR FAULT · no reading`, `· PINNED · at or above
ceiling`, `· below resolution`); and CSS that repaints an out-of-domain lane.
  Words as well as colour, because `cold` already renders in the muted `--txt3` —
  a colour change alone cannot say whether muteness means _quiet_ or _not
  measured_.

### Evidence the tests discriminate

Assertions expressible against the **pre-fix** API (`upstreamFidelity` is simply
an unread extra property there, so the harness runs against both revisions):

```
check                                                    | pre-fix | post-fix
a NaN heat count does not report fidelity 'exact'        | FAIL    | PASS
blind room and idle room differ in fidelity              | FAIL    | PASS
an Infinity heat count does not report fidelity 'exact'  | FAIL    | PASS
blind room reports fidelity 'out-of-domain'              | FAIL    | PASS
an above-ceiling count reports 'saturated', not 'exact'  | FAIL    | PASS
--- controls, must pass BOTH ways ---
an idle room still reports 'exact'                       | PASS    | PASS
a healthy room still reports 'exact'                     | PASS    | PASS
a healthy room still reads band 'warm'                   | PASS    | PASS
```

5 of 5 discriminate; the 3 controls hold, so the fix is not just "alarm on
everything". Renderer side: with the sources reverted to `origin/main` and the new
tests kept, `bun test darkhall-tv.test.ts` → `17 pass, 6 fail`, exit `1`; with the
fix, `246 pass, 0 fail`, exit `0` across all 21 test files that touch the changed
modules. `bun run typecheck` and `bun run lint:typescript` → exit `0`.

**Owned limit on one of those tests.** _"leaves a healthy lane unmarked"_ also
fails pre-fix, because it asserts the `data-temperature-fidelity="exact"`
attribute that pre-fix does not emit. It is therefore a weaker control than the
three in the harness above, which are attribute-independent. Recorded rather than
presented as a clean both-ways control.

### Residual filed

**081M01400RZ087G0R000PS3VJG** — `HeatReceipt` has no fidelity channel, so the
receipt rails still paint a blind counter as a genuine zero. Not fixed here
because it needs a field on the published `zeta.heat.receipt.v1`, and adding a
required field to a `v1` schema unilaterally is the same move §2 below is open
about. It should be decided together with §2.

---

## 3. `thermalPpm` remains a non-injective fold

`max(heat, uncertainty, pressure)` — defect 4 in the parent work-item, untouched here. The cause is
unrecoverable from the number and is currently mitigated only because `TemperatureReadout` carries
all three channels alongside it. Left as-is deliberately; recorded so the mitigation is understood to
be a mitigation.

---

## §2 RESOLVED (shadow, 2026-08-14) — decision record + applied

Decision record:
`docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md`.
Decided together with `zeta.heat.receipt.v1`, because two different answers to the same structural
question is how the divergence happened.

**The finding that decided it.** The divergence is not only a key-set drift. `DarkHallRoomTranscript.fs`
_serialises_ this schema and `darkhall-room.ts` _parses_ it back, so F# is a producer and TypeScript a
consumer. Measured on unmodified `main` against the exact eight-key shape F# emits:
`fidelity` is `undefined` at runtime while the TypeScript type asserts one of four string literals.
The type was **false about its own wire format** — the same fault as an unwired fidelity channel
asserting a faithfulness nothing measured, raised to the type system.

**The three options were not parallel.** (a) "add it to F#" and (b) "make it optional in TS" answer
different questions — what the producer _computes_ versus what the type may _assert_. Both were wrong;
both are now done, and no choice between them was needed.

- **TypeScript**: `fidelity?: ChannelFidelity`. The `?` is what makes the type true — valid `v1`
  instances without the key exist (every pre-today F# transcript; the treaty `temperatureCases`).
  Absence has a declared reading via `reportedFidelity` → `"unreported"`, never `"exact"`.
- **F#**: `TemperatureReadout` gains `Fidelity: string`, populated by new
  `TemperatureReadout.fidelityOfPpm`. This closes the half that was never a TypeScript encoder
  concern — `max 0 |> min MaxPpm` discarded negative and above-ceiling inputs exactly as silently as
  the TypeScript clamp did, and nothing said so. Out-of-domain outranks saturated.
- **`v2` refuted**: versioning a compatible extension would couple the oracles' release schedules
  (§1 scale-free, §2 lock-free) for no gain.
- **A fourth option was on file and is also refuted** — the exceptions row named "declare it a
  diagnostic excluded at the serialisation boundary". The field is already _at_ that boundary, being
  parsed out of an F#-produced transcript, so excluding it there is not available.

**Treaty vectors extended** (`heat-signals-treaty.json`, +43/−5, all five deletions are `"code"` lines
that gained a trailing comma — no existing value moved): a `fidelity` key on the five existing
`temperatureCases`, plus three cases forming pairs that are byte-identical in `temperaturePpm`, `band`
and `code` and separable **only** by `fidelity`. Asserted by all three oracle surfaces.

**Result:** `audit-schema-key-set-parity` exits 0 with `zeta.temperature.readout.v1 [fsharp:9
typescript:9]` and **zero declared exceptions** — green by agreement, not by tolerance. The
exceptions file is now `"divergences": []`.

### Still open on this work-item

- **§1 renderer surfacing** — untouched here on purpose; it is PR #10732's lane
  (`data-temperature-fidelity`, the worded suffix, the CSS repaint).
- **§3 `thermalPpm`** — unchanged.
- **New, observed rather than fixed:** `TemperatureReadout`'s single `fidelity` is a fold over four
  inputs. Under the "one fidelity per independently-encoded channel value" rule adopted for
  `HeatReceipt`, that is a coarsening — `(exact, exact, out-of-domain, exact)` and an all-blind
  reading render the same token. Not changed: it is a published shape, so changing it is a separate
  decision under clause 2 of the record.
- **081M013X907087G0R0037FPC5S** — F# optionality is still invisible to the parity check, so clause 5
  of the record is mechanically enforceable on the TypeScript side only. Mutation M8 shows the
  consequence honestly: with the key optional in TS, removing it from F# is classified _compatible_
  (exit 0) by the audit, and is caught instead by the treaty vectors (M8b: does not compile).
