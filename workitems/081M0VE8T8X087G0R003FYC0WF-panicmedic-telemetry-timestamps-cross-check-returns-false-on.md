---
id: 081M0VE8T8X087G0R003FYC0WF
type: bug
state: backlog
priority: P2
slug: panicmedic-telemetry-timestamps-cross-check-returns-false-on
title: "panicmedic telemetry/timestamps cross-check returns false on live data: the two NVRAM variables differ by exactly 1,000,000 us"
created: 2026-08-25T03:08:53.917Z
depends_on: []
composes_with: []
---

# panicmedic telemetry/timestamps cross-check returns false on live data: the two NVRAM variables differ by exactly 1,000,000 us

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0VE8T8X087G0R003FYC0WF-*.md` glob. -->

## The claim

`src/Core.TypeScript/forensics/panicmedic.ts` states that the panic instant is
identified — not guessed — because two *separately encoded* NVRAM variables carry
the same 64-bit microsecond value.

Module header (lines 19–24):

> The
> same 8-byte value appears twice inside `panicmedic-telemetry` at offsets 8
> and 16, which is the cross-check that pins the unit.

`PanicmedicState.telemetryTimestampsUs` (lines 121–127):

> The microsecond timestamps embedded at offsets 8 and 16 of the telemetry
> blob. These are the CROSS-CHECK on `timestamps`: two independent encodings
> of the same instant in two different NVRAM variables. When they disagree,
> the decode is wrong and must not be trusted.

`telemetryAgreesWithTimestamps` (lines 196–209):

> True when the timestamp in `panicmedic-timestamps` agrees with BOTH copies
> embedded in `panicmedic-telemetry`. This is what promotes the microsecond
> reading from "a number that looks like a date" to an identification: two
> separately-encoded NVRAM variables carry the same 64-bit value, and
> `kern.boottime` lands seconds after it.

```ts
export function telemetryAgreesWithTimestamps(state: PanicmedicState): boolean | null {
  const primary = mostRecentPanicMs(state);
  if (primary === null || state.telemetryTimestampsUs.length === 0) return null;
  return state.telemetryTimestampsUs.every((us) => us / 1000 === primary);
}
```

`docs/runbooks/macos-unclean-reboot.md:130` restates it: *"binary; carries the
same µs value at offsets 8 and 16 — the cross-check"*.

## The live counter-example

`AceHacks-Mac-Studio`, 2026-08-25T03:0x UTC, watchdog reset the same night.
`nvram -p` verbatim:

```
panicmedic-timestamps	0:659d5fd687db9
panicmedic-auxkc-present	true
panicmedic-telemetry	%11%01%00%00%00%00%00%00y;Y%fd%d5Y%06%00y;Y%fd%d5Y%06%00A%01%00%00%00%00%00%00 (+111 %00 pad bytes)
```

Running the shipped module over that exact dump:

| quantity | value |
|---|---|
| `panicmedic-timestamps` raw | `0:659d5fd687db9` |
| decoded `atMs` / `iso` | `1787625474653.625` / `2026-08-25T02:37:54.653Z` |
| `telemetryTimestampsUs` | `[1787625473653625, 1787625473653625]` |
| `telemetryUnknownFields` | `[273, 321]` (unchanged — still 0x111 / 0x141) |
| **`telemetryAgreesWithTimestamps`** | **`false`** |

Byte level, so the decode itself is not in question:

```
telemetry bytes 0..31 = 11 01 00 00 00 00 00 00  79 3b 59 fd d5 59 06 00
                        79 3b 59 fd d5 59 06 00  41 01 00 00 00 00 00 00
