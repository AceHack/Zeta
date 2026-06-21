---
id: 081KS3X9Y0008QG0R002WGH8PJ
priority: P2
status: open
title: ZetaId V1 — Python implementation as full peer oracle
tier: research-grade
effort: M
ask: maintainer Aaron + Mika 2026-05-21
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KS3X9Y0008QG0R001Z8SBZJ]
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R00088FYE9, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R002YAA09X, 081KRW63S0008QG0R001SAHYKV]
tags: [zeta-id, multi-oracle, python, cross-verification]
type: feature
---

# ZetaId V1 — Python implementation as full peer oracle

## Context

5th peer oracle for the V1 ZetaId 128-bit canonical observation contract.
Per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`, Python
is a full peer oracle (same canonical vectors, same hex contract, same
exit-on-mismatch discipline) — no carve-out as "scripting reference."

Python's role: ecosystem reach for agents/data/tooling/scripting. Python
slower than Rust/C# is fine; correctness is the contract, not performance.

## Scope

Add a Python package at `src/Core.Python.zeta_id/` (or per repo Python
conventions, if any):

- `pyproject.toml` (using `uv` per Zeta convention if applicable)
- `src/zeta_id/__init__.py` — public API
- `src/zeta_id/types.py` — `Authority` + `Momentum` as discriminated
  unions (PEP 695 / typing.Union[NamedTuple, ...] or dataclasses with
  `kind` discriminator); `ZetaObservation` dataclass; `IdVersion` /
  `Chromosome` / `Category` / `Firefly` / `Persona` / `Location` enums
- `src/zeta_id/bit_layout.py` — computed offsets with reserved bits per
  `docs/zeta-id-v1-layout.yaml` (1 bit at offset 69, 3 bits at offsets 32-34)
- `src/zeta_id/codec.py` — `pack(obs, env)` requires explicit env;
  `unpack(id)` inverse; uses Python's arbitrary-precision int for the
  128-bit value (no UInt128 in stdlib)
- `tests/test_cross_verify.py` — reads `tests/cross-verification/zeta-id/vectors.yaml`
  via `pyyaml` or `ruamel.yaml`; writes `python-output.json` to same dir
- `compare.ts` becomes 5-way deep-equal: TS + F# + C# + Rust + Python

## Acceptance

- `uv sync && uv run pytest tests/test_cross_verify.py -v` clean
  (1 pass, 0 fail)
- `python-output.json` shows 12/12 `roundtripOk: true` + 12/12
  `matchesExpected: true`
- `bun tests/cross-verification/zeta-id/compare.ts` reports 5-way
  agreement across all oracles
- Test output paste-verified in commit message
- Authority + Momentum byte values match the F# AuthorityValue /
  MomentumValue exact constants (31/20/15/8/3 + 32/96/160/224/248)

## Discipline reminders

Same as 081KS3X9Y0008QG0R001Z8SBZJ (Rust): compile-and-test-first, reserved-bit gap at 69,
no silent-zero randomness, exit non-zero on mismatch. Python's loose
typing makes empirical verification MORE important, not less.

## Why depends_on 081KS3X9Y0008QG0R001Z8SBZJ

Sequencing: Rust lands 4th, Python lands 5th. Rust's compile-time
discipline (similar to F#/C# strictness) catches more bugs early; Python
benefits from Rust having already shaken out any spec-drift not caught
by the V1 cycle's TS+C# pair.

If Rust hits unexpected issues that change the spec interpretation,
Python adopts the corrected interpretation; doing them in sequence
avoids 2x rework.

## Non-goals

Same as 081KS3X9Y0008QG0R001Z8SBZJ — smart deser, CloudEvents wrapping, registry/locations.yaml
all separate B-NNNNs.

## Why P2

Same reasoning as 081KS3X9Y0008QG0R001Z8SBZJ — important for multi-oracle resilience but
doesn't block V1 substrate landing. Python's ecosystem reach makes this
high-leverage once Rust validates the spec interpretation across one more
strict-typed language.
