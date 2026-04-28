# `roms/nintendo/` — Nintendo branch folder

This is a **branch folder** in the ROM hierarchy. It
enumerates platforms grouped under the Nintendo label. It
is **not empty** — it contains one subfolder per supported
platform, each with its own sentinel `README.md`.

## Children (7 platforms)

- [`nes/`](nes/) — Nintendo Entertainment System (1983)
- [`snes/`](snes/) — Super Nintendo Entertainment System (1990)
- [`n64/`](n64/) — Nintendo 64 (1996)
- [`gb/`](gb/) — Game Boy (1989)
- [`gbc/`](gbc/) — Game Boy Color (1998)
- [`gba/`](gba/) — Game Boy Advance (2001)
- [`virtualboy/`](virtualboy/) — Virtual Boy (1995)

## What to drop here

**Nothing.** ROMs belong in the child leaf folders, not at
this level. If an emulator frontend points at this directory
as a load path, point it at a specific child instead.

## Why a branch-folder sentinel exists

The human maintainer directed during an autonomous-loop session (2026-04-24):

> *"but if per folder should not say empty when it has
> subfolders"*

Translation: branch folders need their own sentinel prose
so the tree self-documents — opening `nintendo/README.md`
tells a maintainer or fresh agent which platforms live
under this label and where to drop files.

## Why some Nintendo platforms are missing

The tree only keeps platforms where **emulator code alone
(plus any bundled clean-room open-source BIOS) + a
safe-to-redistribute ROM** is enough to boot something.
Nintendo platforms that require proprietary BIOS / firmware
/ OS ROMs with no viable open-source alternative were
removed — see `roms/README.md` for the full removal list.

## License-safety gate

The top-level `roms/README.md` protocol governs every child
folder. No per-platform carve-outs: if the file isn't safe
under the top-level protocol, it isn't safe anywhere in the
tree.

## Cross-refs

- `roms/README.md` — top-level protocol + the removal list.
- `roms/nintendo/<platform>/README.md` — the leaf sentinel for
  each child platform.
