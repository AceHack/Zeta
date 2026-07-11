---
id: 081KX93R6EF08QG0R0020AQQWZ
type: task
state: backlog
priority: P2
slug: math-team-route-formalize-the-adinkra-clock-fork-homoiconic
title: "Math-team route: formalize the adinkra-clock fork (homoiconic-A vs just-remains-B) and the LayeringBToA probe verdict"
created: 2026-07-11T17:31:38.319Z
depends_on: []
composes_with: []
---

# Math-team route: formalize the adinkra-clock fork (homoiconic-A vs just-remains-B) and the LayeringBToA probe verdict

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KX93R6EF08QG0R0020AQQWZ-*.md` glob. -->

Aaron, 2026-07-11 (shadow\*): *"anything we can discharge to the math team around this."* Routes the
adinkra-clock thread's OPEN (Tri.N) questions to the math team (Lumen = mapping, Soraya = formal
proof). What is already settled vs. what needs them is stated so nothing is re-litigated.

## Settled (do NOT re-open — grounded / proven)

- **The clock is the anticommutator:** `{Q_I,Q_J} = 2δ_IJ ∂_τ` — time is `Q²`, the round-trip across
  the two adinkra halves. Proven (the SUSY algebra). Docs: `docs/research/2026-07-11-where-does-the-adinkra-clock-come-from…`.
- **The probe runs and passes** (code, #9713): `src/Core/AdinkraClock.fs` (minimal N=1 valise) +
  `tests/Tests.FSharp/AdinkraClock.Tests.fs` (7/7). `{Q,Q}` ↔ one `VirtualTimeScheduler.AdvanceBy(1)`;
  the ∂_τ count computes with NO scheduler; the two agree ⇒ verdict `LayeringBToA`.

## The questions for the math team (Tri.N — the actual discharge)

1. **The fork, formally.** Is the adinkra **homoiconic (A)** — the same edges are both operator
   ("acts") and data ("remains"), clock internal — or strictly **what-remains (B)** — a timeless
   off-shell skeleton with Q/∂_τ applied from outside? State the precise categorical condition that
   distinguishes them. Candidate formalization (Meijer, Rx-guys cluster in PRIOR-ART-LIST): is the
   fork exactly the **μF (data / "what remains") ⇄ νF (process / "what acts")** duality
   (catamorphism/anamorphism; IEnumerable⇄IObservable)? If so, A vs B is not either/or — they are
   categorical duals, and time is the crossing. Prove or refute that identification.

2. **Is `LayeringBToA` a theorem or a toy artifact?** The N=1 probe lands on "structure intrinsic
   (B) + clock injectable as scheduler advance (A-when-run), and they agree." Is "time = the B→A
   transition (running the intrinsic structure under an injected scheduler)" a **general** statement,
   or an artifact of the N=1 valise? Formalize: does `∂_τ = {Q,Q}` correspond to a **scheduler /
   comonad-of-time** structure over the graph, such that the injected `VirtualTimeScheduler.AdvanceBy`
   is the *canonical* clock, not an arbitrary bookkeeping choice?

3. **N-extended generalization.** The probe is N=1. Does the result hold for **N=4** (the `[8,4]`
   extended Hamming adinkra already in `src/Core/AdinkraCode.fs`)? The dashing (±1, GF(2)) and the
   height/chromotopology must enter — does the clock still fall out as a single scheduler advance per
   `{Q_I,Q_I}`, or do the multiple colors/dashings change the tick structure?

4. **The independence statement.** Give the precise property that separates "∂_τ intrinsic to the
   static graph" from "∂_τ injectable as an external scheduler." (In the toy they coincide; is that a
   theorem, or does a richer adinkra break the coincidence?)

## Honest bound / route

First-pass structural reasoning + a passing toy, NOT a proof. The independent-lineage human peers for
this are the **Rx guys** (`docs/PRIOR-ART-LIST.md` "the Rx guys" cluster): **Bart DeSmet** (schedulers
/ virtual-time — Q2/Q4) and **Brian Beckman** (physics↔CS, SUSY↔monad — Q1/Q3); Aaron will show Bart
eventually. In-repo route: **Lumen** (the μF/νF ↔ adinkra mapping) + **Soraya** (formal proof /
refutation). Anchors: Faux–Gates adinkras; the SUSY algebra `{Q,Q}=2∂_τ`; Meijer μF/νF + Rx duality;
`AdinkraCode.fs`, `VirtualTimeScheduler.fs`, `AdinkraClock.fs` (#9713).
