# Routing + results: BFT collateral, the slashing tension, and phase cancellation

**Soraya, 2026-08-13.** Routing verdict first, then twelve TLC runs with real numbers,
then what each option costs. Companion to
`docs/research/2026-08-13-what-does-253ms-mean-without-a-wall-clock-and-where-amplitudes-live.md`
(#10424) Part 3, and the deliberate contrast case to
`docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md` (#10418).

**Nothing here picks a resolution.** Aaron said "lets not decide yet"; the job is to make
each option's consequences legible, and the table in section 3 is that and only that.

---

## 0. Verdict, up front

| question | verdict |
|---|---|
| Is TLA+ right for BFT consensus / collateral? | **CONFIRMED.** Discrete, finite, temporal. Home ground. |
| Is TLA+ right for the amplitude/phase half? | **PARTIALLY REFUTED.** Phase is real-valued. Usable only as an adversary *restriction*, and only reachability results transfer. |
| Do the resolutions differ in Byzantine tolerance? | **NO** — identical, f LT n/3, all four. The framing in my brief was wrong and the model says so. |
| Where do they differ? | **Repeatability, seizure, and compulsion.** Three checked properties, four different signatures. |
| Is phase cancellation reachable? | **YES with f = 1** if amplitudes are unnormalised. **NOT reachable with f = 1** under equal magnitude caps. No 1/3 threshold anywhere. |
| Is cancellation distinguishable from honest disagreement? | **NO**, when honest members may carry opposite phases and the honest count is even. Counterexample trace below. |
| Are `src/Core.TLA/specs/` gated? | **Partially — and the gap is the same defect class as #10429.** Default `.cfg` files are gated via `dotnet test`; every non-default `.cfg` is not, including `BftLiveness.cfg`. |

---

## 1. Routing, and why the answer is different for the two halves

### 1a. The collateral half — CONFIRMED, and the reasoning is not "it feels discrete"

The brief asserted BFT consensus is a discrete state machine over finite processes, messages
and rounds with safety and liveness as temporal properties, and that this is TLA+ home ground.
**Confirmed.** The load-bearing part is that nothing in the model requires a real number:
identities are a finite set, signatures are a finite relation, quorum is integer counting, and
the properties are state and temporal predicates. There is no quantity that has to be rounded,
so there is no discretisation to accidentally verify instead of the thing.

The wrong-tool cost, named: had this gone to Z3 as a set of arithmetic lemmas about quorum
sizes, it would have proved the counting facts (which are true and easy) and been unable to
express *reachability* — and reachability is where the entire result lives. `NoRepeatAttack`
is a statement about what an adversary can get to over two epochs. An SMT lemma about
`2(2F+1) - (3F+1) = F+1` cannot say it, and would have looked like a complete answer.

### 1b. The amplitude half — PARTIALLY REFUTED, and this is a finding

**An amplitude is a complex number and a phase is a real angle. TLA+ has no reals.** Handing
the cancellation question to TLC as-is would model-check a discretisation of the phase circle
and go green on a claim about the discretisation — precisely the failure that got TLA+
rejected *categorically* for the light-time envelope in #10418.

So the phase set in `QuorumPhaseCancellation.tla` is **not a discretisation**. It is a
**restriction of the adversary** to the 4th roots of unity, which makes every amplitude a
Gaussian integer and every sum exact. No rounding exists to be wrong about. The price is that
results travel in one direction only:

- **Reachability transfers UP.** A restricted adversary is a special case of the general one,
  so a witness found here is a witness against arbitrary real phases. **Every VIOLATION this
  module reports is sound for the real model.**
- **Non-reachability does NOT transfer.** The general adversary has strictly more phases. A
  green result means "not reachable using axis-aligned phases at this magnitude cap" and
  nothing else. It must never be read as a safety result.

Every claim in section 4 is therefore stated in the reachability direction, and the one
general-phase claim I do make (the magnitude bound) is flagged as **routed to Z3 or Lean, not
proved here** — it is the triangle inequality over the reals, which is what those tools are
for and this one is not.

**So the brief's routing call was right for one half and wrong for the other, in the same
task.** That is the discipline working: the tool follows the property, not the project.

### 1c. What was rejected, and why

| considered | rejected because |
|---|---|
| Extend `BftConsensus.tla` in place | Its 4.6M-state network model would multiply against the collateral variables. The message layer is already discharged; re-deriving it is waste. **Decomposed instead** — this is the same call `BftSybilConsensus.tla` made for the Sybil threat. |
| One spec for everything | Collateral, ruin and phase are three state machines over disjoint variables. Fusing them multiplies three state spaces to re-derive results each already has. Three specs, each small enough to check exhaustively. |
| Alloy for the collateral layer | Bounded finite-model finding would give the same witnesses, but the *temporal* properties (`NoSeizure` as an action property, `Deterrence` as leads-to) are exactly what Alloy is weakest at. TLA+ carries both in one module. |
| Z3 for the impossibility result | Would have proved the arithmetic and missed the reachability. See 1a. |
| FsCheck property tests | No adversary model. Random inputs do not find a two-epoch attack that requires a specific equivocation-then-settle interleaving. |

---

## 2. The correction that matters most: slashing does not change Byzantine tolerance

My brief asked what fraction of Byzantine power each resolution tolerates, expecting the
resolutions to differ. **They do not, and the reason is structural rather than a modelling
artefact.**

TLC explores **worst-case** behaviour. A Byzantine identity in this model defects whether or
not defecting is profitable. Slashing is an **incentive** mechanism, and incentives are
invisible to a worst-case adversary. So no amount of collateral design moves the threshold:
safety holds at f LT n/3 and fails above it, identically in all four regimes.

**CHECKED**, both directions:

- `QuorumCollateralThreshold.cfg` (Byzantine = 1 = F, N = 4): `SafetyAtThreshold` HOLDS.
  25,852 distinct states, depth 18, 0 left on queue.
- Non-vacuity of that green, because a conditional invariant whose antecedent is a constant
  is exactly the 2026-08-10 audit defect: `QuorumCollateralThresholdWitness.cfg` runs
  `NoFinalisationEver` on the same config and it is **VIOLATED** at depth 8 — finalisation
  really happens, so the invariant is not green for the boring reason.

So "what fraction does each tolerate" was the wrong question, and asking it of TLC would have
produced four identical greens and an apparent conclusion that the choice does not matter.

**The right question is whether the tolerance is RENEWABLE.** The instantaneous threshold is
fixed; what differs is whether an adversary still has it after spending it once. That is
`NoRepeatAttack`, and it discriminates sharply.

---

## 3. The four resolutions, measured

All runs: N = 4 identities (2 honest, 2 Byzantine), F = 1, quorum 2F+1 = 3, 2 values, 2 epochs.
Byzantine is deliberately set to **2, above the F = 1 the quorum is sized for**, so that a
safety violation is reachable and the collateral machinery has something to respond to.

| | R1 narrow exception | R2 no slashing | R3 separate bond | **R4 voluntary wager** |
|---|---|---|---|---|
| `AccountableSafety` | HOLDS | HOLDS | HOLDS | HOLDS |
| `SafetyAtThreshold` | HOLDS | HOLDS | HOLDS | HOLDS |
| **`NoSeizure`** | **VIOLATED** | HOLDS | HOLDS | **HOLDS** |
| **`Deterrence`** | HOLDS | **VIOLATED** | HOLDS | **HOLDS** |
| **`NoRepeatAttack`** | HOLDS | **VIOLATED** | HOLDS | **HOLDS** |
| **`NoCompulsion`** (no free arena) | **VIOLATED** | HOLDS | VIOLATED | **VIOLATED** |
| distinct states | 234 | 41,004 | 39,071 | 49,674 |

TLC output, verbatim where it matters:

- **R1** — `Error: Action property NoSeizure is violated.` Depth 6. The trace is
  `ByzantineSign("b1","reject")` then `Slash("b1")`, taking `budget[b1]` from 1 to 0. That is
  confiscation, and it is R1 working as designed rather than a bug.
- **R2** — `Error: Invariant NoRepeatAttack is violated.` 41,004 distinct states, depth 18.
  The same two identities produce a conflicting finalisation at epoch 1 and again at epoch 2
  with collateral untouched. Also `Error: Temporal property Deterrence was violated` under
  `FairSpec`.
- **R3** — `Model checking completed. No error has been found.` 39,071 distinct states, depth 17.
- **R4** — `Model checking completed. No error has been found.` 49,674 distinct states,
  depth 21, including `Deterrence` under `FairSpec` (5s).

### 3a. R4 is not a fourth proposal — it is the rule as it currently stands

`privacy-budget-is-hard-money-earned-by-others.md` was amended 2026-08-09 with exactly this
split, and it is worth quoting because it settles the question of whether R4 needs an exception
carved for it:

> **Spend** (the owner frosts a region) - **stake** (the owner risks it on an attestation) -
> **confiscate** (anyone else - *never*).

So the rule already permits the wager. **R4 requires no amendment to anything.** That is its
whole advantage over R1, and it is why `NoSeizure` holds for it: the property is written as a
*conservation* condition (budget may leave an identity only into that same identity's own
at-risk pot), not as naive monotonicity. Naive monotonicity would have flagged a dweller's own
wager as a violation, which gets the rule backwards — the rule forbids seizure, not spending.

### 3b. The impossibility, stated at its true strength and no higher

`NoSeizure` and `Deterrence` asserted over a **single** currency cannot both hold: R1 buys the
second by giving up the first, R2 keeps the first by giving up the second. R3 and R4 satisfy
both, and each does it by having **two places for value to be** — R3 two currencies, R4 one
currency in two states (held and wagered).

**Honesty, because this is where the result could be oversold:** once formalised, the
single-currency impossibility is close to a tautology. One integer cannot both never-decrease
and decrease. The spec does not *discover* it. What it does is force both properties into one
state space where the collision is mechanical rather than rhetorical, and then show that the
two-place assignments discharge both with nothing else changed. That is a smaller claim than
"proved", and it is the true one.

### 3c. The finding I did not expect: slashing strands the slashed

`NoCompulsion` says every identity can participate somewhere — either it is eligible for the
staked arena, or a free arena exists. Run with `FreeArenaOpen = FALSE`:

- **R4**: VIOLATED **at the initial state** — nobody has staked yet, so nobody is eligible.
  Real, but a weak trace; it says only that R4 needs somewhere to stand before anyone wagers.
- **R1**: VIOLATED **at depth 6**, and this one is not trivial. The counterexample is
  post-slash: `b1` has been penalised to zero budget, budget gates participation, and `b1` can
  now participate nowhere at all.

**So the two-arena structure is not R4 scaffolding.** ANY regime that gates participation on a
burnable asset needs it, because a slashed identity ends up in exactly the position of one that
declined to stake. R1 and R3 need the free arena as much as R4 does.

This connects directly to the rule's own guard, added the same day as the staking clause:

> a stake must never be *required* to hold a role or to participate - that would be coercion
> wearing a wager's clothes.

`NoCompulsion` is that sentence in checkable form. Under `FreeArenaOpen = FALSE` every
slashing regime violates it. **That is a mechanical check of an existing rule clause failing,
not a new proposal.**

### 3d. Falsifiability — every green above was shown able to go red

A green invariant proves nothing until it has been shown it CAN fail. Both mutations run
against the exact configs above:

| mutation | result |
|---|---|
| `QuorumSize == F + 1` (quorum undersized) | `SafetyInvariant` **VIOLATED**, depth 10, 6,812 states. So `AccountableSafety` genuinely depends on 2F+1 quorum intersection, and is not pigeonhole about the representation. |
| R4 `Slash` burns nothing (`= @` instead of `= 0`) | `NoRepeatAttack` **VIOLATED**, depth 24, 75,132 states. So R4's green depends on the stake actually burning, not on model structure. |

And the reachability witnesses, run with EXPECT VIOLATION, because `NoRepeatAttack` green would
be worthless if no attack were reachable at all:

| witness | result |
|---|---|
| `NoFinalisationEver` | **VIOLATED** depth 8 — quorums do finalise. |
| `NoConflictEver` | **VIOLATED** depth 13, 19,463 states — a conflicting finalisation IS reachable at one epoch under R4. |

That last one is the load-bearing one: **R4 tolerates one attack and blocks the second.** Not
"no attack was ever possible".

---

## 4. Phase cancellation — reachable, and NOT distinguishable

`src/Core.TLA/specs/QuorumPhaseCancellation.tla`. Read section 1b first; a VIOLATION below is
sound for the real-phase adversary, a green result is not.

### 4a. Is full cancellation reachable, and at what f?

| config | honest phases | magnitude caps | result |
|---|---|---|---|
| `QuorumPhaseCancellation.cfg` | 0 only | honest 1, Byzantine 1 | `NoFullCancellation` **HOLDS**. 48 states. |
| `QuorumPhaseUnnormalised.cfg` | 0 only | honest 1, Byzantine **3** | `NoFullCancellation` **VIOLATED**. 112 states, depth 5. |

The violating trace, verbatim:

```
m1 = <<1, 0>>,  m2 = <<1, 0>>,  m3 = <<1, 0>>,  m4 = <<-3, 0>>
```

**One Byzantine member annihilates a three-member honest quorum.** f = 1 suffices, and by the
reachability-transfers-up argument this is sound against arbitrary real phases.

**So phase cancellation has no 1/3 threshold. It has an AMPLITUDE-BUDGET threshold.** With
per-member magnitude capped equally, an adversary needs as much amplitude as the entire honest
quorum, which is a *majority* condition and therefore strictly harder for the adversary than
the consensus threshold. With magnitude uncapped, the tolerance collapses to f = 1 regardless
of quorum size.

**Design consequence, and it is concrete:** normalise per-member contribution before the
amplitude layer is given any authority. Without normalisation, adopting amplitudes at the
quorum drops Byzantine tolerance from f LT n/3 to f = 1. That prices the "must be priced
before amplitudes get authority" requirement from #10424 with an actual number.

**ROUTING, stated rather than smuggled:** the general-phase form of the capped claim is the
triangle inequality over the reals, and TLC did not prove it. That belongs in **Z3 or Lean**
and is filed as such. What TLC establishes is the uncapped violation, which is the direction
that transfers.

### 4b. Is it distinguishable from honest disagreement? No.

`CancellationImpliesByzantineContributor` asks whether every full cancellation has at least one
non-zero Byzantine contributor.

| config | honest count | result |
|---|---|---|
| `QuorumPhaseHonestSplit.cfg` (3 members, 2 honest) | **even** | **VIOLATED**, depth 4 |
| `QuorumPhaseOddParity.cfg` (4 members, 3 honest) | **odd** | HOLDS, 162 states |

The violating trace:

```
m1 = <<-1, 0>>,  m2 = <<1, 0>>,  m3 (Byzantine) = <<0, 0>>
```

Two honest members holding opposite hypotheses cancel exactly. The Byzantine member contributes
nothing. **The resultant is identical to an adversarial annihilation and the instrument cannot
tell them apart.**

Two things worth being precise about:

1. **Watching harder does not help.** The counterexample survives FULL per-member visibility,
   because the honest and adversarial contributions are the *same values*. No amount of
   observation separates them. Only a constraint on honest phase does — which is a design
   choice about whether phase carries meaning, not an instrumentation problem.
2. **The odd-count green is a parity artefact, not a result.** With unit magnitudes and an odd
   honest count, the honest sum is odd and can never be zero, so any cancellation needs a
   Byzantine contribution. That is arithmetic about this configuration, and it evaporates the
   moment magnitudes vary. **Do not build on it.** Reported because it is what TLC actually
   found, and suppressing it would be worse.

### 4c. What this does to the framing, which was right

The model supports the framing and sharpens it. Cancellation is a real, reportable fact, and
forbidding the mechanism would discard the measurement along with the attack surface. But the
fact has **two readings and no way to separate them from the observation**, so under
`dual-use-detection-is-neutral-oracle-decides` the instrument may report it only as the neutral
fact — destructive interference occurred at magnitude X — and **the ambiguity must be stated,
not silently resolved.** `CancellationImpliesByzantineContributor` is that statement in
checkable form, so the ambiguity cannot quietly go missing when someone later builds policy on
top of it.

---

## 5. The subsistence floor, socialised loss, and the solvency contradiction

`src/Core.TLA/specs/WagerSolvency.tla`. From Aaron:

> i think we can have a split between necessary funds and fun money, fun money you can afford
> to loose and still survive without depending on others for subsdity

### 5a. The split has an exact anchor

**Kelly 1956**: wager a fraction of bankroll proportional to edge; wager the whole bankroll and
ruin is certain. Under log utility, utility goes to minus infinity at zero wealth — so the
subsistence floor is the point where the objective becomes **undefined**, not a point where
someone judged the risk uncomfortable. "Fun money you can afford to lose" is the Kelly fraction
turned into a hard boundary rather than an optimum. **CITED FROM STANDING KNOWLEDGE, NOT
PAGE-CHECKED.**

### 5b. The ruin condition is social, and that is what makes slashing bite

If a dweller can wager into a position where the society must carry them, the stake was never at
risk — it was **socially insured**, and socially-insured stake does not deter. Upside kept,
downside mutualised.

**So the necessary/fun split is not a comfort feature bolted onto the wager. It is the
precondition that makes voluntary staking a real risk rather than a free option.** CHECKED:

| config | `StructuralSplit` | result |
|---|---|---|
| `WagerSolvency.cfg` | TRUE | `NoSocialisedLoss` and `FloorUnwagerable` **HOLD**. 324 states, depth 9. |
| `WagerSolvencyNoSplit.cfg` | FALSE | `SafetyInvariant` **VIOLATED** — `d1` wagers past its fun money into necessary funds, `necessary[d1]` drops 2 to 1, below the subsistence floor of 2. |
| `WagerSolvencyWitness.cfg` | TRUE | `NoLossEver` **VIOLATED** — losses are reachable, so the green above is not vacuous. |

The option this supports, without picking it: make the floor **structurally unwagerable**
(rung 1 — a wager against necessary funds is *unrepresentable*, because the guard reads only the
fun pool) rather than merely discouraged. In the spec that is literally the difference between
the two branches of one `IF`, and it is the difference between a green and a red run.

### 5c. The privacy/solvency contradiction is real, and it has a named cost

The stated goal is that budgeting and solvency stay behind privacy budget. A BFT counterparty
must know a validator stake is real. **You cannot have both from plain balances.** CHECKED:

- `WagerSolvencyPhantom.cfg` (`SolvencyProofSound = FALSE`): `NoPhantomStake` **VIOLATED** — an
  identity publishes a solvency claim it cannot back.

The resolution is not a compromise between the two goals, it is a **construction**: a proof of
solvency that reveals no balance — proof-of-reserves plus a ZK range proof. **Anchors: Maxwell
proof-of-reserves; Bulletproofs, Bunz et al. 2018. CITED FROM STANDING KNOWLEDGE, NOT
PAGE-CHECKED.** Naming it turns "keep balances private" from a wish into a requirement with a
known implementation cost.

### 5d. The self-reference, and it is not benign

Privacy budget is the currency, the thing wagered, **and** the thing that buys the frost hiding
the balance. So an attestation can go stale through the owner own later actions. CHECKED:

- `WagerSolvencyStaleAttestation.cfg`: `NoPhantomStake` **VIOLATED**. `d1` attests truthfully at
  total 4 against a threshold of 4, then the wagered unit is lost and total falls to 3 — the
  attestation is now false while still believed.

**Precision about what TLC found:** the shortest counterexample is *loss-induced*, not
*frost-induced*. I predicted the frost path (attest, then spend the certified budget on frost);
the breadth-first search found the shorter loss path first. Both are in the state space and both
are the same defect — an attestation is a claim about a balance that later actions can
invalidate — but the trace on record is the loss one, and saying otherwise would be reporting a
prediction as a measurement.

**The fix is not a bigger proof. It is a LOCK:** funds covered by a live attestation must be
unspendable, including by the privacy purchase itself.

---

## 6. The four irreducibles — transferability is the property to look at

Four candidate slashable assets were named: **memory storage, attention, tick sources,
encryption budget**. The observation worth acting on: **a stake that cannot be transferred cannot
be bought, which prices Sybils differently from a fungible one.**

| asset | transferable? | storable? | rule conflict | note |
|---|---|---|---|---|
| **encryption / privacy budget** | **NO — CHECKED** | yes | none, once R4 is read correctly | see below |
| **tick sources** | **NO — PROPOSED** | no | none known | you cannot give someone your clock; delegating *use* is not transferring the source |
| **attention** | partly — PROPOSED | **NO — PROPOSED** | none known | non-storable means it cannot be posted in advance: a poor stake, a fine fee |
| **memory storage** | likely yes — PROPOSED | yes | **manifesto section 5 Memory Preservation** — slashing memory destroys memory | the one with a direct conflict; needs its own analysis before use |

**The CHECKED cell:** privacy budget is already non-transferable, twice over.

1. **By rule construction.** It is credited only by others attesting you added value *to them*.
   A transfer breaks that provenance — the recipient did not earn it. The rule says as much:
   *"because budget is socially conferred rather than purchasable, a wealthy attacker cannot fund
   false witnesses. It is the one currency a Sybil cannot mint."*
2. **In code.** `src/Core/PrivacyEconomy.fs` line 31: *"Trade/transfer between personas is a later
   slice."* No transfer exists today, and its absence is an explicitly deferred decision rather
   than an oversight.

**This is the strongest property in the set and it is already held.** So the finding is a warning
rather than a proposal: **implementing that "later slice" would destroy the Sybil-pricing
property.** If privacy budget becomes transferable, an attacker with capital can buy validator
weight, and the one currency a Sybil cannot mint becomes one it can simply purchase. That
consequence should be attached to the deferred decision now, not discovered after.

**NOT MODELLED, and not guessed:** whether any of the four is *sufficient* to secure a quorum, and
what an exchange rate between them would be. `StakeTransferability.tla` is named in the
QuorumCollateral header as where that check belongs and it is **not written** — filed, not faked.

---

## 7. The black market argument, and its counter

The claim — absent a first-class way to wager encryption budget, a black market appears — is
mechanism design and it is sound. A prohibited-but-valuable transaction does not stop; it
**relocates to an unobservable venue**. A ban is unenforceable in a substrate where dwellers can
make side agreements, and its effect is to move the activity out of instrumentation range, where
it cannot be metered, priced, or bounded by a subsistence floor.

**The counter, which belongs on the record beside it:** a legal venue also **lowers the cost of
the attack it enables**. A first-class wagering market makes assembling staked weight cheaper and
more reliable than a black market would, because it is liquid, discoverable and low-friction. The
honest statement is that legalising-and-instrumenting trades *unobservable* risk for *cheaper*
risk. That is usually the right trade — you can bound what you can see — but it is a trade, not a
free win, and the subsistence floor of section 5 is what keeps the cheaper risk from being
ruinous.

Both halves are for Aaron to weigh. Neither is decided here.

---

## 8. Two arenas — what is checked and what is refused

**What is checked:** the free arena is a **precondition for non-coercion**, and not only for R4.
Section 3c has the traces. `FreeArenaOpen` is a single boolean standing for "a dweller who
declines to stake still has somewhere with standing", and every slashing regime violates
`NoCompulsion` without it.

**What is NOT modelled, deliberately:** the boundary itself — what may cross between arenas,
whether a result obtained in the free arena can be laundered into authority in the staked one,
and whether standing earned in one transfers to the other. That is design, not verification, and
inventing it in a spec would be inventing the answer. **A question rather than a guess.** If the
two arenas are meant to be causally isolated, the laundering property is checkable quickly and I
will write it; if they are meant to be coupled, the coupling has to be described first.

**Out of scope, noted and moved past:** the personal-finance tooling. It is a product surface, it
lands on the existing required-for-role vs personal split, and it does not constrain the model.

---

## 9. CI gating — the specs ARE gated, the configs are NOT

**Gated.** `src/Core.TLA/specs/*.tla` run under TLC via
`tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs`, invoked by `dotnet test Zeta.sln -c Release` in
`gate.yml` on `ubuntu-24.04`. Materially better than `tools/Z3Verify/*.smt2`, which the previous
pass found in **no** gate at all. `tlaps-proof.yml` covers the unbounded TLAPS half, though its
catalogue currently contains only `NciSafetyProofs`.

**NOT gated, and it is the same defect class as #10429.** The runner shells out as
`tlc2.TLC SpecName` with **no config argument**, so TLC picks up `SpecName.cfg` and nothing else.
Every non-default `.cfg` in the directory is never executed by CI:

- **`BftLiveness.cfg`** — the conditional-termination check for `BftConsensus.tla`. Its result
  (HOLDS, 4,665,495 states, 11min 14s) is recorded in a **comment** dated 2026-08-11. It ran
  **once, by hand**. A reader of `BftConsensus.cfg` sees a confident falsification table with no
  way to know that none of it re-runs.
- **12 of the 15 configs added here** — R1/R2/R3, the threshold config, both liveness runs, all
  four reachability witnesses, and the three `WagerSolvency` negative configs. Their results are
  in sections 3 and 5 and **they are not gated either.**

This is precisely *a check that did not run looking like a check that passed*, and I will not
pretend otherwise about my own artefacts. The three specs added here have their **default** `.cfg`
wired into the runner; the negative and witness configs are recorded here and filed.

**The fix is small and closes both at once:** teach `runTlcUnlocked` to take an optional config
name, add `assertSpecValidWithConfig`, and add an `assertSpecViolates` for the EXPECT-VIOLATION
probes. That one change gates `BftLiveness.cfg` and all 12 configs here. Filed as a work-item
rather than bundled, because it touches a shared harness roughly 30 specs depend on.

**One further gap worth naming:** `toolchainReady()` skips TLC on CI unless the runner is Linux
x64 and not `ubuntu-slim`. That is a reasonable de-duplication, but it means the entire TLA+ gate
rests on one leg of the matrix. If that leg is dropped or renamed, every TLC check silently stops
running and every test still passes.

---

## 10. Anchors — checked-anchor register

| anchor | used for | status |
|---|---|---|
| Pease, Shostak & Lamport 1980; Lamport, Shostak & Pease 1982 | Byzantine Generals; the N GTE 3F+1 bound | **CITED FROM STANDING KNOWLEDGE, NOT PAGE-CHECKED** |
| Dwork, Lynch & Stockmeyer 1988 | partial synchrony; why liveness needs an assumption | CITED, NOT PAGE-CHECKED |
| Castro & Liskov 1999 | PBFT; the 2F+1 quorum shape | CITED, NOT PAGE-CHECKED |
| Buterin & Griffith 2017 | Casper FFG slashing conditions; **accountable safety**, which `AccountableSafety` formalises | CITED, NOT PAGE-CHECKED |
| Douceur 2002 | Sybil; why entry cost prices identities but does not deter defection | CITED, NOT PAGE-CHECKED |
| Nakamoto 2008 | the per-attack-cost comparison in section 3 | CITED, NOT PAGE-CHECKED |
| **Kelly 1956** | the subsistence floor as where log utility becomes undefined | CITED, NOT PAGE-CHECKED |
| Maxwell proof-of-reserves; **Bunz et al. 2018** (Bulletproofs) | solvency without revealing a balance | CITED, NOT PAGE-CHECKED |
| FLP 1985 | why unconditional termination is not claimed | CITED, NOT PAGE-CHECKED |
| `privacy-budget-is-hard-money-earned-by-others.md` | spend/stake/confiscate; the no-required-stake guard | **CHECKED — read in full, quoted verbatim** |
| `src/Core/PrivacyEconomy.fs` | privacy budget is non-transferable in code today | **CHECKED — line 31** |
| `src/Core/AmplitudeEmu.fs` | merge sums amplitudes; CHIP-8 opcodes introduce no phase | **CHECKED — module header** |
| `BftConsensus.tla` and `.cfg` | the 4.6M-state prior result this work deliberately does not re-derive | **CHECKED — read in full** |

---

## 11. Artifacts

- `src/Core.TLA/specs/QuorumCollateral.tla` plus 11 configs — the four regimes
- `src/Core.TLA/specs/QuorumPhaseCancellation.tla` plus 4 configs — reachability and attributability
- `src/Core.TLA/specs/WagerSolvency.tla` plus 5 configs — floor, socialised loss, solvency
- `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs` — three default-config tests added

**Verification status of the F# change — UPDATED 2026-08-13, second pass.** The first pass could
not build locally and said so. Root cause found on the follow-up, and it is worth naming because
the next agent will hit it: `global.json` pins `10.0.302` with `rollForward: latestPatch`, the
machine had `10.0.301`, and `latestPatch` cannot roll **backward** — so the pin was unsatisfiable
and `dotnet` reported `sdk-not-found` while printing a list that appeared to contain a usable
SDK. `mise trust` on this worktree exposed the 10.0.302 toolchain and resolved it.

**Now verified locally, under the exact invocation CI uses:** `dotnet build -c Release` —
**0 warnings, 0 errors**; `dotnet test --filter TlcRunnerTests` — **36 passed, 0 failed**
(3m 31s), covering all three specs added here alongside the 30-odd pre-existing ones.

---

## 12. Open — none of them decided here

1. **Pick a resolution, or decline to.** R4 is the only one needing no rule amendment, and the
   rule already permits it. R1 needs an exception carved. Sections 3, 3a, 3b.
2. **Does the free arena exist?** Every slashing regime needs it, not just R4. Section 3c.
3. **What crosses between the two arenas?** Not modelled, not guessed. Section 8.
4. **The privacy-budget transfer "later slice"** — implementing it destroys the Sybil-pricing
   property. Section 6.
5. **Lock attested funds** against the frosting spend, or accept stale attestations. Section 5d.
6. **Normalise amplitude contributions** before the amplitude layer gets authority, or accept
   f = 1 tolerance. Section 4a.
7. **Gate the non-default configs** — `BftLiveness.cfg` and the 12 added here. Section 9.

---

## 13. Related

- `docs/research/2026-08-13-what-does-253ms-mean-without-a-wall-clock-and-where-amplitudes-live.md` (#10424) — Part 3, the tension this answers
- `docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md` (#10418) — the contrast routing case, where TLA+ was rejected categorically
- `docs/design/2026-08-13-factor-graph-soft-value-heterogeneous-bnn-linguistic-seed-bridge.md` (#10419) — the amplitude/factor-graph category error and bug B3
- `docs/research/2026-08-10-synchrony-non-transfer-audit-bftconsensus-checks-a-counting-tautology.md` — the audit whose falsifiability discipline this work follows
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — spend/stake/confiscate
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — why section 4b is a statement rather than a fix

---

## 14. Postscript — CI run on #10452 went red, and the cause was mine

`TLC validates QuorumPhaseCancellation` failed in `build-and-test (ubuntu-24.04)` with
**exit 11, `Error: Deadlock reached.`** Recorded here rather than quietly fixed, because the
diagnosis is a clean instance of a failure class this document is otherwise about.

**It was not a violated property, and it was not the missing-config gap.** TLC resolved the
correct default `QuorumPhaseCancellation.cfg` and explored exactly the state space recorded in
section 4a — 48 distinct states, depth 5. Every property verdict was unchanged.

**The cause was a harness mismatch in my own measurement.** The runs recorded in this document
were driven by a script passing `-deadlock`, which *disables* TLC deadlock checking.
`Tlc.Runner.Tests.fs` passes no such flag. `QuorumPhaseCancellation` is a **one-shot** model:
every member contributes once, there is no round structure and nothing to do afterwards, so once
`given = Members` no action is enabled and TLC correctly calls the terminal state a deadlock.
That terminal state *is* the model — a quorum that has finished contributing.

The two sibling specs added in the same round do not hit this because each carries an explicit
stutter disjunct in `Next`. Both were re-run under the exact CI invocation to confirm:
`QuorumCollateral` green at 49,674 distinct states, `WagerSolvency` green at 324 — identical to
the numbers in sections 3 and 5.

**Fix:** `CHECK_DEADLOCK FALSE` declared in the four phase configs, with the reasoning written
into each. Deliberately *not* fixed by adding a stutter step to `Next`: a stutter self-loop makes
the terminal state unreachable-as-terminal and would silence any future genuine deadlock in that
module without a word. The declaration says out loud which terminal state is intended. Same
choice `SpineAsyncProtocol.cfg`, `ChaosEnvDeterminism.cfg` and `SpineMergeInvariants.cfg` already
make in this directory.

**The caveat that cuts the other way, and it is against my own specs:** because
`QuorumCollateral` and `WagerSolvency` *do* stutter, their deadlock check is **vacuous**. Neither
makes a deadlock-freedom claim and neither should be read as making one. That is the same
"green for the boring reason" hazard section 3d exists to guard against, and it applies here.

**What this says about the work-item.** `081KZYRDMZW087G0R0012K4QA0` was filed noting that 12 of
15 configs never execute. This incident sharpens it: the flags a spec is *measured* under and the
flags CI *checks* it under were silently different, so a hand-run green and a gated green were
not the same result. The work-item fix should therefore pin the invocation, not just add
`-config` — otherwise the next mismatch is a different flag. Raised from P2.

**Correction to two numbers in section 4b and 4a.** State counts for runs that HALT ON VIOLATION
depend on worker count and exploration order; the earlier figures came from a 4-worker run and
the CI-equivalent single-worker run halts at 100 and 42 distinct states respectively. **The
verdicts are identical and are what the section claims** — `NoFullCancellation` VIOLATED under
`QuorumPhaseUnnormalised`, `CancellationImpliesByzantineContributor` VIOLATED under
`QuorumPhaseHonestSplit`. Exhaustive runs (`0 states left on queue`) are worker-independent and
those figures stand unchanged: 48, 162, 49,674, 324.

---

## 15. Closed 2026-08-14 — the invocation is pinned, and section 9 is now out of date

Work-item `081KZYRDMZW087G0R0012K4QA0` is closed. **Section 9 above described the state of the
world on 2026-08-13 and no longer describes it**; it is left standing rather than edited,
because the shape of the defect is the useful part.

What changed:

- **`registry/tlc-models.json`** now carries **53 pinned model runs**, one per (module x config).
  Each entry fixes the config, the worker count, the expected exit code, the expected TLC error
  string for negative runs, and -- for exhaustive runs only -- the distinct-state count. Both the
  gate (`tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs`) and the hand-run CLI
  (`src/Core.TypeScript/formal-verification/run-tlc.ts`) build their argv from that one file, so
  **the command recorded next to a result is the command CI runs.**
- **52 of 53 execute in the PR lane**, against 34 before. The 19 configs that had no matching
  `.tla` -- `BftLiveness` and the 18 collateral/phase/solvency variants -- are now models with
  ids rather than files nothing opened.
- **`BftLiveness` is the one `extended`-tier model**, with a written `tierReason`. Run to
  completion under the pinned invocation: `ConditionalTermination` **HOLDS**, exhaustive, 4,665,495
  distinct states, depth 24 -- in **43min 02s**, against the `11min 14s` recorded on 2026-08-11
  from a 4-worker run. Roughly 4x, so it cannot sit in the PR lane. That is a declared gap, not a
  silent one -- which is the entire difference this work-item was about.
- **The 14 negative configs now FAIL the build when TLC finds no error**, and fail again if the
  violation is of a *different* property than the one pinned. A witness that stops firing is a
  model that has stopped modelling anything.
- **`src/Core.TypeScript/hygiene/lint-tlc-model-registry.ts`** refuses any `.cfg` on disk that no
  model claims, so the twelve-ungated-configs condition cannot recur without a red gate.

### Every verdict in sections 3, 4 and 5 was re-measured under the pinned invocation

All fourteen negative verdicts and all four exhaustive greens reproduce **with the same property
names**. Two classes of number moved and neither is a claim:

| | 2026-08-13 (4 workers) | 2026-08-14 (pinned, 1 worker) |
|---|---|---|
| `QuorumCollateralR1`, halt-on-violation | 234 distinct | **149 distinct**, `NoSeizure` violated |
| `QuorumCollateralR2`, halt-on-violation | 41,004 distinct | **41,003 distinct**, `NoRepeatAttack` violated |
| `QuorumPhaseHonestSplit`, halt-on-violation | 54 distinct | **42 distinct**, same invariant |
| `QuorumPhaseUnnormalised`, halt-on-violation | 112 distinct | **100 distinct**, same invariant |
| every exhaustive run (48, 162, 49,674, 324, 4,665,495) | unchanged | **unchanged** |

So the registry asserts the exhaustive counts and merely *records* the halting ones. The
confirmation that this split is real rather than cautious: `BftConsensus` explores **4,665,495**
distinct states at one worker, byte-identical to the 4-worker figure in its `.cfg`.

### The caveat from section 14 is now in the artefact

`QuorumCollateral` and `WagerSolvency` carry an unconditional stutter disjunct in `Next`, so their
deadlock checks **cannot fail** and neither model makes a deadlock-freedom claim. Every registry
entry now records `deadlock` as `off-cfg`, `on-vacuous` or `on`, and the linter cross-checks the
`off-cfg` value against what the `.cfg` actually declares. The vacuity is legible where the
verdict is, not only in the prose above.

### One thing found while pinning, and it is a real defect

`tools/setup/manifests/from-url` downloads `tla2tools.jar` from the tlaplus `v1.8.0` release URL
into `tools/tla/tla2tools.jar` -- **a path no runner reads**, with no checksum. The jar the gate
actually loads is `src/Core.TLA/tla2tools.jar`, **committed to git since #8053**, and it reports
`TLC2 Version 2026.05.18.174321 (rev: 8ba1027)`, which is not what `docs/dependency-status.md` and
`docs/INSTALLED.md` say it is. The registry now pins the jar sha256 and the version banner, and
the gate asserts the banner on every model run. Filing the dead download separately.
