# Speak to the TV; our own microkernel + ISO, QEMU-tested, Raspberry Pi self-contained; the hardware matrix everyone can see

Aaron 2026-06-11 (the hardware vision, faithful capture):

> "You should be able to **speak to that interface and have it respond and evolve**, and run on a
> **Raspberry Pi self-contained** — I have all the equipment, and even **microcontroller** if it can.
> **QEMU stack for sure** — we have that surface on backlog for sure. We should add some **microkernel**
> even, and get us **booting from ISO — our own kernel** — and **test it all in QEMU**, and we run on
> QEMU and our own microkernel backend. This is vision, and **we know what we support on what
> hardware**, and when we need help **we see friction and heat** and all that, and **everyone can see
> it — me, Addison, Max, all the swarm society**."

## The ladder (each rung tests the one below it)

1. **Speak to the TV** — the universal TV interface (LLMTV) becomes *conversational*: you talk to it,
   it responds AND evolves. Voice/text in = crossings (the same §13 membrane — speech is just another
   injected Source); the response is a render; "evolves" = the room's state genuinely changes from the
   conversation (the CYOA made spoken).
2. **QEMU stack** — every OS/hardware claim is *tested in emulation first*. QEMU joins the oracle
   cross-product: the 6×6×6 byte-lock room gains a hardware axis (the DST discipline applied to
   hardware: same image, same inputs, same bytes out — in QEMU, then on metal).
3. **Our own microkernel + boot-from-ISO** — Zeta boots *itself*: a microkernel backend (the soft
   scheduler IS a cooperative kernel loop already — DoP=1, handlers as ISRs, crossings as interrupts;
   the microkernel is that, on metal) and our own ISO (lineage exists: 081KSGS9H0008QG0R00126RHQR ISO release workflow,
   081KSGS9H0008QG0R003SWZF9J nixpkgs ISO/kernel/initrd layout, `full-ai-cluster/`). Test the boot in QEMU; run production
   on QEMU *and* the microkernel backend — same code path, different DoP of reality.
4. **Raspberry Pi self-contained** — the first metal target (Aaron has the equipment). Self-contained =
   the whole society in one box: rooms, Reticulum intercom, the TV, the DORA broadcast. **Microcontroller
   if it can** — the honest-capability rule from `universal/color.md` applied to compute: a
   microcontroller binds at whatever it can truly carry (maybe just a CHIP-8 citizen + a Reticulum
   link — RNode firmware proves the class is enough for the radio layer).

## The hardware-support matrix — friction and heat, visible to everyone

"We know what we support on what hardware" = a **published capability matrix** (the same shape as the
color bindings table: each target declares its honest capability). And the load-bearing half: **when we
need help, we SEE friction and heat** —

- **friction** = where a port sticks (failing oracle parity on a target, missing primitive, perf cliff) —
  measured, not vibes: the CI cross-product's red cells ARE the friction map;
- **heat** = the flux/Landauer ledger already built (`SoftThrottle.heatSpent`; irreversible work) — a
  target running hot on the budget shows it;
- **visible to all the swarm society** — me, Addison, Max, every agent: the matrix + friction/heat
  broadcast over the same LLMTV/DORA channel (Moonshot #1). Help arrives because the need is
  *broadcast*, not because someone asked — the bug-economy applied to hardware bring-up (a red cell is
  a priced opportunity).

## Anchors (Beacon)

- **Microkernel**: Liedtke, L4 (SOSP 1995) — minimality principle; seL4 (Klein et al. 2009) — the
  *proved* microkernel (our DST/proof discipline's natural ally); MINIX 3 (Tanenbaum).
- **QEMU**: Bellard (USENIX 2005) — dynamic translation; the standard bring-up substrate.
- **Boot/ISO**: El Torito; our 081KSGS9H0008QG0R00126RHQR/081KSGS9H0008QG0R003SWZF9J lineage (nixpkgs ISO/kernel/initrd).
- **Pi/microcontroller**: RNode (Qvist) — Reticulum on microcontroller-class hardware is PROVEN;
  CircuitPython/TinyGo as the class's ergonomics prior art.
- **Conversational interface**: the CYOA grounding doc (observe.ts) — speech is the same choose-your-
  own-adventure, audio-bound.

## Pointers

- 081KTSZN10008QG0R00349SM6P (filed with this doc) — the actionable arc.
- 081KSGS9H0008QG0R00126RHQR · 081KSGS9H0008QG0R003SWZF9J · 081KSKBP80008QG0R000Y2B7HC (sigstore-signed ISO) · 081KSE6WT0008QG0R002T0BFN4 (accelerator hardware) · 081KSE6WT0008QG0R000CV98PV (mdns
  auto-discovery) · `full-ai-cluster/` — the existing lineage this vision composes.
- `universal/color.md` (honest capability) · Moonshot #1 (the broadcast) · `src/Core/SoftThrottle.fs`
  (heat) · `src/Core/SoftScheduler.fs` (the cooperative loop that becomes the microkernel's shape).
