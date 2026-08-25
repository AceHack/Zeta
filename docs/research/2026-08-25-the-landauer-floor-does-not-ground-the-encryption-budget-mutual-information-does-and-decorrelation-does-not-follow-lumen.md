# The Landauer floor does not ground the encryption budget — mutual information does, and the decorrelation step does not follow

*Lumen (Convergence oracle), 2026-08-25. Work-item `081M0X1QSZR087G0R003A7V3VC`.
Advisory: this doc produces mappings, dimensional checks, and falsifiable conjectures.
It binds nothing. Proof-side pair: Soraya. Tier: everything below is **CONJECTURE / audit**
unless explicitly marked otherwise; nothing here graduates to FROZEN-CORE.*

## The claim under test

Aaron, 2026-08-25, naming a primary Zeta objective:

> "this is one of Zeta's primary objectives so we can achieve true AI society
> decorrelation via **encryption budget and erasure costs in thermodynamics**"

This document applies two standing guards to that sentence:
`docs/research/2026-06-15-the-anchor-taxonomy-beacon-discipline-checked-anchors-math-grounds-validity-physics-grounds-metering.md`
(anchors must be **checked**, not cited; the **metering-test** catches physics-as-metaphor) and
`.claude/rules/toy-is-free-metered-must-be-earned.md` (a model claiming to measure reality is
load-bearing and must be earned).

## Verdict, up front

| # | Question | Verdict |
|---|---|---|
| 1 | Does thermodynamic erasure cost ground the hard-money property? | **No.** Off by ~10 orders of magnitude, and — more decisively — **pointing the wrong way**. |
| 2 | What is load-bearing instead? | **Logical irreversibility** (a logic claim) and **crypto-shredding leverage** (a computational-hardness claim). Neither is thermodynamics. |
| 3 | Is "encryption budget" a budget? | **Units yes (bits), conservation law no.** It is a *ratchet*, and a ratchet is not a conservation law. |
| 4 | Does any of it produce decorrelation? | **Not as specified.** Three independent gaps, one of which makes the current design's incentive gradient run *toward* correlation. |

> **SUPERSEDED IN PART — read §11 first.** After this table was written, Aaron supplied the
> mechanism: *"our zsets is all about when deciding to allow gsets to spend heat"*, and then the
> sharpening: *"in earlier designs a −1 could REMOVE A KEY rather than just weaken it. Removing a
> key is not reversible."* That relocates the claim from *magnitude* to **uniqueness of the
> irreversible operation**, which is a different and much stronger claim. §11 checks it **in the
> code**. Short version: **the mechanism is real, correct, and already implemented in all four
> oracles — and the meter for it is not built.** Row 1 below stands as a fact about *joules* and is
> **aimed at a claim Aaron was not making**; rows 2–4 stand unchanged.

**Of Aaron's two phrases, one survives and one does not.** "Encryption budget" survives — as an
**information-theoretic** quantity in bits, which is exactly what the repo already built.
"Erasure costs **in thermodynamics**" does not survive as a *grounding*; it survives only as the
**accounting** half the repo has already correctly fenced off, and the word "thermodynamics" in
Aaron's sentence is doing rhetorical work that the physics does not support.

This is a negative result on the physics and a **constructive** result on the mechanism: §6 gives
the quantity that does the work (mutual information), the exact bit-figure the ρ band implies, and
the reason the current budget design cannot deliver it.

---

## 0. Prior art (start gate) — most of the good work is already done

The backlog start gate turned up substantial existing machinery, and it is *better* than the claim
being audited. Recording it because the honest finding is "the repo already knows this, and Aaron's
sentence is a regression against its own standard":

- `src/Core.TypeScript/algebra/key-erasure-meter.ts` — already separates `LedgerBits` (accounting)
  from `MeasuredDissipation` (instrument), makes `LandauerFloorJoules` a *third* type, and states in
  its header that **there is no function anywhere that turns bits into a measurement**. Its
  `DissipationTest` has `refuted` / `not-refuted` / `indeterminate` and **deliberately no
  `confirmed`** — one-way, convicts-never-acquits.
- `docs/research/2026-08-16-fpga-toffoli-zset-join-synthesis-design-*.md` §8 — already computes the
  gap and already says "**CMOS cannot measure Landauer**".
