---
id: 081M013YK3T087G0R002KQ87MT
type: bug
state: backlog
priority: P2
slug: packgeneric-packgeneric-truncate-an-over-cap-payload-instead
title: "PackGeneric/packGeneric truncate an over-cap payload instead of rejecting it (C#/F# parity with the TS bound)"
created: 2026-08-14T21:48:17.914Z
depends_on: []
composes_with: []
---

# PackGeneric/packGeneric truncate an over-cap payload instead of rejecting it (C#/F# parity with the TS bound)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M013YK3T087G0R002KQ87MT-*.md` glob. -->

## The defect

The 128-bit Generic layout gives the payload **119 bits** (65 low + 54 high).
`ZetaIdCodec.PackGeneric` (C#) and `ZetaIdCodec.packGeneric` (F#) **masked**
an oversized payload rather than validating it, so an over-cap payload was
silently truncated — which **aliases ids instead of failing**.

The aliasing has a date, so a reader in 2038 has a falsifier rather than a shrug:

> At **2039-09-07T15:47:35.552Z**, a caller building `(ms << 78) | random78`
> reaches `ms = 2^41`, the top ms bit is masked off, and the id is
> **byte-identical** to the same call with `ms = 0` — a wrap to 1970 and a
> real collision, silently, forever.

Reproduced pre-fix in both oracles: C# and F# each emitted
`080000000000A0000000000000` for both the cliff and `ms = 0`.

## Why it matters more than "no caller today"

Every in-repo caller goes through the validating `PackPayload` / `packPayload`
wrapper, so the bound is **inert for every id mintable today**. The exposure is
a **future** caller reaching past the wrapper — exactly the mistake
`src/Core.TypeScript/inventory/new-item.ts` made on the TypeScript side.

And the headroom is **zero, not comfortable**: both ids committed under
`inventory/items/` carry payloads of **exactly 119 bits**. One more bit of clock
overflows the design. The cliff is structural, not a rounding accident.

## Resolution

Bound moved into the primitive in both oracles; over-cap payloads now throw
`ArgumentOutOfRangeException`. Peer tests at
`tests/Tests.CSharp/ZetaId/PackGenericBoundTests.cs` and
`tests/Tests.FSharp/ZetaId/PackGenericBound.Tests.fs`.

Parity with the TypeScript half (PR #10715), which recorded this gap rather
than bundling it.

## Notes

- **Rust, Python, Go and MUMPS have no generic-pack surface at all** —
  re-confirmed independently (zero hits for `generic` or `119` in their ZetaId
  sources); they expose only the structured `pack`. Nothing to fix there.
- **The negative-payload aliasing class does not exist in C#/F#.** On the TS
  side `payload` is a signed `bigint`, so masking made `-1n` indistinguishable
  from all-ones. Here the parameter is `System.UInt128` — unsigned — so a
  negative cannot be admitted. The reachable analogue (`UInt128.MaxValue`, the
  same all-ones pattern a reinterpreted `-1` produces) is covered by a test.
- **The cross-verification byte-lock vectors do not exercise this path**: all 16
  vectors are category 0 or 3, both `< 9`, so they route to the observation
  `pack`. Cross-verify is silent on this change in both directions.
- No minting site changed. `src/Core.TypeScript/inventory/new-item.ts` writes to the offset it
  intends and was deliberately left alone.
