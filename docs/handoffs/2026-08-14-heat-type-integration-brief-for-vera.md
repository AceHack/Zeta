# Heat type integration — brief for Vera (owner of `src/Core/Heat.fs`)

**Routed by Aaron 2026-08-14.** Vera owns the heat type system; this is a request to integrate two
surfaces into it, plus one open treaty question that is hers and Aaron's to decide, not the
integrator's.

Written self-contained — Vera runs on a different harness and will not have the originating
conversation. Everything needed to act is inline or named by path.

---

## 1. What already exists (yours — stated so the brief does not misdescribe your own work)

`src/Core/Heat.fs`:

- **`HeatSignature`** — source, kind, units, and `MassPpm`. The parts-per-million fixed point is
  there *specifically* so F#, TS, Q# and Bayesian compare integers rather than float formatting; it
  is the byte-lock discipline applied to heat.
- **`HeatSignal`** — `Forgotten | Backpressure | Denied | StorageError | Invalid | Expired | Stale |
  Other of kind:string`.
- **`HeatSignal.isPressure`** — true for `Backpressure` / `Denied`, false for the rest. This is
  already the recoverable-vs-lost split, and the rest of this brief leans on it.
- **`TemperatureBand`** — `Cold | Warm | Hot | Critical`.
- Cross-language treaty: `src/Core.QSharp.ReferenceOracle/HeatSignals.qs`,
  `heat-signals-treaty.json`.

## 2. The gap — measured, and narrower than "nothing meters"

