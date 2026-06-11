# Metaspace landmarks — the floorplan (named rooms ↔ code)

**Register:** [grounded] (Aaron, the floorplan) + [Beacon]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The navigable companion to the dev-room/harness doc
(`2026-06-10-the-dev-room-is-the-harness-...`).

## The idea

The **dev room** is the hub with all the doors (the harness; boundary = the union of all rooms). Each
door opens onto a **landmark** — a *named familiar place* whose **contents are the code that does that
kind of work**. The names are **not accidental** (Aaron 2026-06-10): the place a landmark evokes *is* the
work that lives there — way-finding by vernacular (UX/DX/AX), the grounding-point discipline applied to
navigation. Anchor: the **Final Fantasy VII Gold Saucer** venues mapped onto Zeta's functional rooms.

> Aaron: "how do landmarks like the darkhall and the bowling alley and the skatium work with rooms?" ·
> "guess we'll need a salon for the quantum physics — we have much of this in code." ·
> "the darkhall isn't accidental either — it's where our arcade machines sit, like our CHIP-8."

## The floorplan (so far)

| landmark | the familiar place | the work that lives there | code (the fittings) | status |
|---|---|---|---|---|
| **salon** | a hairdresser's salon | **quantum physics** — `braid`/`weave`/`tie` (topology *is* hairdressing); the effective-qubit substrate | `QubitIso` (Pauli/SU(2)), `Cl3` (Clifford), `AmplitudeEmu` (interference), `BellTest` (Tsirelson in DST), `CayleyDickson` (2→4→8), `FingerprintPrism.soft`/`SoftTie` | **DOOR LANDED** — `src/Core/Salon.fs` (stations registry + live `tie` entrance) |
| **darkhall** | the dim arcade hall of cabinets | **the arcade** — emulators / VMs / games; decompile programs to MIPS-like μops (rooms = micro-ops; real-time branch detection) | `DarkHall` (clean-room CHIP-8 CPU cell), `Chip8Cow`, `SoftChip8`, `SoftChip8Scheduler`, `GameFingerprint`/`GamePortfolio`/`GameCatalog`, `FingerprintPrism`, `Sim` | **DOOR LANDED** — `src/Core/Arcade.fs` (cabinets registry + live `play`/`host`; named `Arcade` because `DarkHall` is the emulator cell) |
| **bowling alley** | a bowling alley | *TBD — Aaron to name the work* | — | named, unmapped |
| **skatium** | a roller/skating rink | *TBD — Aaron to name the work* | — | named, unmapped |

(Each persona/concern can own a landmark; the table grows as Aaron names more.)

## What "furnished, no door yet" means

The **fittings** (the code that does the work) already exist for the salon and the darkhall. What's
missing per landmark is:

1. the **door** — a room module that *gathers* those fittings under the landmark name (so "go to the
   darkhall" resolves to the arcade/emulator code as one place);
2. the **harness** that hangs all the doors (the dev room itself — currently borrowed from Claude Code,
   unbounded, outside `mea`; see the dev-room doc).

Natural first build: pick one furnished landmark (salon or darkhall), give it a **door** (a gathering
module), and that becomes the template for the rest.

## Ties / routing

`2026-06-10-the-dev-room-is-the-harness-...md` (the hub the doors hang on; self-measurement = "BigFloat
for devops") · `2026-06-10-vernacular-is-the-real-beacon-test-...md` (named-place way-finding = vernacular)
· `docs/craft/subjects/quantum/topology-is-hairdressing/` (why the salon is the salon) ·
`clis/VERB-MAP.md` (bob/weave/braid/tie → the salon's fittings). **Routes to:** Iris (UX way-finding),
Bodhi (DX navigation), Daya (AX cold-start by landmark), Aaron (naming the floorplan).
