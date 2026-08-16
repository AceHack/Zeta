# How a published, four-oracle byte-locked schema acquires a new field

**Status:** decided and applied. Resolves `081M010WYE5087G0R003J89QVF` §2
(`zeta.temperature.readout.v1` / `fidelity`) and unblocks
`081M01400RZ087G0R000PS3VJG` (`zeta.heat.receipt.v1` / the blind counter).
One decision, both schemas, because two different answers to the same structural
question is how the divergence happened in the first place.

**Origin:** PR #10722 added a required `fidelity` field to TypeScript's
`TemperatureReadout` while F#'s kept eight fields and both still declared
`zeta.temperature.readout.v1`. PR #10730 built the check that sees it and
carried the divergence as a declared exception. PR #10732 hit the same wall on
`HeatReceipt` and declined to move, calling a unilateral field addition
"precisely the unilateral move that created the divergence in the first place."
All three stopped at the same missing decision. This is that decision.

---

## The finding that decides it

The divergence was filed as a hygiene defect — one oracle's key set drifting
from another's. It is worse than that, and the sharper fact is what selects the
option.

`src/Core/DarkHallRoomTranscript.fs` **serialises** `zeta.temperature.readout.v1`
to JSON (`[<JsonPropertyName>]` on `TranscriptTemperatureReadout`), and
`src/Core.TypeScript/darkhall-ui/darkhall-room.ts` **parses** it back
(`transcript.temperatureReadout?: TemperatureReadout`, an unchecked cast). F# is
a producer; TypeScript is a consumer. So `fidelity` is not a private field on a
TypeScript type — it is a key on a wire contract with a live producer that never
wrote it.

Measured against unmodified `main`, on the exact eight-key shape F# emits:

```text
keys on the wire        : 8
fidelity declared type  : ChannelFidelity (required, non-optional)
fidelity at runtime     : undefined
reads as 'exact'?       : false
reads as NOT 'exact'?   : true
rendered into a string  : fidelity=undefined
```

**The type was false about its own wire format.** A required field that the
producer never writes is not a stricter contract; it is a type asserting a value
that does not exist. That is the same fault #10732 named one level down — an
unwired fidelity channel _positively asserts_ a faithfulness nothing measured —
raised to the type system, where it is harder to see and easier to cite.

This also rules out the framing that "keep `v1` unchanged" is merely the weakest
option because adding a required field to a published version is breaking. It is
weaker than that: on this side it was **already broken**, silently, at the
boundary.

---

## The decision

### 1. A published `vN` acquires a new field ONLY as an optional key

Optional in the oracle that reads it. Adding an optional key is a compatible
extension: a consumer that does not know the key ignores it, and a producer that
cannot supply it omits it. Neither side has to move for the other.

**Anchor (checked, not merely cited):** this is the reader/writer schema
resolution rule, not a house convention. Apache Avro resolves a field present in
the reader's schema and absent from the writer's by using the reader's
_default_, and a field with no default is an unresolvable (breaking) difference —
_Avro Specification, "Schema Resolution."_ Protocol Buffers reaches the same
place from the other direction: since proto3, every scalar field has an implicit
default and adding one is a compatible change, while a field a peer must supply
is not something a version can acquire — _Protocol Buffers, "Updating A Message
Type."_ Both say the same thing: **the compatible unit of schema growth is a
field with a defined reading when absent.**

### 2. A REQUIRED key, a type change, or a meaning change is `vN+1`

Not `vN`. All binding oracles move together, `vN`'s golden vectors are **kept
unchanged** (they remain valid `vN` instances), and `vN+1` gets its own vectors.

Bumping the version for a field that not every producer can supply is the wrong
trade here for a reason stronger than cost: it couples the oracles' release
schedules. A producer that cannot yet compute the field would _block the version
bump_, which is a coordination point the substrate is not supposed to have
(§1 scale-free, §2 lock-free). Versions are for changes that genuinely cannot be
read two ways.

### 3. An optional key MUST declare its absent-reading, and absence must be conservative

This is the clause that keeps "optional" from being a dodge, and it is the one
the codebase had already learned the hard way.

> Absence means **this producer did not report**. It never means **this producer
> reports the channel is faithful.**

A reader that treats "not reported" as "fine" has reintroduced the exact fault
the field was added to fix, one level up. So the absent-reading is a _value_, not
a convention:

