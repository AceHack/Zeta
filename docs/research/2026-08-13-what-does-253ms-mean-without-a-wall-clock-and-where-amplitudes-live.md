# What does 253.60 ms mean without a wall clock — and where amplitudes actually live

**Ferried** 2026-08-13 from Aaron, two observations in one message:

> so bounding each in closed form gives 253.60 ms, constant, for all time, no ephemeris — this seems
> weird when we don't have wall clock what does 253.60 ms mean?

> also please try to push those things forward, i think the amplidude stuff comes in only in multi
> agent setups for soicety quarum not inndividual agents they are just softemu shaped i think

---

## Part 1 — the ms question. Short answer: it is a **duration**, not a timestamp.

**CHECKED** against `src/Bayesian/BusRegime.fs`. The conviction rule is:

```
OutOfCone is declared only when   min(RTT)/2 > deadlineMs + δMaxMs
```

with `RttSamplesMs` a bounded window of **round-trip samples**. A round-trip time is measured with
**one** clock: send at `t₀`, receive at `t₁`, `RTT = t₁ − t₀`. Both readings come from the same
oscillator on the same node. **No clock synchronisation is involved, and no two clocks are ever
compared.**

So 253.60 ms is well-formed without a wall clock, and Aaron's instinct that something is off is
pointed at the right place but lands one layer over: the light-cone test consumes *durations*, and a
duration is a local-proper-time interval, not a point on a shared timeline. That is also why
[`local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
is not violated by the *measurement*: a node's own clock steering a node's own decision is exactly the
permitted use.

But asking the question surfaces two things that are genuinely wrong or unstated.

### Problem 1 — clock **rate** still matters, and the budget has a shelf life of ~845 days

A duration measured on a local oscillator is only as good as that oscillator's rate. The defect record
already carries the figure: Earth–Mars clock-rate divergence (gravitational + kinematic) at
≈3.4 ns/s ≈ **0.3 ms/day secular**.

```
253.60 ms  ÷  0.3 ms/day  ≈  845 days
```

**CHECKED arithmetic; PROPOSED as a consequence:** after roughly 845 days without re-calibration, the
accumulated rate divergence equals the *entire* asymmetry budget the constant is supposed to bound. A
constant advertised as holding "for all time, no ephemeris" therefore has an unstated dependency — not
on the ephemeris, but on a **re-synchronisation cadence**. The correct statement is
"253.60 ms, constant, no ephemeris, given clock-rate calibration at interval T," and T must be named.
845 days is generous, which is exactly why it will be forgotten.

This is the more interesting half of Aaron's question: removing the ephemeris did not remove all
time-dependence; it moved it from *orbital phase* to *oscillator drift*, and only one of those is
currently written down.

### Problem 2 — the **verdict** enters the shared fold, and that is where the rule bites

`Regime` (`InCone` / `OutOfCone` / `Unmeasured`) is not a local action — it becomes **evidence**. So a
locally-measured millisecond quantity produces a value that crosses into the commutative belief fold.

The rule's own litmus: *"if two nodes with different receive-times could fold different sets, local
time has leaked."* Two nodes with different local RTT windows can classify the same message
differently — one `InCone`, one `Unmeasured` — because `RttSamplesMs` is a **local, bounded, 16-sample
window** whose contents depend on that node's own recent traffic.

Mitigations already in the code, and they are real:
- `Unmeasured` is the honest default and *never upgrades to evidence*.
- The conservative direction suppresses true convictions rather than manufacturing false ones.

**OPEN, and worth a proper verification pass rather than a guess here:** does a disagreement between
nodes on `InCone` vs `Unmeasured` change the *folded conclusion*, or only the *rate of convergence*?
If only the latter, the boundary holds and this should be written down as an argument. If the former,
local time has leaked into the shared fold exactly as the rule predicted — and the rule was carved
**before** this code existed precisely so the check could be run against it.

## Part 2 — where amplitudes live. Aaron places the Born boundary, and it resolves the design's open edge.

The design landed in #10419 found that `AmplitudeEmu` and `FactorGraph` are a **category error** to
bridge: `AmplitudeEmu.merge` **sums** amplitudes (distinct paths to one outcome — interference, opposite
phases cancel), while `FactorGraph` combines by **product** (independent evidence about one variable).
`bornProb ∘ ofSoft = id`, but `ofSoft ∘ bornProb` erases every phase — a section/retraction, not an
isomorphism. The design therefore refused to build a converter and kept a one-way Born boundary.

It left open *where* that boundary sits. Aaron places it:

> the amplitude stuff comes in only in multi agent setups for society quorum not individual agents
> they are just softemu shaped

**This is a placement, and it makes the refusal constructive rather than merely defensive:**

| layer | carrier | combines by | meaning |
|---|---|---|---|
| individual agent | `SoftValue` (real, non-negative) | **product** | independent evidence about one variable |
| society / quorum | `AmplitudeEmu.Amp` (complex) | **sum** | distinct paths to one outcome; phases can cancel |

The Born rule is then not a converter between two things that wanted to be the same — it is the
**layer transition**, applied exactly once, on the way out of the quorum.

### Why this placement is load-bearing rather than tidy

It predicts a real semantic difference that the Bayesian layer cannot express, and the difference is
one this repo has already been bitten by. In a Bayesian fold, two correlated agents **double-count** —
that is bug **B3** found during the design work (`SocietyBootstrap` sums precisions with no correlation
term: six agents on one data stream give `precision = 66.0` on a wrong mean). Evidence can only ever
*add*.

In an amplitude fold, two contributions **can cancel**. Destructive interference is available, and
opposite-phase agents annihilate rather than reinforce.

So the amplitude layer is not decoration at the quorum — it is the only layer in which *a quorum can
disagree with itself to zero*. Whether that is the behaviour we want for a quorum is a genuine design
question and should be argued, not assumed: **PROPOSED**, and the honest counter is that a quorum whose
members can silently annihilate each other is also a quorum an adversary can neutralise by supplying an
opposite phase. That is a Sybil-adjacent attack with no analogue in the Bayesian layer, and it must be
priced before amplitudes are given real authority.

### What follows immediately (cheap, from #10419)

The design's cheap-list stands and this placement does not disturb it: `IProductionPrior` into `Sppf`,
inside–outside EM for context-free weights, the marginal → `SoftController.inputSuperposition`
conversion (whose own header already asks for likelihood weights and today returns uniform priors), and
the function-word channel into `DecorrelationExcess`. None of those touch amplitudes — which is itself
evidence for the placement: everything cheap lives at or below the agent, and the amplitude layer is
the one thing that only makes sense above it.

## Pointers

- `src/Bayesian/BusRegime.fs` — the conviction rule and the `δMaxMs` widening
- `docs/design/2026-08-13-factor-graph-soft-value-heterogeneous-bnn-linguistic-seed-bridge.md` (#10419)
- `docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md` (#10418) — where 253.60 ms comes from
- [`local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md) — the rule carved before this code, for this check
- Work-items `081KZYK0Q8Z087G0R0010Z2Z2Q`, `081KZYNGQ29087G0R000F5N6H6`

