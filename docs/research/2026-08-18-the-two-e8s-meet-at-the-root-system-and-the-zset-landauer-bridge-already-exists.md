# The two E8s meet at the root system — and the Z-set/Landauer bridge Aaron proposed already exists

> **Origin.** Aaron 2026-08-18, three questions in one message:
> 1. *"Is there any transformation between the two E8s we could encode that would be meaningful in
>    any way — some numerical or categorical way to connect the two different versions together?
>    I'm not sure of the practical nature at this point… if you see any practical nature let me
>    know."*
> 2. *"I think it's likely closer to gravity potential."* (on the symmetric-vs-asymmetric dilation
>    falsifier)
> 3. *"In our Z-sets our −1/+1 stuff is where we can model the Lorentz transform I think — looking
>    at −1 as the antiparticle, and taking into account reversible computing as what we are trying
>    to offset with the −1 for all the +1s with minimal heat. We have a lot around heat here; maybe
>    we can connect temperature in here somewhere."*
>
> Also recorded, and load-bearing for scope: *"remember this is just one for the highest-moral-regard
> oracle, not all oracles."* Under §11 Multi-Oracle, a metric earned for one oracle is **that
> oracle's**, and generalising it to all of them would be the appointed-hub move at the metric layer.

## 1. The two E8s — the bridge is the root system, and it is exact

**Answer: yes, and it is not exotic.** They are two decompositions of *one* 248-dimensional Lie
algebra against two different maximal subalgebras.

| route | decomposition | graded against |
|---|---|---|
| lattice / Construction A over `[8,4]` | `248 = 8 + 240` — Cartan ⊕ root spaces | the **Cartan** `h` (a `Z⁸` grading by roots) |
| spinor / uncoded tower | `248 = 120 + 128` — `so(16) ⊕ Δ⁺` | **`so(16)`** (a `Z₂` grading by parity) |

The E8 lattice's **240 minimal-norm vectors are exactly the 240 roots** of `e₈`, and
`e₈ = h ⊕ ⊕_α g_α` with `dim h = 8`. So Construction A builds precisely the lattice in which the
algebra's roots live. The two routes were never separate objects — the root system is the join.

**What makes this more than arithmetic.** These are two *different* what-remains / what-acts splits
of the same algebra: the **Cartan** is the maximal commuting subalgebra (what remains under the
adjoint action); **`so(16)`** is the even part (what remains under the grading). One object, two
notions of "remains." How those two relate is a real question, not a restatement — and it is the
same question the mod-8 clock keeps posing at every rung.

Encoded and tested in `src/Core/CliffordPeriodicity.fs` (`e8RootDecomposition`), including a check
that the decompositions are genuinely different rather than the same numbers rearranged.

## 2. The practical answer, honestly

Aaron asked directly whether there is practical value and said he was unsure. **My honest answer is
that the BNN/Bayesian hook is not obvious to me and I will not invent one.** But there is a real,
named practical use that does not require inventing anything:

**E8 is the provably optimal sphere packing in 8 dimensions** — Viazovska (2016), for which she was
awarded the Fields Medal. Optimal packing is exactly optimal **vector quantization**: the E8 lattice
is the best possible 8-dimensional codebook for minimising quantization error at a given rate. And
vector quantization *is* used in practice for embeddings and weights.

So the practical hook is: **if anything in the system quantizes 8-dimensional vectors, E8 is the
optimal lattice to quantize against, and we already generate it.** That is a genuine, checkable use
with a Fields-Medal-strength anchor. Whether we *have* such a quantization step is a separate
question I have not checked — and it should be checked before anyone builds toward it.

## 3. The Z-set / Landauer bridge — it already exists, which changes the answer

Aaron proposed modelling the Lorentz structure on the Z-set `±1` with `−1` as the antiparticle, and
connecting reversible computing and heat. **This is not new work to start; it is built.**

