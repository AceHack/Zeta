# `roms/chip8/` — committed CHIP-8 test fixtures

The **one committed exception** to the `roms/` "never-committed" rule (see `../README.md`): a small set of
CHIP-8 ROMs that are **either authored by us (CC0) or third-party under a verified permissive license**, kept
in git so unit tests can exercise the emulator against real ROM bytes.

Policy for this folder (maintainer decision, 2026-06-08): a ROM may be committed here **only** if it is
1. **authored by Zeta** (CC0 / public-domain — ours), or
2. **third-party with an explicitly verified free license** (MIT/CC0/etc.) whose notice travels with it
   (`THIRD-PARTY-LICENSES.md`).

Everything else — commercial-game clones, unknown-provenance ROMs, the IBM Logo (trademark + unconfirmed
license) — stays reference-only under `references/prior-art/` (reference-not-copy) and is **not** committed.

## Contents

- `zeta-arith.ch8`, `zeta-selfloop.ch8`, `zeta-draw-h.ch8` — authored by Zeta (CC0); the test fixtures.
- `mikolay-delay-timer-test.ch8`, `mikolay-random-number-test.ch8` — Matthew Mikolay (MIT; `THIRD-PARTY-LICENSES.md`).

## Signatures

Every ROM here is tracked by **size + crc32 + sha256** in `MANIFEST.md` (text/hex, diffable, DST-replayable —
the `no-binary-in-proof-lineage` discipline applied to ROM signatures). Unit tests verify a ROM's bytes against
its sha256 (tamper-evident). The convention follows the No-Intro/Redump/TOSEC DAT standard — see
`docs/PRIOR-ART-LIST.md`.
