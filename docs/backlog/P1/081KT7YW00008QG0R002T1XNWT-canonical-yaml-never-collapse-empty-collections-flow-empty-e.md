---
id: 081KT7YW00008QG0R002T1XNWT
priority: P1
status: closed
closed: 2026-06-04
title: "✅ LANDED 2026-06-04 — Canonical YAML never-collapse of empty collections — emit flow `{}` / `[]` so empty `{}`, empty `[]`, and `null` round-trip as THREE distinct states (encode-injective; SQL-null/monad-preservation across the boundary; parity with proven CBOR injectivity). Found by FsCheck (minimal case `Object []`); cross-lang scanner+dom+encoder+cross-verify change across TS/F#/Rust+C# (Aaron 2026-06-04)"
tier: serializer
effort: M
ask: maintainer Aaron 2026-06-04
created: 2026-06-04
type: task
depends_on: []
---

# 081KT7YW00008QG0R002T1XNWT — Canonical YAML must never-collapse empty collections (flow `{}` / `[]`)

> **✅ LANDED 2026-06-04.** Implemented across all four oracles (TS reference +
> F#/Rust/C# ports): encoder emits inline flow `{}` / `[]` for empties; reader
> tokenizes `{}` / `[]` value tokens into empty container event-pairs; DOM unchanged.
> 5 cross-verify vectors added (`empty-flow-*`), 4-way `compare.ts` agreement on 15
> vectors. F# `DynamicValueYamlBridgeTests` never-collapse fact un-skipped + green;
> round-trip + injectivity properties restored to include empties. Full solution
> build 0 warnings. NOTE: top-level *bare* empty documents remain out-of-subset (the
> pre-existing bare-document parser gap; empties as VALUES — the storage case — fully
> round-trip). Schema-mode absent→null completion (Aaron's later nuance) is a separate
> decode-time concern, not this wire fix.

**Priority:** P1 (correctness — storage-of-record format violates encode-injectivity)
**Filed:** 2026-06-04 (Aaron) — found by FsCheck on the new YAML round-trip property
(`DynamicValueYamlBridgeTests`, minimal case `Object []`).
**Relates:** 081KT5CF90008QG0R001P4CQ09 (serializer round-trip-from-seed) · `docs/serializer-recursion-schemes.md`

## The requirement

Serialization must **never collapse two states that are actually different**
(Aaron 2026-06-04: "SQL null as a monad propagator … should never collapse two
states that are actually different"; "tri-boolean everywhere … empty is different
than not set … monadic properties propagate across serialization boundaries").

`null` (not-set), empty `{}` (set-but-empty map), and empty `[]` (set-but-empty
seq) are **three distinct states** and MUST round-trip distinctly. Equivalently:
**canonical encode must be INJECTIVE** — the property already proven for CBOR
(`CANONICAL DynamicValue: canonical CBOR encoding is INJECTIVE`); JSON + CBOR golden
vectors already carry `array-empty` / `object-empty`. Only YAML violates it.

## The bug

Canonical BLOCK YAML cannot represent an empty collection (block needs ≥1 entry).
Today empty `VMap`/`VSeq` encode to a bare `"key":` which parses back as **null** —
so `{}`, `[]`, and `null` all collapse to one indistinguishable state. The encoder
header explicitly scoped this "out of v1"; this row is v2.

## The fix (deliberate, cross-language — do NOT do unilaterally)

Canonical YAML emits flow `{}` / `[]` for empty collections — the one necessary,
unambiguous flow exception to the otherwise block-only / flow-rejected rule. This is
a canonical-spec change touching, in **all four oracles** (TS reference / F# / Rust +
the C# encoder), so the faithful-port + byte-lock treaty stays intact:

1. **Scanner** (`Reader.fs` / `yaml/reader.ts` / `rust .../reader.rs`) — tokenize
   `{}` and `[]` as empty-map / empty-seq events.
2. **DOM fold** (`Dom.fs` / `dom.ts` / `dom.rs`) — fold those events to `VMap []` /
   `VSeq []`.
3. **Encoder** (`Encoder.fs` / `encoder.ts` / C# encoder) — emit `key: {}` /
   `key: []` (and top-level / seq-item empties).
4. **Cross-verification vectors** (`tests/cross-verification/yaml/vectors.json`) —
   add empty-collection cases so all four byte-lock on the same flow-empty form.

## Done-when

- `DynamicValueYamlBridgeTests.``REQUIRED never-collapse: empty {} and [] round-trip
  DISTINCT from null and from each other``` un-skipped and green (currently
  `[<Fact(Skip="081KT7YW00008QG0R002T1XNWT…")>]`).
- The YAML round-trip property generator restored to include empties (n ≥ 0).
- All four YAML oracles byte-lock on the flow-empty vectors.
- `encode` proven injective for YAML on the locked subset (parity with CBOR).
