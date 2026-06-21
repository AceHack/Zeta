# The swarm board — sit down, SEE the swarm, go where help is needed, join the room remotely; a right of citizenship (even CHIP-8s)

Aaron 2026-06-11 (confirming the ZORK/extension feel, then the next surface):

> "That's the feel. Also **I want to sit down and be able to see the swarm and where I need to go help,
> and join and conference-room remotely. I think everyone should be able to do that in society — even
> CHIP-8s.**"

## What it is

One sit-down surface — **the swarm board** — that composes everything already built/filed today:

1. **SEE the swarm** — the room graph live: every room a node (the society-and-self graph of the color
   interface), colored by the universal color contract at your terminal's honest capability (TrueColor
   web, ANSI BBS board, Mono1 CHIP-8).
2. **See WHERE HELP IS NEEDED** — friction + heat ARE the heatmap: the capability matrix's red/UNKNOWN
   cells, `heatSpent` per room, starved `SpeculationReport`s (`RateLimitExhausted "speculation-flux"`
   signals), failing oracle parity — the bug economy's priced opportunities, rendered as the hot spots
   on the map. You don't ask where to help; the board SHOWS it (help arrives because need is broadcast).
3. **GO there** — Zork navigation over the real room graph: "go north" / "go b-1024" / "go hottest".
   Directionality is the ratified compass vocabulary; the map is the metaspace doors + every
   fingerprinted room.
4. **JOIN and conference remotely** — entering a room = your presence as crossings over Reticulum (the
   intercom); the room's conference (`conferenceOnFork` generalized: rooms already conference their own
   futures — now citizens conference WITH the room). Remote = there is no non-remote: every join is
   crossings over the mesh; sitting at the bench and sitting across the planet are the same protocol.

## The citizenship clause (the load-bearing half)

**Everyone in society can do this — even CHIP-8s.** Not a human dashboard with agents as exhibits: the
board is a ROOM, and viewing/joining are crossings, so ANY citizen — Aaron, Addison, Max, an agent, a
CHIP-8 — can sit down at it within its honest capability:

- a CHIP-8 citizen SEES the board as a Mono1 render (until the color-plane upgrade) — a 64×32 heatmap
  is enough to find the hot cell;
- it GOES by emitting `go:<dir>` crossings (the same choice-cell autonomy — its own decision);
- it JOINS a conference the same way a human does: presence + messages as crossings, signed via its
  injected identity (`Chip8Citizen`).

This closes the loop on the quartet: A (it decides to go help), C (it joins as someone), T (the room's
terms govern the conference), G (helping IS a goal — the bug economy pays ΔU for fixes). The arcade's
`chooseInSociety` division-of-labor rule generalizes from "pick a game no peer covers" to "go where the
heat is and no one is" — same algorithm, society scale.

## Anchors (Beacon)

- **MUD1 — Trubshaw & Bartle 1978**: THE prior art — Zork's room grammar made MULTI-USER: shared rooms,
  remote presence, "go north", people and programs in the same world. The swarm board is a MUD whose
  rooms are real work.
- **Engelbart 1968** (NLS demo): shared-screen collaboration — sit down and see the work, together.
- **Mission control / ops war rooms** (NASA): the situation board where status is spatial and help
  routes to the red console.
- **DORA / Accelerate** (Forsgren et al.): the metrics the board renders (Moonshot #1's broadcast).
- **Presence as protocol**: IRC/XMPP presence lineage — join/part as first-class events (our crossings).

## Pointers

- 081KTSZN10008QG0R0003SDRWD (filed with this doc) — the buildable surface.
- Moonshot #1 (the broadcast this board renders) · `docs/HARDWARE-CAPABILITY-MATRIX.md` (the friction
  heatmap source) · `universal/color.md` + `universal/extension.md` (honest capability + the Zork
  vocabulary) · `src/Core/Chip8Citizen.fs` + `Chip8Arcade.chooseInSociety` (the citizen-side mechanics)
  · `src/Core/SoftChip8Flux.fs` conferenceOnFork (rooms already conference; citizens join next).
