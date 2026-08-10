# The threshold rhyme — pay-per-step-with-a-deadline vs pay-once-and-foreclose

**Date:** 2026-08-10 · **From:** Aaron, in conversation; captured by Otto (shadow).
**Status:** a SHAPE observed across scales, register-labelled per
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md).
Decides nothing. Several rows are resonance and are marked as such.

---

## 0. The carved sentence

> There are exactly two ways to stay out of a bad region, and they have different
> **cost structures**, not different amounts of cost. **Steer every step** — pay
> continuously, and pay against a *deadline set by the system's own instability*. Or
> **foreclose the region** — pay once at the classification moment, then pay nothing,
> and accept that the guarantee holds totally or voids totally. The first buys
> flexibility and demands sustained attention at a required *rate*. The second buys
> freedom from the rate and demands you be right up front.

Aaron 2026-08-10: *"1 is harder and takes paid attention."*

## 1. Why the first one is harder, precisely

The cost of active steering is **not the total work — it is the required rate.**

OGY chaos control (Ott–Grebogi–Yorke 1990) stabilises an unstable periodic orbit with
*tiny* perturbations, but only if observation and correction happen inside the
**Lyapunov time** — faster than the divergence doubles. Miss that window and the
correction you were about to apply is meaningless: you are off the orbit, the
perturbation needed is no longer tiny, and OGY's own premise is void. **The deadline is
not negotiable by trying harder afterward.**

Two properties follow, and they are what make the taxonomy useful rather than pretty:

- **Cost diverges as you approach the threshold.** The nearer the boundary, the larger
  the correction required.
- **Past it, no finite budget suffices.** Not "expensive" — *unavailable*.

## 2. Aaron's addition: the horizon is the same rhyme

Aaron: *"this is exactly how you escape black holes — you can exit as long as you don't
cross some horizon with the energy generator function you have."*

The match is real and the divergence structure is identical: for an infalling observer
outside a black hole's event horizon, escape requires thrust applied within a finite
proper time, and the required Δv **diverges** as the horizon is approached. Inside, the
budget is not merely insufficient — every future-directed worldline leads inward. No
energy generator, however large, changes the answer.

**Where the rhyme is exact:** a threshold past which the correction budget is void,
with the required correction growing without bound as you approach it.

**Where it is NOT the same object, and this matters:** the *mechanism* differs.

| | what enforces the threshold |
|---|---|
| OGY / homoclinic tangle | **dynamical** — the divergence rate outruns your correction rate |
| event horizon | **causal / geometric** — the light cones tip; it is a statement about spacetime structure, not about speed |

So this is a **cost-structure isomorphism, not a shared mechanism**. One is a race; the
other is a wall. They rhyme because both are thresholds with diverging approach cost —
and that is exactly as much as is claimed here.

## 3. The same shape, at the scales we walked through today

| scale | pay-per-step (with a deadline) | pay-once (foreclose) | register |
|---|---|---|---|
| **Bε-tree / hitchhiker buffer** | the buffer, flushed under an amortised guarantee | — | **structural** (the flush guarantee IS the deadline) |
| **Durability** | volatile buffer + WAL; the loss window is the deadline | fsync-per-save; pay up front, no window | **structural** — `DurabilityMode` is literally this dial as a type |
| **Z-set vs G-set** | Z-set: a later −1 retracts a mistake | G-set: monotone, no retraction ever | **structural** (Aaron: this is *why* late discovery is survivable) |
| **Migration** | compensating migration | `Migration.Down = None` — no inverse exists | **structural** — the option type declares which world you are in |
| **Fleet healing** | drift-and-heal; **MTTH is the rate**, SLO budgets are the deadline | gated classes / HARD LIMITS — the region is simply not entered | **structural, and measured** |
| **Quantum ghosts** | — | ghost-parity symmetry forbids the negative region by construction | **analogy** (Turok/Bateman; the symmetry is conditional and unconfirmed in the full theory) |
| **Black hole** | thrust before the horizon, cost diverging | crossing forecloses, causally | **analogy with one metered consequence** (the divergence structure) |

