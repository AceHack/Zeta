# `roms-safe/` — tracked, redistribution-safe ROMs

This tree holds ROM files that are **safe to commit and redistribute** —
public-domain, freeware, or homebrew releases whose authors explicitly
permit free distribution. Unlike `roms/` (which is gitignored except for
its sentinels), everything under `roms-safe/` is tracked in git.

## How the split works

The split between safe and unsafe ROMs is mechanical, opt-in, and
license-driven:

1. The maintainer adds candidate ROMs under the gitignored
   `roms/<platform>/<system>/` testbed (see [`roms/README.md`](../roms/README.md)
   for the license-safety gate).
2. A per-system allowlist manifest under
   `tools/roms/manifests/` lists the canonical filenames known to be
   safe to redistribute, each with a license citation.
3. [`tools/roms/split-by-license.ts`](../tools/roms/split-by-license.ts)
   classifies each ROM against the allowlist. It is **report-only by
   default**; `--apply` moves allowlisted files into `roms-safe/` and the
   rest into an untracked unsafe directory. Report-only-by-default mirrors
   the sibling [`canonicalize.ts`](../tools/roms/canonicalize.ts) discipline,
   because the failure mode here crosses a legal boundary (081KQ8P5D0008QG0R001590WJ3's "legal
   blast radius").

## Per-system trees

Each `roms-safe/<platform>/<system>/` leaf carries its own `README.md`
documenting which ROMs are safe and citing the license that justifies
inclusion:

- [`atari/2600/README.md`](atari/2600/README.md) — Atari 2600 (VCS)

## Provenance

- Parent backlog: 081KQ8P5D0008QG0R001590WJ3 (safe-ROM testbed substrate) and 081KR2E4K0008QG0R001JC6S3N (safe/unsafe
  ROM split tooling).
- Source policy: [`roms/README.md`](../roms/README.md).
