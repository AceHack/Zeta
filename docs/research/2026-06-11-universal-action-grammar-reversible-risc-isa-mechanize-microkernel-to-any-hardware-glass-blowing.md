# Mechanize the microkernel to ANY hardware: universal action grammar + a reversible RISC-like ISA — and the glass-blowing method

Aaron 2026-06-11 (on "the SoftScheduler already is the microkernel's shape — carving it toward metal is
instantiation, not invention"):

> "Can we **mechanize this to any hardware type** with a **universal action grammar** and a **universal
> MIPS/RISC-like arch that reverses CPU-like arch**, and **ground these in proper names**. The RISC lets
> you see shapes, and **Max knows MIPS**, and I know many **FPGA/ASIC lang like Verilog** and also
> **shaders, GPGPU stuff** — we want to **generate to all those eventually**. **Raspberry Pi first**,
> and it **can be artisanal** — learn from it, **then automate into a room**."
>
> "**This is glass blowing.** Something like that. **High heat, many pruned branches.**"

## The two universals (grounded in proper names, per the rule)

### 1. The universal action grammar

The one description of WHAT the kernel does, from which every backend is generated. We already hold the
pieces: the verb family (`sim`/`mea`/`cut`), handlers-as-ISRs, crossings-as-interrupts, the four-corner
`⟨TIn, TOut, TInFeedback, TOutFeedback⟩` — pure interfaces (`gen/` reads interfaces, not classes).

**Proper names:** this is **Action Semantics — Peter Mosses (1992)** (with Watt): a formalism whose
whole point is describing program meaning as composable ACTIONS, designed for generating
implementations — literally "universal action grammar" in the literature. Underneath: **Plotkin's SOS**
(structural operational semantics, 1981) — meaning as labelled transitions (our crossings ARE the
labels); and **Dijkstra's guarded commands** (1975) — the action = guard + transformation shape our
handlers already have (`Matches` + `RunK`).

### 2. The universal reversible RISC-like ISA ("reverses CPU-like arch")

A minimal load/store ISA — RISC so the SHAPES stay visible (Aaron: "the RISC lets you see shapes") —
whose distinguishing move is REVERSIBILITY: where a CPU-like arch destroys information at almost every
instruction (overwrite ⇒ heat, Landauer), ours runs the retraction discipline at the ISA level (Z-set
−1 = antiparticle = the un-instruction; pay memory, not heat — Bennett).

**Proper names:** **RISC** — Patterson & Ditzel 1980 (the case for RISC); **MIPS** — Hennessy et al.
1981 (Max's home turf — the bridge to him); **RISC-V** — Asanović & Patterson 2010+ (the modern OPEN
ISA: the natural concrete substrate — extensible opcode space, like our XO-CHIP move). **Reversible
ISA** — this exists as a literature: **Janus** (Lutz & Derby 1982; formalized Yokoyama & Glück 2007,
the reversible language); **PISA / the Pendulum CPU** (Vieri, MIT 1995-99 — a real reversible RISC
processor); **Frank** (reversible computing systems, 1999-2017); **Bennett 1973** (the memory-for-heat
trade the whole design banks on). So "RISC-like arch that reverses CPU-like arch" = **a Pendulum-class
reversible RISC-V profile** — and nobody has married THAT to an interrupt-membrane microkernel. That's
the novel seam (named as novelty, per anchor discipline — the parts are anchored, the marriage is ours).

## The generation fan-out (eventually — each binds the SAME action grammar)

| backend | who holds the craft | proper name |
|---|---|---|
| CHIP-8 (+ color planes) | built (the universal lens) | Weisbecker 1977; XO-CHIP (Earnest) |
| ARM aarch64 / Raspberry Pi | FIRST metal — artisanal | ARM AArch64 ISA |
| MIPS | **Max** | Hennessy 1981 |
| RISC-V (+ reversible profile) | the open seam | Asanović & Patterson; Vieri's PISA |
| FPGA / ASIC (Verilog/VHDL) | **Aaron** | Verilog (Moorby 1984); VHDL |
| GPU / GPGPU shaders | the shader arc's end | SPIR-V; CUDA (2007); HLSL |

`gen/` is the seat: it already declares interfaces-not-classes as its input; the action grammar is the
interface, the backends are emitters.

## The method: glass blowing — high heat, many pruned branches, then the cooled room

Aaron's name for the bring-up discipline, and it lands EXACTLY on the heat ledger we built:

- **Artisanal phase = HIGH HEAT.** Hand-porting to the Pi is exploratory: many speculative branches
  opened, most PRUNED — and a pruned branch is an irreversible discard, which is precisely
  **Landauer heat** (`SoftThrottle.heatSpent`). Glass blowing: you work the material hot, you waste
  material, you learn its behavior with your hands. The heat is not failure — it is the COST OF
  LEARNING A NEW SUBSTRATE, and the ledger makes it visible (the matrix's heat column, broadcast).
- **Learn = anneal.** What survives the artisanal pass (the choices NOT pruned) is the mold: recorded,
  replayable, treaty-ratified.
- **Automate into a room = COOLED.** The learned port becomes a room — deterministic, DST-replayable,
  reversible-by-construction — that re-runs at near-zero heat (pay memory, not heat). Glass out of the
  furnace: rigid, transparent, repeatable. The factory move: **artisanal once, room forever.**

So the Pi bring-up is not "do it then automate it" as two unrelated steps — it is ONE thermodynamic
arc: hot hand-work → annealing → the cooled automated room, with `heatSpent` falling as the port
ratifies. The matrix shows the temperature.

## Pointers

- 081KTSZN10008QG0R000VZHRQ4 (filed with this doc) — the actionable arc; 081KTSZN10008QG0R00349SM6P — the hardware ladder this mechanizes.
- `src/Core/SoftScheduler.fs` (the action grammar's living prototype) · `gen/README.md` (the seat) ·
  `src/Core/SoftThrottle.fs` (heatSpent — the glass-blowing thermometer).
- `docs/HARDWARE-CAPABILITY-MATRIX.md` — where each backend's bring-up temperature shows.
- Anchors: Mosses/Watt action semantics; Plotkin SOS; Dijkstra guarded commands; Patterson & Ditzel;
  Hennessy MIPS; Asanović & Patterson RISC-V; Lutz & Derby + Yokoyama & Glück (Janus); Vieri PISA /
  Pendulum; Frank; Bennett 1973; Landauer 1961; Moorby (Verilog); SPIR-V.
