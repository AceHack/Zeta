# `roms/computers/` — Vintage home computers branch folder

This is a **branch folder** in the ROM hierarchy. It
enumerates platforms grouped under the Vintage home computers label. It
is **not empty** — it contains one subfolder per supported
platform, each with its own sentinel `README.md`.

## Children (2 platforms)

- [`msx/`](msx/) — MSX (1983)
- [`zxspectrum/`](zxspectrum/) — Sinclair ZX Spectrum (1982)

## What to drop here

**Nothing.** ROMs belong in the child leaf folders, not at
this level. If an emulator frontend points at this directory
as a load path, point it at a specific child instead.

## Why a branch-folder sentinel exists

The human maintainer directed during an autonomous-loop session (2026-04-24):

> *"but if per folder should not say empty when it has
> subfolders"*

Translation: branch folders need their own sentinel prose
so the tree self-documents — opening `computers/README.md`
tells a maintainer or fresh agent which platforms live
under this label and where to drop files.

## Why some Vintage home computers platforms are missing

The tree only keeps platforms where **emulator code alone
(plus any bundled clean-room open-source BIOS) + a
safe-to-redistribute ROM** is enough to boot something.
Vintage home computers platforms that require proprietary BIOS / firmware
/ OS ROMs with no viable open-source alternative were
removed — see `roms/README.md` for the full removal list.

## License-safety gate

The top-level `roms/README.md` protocol governs every child
folder. No per-platform carve-outs: if the file isn't safe
under the top-level protocol, it isn't safe anywhere in the
tree.

## Cross-refs

- `roms/README.md` — top-level protocol + the removal list.
- `roms/computers/<platform>/README.md` — the leaf sentinel for
  each child platform.
