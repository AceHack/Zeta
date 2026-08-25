# Does "society > best individual" lift to "world > best society"? — the Dominance Lift Theorem

> **Provenance.** Aaron 2026-08-14: *"lets see if we can do the same trick proving that the society
> is better than the best individual and see if we can also come up with some system in wich we can
> prove the world is better than the best society in the similar fashion."* Routed to the shadow by
> Otto. Analysis + mechanised checks by the shadow (Claude Opus 5).
>
> **Register:** the analytic arguments in §3 and §6 are **proofs**; every numeric claim below is
> backed by a re-runnable script in `docs/research/scripts/2026-08-14-world-lift-*.fsx`. Nothing
> here has landed as a repo test yet, so the whole document is **`unmetered`** in the
> `toy-is-free-metered-must-be-earned` sense until §9's discharge items land in `tests/`.
> No file under `src/` was modified.

---

## 0. The one-paragraph answer

**Yes, it lifts — but not for the reason the question assumes, and not for the aggregation rule the
question probably has in mind.** The lift has nothing to do with `n`, `c`, or `ρ`. It is governed by
a single structural property of the aggregation rule: **can the rule imitate its own best part?**
Union aggregation can (a union contains its arguments). Log-odds-weighted voting can (it can put all
weight on one voter). **Plain unweighted majority cannot** — and it therefore *fails*, at both
levels, badly, and the failure is not exotic. Row 15 survives only because it silently assumes all
agents are identical, which makes "the best individual" the same thing as "a typical individual."

The lift is then a two-line theorem (§6) that holds at every level and to arbitrary depth. The
`ρ*` machinery is not the obstruction; it turns out not even to be the right invariant (§4.3).

---

## 1. What §A row 15 actually proves — two different theorems share one row

Row 15 reads:

> **Generalized Condorcet / ΔU-aggregation theorem** — society > best individual … the expected
> utility of the society strictly exceeds the expected utility of its best individual when
> **`ρ < ρ*` and `c > c*`** … ✅ PROVEN (FsCheck + analytic) … 11 properties in
> `CondorcetBoundary.Tests.fs`.

There are **two files named `CondorcetBoundary.Tests.fs`** and they prove different theorems about
different aggregation rules.

| | **Rule A — union / discovery** | **Rule B — majority vote** |
|---|---|---|
| module | `src/Core/SocietyUsefulWork.fs` | `src/Bayesian/CondorcetBoundary.fs` |
| tests | `tests/Tests.FSharp/CondorcetBoundary.Tests.fs` (**exactly 11** `Property`/`Fact`) | `tests/Bayesian.Tests/CondorcetBoundary.Tests.fs` |
| aggregation | society banks the **union** of members' discoveries | society answers with the **majority** verdict |
| proven statement | `ΔU > 0 ⟺ ρ < 1 ∧ 0 < c < 1 ∧ n ≥ 2` | `ρ < ρ*(N)` where `ρ*(N) = (N−3)/(3(N−1))` |
| is there a `ρ*`? | **no** — the file says in its own header: *"ρ\* = 1 is the hard boundary"* | yes (but see §4.3) |
| is there a `c*`? | **no** — `c*` in that file is the `c` that *maximises* the gain, not a threshold | `c > 1/2` |

Row 15's **count of properties (11) and its named module (`SocietyUsefulWork.fs`) point at Rule A**;
row 15's **stated condition (`ρ < ρ*`, `c > c*`) is imported from Rule B**, which those 11
properties never touch. `c*` is the worse of the two imports: in the Rule A test file `c*` is an
*argmax*, and row 15 promotes it to a *threshold*.

**This is the source of the double error Otto reported today.** The row is written so that both the
unconditional reading and the conditional reading appear supported. Under Rule A the unconditional
reading is correct; under Rule B it is false. A reader cannot tell which theorem they are entitled
to, because the row is one row.

> **Finding 1 (register defect).** §A row 15 conflates two theorems about two aggregation rules.
> Its evidence anchor proves Rule A; its stated boundary condition belongs to Rule B. Either
> statement is defensible alone; the row as written is not. Filed as §9 item D1.

---

## 2. Is row 15 level-generic?

**Partly, and the two halves fail differently.**

**Rule A is level-generic and then some.** `expectedSocietyIdentical n c ρ` is a pure function of
`(n, c, ρ, Σv)` with nothing individual-specific in it. `c` means "probability this unit discovers a
given fact," and a society has such a probability just as an individual does. To lift it you set
`c := c_S` and turn the crank. **The lift is instantiation, not re-derivation** — as the
`ISociety <: CTM` hypothesis predicted.