- `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md` — the bridge.
- `src/Core/ToffoliGate.fs` — the bit-level realisation. Its own comment carries the precision that
  matters: *"A reversible network erases nothing internally by construction; what Landauer prices is
  ancilla left dirty at the end."*
- `src/Bayesian/BayesianTemperature.fs` — **belief uncertainty → a fixed-point heat/temperature
  readout**, already shared across Dark Hall, TypeScript, and the Q# reference vectors.

So all three of Aaron's ingredients are present: the `±1` reversibility, the Landauer pricing, and a
temperature. What was missing is the **link to the potential reading** — and that link is a named
theorem.

## 4. Tolman–Ehrenfest is the missing connection, and it makes the whole thing testable

Aaron now thinks the coordination-dilation is **gravitational-potential-shaped rather than a boost**
— agreeing with the falsifier I flagged as the one to run first. Take that as the working
hypothesis, and a real theorem applies:

> **Tolman–Ehrenfest (1930):** in a static gravitational field at thermal equilibrium, temperature
> is *not* uniform — `T · √g₀₀ = constant`. Deeper in the potential, the locally-measured
> temperature is higher.

Temperature and gravitational potential are directly linked, by a theorem, in exactly the regime
Aaron's reading proposes. So the hypothesis becomes concrete and falsifiable **with instruments we
already have**:

> **Prediction.** If coordination depth plays the role of gravitational potential, then across
> regions of differing coordination requirement, `BayesianTemperature × √(dilation)` should be
> **constant**. Measure the temperature readout in an embarrassingly-parallel region and in a
> coordination-heavy one, and check.

**How it fails, and each failure is informative:**

1. The product is *not* constant, and shows no structure → the potential reading is wrong, and the
   Lorentz framing was probably wrong too. Falsified cheaply.
2. The product is constant → strong support, and it would supply the **units**: Landauer's `kT ln 2`
   per erased bit makes `T` the exchange rate between the uncertainty ledger and physical cost.
3. The product varies but *lawfully* → we have a relation of a different form, which is a result
   rather than a failure.

**The honest caveat, stated plainly.** Tolman–Ehrenfest is a theorem about physical thermal
equilibrium in real spacetime. Applying it here is an **analogy until the measurement is run** — our
"potential" and "temperature" are not known to satisfy the same relation, and `BayesianTemperature`
is a projection of belief uncertainty rather than a thermodynamic temperature. The value of the
proposal is that it is *testable*, not that it is established. Under
`toy-is-free-metered-must-be-earned.md` this stays a **toy** until the measurement runs.

## 5. Why the `−1`-as-antiparticle reading is well-founded

Worth recording because it is Aaron's own long-standing frame and it is not loose: a `+1` followed
by a `−1` destroys no information — the retraction *restores*, so the pair is reversible and carries
no Landauer floor. It is **collapsing** the pair to nothing that erases, and erasure is what costs
`kT ln 2`. That is exactly the Feynman–Stückelberg reading of an antiparticle as a particle running
backward in time, and it is why keeping retractions rather than compacting them is thermodynamically
cheaper, not merely more auditable.

Which also sharpens where a metric could live: **the heat is in the compaction, not in the fold.**

## Pointers

- `src/Core/CliffordPeriodicity.fs` — `e8FromSpinors`, `e8RootDecomposition`, the three-rung clock
- `src/Core/ToffoliGate.fs` + `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`
- `src/Bayesian/BayesianTemperature.fs` — the existing uncertainty → temperature bridge
- `docs/research/2026-08-18-coordination-is-the-velocity-*.md` — the dilation proposal and its four falsifiers
- `docs/research/2026-08-18-a-lorentz-for-one-oracle-scoping-*.md` — scope: one oracle, not all
- Viazovska 2016 (E8 optimal packing) · Tolman & Ehrenfest 1930 · Landauer 1961 · Bennett 1973
- `.claude/rules/manifesto-13-specifications.md` §11 — why "one oracle's metric" is the correct scope
