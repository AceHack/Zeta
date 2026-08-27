# Toy boson/fermion generator: Cl(4) and the [8,4,4] adinkra code — the BNN adds nothing, and it degrades exactly at the code's bound

**Date:** 2026-08-27
**Work item:** `081M10HYMGV087G0R003FWYDQX`
**Register:** `toy` throughout (`.claude/rules/toy-is-free-metered-must-be-earned.md`). Nothing here is metered against physics. "Boson"/"fermion" names a **Z₂ grading**, which is what Clifford algebras and adinkras actually carry. No claim is made that these sixteen objects are particles.
**Code:** `src/Bayesian/ToyBosonFermionGenerator.fs`, `src/Bayesian/ToyBosonFermionBnn.fs`, `tests/Tests.FSharp/ToyBosonFermionParity.Tests.fs` (24 falsifiers), `src/Bayesian/toy-boson-fermion-golden-vectors.json`.

---

## The question

Aaron 2026-08-26: *"can we route our 8boson vs 8fermion under our adinkra+clifford+e8 stack to use as a training set to our BNN for classifying arbitrary bosons and fermions?"* — refined the same day to *"maybe **generate** the dataset is a better wording — cause we don't need to store the data, just the generator plus our chaos fluctuations"*, and *"RNG is theory, metered channels is physics."*

## The verdict, up front

**The BNN adds nothing here, and the reason is structural rather than a tuning failure.** It matches the closed-form ceiling to within 0.006 accuracy at every damage level and never exceeds it. That is the honest headline.

Two things in the study *are* worth having, and neither is the classifier:

1. **The posterior degrades exactly at the code's unique-decoding radius** — perfect and confident at realized damage ≤ 1, collapsing at 2 — which is the question that motivated allowing a BNN into the room at all. The answer is **at the bound**, not ahead of it and not behind it.
2. **At damage 3 the posterior is confidently *wrong*** (accuracy 0.4255, mean confidence 0.9976, ECE 0.5721) — **and so is the exact closed-form Bayes posterior, identically.** Calibration does not rescue you past the decoding radius. This is the finding a bare accuracy number would have hidden, and it is why calibration was required to be reported.

---

## 1. Which "8+8" — and both of them

Aaron: *"Cl(4)'s 16 blades (8 even + 8 odd) — the first one is what I remember. But what I've noticed is there is often many paths to the same destination, so the 2nd might be valuable too."*

**Path 1 (primary) — Cl(4).** 2⁴ = 16 basis blades indexed by a 4-bit mask, exactly as `Zeta.Core.Cl3` indexes its 8 blades by a 3-bit mask. Grade = `popcount(mask)`, so the grading is `popcount & 1`: even `{0,3,5,6,9,10,12,15}`, odd `{1,2,4,7,8,11,13,14}`.

**Path 2 (independent) — the N=8 adinkra.** The 16 cosets of `Zeta.Core.AdinkraCode`'s [8,4,4] extended Hamming code in GF(2)⁸, bipartitioned by coset weight parity.

### The count 16 identifies nothing — the invariant does

`numerology-vs-number-theory` applies immediately, and the repo had already stepped on this rock: `AdinkraCode.fs` notes that the 4-cube adinkra *also* has 16 nodes and that **valence**, not node count, discriminates. Beyond the two paths here, 16 is also the dimension of `SO(10)`'s spinor representation and the count of Weyl fermions in one Standard Model generation. **An algebra basis, a graph's vertex set and a group representation can share a cardinality and have nothing else in common.**

What identifies the Cl(4) grading is that **the even part is closed under the product and the odd part is not**. Blades multiply by mask XOR and `popcount(a ⊕ b) ≡ popcount a + popcount b (mod 2)`, so the even blades form an 8-dimensional subalgebra (`Cl⁺(4) ≅ Cl(3)`) while odd·odd lands in the even part. A random 8/8 split of sixteen things does not do that. Measured: `(evenClosed, oddClosed, evenDim) = (true, false, 8)` — test **TBF-02**.

### The two paths agree, and it is a derivation, not a count match

Exhaustively over all 256 words of GF(2)⁸: **256/256 agreement** (TBF-07). The derivation:

- `11111111 ∈ C` (the weight-8 codeword) and `C = C⊥`, so `⟨1, c⟩ = 0` for every codeword. Weight parity is therefore constant on cosets and is a linear functional of the syndrome.
- The four rows of `H = [Aᵀ | I₄]` each have weight 4, and they sum to `1` (the first block sums coordinatewise to 3 ≡ 1, the second to 1). So that functional is `popcount(syndrome)`.
- Hence **coset parity = `popcount(syndrome) & 1` = the Cl(4) grade parity of the blade with that mask.**