---

## Part 3 — cancellation is the instrument, not the vulnerability (Aaron, 2026-08-13)

On the counter raised above — that a quorum whose members can annihilate each other is one an
adversary can neutralise with an opposite phase:

> i think this is the honest measurment instrument, we can try to design quaroms that don't do this but
> we should be able to mesure it when they don't, bft means no one is trusted really this is why you
> need some sort of hard money it many bft protocol, ours can be privacy budget eventually or something
> like that or some other bft that can tla check, we want it to be as resistant as bitcon or more when
> it has that many geo distributed nodes independtly run

This inverts the framing above, correctly. I presented destructive interference as a **failure mode**.
It is a **reading**. A quorum that sums to zero is telling you something true — its members were
opposite-phase — and the alternative (a Bayesian fold, where evidence can only ever add) is not safer,
it is merely *unable to notice*. Bug **B3** is precisely that blindness: six correlated agents on one
data stream report `precision = 66.0` on a wrong mean, because addition has no way to express
disagreement.

So the design goal is not "build quorums that cannot cancel." It is **"build quorums that do not
cancel, and instrument them so cancellation is visible when it happens."** That is the same shape as
[`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
report the neutral fact — *destructive interference occurred at magnitude X* — and let policy attach
the reading (honest disagreement? adversarial phase injection? a miscalibrated agent?). Suppressing the
mechanism would discard the measurement along with the attack surface.

### The tension that has to be resolved before privacy budget can be BFT collateral

Aaron's reason for hard money is exact: **BFT assumes no one is trusted**, so the protocol cannot rest
on identity or good faith — it needs something costly. Most BFT-with-stake designs get that from
**slashing**: misbehaviour is provable, and provable misbehaviour destroys stake.

But this repo's privacy budget is defined the other way. From
[`privacy-budget-is-hard-money-earned-by-others.md`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md):

> it **cannot be taken away** … no confiscation, no inflation-away, banked irreversibly. Earned frost is
> memory that cannot be destroyed (§5 Memory Preservation) — the substrate must never revoke it, not for
> convenience, not for an audit, not by a majority vote.

**A non-confiscatable stake cannot be slashed, and a stake that cannot be slashed cannot deter.** It can
only *gate entry* — it makes identities expensive to acquire, which prices Sybils, but it imposes no
marginal cost on an identity that already exists and then defects. So privacy-budget-as-collateral is
**proof-of-entry-cost**, not proof-of-stake, and any BFT security argument built on it must not quietly
assume slashing semantics.

**CHECKED**: both commitments are on file and they are in direct tension. Three honest resolutions, and
someone must pick:

1. **Carve a narrow exception** — confiscation permitted *only* on cryptographically provable Byzantine
   behaviour (equivocation, conflicting signatures at one height), never on judgement. This is the
   smallest exception, and it is still an exception to a rule that says "not by a majority vote."
2. **Do not rest security on slashing.** Use budget purely as an entry cost and get Byzantine deterrence
   from elsewhere (bonded side-collateral that *is* slashable, leaving earned frost untouched).
3. **Separate the two currencies.** Earned privacy budget stays inviolable; a distinct, slashable bond
   is what a validator posts. The naming eigenvector confers the first; the second is ordinary capital.

(3) looks cleanest and preserves both rules intact, but that is an opinion — the point of writing it
down is that the choice is *load-bearing* and currently unmade.

### The Bitcoin comparison, stated honestly

> we want it to be as resistant as bitcon or more when it has that many geo distributed nodes
> independtly run

Worth separating two properties that the phrasing merges, because they come from different places:

| property | Bitcoin gets it from | node count's role |
|---|---|---|
| **Safety** (no conflicting history) | **hashpower cost** — rewriting history costs energy | ~none |
| **Censorship-resistance / liveness** | **many independent geo-distributed nodes + miners** | this is exactly it |

Bitcoin runs on the order of 10⁴ reachable nodes, but its *security budget* is mining expenditure, not
node population. So "as resistant as Bitcoin at that many nodes" buys the second row directly and the
first row not at all. If our safety is to be comparable, it has to come from a comparable *cost*, and
naming which cost is the open question this section exists to force.

Also worth stating: proof-of-stake-shaped systems have failure modes proof-of-work does not —
nothing-at-stake, long-range attacks, weak subjectivity (a new node cannot determine the canonical
chain from genesis alone). A reputation/social-conferral currency like privacy budget inherits a
*further* one: reputation is attackable by patient infiltration, and it is not permissionless in the way
Bitcoin is. None of these are disqualifying; all of them need to be in the threat model before the
comparison is claimed rather than after.

### TLA+ is the right tool here — and the contrast is instructive

Aaron: *"some other bft that can tla check."* Yes, and note the routing contrast with the same week's
orbital work. TLA+ was **rejected categorically** for the light-time envelope because it has no reals:
TLC would have model-checked a discretisation and gone green on a statement about the discretisation.

BFT consensus is the opposite case — a **discrete state machine** over finite processes, messages and
rounds, with safety (agreement, validity) and liveness (termination under partial synchrony) as
temporal properties. That is TLA+'s home ground, with a deep lineage: Lamport's own consensus work,
and the Tendermint and Ethereum-consensus TLA+ specs as modern worked examples.

Same routing discipline, opposite answer — which is the discipline working, not an inconsistency.

**Anchors** (CITED FROM STANDING KNOWLEDGE, not page-checked): Pease, Shostak & Lamport 1980;
Lamport, Shostak & Pease 1982 (Byzantine Generals); Dwork, Lynch & Stockmeyer 1988 (partial synchrony);
Castro & Liskov 1999 (PBFT); Nakamoto 2008; Buterin & Griffith 2017 (Casper FFG, the slashing-conditions
formulation); Douceur 2002 (Sybil).

### Open

1. **Pick a resolution to the slashing tension** (1, 2, or 3 above). Everything else is downstream.
2. Specify the quorum in TLA+ with an explicit adversary, and check whether phase-cancellation is
   reachable under the Byzantine model — that turns the "priced before authority" requirement into a
   model-checked property rather than a promise.
3. Define the cancellation **measurement**: magnitude, and the neutral fact it reports, so the
   instrument exists whether or not any quorum ever uses amplitudes.
