# `roms/` — safe-ROM testbed substrate

This folder is the local-only substrate for the
emulator workload that proves out the OS-interface
durable-async runtime (PR #399 cluster). The folder
is gitignored except for this README and the
`.gitignore` sentinel.

The human maintainer adds ROMs here once they are
confirmed safe-to-redistribute under their license.
The emulator runtime (when implemented) loads from
this path. The contents stay on the local machine —
they are never committed.

## Why this folder exists with a sentinel

Same pattern as `drop/` (the maintainer-to-agent
inbox) — the folder needs to exist on every clone so
emulator code can find its load path, but the binary
contents must NOT enter git history. Tracking the
`.gitignore` + this `README.md` keeps the directory
present; everything else is ignored.

## What belongs here (allowed classes)

ROMs are added ONLY when they satisfy at least one of
the following safe-class conditions:

- **Public-domain** — copyright expired, public domain
  dedication, or never copyrighted (the rare
  early-arcade case).
- **Homebrew / demoscene** — community-authored under
  the author's chosen license (CC0, MIT, custom
  permissive, etc.). The license file or notice must
  travel with the ROM.
- **Official test suites** — vendor-published or
  community-published hardware-accuracy test ROMs
  with redistribution permitted. Examples:
  - **mooneye-gb** (Game Boy hardware tests, MIT).
  - **Blargg test ROMs** (Game Boy / NES / SNES /
    Genesis CPU + APU tests, freely redistributable
    per their author's published terms).
  - **Game Boy boot ROM disassembly** (gbdev community
    reverse-engineered, redistributable for emulator
    development).
- **Commercially-released-as-free** — titles whose
  original publishers have explicitly released them
  free for redistribution (e.g. Cave Story, certain
  Atari/Activision retro releases, some demoscene
  titles).
- **Modern commercial titles ONLY with explicit
  written license** — never ROM dumps without
  permission.

## What does NOT belong here (forbidden classes)

- ROM dumps of commercial titles without explicit
  license.
- ROMs from torrents or "ROM site" downloads (the
  redistribution chain is broken).
- BIOS dumps from real hardware unless the BIOS is
  specifically released free (most BIOS dumps are
  copyrighted by the console manufacturer).
- Anything where the license is uncertain — when in
  doubt, do NOT add to this folder.

## Hand-off protocol

When the OS-interface emulator implementation activates
(per `memory/feedback_emulators_canonical_os_interface_workload_rewindable_retractable_2026_04_24.md`):

1. The loop-agent asks the human maintainer for safe
   ROMs (the offer is durable from the
   2026-04-24 directive).
2. Human maintainer drops the safe ROMs here, named
   per the maintainer's filing convention.
3. The emulator runtime loads them locally; agent
   never commits binaries.
4. If a ROM's license becomes uncertain, the human
   maintainer removes it; agent never makes
   adoption-vs-removal calls on uncertain licensing.

## Composes with

- **Emulator BACKLOG row** — the activation gate.
- **OS-interface BACKLOG row** (#399) — the host
  runtime.
- **`drop/` sibling pattern** (per
  `memory/project_aaron_drop_zone_protocol_2026_04_22.md`)
  — gitignored-except-sentinels approach.
- **GOVERNANCE.md** — license / IP discipline.
- **Otto-237 IP-discipline-mention-vs-adoption** — the
  rule that non-adoption lists need specifics; this
  README enumerates allowed and forbidden classes
  explicitly.

## Reference

- ROM-related research and emulator class survey
  lands in `docs/research/` when activated.
- Otto-275 log-don't-implement: this README is the
  capture, not the kickoff. Emulator runtime
  implementation gates on the OS-interface Phase 1
  landing first.

## Removed platforms (no viable open-source BIOS alternative)

Per the human maintainer directive during an autonomous-loop session (2026-04-24):

> *"if there are any you need bios files you can't create
> yourself lets remove those"* + *"just keep the ones you
> don't need anything but your code"* + *"open source bios
> is fine too"* + *"keeping only those that work standalone
> or have viable open BIOS replacements or ones we can
> write ourself from scratch without cheating"*

The rule: **self-contained emulator code + safe-to-
redistribute ROM must be enough to boot something**.
Platforms with clean-room open-source BIOS (Altirra for
Atari 800, EmuTOS for Atari ST, AROS for Amiga, C-BIOS for
MSX, Open Source Speccy ROM for ZX Spectrum, mGBA's HLE
for GBA, Minestorm-in-emulator for Vectrex) satisfy this
— they ship with the emulator as code, not as a separate
user-supplied firmware dump.

Removed because no viable clean-room open-source BIOS
alternative exists (re-adding would require shipping
proprietary firmware the factory doesn't have rights to):

- Sony PlayStation 1 / 2 / Portable
- Sega CD / Saturn / Dreamcast
- SNK Neo Geo AES / MVS (`neogeo.zip` BIOS)
- 3DO Interactive Multiplayer
- Microsoft Xbox (MCPX ROM + HDD)
- Nintendo GameCube / Wii / DS
- PC Engine CD / TurboGrafx-CD (Super System Card)
- Intellivision (Mattel Exec ROM)
- ColecoVision (Coleco BIOS)
- Atari 5200, 7800, Lynx
- Apple II (no clean-room ROM replacement)
- Amstrad CPC, BBC Micro
- Commodore 64, VIC-20 (OpenROMs exists but incomplete)
- MAME / FinalBurn Neo arcade (per-board BIOSes: Neo Geo,
  Capcom Q-Sound, Naomi, Atomiswave, etc.)

Re-adding any of the above would require either (a) the
factory shipping proprietary firmware we don't have the
rights to, or (b) a supplementary user-supplied-firmware
protocol beyond the safe-ROM scope. Both are out of scope
for this tree. When a clean-room open-source BIOS matures
for one of these platforms (e.g. if OpenROMs grows to
cover C64 game libraries), the platform can be added back.
