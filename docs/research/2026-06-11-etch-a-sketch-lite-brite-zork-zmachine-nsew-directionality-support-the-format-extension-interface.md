# Etch-a-Sketch, Lite-Brite, ZORK — the display lineage + supporting the Z-machine format

Aaron 2026-06-11 (extending the colorspace/BBS grounding):

> "Also think **Etch-a-Sketch** and/or **Lite-Brite with LEDs**, and BBS games, CYOA, and **text-based
> adventures like ZORK — it had consistent directionality, NSEW and others. We should probably support
> his format too.** Have some **interface for extensions** and we can move forward with whatever."

## The display lineage (the TV's aesthetic ancestors, each an honest capability)

| ancestor | what it teaches the TV | capability class |
|---|---|---|
| **Etch-a-Sketch** (Cassagnes 1960) | ONE continuous line, two knobs, erase-by-shake — drawing as a *path*, reset as a *gesture*; the mono single-plane aesthetic | Mono1, vector-path |
| **Lite-Brite** (Hasbro 1967) | colored POINTS on a dark grid — pixels as physical pegs; the indexed-palette aesthetic (and literal LEDs on the Pi/microcontroller rung) | Indexed⟨palette⟩, point grid |
| **BBS / CP437 ANSI** | the board aesthetic (already pinned for DORA) | ANSI-16/256 |
| **ZORK / text adventure** | the room graph SPOKEN: consistent directionality — NSEW + up/down/in/out — as the navigation contract | text, the CYOA's ancestor |

These aren't nostalgia: each is a *binding* of `universal/color.md` at a real capability, and Lite-Brite
is literally the Pi-with-LEDs rung of 081KTSZN10008QG0R00349SM6P.

## ZORK's directionality IS our four corners

Zork's compass (N/S/E/W + NE/NW/SE/SW + up/down/in/out — Infocom 1980) is a **consistent spatial
algebra over a room graph** — exactly our substrate: rooms with doors (the metaspace), NSEW as the C₄
rotation (the four-corner i-rotation), `enterAny`/doors as exits. A text adventure is a **room graph
rendered in prose with a treaty-stable direction vocabulary**. The dev-room with its doors already IS a
Zork map; speaking to the TV (081KTSZN10008QG0R00349SM6P rung 6) in Zork grammar ("go north", "look", "open door") is the
conversational interface with 45 years of proven UX.

## "Support his format too" — the Z-machine

ZORK's format is the **Z-machine** (Berez & Blank, Infocom 1979): the original portable story VM —
story files (`.z3/.z5/.z8`) run unchanged on interpreters for every platform since 1980 (Frotz et al.;
Inform — Nelson 1993 — still targets it). It is the **prior-art champion of exactly our thesis**: a
tiny, well-specified VM as the universal portable substrate (CHIP-8's sibling — CHIP-8 for
games/graphics 1977, Z-machine for narrative/rooms 1979; the same era, the same move).

Support path (capability-honest, additive):

1. **Direction vocabulary first** (cheap): adopt Zork's compass as the treaty vocabulary for room
   navigation crossings (`go:north` etc.) — the metaspace doors + MeshPong NSEW already speak it in
   spirit; ratify the words.
2. **Z-machine room as oracle** (the real support): a Z-machine interpreter room (spec is public,
   v3 is small) — story files become rooms; the membrane discipline holds (input crossings in, prose
   out). Our extensions live in undefined opcode/header space per `universal/extension.md`.
3. **The TV binding**: text-adventure prose IS the text-capability render of any room graph — the
   chronovisor's text channel ("you are in the dev-room; exits are N, E, and SELF").

## The extension interface (carved)

`universal/extension.md` (this PR): extensions live in unused encoding space; the original is the ZERO
CASE (not a mode); hosts probe honestly; every extension ships golden vectors. XO-CHIP generalized —
the same law that lets original CHIP-8 ROMs run under color planes lets standard Z-machine stories run
under ours. "We can move forward with whatever" = the interface makes EVERY format extensible without
betraying its installed base.

## Pointers

- `universal/extension.md` · `universal/color.md` — the two sibling contracts.
- Anchors: Z-machine (Berez/Blank 1979; Nelson's Inform; Frotz) · ZIL · Cassagnes (Etch-a-Sketch 1960) ·
  Hasbro Lite-Brite 1967 · Infocom ZORK 1980 (Anderson/Blank/Daniels/Lebling, the MIT lineage) ·
  XO-CHIP (Earnest).
- `docs/research/2026-06-11-universal-color-interface-grounding-...md` (BBS/CYOA — the same stream) ·
  the metaspace doors / DevRoom.selfDoor (the Zork map we already have).
