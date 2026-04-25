# `roms/nintendo/nes/` — Nintendo Entertainment System (1983)

8-bit; Famicom in Japan

## What to drop here

ROM / disc image / cassette dump files for **Nintendo Entertainment System**.
Common extensions: see the emulator core's documentation.
The directory slug `nes` matches the EmulationStation /
libretro convention so emulator frontends that auto-scan
the tree recognize this path.

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
- `roms/nintendo/README.md` — the branch folder listing this platform alongside siblings.