offsets 8 and 16, LE u64 = 0x000659d5fd593b79 = 1787625473653625
panicmedic-timestamps    = 0x0000659d5fd687db9 = 1787625474653625
delta                    = 1000000 = 0xF4240
```

The two copies *inside* the telemetry blob still agree with each other. What
fails is the **cross-variable** half of the claim.

### The delta is exactly 1.000000 s and is not a rounding artifact

Checked in exact integer arithmetic, not floats:

- `BigInt("0x659d5fd687db9") - BigInt("0x659d5fd593b79") === 1000000n` — exact.
- Both values are `Number.isSafeInteger` and round-trip `BigInt(Number(v)) === v`,
  so no precision was lost reaching the JS number domain.
- Both `us / 1000` divisions performed by the function are *exact*
  (`q * 1000 === v`), so the `===` comparison is doing exactly what it appears to.
- The observed gap is 1000 ms against a ULP of ~0.00024 ms at this magnitude —
  **4,096,000× the float epsilon.** This cannot be a decode or rounding artifact.

A delta that is a round number in **decimal microseconds** (10^6) and *not* a
round number in hex is itself evidence: this is a one-second semantic offset,
not a bit error, not a truncation, not an off-by-one in the byte reader.

## Corroboration: which variable matches the panic instant

Independent witnesses put `panicmedic-timestamps` — the *later* of the two — at
the real event:

- `sysctl kern.boottime` = `{ sec = 1787625493, usec = 559935 }` = **22:38:13 EDT**.
- `/Library/Logs/DiagnosticReports/ResetCounter-2026-08-24-223927.diag`:
  `Reset count: 1`, **`Boot faults: wdog,reset_in1`** — a watchdog reset, i.e. a
  genuinely unclean stop.
- `last reboot` newest record: `reboot time Mon Aug 24 22:38`, with no preceding
  `shutdown time` — unclean by the module's own discriminator.

Gap to the following boot: **18.35 s** from `panicmedic-timestamps`, **19.35 s**
from the telemetry copies. Both are plausible reset-and-reboot intervals, so
`kern.boottime` does not by itself adjudicate — but the panic instant reported by
the machine (22:37:54) matches `panicmedic-timestamps` (22:37:54.653), not the
telemetry copies (22:37:53.653).

## What is NOT determined

Deliberately left open rather than guessed at, per
`.claude/rules/numerology-vs-number-theory.md`:

1. **Whether the two variables latch at genuinely different instants.** A
   plausible reading is that `panicmedic-telemetry` is written by an earlier
   stage of the panic path than `panicmedic-timestamps`, and a ~1 s separation
   between those stages is ordinary. If so the module's premise is simply wrong:
   they are two instants, never one, and equality was never the right predicate.
2. **Whether the identification is wrong** — i.e. offsets 8/16 are not a copy of
   the panic timestamp at all, but a different (start-of-panic, last-tick,
   watchdog-arm) timestamp that merely *resembled* it in the one sample that was
   captured.
3. **Whether the exact 10^6 is structural or coincidental.** One sample. Exactly
   1.000000 s is suspicious enough to be worth a second sample and cheap enough
   to collect on the next unclean boot — but a single coincidence of counts is
   not an identification.

**No fix is proposed here, and none should be guessed at.** Loosening the
predicate to a tolerance would manufacture agreement without understanding the
mechanism, and the whole value of this function is that it refuses to do that.

## The falsifier that was missing

There *is* a disagreement test today — `panicmedic.test.ts:90` *"MUTANT: corrupt
one embedded copy and the agreement fails"* — so the function is not vacuous: it
provably can return `false`. That much is fine.

What was missing is the distinction between **the function works** and **the
claim is true**:

- The mutant zeroes bytes in a fixture. It proves the *code path* exists.
- Every test built on *real hardware data* used **one sample**
  (`REAL_TIMESTAMPS` / `REAL_TELEMETRY`, the 08:16:59 event), and in that one
  sample the two variables happen to agree.
- So no test could ever have failed on a genuine, uncorrupted second sample where
  the two variables disagree — which is precisely the observation the header
  offers as its evidence.

The claim "two separately-encoded NVRAM variables carry the same 64-bit value" is
a claim about **hardware**, and it was only ever checked against **one** reading
of that hardware. N=1 with no contrary sample is not a cross-check; it is a
coincidence that had not yet been contradicted. It has now been contradicted.

## What this work-item ships

A regression test only (`panicmedic.test.ts`), encoding the live 2026-08-25 dump
verbatim as a second real-hardware fixture and pinning
`telemetryAgreesWithTimestamps(...) === false` for it, alongside the byte-level
values and the exact-1e6 delta. **Production logic is unchanged on purpose** —
the mechanism is undetermined, and recording the fact is strictly better than
guessing at a fix.

Follow-on, out of scope here: decide whether the header, the
`telemetryTimestampsUs` docstring, and `docs/runbooks/macos-unclean-reboot.md:130`
should be downgraded from "the cross-check that pins the unit" to "a second
timestamp of undetermined relationship", once a second unclean boot supplies
another sample.