- `docs/research/2026-05-30-encryption-budget-as-permanent-ratchet-*.md` — already defines the
  encryption budget as a **bit count**, permanent and monotone.
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — Z-1 (Lumen's own −1/12 conjecture) is **CLOSED as
  falsified**, and six 2026-08-01 discharges were demoted because **none of them could fail**.

That last row is the relevant precedent for tone. This register has already been burned by
physics-flavoured claims that were structurally unable to lose. The correct posture toward a new
one is adversarial, and the correct output is allowed to be "no".

---

## 1. The energy check — compute it, don't hand-wave

### 1.1 The Landauer floor

`k = 1.380649 × 10⁻²³ J/K` is **exact by definition** (2019 SI redefinition of the kelvin) — this is
CHECKED: it is a defining constant, not a measured one. The floor is `k·T·ln 2` per bit erased.

| T (K) | context | `kT ln 2` per bit |
|---|---|---|
| 77 | liquid nitrogen | 7.369 × 10⁻²² J |
| 273.15 | 0 °C | 2.614 × 10⁻²¹ J |
| 293.15 | 20 °C "room temperature" | 2.805 × 10⁻²¹ J |
| **300** | the conventional figure | **2.871 × 10⁻²¹ J = 2.871 zJ** |
| 310 | human body | 2.967 × 10⁻²¹ J |
| 350 | a warm die | 3.350 × 10⁻²¹ J |

**A correction to the brief that commissioned this doc.** It stated the bound as "≈ 2.75 zJ at
300 K". That is wrong at 300 K; 2.75 zJ is the floor at **T = 287.4 K** (about 14 °C). At 300 K the
value is **2.871 zJ**, which is what `key-erasure-meter.ts` already carries. The error is 4.4% and
changes no conclusion — but in a document whose entire subject is metering discipline, quoting the
constant at an unstated temperature is the failure mode in miniature, so it is corrected rather than
inherited.

### 1.2 Real erasure energies

Anchored to Horowitz, *Computing's Energy Problem (and what we can do about it)*, ISSCC 2014 — the
standard 45 nm energy table. Marked `unmetered`: these are the published figures for a specific
process node, not measurements taken here.

| operation | energy | per bit | ratio to floor @300 K |
|---|---|---|---|
| 32-bit integer add | 0.1 pJ | 3.13 × 10⁻¹⁵ J | 1.1 × 10⁶ (10^6.0) |
| 8 KB SRAM read, 32 b | 5 pJ | 1.56 × 10⁻¹³ J | 5.4 × 10⁷ (10^7.7) |
| **DRAM read, 32 b** | **640 pJ** | **2.00 × 10⁻¹¹ J** | **7.0 × 10⁹ (10^9.8)** |
| single FPGA node transition, 40 nm (repo's own figure) | — | ≈ 10⁻¹⁴ J | 3.5 × 10⁶ (10^6.5) |
| NAND block erase, 4 MiB @ 1.5 ms, 20 mA, 3.3 V | 99 µJ | 2.95 × 10⁻¹² J | 1.0 × 10⁹ (10^9.0) |

**The brief's "nine orders of magnitude" is CONFIRMED, and is if anything an understatement** for
DRAM: the ratio is 10^9.8. **It is also reconciled with the repo's existing "six to seven orders"
figure** — that figure compares against a *single CMOS node transition* (10⁻¹⁴ J), while the brief
compares against a *whole DRAM access* (2 × 10⁻¹¹ J). Both are correct; they are different
comparands, three orders apart. Neither number should be quoted without saying which.

### 1.3 The decisive scale check

Take the floor seriously and ask what it actually costs to erase things:

| erase, at the Landauer floor, 300 K | energy |
|---|---|
| a 256-bit key | 7.35 × 10⁻¹⁹ J |
| 1 TB | 2.30 × 10⁻⁸ J |
| 1 PB | 2.30 × 10⁻⁵ J |
| **1 ZB (order of all data humanity holds)** | **23 J** |

A single AA battery holds on the order of 10⁴ J. **The thermodynamic floor for erasing every byte
of data in the world is a few percent of an AA battery.** No economic property can rest on that.
Any argument of the form "erasure is thermodynamically expensive, therefore X is hard money" is
dead on these numbers alone, and it dies by ~10 orders of magnitude rather than by a close call.

### 1.4 The deeper problem: the bound points the wrong way

The magnitudes are the smaller objection. The structural one:

> **Landauer gives a LOWER bound on the cost of an operation we WANT to happen. A hard-money or
> security property needs a LOWER bound on the cost of the operation we want to PREVENT.**

The property Aaron wants is *"privacy budget cannot be taken away"*. Taking it away means **forcing
a reveal** — recovering information the owner erased or encrypted. Landauer says nothing whatever
about the cost of *recovery*. It bounds `erase` from below; the adversary's operation is
`un-erase`, and that operation's difficulty comes from information-theoretic unavailability (the
bits are not there) or computational hardness (the key is not there) — **never from a heat budget**.

Even if the floor were nine orders *larger* instead of nine orders smaller, it would still be
bounding the defender's cost rather than the attacker's. **The dimensional analysis is fine and the
direction is wrong**, which is the harder error to see and the one the metering-test is for.

**Verdict on Q1: energy cost is NOT load-bearing.** Not by magnitude, and not by direction.

---

## 2. The entailment check on the anchors

Per the anchor-taxonomy discipline: model **C′** (what the source actually claims) against **C**
(what we want it to claim) and ask whether `C′ ⊢ C`.

| Anchor | C′ — what it actually establishes | C — what the claim needs | `C′ ⊢ C`? |
|---|---|---|---|
| **Landauer 1961**, *IBM J. Res. Dev.* 5(3):183–191 | *Logical* irreversibility ⟹ ≥ `kT ln 2` dissipated per bit lost | Thermodynamic cost ⟹ security / economic hardness | **NO.** Runs the implication backwards (affirming the consequent) *and* swaps the quantity. |
| **Bennett 1973**, *IBM J. Res. Dev.* 17:525–532 | Any computation can be made logically reversible ⟹ computation *per se* carries no floor | Erasure is the uniquely costly operation | **PARTIALLY — and it cuts against the claim.** Bennett establishes that erasure is the *only* op with a floor, which makes it special; it does not make the floor *large*. |
| **Bennett 1982**, *Int. J. Theor. Phys.* 21:905–940 | Maxwell's demon is exorcised by the cost of **resetting the demon's memory**, not by the cost of measurement | Erasure grounds a privacy economy | **NO.** Supports "erasure is where the accounting lands" — the repo's `2026-08-18-an-unmetered-channel-is-a-maxwells-demon-*` doc uses this correctly. Does not support an economic claim. |
| **Szilard 1929** | One bit of information about a single-molecule gas can be converted to `kT ln 2` of work | Information has thermodynamic value | **YES, but at `kT ln 2` scale** — i.e. it establishes the *conversion*, and the conversion rate is exactly the number that §1.3 shows is negligible. |
| **Bérut et al. 2012**, *Nature* 483:187–189 | A colloidal particle in a double-well optical trap dissipates ≥ `kT ln 2` on erasure; the bound is **experimentally verified** | The bound is real | **YES** — and it is the anchor that makes the bound *fact* rather than theory. It also confirms the bound is *approached only in a laboratory single-particle system*, which is the opposite of a component-scale mechanism. **Not page-checked here** (standing knowledge; the repo flags the same limitation at `key-erasure-meter.ts:51-54`). |
| **Sagawa–Ueda 2008/2009** (PRL 100:080403 and follow-on) | Generalized second law with feedback: extractable work is bounded by `kT · I`, where `I` is the **mutual information** acquired | Something that grounds decorrelation | **This is the interesting one — see §6.** It introduces *mutual information* as the operative variable, and mutual information is genuinely the right quantity. But it enters multiplied by `kT`, and §6 shows the `kT` is exactly the decorative factor. |
| **NIST SP 800-88 Rev. 1**, *Guidelines for Media Sanitization* | Defines **Clear / Purge / Destroy**; **"Cryptographic Erase" (CE)** is a recognised *Purge* technique — sanitize media by destroying the key rather than the data | Crypto-shredding is legitimate deletion | **YES**, with a stated limit the standard itself carries: CE is only valid when the encryption was applied to all target data, the key was never exposed, and the cipher is sound. It is a **key-management** guarantee, explicitly **not** a physical one. |

**The single sharpest finding of this section.** Landauer's arrow is
`logical irreversibility ⟹ physical entropy export`. Aaron's framing needs
`physical cost ⟹ logical/economic hardness`. The physics is the **consequence** of the logic, not
its ground. **Using the thermodynamics to justify the informational property is precisely backwards
— the informational property is the premise, and the heat is the receipt.**

---

## 3. What IS load-bearing (Q2)

Three candidates were offered. Verdict on each:

### 3.1 Irreversibility — YES, but it is a logic claim, not a physics claim

The real content is: **an erased bit is not recoverable from the accessible state.** That is a
statement about the state space (a many-to-one map has no inverse), and it holds identically in a
purely mathematical model with no temperature in it. It is **sound** — an implication that can
convict — and soundness is indeed what "cannot be taken away" needs.

But notice that the thermodynamics contributes *nothing* to the soundness. Delete `k` and `T` from
the argument and the irreversibility survives untouched. **A term you can delete without weakening
the conclusion is decoration.** That is the metering-test verdict, applied honestly.

### 3.2 Crypto-shredding leverage — YES, and it is the strongest of the three

Here the *ratio* is the interesting quantity, exactly as the brief suspected:

| protected corpus | bits denied per bit erased (256-bit key) |
|---|---|
| 1 TB | 3.1 × 10¹⁰ |
| 1 PB | 3.1 × 10¹³ |

This is a real, large, **dimensionless** number, and being dimensionless is the point — it is not an
energy at all. It is the ratio the physics-framing was reaching for and missing. Its anchor is
**NIST SP 800-88 Cryptographic Erase**, and its guarantee is **computational hardness plus key
hygiene**, not thermodynamics.

Honest limit, and it is a real one: crypto-shredding's guarantee is **conditional on a cipher and
therefore falsifiable by cryptanalysis** (and, on a long horizon, by cryptographically-relevant
quantum computers against the key-encapsulation layer, though AES-256 itself degrades only to
Grover's quadratic speedup). **Irreversible erasure has no such expiry.** So §3.1 and §3.2 differ
in kind: §3.1 is unconditional and small-leverage, §3.2 is conditional and enormous-leverage. A
serious design uses both and says which it is relying on where.

### 3.3 Provable deletion — NO, not available in this substrate

The repo already establishes this and I have nothing to add: `key-erasure-meter.ts` carries
`attested` and `fused` evidence members that are **explicitly unpopulated** and read as
`no-information` rather than as stubs returning success. There is no vendor trust root here. Any
claim of *proved* deletion today would be fabricated.

---

## 4. Is "encryption budget" actually a budget? (Q3)

The brief's test is the right one: **a budget needs units and a conservation law.**

**Units: YES.** The repo already fixes them —
`docs/research/2026-05-30-encryption-budget-as-permanent-ratchet-*.md` defines the budget as
*the count of bits an agent may keep hidden*. Dimension: **bits**. That is a clean information-
theoretic quantity, and it is the half of Aaron's sentence that survives.

**Conservation law: NO.** The design is explicitly a **monotone ratchet**: "it only goes up", never
confiscated, decreasing only by voluntary reveal. Monotonicity is not conservation. In the language
this repo already uses for the sibling rule
(`privacy-budget-is-hard-money-earned-by-others.md`), there are three operations — **spend**,
**stake**, **confiscate** — and only the third is forbidden. A quantity that can be minted by
social attestation and burned by voluntary reveal has **no conserved total**, so no accounting
identity closes over the society.

This matters concretely: **without a conservation law there is no scarcity, and without scarcity
the "hard money" analogy has no mechanism.** The permanence property ("cannot be taken away") is
real and is doing all the work; the *money* framing borrows a scarcity that the design does not
implement. Hard money's hardness comes from a supply schedule, not from irrevocability alone.

**What it would take to make it a budget in the strict sense** — three options, in increasing
order of cost:

1. **A society-wide supply schedule.** Total mintable budget bounded by a stated function of
   time/society size, so `Σ budget` is a known quantity. Gives scarcity; costs the free social
   minting that makes the budget *earned*.
2. **A conserved pair.** Make `disclosed + hidden = H(agent state)` an identity, so budget is not a
   free-floating allowance but a *partition* of a measurable total. This is the version with a
   genuine conservation law, and it is the one §6 needs.
3. **Accept it is a ratchet and stop calling it a budget.** Rename to **encryption
   ratchet** / **frost allowance**. Costs nothing, and removes an unearned connotation.

Option 2 is the one that would make the decorrelation argument work; option 3 is the honest default
until someone builds option 2.

---

## 5. Does it produce decorrelation? (Q4) — trace the chain

This is the step the brief flagged as most likely to be a non-sequitur. It is.

`docs/VISION.md` supplies the target quantity: `N_eff = N / (1 + (N−1)ρ)`, with `ρ* = 1/3` the
threshold above which the ensemble cannot beat its best individual. VISION also states the crucial
causal fact (line ~334): **ρ is set by shared *derivation* — same model, same runner.**

The chain Aaron's sentence needs:

```
(P1) agents can hide bits          [encryption budget]
(P2) ⟹ agents disclose less to each other
(P3) ⟹ mutual information I(A;B) falls
(P4) ⟹ ρ falls
(P5) ⟹ N_eff rises                 [decorrelation achieved]
```

**P4 ⟹ P5 is established** — that is just the VISION formula, and it is arithmetic.

**P3 ⟹ P4 is a clean mapping, and it is the one genuinely valuable thing the physics framing
gestured at.** For jointly Gaussian variables,

```
I(A;B) = −½ log₂(1 − ρ²)   bits        ⟺        ρ = √(1 − 2^(−2I))
```

Stated hypothesis, per the anchor-taxonomy's warning that math anchors leak at *applicability*, not
at *statement*: this identity holds **for jointly Gaussian** variables. Zeta's ρ is a Pearson
correlation over agent judgements whose joint law is **not** established to be Gaussian, so this is
a **model**, marked `toy`, not a measurement. (Standing knowledge, **not page-checked here**: among
distributions with fixed second moments the Gaussian *minimises* mutual information, which would
make the bit-figures below a *lower* bound — i.e. the real requirement at least this strict. Flagged
for Soraya; not relied on.)

Under that model, the numbers are stark:

| ρ | I(A;B) | N_eff at N = 1000 |
|---|---|---|
| 0.00 | 0 bits | 1000 |
| 0.05 | 0.0018 bits | 19.6 |
| 0.10 | 0.0072 bits | 9.9 |
| 0.20 | 0.0294 bits | 5.0 |
| **1/3 = ρ\*** | **0.0850 bits** | **3.0** |
| 0.50 | 0.2075 bits | 2.0 |
| 0.87 | 1 bit | 1.15 |
| 0.9999+ | 8 bits | 1.00 |

> **The load-bearing number of this document: `ρ* = 1/3` corresponds to 0.085 bits of mutual
> information.** To stay in the regime where plurality is real, two agents may share **less than
> one-twelfth of a bit**. At **1 full bit** of mutual information ρ = 0.866 and a thousand agents
> are worth 1.15. At **8 bits** — one byte — a thousand agents are worth one.

That is a **dimensional-analysis catastrophe for the proposal as stated**: the encryption budget is
denominated in *hundreds to thousands of bits*, and the quantity it is supposed to control must be
held below *0.085 bits*. The two numbers are not on the same scale and the budget has no lever that
reaches down there.

### The three gaps

**Gap 1 — P1 ⟹ P2 is FALSE as specified: the budget is a floor on secrecy, which is a ceiling on
nothing.**

A permission to hide *up to* `b` bits bounds the hidden part from **above**. By complementarity it
places a **lower** bound on disclosure (`disclosed ≥ H − b`) and **no upper bound at all**. But
bounding `I(A;B)` requires bounding **disclosure from above** — by the data-processing inequality,
`I(A;B) ≤ H(disclosed)`, so you need a **disclosure cap**, not a hiding allowance.

Nothing stops an agent from using zero of its budget and publishing everything. **The mechanism
that would produce decorrelation is a mandatory disclosure ceiling; the mechanism that exists is a
voluntary hiding floor. They are not the same object and the existing one does not imply the
other.**

**Gap 2 — the incentive gradient of the existing design runs TOWARD correlation.**

This is the finding I least expected and it is checkable against the design doc's own text. The
encryption-budget design is **reveal-to-earn**: budget is *earned by revealing*, and the source doc
states the intent explicitly — *"The incentive flows toward light-like reveals, never toward
hiding."* Aaron's own framing: agents **HODL** and cash out when society will pay.

But disclosure is the correlation channel. Every reveal is content other agents can read and
condition on. So the mechanism nominated to *produce* decorrelation is, by its own stated incentive
design, **a subsidy on disclosure** — it pays agents to widen the channel whose width is `ρ`.

This is a structural argument, not a measurement, and it is stated as such. It is nonetheless a
**falsifier-shaped** objection: if reveal-to-earn is run and ρ does not rise, the objection is
wrong, and that is an experiment someone can actually run (§7).

**Gap 3 — the dominant correlation term is untouched.**

VISION already names the cause of ρ: **shared derivation** — same base model, same runner, same
seed (Zeta's S=4 common seed is deliberate). Secrecy operates on *disclosure*. It has **no effect
whatsoever** on correlation that arrives through shared priors, and shared priors are the dominant
term for a fleet of instances of the same model.

Two agents can hide everything from each other and remain near-perfectly correlated, because they
were correlated *before either of them said anything*. **Secrecy cannot decorrelate what was
already correlated at initialization.** VISION's own escape hatch confirms the shape of the fix:
ρ is per-*task*, and the thing that drives it to ~0 is a **mechanical check** (exit codes, byte
comparison, mutation survival) — not privacy.

### What secrecy *does* buy — the honest positive

Secrecy cuts exactly one real correlation channel: **information cascades / social influence**. If
agents cannot observe each other's answers before committing, they cannot anchor on them. That is a
well-replicated empirical result with proper anchors — **Bikhchandani, Hirshleifer & Welch 1992**
(informational cascades) and **Lorenz, Rauhut, Schweitzer & Helbing 2011**, PNAS 108:9020–9025
(*How social influence undermines the wisdom of crowd effect* — social influence narrows the
diversity of estimates **without** improving accuracy, and increases confidence, which is the
groupthink signature exactly).

Note the register: these are **empirical** anchors, so per the anchor taxonomy the right check is
**replication and disinterested review**, *not* entailment. Lorenz et al. is a single well-cited
laboratory study; treating it as settled would be its own error. Marked `unmetered`.

**So the mechanism is real and the anchor is social science, not physics.** And the implementation
it recommends is not an encryption budget at all — it is **commit-reveal / sealed-bid**: agents
commit to a hash of their judgement before any disclosure, then reveal. That cuts the cascade
channel completely, needs no budget, no thermodynamics, and no key management.

---

## 6. Where the physics *would* have bitten, and why it doesn't

The most interesting near-miss deserves stating precisely, because it is the version worth
someone's time.

**Sagawa–Ueda is the anchor that actually contains the right variable.** Its generalized second law
bounds extractable work by `kT · I` where `I` is mutual information — and mutual information is
exactly the quantity §5 shows is operative for `ρ`. So there is a genuine **math-shape
correspondence**: the same `I` appears in the thermodynamics of feedback control and in the
correlation structure of an agent ensemble.

**And that is all it is.** Run the metering-test on it:

- The thermodynamic statement is `W ≤ kT · I`. The decorrelation statement is
  `ρ = √(1 − 2^(−2I))`.
- `I` is shared. `k` and `T` appear **only** in the thermodynamic one, and **only** as a conversion
  factor from bits to joules.
- Delete `k` and `T` and the decorrelation result is **unchanged**.

> **The mutual information does all the work; the Boltzmann constant does none.** The correspondence
> is at the level of **information theory**, which both fields borrow from — not at the level of
> thermodynamics. Shannon is the common ancestor, and going through Boltzmann to reach him is a
> detour that adds a temperature the destination does not use.

Per `.claude/rules/numerology-vs-number-theory.md`: the appearance of the same symbol `I` in two
formulas is a **coincidence of shared vocabulary**, and the invariant that distinguishes the cases
is **whether the result depends on `T`**. It does not. Recorded as a coincidence with its register
attached, not promoted to a belief.

**Say "math-shape correspondence"; refuse "the physics grounds our decorrelation."**

---

## 7. What would actually have to be built

Stated as falsifiable proposals so they can be killed cheaply. All `toy` until someone meters them.

1. **Commit-reveal on judgements.** Agents publish `H(judgement ‖ nonce)` before any peer output is
   visible, then reveal. Cuts the cascade channel — the one channel secrecy genuinely owns.
   **Falsifier:** run the fleet with and without commit-reveal on the same task set and measure ρ
   both ways. If ρ is unchanged, the cascade channel was not contributing and this buys nothing.
   **This is the cheapest experiment in this document and it should be run first.**

2. **A disclosure ceiling, not a hiding allowance** (§5 Gap 1). If a budget is wanted for
   decorrelation, denominate it as **bits an agent may publish per unit phase**, which is the
   direction that bounds `I` by the data-processing inequality. **Falsifier:** if measured ρ does
   not fall as the ceiling tightens, the disclosure channel was not the binding constraint — which
   would confirm Gap 3 and point at shared derivation instead.

3. **Attack Gap 3 directly, because it is the dominant term.** Decorrelation from shared derivation
   needs *different derivation*: different base models, different runners, different seeds. VISION
   already says so. **This is infrastructure diversity, and no privacy mechanism substitutes for
   it.**

4. **Measure `I(A;B)` directly rather than inferring it from ρ.** The Gaussian map in §5 is a
   modelling assumption; a direct estimator removes it. **Falsifier:** if measured `I` and the
   ρ-implied `I` disagree, the Gaussian assumption is wrong and every bit-figure in §5 needs
   restating.

---

## 8. Register disposition

Nothing here is proposed for §A. Proposed §B rows, each with the falsifier that would kill it:

- **Z-E1 (CONJECTURE):** *Mutual information, not energy, is the operative variable linking
  disclosure policy to the ρ band; `ρ = √(1 − 2^(−2I))` under a joint-Gaussian hypothesis.*
  **Falsifier:** measure `I(A;B)` and ρ directly across agent pairs; disagreement beyond the
  Gaussian model's error kills the map. **Scheme-independence required:** the result must not depend
  on the estimator's binning or on the choice of judgement encoding.
- **Z-E2 (CONJECTURE):** *The reveal-to-earn incentive raises ρ.* **Falsifier:** run
  reveal-to-earn and measure ρ; no rise falsifies it. Currently a structural argument only.
- **Z-E3 (REFUTED, recorded so it is not re-proposed):** *Thermodynamic erasure cost grounds the
  hard-money property of the privacy budget.* **Refuted** by §1 on magnitude (10^9.8) and by §1.4 on
  direction. This row exists so the claim has a gravestone rather than a vacancy.

**On tier discipline:** a math-shape correspondence sits at CONJECTURE until Soraya proves it. It
does not graduate by being physically evocative — and Z-1's closure is the local precedent.

---

## 9. Handoffs

- **Soraya (formal verification):** Z-E1's data-processing-inequality step (`I(A;B) ≤ H(disclosed)`)
  is small and mechanical and is the load-bearing inequality in §5 Gap 1 — it is worth a Lean
  statement. Also the flagged-not-relied-on claim in §5 that the Gaussian minimises mutual
  information at fixed second moments; if true it strengthens Gap 1, and it should not be used until
  checked.
- **Kenji (Architect):** §4 option 3 (rename "encryption budget" → "encryption ratchet") is a
  vocabulary decision, not mine to make. §7 item 1 (commit-reveal) is a cheap experiment with a real
  falsifier and is the highest-value item here.
- **Aaron:** the sentence audited has one surviving half. "Encryption budget" is real, is in bits,
  and is already built. "Erasure costs in thermodynamics" does not ground decorrelation and should
  not be described as a primary objective's mechanism — the primary objective (decorrelation) is
  right, and its actual levers are **infrastructure diversity** and **commit-reveal**.

## 10. Anchors (Beacon), with checked status

| Anchor | Status |
|---|---|
| `k = 1.380649 × 10⁻²³ J/K` exact, 2019 SI redefinition of the kelvin | **CHECKED** — defining constant |
| Landauer 1961, *IBM J. Res. Dev.* 5(3):183–191 | **CHECKED for direction** (logical ⟹ physical); entailment to the audited claim **FAILS** |
| Bennett 1973, *IBM J. Res. Dev.* 17:525–532 | Standing knowledge; **not page-checked** |
| Bennett 1982, *Int. J. Theor. Phys.* 21:905–940 (Maxwell's demon) | Standing knowledge; **not page-checked**; used correctly elsewhere in repo |
| Szilard 1929 (the Szilard engine) | Standing knowledge; **not page-checked** |
| Bérut et al. 2012, *Nature* 483:187–189 | Standing knowledge; **not page-checked** — same limitation the repo already flags |
| Sagawa & Ueda 2008, PRL 100:080403 | Standing knowledge; **not page-checked**. Volume/page **should be verified** before this doc is cited outward |
| NIST SP 800-88 Rev. 1, *Guidelines for Media Sanitization* (Cryptographic Erase as Purge) | Standing knowledge; **not page-checked** |
| Horowitz, ISSCC 2014, *Computing's Energy Problem* | Standing knowledge; the 45 nm energy table is widely reproduced. **Not page-checked** |
| Bikhchandani, Hirshleifer & Welch 1992 (informational cascades), *J. Polit. Econ.* 100:992–1026 | Standing knowledge; **not page-checked**; **empirical register** — needs replication, not entailment |
| Lorenz, Rauhut, Schweitzer & Helbing 2011, PNAS 108:9020–9025 | Standing knowledge; **not page-checked**; **empirical register**; single study |
| Shannon 1948 (mutual information) | Foundational; the actual common ancestor of both sides of §6 |

**Coverage is uneven and this table says where.** Per the provenance discipline: these are
**math-shape correspondences** over borrowed, published physics — never evidence that the physics
measures, grounds, or proves our system. **No external source text has been copied into this repo**;
every anchor above is summarised in our own words with a citation. The `not page-checked` rows are
the audit backlog, and the Sagawa–Ueda row is the one to verify first because §6 leans on it hardest.

---

*Provenance: shadow\* / Lumen, 2026-08-25. Advisory only. Everything above is CONJECTURE or audit;
nothing is FROZEN-CORE. The one thing this document asserts without hedging is the negative:
the Landauer bound does not ground the hard-money property, by ~10 orders of magnitude and by
direction.*

---

## 11. The Z-set / G-set split — the strongest form of the claim, checked in code

*Added after the initial verdict, on Aaron's mechanism. This section supersedes §1's framing of what
the claim was. §1's arithmetic is unchanged and still correct; it was answering the wrong question.*

### 11.0 Retracting my own objection

The nine-orders-of-magnitude result in §1 is **a true fact aimed at the wrong claim**, and the
honest thing is to say so plainly rather than leave it standing as though it landed.

Aaron's claim is not *"erasure is expensive."* It is *"erasure is the **unique** irreversible
operation in the algebra, and therefore the only one that must be admission-controlled."*
**Magnitude is irrelevant to a uniqueness claim.** A property that holds at 2.871 zJ holds at any
scale, because what is being claimed is *which operation* has the floor, not *how big* the floor is.
Bennett 1973 is exactly this: reversible operations carry **no** floor, so the set of operations
with a floor is a distinguished set, and distinguishing it is a structural fact independent of the
constant.

So §1 refutes "erasure cost is a *price*". It does not touch "erasure is the *unique irreversible
act*". The second is the real claim and it survives §1 completely.

### 11.1 The mapping, and it is correct

| operation | logical character | Landauer |
|---|---|---|
| G-set append (grow-only, monotone, idempotent) | join in a semilattice; `x ⊔ x = x`; no state distinguished-then-merged | **free** |
| Z-set `negate` (`w → −w`) | **self-inverse bijection** | **free** (Bennett 1973) |
| Z-set weight change `5 → 4` | injective on the key's fibre — key survives, weight recoverable given the delta | **free** |
| **Z-set zero-crossing `1 → 0`** | **key REMOVED; `{k→1} + {k→−1}` and `{}` both map to `{}`** | **NOT free — this is the erasure** |

The last row is the whole thing, and it is right. Two distinct pre-states (`{k→1}` plus the
retraction, and the empty set) map to **one** post-state. That is a **non-injective step**, which is
precisely Landauer's criterion — and `erasure-class.ts` already states the correct classifying
question in its own header: *"the classifying question is injectivity, and nothing else."*

**Aaron's correction is the sharper version and it is the right one.** The erasure is the
**zero-crossing**, per key, and it is **countable**: *how many keys did this computation annihilate?*
is a well-defined integer, a property of the **algebra** rather than of a storage engine. That is a
much better quantity than my coordinator's batch-compaction framing, which was
implementation-dependent.

### 11.2 CHECKED IN CODE — zeros are dropped, and all four oracles agree

Not reasoned about abstractly. `src/Core/ZSet.fs`:

```fsharp
// consolidateSorted, lines 211 + 216 — the zero-crossing, twice
if curW <> 0L then
    span.[writeIdx] <- ZEntry(curKey, curW)
    writeIdx <- writeIdx + 1
```

A key whose weights sum to zero is **never written to the output span**. It is **absent**, not
stored-as-zero. Same rule at two more entry points: `singleton` (line 239,
`if w = 0L then ZSet.Empty`) and `ofSeq` (line 251, `if w <> 0L then`).

**Cross-oracle check — they agree, which is itself the finding:**

- **TypeScript**, `src/Core.TypeScript/z-set/z-set.ts:10-12` — *"a Z-set drops ONLY `== 0` — a
  negative weight is a [legitimate value] … the drop rule (`> 0` → `!= 0`) is the entire ℕ→ℤ
  widening"*. Drops zero.
- **Rust**, `src/Core.Rust.Algebra/src/indexed_zset.rs:16,45` — *"sorted by value, weight `!= 0`"*,
  and the canonical invariant is stated the same way. Drops zero.
- **F#** — above.

**So the erasure count is byte-lock-stable across the oracles.** A divergence here would have meant
the count of irreversible operations differed by language, which would have been a serious finding;
it does not. This is a **negative result that strengthens the claim** and it should be recorded as
such: the zero-crossing is a genuine cross-language invariant of the algebra.

**One precision the framing needs.** The crossing does not occur at *retraction*; it occurs at
**consolidation**, which is where summing happens. Appending a `−1` to an unconsolidated buffer
destroys nothing. `ZSet.add`/`ofSeq` call `sortAndConsolidate`, so in practice consolidation is
eager at every algebraic operation — but the *erasure boundary is the consolidate call*, and naming
it correctly matters because that is the function a meter would have to instrument.

The repo already had this exactly right, in
`src/Core.TypeScript/algebra/wset-four-corner-trace.ts:22-24`:

> *"`negate` is a self-inverse bijection, so by Bennett 1973 it erases nothing and is Landauer-FREE.
> The erasure is in CONSOLIDATION (the annihilating pair and the empty set both land on `[]`).
> **Negation is free; annihilation is what pays.** Those two read as one operation and are not one
> operation."*

That is Aaron's mechanism, already written down, already correct, already in two oracles.

### 11.3 Is it countable **today**? No — and this is the verdict "specified but unbuilt"

The mechanism is built. **The meter is not.** Three checks:

1. **`consolidateSorted` returns `writeIdx` — the count of *survivors*, not of *annihilations*.**
   The number of keys destroyed is recoverable in principle (distinct input keys − `writeIdx`) but
   is **not computed and not returned**. No caller can learn it without new instrumentation.
2. **`ErasureClass.fs` declares NO row for Z-set consolidation.** The classifier — the substrate's
   own erasure vocabulary, keyed by `(representation, operation, observation)` — **has no entry for
   the operation that actually erases.** By that module's own doctrine an undeclared operation is
   `unmeasured`, and it is explicit that *"an operation nobody has swept has an UNKNOWN cost.
   Recording it as `0` is the closed-ledger free lunch the whole apparatus exists to refuse."*
3. **`erasure-class.ts` states it does not charge:** *"This module CLASSIFIES. It deliberately does
   not charge: nothing here touches `entropy-tracker.ts`."*

> **Verdict: the mechanism is REAL and IMPLEMENTED; the meter is SPECIFIED BUT UNBUILT.**
> This is a third verdict distinct from both "true" and "decorative", and it is the accurate one.
> The irreversible operation is happening, in all four oracles, byte-lock-stably, and **nothing is
> counting it.** Aaron's *"deciding to allow g-sets to spend heat"* describes an admission-control
> gate that **does not exist yet** — there is no decision point, because there is no counter.

The gap is small and well-defined, which is the good news: `consolidateSorted` would need to return
annihilations alongside survivors, and `ErasureClass.fs` would need one declared row. That is a
genuinely cheap change for a genuinely load-bearing quantity.

### 11.4 Frost is NOT compaction-with-a-proof — and the rule and the code disagree

Checked, because the coordinator asked and the answer is a finding. `src/Core/GlassHalo.fs`:

```fsharp
let frost (cost: int) (available: int) (v: Visibility) : Result<Visibility * int, string> =
    match v with
    | Frosted _ -> Ok(v, available)
    | Clear -> ... Ok(Frosted cost, available - cost)

/// **Clear (return to transparency): free.**
let clear (v: Visibility) : Visibility = Clear
```

**`frost` destroys nothing.** It sets a `Visibility` marker; `observe` returns a placeholder instead
of the content while the marker is set. **The bits remain.** So frost is `erasing = false` — a
marking, not an erasure, and therefore it pays no Landauer cost and gets none of irreversibility's
soundness.

And the sharper problem: **`clear` is free, unconditional, and takes no owner argument.** Any holder
of the value can call it and the content is visible again. Compare the standing rule
(`privacy-budget-is-hard-money-earned-by-others.md`): *"permanent frost over them is inviolable once
earned"*, and *"there is no `defrost` that another party can force — only the owner may reveal."*

> **The rule promises permanence and unconfiscatability. The code implements a revocable marker with
> a free, unauthenticated un-set.** That is the vacuity class named in this repo's own memory — *an
> unenforced exception looks like a guarantee and carries none.*

This is not a claim that `GlassHalo.fs` is wrong for what it is; as a **display-layer** default-clear
visibility model it is fine and its docstring claims no more. The defect is the **gap between the
rule's language and the mechanism's reach**. Two honest repairs, and they are different products:

- **If frost is meant to be a display default** — soften the rule's language from "permanent /
  inviolable" to "default-opaque marking", and stop citing it as the hard-money mechanism.
- **If frost is meant to be unconfiscatable** — it must be **cryptographic**, not a marker: encrypt
  the region and let the owner hold the key, so revealing requires the key rather than a call to
  `clear`. Then §3.2's crypto-shredding leverage applies and permanence becomes real (destroy the
  key, the region is gone forever). **This is where the encryption budget and the erasure story
  actually meet**, and it is the one place in this whole audit where Aaron's two phrases join up
  into a single coherent mechanism.

That last point is worth stating as the constructive core: **"encryption budget" + "erasure" compose
correctly at exactly one place — key-destruction as the implementation of permanent frost.** Not via
thermodynamics; via NIST SP 800-88 Cryptographic Erase.

### 11.5 The raw-vault tension is REAL and conditional — not papered over

The coordinator asked whether the zero-crossing conflicts with *"a single version of the FACTS,
never a single version of the TRUTH."* It does, **conditionally**, and the condition is checkable.

The resolution is a **two-layer** one, and the repo's own design already anticipates it
(`wset-four-corner-trace.ts` decision 2): *"The trace is RETURNED TO THE CALLER rather than retained
… storage and forgetting stay EXPLICIT POLICY DECISIONS AT THE BOUNDARY. This module keeps no log.
That is Bennett's reversible-computation boundary: keeping history costs nothing, forgetting is
where the Landauer cost lands, so forgetting must be something a caller CHOOSES."*

- **Raw vault / delta log layer** — retains `+1` and `−1` as two separate immutable facts. No
  erasure. Raw-vault doctrine satisfied.
- **Materialized Z-set view** — consolidates, crosses zero, drops the key. Erasure. This is a
  *derived* view, and a derived view collapsing is exactly what derived views are for.

**So there is no conflict *provided the log is retained*.** But that proviso is load-bearing and it
is **policy, not structure**: `ZSet` itself keeps no log, and a caller that consolidates without
having durably retained the deltas **has destroyed a fact**, which is the collapse the raw vault
forbids. The doctrines do not conflict; **they constrain each other**, and the constraint is
currently unenforced.

> **Falsifier-shaped, and worth building:** a check that no consolidation path reaches a
> zero-crossing without a durable delta record upstream. If such a path exists, the raw-vault
> guarantee is violated there and the violation is silent today.

### 11.6 "Our Maxwell demon accurate accountant" — structural or suggestive?

Held to `.claude/rules/numerology-vs-number-theory.md`: name what else has this shape, and the
invariant that excludes it.

**The three-point match is genuine.** Bennett's 1982 resolution has: (a) a memory accumulating
records, (b) a reset destroying them, (c) the entropy landing at **reset**, not at measurement —
Bennett's correction to Szilard and Brillouin, who located it at measurement. The Z-set has: (a) a
Z-set accumulating weights, (b) consolidation annihilating ± pairs, (c) the cost landing at
**annihilation**, not at `negate`. Point (c) is a real and non-obvious structural agreement, and
`wset-four-corner-trace.ts` makes exactly Bennett's distinction — *"those two read as one operation
and are not one operation"* is the same correction, independently arrived at.

**But what else has this shape?** A reference count hitting zero and freeing the object. Mark-sweep
GC. A CRDT tombstone reaped. A bank ledger netting offsetting entries to nil. **Every one of these
is an accumulator with an annihilating operation whose cost lands at annihilation.** The count is
consistent with "Maxwell's demon" and equally consistent with "refcount hits zero", and nobody calls
a refcount a demon.

**The invariant that excludes the demon:** the demon's memory is coupled to **work extraction** —
the records exist *because* they were used to extract `kT ln 2` of work from a heat bath, and the
reset cost is what makes the ledger balance so the second law survives. **The Z-set extracts no
work.** There is no bath, no engine, no work term, and therefore nothing for the erasure cost to
balance *against*. The accounting half matches; the half that makes it a *demon* is absent.

> **Verdict: this is a correct instance of Landauer/Bennett erasure accounting, and the "Maxwell's
> demon" label adds no checkable content.** Say **"an injectivity-classified erasure ledger"** —
> which is what `erasure-class.ts` already calls it, and which is both accurate and more specific.
> Recorded as a coincidence-with-its-register-attached, not promoted.

The repo does use the demon framing correctly elsewhere — *"an unmetered channel is a Maxwell's
demon"* (`2026-08-18-…`) is a fair use, because there the point is precisely that an unaccounted
channel appears to give something for nothing. That is the demon's actual content. "Accurate
accountant" is the same idea and is fine as **rhetoric**; it is not a mapping.

### 11.7 Revised verdict on the mechanism

| claim | verdict |
|---|---|
| G-set append / `negate` / weight-weakening are reversible and free | **TRUE, checked** (Bennett 1973; `negate` is self-inverse) |
| The Z-set **zero-crossing** is the unique irreversible operation in the algebra | **TRUE, checked in code, and byte-lock-stable across F#/TS/Rust** |
| Zero-weight keys are dropped rather than retained | **TRUE, checked** — `ZSet.fs:211,216,239,251` + TS + Rust |
| The count of zero-crossings is a well-defined quantity | **TRUE** — and it is the right quantity |
| It is **metered** today | **FALSE — specified but unbuilt.** No annihilation count returned; no `ErasureClass` row; classifier explicitly does not charge |
| Heat cost makes irreversibility **expensive** (a price) | **FALSE** — §1, ~10 orders. Uniqueness survives; **pricing does not** |
| `frost` is compaction-with-a-proof | **FALSE** — a revocable marker; `clear` is free and unauthenticated |
| It is "Maxwell's demon" | **Suggestive, not structural** — no work extraction; refcount-to-zero has the same shape |

**The corrected reading of Aaron's sentence, which I think is what he means and which is
defensible:** *"deciding to allow G-sets to spend heat"* is **admission control on the irreversible
operation**, and the currency is **bits, not joules** — a count of annihilations, gated by policy.
That is a real, buildable, countable mechanism. It is Landauer-*shaped* in that Landauer/Bennett
supply the classifying criterion (injectivity), and it needs **no thermodynamic magnitude at all**
to work. Drop the joules and keep the injectivity, and the design is sound.

### 11.8 What §11 changes about §§4–7

- **§5 Gap 1 and Gap 3 are untouched.** A zero-crossing ledger meters *forgetting*; it does not
  bound *disclosure*, and it does nothing about shared derivation. **The decorrelation
  non-sequitur stands in full.** Nothing in §11 connects erasure accounting to `ρ`.
- **§4 is sharpened.** The zero-crossing count is a candidate for the **conservation law** §4 found
  missing: `bits admitted − bits annihilated` is an actual accounting identity over a metered
  channel, and `key-erasure-meter.ts` already implements exactly that shape for keys
  (`bitsAdmitted` / `bitsErased`). **Extending it from key material to Z-set annihilations is the
  concrete path from "ratchet" to "budget".** This is the most promising single item in this
  document.
- **§7 gains an item.** *(5)* **Return the annihilation count from `consolidateSorted` and declare
  the row in `ErasureClass.fs`.* **Falsifier:** if the count cannot be made stable across the four
  oracles under DST replay, the quantity is implementation-dependent and not a property of the
  algebra after all — which would falsify the whole §11 framing. Given §11.2 this is unlikely, and
  it is exactly the check that would find out.

### 11.9 Register, revised

- **Z-E4 (CONJECTURE, promoted candidate):** *The Z-set zero-crossing is the unique
  non-injective operation in the core algebra, and its count is a DST-stable, cross-oracle invariant.*
  **Falsifier:** exhibit any other non-injective core operation, or a workload whose annihilation
  count differs between F#, TS and Rust on the same seed. **Nearest to dischargeable of anything
  here** — it is a code property with a mechanical check, and Soraya can take it.
- **Z-E5 (FINDING, not a conjecture):** *`GlassHalo.frost` does not implement the permanence its
  governing rule asserts.* Not a conjecture because it is settled by reading the code; filed as a
  defect for adjudication. Either the rule's language or the mechanism must move.
- **Z-E3 amended:** the refutation stands **only against the pricing reading**. The
  *uniqueness-of-the-irreversible-operation* reading is **not refuted** and is now Z-E4.

*Anchors added in §11 (status): Bennett 1973 — used here for the strong claim that a bijection
erases nothing, which is its actual content, so **entailment holds**. Bennett 1982 — used for the
cost-at-reset-not-measurement distinction, which is its actual content; **entailment holds**, and
the demon *identification* is separately rejected in §11.6. Budiu et al. 2022 (DBSP) — the Z-set
retraction algebra; standing knowledge, **not page-checked**. Joyal–Street–Verity 1996 (traced
monoidal categories) — cited by the four-corner module, **not checked by me**.*

---

## 12. Widening, and whether the −1 actually pays

*Second sharpening, on two further inputs from Aaron. §12.2 partially falsifies §11's uniqueness
claim and replaces it with a stronger one; §12.3 is a code finding that contradicts the payment
model. Both are reported as found.*

### 12.1 "Widening" is the right word — for the G-set half, not the Z-set half

Aaron: *"weaken i've also seen called widened in the literature."* Correct, and the anchor is
**Cousot & Cousot 1977** (*Abstract Interpretation*, POPL) — the **widening operator `∇`**
deliberately discards precision to force fixpoint termination, moving **up** a lattice toward `⊤`.
Good term, real lineage, and better than "weaken".

But the transfer needs one correction, and it is load-bearing rather than pedantic:

> **Widening is a LATTICE operation. Z-sets are not a lattice — they are an abelian GROUP (a
> ℤ-module). The two halves of Aaron's own G-set/Z-set split have different algebraic structures,
> and the widening vocabulary belongs to the G-set half.**

- **G-sets** are a **join-semilattice**: `⊔` is idempotent, commutative, associative, and monotone.
  Append moves **up**, never down. This is precisely where widening lives, and it is also why
  G-sets are free — monotone join in a semilattice is information-*accumulating*. (Anchor: Shapiro,
  Preguiça, Baquero & Zawirski 2011, CRDTs — the monotone-join-semilattice formulation. Standing
  knowledge, **not page-checked**.)
- **Z-sets** are a **group**. `5 → 4` is not a monotone move up any lattice order; it is
  `+(−1)` in ℤ, and ℤ under `≤` has no `⊤`. There is nothing to widen toward.

So the elegant formulation — *the costly operation is the one not expressible as a lattice move* —
**does not typecheck over Z-sets**, because *no* Z-set weight change is a lattice move. The
distinction it is reaching for is real, but the discriminator is **injectivity**, which is what
`erasure-class.ts` already uses and what Landauer actually prices. Widening is the correct name for
what G-sets do; injectivity is the correct criterion for what costs.

### 12.2 Testing "the zero-crossing is the unique non-move" — it is FALSE, and the true statement is better

Checked directly against `consolidateSorted`, and the result is a partial falsification of §11.

**Counterexample to uniqueness.** Consolidation is **in-place**: `span.[writeIdx] <- ZEntry(curKey, curW)`
overwrites the input buffer while reading it (`writeIdx ≤ i` always). Now consider two inputs:

```
{(k,5), (k,−1)}  ──consolidate──▶  {(k,4)}
{(k,4)}          ──consolidate──▶  {(k,4)}
```

Two distinct pre-states, one post-state. **Non-injective — an erasure by Landauer's own criterion,
with no zero-crossing anywhere in it.** The decomposition `5 + (−1)` is destroyed exactly as surely
as an annihilating pair is. So the zero-crossing is **not** the unique irreversible operation, and
§11.7's row claiming uniqueness is **withdrawn**.

**And the true statement is stronger, not weaker.** Go up one level. On *canonical* Z-sets, for a
**known** delta `b`, the map `a ↦ a + b` is a **bijection** on ℤ^K, with inverse `a ↦ a − b`. It is
a bijection **including at zero-crossings**: `{k→1} + {k→−1} = {}`, and `{} − {k→−1} = {k→1}`
recovers it exactly. **The group operation erases nothing.**

> **So the erasure boundary is not the zero-crossing, and not any weight change. It is
> DISCARDING THE DELTA.** Retain `b` and every Z-set operation is reversible and free — which is
> Bennett 1973 stated in the substrate's own algebra. Drop `b` and you have erased, whether or not a
> key crossed zero.

This is exactly what the repo already concluded independently
(`wset-four-corner-trace.ts`, decision 2): *"keeping history costs nothing, forgetting is where the
Landauer cost lands, so forgetting must be something a caller CHOOSES."* The zero-crossing framing
was locating the cost one level too low.

**What IS uniquely true of the zero-crossing — and it is the property worth keeping.** A key at
weight 4 remains in the structure as a **witness**: something happened here. A key that crossed zero
is **absent**, and absence is **indistinguishable from never-having-existed** by any local
observation of the Z-set.

> **The zero-crossing is the unique operation that destroys the evidence that there was anything to
> erase.** Every other operation leaves a witness in the support; this one removes itself from the
> record.

That is an **observability** property, not a bit-count property, and it is precisely the one that
matters for a ledger: **it is the only operation that can blind the meter.** An accounting scheme
must instrument it specially not because it erases more, but because it is the one act that can go
unrecorded without leaving a gap where the record would be. That is a genuinely load-bearing
distinction and it survives everything above.

### 12.3 Does the −1 actually pay? Structurally yes; **in the code, NO — the payment is deferred**

Aaron: *"a −1 antiparticle DOES it and PAYS THE PHYSICAL COSTS for it."* The coordinator is right
that this is the load-bearing form, and right about why: **an accountant standing outside the system
tallying for free is the demon paradox in its unresolved state.** Bennett's 1982 resolution works
because the demon's memory is *inside* the system. Putting the payer inside is the correct move and
it is the strongest version of the claim.

**Checked in code, and the code disagrees about *when*.** Follow the storage through annihilation.
`src/Core/Pool.fs:28-30`:

```fsharp
static member Return<'T>(buffer: 'T array) : unit =
    if buffer.Length > 0 then
        ArrayPool<'T>.Shared.Return(buffer, RuntimeHelpers.IsReferenceOrContainsReferences<'T>())
```

The second argument is `clearArray`. For `ZEntry<'K>` with a **value-type key** (`int`, `int64`,
enum — the common and hot case), `IsReferenceOrContainsReferences<'T>()` is **`false`**, and the JIT
constant-folds it. **The buffer is returned to the pool UNCLEARED.**

So at the moment the `+1` and the `−1` annihilate:

- the entry is not written to the output (it is skipped by `if curW <> 0L`), and
- the input buffer still **physically contains both weights**, and
- it is handed back to `ArrayPool.Shared` **without being zeroed**.

**The bits survive the annihilation.** They are destroyed later, by an unrelated `Rent` that
overwrites that slot — an event with no causal connection to the retraction that "paid" for it.

> **Verdict: the −1 is, as implemented, a token that records an intent to erase. The actual
> bit-destruction happens elsewhere, later, and is triggered by an unrelated allocation.**
> The antiparticle framing is apt about *who should pay* and wrong about *when*, and the gap is not
> hypothetical — it is a constant-folded `false` on the hot path.

Three consequences, in increasing order of importance:

1. **The model and the mechanism disagree on the payment point**, so any meter that charges at
   annihilation would be charging for an erasure that has not happened yet. It would be measuring an
   intention.
2. **There is a data-remanence property here.** For value-type keys, retracted weights persist in a
   shared pool until overwritten. For the ordinary Z-set that is harmless. For anything routed
   through `key-erasure-meter.ts` — key material — it would **not** be, and that module's whole
   point is that erasure claims must be backed. Worth a look by whoever owns that path; I have not
   checked whether key material ever transits a pooled `ZEntry` buffer, and I should not assert that
   it does.
3. **It is fixable and the fix is one argument.** `Pool.Return` could take an explicit
   `clear: bool` at erasure-sensitive call sites. That makes the payment happen where the model says
   it happens, and it makes the erasure real rather than promised. **This is the single most
   concrete actionable item in this document**, and it is smaller than everything else proposed here.

Note the pleasing consistency: this is the **same defect shape as §11.4's frost** — a marker that
records an intent to hide while the bits remain. Twice in one substrate, the *promise* of
destruction is implemented and the *destruction* is not. That is worth naming as a pattern rather
than as two incidents.

### 12.4 Pair annihilation as a shape — what else has it, and what excludes them

Held to `.claude/rules/numerology-vs-number-theory.md`, because "two things meet, both cease,
something is released" is a **generator**, not a conclusion.

**Competitors with the same shape:**

| candidate | two meet | both cease | something released |
|---|---|---|---|
| particle–antiparticle annihilation (Dirac 1928) | ✓ | ✓ | photons |
| Landauer erasure | ✓ (state pair → one) | ✓ | heat, ≥ `kT ln 2` |
| acid–base neutralisation | ✓ | ✓ | heat + salt |
| **double-entry netting (Pacioli 1494)** | ✓ | ✓ | **nothing physical** |
| refcount → 0, free | ✓ | ✓ | reclaimed memory |
| CRDT tombstone reaped | ✓ | ✓ | reclaimed memory |

Matching the shape excludes none of these. **The discriminating invariant:**

> **Is there a CONSERVED QUANTITY that FORCES the release?**

- **Pair annihilation:** yes — energy–momentum conservation. The photons are not optional.
- **Landauer erasure:** yes — phase-space volume / Liouville. The entropy must go somewhere; the
  heat is mandatory. This is why Bérut et al. could measure it.
- **Double-entry netting:** **no.** Nothing is released. The identity `debits = credits` is an
  *accounting* invariant with no physical content.
- **Z-set retraction:** **no.** Z-set weights are conserved under the group operation, but that is
  an algebraic identity, not a physical conservation law, and nothing forces a release. The heat
  that *is* dissipated when the pool slot is eventually overwritten is **CMOS switching energy**
  (§1.2, ~10⁻¹¹ J/bit) — incidental to the algebra, ~10 orders above the floor, and not mandated by
  any conservation law of the Z-set.

> **Verdict: Z-set retraction is *consistent with* pair annihilation in shape, and shares its
> discriminating invariant with double-entry bookkeeping instead.** Both have the shape; only
> bookkeeping has the invariant. Per the rule: say **"consistent with"**, and the competitor is
> **not** excluded — it is *selected*.

**And this is not a demotion.** Double-entry bookkeeping is the *correct* anchor for a retraction
ledger, and it is a **human anchor with a work** (Luca Pacioli, *Summa de Arithmetica*, 1494 —
the first published treatment of `partita doppia`). Its central invariant is that **every entry has
a counter-entry and the books must balance**, which is *exactly* what a `+1`/`−1` Z-set does and
exactly what a retraction ledger needs. It is also the anchor that explains why the algebra is
right without needing any physics at all.

Feynman remains the right **intuition** — the antiparticle worldline is genuinely how the retraction
reads, and it is Aaron's native frame, so it should keep its place as a **Mirror** term. The
**Beacon** compression of it is Pacioli, not Dirac. Both are true; they are different registers,
which is what the Mirror/Beacon discipline is for.

### 12.5 Net effect on the verdict

| claim | status after §12 |
|---|---|
| "Widening" is the right word for the free operation | **Correct for G-sets** (Cousot & Cousot 1977; monotone join). **Does not apply to Z-set weight changes** — a group has no lattice to widen in |
| The costly operation = "the one that is not a lattice move" | **Does not typecheck** over Z-sets; the working criterion is **injectivity** |
| The zero-crossing is the **unique** irreversible operation | **FALSE** — `{(k,5),(k,−1)} → {(k,4)}` is equally non-injective. §11.7 row **withdrawn** |
| The zero-crossing is uniquely **evidence-destroying** | **TRUE, and it is the better claim** — the only operation that can blind the meter |
| The real erasure boundary | **Discarding the delta**, not any weight change. Retain the delta and the group operation is a bijection (Bennett 1973) |
| The −1 pays, from inside the system | **Structurally the right model** — and Bennett 1982 is the correct reason |
| The −1 pays **at annihilation** | **FALSE in code** — `Pool.Return` passes `clearArray = false` for value-type keys; the bits survive and are destroyed later by an unrelated `Rent` |
| Pair annihilation is the anchor | **"Consistent with" only.** Discriminating invariant (a conservation law forcing release) is **absent**; selects **Pacioli 1494 double-entry** as the Beacon anchor. Feynman stays as the Mirror reading |

**Z-E4 amended.** The conjecture as stated in §11.9 is falsified by §12.2 and is replaced:

- **Z-E4′ (CONJECTURE):** *The zero-crossing is the unique Z-set operation whose occurrence is not
  observable from the post-state — i.e. the unique operation that removes its own witness — and it
  is therefore the operation an erasure ledger must instrument specially.* **Falsifier:** exhibit
  another core operation whose occurrence leaves no trace in the support, or show that a
  zero-crossing does leave a locally-observable trace. Soraya can take this; it is a statement about
  the algebra, checkable without running anything.
- **Z-E6 (FINDING, code):** *`Pool.Return` does not clear value-type buffers, so Z-set annihilation
  does not destroy the retracted weights at annihilation time.* Settled by reading
  `src/Core/Pool.fs:28-30`; filed as a defect for adjudication, with the `key-erasure-meter.ts`
  interaction flagged as **unchecked** rather than asserted.

*Anchors added in §12 (status): Cousot & Cousot 1977 (POPL), abstract interpretation / widening —
used for the actual content of `∇`; **entailment holds**, standing knowledge, **not page-checked**.
Shapiro et al. 2011, CRDTs as monotone join-semilattices — standing knowledge, **not page-checked**.
Pacioli 1494, *Summa de Arithmetica* — the double-entry anchor; historically uncontroversial,
**not page-checked**. Dirac 1928 — invoked only to be **excluded** as an anchor, per §12.4.*
