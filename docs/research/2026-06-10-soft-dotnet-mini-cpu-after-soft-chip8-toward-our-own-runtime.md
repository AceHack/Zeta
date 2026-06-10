# Soft-emulate the .NET mini-CPU next (like SoftChip8) — toward our own runtime

**Register:** [grounded] runtime trajectory (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The emulation ladder: CHIP-8 → .NET → our own runtime.

## Aaron's words

> "basically we are going to do to the **.NET mini CPU** design for its registers and do the same we
> did for **CHIP-8** but for .NET — eventually **our own runtime**."

## The ladder

1. **SoftChip8 (done).** We already soft-emulated CHIP-8 — `src/Core/SoftChip8.fs` + the soft stack
   (`Chip8.fs`, `Chip8Observer.fs`, `Chip8Cow.fs`, `IntrCtx.fs`, `MemoryLens.fs`, `SoftController.fs`,
   `StateSpace.fs`). Trits/superposition + `measure`, memory-lensable, interrupt-driven (ISR arrow).
2. **Soft .NET mini-CPU (next).** Do the same for the .NET abstract machine: model its execution
   state **soft** (TriBoolean/SoftValue cells), **lensable** (the memory-lens, by address), and
   **Cheat-Engine-hookable** (the `hooks/` ClrMD/ICorDebug/EventPipe/Profiler surface). The "registers"
   to model (peel below): the CLR is a **stack machine** — the **evaluation stack**, **local-variable
   array**, **argument array**, and the IL **opcodes** (the .NET analog of CHIP-8's ~35 opcodes); plus
   the JIT's mapping to real CPU registers if we go that deep.
3. **Our own runtime (eventually).** Past emulating .NET — the Zeta runtime: the `sim` VM taken to its
   own ISA. CHIP-8 was the minimal floor; .NET is the rich middle; our runtime is the top, running the
   `sim |> mea |> cut` loop natively over the soft cells.

## Why this order

CHIP-8 first because it's the **minimal honest machine** (byte-lockable across oracles, total, tiny) —
prove the soft/lensable/interrupt approach there. .NET next because it's the **real target we run on**
(and the `hooks/` Cheat-Engine surface already reaches into it). Our own runtime last because by then
the pattern (soft cells + memory-lens + ISR-arrow interrupts + finalizer) is proven at two scales and
self-similar (§9/§10) — the runtime is just the pattern at its own scale.

## Honest scope / peels

[Beacon] **CHIP-8** (Weisbecker — the minimal VM, already soft-emulated) · **ECMA-335 / the CLR**
(the .NET abstract machine — note: a **stack machine**, not register-based; "registers" = eval-stack
slots / locals / args / JIT register allocation) · ClrMD / ICorDebug / EventPipe (the live-introspection
hooks). **Peel:** "mini CPU registers" is loose for the CLR's stack-machine model — capture the eval
stack + locals + IL opcodes as the soft cells; literal CPU registers appear only at the JIT layer. The
soft-emulation method is proven (SoftChip8); applying it to .NET + then our own ISA is the work ahead
(routes to Core + Naledi for the hot paths).

## Ties / routing

`src/Core/SoftChip8.fs` + the soft-CHIP-8 stack (the method to mirror) · `IntrCtx.fs` (the ISR arrow /
soft interrupt handler — the scheduler start) · [`hooks/`](../../hooks/) (the .NET Cheat-Engine hook) ·
the memory-lens / forcing-lensability doc (everything lens-addressable in memory) · [`sims/`](../../sims/)
(the `sim` VM the runtime runs) · TriBoolean/SoftValue (the soft cells). **Routes to:** Core team (the
soft .NET-CPU model + our-runtime), Naledi (hot paths), Aaron (the trajectory).
