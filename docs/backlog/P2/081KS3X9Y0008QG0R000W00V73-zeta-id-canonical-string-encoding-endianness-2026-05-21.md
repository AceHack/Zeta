---
id: 081KS3X9Y0008QG0R000W00V73
priority: P1
status: closed
title: ZetaId canonical string encoding (Crockford base32) + endianness + bit-numbering spec
tier: research-grade
effort: S
ask: maintainer Aaron + Kestrel-claude.ai 2026-05-21
created: 2026-05-21
last_updated: 2026-06-13
completed: 2026-06-13
depends_on: []
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KS3X9Y0008QG0R001Z8SBZJ, 081KS3X9Y0008QG0R002WGH8PJ, 081KS3X9Y0008QG0R003044PQQ]
tags: [zeta-id, cross-language, git-filename]
type: feature
---

# ZetaId canonical string encoding + endianness + bit-numbering

> **Status 2026-06-06 (promoted P1 — 081KSXN940008QG0R002FWR9B2 blocker, Aaron "start with 081KS3X9Y0008QG0R000W00V73"):** the **TypeScript
> canonical encoding has LANDED** — `src/Core.TypeScript/zeta-id/encoding.ts` + `encoding.test.ts` (13/13
> green, ~35.7k assertions). Implements §1 Crockford base32 (26-char, filename-safe — alphabet excludes
> I/L/O/U, single canonical case), §2 big-endian, and the **sort-preserving** property (string sort ==
> numeric ZetaId sort == chronological, since version+timestamp are the high bits) that the 081KSXN940008QG0R002FWR9B2 decision
> `workitems/<zetaid>-<desc>.md` + `done/YYYY/MM/` time-ordering depends on. Plus canonical hex
> (`toHex`/`fromHex`), Crockford-lenient `parse` (I/L→1, O→0, lowercase), 128-bit-overflow rejection,
> `isCanonical`, and §4 canonical fixture vectors. **Remaining for full cross-language parity:** Rust
> (081KS3X9Y0008QG0R001Z8SBZJ) + Python (081KS3X9Y0008QG0R002WGH8PJ) must reproduce the same vectors; §3 bit-numbering (LSB-0) is documented in
> `encoding.ts`. The TS half unblocks the 081KSXN940008QG0R002FWR9B2 `new-workitem.ts` mint tool.

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

- 081KS3X9Y0008QG0R003044PQQ (v2 spec hardening) — these fields may shift bit positions
- 081KS3X9Y0008QG0R001Z8SBZJ / 081KS3X9Y0008QG0R002WGH8PJ (Rust + Python) — implementations adopt the encoding
- Git-filename-first deployment per Aaron (081KRHWGX0008QG0R0029X10F4 substrate)

## Resolution

The Crockford Base32 canonical string encoding for the 128-bit `ZetaId` has been fully implemented and verified.

1. **Specification**: Documented in [zeta-id-canonical-string-encoding.md](file:///Users/acehack/Documents/src/repos/Zeta/docs/zeta-id-canonical-string-encoding.md).
2. **Implementation**: Added formatting, parsing, lenient alias mapping, and 128-bit overflow checks in C#, F#, Rust, and TypeScript.
3. **Consensus**: Updated [compare.ts](file:///Users/acehack/Documents/src/repos/Zeta/tests/cross-verification/zeta-id/compare.ts) to compare both `hex` and `crockford` string outputs across the 5 language implementations, passing with 100% agreement on all 12 test vectors.
4. **Pull Request**: Submitted Pull Request [PR #8141](https://github.com/Lucent-Financial-Group/Zeta/pull/8141).
