# What chip8/9 carries of DynamicValue — and the Zeta-primitives wish list for the machine

Aaron 2026-06-11: "what primitive from a DynamicValue does it support, and the Zeta primitives
wish list from chip8 and 9."

## DynamicValue's 8 cases on the machine (the honest support table)

DynamicValue = `Null | Bool | Int | Float | String | Bytes | Array | Object` (the common-core
case set). What the machine + its cartridge format can carry TODAY:

| case | chip8 (machine) | chip9/cartridge (the format + planes) |
|---|---|---|
| Bool | natively — VF, key states, a pixel | a plane bit; TriBoolean needs 2 bits (wish list) |
| Int | bytes (V0–VF), 12-bit addresses, 16-bit I | exact milli-scale constants with WHAT+WHY (the lint) |
| Bytes | Mem itself; sprites at I | `frame`/`rom` hex lines (even-length lint-guarded) |
| String | no native text (font digits 0–F only via FX29) | every `meta`/field IS a string; glyph atlas renders them |
| Array | sequential Mem + FX55/65 (the only bulk op) | `anim` cycles, comma lists in fields |
| Object | — (no keyed access on the ISA) | the cartridge itself: kind→name→fields IS the object |
| Null | — (zero-valued memory is 0, not null) | ABSENT lines (canonical zero ⇒ absent — the Extra-map rule) |
| Float | NOT SUPPORTED, on purpose | refused: milli-scaled exact ints only (the no-float dialect) |

So: a full DynamicValue tree lives at the CARTRIDGE layer (MediaLines is its serialization;
shape-dynamicvalue draws it); the ISA layer carries the scalar/bytes subset. Float is the one
case we refuse by design rather than lack.

## The Zeta-primitives wish list FOR chip8/9 (each = a cartridge + laws when picked)

1. **TriBoolean on the planes** — 2 bits = Lit/Unlit/Unknown; BoundaryLight's progressive `Tri`
   already wants it; a `shape-triboolean` showing middle-out resolution.
2. **ZSet weights as pixels** — weight −1/0/+1 per cell (retraction visible: a CMYK-register
   anti-pixel); the emit/retract duality drawn live.
3. **Result on the machine** — the Fault register IS `Error of string`; wish: a per-op Result
   trace plane (which step failed, drawn).
4. **TimeGen phase dial** — the seeded phase as a rotating spoke; the common-cause clock visible
   on every board (audio already derives from it).
5. **ZetaId glyphs as first-class sprites** — zetaid.glyph exists; wish: FX29-style "font" lookup
   for the 32-hex alphabet so ROMs can DRAW ids.
6. **Merkle root strip** — 32 bytes as a 2-row color band; two boards comparing roots at a glance
   (the sync lanes' visual handshake).
7. **SoftValue native op** — DONE at the deep-pixel layer (PixelLens); wish remaining: a chip9
   opcode reading uncertainty into VF-style flags so ROMs can BRANCH on confidence.
8. **IBLT cell band** — the reconciliation table's (count,keySum) cells as a strip; watch peeling
   happen (pairs with shape-gc's ray-traced reachability).
9. **The cartridge LOADER** — the standing homoiconic close: chip9 loading `.lines` directly
   (rom kind already carries hex; the loader is the missing piece).

Ranking by pull: 9 (loader) unlocks everything; 1+2 are afternoon cartridges; 7's opcode is a
treaty change (four oracles + a golden, 081KTZ4EF0008QG0R002WVTMMJ discipline).
