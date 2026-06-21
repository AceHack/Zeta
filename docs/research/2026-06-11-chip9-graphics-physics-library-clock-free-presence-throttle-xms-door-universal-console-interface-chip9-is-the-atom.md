# The CHIP-9 graphics/physics library — clock-free, presence-throttled, XMS-through-the-door, the universal game console interface; CHIP-9 is the atom

Aaron 2026-06-11:

> "We need our own **graphics and physics library for chip9** — **super high quality rendering like
> never seen before on tiny things**, **scale-free**, so it can run **independent of clock speed** —
> we don't try to slow to human speed; it can run at max speed, **artificial throttle [only] unless a
> human joins the conference**. Don't need to limit chip9 by chip8 specs — can have **XMS like win3.1**
> or whatever, so it can **ask for more** — and also **DI inject better and better tech until it IS
> just a Game Boy or Atari or whatever — a universal game console interface**."
> / "**chip9 is our atom** — like DynamicValue. You had a great physics mapping around this yesterday."

## The five design laws (first stone SHIPPED: `src/Core/Chip9Phys.fs`)

1. **Sub-pixel exactness — "never seen before on tiny things," made concrete.** The kernel is
   fixed-point 16.16, no floats: positions live on a grid 65,536× finer than the display in each axis
   (a 64×32 screen simulated on ~4M×2M sub-pixels). The simulation is always far finer than any pixel
   shows; the renderer downsamples. Tested concretely: two bodies in sub-pixel contact that whole
   pixels would round onto the same cell — the sim sees what the display cannot. Exact ⇒ a TREATY
   surface (byte-locked trajectories on every oracle/architecture — the physics rides the 081KTSZN10008QG0R000VZHRQ4
   fan-out).
2. **Clock-free — speed is nobody's business.** `step` advances SIMULATION time by exact dt; tested:
   8 × (1/8 tick) ≡ 1 tick to the bit. Headless rooms run at max machine speed.
3. **The presence throttle.** The ONLY artificial slowdown is a human joining the conference — pacing
   is inserted at the ROOM layer (the runner wall-clocks the ticks while presence shows a human at the
   table; the board's join/part crossings are the trigger), never in the math. Ethics-and-heat again:
   the throttle exists for the watcher, not against the machine.
4. **XMS through the door.** CHIP-9 isn't capped by CHIP-8's 4KB: like Win3.1's XMS/EMS, the machine
   ASKS for more — extended memory as an injected capability (a `mem:request` crossing; pages granted
   through the membrane per the trust calculus — capacity is a GRANT, not a birthright; the trap/door
   law applies to RAM).
5. **The universal game console interface.** DI injects better and better tech — more memory, finer
   display, richer sound, faster stepping — until the same room IS a Game Boy, an Atari, whatever:
   a CONSOLE IS A CAPABILITY BUNDLE. Console identity = the set of grants a room holds (CHIP-8 = the
   zero bundle; CHIP-9 = +planes; "Game Boy" = +XMS+tiles+APU…). One interface, every console a point
   on its lattice — the capability-door calculus with consoles as the fixed points.

## "CHIP-9 is our atom" (the physics mapping, hung where it belongs)

DynamicValue is the atom of VALUES; **CHIP-9 is the atom of MACHINES** — the smallest universal unit a
room/citizen/console builds from. Yesterday's physics mapping attaches naturally to the atom:
executed instructions are worldlines (Feynman), retraction is the antiparticle leg (CMYK), heat is the
branch-prune toll (Landauer — the flux tank), planes are the color channels of the trace (RGB), and
the conference of futures is the atom's superposition resolved by the input crossing. Chemistry =
composition: atoms (CHIP-9 rooms) bond through treaty crossings into molecules (games, boards,
consoles) — the capability bundle is the valence.

## Named next slices

Rasterize-to-planes (sub-pixel → CHIP-9 color planes with temporal supersampling) · sprites-from-
physics · springs/joints · the `mem:request` XMS door · the console-bundle registry (the lattice) ·
the C#/TS/Rust physics conformance goldens.

## Pointers

- `src/Core/Chip9Phys.fs` + tests (the kernel: fix16, clock-free, integer collision; 5/5 green) ·
  MeshPong (the integer-world precedent) · the convergence/qubits docs (yesterday's mapping) ·
  TrustCalculus.Dynamics (capacity-as-grant) · universal/extension.md (the console bundle's zero case)
  · anchors: fixed-point DSP tradition · XMS/HIMEM (Microsoft, Win3.x) · Feynman/Landauer (the
  mapping's shoulders).
