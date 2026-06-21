---
id: 081KS3X9Y0008QG0R001Z8SBZJ
priority: P2
status: closed
title: ZetaId V1 — Rust implementation as full peer oracle
tier: research-grade
effort: M
ask: maintainer Aaron + Mika 2026-05-21
created: 2026-05-21
last_updated: 2026-06-01
depends_on: []
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R00088FYE9, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R002YAA09X, 081KRW63S0008QG0R001SAHYKV]
tags: [zeta-id, multi-oracle, rust, cross-verification]
type: feature
---

# ZetaId V1 — Rust implementation as full peer oracle

## Context

The V1 ZetaId 128-bit canonical observation contract landed via PR #4517
(constitutional substrate + TS oracle) + PR #4519 (review-finding fixes) +
the in-flight C# integration (PR after this row files).

Per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`, all
implementations are FULL PEER ORACLES — no single language is source of
truth; multi-oracle agreement IS the verification. Rust joins as the 4th
oracle after the F# + TS + C# trio is stable.

## Scope

Add a Rust crate at `src/Core.Rust.ZetaId/` (or similar layout matching
Zeta's existing Rust conventions, if any):

- `Cargo.toml`
- `src/lib.rs` — `Authority` enum (with `Raw(u8)` variant), `Momentum`
  enum (with `Raw(u8)` variant), `ZetaObservation` struct, `IdVersion`
  / `Chromosome` / `Category` / `Firefly` / `Persona` / `Location` enums
- `src/bit_layout.rs` — computed offsets with reserved-bits at offset 69
  - offsets 32-34 (per `docs/zeta-id-v1-layout.yaml`)
- `src/zeta_id.rs` — `pack(obs, env)` requires `&dyn SimulationEnvironment`
  (or trait); `unpack(id)` inverse; same canonical hex as TS + F# + C#
- `tests/cross_verify.rs` — reads `tests/cross-verification/zeta-id/vectors.yaml`
  via `serde_yaml` + writes `rust-output.json` to the same directory
- `compare.ts` becomes 4-way deep-equal across `ts-output.json` +
  `cs-output.json` + `fsharp-output.json` + `rust-output.json`

## Acceptance

- `cargo build --release` clean (0 warnings, 0 errors)
- `cargo test cross_verify --release` produces `rust-output.json` with
  12/12 `roundtrip_ok: true` AND 12/12 `matches_expected: true`
- `bun tests/cross-verification/zeta-id/compare.ts` reports 4-way agreement
- F# Authority cases (HumanVerified=31, TrustedAgent=20, Standard=15,
  BestEffort=8, Simulated=3) + Momentum cases (Background=32, Normal=96,
  Elevated=160, High=224, Critical=248) match exactly
- Test paste-verified in commit message (compile-and-test-first per the
  V1 V8→V9 lesson)

## Discipline reminders (from V1 cycle)

- **Compile-and-test-first**: do not claim "verified locally" without
  pasting actual `cargo test` output. The V1 cycle proved 8 rounds of
  speculative review missed bugs that empirical compile caught first try.
- **Reserved bits in BitLayout**: 1 bit at offset 69 (between Chromosome
  and Category), 3 bits at offsets 32-34 (between Location and Randomness).
  Don't pack contiguously — that's the exact bug C# V8 hit before fix-up.
- **No silent-zero fallback on randomness**: `pack` requires an explicit
  environment parameter. Provide `DETERMINISTIC_ENV` (always 0, for
  cross-verify) and `DEFAULT_ENV` (cryptographic, for production).
- **Cross-verify exits non-zero on mismatch**: `process::exit(1)` when any
  hex or roundtrip mismatches. No silent-non-enforcing harness.

## Non-goals

- Smart deserialization + anchors (separate B-NNNN once TS prototypes it)
- CloudEvents envelope wrapping (separate B-NNNN; rich layer, not the
  bit-packed core)
- `registry/locations.yaml` provider-mapping (separate B-NNNN per `Location.cs`
  inline note)
- Performance benchmarking (Phase 2 follow-up; correctness first)

## Why P2

Important for multi-oracle resilience but doesn't block V1 substrate
landing. Implementation work waits until F# V9 + smart-deser TS prototype
land cleanly.

## Resolution (2026-06-01) — CLOSED, acceptance met

Rust crate landed at `src/Core.Rust.ZetaId/` — a zero-dep core (`lib.rs`,
`bit_layout.rs`, `zeta_id.rs`) plus `tests/cross_verify.rs`. ZetaId is now a
**4-oracle primitive** (TS / F# / C# / Rust) with byte-for-byte consensus on all
12 shared vectors.

Acceptance, with pasted proof:

- `cargo build --release` — clean, **0 warnings, 0 errors**.
- `cargo test --release` — **14 unit tests + 1 cross-verify, 0 failed** (bit-layout
  top-down≡bottom-up cross-check, named Authority/Momentum byte values, Raw
  alias/range rejection, known-vector hex, roundtrips).
- `cargo test cross_verify --release` — writes `rust-output.json` with **12/12
  `roundtripOk` + 12/12 `matchesExpected`**.
- `bun tests/cross-verification/zeta-id/compare.ts` — **✅ All implementations
  agree on 12 vectors** (TS 12 · F# 12 · C# 12 · Rust 12); `compare.ts` extended
  to the 4-way diff.
- Authority cases (HumanVerified=31, TrustedAgent=20, Standard=15, BestEffort=8,
  Simulated=3) + Momentum cases (Background=32, Normal=96, Elevated=160, High=224,
  Critical=248) match exactly.

Deviations from the 2026-05-21 scope (with whys — a row's suggestion is revisable
when its why changed; `future-self-not-bound`):

- **Zero-dep, not `serde_yaml`.** The Rust house style settled later
  (`Core.Rust.Observe` — hexagonal zero-dep core + optional-serde-adapter behind a
  feature) and `serde_yaml` is now unmaintained; the flat fixture is read with a
  ~40-line hand reader. Matches the supply-chain doctrine + `TriBoolean`/`Observe`.
- **`u8` + named constants** for the open-vocabulary fields (version / chromosome /
  category / firefly / persona / location), not closed enums — faithful to the
  F#/C#/TS `EnumOfValue`-accepts-any-in-range-byte semantics (a closed enum would
  reject unnamed in-range bytes the other oracles accept). Authority/Momentum ARE
  enums with `Raw(u8)` (they carry named-collision rejection).
- **`pack` returns `Result<u128, PackError>`** (Result-over-exception /
  monad-propagation doctrine) rather than throwing; the observable contract
  (reject out-of-range / aliasing) is identical to the F#/C# `throw` path.
- **DEFAULT_ENV (cryptographic)** deferred behind a future `rand` feature (a
  deliberate dependency decision, same gating as `Observe`'s `serde` feature). The
  no-silent-zero-fallback property holds: `pack` REQUIRES an env (no default);
  the cross-verify uses `DeterministicEnv` (always 0), matching the vectors.
