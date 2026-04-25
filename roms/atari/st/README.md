# `roms/atari/st/` — Atari ST (1985)

home computer (ST / STE / Falcon)

## What to drop here

ROM / disc image / cassette dump files for **Atari ST**.
Common extensions: see the emulator core's documentation.
The directory slug `st` matches the EmulationStation /
libretro convention so emulator frontends that auto-scan
the tree recognize this path.

## BIOS / firmware status

EmuTOS — a clean-room GPL TOS replacement — works as a drop-in OS without requiring the proprietary Atari TOS. This is why this platform remains in the
tree — no proprietary firmware is required to boot a ROM
here, the emulator code (plus its bundled open-source
clean-room BIOS where applicable) is sufficient.

## License-safety gate — this is a leaf folder

Before dropping a file here, check `roms/README.md` at the
repo root. The protocol-permitted classes are:

- Public-domain releases.
- Homebrew / demoscene productions whose license explicitly
  permits redistribution.
- Official test suites / diagnostic ROMs published by the
  manufacturer as free material.
- Commercially-released-as-free software (documented
  per-title).
- Modern commercial titles **only** if an explicit
  redistribution license is attached in writing.

Forbidden (do not drop here):

- ROM dumps of commercial cartridges / discs without
  license.
- Anything whose provenance is uncertain — "uncertain"
  defaults to "not allowed".

## Gitignore behaviour

Every file in this folder except this `README.md` is
gitignored via the root `roms/.gitignore` rule (`*` +
`!*/` + `!**/README.md`). Drop ROMs confidently — git will
not accidentally track them.

## Cross-refs

- `roms/README.md` — top-level protocol + the list of
  platforms removed for BIOS reasons.
- `roms/atari/README.md` — the branch folder listing this platform alongside siblings.