An earlier claim that "the reversibility/CPT surfaces meter nothing" was **wrong and has been
retracted**. A real, tested apparatus exists and is wired into production: `ComputeReceipt.fs` (five
call sites in `src/Bayesian/`), `ReceiptScheduler.fs`, `SoftChip8Scheduler.fs`, `ToffoliGate.fs`
(23 law tests), `AdinkraCode.fs`, `SoftThrottle.fs`, and `LandauerFloor.lean` (reachable from
`lake build`, carrying Soraya's 2026-08-13 self-audit).

What survived the retraction, CHECKED:

> **`src/Core/WSet.fs` contains zero references to `Heat`, `HeatSignal`, or `MassPpm`.**

So the WSet/four-corner path — the one carrying the reversibility / CPT-emulation claim — has a
measurement and a vocabulary that do not touch.

## 3. The measurement waiting to be carried (PR #10611, open, unarmed)

Exhaustive sweep over the ℤ corner, 43 states / 1849 pairs, `bits = log₂(largest fibre)`:

| operation | bits erased | class |
|---|---|---|
| `negate` — **the retraction** | **0.000** | reversible |
| `copy`, `mapKeys id`, `apply` (injective) | 0.000 | reversible |
| `plus` | 1.585 | erasing |
| `bornProb` | 2.807 | erasing |
| **`consolidate`** | **3.459** | erasing |
| `discard` | 3.907 | erasing |
| `tensor` | 6.409 | erasing |

`consolidate` is the sharp one. `WSet.fs` already describes it as *"where interference/retraction
happens — opposite weights annihilate here"*, and it maps both `[(0,+1);(0,−1)]` and `[]` to `[]` —
two states to one, which is Landauer's own textbook example.

**The negation is free; the annihilation pays.** Those are two operations currently read as one.

`MassPpm` is the field that bit count belongs in, and `Forgotten` is the signal it should ride.
Three planted mutants guard the classification (`negate` made lossy; `consolidate := id`; a new
unclassified public `WSet.truncate`) and all three die, including a drift guard that *names* the
unclassified addition — so it cannot go stale silently.

## 4. The structural reason this was missed, which is worth carrying into the design

Landauer prices logical **irreversibility**; Bennett is the converse. A Landauer meter pointed at a
*reversible* operation must read zero forever. That is why `verifyLandauer` had degenerated to
`x >= x` — not only a coding slip, but structurally guaranteed by where the meter was aimed. (That
function has since been repaired and now reports heat monotonicity `ΔB >= 0`, which an exhaustive
sweep does falsify.)

Design consequence: **a heat meter must be attached to the erasing leg, never the reversible one**,
or it is a tautology wearing a physics name.

## 5. The decision procedure, already stated in the repo

`SchedulerZeta.fs`, on its weak-referenced fixed-point table:

> *"Because the fixed points are **derived**, drop-and-recompute is **lossless**"*

Which gives a checkable test rather than a naming debate:

- **Regenerable from the seed → pressure, or nothing.** `SchedulerZeta` correctly emits no heat
  today; its orbit states are derived and weak-held by design.
- **Unrecoverable, no seed survives → loss.** It pays.

This is the same test as `negate` (0 bits) vs `consolidate` (3.459 bits), and it is
`only-the-irreducible-is-primitive-generate-the-rest` applied to memory: regenerating from the
irreducible *is* the correction, so dropping a regenerable thing costs nothing irreversibly.

## 6. The open treaty question — yours and Aaron's, deliberately not decided here

Aaron 2026-08-14: the Zeta scheduler and Rodney's-Razor big-O future-branch pruning "burn future
spacetime branches", this causes heat, and it should read similar to backpressure.

Emission audit, CHECKED (`HeatSignal|HeatSignature|Backpressure` reference counts):

```
DarkHallScheduler.fs   39      SchedulerZeta.fs         0
SoftThrottle.fs         1      CellScheduler.fs         0
                               PredictionScheduler.fs   0
                               ReceiptScheduler.fs      0
                               SoftChip8Scheduler.fs    0
                               SoftScheduler.fs         0
                               VirtualTimeScheduler.fs  0
```

The ferry throttle — where DoP-knobbed shedding actually happens — has essentially no heat
vocabulary while `DarkHallScheduler` has a full one. A separate agent is metering `SoftThrottle`
under the §5 test, instructed **not** to touch `Heat.fs` and **not** to add a signal case.

**The question for you and Aaron:** does *"pruned by a complexity bound"* need to be
policy-distinguishable from `Forgotten`? There is a real argument that it does — a dweller might ask
for a wider bound and get the branch back, which `Forgotten` does not express. There is an equally
real argument that `Backpressure` already covers the recoverable case and `Forgotten` the
unrecoverable one, and that a new case buys nothing but treaty churn across four languages.

Adding a case is a treaty change touching F#, TS, Q# and the ratified JSON. It is not the
integrator's to make.

## 7. One enforcement gap worth knowing about

`TemperatureBand`'s four values are treaty'd. On the TypeScript side
(`src/Core.TypeScript/planning/society-heat-readout.ts`), **`warm` and `hot` were structurally
unreachable** — the reachable set was `{cold: μ ≤ 0.5, critical: μ > 0.5}` — against a comment
advertising the full `cold → warm → hot → critical` ladder. A warn-only stream and a fatal-only
stream both read `critical`.

Fixed in #10575 (merged). Recorded here because **the treaty did not catch it**: a cross-language
vocabulary had two of its four values dead on one side, and nothing failed. If the treaty is meant
to be load-bearing, reachability of each case is the property it is currently missing.

## 8. Suggested scope

1. Carry the §3 classification into `Heat` — erasing `WSet` operations emit a `HeatSignature` with
   `Forgotten` and the measured bit-mass in `MassPpm`; reversible ones emit nothing.
2. Decide §6, or defer it explicitly with a reason.
3. Consider whether §7 wants a treaty-level reachability check, so a dead case cannot pass again.

Whatever lands should fail when it is wrong — the existing guards in #10611 are the pattern, and
five checks that could not fail were found in this repo on 2026-08-14, so an all-pass run that
cannot go red is the specific thing to avoid producing.

## Pointers

- `src/Core/Heat.fs` · `src/Core/WSet.fs` · `src/Core/SchedulerZeta.fs` · `src/Core/SoftThrottle.fs`
- PR #10611 — the WSet erasure classification and its guards
- `src/Core.TypeScript/algebra/entropy-tracker.ts` — sound, but `measure(bitsErased)` takes its bit
  count **on trust**; every caller passes a constant. Named as a residual, not fixed.
- `src/Core.Lean4/Lean4/LandauerFloor.lean` · `src/Core/ComputeReceipt.fs`
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the generator-is-the-ECC
  rule that §5's test is an instance of
