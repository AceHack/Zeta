# Toy is free; metered must be earned

Carved sentence:

> Every model, constant, and formula is a **toy** until it acquires a
> **falsifier** — a metered measurement, a *checked* (not merely cited) anchor,
> or a test that fails when the model is wrong. Say so in the name: `toy*` in
> identifiers, "toy model" in prose. Shedding `toy` is an **earned** transition
> and the evidence must be nameable. Three states, and the middle one is the
> honest default for most code: **toy** (play freely) · **unmetered**
> (implemented, used, never falsified) · **metered** (has a falsifier).
> Unlabelled work is `unmetered`, **never "real" by default**.

## Why

Same shape as [`interfaces-free-classes-earned-under-rules.md`](interfaces-free-classes-earned-under-rules.md):
the **free** thing is the default (a toy carries no burden — explore, guess,
throw away), and the **privilege** must be earned under evidence. A model
claiming to measure reality is load-bearing; it is a *class*, not an interface.

The failure this prevents is **silent promotion**. On 2026-08-01 six conjectures
reached §A of the frozen core as DISCHARGED with nothing able to refute them —
including `F = Df² − 3.42Df + 0.5`, whose vertex is *exactly* the answer it
"predicts" (3.42/2 = 1.71). As `toyDimensionFit` it could never have been cited
as a discharge; the prefix **is** the guard. Contrast `src/Bayesian/LagrangeCondorcet.fs`,
which earned `metered`: μ_crit = (1−√(23/27))/2 is Routh's classical constant,
the tests pin 25.96 ≈ 1/μ_crit, and zero assertions are vacuous.

Binary vocabulary is what lets the middle state read as "real": most code is
**unmetered**, and saying so out loud is the point.

## Pointers

- [`interfaces-free-classes-earned-under-rules.md`](interfaces-free-classes-earned-under-rules.md) — the sibling earned-privilege rule this mirrors
- [`anchor-to-human-prior-art.md`](anchor-to-human-prior-art.md) — anchors must be **checked** (entailment), not cited; a real paper attached to a claim it does not prove keeps a model in `toy`
- [`every-bug-has-economic-value.md`](every-bug-has-economic-value.md) — the ΔU a falsifier banks is what the promotion is paid for
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — §A admits only metered claims; §B is where toys live
- `src/Core.TypeScript/hygiene/mutation-runner.ts` — the mechanical falsifier check (a test that survives mutation is not a falsifier)
- `src/Core.TypeScript/hygiene/lint-discharge-certificate-consistency.ts` — refuses a §A row whose evidence disagrees or is absent