```ts
export function reportedFidelity(fidelity: ChannelFidelity | undefined): ReportedFidelity {
  return fidelity ?? UNREPORTED_FIDELITY;
}
```

The invariant, tested exhaustively over the value domain plus absence: the result
is `"exact"` **if and only if** the producer said `"exact"`. Five distinguishable
readings from four measured tokens plus absence.

Same shape as the refusals already in this lane: `TemperatureBandReading.verdict`
separating a blind room from an idle one, and `society-heat-readout.ts`
`declareBand` publishing `"indeterminate"` rather than a band its evidence cannot
support.

### 4. An optional key MUST be pinned by a vector, because optionality trades key-set enforcement for value enforcement

**This clause was found by mutation, not by design, and it is the one most
likely to be skipped.**

Mutating the F# record to drop the key again and re-running the parity audit:

```text
M8 F# key removed -> parity audit                              exit=0
  zeta.temperature.readout.v1: key 'fidelity' optional in typescript, absent from fsharp
```

Exit `0`, classified **compatible**. That is correct under clause 1 — an optional
key absent from another oracle _is_ a compatible extension — but it means the
key-set audit can no longer catch "this oracle quietly stopped reporting."
Optionality does not merely relax the check; it moves the guard.

Where it moves to is the value byte-lock, and that is the right place: an
optional key carries no obligation to be _present_, but it carries a full
obligation to be _correct when present_. So an optional key without a treaty
vector is unguarded. Verified — with the key removed, the F# treaty test does not
merely fail, it does not compile:

```text
M8b F# key removed -> F# treaty test build EXIT=1
  FS1129: The record type 'TemperatureReadout' does not contain a label 'Fidelity'
```

### 5. What makes a field optional, per oracle

| oracle                     | optional form                                             | seen by `audit-schema-key-set-parity`?                                                                                                              |
| -------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                 | `readonly key?: T`                                        | **yes** — `?` is read                                                                                                                               |
| F#                         | `Key: T option` + `JsonIgnoreCondition.WhenWritingNull`   | **no** — the audit reads record _literals_, which carry no types, and conservatively treats every F# key as required (`081M013X907087G0R0037FPC5S`) |
| Q# / treaty JSON           | the key may be absent from a case; the reader defaults it | n/a — the treaty is vectors, not a type                                                                                                             |
| C# / Rust (when they bind) | nullable / `Option<T>` + `skip_serializing_if`            | not yet implemented                                                                                                                                 |

The F# gap is load-bearing for how this decision was _applied_: "make it optional
in F#" is not a resolution the check can verify, so where a key must be optional
to restore parity, it is made optional on the **TypeScript** side, which the
check can see. That is not a preference; it is the only side where the claim is
mechanically checkable today.

---

## Applied

### `zeta.temperature.readout.v1` — option (b), and F# moves too

Of the three options on the table — (a) add it to F# so both match, (b) make it
optional in TS, (c) bump to `v2` — the answer is **(b) for the schema shape**,
with **(a)'s substance done as well**, and **(c) refuted**.

The three options were not actually parallel. (a) and (b) were being compared as
if one fixed F# and the other fixed TypeScript, but they answer _different
questions_: (b) is about what the **type may assert**, (a) is about what the
**producer computes**. Both were wrong and both are fixed, and neither required
choosing.

- **TypeScript**: `fidelity?: ChannelFidelity`. The `?` is not a weakening — it is
  what makes the type true. Instances of `v1` without the key exist and are
  valid: every transcript F# emitted before today, and the Q# treaty's
  `temperatureCases`.
- **F#**: `TemperatureReadout` gains `Fidelity: string`, populated by a new
  `TemperatureReadout.fidelityOfPpm`. **This is the half that was never a
  TypeScript encoder concern.** `ChannelFidelity`'s `out-of-domain` case is
  motivated by JS `number` admitting `NaN`/`Infinity`, which an `int` cannot
  produce — but `max 0 |> min MaxPpm` discarded a negative and an above-ceiling
  input exactly as silently as the TypeScript clamp did before #10722, and
  nothing said so. F# reaches `out-of-domain` by the negative branch and
  `saturated` by the ceiling branch. Out-of-domain outranks saturated: an input
  that is not a measurement at all is a worse fault than one the channel merely
  could not hold.