**The load-bearing row is the fleet one, because it is the only one with numbers.**
BD001 carries `max_open_age_ticks: 1` because a red main compounds faster than a looser
cadence could catch. LD001 carries the same budget with a healer running every 17
minutes plus an immediate push trigger — the rate was *engineered to beat the
divergence*, against a failure that otherwise sits until a human notices. That is OGY
with the Lyapunov time replaced by "how fast does this break other lanes."

## 4. What the taxonomy predicts, and how it could be wrong

The two strategies **fail differently**, and this is the falsifiable part:

- **Active control degrades gracefully.** A slightly-wrong controller still controls,
  slightly. Model drift shows up as worse corrections, not as no corrections.
- **Structural foreclosure does not degrade at all — it holds or it voids, silently.**
  A symmetry that turns out not to hold gives you nothing, and gives you nothing
  *without a signal*. This is precisely why Turok's result is explicitly conditional on
  a symmetry he cannot yet confirm, and why a G-set misclassification cannot be undone
  by noticing later.

**So the two strategies want different instrumentation**, which is the practical
consequence: active control wants a *rate meter* (MTTH, SLO budgets — measure whether
you are beating the divergence). Structural foreclosure wants a *precondition checker*
(is the symmetry actually holding — because nothing will tell you when it stops).

**Falsifier for this whole note:** if a case turns up where structural foreclosure
degrades gracefully, or where active control fails totally rather than progressively,
the taxonomy is wrong and should be retracted rather than patched.

## 5. Why this belongs in the repo rather than in a chat log

It is manifesto §9/§10 (recursive / self-similar) doing real work rather than
decoration: the same decision recurs at seven scales, and at each one the engineering
question is the same — *am I paying per step against a deadline, or paying once to
foreclose?* Getting that classification wrong is expensive in a specific way: choosing
per-step where you needed foreclosure means the deadline eventually beats you; choosing
foreclosure where you needed flexibility means you cannot revise.

Aaron's operational conclusion, stated earlier the same day and independently:
**the care belongs at the classification moment, not the correction moment.** This note
is why. Classification is the only move that buys you out of the rate requirement.

## 6. Anchors (Beacon)

- **Ott, Grebogi & Yorke**, *Controlling Chaos*, PRL 1990 — stabilising an unstable
  periodic orbit with small perturbations.
- **Lyapunov exponent / Lyapunov time** — the divergence rate that sets the deadline.
- **Poincaré** — homoclinic tangles; **Smale** — the horseshoe.
- **Tarjan**, amortized analysis / the potential method — the `≤` slack that the
  per-step strategy amortises against. Formalised in-repo as the lax-monoidal cost
  functor over the (min,+) tropical semiring (`Lean4/CostRecurrence.lean`).
- **Bender, Brodal & Fagerberg** — Bε-trees; **Greenberg** — hitchhiker trees (the
  functional variant).
- **Shapiro, Preguiça, Baquero & Zawirski** — CRDTs; G-set monotonicity.
- **Athanassoulis et al.**, *Designing Access Methods: The RUM Conjecture*, EDBT 2016 —
  Read/Update/Memory: you optimise at most two.
- **Izraelevitz et al.** (DISC 2016) — buffered durable linearizability, the model
  `DurabilityMode.StableStorage` cites.
- **Penrose / Oppenheimer–Snyder** — event horizons and causal structure; the escape
  case is standard GR, cited here for the divergence structure only.
- **Turok & Bateman** (2026) — ghost-parity symmetry as structural foreclosure;
  see [the ferry](ip-questionable/2026-08-10-neil-turok-quadratic-gravity-krein-space-generalized-born-rule-aaron-forwarded.md).

## 7. Pointers

- [`2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-quasi-repeatable-orbits.md`](2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-quasi-repeatable-orbits.md)
  — the OGY/lens half; this note supplies the passive/structural sibling it lacked.
- [`2026-08-01-hypothesis-in-template-form-domain-indexed-placeholders-an-expert-can-argue-with.md`](2026-08-01-hypothesis-in-template-form-domain-indexed-placeholders-an-expert-can-argue-with.md)
  — declared holes; the Bε buffer as template.
- `docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md`
  — the fleet's per-step strategy, and why the gate (a foreclosure) was the wrong shape there.
- `registry/drift-slo.yaml` — the deadlines, as numbers.
- `src/Core/Durability.fs` · `src/Core/SchemaEvolution.fs` — the dial and the
  invertibility declaration, as types.