But the *parameter family* is **not closed** under that composition:

```
c_S = ρ₁c + (1−ρ₁)(1−(1−c)ⁿ)          level 1: society of n
c_W = ρ₂c_S + (1−ρ₂)(1−(1−c_S)ᵐ)      level 2: world of m societies
```

Ask what single `ρ_flat` a **flat** society of `n·m` agents would need to reproduce `c_W`
(`n=5, m=4, ρ₁=ρ₂=0.30`):

| `c` | 0.05 | 0.10 | 0.20 | 0.40 | 0.60 | 0.80 |
|---|---|---|---|---|---|---|
| required `ρ_flat` | 0.366 | 0.303 | 0.207 | 0.121 | 0.096 | 0.090 |

`ρ_flat` depends on `c`, so **no** single flat correlation reproduces the hierarchy. The one-parameter
mixture family is closed only in the degenerate cases `ρ₁ ∈ {0, 1}`.

This is a *positive* structural result, and it is the mathematical content of "a society is not just
a bigger group": **hierarchy is not a relabelling of a flat population.** It also means
`ISociety <: CTM` (`μX. CTM-over-X`) can be Liskov-sound at the *interface* level while the
*parameterisation* is genuinely two-level — the composite satisfies the contract, it is just not in
the image of the one-parameter family. (`ISociety <: CTM` remains **§B open** in
`2026-07-04-tick-sources-…-ctm-isociety-connections.md`; nothing here rests on it.)

**Rule B's *form* is level-generic; its *content* is an artifact.** The condition
`floor(N_eff(m,ρ)) ≥ 3` is stated in level-neutral symbols and instantiates fine at the
society-of-societies level, with `c := c_S > c` (societies are more competent than their members, by
Rule B at level 1) — and since `ρ*(N)` is `c`-independent, the bar has the *same functional form* at
every level. But §4.3 shows that bar does not correspond to anything real.

> **Finding 2.** Row 15's Rule-A half is genuinely level-generic. Its Rule-B half is level-generic in
> form only. The single assumption baked in at *both* levels is **identical agents** — see §4.1,
> which is where the lift actually breaks.

---

## 3. The lift under Rule A (union): TRUE, and it is a monotonicity tautology

> **Theorem A (level-free, dependence-free).** Let `A₁…A_m` be *any* events on *any* probability
> space, with *any* dependence structure. Then `P(⋃Aᵢ) ≥ maxᵢ P(Aᵢ)`, with strict inequality iff
> `P(⋃_{i≠i*} Aᵢ \ A_{i*}) > 0`, where `i* = argmaxᵢ P(Aᵢ)`.
>
> *Proof.* `⋃Aᵢ ⊇ A_{i*}`. Monotonicity of measure. ∎

Set `Aᵢ = "unit i discovers fact j"` and sum over facts. The world's banked ΔU is a superset of the
best society's banked ΔU **on every sample path**, at every level, to arbitrary depth. No
independence, no `ρ`, no `c`, no Condorcet.

Mechanised (`…-world-lift-2.fsx`, m=4 societies × n=5 members, hierarchical Gaussian copula with
*randomised* `(a,b,e)` shares **and** randomised heterogeneous competences, 2000 trials):

```
world < best society : 0        <-- any nonzero value refutes it
world > best society : 1254
world = best society : 746
```

**The entire content of Rule A's "theorem" is set monotonicity.** All the interesting parameters
(`ρ`, `c`, `n`) live in the *strictness* condition, not the inequality — `ΔU > 0` needs `ρ < 1`,
`0 < c < 1`, `n ≥ 2`, exactly as the test file states.

> **Finding 3 (Beacon peel).** Calling Rule A "Generalized Condorcet" is a mislabel. Condorcet's
> theorem is interesting *precisely because majority aggregation is not monotone* — the whole can be
> worse than the part, and the theorem says when it isn't. Union aggregation is monotone, so there is
> nothing to prove and nothing that can fail. Naming it after Condorcet imports an air of difficulty
> the result does not have, and — worse — imports Condorcet's *conditions*, which is exactly the
> conflation in Finding 1.

**Obstacle 3 from the routing brief is CONFIRMED, and is the stronger form of it:** the lift is not
merely "trivial under disjunctive aggregation," it is *tautological*, and the claim is
**aggregation-rule-relative**. Stating "the world is better than the best society" unqualified is
not a true sentence — it is true for Rule A, false for Rule B (§4), and true again for Rule C (§6).