- **(c) `v2` is refuted** on clause 2: the information is a compatible extension,
  and versioning it would have forced every producer to move at once for no gain.

### `zeta.heat.receipt.v1` — the same policy, and the blocked fix lands

`heatReceiptFromRow` encoded through `heatReceiptPpm`, which computes the
fidelity in `heatReceiptScale` and then throws it away — so `heatRejected: NaN`
and `heatRejected: 0` both rendered `heatPpm: 0` with no key on which they
differed. It now encodes through `heatReceiptScale` and publishes **three
optional keys, one per rail**: `heatFidelity`, `pressureFidelity`,
`storageFidelity`.

**Three, not one folded `fidelity`, deliberately.** The receipt publishes three
independent counters. A fold to the worst of them would be a fresh non-injective
encoder — `(exact, exact, out-of-domain)` and
`(out-of-domain, out-of-domain, out-of-domain)` would render identically — which
is the defect class this whole lane exists to remove. The rule that falls out and
generalises: **one fidelity per independently-encoded channel value.**

Note this is a different answer from `TemperatureReadout`'s single `fidelity`,
and the difference is principled rather than inconsistent: the readout publishes
one derived temperature and folds four inputs into it, so one fidelity matches
one encoded value. (The readout's fold over four inputs is itself a coarsening —
observed, not fixed here, recorded on `081M010WYE5087G0R003J89QVF`.)

`HeatReceipt` has no F#, Q# or treaty counterpart, so no oracle disagrees today.
The blocker was never the mechanism; it was the absence of this policy. With the
policy, an optional key is a compatible extension a single oracle may add — which
is exactly why #10732 was right to stop, and exactly what unblocks it.

---

## The vector change, stated explicitly

`src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json` is a byte-lock and
changing it is a treaty change, so: **43 insertions, 5 deletions, and all five
deletions are `"code": N` lines that gained a trailing comma.** No existing value
moved. The change is (i) a `fidelity` key on each of the five existing
`temperatureCases`, all `"exact"` because all five are in-domain, and (ii) three
new cases.

The three new cases are the point, and they are chosen as **pairs identical in
every other published key**:

| id                               | temperaturePpm | band     | code | fidelity            |
| -------------------------------- | -------------- | -------- | ---- | ------------------- |
| `cold`                           | 0              | cold     | 0    | `exact`             |
| `blind-counter-is-out-of-domain` | 0              | cold     | 0    | **`out-of-domain`** |
| `at-ceiling-is-exact`            | 1000000        | critical | 3    | `exact`             |
| `above-ceiling-is-saturated`     | 1000000        | critical | 3    | **`saturated`**     |

Each pair is byte-identical in `temperaturePpm`, `band` and `code`, and separable
only by `fidelity`. That is the injectivity argument written as a vector rather
than as prose: if the key were dropped, each pair would collapse to one
indistinguishable reading. It also keeps the key non-vacuous — a treaty key whose
every row says the same thing is the vacuity class, and would have been if only
the five in-domain rows had been annotated.

