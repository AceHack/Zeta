# Crypto forward, 4×4 style — the keyring's serializer axis is bootstrapped: JSON + CBOR byte-locked, commute proven, the golden seeds the four oracles

**Register:** [grounded] build (Aaron: "push crypto forward 4x4 style"). **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Wires the keyring into the existing byte-lock substrate, not a reinvention.

## What "4×4 style" means for the keyring

The keyring treaty is **4 language oracles × 4 serializers**, byte-locked, golden-vectored,
DST-replayable (the Amara ferry / `no-sh-inside-the-boundary` doc). This step lands the **serializer
axis** by **reusing the repo's existing canonical serializers** (`src/Core.TypeScript/dynamic-value/`)
rather than writing new ones — the keyring becomes one more value the byte-lock substrate already locks.

## What landed (PR-shipped, green)

- **`keyring-4x4.ts`** — encodes the deterministic **public** keyring as a language-neutral `Tagged`
  value (all leaves are strings; insertion-order canonical because `derive.ts` builds `pub` in fixed
  order) and serializes it across the locked serializers: **canonical-JSON** (`json.ts`, RFC 8259
  minimal) + **canonical-CBOR** (`cbor.ts`, RFC 8949 preferred). CBOR is stored **hex-in-JSON** (text,
  per `no-binary-in-proof-lineage` — diffable, DST-replayable, no binary in the proof lineage).
- **`golden-vectors-keyring-4x4.json`** — the byte-lock: the golden seed →
  `{ canonical_json, canonical_cbor_hex }`. **This golden IS the treaty seed** the F#/C#/Rust oracles
  must replay byte-for-byte.
- **`keyring-4x4.test.ts` (6 pass)** — proves: **COMMUTE** (JSON and CBOR decode to the *same* keyring
  — the 4×4 cross-serializer agreement, mirroring `dynamic-value/format-matrix.test.ts`); **BYTE-LOCK**
  (serialized bytes match the golden exactly); **ROUND-TRIP** (decode∘encode = id per serializer);
  **DETERMINISM** (re-derive + re-serialize byte-identical); the CBOR hex is text + even-length; no
  private material leaks into either form.

## The 4×4 matrix status (honest)

```text
              JSON      CBOR      Arrow     XML/YAML
F# oracle      .         .         .         .
C# oracle      .         .         .         .
TS oracle    [LOCKED]  [LOCKED]    .         .       <- this PR (commute proven, golden seeded)
Rust oracle    .         .         .         .
```

- **Done:** the TS oracle × {JSON, CBOR} cell — locked, commuting, golden-seeded.
- **Next (serializer axis):** add Arrow + XML/YAML for the TS oracle (the dynamic-value substrate
  already has `golden-vectors-arrow.json` / `xml.ts` to reuse — same pattern).
- **Next (oracle axis):** F#/C#/Rust keyring derivation replaying this exact golden (the cross-language
  byte-lock; the golden vector is the conformance target — "the compilers don't lie").
- **Composes with:** the dual-key set (`keyset.ts`, PR #7349) — a `KeyringSet`'s public projection
  serializes the same way; and Soraya's **K3** (no-single-key) + **K1** (1000× determinism) proof-rooms.

## Honest scope / handoff

The serializer axis is bootstrapped (2 of 4 serializers, TS oracle); commute + byte-lock + determinism
proven. Reuses existing substrate (no new serializer). To finish 4×4: Arrow + XML for TS, then the
three other language oracles replaying the golden. Routes to the F#/C#/Rust core (oracle axis), Soraya
(K1/K3 proof-rooms), Dejan (CI gate for the 4×4 golden, alongside `keyring-dst1000.yml`).

## Anchors / ties

RFC 8259 (canonical JSON) · RFC 8949 (canonical CBOR, preferred encoding) — via the repo's
`dynamic-value` serializers (the existing 4×4 substrate: `golden-vectors-cbor/arrow/xml/values.json`,
`format-matrix.test.ts`); `no-binary-in-proof-lineage` (CBOR as hex-in-JSON); `derive.ts` (the keyring
oracle); `keyset.ts` (dual-key, PR #7349); the keyring-4×4-treaty docs; Soraya's K1/K3.