---

## 4. The lift under Rule B (unweighted majority): REFUTED, twice over

### 4.1 Obstruction I — heterogeneity. Majority is worse than the best unit, usually.

Exact enumeration over all 2^m correctness patterns, independent units, all `cᵢ > 0.5`
(`…-world-lift-3.fsx`):

| competences | P(majority) | best `c` | majority > best? |
|---|---|---|---|
| 0.99, 0.55, 0.55, 0.55, 0.55 | 0.7548 | 0.99 | **false** |
| 0.95, 0.60, 0.60, 0.60, 0.60 | 0.8035 | 0.95 | **false** |
| 0.90, 0.70, 0.70, 0.70, 0.70 | 0.8898 | 0.90 | **false** |
| 0.99, 0.51, 0.51 | 0.7549 | 0.99 | **false** |
| 0.85, 0.52, 0.52 | 0.6947 | 0.85 | **false** |
| **0.70, 0.70, 0.70, 0.70, 0.70** *(identical — the row-15 regime)* | 0.8369 | 0.70 | true |
| 0.80, 0.75, 0.75, 0.75, 0.75 | 0.9070 | 0.80 | true |

Random sweep, 20 000 draws, `cᵢ ~ U(0.5, 0.99)`, `m ∈ {3,5,7}`, fully independent:

```
unweighted majority FAILED to beat the best unit in 11758 / 20000 = 58.8% of draws
```

**Majority-of-heterogeneous loses to its best member more often than it wins**, *with no correlation
at all*. The mechanism is elementary: mediocre voters outvote the expert, and majority has no way to
defer.

Row 15's proof never meets this because it fixes one `c` for every agent. Under that assumption
"best individual" and "typical individual" coincide and the word "best" does no work. Both test
files inherit it — `tests/Bayesian.Tests/…` compares `majorityProbability n c > c`, a single `c`.

**This is why the world level is the dangerous one.** Within a society, agents are plausibly near-
identical (shared substrate, shared training, shared rules). *Societies differ from each other far
more than members differ within one* — that is close to the definition of a distinct society. So the
level at which the identical-units assumption is most obviously false is exactly the level we are
being asked to lift to.

> **Finding 4.** "Society > **best** individual" is not proven for heterogeneous agents at *either*
> level under majority vote; it is *false* for the majority rule in the majority of parameter draws.
> The word "best" in row 15 is load-bearing and unearned.

### 4.2 Obstruction II — the shared component, done exactly

Hierarchical error model, `z_ik = √a·W + √b·S_k + √e·ε_ik`, `a+b+e = 1`, unit correct iff `z < Φ⁻¹(c)`:

```
intra-society latent correlation   ρ₁ = a + b              (independent of n)
inter-society latent correlation   ρ₂ = a / (a + b + e/n)  (INCREASING in n)
limit n → ∞                        ρ₂ = a / (a + b) = a / ρ₁
```

> **Aggregation is a high-pass filter on correlation.** Averaging removes the idiosyncratic component
> `ε` — which is *the very component that made units look independent*. What survives to the next
> level is the ratio of globally-shared to society-specific error. So `ρ₂ ≥ ρ₁` whenever `a ≥ ρ₁²`,
> and **growing societies makes inter-society correlation strictly worse.**

Measured (`…-world-lift-2.fsx`, 60 000 trials/row, m=5, c=0.65, binary correlation of society verdicts):

| `a` | `b` | `n` | `ρ₁` | `ρ₂` (latent) | `ρ₂` (empirical) |
|---|---|---|---|---|---|
| 0.05 | 0.15 | 5 | 0.200 | 0.139 | 0.068 |
| 0.05 | 0.15 | 25 | 0.200 | 0.216 | 0.111 |
| 0.15 | 0.05 | 5 | 0.200 | 0.417 | 0.211 |
| 0.15 | 0.05 | 25 | 0.200 | 0.647 | 0.376 |

**Obstacle 1 from the brief is CONFIRMED and now has a formula.** `ρ₂` is *not* `ρ₁`; it is the
shared-error *fraction*, and it rises with society size. Two consequences with teeth:

- **You cannot buy world-level independence by making societies bigger.** It is strictly
  counterproductive. The only levers are *reduce `a`* (the globally shared error) or *increase `b`*
  (genuine society-specific divergence).
