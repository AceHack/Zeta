# Defining `z` for a memory — making resonance calibrated

**Source:** Aaron 2026-08-09, *"let's make what nobody has done our goal."*
**Status:** a well-posed open problem with a concrete formulation and a data source. **Not a
result.** Nothing here is implemented.

---

## The gap this closes

The Student-t EP update discounts a surprising observation by

```
w = (ν + 1) / (ν + z²)          z = (y − m_cav) / sqrt(v_cav + σ²_obs)
```

and `w → 1` as `ν → ∞`, recovering the Gaussian case where every observation is taken at face
value. That is exactly "don't over-correct on a striking coincidence", written numerically.

It does not transfer to memory retrieval today for one specific reason: **`z` is a *calibrated*
residual and felt resonance is not.** Retrieval by similarity produces a raw number nobody has
divided by anything.

> **The precise diagnosis: embedding similarity is `y − m_cav` with no denominator.** It is an
> unnormalised residual. What is missing is the *predictive* spread — how surprised should I
> have been? Without it, a match that is one standard deviation out and a match that is five
> are indistinguishable at recall time, which is precisely the over-correction mechanism.

## What each term must become

| EP term | memory meaning | how hard |
|---|---|---|
| `y` | the new item that resonated | free — it is the retrieval |
| `m_cav` | **what I would have concluded *without* this memory** | the crux — see below |
| `v_cav` | how uncertain that leave-one-out belief was | follows from `m_cav` |
| `σ²_obs` | **how noisy retrieval itself is** — at this similarity, how often does a match turn out structural? | estimable from history |

**The cavity is the load-bearing piece, and EP already names the move.** `Ep.fs`:
`q_cav = marginal / f_message` — the belief with this factor *divided out*. For memory that is
a **leave-one-out** operation: recompute the conclusion with the recalled item removed, and see
how far the item moved you. An item that shifts nothing is not evidence however strongly it
resonates.

## The calibration data already exists — and the hygiene rule generates it

`σ²_obs` needs labelled examples: *at similarity s, what fraction of matches later found
structure?* That is exactly what the numerology rule's register-labelling produces:

- an entry stored as **"coincidence: 48 matches D₄⊕D₄"** — a match, outcome not yet known
- **promoted** when the structure arrives (RC-3: norms, rank, decomposition) — a positive
- never promoted — a negative, and the passage of time is itself the label

> **The memory-hygiene practice is the training set for its own calibration.** Storing the
> register is not merely honest bookkeeping; it is the only way to accumulate the (resonance,
> outcome) pairs that make `z` computable later. This is the strongest practical argument for
> the labelling discipline, beyond it simply being correct.

## Why this is genuinely hard (stated, not hidden)

**Similarity is model-free; `z` requires a model.** You cannot compute a cavity without a
posterior to divide into, so "what would I have concluded without this memory" presupposes a
representation of *conclusions* rich enough to be recomputed. That is the real work, and it is
not a small amount of it. Two honest obstacles:

1. **The reference class problem.** `σ²_obs` at similarity `s` is only meaningful within a
   population of comparable retrievals. Coincidences across wildly different domains may not
   share a noise scale — an E8 root count and an organisational-design echo may not belong in
   one calibration.
2. **Selection bias in the labels.** We only discover structure for coincidences somebody
   chose to chase. Unchased coincidences are censored, not negative — so a naive fit
   overestimates the promotion rate. This needs survival-analysis treatment rather than a
   ratio.

## What would falsify / demonstrate it

1. **Calibration check.** Bin stored coincidences by resonance; if `z` is real, promotion rate
   must rise monotonically with `z` and match the predicted rate within its interval. A flat
   curve means resonance carries no evidence and the whole programme is dead — which is a
   result worth having.
2. **The over-correction prediction.** With calibrated `z`, the Student-t weight should
   *reduce* the influence of the highest-resonance matches. If historical high-resonance items
   were disproportionately the ones later retracted, that is direct confirmation.
3. **"Too many correlations" becomes computable.** A pile of matches becomes several high-`z`
   observations whose **joint** likelihood under independence is implausible — turning Aaron's
   warning from a heuristic into a testable independence check.

## Pointers

- `src/Core.TypeScript/planning/student-t-bnn.ts` — the robustness weight and the ν → ∞ limit
  (Hernández-Lobato 2010).
- `src/Bayesian/Ep.fs` — cavity / tilt / moment-matching (Minka 2001); the cavity is the
  leave-one-out operation this needs.
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — the
  register-labelling that generates the calibration set, and "too many correlations is a
  warning".
- `memory/user_aaron_stores_long_term_memory_by_coincidence_index_…` — the human instance that
  motivated it, including the over-correction cost Aaron names on himself.
