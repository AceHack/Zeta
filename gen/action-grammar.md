# gen/action-grammar — the Universal Action Grammar (the one description every backend is generated from)

> **The Universal Action Grammar** — the microkernel described ONCE as pure interfaces (guard + action
> over crossings), so `gen/` can emit it to ANY hardware: CHIP-8, aarch64/Pi, MIPS, RISC-V (+ the
> reversible profile), FPGA/Verilog, GPU shaders. **An action is `⟨Guard, Step, Unstep⟩`**: when does it
> fire, what does it do, and how is it taken back. Backends that can't carry a piece declare it honestly
> (the capability rule); the grammar never grows a backend-specific special case (scale-free, spec #1/#9).

081KTSZN10008QG0R000VZHRQ4 slice 1 (Aaron 2026-06-11: "mechanize this to any hardware type with universal action grammar…
ground these in proper names"). The grammar is **carved from what already runs**, not invented: the
SoftScheduler loop is the living prototype, and every clause below names its running original.

## The grammar (pure shape — abstract members only, per the gen/ discipline)

```
Crossing                                  the label (SOS): an event crossing the membrane
  = Kind × Payload(text)                  · running original: InterruptKind (8 kinds, treaty-ratified)

Action⟨S⟩                                 the unit of behavior (guarded, reversible-aware)
  Guard   : Crossing → bool               · running original: HandlerK.Matches
  Step    : Crossing → S → Result⟨S⟩      · running original: HandlerK.RunK (ISR; Result-over-exception)
  Unstep  : Crossing → S → Result⟨S⟩      · the RETRACTION leg (Z-set −1); reversible backends bind it,
                                            irreversible backends declare K>0 heat (Landauer) instead

Loop⟨S⟩                                   the kernel (cooperative, DoP=1 deterministic)
  Drive   : Action⟨S⟩ list → Source → S → Result⟨S⟩
                                          · running original: SoftScheduler.driveK
  Source  : tick → Crossing list          · the §13 injected membrane (ALL entropy enters here)

Meter                                     the thermodynamic ledger (glass-blowing thermometer)
  Charge / Discharge / HeatSpent          · running original: SoftThrottle (Tank, heatSpent)

Corners⟨In, Out, InFb, OutFb⟩             the bidirectional feedback frame around any Loop
                                          · running original: FourCorner (NSEW; backpressure→harmonics)
```

Five clauses. A backend = an emitter that binds these five to a target's primitives. Nothing else is
part of the contract.

## Proper names (the Beacon row — each clause's human anchor)

| clause | anchor |
|---|---|
| the grammar itself | **Action Semantics** — Mosses & Watt 1992 (meaning as composable, generatable actions) |
| Crossing as label | **Plotkin SOS** 1981 (labelled transitions) |
| Guard + Step | **Dijkstra guarded commands** 1975 |
| Unstep | **Bennett 1973** (reversal pays memory); Janus (Lutz & Derby; Yokoyama & Glück); Vieri's PISA |
| Loop (DoP=1 deterministic) | **FoundationDB / Flow** (Zhou et al. 2021); Liedtke **L4** minimality |
| Meter | **Landauer 1961** |
| Corners | the maintainer's Itron TInFeedback/TOutFeedback (the four-corner prior art) |

## Backend bindings (capability-honest; the fan-out of 081KTSZN10008QG0R000VZHRQ4)

| backend | Guard/Step | Unstep | Meter | status |
|---|---|---|---|---|
| .NET (SoftScheduler) | native | via Z-set retraction | SoftThrottle | **the prototype — running** |
| CHIP-8 | opcode dispatch on key/timer crossings | snapshot-COW (Chip8Cow frames ARE Unstep) | tank-funded lookAhead | running (lens) |
| aarch64 / Pi | artisanal first (glass-blowing; 081KTSZN10008QG0R000VZHRQ4 §2) | declare heat honestly at first | heatSpent recorded | next metal |
| RISC-V (+reversible profile) | trap handlers | the un-instruction (PISA-class) — the novel seam | perf counters → Meter | open |
| MIPS | trap handlers (Max) | declare K>0 | — | open |
| FPGA / Verilog | always-block sensitivity lists ARE guards | dual-rail/adiabatic only if earned | switching activity | open (Aaron) |
| GPU / SPIR-V | wavefront predicates | ping-pong buffers | occupancy/W | the shader arc's end |

## Discipline

- Generators read THIS shape (interfaces, no classes — the gen/ rule). A backend never reaches around
  the grammar to the prototype's internals.
- Conformance = the treaty discipline: a backend ratifies by replaying a recorded Source (membrane-log
  golden vectors) and producing byte-identical state trajectories at its declared capability.
- `Unstep ∘ Step = id` (on reversible backends) is the testable law; FsCheck on the prototype, golden
  replay on conformers.

## Pointers

- `docs/research/2026-06-11-universal-action-grammar-reversible-risc-isa-...-glass-blowing.md` — the full grounding.
- `docs/backlog/P2/081KTSZN10008QG0R000VZHRQ4-...md` — staging; `src/Core/SoftScheduler.fs` · `SoftThrottle.fs` · `RecordedSource.fs` — the running originals.
- `universal/color.md` — the capability-honesty rule this grammar inherits.
