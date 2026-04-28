---
name: EMULATORS as canonical OS-interface workload — rewindable/retractable OS+emulator controls; safe-ROM testbed offer; ARC-3 absorption-scoring substrate; save states FREE via durable-async yield-points; cross-node migration FREE via state-follows-function; DST gives speedrun/TAS determinism; rewind generalizes to OS-level retraction-native semantics (rr/Pernosco class); composes with Otto-73/238/272 + Z-set retraction-native + #399 OS-interface; Aaron 2026-04-24
description: Maintainer 2026-04-24 directive — emulators are the canonical proof-out workload for the OS-interface (#399). Emulator event loop maps directly to durable-async runtime. Save states / migration / multiplayer are free properties of the substrate. Maintainer follow-up generalized rewindable/retractable controls from emulator-special-feature to OS-level primitive — Z-set retraction-native semantics extend all the way up to user-facing controls. Safe-ROM offer is durable; ask gated on implementation phase. Activates 2026-04-22 ARC-3 absorption-scoring research.
type: feedback
---

## The directive (verbatim)

Maintainer 2026-04-24:

> *"emulators should run very nicely on this, let me
> know when you want some roms of any kind that are
> safe."*

Maintainer follow-up:

> *"rewindable/retractable os/emulator controls"*

## Why emulators are the canonical OS-interface workload

An emulator is `while(true) { fetch; decode; execute; }`
— a tight event loop with state. That's exactly what
the OS-interface durable-async runtime (#399) hosts.

**Free properties from the substrate:**

- **Save states** — every yield-point in the
  emulator's instruction loop is a checkpoint. Save
  state = pause. Restore = resume.
- **Cross-node migration** — pause on laptop, resume
  on phone. State follows the function.
- **Multiplayer** — two clients on same emulator
  instance share state via durable substrate.
- **Speedrun / TAS determinism** — DST (Otto-272)
  guarantees bit-equal replay.

## Rewindable/retractable controls (maintainer follow-up)

The follow-up directive promotes rewind from
emulator-special-feature to OS-level primitive.
Every operation across the entire OS surface becomes
retractable, because Z-set retraction-native semantics
extend up from the data layer.

**Examples of OS-level retraction:**

- "Rewind 5 seconds" on the emulator (game state
  retracts).
- "Undo last database transaction" (ZSet retraction —
  already works).
- "Rewind process tree to 30s ago" (process-spawn
  retraction).
- "Undo this network connection's side effects"
  (network-effect retraction).

**Architectural class:** rr / Pernosco (record-and-
replay debuggers). Same class — generalized across
the entire OS surface, not just process-execution.

**Trust-vector composition** (Otto-238): rewindable
controls let users experiment without consequences.
Mutual reversibility means errors are bounded. System
grants more agency because the user can always undo.

## ARC-3 absorption-scoring connection

The 2026-04-22 maintainer ARC-3 adversarial-self-play
scoring directive used emulators as the absorption
substrate. This row activates that research:

- Three-role co-evolutionary loop (level-creator /
  adversary / player) runs on durable-async +
  rewindable substrate.
- Save states + DST + retraction let level-creator
  generate scenarios, adversary produce hard cases,
  player produce solutions.
- Replay/rewind for analysis is first-class.

## Safe-ROM offer

Maintainer-explicit: *"let me know when you want some
roms of any kind that are safe."* The offer is durable.
The ask is gated on implementation phase.

**Candidate classes** (research, not adoption):

- **Public-domain / homebrew / demoscene** ROMs.
- **Official test suites** — mooneye-gb, Blargg test
  ROMs, Game Boy boot ROM tests. Used for hardware-
  accuracy verification; freely redistributable per
  license.
- **Commercially-released-as-free** — Cave Story,
  certain Atari/Activision retro releases.
- **Modern commercial only with explicit license** —
  never ROM dumps without permission.

## Phased approach

When activation comes:

- **Phase 0** — research + emulator class survey
  (Game Boy / NES / SNES / Genesis / GBA;
  libretro as candidate interface; rr / Pernosco
  as rewind-substrate research).
- **Phase 1** — single canonical emulator on
  OS-interface durable-async runtime (Game Boy
  most likely — smallest hardware-accurate model,
  well-documented, public test ROMs).
- **Phase 2** — rewindable controls surfaced through
  emulator AND propagated as OS-interface
  primitives.
- **Phase 3** — ARC-3 absorption-scoring loop
  activated.
- **Phase 4** — multi-emulator + cross-emulator
  composition (joining save states across systems
  as Z-set views).

## Composes with

- **OS-interface row** (#399 cluster) — host runtime.
- **Otto-73 retractability-by-design** — substrate.
- **Otto-238 retractability-as-trust-vector** — UX.
- **Z-set retraction-native semantics** — the math.
- **DST (Otto-272)** — replay determinism.
- **2026-04-22 ARC-3 adversarial-self-play research**
  — this row activates it.
- **Closure-table hardening** (#396) — save-state
  index.
- **Cross-DSL composability** (#397) — emulator state
  composes with SQL ("every frame where Mario was
  here").
- **`request-play`** skill — the emulator-as-play
  permission posture.
- **`glass-halo-architect`** — visible-state replay
  analysis.

## Future Otto reference

When implementation activates:
1. Read this memory + the OS-interface memory + the
   2026-04-22 ARC-3 absorption-scoring memory first.
2. Verify DST is still factory default (Otto-272).
3. Survey libretro / rr / Pernosco BEFORE designing.
4. Pick smallest hardware target first (Game Boy);
   prove durable-async + retraction work on the
   simplest CPU before expanding.
5. Ask the human maintainer for safe-ROM substrate —
   the offer is durable.
6. The rewindable-controls generalization is the
   killer feature, not the emulator itself. Don't
   ship the emulator without rewind.