The vectors are read by three oracle surfaces, all of which now assert on the new
key: `heat-signals.test.ts`, `darkhall-room.test.ts` (TypeScript encoder vs the
committed row) and `QSharpOracle.Tests.fs` (F# encoder vs the same row).

Two artifacts that did **not** move, checked rather than assumed:
`hall/tv/index.html` regenerates byte-identical (no renderer reads fidelity yet —
that is #10732's lane), and no committed JSON transcript carries this schema.

---

## Evidence

| gate                                                | result                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `audit-schema-key-set-parity`                       | exit **0**, `zeta.temperature.readout.v1 [fsharp:9 typescript:9]`, **Declared: 0**, stale: 0 |
| `tsc --noEmit`                                      | exit 0, 0 errors (`./node_modules/.bin/tsc`, real binary, `node_modules` symlinked)          |
| `bun test` (6 heat/treaty/hygiene suites)           | 126 pass, 0 fail, exit 0                                                                     |
| `dotnet build Zeta.sln -c Release`                  | **0 warnings, 0 errors**                                                                     |
| `dotnet test` QSharpOracle + DarkHallRoomTranscript | 21 passed, 0 failed                                                                          |
| `dotnet test` Bayesian.Tests                        | 415 passed, 0 failed                                                                         |

The exception file is now `"divergences": []` — the parity check is green **by
agreement between the oracles**, not by tolerance and not by an exception.

### Mutation — the added tests are falsifiers

| mutation                                                      | exit                     |
| ------------------------------------------------------------- | ------------------------ |
| M1 absent-reading returns `"exact"` instead of `"unreported"` | **1**                    |
| M2 receipt fidelity keys removed                              | **1**                    |
| M3 three receipt rails folded to the worst fidelity           | **1**                    |
| M4 treaty `out-of-domain` row flipped to `exact`              | **1**                    |
| M5 F# out-of-domain branch disabled                           | **1**                    |
| M6 F# saturated branch disabled                               | **1**                    |
| M7 F# attention channel dropped from the fidelity fold        | **1**                    |
| M8 F# key removed → parity audit                              | **0 — see clause 4**     |
| M8b F# key removed → F# treaty test                           | **1** (does not compile) |

M8 is reported as a `0` rather than quietly dropped from the table. It is the
coverage consequence of choosing optional, it is what clause 4 exists to answer,
and reporting it as a pass would have been the check-that-did-not-run failure.

---

## Owned corrections to the brief I was given

1. **PR #10732 is OPEN, not landed.** The brief said "three PRs landed this
   week"; #10732 has `mergedAt: null`. Its fixes are therefore _not_ on `main`,
   which is why this work treats `darkhall-room.ts` as un-wired for fidelity and
   leaves the renderer to #10732.
2. **There were four options on file, not three.** The exceptions row named a
   fourth — "declare it a diagnostic excluded at the serialisation boundary" —
   which the brief's (a)/(b)/(c) dropped. It is refuted by the finding above: the
   field is already _at_ the serialisation boundary, being parsed out of an
   F#-produced transcript, so excluding it there is not available.
3. **The "settled" position needed strengthening, not refuting.** The brief said
   adding a required field to a published `v1` is breaking, so "keep v1
   unchanged" is weakest. Correct, and understated: on the TypeScript side the
   contract was already false at runtime, not merely at risk.
4. **(a) and (b) were not alternatives.** They answer different questions — what
   the type may assert versus what the producer computes — and both are done.

## Found in passing, fixed, flagged

`audit-schema-key-set-parity.ts` contained **three raw NUL bytes** as key
separators in `exceptionKey`, which made `git`, `grep` and `rg` classify the
checker's own source as a binary file (`rg` refused to match it). Replaced with
a `\u0000` escape — byte-identical runtime string, and the file is text again.
A verification tool that cannot be grepped is a mild instance of exactly what
`no-binary-in-proof-lineage` guards; the audit's 28 tests pass unchanged.

## Not done here, named rather than implied

- **`081M013X907087G0R0037FPC5S`** — F# optionality is still invisible to the
  parity check, and Q#/C#/Rust still bind no schema ids. Clause 5 is therefore
  enforceable on the TypeScript side only.
- The renderer wiring for `fidelity` (`data-temperature-fidelity`, the worded
  suffix) belongs to **#10732** and is deliberately untouched here.
- The `TemperatureReadout` single-`fidelity` fold over four inputs is a
  coarsening under the "one fidelity per encoded value" rule. Observed, recorded
  on `081M010WYE5087G0R003J89QVF`, not changed — it is a published shape and
  changing it is a separate decision under clause 2.

## Pointers

- `.claude/rules/no-binary-in-proof-lineage.md` — the treaty stays text; the
  exceptions file and the treaty vectors are JSON, and the NUL fix above.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — an optional key with no
  vector is `unmetered`; clause 4 is that rule applied to schema keys.
- `.claude/rules/dv2-data-split-discipline-activated.md` — #5 DV2.0: the schema id
  is the hub, producer capability is the satellite, and clause 1 is what lets
  them change at different rates.
- `.claude/rules/anchor-to-human-prior-art.md` — Avro and Protocol Buffers are
  the checked anchors for clause 1.
- PRs #10722, #10730, #10732 — the three that stopped here.

> **Proposed, not self-authorized:** clauses 1–4 are a standing engineering
> discipline and would fit `.claude/rules/` as a carved sentence. Adding a
> context-startup-loaded surface is razored (cold-start tokens on every wake, for
> every agent), so it is proposed for a human call rather than taken.
