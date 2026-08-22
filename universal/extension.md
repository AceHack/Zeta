# universal/extension — the Extension Interface (grow a system without breaking its zero case)

> **Universal Extension Interface** — how ANY closed format/VM/protocol grows: extensions live in
> **unused encoding space**, the **original behavior is the zero case** (not a mode), and every
> extension ratifies with **golden vectors** like any treaty surface. An extension never changes what
> existing artifacts mean; a host that lacks the extension binds honestly at its zero case ("not yet").

Aaron 2026-06-11: *"have some interface for extensions and we can move forward with whatever."* The
XO-CHIP move (bit-plane color in unused CHIP-8 opcodes; every original ROM unchanged) generalized to a
universal shape.

## The contract (pure shape)

- **`Space`** — where extensions may live: encoding points the base spec never assigns (unused opcodes,
  reserved fields, undefined tags). NEVER repurpose assigned space.
- **`Zero`** — the base behavior IS the degenerate case of the extended behavior (mono = 1 plane;
  no-extension = identity). Compatibility is structural, not a compatibility *mode*.
- **`Probe`** — a host can be asked what it supports (honest capability, `universal/color.md` rule);
  absent = zero case, never a crash.
- **`Vectors`** — each extension ships golden vectors (text, hex-in-JSON where binary) proving the zero
  case unchanged AND the extension deterministic across oracles.

## Instances (running + planned)

| system | zero case | extension space | status |
|---|---|---|---|
| CHIP-8 → color planes | Mono1 (original ROMs) | unused opcodes (XO-CHIP precedent) | planned ("until we upgrade") |
| RISC-V → reversible profile | standard RV | the open custom-opcode space | 081KTSZN10008QG0R000VZHRQ4 seam |
| InterruptKind / membrane log | the 8 ratified kinds | new kinds = new lines; old logs parse unchanged | running |
| Z-machine support | a standard story file runs | our extensions in undefined opcode/header space | proposed (the ZORK doc) |
| LinguisticSeed packs | the bare seed | added packs (OCP — composition is the extension) | running |

## Anchors (Beacon)

XO-CHIP (Earnest) · Super-CHIP (Bryntse) · RISC-V custom-extension discipline (Asanović & Patterson) ·
TLV/"ignore unknown tags" protocol lineage (ASN.1, protobuf unknown fields) · Meyer OCP 1988 (the same
law at the type level) · HTML's "unknown elements render as inline" (the web's zero case).

## Pointers

- `universal/color.md` (honest capability — the sibling rule) · `gen/action-grammar.md` (backends bind
  at declared capability) · the ZORK/Z-machine doc
  (`docs/research/2026-06-11-etch-a-sketch-lite-brite-zork-zmachine-nsew-directionality-support-the-format-extension-interface.md`).