Under `anti-babel-preserve-reconcilability` a disagreement would have been recorded with both paths intact rather than reconciled by picking a winner. There was none to record. The agreement is worth more than either path alone: **the label is a property of the structure, not an artifact of one encoding.**

Code invariants, all computed rather than cited (TBF-04, TBF-05): weight enumerator `[(0,1); (4,14); (8,1)]`, minimum distance **4**, all codewords doubly-even, all-ones is a codeword.

---

## 2. Generate, never store

Nothing checked in is a dataset. `ToyBosonFermionGenerator.generate seed flips count` emits `(structure, label)` pairs on demand; the checked-in artifacts are the generator, and hex-in-JSON golden vectors over nine `(seed, flips)` pairs (`no-binary-in-proof-lineage` — verification artifacts are text). Four hex characters per sample: blade nibble, observed byte, label nibble.

Both halves of replay are asserted (**TBF-15**): same seed twice ⇒ byte-identical, **and** a different seed ⇒ different output. The second half matters — a generator that ignored its seed would pass the first check trivially.

This also dissolves an objection raised against the original framing: with a generator the sample count is a parameter, so *"we only have sixteen rows"* becomes *"how much data does the posterior need"* (§6).

---

## 3. The metered channel, and the gap it exposes

Entropy enters only through `ToyBosonFermionGenerator.Source` (discipline #13, noninterference) and the amount is **measured at the membrane** and carried in the datum. The channel applies `k` uniform bit-flip **operations** to the transmitted codeword; each costs exactly `log₂ 8 = 3` bits — 8 is a power of two, so the accounting is exact with no rejection-sampling waste to explain away. Per sample: `4 + 3k` bits (TBF-13).

**The finding the metering buys** (TBF-14), measured over 20 000 samples per row:

| k | metered bits/sample | mean realized damage | fraction with **zero** damage |
|---|---|---|---|
| 0 | 4 | 0.0000 | 1.0000 |
| 1 | 7 | 1.0000 | 0.0000 |
| 2 | 10 | 1.7515 | **0.1242** |
| 3 | 13 | 2.3104 | 0.0000 |
| 4 | 16 | 2.7361 | 0.0427 |

Two flip operations landing on the same bit cancel. **At k = 2, one sample in eight is completely undamaged** — so a study indexed by *requested* flips silently mixes uncorrupted samples into its corrupted bucket. (At k = 3 the fraction is exactly zero, because an odd number of operations cannot produce an even-weight error; the parity argument is a control on the measurement.)

This is why the degradation curve below is stratified by **measured** damage. The code's unique-decoding radius is a Hamming weight, so it is a vertical line on that axis and on no other. With an unmetered RNG and a `k` index the two quantities are not in the same units and the comparison is decoration.

---

## 4. The read-out spectrum — and a count I nearly believed

For every one of the 256 linear functionals `χ_u(y) = ⟨u, y⟩ mod 2`, does it equal the grading on all 16 clean codewords? Measured spectrum by Hamming weight (TBF-09, TBF-10):

| witness weight | count |
|---|---|
| 2 | 4 |
| 4 | 8 |
| 6 | 4 |

**16 witnesses, forming exactly a coset of C** (verified: XOR by any one of them reproduces the codeword set). The four minimum-weight witnesses are `0x11, 0x22, 0x44, 0x88` — **each systematic bit XORed with its A-block partner**, i.e. bit *i* ⊕ bit *i*+4.

**Minimum witness weight is 2, not 4.** I had reasoned my way to 4 from the code's minimum distance and it was wrong. The exhaustive search decided it, which is the whole point of `numerology-vs-number-theory`: a matching integer is a coincidence to record, never an identification. What is recorded instead is the *structure* — the witness set is a coset of C, so its size is |C| = 16 and its weight distribution is the coset's.

Two consequences:

- **No single received bit carries the grading** (no weight-1 witness). A degree-1 (linear) read-out provably cannot do it — the Minsky–Papert parity obstruction, here located exactly at degree 2. This is what makes the classifier's degree-≤2 feature map an *earned* choice rather than a convenient one.
- **The label's irrecoverability bound is the code's minimum distance, structurally** (TBF-11). An error destroys the grading beyond any recovery exactly when it flips *every* witness at once; the set of such errors is precisely the odd-overlap half of C, it has 8 members, and its minimum weight is **4 = d**. That is an identification, not a count match — the offending set is *named*, not merely counted.

**A checked symmetry** (TBF-12): `1 ∈ C` and `popcount 1 = 8` is even, so complementing a received word maps codewords to codewords **and preserves the grading**. Damage `d` and damage `8 − d` are therefore the same problem, which predicts the degradation curve is symmetric about damage 4 rather than monotone. It is — see §5, rows 2/6 and 3/5.

---

## 5. The study

**Baselines** (all closed form):

- **B0 naive** — parity of the four systematic bits. Exact on clean codewords, carries no uncertainty at all.
- **B1 ECC** — syndrome-decode with the [8,4,4] code, then read the recovered message's parity. `t = ⌊(d−1)/2⌋ = 1`.
- **B2 exact Bayes** — the posterior over the 16 codewords under a binary symmetric channel, closed form in 16 terms. **This is the ceiling, not a competitor to be beaten.**

**The model** — Bayesian probit regression with a diagonal Gaussian posterior over 37 weights (bias, 8 signed bits, 28 pairwise products), updated by one assumed-density-filtering pass through **this repo's own EP substrate**: `Ep.probitProject` does the moment matching and the weight update is read back out of the projected moments rather than re-derived.

> **`MinimalBnn` and `MultilayerBnn` cannot express this**, and that is a finding rather than an oversight. Both are chains of scalar Gaussian latents with a Gaussian likelihood at layer 0 — no weights, no feature map, no Bernoulli output. `MinimalBnn`'s own header says *"not gradient-trained weights"*. The smallest thing on the existing substrate that **is** a Bayesian classifier adds a weight vector and reuses `Ep.probitProject` unchanged; that is what was built.

### By requested flip count — `study 2026 k 4000 4000`

| k | bits | mean damage | undamaged | naive | ECC | Bayes (ECE) | **BNN** (ECE, Brier) | **null** (ECE) |
|---|---|---|---|---|---|---|---|---|
| 0 | 4 | 0.000 | 1.000 | 1.0000 | 1.0000 | 1.0000 (0.0000) | **1.0000** (0.0001, 0.0000) | 0.3620 (0.2729) |
| 1 | 7 | 1.000 | 0.000 | 0.4878 | 1.0000 | 1.0000 (0.0727) | **1.0000** (0.0002, 0.0000) | 0.4910 (0.1068) |
| 2 | 10 | 1.746 | 0.127 | 0.4928 | 0.6258 | 0.6332 (0.0270) | **0.6252** (0.0387, 0.1872) | 0.4575 (0.0842) |
| 3 | 13 | 2.299 | 0.000 | 0.5002 | 0.6272 | 0.6272 (0.0453) | **0.6165** (0.0424, 0.2378) | 0.5202 (0.0272) |
| 4 | 16 | 2.747 | 0.042 | 0.5032 | 0.5335 | 0.5312 (0.0160) | **0.5347** (0.0284, 0.2478) | 0.5080 (0.0418) |

**Delta against the closed-form baseline is 0.0000 on clean data** (TBF-19), which is the point: the label is `popcount & 1`, a total one-line function, and reproducing it demonstrates nothing. At k = 4 the BNN's 0.5347 sits 0.0035 above Bayes' 0.5312 — under 0.5 σ at n = 4000 (σ ≈ 0.0079). **Not a win. Noise.**

### The headline — stratified by *measured* damage

`studyByDamage 555 2 20000 [0..6] 60000` (trained at k = 2; the Bayes column assumes the same channel, so both are misspecified together off-distribution — a fair head-to-head, stated rather than hidden):

| realized damage | n | naive | ECC | Bayes | **BNN** | **BNN ECE** | **BNN mean confidence** |
|---|---|---|---|---|---|---|---|
| 0 | 71 461 | 1.0000 | 1.0000 | 1.0000 | **1.0000** | 0.0000 | 1.0000 |
| **1** | 91 525 | 0.4989 | 1.0000 | 1.0000 | **1.0000** | 0.0024 | 0.9976 |
| **2** | 108 757 | 0.4277 | 0.5694 | 0.5716 | **0.5708** | 0.0157 | 0.5865 |
| 3 | 76 260 | 0.5047 | 0.4255 | 0.4255 | **0.4255** | 0.5721 | 0.9976 |
| 4 | 55 092 | 0.5369 | 0.4221 | 0.4254 | **0.4253** | 0.2449 | 0.6702 |
| 5 | 12 215 | 0.4912 | 0.4354 | 0.4354 | **0.4354** | 0.5622 | 0.9976 |
| 6 | 4 690 | 0.4318 | 0.5791 | 0.5836 | **0.5740** | 0.0154 | 0.5894 |

**Does the posterior degrade at the bound the code predicts, ahead of it, or behind it? — At the bound.** The code's unique-decoding radius is `t = 1`. At damage 0 and 1 the BNN is perfect *and* confident (0.9976) *and* calibrated (ECE 0.0024). One step outside, at damage 2, accuracy collapses to 0.5708 **and the posterior widens to say so** — mean confidence 0.5865, ECE 0.0157. It neither collapses early nor over-claims late. (TBF-22.)

The complement symmetry predicted in §4 is visible: rows 2 and 6 agree (0.5708 / 0.5740), rows 3 and 5 agree (0.4255 / 0.4354), row 4 is self-paired.

### The negative result, which is the more useful half

**At damage 3: accuracy 0.4255 — below chance — with mean confidence 0.9976 and ECE 0.5721.** Confidently wrong. And **the exact closed-form Bayes posterior does exactly the same thing** (0.4255, identical to three decimals).

This is a property of the structure, not a defect of the model. Past the decoding radius the nearest codeword is systematically the *wrong-parity* one — with `d = 4`, a weight-3 error lands you at distance 1 from a wrong codeword — so an optimal decoder confidently decodes to it. **A calibrated posterior does not rescue you here.** Pinned by TBF-23 so it cannot quietly disappear.

This is the same shape as the repo's standing vacuity concern, in probabilistic clothing: a confidence that cannot be wrong *inside* the model, attached to an answer that is wrong *outside* it.

---

## 6. Controls

**Closed-form baseline** (mandatory, reported whatever it says): 1.0000 on clean data. Every model number above is a delta against it, and on clean data that delta is exactly zero.

**Label-shuffle null** (mandatory): the identical pipeline trained on labels permuted through the same metered source. Across eight seeds at k = 0: `0.4948, 0.6292, 0.6737, 0.5477, 0.4285, 0.3792, 0.6240, 0.6342` — mean **0.5264**. At k = 2: `0.4718, 0.5205, 0.4895, 0.5028, 0.5383, 0.4765, 0.4622, 0.4580` — mean **0.4900**. **No leak.**

Note the k = 0 spread, because it looked alarming at first and is not: the null's **effective sample size is the number of distinct structures (16), not the number of rows (4000)**, so a single seed straddles chance by roughly ±0.125. Reading one seed's 0.3620 as a signal would have been reading a sampling fluctuation. TBF-20 therefore averages across seeds, and additionally requires the true-label fit to beat the null by > 0.3 — without that second clause the null passing would be consistent with the pipeline learning nothing at all.

**Mutation check.** Making `absorb` a no-op (the model never learns) fails TBF-19, TBF-20, TBF-21, TBF-22, TBF-23. Making the entropy meter stop counting and the corruption channel a no-op fails TBF-13, TBF-14, TBF-GOLDEN, TBF-20, TBF-22, TBF-23. The falsifiers are not vacuous.

## 7. How much data does the posterior need?

The axis the generator buys that a stored 16-row dataset cannot. `sampleSizeCurve 99 k [...] 4000`:

| n | k = 0 accuracy (ECE) | k = 1 accuracy (ECE) |
|---|---|---|
| 8 | 0.7505 (0.1027) | 0.6877 (0.1106) |
| 16 | 1.0000 (0.2266) | 0.7768 (0.1183) |
| 32 | 1.0000 (0.0927) | 0.9145 (0.1778) |
| 64 | 1.0000 (0.0288) | 1.0000 (0.1445) |
| 128 | 1.0000 (0.0110) | 1.0000 (0.0677) |
| 256 | 1.0000 (0.0040) | 1.0000 (0.0179) |
| 512 | — | 1.0000 (0.0050) |
| 4096 | — | 1.0000 (0.0002) |

**Accuracy saturates roughly an order of magnitude before calibration does.** At k = 1, n = 64 already gives perfect accuracy while ECE is still 0.1445; ECE needs n ≈ 512 to reach 0.005. If you report accuracy you stop at 64 and ship a badly calibrated posterior. This is the clearest argument in the study for reporting calibration, and it is the only quantity here the closed form cannot produce — because a closed form has no data requirement to measure.

---

## 8. Verdict

**Is this worth pursuing? For classification, no. For the bound measurement, yes — and it is already done.**

- The BNN never beats the closed-form ceiling and matches it to within 0.006 everywhere. Its one genuine achievement — recovering the optimal decision rule from data without being told the code or the noise level — is real but buys nothing, because the code *is* known and the noise level is estimable in closed form.
- Register stays **`toy`**. It has not earned demotion of the prefix: the promotion criterion was *beating the closed form at something the closed form cannot do at all*, and it did not.
- What is worth keeping is the **apparatus**: a seeded generator with a metered channel, three closed-form brackets, two mandatory controls, and a degradation curve on an axis the code's bound shares. Any future structure in this stack can be dropped into it.
- The **honest scaling limit**: the exact Bayes ceiling is computable here only because there are 16 codewords. A claim that a learned posterior would win at a scale where exact inference is intractable is *plausible and untested* — n = 8 cannot test it, and this study makes no such claim.

### Open, and deliberately not answered here

- Whether the degrade-at-the-bound result survives structures where the label is *not* a coset invariant. Here the grading is protected by the code's own algebra, which is a favourable case.
- Whether "edges deleted / dashings perturbed" corruptions — the graph-side chaos fluctuations — reproduce the bit-flip result. Only the bit-flip channel is built.
- The physics reading of 16 is **routed elsewhere and deliberately not touched**, so the two threads do not contaminate each other through a shared integer.

---

## Anchors (Beacon)

- **W. K. Clifford** (1878), and **P. Lounesto**, *Clifford Algebras and Spinors* (2001) §3 — the Z₂ grading and the even subalgebra `Cl⁺(n) ≅ Cl(n−1)`. Used for the discriminating invariant in §1, not as decoration.
- **C. Doran, M. Faux, S. J. Gates Jr., T. Hübsch, K. Iga, G. Landweber**, *Relating doubly-even error-correcting codes, graphs, and irreducible representations of N-extended supersymmetry* (J. Phys. A 2008; arXiv:0806.0051) — the adinkra chromotopology as a hypercube quotient by a doubly-even code. **Gleason** / **Mallows–Sloane** for the length ≡ 0 (mod 8) existence theorem, which is why the code here has length 8 and not 4; the repo's `AdinkraCode.fs` already stands on it and `AdinkraIdentity.Tests` searches lengths 2/4/6 exhaustively and finds nothing.
- **F. J. MacWilliams & N. J. A. Sloane**, *The Theory of Error-Correcting Codes* (1977) — extended Hamming [8,4,4], syndrome decoding, coset leaders. The weight enumerator and minimum distance used here are **computed by the module and asserted**, not taken from the book.
- **Killing–Cartan** — cited only for the discipline it enforces: structures are identified by their invariants, never by a root or element count. It is the reason §1 and §4 are written the way they are.
- **T. Minka**, *Expectation Propagation for Approximate Bayesian Inference* (UAI 2001), and **R. Herbrich, T. Graepel, C. Campbell**, *Bayes Point Machines* (JMLR 2001) — the classifier. The diagonal-Gaussian ADF form is **T. Graepel, J. Quiñonero Candela, T. Borchert, R. Herbrich**, *Web-scale Bayesian click-through rate prediction* (ICML 2010) — the same family as the repo's existing TrueSkill lineage in `TravelerRankLedger`. The probit moment-match itself is **Rasmussen & Williams**, *GPML* §3.6 eq. 3.58, which is what `src/Bayesian/Ep.fs` already implements and cites; this module reuses it rather than re-deriving it.
- **M. Minsky & S. Papert**, *Perceptrons* (1969) — the parity obstruction. §4 locates it exactly: degree 1 cannot, degree 2 can, and the four minimum witnesses are named.
- **M. P. Naeini, G. Cooper, M. Hauskrecht** (AAAI 2015) and **C. Guo, G. Pleiss, Y. Sun, K. Weinberger**, *On Calibration of Modern Neural Networks* (ICML 2017) — expected calibration error and reliability diagrams.
- **G. Marsaglia** / **S. Vigna** — SplitMix64, the seed expander behind the metered source. Chosen because it is a fixed, cheap, byte-lockable mixing function, not for any statistical claim about it.

## Rules exercised

`toy-is-free-metered-must-be-earned` (register, and the refused promotion) · `numerology-vs-number-theory` (§1, §4 — including a count I got wrong and the code corrected) · `anti-babel-preserve-reconcilability` (two paths, agreement recorded with both intact) · `only-the-irreducible-is-primitive-generate-the-rest` (generate, never store; the generator and the ECC are the same object) · `dv2-data-split-discipline-activated` #4 DST and #13 noninterference (metered channel) · `no-binary-in-proof-lineage` (hex-in-JSON golden vectors) · `anchor-to-human-prior-art` (anchors checked against what the code does, not what sounds impressive).