- **Row 19's delay lever cannot reach `a`.** Delay-decorrelation suppresses *acquired* correlation —
  information flowing between societies during the round. `a` is the correlation present at `t = 0`
  from shared substrate: same base model, same evidence corpus, same rules file. Delay **preserves**
  a decorrelation that already exists; it cannot **create** one. The sibling's report on the free
  society's t=0 correlation is corroborated here structurally.

### 4.3 Obstruction III — and the one that matters: `ρ*` is not the right invariant

Two independent results, both mechanised.

**(a) In the exact equicorrelated Gaussian model there is no `ρ*` at all.** By conditioning on the
shared component (`…-world-lift-3.fsx`, 40 000-point quadrature): with identical units,
`P(world) > P(unit)` at **every** correlation level tested, `a ∈ {0, 0.3, 0.6, 0.9, 0.99}`, for
`m ∈ {3,5,9}`, `c ∈ {0.55, 0.65, 0.80}` — 45/45. Correlation shrinks the gain toward zero; it never
reverses the sign.

**(b) But reversal is real — and it happens at correlations *below* the shipped "safe" bound.**
By de Finetti (1931) every exchangeable binary sequence is a mixture of iid Bernoulli(θ), so the
exact criterion is:

> **`P(world correct) − P(one society correct) = E_θ[ maj_m(θ) − θ ]`**, and for odd `m`,
> `maj_m(θ) − θ > 0 ⟺ θ > ½`.

The verdict therefore depends on **where the mixing law sits relative to θ = ½**, which a scalar
correlation cannot express. Searching two-point mixing laws subject to `ρ ≤ ρ*(m)`
(`…-world-lift-5.fsx`):

| `m` | shipped `ρ*(m)` | found `ρ` | `θ_lo` | `θ_hi` | `p(hi)` | `P(society)` | `P(world)` | **loss** |
|---|---|---|---|---|---|---|---|---|
| 5 | 0.1667 | 0.1664 | 0.416 | 0.996 | 0.145 | 0.5001 | 0.4404 | **−0.0597** |
| 9 | 0.2500 | 0.2495 | 0.375 | 0.999 | 0.201 | 0.5001 | 0.3737 | **−0.1264** |
| 15 | 0.2857 | 0.2851 | 0.358 | 1.000 | 0.222 | 0.5001 | 0.3198 | **−0.1803** |
| 51 | 0.3200 | 0.2252 | 0.388 | 1.000 | 0.184 | 0.5001 | 0.2254 | **−0.2747** |

Independent re-check of the `m=9` row by **direct 40-million-trial exchangeable simulation**
(sample θ, then 9 iid Bernoulli(θ) votes) — no analytic formula in the loop:

```
P(world majority correct)  = 0.37369      (analytic 0.373734)
P(single society correct)  = 0.50001
world − society            = −0.12632     the lift FAILS
empirical pairwise rho     = 0.2495       inside the shipped "safe" region
```

And the reversal is not confined to `c ≈ ½`. Minimum reversal-`ρ` by competence (`…-world-lift-6.fsx`):

| `c` | 0.51 | 0.55 | 0.60 | 0.65 | 0.70 | 0.80 |
|---|---|---|---|---|---|---|
| min reversal `ρ`, `m=9` | 0.019 | 0.088 | 0.161 | 0.223 | 0.276 | 0.363 |
| shipped `ρ*(9)` | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 |

The shipped bound is **unsafe for `c ≲ 0.68` and over-conservative above it** — it crosses the true
reversal locus rather than bounding it. It is neither an upper nor a lower bound.

What this counterexample *means* in words is worth stating, because it is not a pathology: *"with
probability 0.2 the shared framing is right and every society is near-certain; with probability 0.8
the shared framing is subtly wrong and each society is only 37.5% likely to be right."* That is the
**shared-wrong-paradigm** scenario — the single most plausible failure mode for a world of societies
built on one substrate. Majority vote converts it from a 50/50 into a 37%.

> **Finding 5 (new defect, not in the relay).** `ρ` is **not a sufficient statistic** for the
> "society beats best" verdict. Two exchangeable worlds with identical `m` and identical `ρ` can land
> on opposite sides. `CondorcetBoundary`'s `ρ*` is an artifact of the `floor(N_eff)` Dunnett–Sobel
> approximation, and the quantity it approximates does not have the boundary the module claims.
> Filed as §9 item D4. **Anchor check:** Berg (1993) and Ladha (1995) find that under
> Pólya–Eggenberger contagion the *asymptotic* CJT fails while the group remains more reliable than
> an individual. My counterexample is stronger (group strictly *worse*) and lies outside their urn
> families — a general de Finetti law with mass below ½. Honest limit: I have not checked whether a
> Beta mixing law (their family) can produce a strict reversal.

