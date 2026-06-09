# Tests become our rooms — and the first room is a 6×6, not a 4×4: six language oracles (fs cs ts rs py go) × six serializers (xml yml cbor json arrow protobuf/grpc)

**Register:** [grounded] matrix expansion (Aaron, w/ Max). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Updates the treaty-room dimensions; the "4×4" was the floor, the first concrete room is 6×6.

## Aaron's words

> "talked to Max and tests become our 4×4 rooms — first one actually gonna be a 6×6 room: fs cs ts rs
> py go × xml yml cbor json arrow protobuf/grpc."

## The room grows: 4×4 was the floor; the first real room is 6×6

The treaty-room shape has been **4 oracles × 4 serializers** (the byte-lock core). Talking with Max,
the **first concrete room is a 6×6** — the matrix is bigger than the carved floor:

```text
            xml    yml    cbor   json   arrow  protobuf/grpc
  F# (fs)    .      .      .      .      .      .
  C# (cs)    .      .      .      .      .      .
  TS (ts)   [J/C/X locked — keyring-4x4]      .      .         <- first cells filled
  Rust (rs)  .      .      .      .      .      .
  Python(py) .      .      .      .      .      .
  Go (go)    .      .      .      .      .      .
```

- **6 language oracles:** F# (`fs`), C# (`cs`), TypeScript (`ts`), Rust (`rs`), **Python (`py`)**,
  **Go (`go`)**. (py + go are the new oracles beyond the prior four.)
- **6 serializers:** XML, **YAML**, CBOR, JSON, Arrow, **Protobuf/gRPC**. (yaml + arrow + protobuf/grpc
  beyond the JSON/CBOR/XML already locked in TS.)

"4×4" stays the **carved floor / minimum** (every room is *at least* 4×4×n); a given room convenes the
oracles + serializers it needs, and the **first one is 6×6** = 36 cells of byte-lock + cross-oracle
agreement.

## What this updates

- **The keyring serializer work is the first cells of this 6×6.** `keyring-4x4.ts` locked TS ×
  {JSON, CBOR, XML} with 3-way commute. Under the 6×6 target the remaining serializer cells for TS are
  **YAML, Arrow, Protobuf/gRPC**, and the remaining oracle rows are **F#, C#, Rust, Python, Go** —
  each replaying the same golden vectors byte-for-byte. (Rename intent: the "4×4" tooling names are the
  floor; the matrix it fills is 6×6. No code rename needed yet — the golden vectors are oracle/
  serializer-agnostic; we just add rows + columns.)
- **Substrate already has most serializers** (reuse, don't reinvent): JSON/CBOR/XML/YAML + Arrow
  (`golden-vectors-arrow.json`) + Protobuf (`Protobuf.fs`) exist on the F#/TS side. The new build is
  mostly the **Python + Go oracles** + filling the YAML/Arrow/Protobuf cells for each oracle.
- **Soraya's K1 (4×4 determinism) generalizes to 6×6:** the byte-lock + commute proof-room now spans
  36 cells; the cross-check (BP-16) is naturally satisfied — six independent oracles per serializer is
  far past the ≥2-tool bar.

## Why 6×6 (the point)

More oracles + more serializers = **more independent witnesses to the same canonical bytes**. Six
languages that disagree on nothing is a far stronger byte-lock than four — and **py + go** pull in two
huge ecosystems (data/ML + cloud/infra), while **protobuf/gRPC** is the lingua franca for
service interop and **YAML** for human-facing config. The treaty gets harder to fake and wider to
interoperate with in one move. (Self-similar §10: the room shape is the same — 4×4 floor × n — just
magnified.)

## Honest scope / handoff

A dimension update, not a new mechanism; the room shape (4×4×n) is unchanged, the first instance is
larger. To realize: stand up the **Python + Go keyring/serializer oracles**, fill the **YAML/Arrow/
Protobuf-gRPC** serializer cells, and have all six oracles replay the keyring golden vectors. Routes to
the F#/C#/TS/Rust/Python/Go cores (the six oracles), Dejan (CI runners for py + go), Soraya (K1 → 6×6
proof-room), the existing serializer substrate (reuse JSON/CBOR/XML/YAML/Arrow/Protobuf).

## Anchors / ties

The 4×4 byte-lock treaty (now the floor, first room 6×6); `keyring-4x4.ts` (first cells: TS ×
{JSON,CBOR,XML}); the dynamic-value serializer substrate (`golden-vectors-{cbor,arrow,xml,values}.json`,
`Protobuf.fs`, the yaml codec); Soraya's K1 determinism proof-room; "every room is 4×4×n"; reuse-don't-
reinvent (Rodney's Razor); self-similar §10. Max as co-author of the dimension call.
