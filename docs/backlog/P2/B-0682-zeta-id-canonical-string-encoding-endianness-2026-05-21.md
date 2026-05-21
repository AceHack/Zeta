---
id: B-0682
priority: P2
status: open
title: ZetaId canonical string encoding (Crockford base32) + endianness + bit-numbering spec
tier: research-grade
effort: S
ask: maintainer Aaron + Kestrel-claude.ai 2026-05-21
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [B-0635, B-0679, B-0680, B-0681]
tags: [zeta-id, cross-language, git-filename]
type: feature
---

# ZetaId canonical string encoding + endianness + bit-numbering

## Context

Kestrel 2026-05-21 review: V1 spec asserts cross-language consistency
but doesn't define:

- Endianness on the wire
- Bit-numbering convention (MSB-0 vs LSB-0)
- Canonical string form

F# + C# share .NET runtime so they agree by accident. TypeScript via
BigInt + Rust via u128 + Python via int will NOT necessarily agree
without explicit spec. The first cross-language bug will be subtle
and the second expensive.

Aaron's deployment context: **ZetaId is used in git filenames first.**

Git filename length matters: path-length limits (260 Windows historical,
longer POSIX), and the ID is presumably concatenated with semantic
suffixes (chromosome/category labels).

## Scope

### 1. Canonical string encoding: Crockford base32

Per Kestrel: 128 bits in hex is 32 chars, in base32 is 26 chars,
in base62 is 22 chars.

**Pick Crockford base32** (https://www.crockford.com/base32.html):

- Case-insensitive (matters on case-insensitive filesystems like
  default macOS/Windows)
- URL-safe (no `/` or `+`)
- 26 chars for 128 bits (compact for filenames)
- ULID uses Crockford base32 for exactly this reason
- Excludes ambiguous chars (I, L, O, U) — reduces visual confusion

Spec section: `canonical_string_encoding: crockford-base32` with
worked examples for the 12 canonical vectors.

### 2. Endianness specification

Pick big-endian (network byte order) for the on-wire 16-byte
representation. Spec the byte order explicitly:

  byte[0] = most-significant byte (bits 120-127)
  byte[1] = bits 112-119
  ...
  byte[15] = least-significant byte (bits 0-7)

Reference 12 canonical vectors with both hex and Crockford base32
serializations + the byte-array spelling.

### 3. Bit-numbering convention

Document MSB-0 vs LSB-0:

Current v1 implementations (TS + C#) use LSB-0 — bit 0 is the
least significant bit, bit 127 is the most significant. Spec should
state this explicitly so future Rust/Python implementations don't
flip.

### 4. Cross-implementation test fixture

Add to `tests/cross-verification/zeta-id/`:

- `vectors.yaml` — extend with `expected_crockford` field alongside
  `expected_hex` for each vector
- Each per-language harness writes both `*-output.json` (hex) AND
  the Crockford string for verification

## Acceptance

- `docs/zeta-id-canonical-string-encoding.md` spec written
- TS + C# implementations + tests output canonical Crockford strings
  matching `expected_crockford` in vectors.yaml
- 5-way cross-verify (TS + C# + F# + Rust + Python) agrees on both
  hex AND Crockford strings on all 12 vectors

## Composes with

- B-0681 (v2 spec hardening) — these fields may shift bit positions
- B-0679 / B-0680 (Rust + Python) — implementations adopt the encoding
- Git-filename-first deployment per Aaron (B-0517 substrate)
