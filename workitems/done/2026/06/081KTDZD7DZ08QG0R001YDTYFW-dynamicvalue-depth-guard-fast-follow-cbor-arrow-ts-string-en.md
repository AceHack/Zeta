---
id: 081KTDZD7DZ08QG0R001YDTYFW
type: task
state: backlog
priority: P2
slug: dynamicvalue-depth-guard-fast-follow-cbor-arrow-ts-string-en
title: "DynamicValue depth-guard fast-follow: CBOR/Arrow + TS string-encoders, cross-lang boundary tests, Rust non_exhaustive, TS DecodeError unification"
created: 2026-06-06T08:04:51.263Z
depends_on: []
composes_with: []
---

# DynamicValue depth-guard fast-follow: CBOR/Arrow + TS string-encoders, cross-lang boundary tests, Rust non_exhaustive, TS DecodeError unification

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTDZD7DZ08QG0R001YDTYFW-*.md` glob. -->

## Context

The windows-x64 codec StackOverflow P0 (commit `4d4eaa7e6`, 2026-06-06) was fixed by adding a
`NestingTooDeep` error case + a `maxNestingDepth = 256` recursion-depth guard to the **JSON + XML**
encode + decode paths across all four languages (F#/C#/Rust/TS). Ilyana (public-api-designer) reviewed
the surface; see `memory/persona/ilyana/NOTEBOOK.md` 2026-06-06. These items were deliberately deferred
out of that change (no failing test, or a larger API decision). None block the gate.

## Deferred items

1. **CBOR + Arrow codecs lack a depth guard.** They recurse on nesting like JSON/XML but were not
   guarded because their **encoders return `byte[]` (total, no `Error` channel)** — adding
   `NestingTooDeep` there needs a return-type change (`byte[]` → `Result<byte[], EncodeError>`), a
   bigger public-API break. The CBOR/Arrow *decoders* return `Result` and could be guarded additively
   (cleaner), but were left out to keep CBOR/Arrow a coherent unit. Decision needed: change the encoder
   return types (route past Ilyana) vs. accept CBOR/Arrow encoders are SOF-vulnerable on pathological
   depth (no current trigger).
2. **TS string-returning encoders.** `canonicalJson`/`canonicalXml` in `src/Core.TypeScript/dynamic-value/`
   return plain `string` (no `Error` channel) — same shape as the CBOR encoder problem. Guarding them
   needs a throw or a return-type change.
3. **Boundary tests in C#/Rust/TS.** F# has the boundary contract test (depth 256 → Ok, 257 →
   `NestingTooDeep`, in `tests/Tests.FSharp/Fuzz.DecodeBoundary.Tests.fs`). Mirror it in the C#, Rust,
   and TS suites so the published boundary is pinned in every oracle (Viktor's golden-vector ask).
4. **Rust `#[non_exhaustive]` on the error enums.** `EncodeError`/`DecodeError` in
   `src/Core.Rust.DynamicValue/src/lib.rs` are NOT `#[non_exhaustive]`, so each added variant is a
   breaking change for any external `match`. Landing `#[non_exhaustive]` now is free pre-v1 and stops
   future case additions from breaking downstream. (Ilyana flag.)
5. **TS per-codec `DecodeError` fragmentation.** TS has THREE divergent `DecodeError` unions
   (`json.ts`, `cbor.ts`, `xml.ts`) + no Arrow TS codec, so "mirrored across four languages" is not
   literally true on the TS side. Consider unifying to one shared union. (Ilyana flag — API-shape smell.)

## Acceptance

Each item either landed (guarded + tested + parity preserved) or explicitly declined in `docs/WONT-DO.md`
with a reason. Keep the four-language parity invariant intact for whatever lands.
