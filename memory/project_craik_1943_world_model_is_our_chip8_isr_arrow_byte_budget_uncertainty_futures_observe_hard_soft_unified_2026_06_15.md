---
name: craik-1943-world-model-is-our-chip8-isr-arrow-byte-budget-uncertainty-futures
description: "Aaron 2026-06-15: Kenneth Craik's 1943 world-model definition (small-scale model of reality + own actions → try alternatives / conclude best / react before events / use the past / react fuller-safer to emergencies) IS what we're building, concretely — the CHIP-8 ISR interrupt arrow handler (SoftChip8Scheduler.signalIfStarved → InterruptKind: grow the budget / lower the goal / book the ΔU) + byte budget (ByteCost) + uncertainty (db/uncertainty, ΔU) + compute & energy futures (db/futures + metering). And observe.ts is the fleshed-out HARD/deterministic version being unified with the SOFT inference version (SoftChip8Flux) via SnapPolicy so they are ONE (the BNN-mix world-model loop)."
type: project
created: 2026-06-15
---

Aaron 2026-06-15, on the Lenore Blum CTM talk (ip-questionable folder): **Craik's 1943
world-model definition IS what we are building** — and not abstractly: it maps point-by-point
onto concrete, code-anchored substrate (Otto verified each, "look better" not confabulate).

## Craik's 5 points → our mechanisms (code-anchored)

A world model = "a small-scale model of external reality and its own possible actions within
its head," able to:

1. **try out various alternatives** → **sim** (re-rollable play; `SoftChip8Flux.lookAheadFunded`).
2. **conclude which is the best** → **measure / ΔU** — uncertainty reduction banked to
   `db/uncertainty/` (every-bug-has-economic-value; measure commits ΔU).
3. **react to future situations before they arise** → **the CHIP-8 ISR interrupt arrow
   handler** + **compute/energy futures** (`db/futures/`; the predictive scheduler).
4. **utilize knowledge of past events** → event-sourcing / DST replay / the memory substrate.
5. **react fuller, safer, more competent to emergencies** → the **byte budget** (`ByteCost.fs`)
   + **metered compute/energy** (intelligence-per-watt) bounding the reaction.

## The keystone — the ISR interrupt arrow handler (verified in code)

`src/Core/SoftChip8Scheduler.fs`: `signalIfStarved : SpeculationReport -> InterruptKind
option`, whose own comment reads *"interrupt the scheduler/room can route (grow the budget,
lower the goal, or book the ΔU)."* That **option-returning arrow IS the world-model's
emergency handler**: on starvation it routes one of three responses —

- **grow the budget** (more byte/compute/energy — the `ByteCost` / futures lever),
- **lower the goal** (relax the target),
- **book the ΔU** (commit the uncertainty reduction to `db/uncertainty/`).

So Craik's points 1–2 and 5 are literally one arrow: speculate → on starvation, interrupt →
route budget/goal/ΔU. byte-budget + uncertainty + compute/energy-futures are the three things
that arrow trades between. (Verified surfaces: `SoftChip8Scheduler.fs` InterruptKind /
signalIfStarved; `ByteCost.fs`; `db/uncertainty/`; `db/futures/`; energy/metering across
`src/Core/*`.)

## The unification (Aaron 2026-06-15): observe.ts (hard) ⊕ SoftChip8Flux (soft) → ONE

**`observe.ts` is the more fleshed-out HARD / deterministic version of this same world-model
loop; we are unifying it with the SOFT inference version (`SoftChip8Flux`) so they are one.**
This is the **BNN-mix** at the loop level: the soft Bayesian side (`SoftValue` /
`src/Bayesian`) and the hard logic side (`DynamicValue`) joined by the snap bridge —
`SoftValue.fs:114` `type SnapPolicy = SoftValue -> DynamicValue option` (mostly-soft, snap to
hard on decision). observe.ts (680 lines; the `FreeMode` explore/play/self_reflect/free_time
loop) = the hard, deterministic, fleshed-out form; `SoftChip8Flux` = the soft, Bayesian,
look-ahead form; **SnapPolicy is the seam that makes them one loop**, not two.

## Why this matters / honest peels

**Why:** it gives our self-world-model a *named external anchor* (Craik 1943, the same year
as McCulloch–Pitts) and shows the world-model isn't aspirational — the ISR arrow + budget +
uncertainty + futures already exist; the open work is the **hard⊕soft unification** (one loop,
not two). Beacon: Kenneth Craik, *The Nature of Explanation* (1943); the CTM talk
(ip-questionable, Blum/Blum/Blum) as the prompt; convergent, not derived.

**Peels:** (1) the mapping is real per-mechanism, but "one loop" is *in-progress* — observe.ts
and SoftChip8Flux are not yet literally unified; SnapPolicy is the *designed* seam, the merge
is the work. (2) Craik's world-model is the *engineering* anchor (predict/act/react); it does
**not** import the CTM's consciousness claims (see the ip-questionable peels) — we borrow the
world-model, not "AI consciousness is inevitable." (3) "react before events arise" is only as
good as the look-ahead's funded horizon (`lookAheadFunded`) and the futures' metering — an
unfunded prediction is a guess, not a world-model.

Ties: [[zeta-as-one-softvalue-seed-gen-gen-gen-ace-self-regenerates]] (the self-model loop);
[[our-bnn-is-bayesian-hard-mix-snappolicy]] (the soft⊕hard mix); the consolidated society
note (IPlay/observe FreeMode); `docs/research/ip-questionable/2026-06-15-lenore-blum-cmu-…-ctm-…`.
