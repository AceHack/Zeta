# The evidence/observation gap is not where ℂ comes from — the shared fold never interferes

**Measured at `origin/main` `36c2ff5594a466c105799297e6b1fd65be1be8e4`.** The falsifier ran; the numbers are below with a control that
proves the probe can detect the thing it looked for.

**Register:** the interference measurement is **metered** (probe E/F, 800 000 weights, control at
50 000/50 000). The ℂ-emergence conjecture is **REFUTED in its stated form** for the shared belief
fold. What survives is **toy** and is stated as such in §4. Aaron flagged this as *"I think"*, and it
stays in that register.

> Aaron, 2026-08-24: *"I think this is where imaginary numbers come from — this difference between
> evidence and observation."*
> And: *"the reward is we set up a macroscale experiment that preserves quantum behaviours at
> macroscale, because of our careful metering of external effects — our Haskell I/O monad to the
> extreme, with metering."*

## 0. The answer in five lines

| question | answer |
|---|---|
| Does the shared belief fold exhibit **destructive interference**? | **No. 0 cancellations in 800 000 weights.** `observe` is pointwise multiplication of **non-negative** `int64` — there is no path-sum in which anything could cancel |
| Can the probe detect interference at all? | **Yes — 50 000/50 000** in the control lane, where two opposite-phase paths give strictly less support than one |
| So is ℂ doing real work in the fold? | **No.** ℂ is decoration there. Aaron's conjecture fails for the fold |
| Is there ℂ in the repo? | **Yes, and it is genuine** — `AmplitudeEmu.fs` / `ZSetISA.qs`. But ℂ was **put in by construction**, not derived from the evidence/observation split |
| Does the metering argument buy quantum behaviour? | **No — it buys the DEMARCATION LINE** (§6, Aaron's correction). What is measurable-here vs not, checkably partitioned |
| Is the interference answer therefore "no"? | **Two answers, two layers** — impossible in the belief fold, **reachable** in the quorum/amplitude layer (`QuorumPhaseCancellation.tla`, Soraya 2026-08-13). **The line runs between them** (§6.1) |
| Is metered noninterference a decoherence-free subspace? | **No — and not dynamical decoupling either.** Passive in *class*, but it does not satisfy DFS's defining symmetry. The honest match is the **closed-system idealisation** both approximate (§6.2) |
| Does ρ = 1/(1+L) settle "how far can one instance stretch"? | **Could not settle — the formula has a free scale.** `L` is "ticks, seconds, or any monotonic unit", so any latency fits. Fix the normalisation first (§6.4) |

---

## 1. The falsifier, and why it is the right one

Classical probability cannot cancel: adding a path never *reduces* total support. Amplitude addition
can. So "does the fold interfere?" discriminates ℂ-structure from ℝ-structure in one measurement, and
it beats any amount of narrative about phase.

`src/Core/BeliefConvergence.fs:33` is the whole combination rule:

```fsharp
let observe (likelihood: int64[]) (belief: int64[]) : int64[] =
    Array.map2 (*) likelihood belief
```

Non-negative `int64` weights, combined **multiplicatively, pointwise**. Two structural facts follow
before any probe runs, and the probe confirms both:

1. **There is no path sum.** Interference is a property of *adding* contributions that reach the same
   outcome by different routes. `observe` never adds anything. A candidate's weight is a product of
   likelihoods along one route.
2. **The weights live in a non-negative cone.** Even where the repo *does* sum weights on a shared key
   (`WSet.consolidate`), cancellation needs the ring to have signs. Over ℝ≥0 there are none.

```
E1 belief fold: cancellations to zero from nonzero inputs = 0 / 800000 weights
E1 belief fold: negative weights produced                 = 0
E2 belief fold: trials where support GREW after observing = 0 (interference would allow it)
F  amplitude lane (WSet/C): trials where TWO paths gave LESS support than ONE = 50000 / 50000

VERDICT: belief fold interference   = NONE (classical, non-negative multiplicative)
VERDICT: amplitude lane interference = PRESENT (by construction — the ring is C)
```

**Row F is the control and it is what makes row E1 mean something.** A probe that finds no
interference is worthless unless it can find interference; this one finds it every single time in the
lane that has it. So the zero is a measurement, not a blind spot.

---

## 2. The four algebra bullets — which I could settle and which I could not

### 2.1 Do magnitudes multiply and phases add? **Settled: there is no phase to add.**

In the fold, a belief weight is a single non-negative number. There is no second component, so there
is nothing that could play `arg`. The thing this repo calls **phase** — phase-canonical order, the
logical clock — is a **total order**, and total orders do not add mod 2π. Two events at logical
positions 3 and 5 do not compose to one at position 8; they compose to *an ordering*.

> **The pun is a pun.** QM's phase is an **angle in U(1)**; our phase is a **position in a total
> order**. U(1) is compact and abelian with a group law; a total order is not a group at all. They
> share four letters.

### 2.2 Is there a genuine conjugation? **Settled: no — and `ZSet` retraction is a different thing.**

This was the sharpest of the four, and the answer is clean:

> **Conjugation fixes the observable part and negates the unobservable part. Negation negates both.**
> `ZSet` retraction is `w ↦ −w` (`WSet.negate`, "the ring's additive inverse applied pointwise"). It
> is the **additive inverse**, not an involution that fixes anything.

The decisive check is a one-liner: **on ℝ, complex conjugation is the identity map.** If retraction
were the conjugation of this story, then restricted to the observable part it would have to *do
nothing* — and instead it flips the sign, which is precisely the operation that makes a Z-set
retraction retract. So retraction is not "the real part of this story"; it is a different structure
that happens to also be an involution. **Many things are involutions. Being one identifies nothing.**

### 2.3 Is the observable a norm? **Settled: not in the fold; genuinely, in the amplitude lane.**

In the belief fold the reported quantity is `w_i / Σw` — a **ratio**, a normalisation of a
non-negative vector. It is not `|z|` of anything, because there is no `z`.

The repo *does* have a real Born rule, and it is exactly where you would expect: `WSet.bornProb`
computes `|w|²/Σ|w|²`, and its docstring calls it "THE BOUNDARY MEASUREMENT (ℂ ring)". So the norm
structure exists — **in the lane that already declared its ring to be ℂ.** That is not evidence that
ℂ emerged from anything; it is evidence that someone wrote ℂ down.

### 2.4 What else has this shape? **Settled, and this is what excludes ℂ.**

"A part you see and a part you don't" is an extremely weak signature. Named competitors, and the
invariant that excludes each:

| candidate | has a seen/unseen split? | why it is not our structure — or not ℂ |
|---|---|---|
| **Signed measures** (Jordan `μ = μ⁺ − μ⁻`) | yes — observe `\|μ\|`, sign hidden | the hidden part is **ℤ/2** (a sign), not U(1). Signs do not *add* as angles; there is no continuum of phases. This is the closest match to what our fold actually has |
| **ℝ² / ordered pairs** | yes | **no multiplication at all**, so "magnitudes multiply" is not even expressible |
| **Split-complex** `ℝ[j]/(j²=1)` | yes | norm `x²−y²` is **indefinite** and has **zero divisors**. An observable probability cannot be negative, so this is excluded by the observable's own type |
| **Dual numbers** `ℝ[ε]/(ε²=0)` | yes | norm `a²` is **degenerate** — nonzero elements of zero norm. `\|·\|` fails the norm axioms |
| **ℂ** | yes | positive-definite norm, `\|ab\|=\|a\|\|b\|`, `arg(ab)=arg a + arg b`, conjugation fixing exactly the observable part |

**The invariant that does the excluding is a theorem, not a preference:** by **Frobenius (1878)** /
**Hurwitz (1898)**, ℂ is the *unique* two-dimensional real normed division algebra. So to earn ℂ you
must exhibit a **positive-definite multiplicative norm** and a **continuous phase that adds under
composition**. Our fold has neither: its hidden part is a discrete order, and its observable is a
ratio rather than a norm.

Note what the table also says, and it is the fair reading of Aaron's intuition: **the fold's actual
shape is closest to a signed measure** — which is exactly what a `ZSet` is (`docs`'
measure-theory blueprint calls this out: Hahn/Jordan decomposition, multiplicity, retractions). The
seen/unseen intuition is real. It lands on **ℤ/2**, one rung below ℂ.

---

## 3. What this says about the algebra ladder (the reason the question was asked)

The hoped-for payoff was that ℝ → ℂ would stop being an arbitrary first step and become the formal
shadow of the evidence/observation split. **It does not, and the ladder is unaffected.**

The measured transfer table in the sibling document
(`2026-08-24-wset-carries-the-bnn-and-the-factor-graph-*`) already gives the ladder a
non-arbitrary reading, and it is a better one because it is derived from what operations *consume*:

> **ℂ is the rung at which a total order is lost.** That is not a metaphor about observation — it is
> the measured first failure in the ladder (probe B: "total compatible order: ℝ yes; ℂ and above
> no"). Viterbi, max-product, and every threshold test die exactly there.

So the first doubling already has a precise operational meaning in this repo: **it is the price of
giving up order.** That meaning is measured, it excludes things, and it does not need the
evidence/observation story to justify it.

---

## 4. What survives — stated as `toy`, because it is

One thing in the intuition is genuinely right and worth keeping, labelled honestly:

> **`toy`:** the *shape* "a quantity that is load-bearing in the computation and absent from any
> single observation" does occur in our fold. It is the **phase-canonical order**: no node observes
> it (each node has only its own local receive-order — its proper time), yet it determines the shared
> result. `.claude/rules/local-time-never-enters-the-shared-fold.md` is precisely a rule about a
> hidden, relational, non-local quantity that must not leak into the observation.

**That is a real structural analogy, and it is where the analogy stops.** The hidden quantity is a
*total order*, so what it would formalise is ℤ or a torsor over it, not ℂ. Recording it as a
coincidence with its register attached, per `numerology-vs-number-theory`: *coincidence — the
evidence/observation split resembles the observable/unobservable split in QM*. Not a belief. If a
continuous, composition-additive hidden parameter with a positive-definite norm ever shows up in the
fold, this entry gets promoted and the thing that promoted it gets named.

---

## 5. The metering argument — the weak version is real, the strong version is not bought

Aaron's second sentence deserves the same precision, because there are two claims here and only one
is defensible. Naming them in the requested words:

- **The WEAK version — defensible, and checkable.** *The mathematical structure of QM (complex
  amplitudes, interference, unitary evolution) applies to any system with linear evolution, metered
  boundaries, and observables-as-norms.* This is a real claim, it is ordinary mathematics, and this
  repo partially satisfies it **by construction** in one lane: `AmplitudeEmu.fs` has complex
  amplitudes, `ZSetISA.qs` has unitary operators (`EMIT = Ry(θ)`, `RETRACT = Adjoint Emit`,
  `BRANCH = H`, `JOIN = CNOT`), and `WSet.bornProb` has observables-as-norms. Manifesto §13
  noninterference — *"entropy/influence flows ONLY through declared, metered channels"* — is a
  genuine statement of the isolation condition, and reading it as a decoherence-avoidance condition
  rather than as engineering hygiene is a fair and interesting reframe.
- **The STRONG version — NOT bought, and must not be implied.** *That physical quantum effects
  occur.* Metering boundaries in software does not produce physical coherence. There is no physical
  system here whose environment coupling is being suppressed; there is a program whose effects are
  typed. **"Quantum behaviour preserved at macroscale" is the sentence a reader will over-read**, and
  it should not be written without the weak/strong split attached.

**And the measured result narrows even the weak version.** The weak claim requires
*observables-as-norms* and *linear evolution with signed superposition*. The **shared belief fold has
neither** (§1–§2): non-negative multiplicative weights, ratio observables, no interference in 800 000
trials. So whatever quantum-shaped structure this repo has lives in the amplitude lane where it was
deliberately built — **it is not a property the metering discipline confers on the fold.** Metering
is a necessary condition for the analogy, and this measurement shows it is nowhere near sufficient.

**One caveat carried forward as required:** `1/(3√2) ≈ 0.2357` is a **design parameter, not a
Tsirelson bound**. Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH correlator
(`src/Core/Tsirelson.fs`). The former is the image of `S = 2√2` under a freely chosen linear map
`ρ = S/12`, adopted for homoiconicity. Enforced by `lint-tsirelson-constant-caveat.ts`.

## 6. The demarcation is the deliverable — and the repo already draws it in two places

Aaron, 2026-08-24, on the weak/strong split: *"yes this is what the meter buys exactly is
the distinction between which is measurable."*

That supersedes §5's framing and improves it. The meter's product is **not** quantum behaviour,
and not even a hedged claim about it — **the meter's product is the demarcation line itself**: a
checkable partition of quantities into measurable-here and not-measurable-here. It is the vacuity
class stated for physics — *a quantity that was not measured must never look like one that was.*

**And the repo already contains that sentence, in `docs/VISION.md`:**

> *"You can only distinguish coherent from incoherent addition if every contribution arrived through
> a declared, metered channel. An ambient path … is an undeclared coupling that makes two
> 'independent' sources coherent without either knowing. §13 is what keeps the channel list complete
> enough for the √N-vs-N test to mean anything."*

Metering does not make sources coherent or incoherent. **It makes the difference measurable** —
`Var(ΣX) = Nσ² + N(N−1)ρσ²`, so amplitude scaling as √N vs N *is* the correlation measurement. That
is Aaron's sentence, already written down, and it is the strongest support in this thread.

### 6.1 The interference falsifier has TWO answers, because there are two layers — this is the line

§1 measured the belief fold and found no interference. That is **half** the picture, and the other
half was already verified two weeks earlier by Soraya in
`src/Core.TLA/specs/QuorumPhaseCancellation.tla` (2026-08-13), which I found only after measuring:

| layer | combination rule | interference | register |
|---|---|---|---|
| **Belief fold** (`BeliefConvergence.observe`) | pointwise × over non-negative `int64`, **no path sum** | **impossible** — 0/800 000 measured | classical, and provably so |
| **Quorum / amplitude** (`AmplitudeEmu.merge`, the TLA spec) | **sums amplitudes** over one frame | **reachable** — and modelled as such | amplitude-like, by construction |

**The demarcation runs exactly between those two rows**, and it is mechanical rather than
rhetorical: *does the combination rule sum contributions, and can the weights carry a sign?* Both
must hold. The belief fold fails both; the quorum layer satisfies both.

The TLA spec also already states Aaron's frame better than §5 did — *"cancellation is the honest
MEASUREMENT INSTRUMENT, not a vulnerability to design away … report the neutral fact — destructive
interference occurred at magnitude X — and let policy attach the reading."* And it is scrupulous
about which direction its results travel: it restricts the adversary to the 4th roots of unity so
every amplitude is a **Gaussian integer and every sum is exact**, then notes that **reachability
transfers up but non-reachability does not**. That is the demarcation discipline applied to a proof
tool, and it is why the spec is trustworthy where a discretisation would not be.

**So Aaron's "imaginary numbers come from the difference between evidence and observation" does have
a home in existing verified work** — just not the home the conjecture proposed. ℂ is real in the
quorum layer, where someone put it there deliberately and Soraya verified what it buys. It is
decoration in the belief fold. §2's algebraic checks stand unchanged: neither layer derives ℂ *from*
the evidence/observation gap.

### 6.2 Which decoherence literature does metered noninterference actually match? **Neither — and the near-miss is the finding**

There are two named literatures, and the temptation is to claim the passive one:

- **Dynamical decoupling** — *active*: pulse sequences that time-average the system–environment
  coupling to zero (Viola & Lloyd 1998; Viola, Knill & Lloyd 1999).
- **Decoherence-free subspaces** — *passive*: encode in a subspace the environment cannot
  distinguish, so there is nothing to decohere (Zanardi & Rasetti 1997; Lidar, Chuang & Whaley 1998).

**Mechanism class: ours is passive**, clearly. A metered membrane applies no corrective pulses; it
constrains which channels exist. So it is not DD.

**But it is not a DFS either, and the reason is worth stating precisely, because it is the difference
between an anchor and an over-claim.** A DFS is defined by a **symmetry of the coupling operators**
that makes the system–environment interaction act as a multiple of the identity on a subspace. The
environment is still there and still couples; it simply **cannot distinguish** states inside the
subspace. Our metering asserts something different in kind: **that the channel list is complete** —
there is no *undeclared* environment at all. Those are not the same condition, and neither implies
the other.

> **The honest match is not a decoherence-avoidance technique. It is the closed-system idealisation
> that DD and DFS both exist to approximate.** Metering is an attempt to make that idealisation
> *true by construction* rather than *approached asymptotically*.

That is a **weaker** claim than "definition match with DFS" and a **more interesting** one, because
it is falsifiable in our own terms: the idealisation holds exactly as far as the channel enumeration
is complete, and completeness is auditable. Every ambient clock, allocator, or `Task.Run` leak is a
counterexample — which is precisely why the `async-all-the-way` and
`local-time-never-enters-the-shared-fold` rules exist. **Zurek's einselection / quantum Darwinism**
is the third literature and is about how an environment *redundantly records* pointer states; it is
the right frame for "which quantities a given observer can reconstruct", and it is not what a
membrane provides.

**Register: `toy`.** No falsifier has been run on the DFS/closed-system correspondence, and none is
proposed here.

### 6.3 "How far can you stretch one AI instance" — a real referent, and NO decoherence term

Confirmed and stated so it cannot be over-read: there is **no established "coherence AI" term**, and
I am not coining one. What is actually studied is **collective-communication cost** in tensor /
pipeline / expert parallelism — all-reduce latency, interconnect domain boundaries, the step-time
budget. In this repo the terms `NCCL` and `all-reduce` appear in exactly **two** files, both a
backlog row and its PR-review archive (`081KT2T2J0008QG0R003BT1RS7`, distributed tensor inference
over sharded factor graphs) — so there is no in-repo work to build on, and no term to borrow.

The honest statement, with no physics in it: **a sharded model is one instance exactly while the
synchronising collective completes inside the step cadence, and is two things when it does not.**

### 6.4 The ρ = 1/(1+L) connection — **I could not settle it, and the reason is the useful part**

The formula is real and in-repo: `ρ(L) = 1/(1+L)`, from `DelayDecorrelation` /
`docs/research/2026-07-16-echolocation-debounce-and-the-real-sensor-fusion-proof.md`, with
`DebouncedOracle.MinDelay` as the shipped `L`. The proposal — that interconnect latency *is* the `L`,
making "how far can you stretch one instance" a measurement rather than a metaphor — is attractive
and I think worth pursuing.

**It is not checkable as stated, and here is the blocker:** `1/(1+L)` requires `L` to be
**dimensionless**, and the source table gives `L` in *"ticks, seconds, or any monotonic unit."* Those
are not interchangeable. With the unit free, **any** latency number can be made to fit by choosing
the unit — which is exactly the Titius–Bode failure mode `numerology-vs-number-theory` names: a
formula that fits beautifully and never found its structure.

> **So the falsifier "the fitted `L` from published multi-node inference numbers should *track* the
> formula, not merely correlate" cannot yet be run — because the formula has a free scale, and a free
> scale makes tracking unfalsifiable.** What must be fixed first is the **normalisation**: `L` has to
> be expressed relative to a stated reference interval (the step cadence is the natural candidate, and
> it is the one quantity the parallelism literature actually publishes). Fix that, and the claim
> becomes falsifiable in one afternoon against vendor numbers.

**This is an instance of the demarcation being undrawable, which §6's own frame says is the most
valuable result available here.** The quantity "is a sharded model one instance" is *not currently
measurable* by our meter, not because the physics is hard but because our own formula has an
unfixed unit. That belongs on the not-measurable-here side of the line until the normalisation is
stated — and saying so is the meter working, not failing.

## 7. Anchors (Beacon)

- **Frobenius (1878)**; **Hurwitz (1898)** — ℝ, ℂ, ℍ, 𝕆 are the only normed division algebras; ℂ is
  the unique 2-dimensional one. This is the theorem doing the excluding in §2.4.
- **Jordan / Hahn decomposition** (measure theory) — `μ = μ⁺ − μ⁻`, the seen/unseen split that our
  fold actually has, with a **ℤ/2** hidden part.
- **Tsirelson (1980)** — `S ≤ 2√2`, the correlator bound §5 keeps distinct from the design constant.
- **Zurek (1991, 2003)** — decoherence as uncontrolled environment coupling, einselection and quantum
  Darwinism; the physics §5's strong version would need and does not have, and the right frame for
  "which quantities can this observer reconstruct" (§6.2).
- **Viola & Lloyd (1998)**; **Viola, Knill & Lloyd (1999)** — dynamical decoupling (the *active*
  technique our metering is **not**).
- **Zanardi & Rasetti (1997)**; **Lidar, Chuang & Whaley (1998)** — decoherence-free subspaces (the
  *passive* one, whose defining symmetry condition our metering also does **not** satisfy — §6.2).
- **Goguen & Meseguer (1982)** — noninterference; manifesto §13's actual anchor.
- **Peyton Jones & Wadler (1993)** — imperative functional programming / the `IO` monad; the exact
  reference for "all effects declared at the type level".

**Provenance:** math-shape correspondences only. Math grounds validity; physics grounds the metering,
by analogy. Nothing here is evidence that physics proves our system.

## 8. Reproduce

```bash
bun src/Core.TypeScript/research/belief-fold-destructive-interference-falsifier.ts
```

Row F is the control: it must report 50 000/50 000 or row E1's zero means nothing.

## 9. Pointers

- `src/Core/BeliefConvergence.fs` — `observe`, the fold that was measured.
- `src/Core/AmplitudeEmu.fs` · `src/Core.QSharp.ReferenceOracle/ZSetISA.qs` · `src/Core/WSet.fs`
  (`bornProb`) — the lane where ℂ genuinely lives, by construction.
- `docs/research/2026-07-04-braided-monoid-amplitude-emulation-more-than-bayesian-aaron-corrects-the-bell-peel.md`
  — read first; the shadow's earlier over-peel and its retraction, plus the Tsirelson caveat.
- `docs/cross-verify/2026-06-19-zset-isa-vs-amplitude-emu-cross-check.md` — the operator-by-operator verification.
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — the hidden-quantity rule §4 keeps as a `toy` analogy.
- `src/Core.TypeScript/hygiene/lint-tsirelson-constant-caveat.ts` — the enforcer of §5's caveat.
- Sibling: `docs/research/2026-08-24-wset-carries-the-bnn-and-the-factor-graph-*.md` §4 — where ℝ→ℂ *does* get a measured meaning.
