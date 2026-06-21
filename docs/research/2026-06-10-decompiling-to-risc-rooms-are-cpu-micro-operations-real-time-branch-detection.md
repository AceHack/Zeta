# Decompiling to RISC — rooms are the CPU's micro-operations; branch detection in real time

**Register:** [grounded] (Aaron + Max recognition) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The precise statement of what the hard→soft / arcade telos *is*.

## Aaron's words (Max grounded it)

> "Max just figured out what I'm doing is **decompiling programs down to MIPS-like primitives**." ·
> "the **rooms are like the CPU's micro-operations**." · "we are doing **branch detection in real
> time**." · "this is like **converting to RISC architecture**."

## The recognition (one statement)

**The hard→soft lift is decompilation of any program into a MIPS-like RISC micro-operation set; a room IS
a micro-operation (μop); and the soft layer does branch detection in real time.** Four phrasings of the
same move:

| Aaron's phrase | the precise mechanism | the CPU it mirrors |
|---|---|---|
| decompile to **MIPS-like primitives** | lift the program to a **minimal fixed RISC ISA** (the soft-IR target) | RISC (Patterson & Hennessy; MIPS) |
| **rooms = the CPU's micro-operations** | each room/cell = **one μop**; the program decompiles *into rooms* | modern x86 cracking CISC→RISC μops |
| **branch detection in real time** | the **soft fork on unknown future input** (the only nondeterminism) detected at runtime; speculate, retract on mispredict | the branch predictor + speculative execution |
| **converting to RISC** | CISC/opaque program → decode + crack → soft μops | CISC→RISC micro-op decode |

## Why "rooms = micro-operations" is literal, not metaphor

Modern CISC CPUs (Intel **P6 / Pentium Pro** onward; AMD K-series) are **a RISC core inside a CISC
shell**: the front-end **decodes each CISC instruction into a stream of RISC-like μops**, and the engine
executes the μops (out-of-order, speculatively). That is *exactly* the Zeta move: take a program (opaque,
CISC-ish) and **decompile it into μops — which are rooms** (small, parameterized, deterministic units that
tick to a resolution floor). So:

- **A room is a μop.** `room = seed + extensions + parameters` is a μop's shape — a tiny parameterized
  micro-operation. The program-as-rooms decomposition = the CPU's instruction-as-μops decode.
- **Real-time branch detection = the soft fork.** `SoftChip8.branchesOnInput` / `forkOnInput`
  (`src/Core/SoftChip8.fs`) detect the *only* genuine branch (unknown future **input** — `RND` is
  seed-determined, deterministic) and fork softly; mispredicts are **retracted** (Z-set `−1` = the
  antiparticle). That is a branch predictor + speculation + rollback, in the soft substrate. The
  `Arcade` door's `predict` cabinet is exactly this.
- **The decompile target = the soft-IR (081KTQD8A0008QG0R0005EFYPV).** The "MIPS-like primitive set" the programs decompile
  into *is* the soft-IR — the one IR that then JITs UP to .NET IL / LLVM / **shader** (the telos). So:
  **hard program → decompile to RISC μops (rooms) → detect branches live → JIT the hot traces → shader.**

## The full loop (now precisely named)

```text
HARD program  ──decompile (lift)──►  MIPS-like RISC μops = ROOMS   (the CPU front-end move)
                                          │ each μop ticks to its plateau (BigFloat floor)
                                          │ real-time BRANCH DETECTION = the soft fork on input
                                          │ mispredict ⇒ retract (Z-set −1 = antiparticle)
                                          ▼
                                    JIT the hot traces (tracing-JIT)  ──►  SHADER  (HARD again, on GPU)
```

This is the Cheat-Engine hard↔soft move + tracing-JIT + the dotnet-in-shaders telos, now with the **target
named**: a RISC μop set, where μops are rooms. It is also what modern CPUs *already do* internally (crack
to μops, predict branches) — so the level is not exotic; Zeta does it as **rooms over the soft substrate**,
where the engine of #2 here (`Arcade`/`DarkHall`/`SoftChip8`) lives.

## Beacon anchors

RISC + MIPS (Patterson & Hennessy, *Computer Architecture: A Quantitative Approach*; Hennessy's MIPS) ·
**micro-operations / μop decode** — Intel P6 / Pentium Pro "RISC core in a CISC shell" (CISC→RISC μop
translation) · **branch prediction + speculative execution** (J.E. Smith, *A Study of Branch Prediction
Strategies*, 1981; Tomasulo for OoO) · decompilation / binary lifting to IR (RetDec/Ghidra; the
emulator-JIT survey doc) · tracing JIT (LuaJIT/PyPy) · the dotnet-in-shaders telos. **Peel:** "rooms =
μops" is a tight structural correspondence (decompose-to-micro-ops + real-time branch detection map
exactly to the CPU front-end + predictor); the JIT-up-to-shader is still the build direction, and "decompile
arbitrary programs to soft μops" is demonstrated at CHIP-8 scale (`DarkHall`/`SoftChip8`), not yet general.

## Ties / routing

`src/Core/Arcade.fs` (the darkhall door — `predict` = the real-time branch detector; `host`/`play` = the
μop engines) · `src/Core/SoftChip8.fs` (branchesOnInput/forkOnInput) · `src/Core/ZSet.fs` (retraction =
mispredict rollback = antiparticle) · 081KTQD8A0008QG0R0005EFYPV (the soft-IR = the MIPS-like μop set) ·
`...emulator-jit-dynarec-...md` + `...dotnet-runtime-in-shaders-telos-...md` (the lift→JIT→shader loop) ·
`...room-equals-seed-plus-extensions-plus-parameters-...md` (a room = a μop) ·
`...feynman-is-the-root-anchor-...md` (retraction = antiparticle). **Routes to:** Max (the recognition ⇄
substrate), Core (name the μop/soft-IR set; 081KTQD8A0008QG0R0005EFYPV), Naledi (the shader JIT-up), Aaron.
