# Claim - task-splitmix64-go-python-parity

- **Session ID:** manus/20260619T133751Z-4280073a
- **Harness:** manus
- **Claimed at:** 2026-06-19T13:37:51Z
- **ETA:** 2026-06-19T16:00:00Z (same-session, short)
- **Scope:** Add Go + Python SplitMix64 oracles and golden-vector replay tests to bring the SplitMix64 primitive to full matrix parity (was 4/4 F#/C#/Rust/TS, missing Go + Python).
- **Durable target:** `src/Core.Go/splitmix64/`, `src/Core.Python/src/zeta/splitmix64.py`, their tests, and the `docs/PRIMITIVE-REGISTRY.md` status row.
- **Platform mirror:** (none — report-back mode pending maintainer decision on PR vs. write-via-maintainer)

## Notes

- Canonical shape: `src/Core/SplitMix64.fs`. Shared golden seed:
  `src/Core.TypeScript/splitmix64/golden-vectors.json` (decimal-string
  encoded uint64 in/out; wrapping arithmetic). Both new oracles replay
  that same file — no new fixture invented, the existing treaty is the
  source of agreement.
- Pure wrapping uint64 finaliser (Vigna, arXiv:1410.0530 §3; public-domain
  reference https://prng.di.unimi.it/splitmix64.c). 5 ops, no allocation.
- Go port modelled on `src/Core.Go/sha256/`; Python port modelled on
  `src/Core.Python/src/zeta/mixin.py` and wired into the existing
  `test_cross_verify.py` / `cross_verify_test.go` harness pattern.
- Direct PR requested by maintainer; release in one PR (claim + work).
  No name attribution in any committed file per AGENT-BEST-PRACTICES.
- Companion analysis `docs/research/2026-06-19-...-core-carve-out-and-roll-strategy.md`
  reconciled with Otto's Three-Faces-of-`gen(gen)===gen` update (Futamura
  projections encoded in `src/Core/AdinkraCode.fs`; 2-of-3 proven at the
  algebra level; Face 3 open in FROZEN-CORE-AND-CONJECTURE-REGISTER §B).