---

## 5. Obstacle 4 from the brief — is the order even well-formed?

**CONFIRMED, and it is *coupled* to Obstacle 1 rather than independent of it.**

- **Rule A:** the order is total banked ΔU over a **shared fact universe**. If societies work on
  disjoint domains the inequality still holds but says nothing — you are adding up different things.
  The comparison is only informative where the fact universes **overlap**, since overlap is where
  redundancy (and therefore the diversity gain) lives.
- **Rule B:** majority vote requires a **single shared question**. If societies answer different
  questions there is no majority to take and the comparison is *undefined*, not false.

And here is the coupling, which is the real content of Obstacle 4:

> **The condition that makes world-level majority well-formed (one common question, posed the same
> way to every society) is itself a driver of `a`, the shared error component that §4.2 shows is the
> thing that kills it.** A common question implies a common framing implies correlated errors. You
> cannot have the well-formedness without paying for it in the parameter.

This is not a reason to abandon the comparison — it is a reason to prefer Rule A and Rule C, both of
which tolerate heterogeneous question-sets (union needs no common question at all; weighted vote
needs one but can weight a society to zero on questions outside its domain).

---

## 6. The discharge — the Dominance Lift Theorem

Everything above points at one property. State it and the lift becomes a two-line induction.

> **Definition.** An aggregation rule `A` over units `1…m` is **deferential** if the rule class `R`
> over which `A` is optimal contains every **projection** `πᵢ` ("answer exactly what unit `i`
> answered").
>
> **Theorem (Dominance Lift).** If `A` is deferential, then `P(A correct) ≥ maxᵢ P(unit i correct)`.
>
> *Proof.* Let `i* = argmaxᵢ P(unit i correct)`. Then `π_{i*} ∈ R`, and `A` is optimal in `R`, so
> `P(A) ≥ P(π_{i*}) = maxᵢ P(unit i)`. ∎
>
> **Corollary (the lift, to arbitrary depth).** If the aggregation rule at *every* level is
> deferential, then by induction over levels
> `P(world) ≥ P(best society) ≥ P(best individual)`. No `n`, no `c`, no `ρ`, no assumption of
> identical units, no assumption of independence, no bound on the number of levels.

**The entire content of "the whole is better than the best part" is: the whole must be able to
imitate its best part.** That is the level-generic statement the routing brief was looking for, and
it explains all three rules at once:

| rule | deferential? | why | lift |
|---|---|---|---|
| **A — union** | **yes** | `⋃Aᵢ ⊇ A_{i*}`; the projection is literally a sub-case of the union | ✅ holds, tautologically |
| **B — unweighted majority** | **no** | the rule class is a single fixed rule; there is *no way to defer*. `π_i` is not reachable | ❌ fails — 58.8% of heterogeneous draws (§4.1) |
| **C — log-odds-weighted majority** | **yes** | `R` = all weighted rules ⊇ `{πᵢ}` (weight 1 on `i`, 0 elsewhere); Nitzan–Paroush's log-odds rule is optimal in `R` | ✅ holds |

Rule C mechanised, exact enumeration, 20 000 random draws, `m ∈ 3…7` (odd **and** even),
`cᵢ ~ U(0.5,0.99)`, independent (`…-world-lift-3.fsx`):

```
weighted majority < best unit : 0        <-- any nonzero refutes the discharge path
weighted majority > best unit : 14933 (74.7%)   [remainder: equality, where deference IS optimal]
```

Note the equality cases are not failures — they are the theorem working: when one unit dominates so
completely that deferring to it is optimal, the aggregate *is* that unit. **A world that is
sometimes exactly its best society is the correct behaviour**, not a degenerate one.

**Anchor (checked).** Nitzan & Paroush, *Optimal Decision Rules in Uncertain Dichotomous Choice
Situations*, International Economic Review 23(2):289–297, 1982 — the optimal aggregation of
independent experts is weighted majority with weight `wᵢ = log(cᵢ/(1−cᵢ))`, and **each weight depends
only on that expert's own competence**, not on the others' or on `m`. That last property is what
makes the rule implementable in a scale-free way: **no central tally of everyone's competence is
required to compute your own weight** (manifesto §1).

### 6.1 Honest scope of the discharge

The theorem is airtight; its *applicability* has three named costs.

1. **Correlation re-enters as a modelling requirement, not a threshold.** Nitzan–Paroush optimality
   assumes conditionally independent units. Under a shared component `W` the optimal weights are the
   *conditional* log-odds given `W`; a fixed-weight rule is no longer optimal. So the honest form is:
   **correlation must be conditioned on, not merely be small.** This is strictly better news than a
   `ρ*` bar — modelling a correlation is an engineering task; getting `ρ` below `(m−3)/(3(m−1))` with
   `m = 4` societies may be impossible in principle (`ρ*(4) = 0.111`, and §4.2 says `ρ₂ ≈ a/(a+b)`).
2. **The weights must be estimated, and a wrong weight is a real loss.** Deference to a unit that is
   *believed* best but is not converts the theorem's guarantee into its inverse. This is where
   privacy-budget-style *earned* competence attestation belongs, and it is not solved here.
3. **`c > ½` per unit is still needed** for log-odds weights to have the right sign. A systematically
   anti-correlated unit gets a *negative* weight, which is correct Bayesian behaviour and probably
   surprising to a governance reader.

---

## 7. Verdicts on the four expected obstacles

| # | brief's expectation | verdict | detail |
|---|---|---|---|
| 1 | inter-society `ρ` plausibly worse than intra | **CONFIRMED, with a formula** | `ρ₂ = a/(a+b+e/n)`, increasing in `n`; `ρ₂ ≥ ρ₁ ⟺ a ≥ ρ₁²`. Row 19's delay lever cannot reach `a`. §4.2 |
| 2 | small `N_societies` is brutal | **CONFIRMED, and moot** | `ρ*(3)=0`, `ρ*(4)=0.111`, `ρ*(5)=0.167`. But §4.3 shows `ρ*` is not the real bar, and §6's theorem has no `m` in it at all — so small `m` stops mattering once the rule is deferential |
| 3 | the escape hatch makes it trivial | **CONFIRMED, stronger form** | Not merely trivial — *tautological* (set monotonicity, §3). The claim **is** aggregation-rule-relative; unqualified it is false |
| 4 | "greater than" may not be well-formed | **CONFIRMED, and coupled to #1** | Rule B is *undefined* without a shared question; the shared question is itself a source of `a`. §5 |

**Plus one obstacle the brief did not anticipate, which turned out to be the decisive one:**
**heterogeneity** (§4.1). It refutes the majority-rule lift with *zero* correlation, and it is the
reason the union rule's "best" and the majority rule's "best" are not the same word.

---

## 8. Tooling defects — re-verified independently, plus two new

I reimplemented `maj`, `effectiveN`, `corrMaj`, and the shipped `findRhoStar` binary search from
scratch rather than trusting the relay. `src/` was not modified.

**D2 — `findRhoStar` binary-searches a non-monotone predicate. CONFIRMED, and worse than reported.**

```
findRhoStar 8 0.65   = 0.0857        rhoStarAlgebraic 8 = 0.2381    under-report 2.78x
beats 8 0.65 0.20    = true          (ρ = 0.20 is 2.3x the reported ρ*)
```

The true-set of `ρ` is a **comb, not an interval** — TRUE on `[0.000, 0.020] ∪ [0.050, 0.085] ∪
[0.145, 0.235]`. Root cause: `maj(k,c) > c` is not monotone in `k`, because `majority = k/2+1`
makes even juries *harder* than the odd jury below them. At `c = 0.65`:

```
k=  3 maj=0.7183 ✓   k=  4 maj=0.5630 ✗   k=  5 maj=0.7648 ✓   k=  6 maj=0.6471 ✗   k=  7 maj=0.8002 ✓
```

**No binary search can find the supremum of a comb.** Note `verifyBoundary` in the same module
"passes" precisely because it only probes `ρ*` and `ρ*+0.05`, landing inside one tooth — a check
that cannot fail in the way that matters.

**D3 — the N=16 docstring table is unanchored. CONFIRMED.** `CondorcetBoundary.fs:41-44` promises
`c=0.6 → ρ*≈0.33`, `c=0.7 → 0.14`, `c=0.8 → 0.06`. Shipped `findRhoStar 16 c` returns **0.2889 for
all eight tabulated `c`** — the `c`-independent algebraic value. The docstring's numbers come from a
different formula (`ρ* = (c−0.5)/(c(1−c)·N/2)`, §"boundary formula") that **is not implemented
anywhere in the module**.

**D4 (new) — `ρ*` is not a sufficient statistic for the verdict** (§4.3). More serious than D2/D3,
which are bugs *in* the boundary; D4 says the boundary is not the right object. The `c`-independence
that the module reads as physics (*"the information-theoretic event horizon … ρ\* = 1/3"*) is a
consequence of the integer `floor` in `correlatedMajorityProbability` — it is an artifact of a
rounding step, not a causal structure. Flagging under `numerology-vs-number-theory`: `1/3` here is a
count-coincidence of the approximation, and the invariants that would identify it as physics have not
been checked.

**D1 (new) — the register row conflates two theorems** (§1).

---

## 9. Discharge path — what has to be true, and who can make it true

| id | item | kind | owner |
|---|---|---|---|
| **D1** | Split §A row 15 into 15a (union: `ΔU>0 ⟺ ρ<1 ∧ 0<c<1 ∧ n≥2`, identical *or* heterogeneous, aggregation = union) and 15b (majority: identical agents only, `c>½`, boundary **withdrawn** pending D4). Add "aggregation rule" as an explicit column. | register edit | needs a human decision — §A is the frozen core |
| **D2/D3** | Already in flight with the sibling filing against `CondorcetBoundary.fs`. Recommend: **delete `findRhoStar`**, do not fix it. There is nothing for it to return. | defect | sibling |
| **D4** | Replace the `N_eff` boundary with the exact de Finetti criterion `E_θ[maj_m(θ) − θ] > 0`, and expose the *checkable sufficient condition* `P(θ > ½) = 1` (verified: 0 violations in 20 000 random mixing laws supported on `(½,1]`, for `m ∈ {3,5,9}`). | defect + new math | math team |
| **L1** | Land the Dominance Lift Theorem as F# + tests: `deferential` as a property of an aggregation rule, the two-line dominance proof, and the three worked rules. **This is the level-generic law surface** the types sibling is designing toward. | new proof | shadow, on confirmation |
| **L2** | Land the §4.1 heterogeneity refutation as a **negative** regression test — `unweightedMajority` must be *shown* to fail `> best unit`, so nobody re-promotes it. A negative test is the falsifier that keeps L1 honest. | test | shadow |
| **L3** | ~~Land the §4.3 counterexample (`m=9`, `θ ∈ {0.375, 0.999}`, `p=0.201`, `ρ=0.2495`) as a byte-locked golden vector. It is the falsifier for any future `ρ*` claim.~~ **DONE 2026-08-22** — `src/Core.TypeScript/society/golden-vectors-rho-star-not-a-gate.json` + `rho-star-not-a-gate.test.ts`. **With a correction:** at the θ values as tabulated above the `m=9` mixture computes to `ρ = 0.2501`, marginally *outside* `ρ*(9) = 0.25` rather than inside; `θ_hi = 0.998` reproduces the claim at `ρ = 0.2493` with the same −0.126 reversal. `m=15` and `m=51` reproduce as published. Both rows are pinned. | test | shadow |
| **L4** | Estimating log-odds weights from earned attestation, and the loss from mis-estimated weights (§6.1 cost 2). **Open.** Connects to `privacy-budget-is-hard-money-earned-by-others`. | open | unassigned |
| **L5** | Whether a Beta mixing law (Berg/Ladha's Pólya–Eggenberger family) admits a strict reversal, or only the asymptotic failure they report. **Open, named limit.** | open | math team |

**What I need from the types sibling** (relayed, not designed here): the level-generic law surface
should carry **`deferential`** as a property of the *aggregation rule*, not of the level. Concretely,
the shape the theorem wants is an aggregation rule together with the rule-class it is optimal in, and
a witness that every projection `πᵢ` is in that class. `CTM`/`ISociety`/`IWorld` do not need
level-specific laws — one law, quantified over levels, is what §6 proves. I have deliberately not
designed types.

---

## 10. The Zeta-shaped consequence

The Dominance Lift Theorem says an aggregate beats its best part **iff it can defer to that part.**
That is the same object as **exit** in `itron-hub-patent-boundary-p2p-is-the-upgrade` §"the
discriminator is EXIT, not degree": the availability of `πᵢ` in the rule class *is* the availability
of routing around the aggregate to a single node. And it is §11 Multi-Oracle read arithmetically —
an aggregation that **forces** every unit to vote and cannot defer is a *hub* in the strict sense
(deference imposed), and it is **provably worse** than the best oracle it contains.

> A world that must take a vote of its societies is worse than its best society.
> A world that *may* defer to one is not.

**Register discipline on that paragraph:** the *formal* element shared between the theorem and the
exit rule is exactly one thing — `πᵢ ∈ R`, the availability of deference. That much is literal, and
it is why I state it. The rest (hubs, capture, Hirschman) is a **structural analogy with one metered
consequence**, in the sense of `numerology-vs-number-theory` §"too many correlations is a warning."
It is recorded as a resonance and **nothing in §6 depends on it**.

---

## Beacon anchors

**Checked** (entailment verified against the source, not merely cited):

- **Nitzan, S. & Paroush, J. (1982).** *Optimal Decision Rules in Uncertain Dichotomous Choice
  Situations.* International Economic Review 23(2):289–297. — Optimal aggregation of independent
  experts is weighted majority with `wᵢ = log(cᵢ/(1−cᵢ))`; each weight depends only on that expert's
  own competence, not on the others' or on `m`. **This is the load-bearing anchor for §6's Rule C.**
- **Berg, S. (1993).** *Condorcet's jury theorem, dependency among jurors.* Social Choice and Welfare
  10:87–96; and **Ladha (1995)**. — Correlated jurors under hypergeometric / Pólya–Eggenberger urn
  processes: the asymptotic CJT holds for the former and **fails** for the latter, though the group
  remains more reliable than an individual. Anchors §4.3's *direction*; my counterexample is
  strictly stronger and outside their families (limit named in §9 L5).

**Cited, standard, not separately re-derived here:**

- **Condorcet (1785).** *Essai sur l'application de l'analyse à la probabilité des décisions rendues
  à la pluralité des voix.* — the original jury theorem (independent, identical, `c > ½`).
- **de Finetti, B. (1931).** Exchangeability representation — every exchangeable binary sequence is a
  mixture of iid Bernoulli. **This is what makes §4.3's criterion exact rather than a model choice.**
- **Dunnett, C. W. & Sobel, M. (1955).** The correlated-binomial approximation behind `N_eff`.
- **Grofman, B., Owen, G. & Feld, S. (1983).** *Thirteen theorems in search of the truth.* Theory and
  Decision 15:261–278. — heterogeneous-competence Condorcet.
- **Boland, P. J. (1989).** *Majority systems and the Condorcet jury theorem.* The Statistician
  38:181–189.
- **Kaniovski, S. (2010).** *Aggregation of correlated votes and Condorcet's Jury Theorem.* Theory
  and Decision. — the modern correlated treatment.
- **Hirschman, A. O. (1970).** *Exit, Voice, and Loyalty.* — §10, labelled as analogy.

---

## Peels (Mirror → Beacon)

- **"Society > best individual" (row 15)** → *under union aggregation, a union contains its
  arguments (measure monotonicity); under majority aggregation, a majority of identical voters with
  `c > ½` beats one of them (Condorcet 1785). These are different sentences and only the second is a
  theorem.*
- **"ρ\* = 1/3 is the information-theoretic event horizon"** → *`(N−3)/(3(N−1)) → 1/3` is the
  algebraic consequence of requiring `floor(N/(1+(N−1)ρ)) ≥ 3`. The `1/3` and the `c`-independence
  both come from the integer `floor`. No causal or information-theoretic claim has been checked.*
- **"the world is better than the best society"** → *for aggregation rules that can defer to their
  best member, at any depth, by dominance. For unweighted majority, false.*
- **`ISociety <: CTM`, `μX. CTM-over-X`** → *still §B open. §2 shows the interface can be
  level-generic while the parameter family is not closed — the two are independent questions, and
  nothing here discharges the subtyping claim.*

## Pointers

- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A rows 15, 19 — the rows this doc audits
- `src/Core/SocietyUsefulWork.fs` · `src/Bayesian/CondorcetBoundary.fs` — **unmodified**; defects filed, not patched
- `tests/Tests.FSharp/CondorcetBoundary.Tests.fs` (Rule A, 11 properties) · `tests/Bayesian.Tests/CondorcetBoundary.Tests.fs` (Rule B)
- `docs/research/2026-07-04-tick-sources-strange-attractors-eve-ks-entropy-ctm-isociety-connections.md` §4 — `ISociety <: CTM`, §B open
- `docs/research/scripts/2026-08-14-world-lift-{1,2,3,4,5,6}.fsx` — every number above, re-runnable via `dotnet fsi`
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why this doc is `unmetered` until §9 L1–L3 land
- `.claude/rules/numerology-vs-number-theory.md` — the register applied to `ρ* = 1/3`
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` §"the discriminator is EXIT" — §10
