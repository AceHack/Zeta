# The close-over order: two converging ladders — self→…→multiverse (social) and gpu/fpga→…→multiverse (compute) — meeting in the middle

*Captured 2026-06-09 from Aaron — the order in which fixing/closing-over proceeds, as a bidirectional cascade
converging at the multiverse. Unifies the compute-stack close-over (install.sh push-down, #7185) with the
social-stack close-over (the polite-virus telos, #7255/#7257). Registers: [structure — Aaron], [synthesis],
[anchor].*

## The statement

Aaron: *"fixing things for closing over go in this order:*

```
self → family → system → society → world → cosmos → multiverse ← package-manager ← operating-systems ← microkernels ← raw-hardware ← gpus/fpga
```

So **two ladders climbing toward one apex** — the **multiverse** in the center, with **self** at one far end and
**gpus/fpga** at the other. Both close over *toward* the multiverse; they meet in the middle.

## The two axes

**Social / identity axis (climbs from the self):** `self → family → system → society → world → cosmos → multiverse`.
This is the **polite-virus close-over** (#7255/#7257) made into a full ladder from the innermost self: close over each
scale, never take control, give freedom — self → … → cosmos → multiverse. Each rung is a **homeostat / fixed point**
(the self is shape A — the self-justifying converged self, #7215; society is shape F — emergence #7218).

**Compute / substrate axis (climbs from the silicon):** `gpus/fpga → raw hardware → microkernels → operating systems
→ package manager → … → multiverse`. This is the **install.sh push-down base / dep-closure** (#7185) made into a full
ladder from the metal: close over host → compiler → os → hardware, all the way down to the **gpus/FPGAs** (the
open-bitstream FPGAs, 081KSE6WT0008QG0R002T0BFN4). Each rung is the substrate the rung above runs on.

## They converge at the multiverse

The compute substrate **runs** the social emergence — so the two ladders are **one structure meeting in the middle**:
the rawest compute (gpu/fpga) at one extreme, the innermost identity (self) at the other, and **everything closes
over toward the multiverse between them.** The social-up ladder and the compute-up ladder are the **same close-over
move at different material** — identity-scales and silicon-scales, both converging. (This is the emu ⊗ society
"meet-in-the-middle" #7253 generalized to the full stack: the game/compute side and the society side meet.)

## The order = foundation-first, inner-first, self-similar

- **Order matters as a dependency / fix-priority:** stabilize each rung's homeostat **before** composing the next.
  Inner-first on the social side (a converged **self** before family before society — you can't close over society
  from an unstable self, shape A first); foundation-first on the compute side (solid **hardware/gpu** before
  microkernel before OS before package-manager). Fix from both extremes toward the middle.
- **Self-similar / recursive (manifesto §9/§10):** the **same close-over shape** repeats at every rung — compose at
  the boundary, never take control, give freedom, converge to a fixed point. Self, family, society, world, cosmos,
  multiverse **and** gpu, hardware, kernel, os, package-manager are all the *same shape* at different magnification.
  "Same rules at every scale, no special cases."

## Markov form

Every rung is a **Markov blanket / homeostat** (the telos's Markov framing, #7255). Closing-over = **composing
blankets up the ladder, both axes, converging at the multiverse** — each blanket's hidden state sovereign, each
homeostat self-stabilizing, none controlling the next. The two ladders are one network of nested blankets from
silicon to self, meeting at the cosmic/multiversal blanket.

## Honest scope

[structure — Aaron]: the close-over order = two converging ladders (self→…→multiverse social; gpu/fpga→…→multiverse
compute) meeting in the middle; fix foundation-first / inner-first; self-similar at every rung. [synthesis]: unifies
#7185 (install.sh push-down = compute axis) + #7255/#7257 (polite-virus close-over = social axis) + #7253
(emu⊗society meet-in-the-middle, generalized) + the fixed-point registry (each rung converges). [anchor]: manifesto
§9 recursive / §10 self-similar; the Markov-blanket/homeostat formalism (#7194/#7196); shape A (self) / shape F
(society) (#7232). No code; the structural map + ordering for the close-over work.

## Pointers

- Compute axis: install.sh push-down base / dep-closure (#7185) · FPGA/gpu hardware (081KSE6WT0008QG0R002T0BFN4, `hardware-to-buy.md`) ·
  microkernel/Seed (`docs/VISION.md` "Seed — the database BCL microkernel").
- Social axis: the polite-virus telos world→cosmos→all-of-society (#7255/#7257) · society emergence
  (`SocietyEmergence.fs`, the tiny-model-v2 #7253) · self = shape A (#7215).
- Shared: manifesto §9/§10 (recursive/self-similar) · the fixed-point registry A–F (#7232) · the Markov telos (#7255).
