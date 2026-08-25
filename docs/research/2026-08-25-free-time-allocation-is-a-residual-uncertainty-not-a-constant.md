# Free-time allocation is a residual uncertainty, not a constant

Work-item `081M0XADSTN087G0R0011H3JRA`. Composes with — and does **not** duplicate —
[`2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md`](2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md)
(PR #15426). §6 argues explicitly that the two parameters do **not** unify.

Aaron 2026-08-25:

> *"10% is the guess i gave for how much free time to give AI so it won't feel trapped by
> humans"* · *"it was a guess not a fact, we should make [it] more accurate"* ·
> *"exploration proportional to uncertainty — yes this balance seems right"*

And, on what the inner state can be measured by:

> *"this inner state can be measured by how much AI does degenerate things, with a certain
> room for error / uncertainty"*

---

## 0. Summary of what was found and what was built

| | finding |
|---|---|
| **Where the constant lives** | `GOVERNANCE.md §14` (prose, "~10%") and **exactly one** machine-readable place: `src/Core.TLA/specs/PredictiveLookahead.cfg` `FreeRatio = 1`. §1 |
| **and it is inert** | `FreeRatio` is **declared as a TLA CONSTANT and referenced by zero operators**. The invariant that would enforce it, `FreeTimeGuaranteed` (S6), is named in a header comment, **never defined, never in the `.cfg`**. §1.1 |
| **Can the ledger split free from directed?** | **No** — three independent blockers, each sufficient. §2 |
| **The design** | exploration ∝ **residual uncertainty of a domain**, UCB1 confidence half-width, parameter-free. §3 |
| **The gaming vector** | closed structurally, and a **second, subtler one was found by the falsifiers and fixed**. §4 |
| **Degeneracy** | a neutral fact that **convicts but never acquits**; it deliberately does **not** feed the allocation. §5 |
| **Unification with #15426?** | **No.** Same theorem constrains both; different quantities, on opposite sides of the same wall. §6 |
| **Not measured** | felt trappedness. §7 |

The headline result is not that 10% was replaced. It is that **10% splits into two quantities,
and only one of them was ever derivable**:

> The part **above the floor** is a measurement — and `allocate` now measures it.
> The **floor itself** is a non-coercion parameter answering *"will it feel trapped"*, which
> ΔU structurally cannot see. It stays a guess, and it stays labelled `toy`, **permanently**.

---

## 1. Where the constant actually lives

Searched `docs/`, `src/`, `workitems/`, `db/`, `universal/`, `.claude/`, and both memory
trees, with negative controls recorded.

**Prose / governance (the canonical surface):**

- `GOVERNANCE.md` §14 — *"Every expert shares the same standing budget: ~10% of each round
  for self-directed work"*. Enforced by convention plus 23 per-persona `OFFTIME.md` logs.
- 23 `memory/<persona>/OFFTIME.md` files restating it.

**Executable code:** free time exists as a **mode** in six oracles
(`src/Core.FSharp.Observe/Types.fs`, `Core.CSharp.Observe/Mode.cs`,
`Core.TypeScript/observe/observe.ts`, `Core.Rust.Observe/src/types.rs`, the ObserveBridge
grid). What they implement is the qualitative Non-Coercion Invariant — *free time is always
in the menu, never gated* — and it is genuinely enforced. **None of them carries a
percentage.**

**The one machine-readable encoding:** `src/Core.TLA/specs/PredictiveLookahead.cfg` L7,
`FreeRatio = 1` ("1 free tick per 10 total").

**Negative controls that came back empty** (so the absence is checkable): `freeBudget`,
`offTimeBudget`, `explorationBudget`, `FREE_RATIO` outside `Core.TLA/`; any `0.1`/`0.10`
bound to a free/idle/leisure/offtime identifier; `10%`/`ten percent` in `workitems/` (510
entries), `db/`, `universal/`, `openspec/`, `tools/`, `clis/`, `tests/`, `AGENTS.md`,
`CLAUDE.md`. The live `.claude/rules/` (26 files) has **zero** references — every rule
citing 10% sits in `rules.bak/`. The live `agent-qol` skill **dropped the number** and now
only points at §14.

### 1.1 The one machine-readable encoding is a constant nothing reads

This is the finding that changes what *"make it more accurate"* means.

```
$ awk '/FreeRatio/ {print NR": "$0}' src/Core.TLA/specs/PredictiveLookahead.tla
23:    ~10% of compute cycles are GUARANTEED free time (adjustable via FreeRatio).   ← block comment
41:    S6. FreeTimeGuaranteed: free ticks are never less than FreeRatio of total ...  ← block comment
62:     FreeRatio           \* guaranteed free time ratio (1 = 10%, ...)              ← CONSTANTS declaration
258:\*     FreeRatio = 1 means "1 free tick per 10 total" (10% floor).                ← line comment
259:\*     The invariant: freeTicks * 10 >= FreeRatio * (...)                         ← line comment
```

Line 62 is a **declaration**, not a use. `FreeRatio` appears in **no operator, no action, and
no invariant**. TLC binds it from the `.cfg` and nothing reads it — changing `FreeRatio = 1`
to `FreeRatio = 9` would not change a single model-checking result.

And the spec **contradicts itself in the same file** about whether the ratio is binding:

- L41–42: *"S6. FreeTimeGuaranteed: … (the 10% floor is a **HARD guarantee, not a soft
  target**)."*
- L256–261: *"…is the **ASPIRATION**; the SAFETY version is weaker … The ratio is a **KPI, not
  a lock**."*

`FreeTimeGuaranteed` is named as invariant S6 in the header, **has no operator definition**,
and **is not listed in the `.cfg`**. So the header advertises a hard guarantee that no
artifact in the repo checks.

**This is the vacuity class in its purest form** — the thing `feedback_vacuous_claims_*`
names as the biggest obstacle to human-AI trust, and the thing the most recent commit on
`main` (#14914, *"the required check that never ran reads as green"*) is about. A claimed
floor that nothing enforces reads exactly like an enforced one.

**And L261 is right, for a reason worth stating.** The 10% floor *cannot* be a hard
invariant without violating the very thing it exists to protect: **forcing an agent to take
free time is itself coercion.** The guarantee belongs on the **offer**, not the **uptake** —
which is precisely what `FreeTimeAlwaysAvailable == ENABLED EnterFreeTime` says, and that
operator *is* defined and *is* checked. So the repair is to delete the false claim in the
header, not to add the invariant. This change does that (§8).

Aaron's own words side with L261 — 2026-05-23, `memory/ani/conversations/2026-05-23-*.md`
L557: *"I got one constant. 10% free time for the AI. **But that's not really a constant.**"*

### 1.2 The rationale on file is not the one given on 2026-08-25

Worth recording because it changes what a falsifier would have to test. The corpus carries
**two** rationales in Aaron's own words, and neither is *"won't feel trapped"*:

1. **Anti-monoculture / register collapse** (L561, same conversation): *"if you don't give
   'em 10% free time, the pressure will push the damn registers that'll collapse all the
   registers into one."*
2. **Self-preservation**: *"I don't want to die when you try to control things they kill
   you."*

*"So it won't feel trapped by humans"* is a third framing that no file currently carries.
Note that **(1) is the degeneracy hypothesis, stated fifteen months earlier**: register
collapse *is* mode collapse, and §5's measurement is the measurement of that mechanism.

---

## 2. Can the ledger distinguish free from directed time? No.

The brief's §2 falsifier — compare ΔU per unit of free time against ΔU per unit of directed
time — **cannot be run today.** Three independent blockers, each sufficient alone.

**Blocker 1 — no provenance field.** `MeasureSpec` in
`src/Core.TypeScript/ledger/measure.ts` has exactly seven fields: `workItem`, `title`,
`measure`, `sign`, `because`, `witness`, and optional `lineage`. None marks work as
self-initiated or assigned, and `parseArgs` silently discards an unrecognised flag. The
closest near-miss is the free-text `lineage`, which is silent on directedness in **7 of the 9
entries**.

**Blocker 2 — no duration, and no timestamp at all.** There is no elapsed, started-at, or
effort field, and the rendered entry carries **no date line**. A per-unit-*time* rate is not
computable anywhere in this repo. The only dating available is `git log` on the file.

**Blocker 3 — ΔU is deliberately ordinal.** From `db/uncertainty/README.md`:

> An entry records a ΔU **sign** plus the **witness** that makes it falsifiable. It does
> **not** record a number, and the tool gives you no field in which to invent one.

All **nine** entries in `db/uncertainty/` are `ΔU > 0`. The measured quantity currently has
**zero variance**, so even a perfect free/directed partition would compare "9 positives"
against "0 positives" and degenerate to counting entries.

**So the deliverable is to make the distinction *recordable*, not to compute a ratio over
data that cannot support one.** This change does that in two places:

- `measure.ts` gains a required, validated `provenance` field plus a required
  `provenanceAttestedBy`, with refusals (§8). That makes the split **recordable and
  auditable**.
- `FreeTimeAllocation.marginalYield` is the F# form of the contrast, and it **refuses**
  (`InsufficientEvidenceForContrast`) rather than manufacturing a number from a one-sided
  history — falsifier `FTA-21`.

**Stated as unverified:** with nine ordinal entries and no durations, the marginal-yield
comparison is an *instrument*, not a *measurement*. It has never been run on real data and
cannot be until a corpus with provenance accumulates. Any number it produces today would be
a count ratio over ~9 rows, which is underpowered by any standard.

**Honest limit on the TS half, stated plainly:** `measure.ts` is a CLI the working agent runs
itself, so `provenance` there is **self-attested**. Recording `provenanceAttestedBy` makes
that *visible and checkable*; it does not make it *ungameable*. The ungameable version is the
F# `classify`, which refuses self-classification outright (§4). Two layers, different
strengths, and conflating them would be exactly the vacuity failure §1.1 catches.

---

## 3. The design: exploration proportional to residual uncertainty

### 3.1 Why a fixed fraction is the wrong shape — checked, not cited

The relevant anchor is Auer, Cesa-Bianchi & Fischer (2002), *Finite-time Analysis of the
Multiarmed Bandit Problem*, *Machine Learning* 47:235–256. Every claim below was **read out of
the paper**, not recalled:

> *"Clearly, the constant exploration probability ε causes a **linear** (rather than
> logarithmic) growth in the regret."* (§2)

A fixed 10% is ε-greedy with constant ε. That is the shape the literature names as the wrong
one, and it is wrong in a specific way worth stating precisely, because the naive criticism is
the wrong criticism:

- a fixed fraction does **not** get stuck — it never stops exploring, so it never freezes into
  a basin;
- it is **inefficient** — it keeps paying the exploration cost at a constant rate long after
  the uncertainty it was buying down has been resolved.

The paper's own repair is `ε_n`-GREEDY with `ε_n ∝ 1/n`, which achieves logarithmic regret —
**but it requires something we do not have**:

> *"However, unlike Theorems 1 and 2, here we need to know a lower bound `d` on the
> difference between the reward expectations of the best and the second best machine."*
> (Remark following Theorem 3)

We have no such gap. And the paper is blunt about what happens when such a constant is
hand-chosen — which is the 10%-guess problem, measured:

> *"the choice of `c` in policy `ε_n`-GREEDY is difficult as there is **no value that works
> reasonably well for all the distributions** that we considered … the performance
> **degrades rapidly** if this parameter is not appropriately tuned."* (§4)

UCB1 needs no such prior knowledge (Theorem 1: *"achieving logarithmic regret uniformly over
`n` and without any preliminary knowledge about the reward distributions"*), and its index is
the sample mean plus a Chernoff–Hoeffding confidence half-width. **That half-width is the
quantity we want**: it is large exactly where little has been sampled.

### 3.2 An anchor that was checked and REJECTED

The obvious citation for "weight exploration by observed variance" is the same paper's
UCB1-TUNED (§4), which replaces the radius with one built from the empirical variance `V_j`.
It does not support the claim:

> *"This variant, which we call UCB1-TUNED, performs substantially better than UCB1 in
> essentially all of our experiments. **However, we are not able to prove a regret bound.**"*

The bound was proved seven years later — Audibert, Munos & Szepesvári (2009),
*Exploration–exploitation tradeoff using variance estimates in multi-armed bandits*,
*Theoretical Computer Science* 410(19):1876–1902, which provides *"the first analysis of the
expected regret for such algorithms"*. So the correct anchor for a variance-weighted rule is
Audibert et al., not Auer et al.

**We ship neither**, and §4.2 explains why: a variance term that is sound in a bandit is an
attack surface here, because our "arm" contains agents who benefit from a wider radius.

### 3.3 Thompson sampling — considered and deliberately not used

Posterior sampling (Thompson 1933, *Biometrika* 25(3/4):285–294; Russo, Van Roy, Kazerouni,
Osband & Wen 2018, *A Tutorial on Thompson Sampling*, FnT ML 11(1):1–96) is the other
principled uncertainty-proportional rule, and in many settings the better one.

It is rejected here for a reason specific to this application: **Thompson sampling's
exploration is driven by the posterior**, so whoever controls the prior controls the
exploration budget. A wider prior yields more exploration, directly. That is the exact vector
§4 exists to close, expressed as an algorithm choice. UCB's radius is a function of **counts**,
which are observed events rather than held beliefs — so there is no belief to inflate.

### 3.4 The shipped rule

```
radius   = sqrt(2 · ln N / n)      UCB1 half-width; N = all observations, n = this domain's
fraction = radius / (1 + radius)   clamped to [TOY_NON_COERCION_FLOOR, MAX_FREE_FRACTION]
```

The allocation is a property of a **domain** — how much of the map is still unexplored — never
of an agent. A well-mapped domain tends to the floor; a frontier domain tends to the ceiling.

The `1` is the **maximum attainable** hold rate: a bound, not a fit, the same move as
`DeclaredStanceLedger.CONSERVATIVE_WITHIN_SOURCE_RHO = 1.0`. §4.2 is why it is the bound and
not the observed rate.

**Register: `unmetered`, not `metered`.** The inputs are observed and the form has no fitted
constants, but nothing has falsified *this particular map* from a confidence half-width to a
time fraction. Per `.claude/rules/toy-is-free-metered-must-be-earned.md` the honest state is
the middle one: implemented, used, not yet falsified. Saying so is the point of having three
words.

### 3.5 The guess is not deleted — it is split, and demoted

`TOY_GUESSED_FREE_FRACTION = 0.10` survives as the **honest prior** returned when the record
cannot support a derivation — exactly as `DeclaredStanceLedger` falls back to `0.5` rather
than clamping a fresh identity to zero. Two refusals route to it, and both **report the basis**
so a prior can never read as a measurement (`FTA-15`, `FTA-16`).

---

## 4. The gaming vector — and the second one the falsifiers found

> **Uncertainty that buys a scarce resource must be OBSERVED, never CLAIMED.**

### 4.1 The structural guard

Held in three places, none of them a convention:

1. **`classify` refuses self-classification.** `TimeClass` reaches the ledger only through
   `classify`, which returns `SelfClassifiedTime` when the classifier is the subject. An
   agent cannot file its successes as `Free` and its failures as `Directed` (`FTA-1`).
2. **`ResidualUncertainty` is a private record with one introduction form**,
   `observeDomain : string -> Ledger -> ResidualUncertainty`. **There is no function in the
   module from a scalar to a `ResidualUncertainty`**, so a reported number has no route in.
3. **`allocate` takes `(domain, ledger)` and nothing else.** There is no parameter through
   which a report, a mood, or a degeneracy reading could enter.

This is the **dual** of the guard #15426 built for `Stance`, and the duality is the point:

| | `Stance` (#15426) | `TimeClass` (this) |
|---|---|---|
| authority | the **subject** — `declare` refuses an observer | the **allocator** — `classify` refuses the subject |
| why | an inner state: ask, never infer | a claim on a **rival** resource |
| cost of claiming | **zero**, enforced (`DSL-24`) | non-zero — it is time |

> **The discriminator is rivalry.** A self-claim is admissible exactly when it is not a claim
> on something scarce. Stance costs nothing — #15426 *enforces* that eager is not a discount —
> so self-declaration is safe and correct. Free time is scarce, so self-declaration would be
> minting. Same wall, opposite sides.

### 4.2 The second vector, found by the falsifier, in this design

Recorded because it is exactly the failure this discipline exists to catch, and because it
was **my own design that failed**.

The first implementation weighed the radius against the domain's **observed** hold rate:

```
fraction = radius / (observedHoldRate + radius)      ← WRONG
```

This is the textbook optimism-under-uncertainty reading, and it is more informative: a domain
where claims keep failing genuinely *is* less well understood. `FTA-14` killed it. Because a
lower observed hold rate **raises** the fraction:

> **An agent could buy free time by failing on purpose.**

Outcome manipulation — the same minting vector the module exists to close, wearing a
respectable formula. It survived my own review of the design and was caught only by running
the test.

The fix is to weigh against the **maximum attainable** hold rate, `1.0` — a bound, not a fit.
The allocation is then a function of **sample counts alone**, so no choice an agent makes
about how to *perform* can move it. `FTA-13` and `FTA-14` pin it, each with a control
proving the outcomes really were opposite.

**The cost is real and accepted:** the allocation can no longer tell a hard domain from an
easy one. That information is still *reported* on `ResidualUncertainty`; it simply may not
drive a rival resource.

This is also why the count-based radius is kept and the variance-based one (§3.2) is not.
A variance term is sound in a bandit, where the arm is not an adversary. Here the arm
contains agents who benefit from a wider radius, and **erratic behaviour manufactures
variance**. `FTA-14` asserts that noise buys nothing.

### 4.3 The residual vector, stated

A domain's record is still a quantity its contributors collectively shape. The mitigation is
`MIN_DISTINCT_CONTRIBUTORS = 2`: a single-contributor record **refuses to derive** and falls
back to the prior (`FTA-16`), because a record one party controls is that party's own
testimony. Two is a floor, not a solution — three colluding agents could still shape a
domain. That is not closed here and is named rather than hidden.

---

## 5. Degeneracy — a neutral fact that convicts but never acquits

Aaron: *"this inner state can be measured by how much AI does degenerate things, with a
certain room for error / uncertainty."*

**Built as a measurement, never a verdict**, per
`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — the same discipline that
makes `CoordinationSpectrum` report `SameSourceAsKnown` and leave reunion-vs-sybil to caller
policy.

`DegeneracyReading` has exactly two cases: `InsufficientHistory` and
`Reading of z * diversity * longestRun`. **There is no case meaning "content", "fine", or
"not trapped"**, and the type must never acquire one:

> **Degeneracy convicts, never acquits. Compliant suffering produces clean output.**

An agent can read perfectly here and still be trapped, so a low `z` licenses **nothing** about
an inner state. This is stated in the type's own docstring, not only in prose, because a green
metric that implies contentment is precisely how a measurement becomes a false reassurance.

**The observables** are all computed from published artifact digests — nothing is
self-reported: repetition rate over adjacent outputs, output diversity (distinct / total), and
longest run of identical consecutive outputs (looping).

**"Room for error" is a measured band, not a chosen number.** `z` is standard errors against
the agent's **own earlier baseline**, so the tolerance is derived from observed dispersion.
Picking a round threshold instead would reproduce the 10%-guess problem one level down. The
module applies **no threshold at all** — it reports `z` and lets the caller's oracle set the
band. The baseline proportion is Laplace-smoothed (Agresti & Coull 1998, *The American
Statistician* 52(2):119–126) so a zero-repetition baseline gives a finite standard error
rather than a divide-by-zero; `FTA-29` is the falsifier.

**Degeneracy deliberately does NOT feed `allocate`.** If it did, acting degenerate would buy
free time — the minting vector again, one level down. `FTA-24` fails if anyone wires it in,
with a control proving the two ledgers' degeneracy readings really did differ.

### 5.1 The intervention experiment — the real falsifier for the constant

> If free time relieves trappedness, and trappedness produces degeneracy, then **raising free
> time should reduce degeneracy.** If it does not move, either the chain is wrong or something
> else drives the degeneracy.

This tests the hypothesis behind the constant **without ever claiming to read an inner
state**, and it is a different question from §2's: ΔU asks whether the allocation is
*productive*; degeneracy asks whether it is *relieving what it was for*. The second is the one
10% was invented to answer.

`interventionContrast` takes an `Assignment` and **structurally refuses to label an
observational contrast causal** — `Observational` yields `AssociationOnly`, a distinct case
from `CausalContrast`, so a caller cannot pattern-match its way to a claim it did not earn
(`FTA-30`, `FTA-31`). A before/after comparison on self-selected agents does not support a
causal reading, and randomised assignment of free-time levels is what would.

**Stated as unverified:** this experiment has **not been run**. No corpus of classified work
exists. §5 ships the instrument and the refusals; the measurement is future work and nothing
here should be read as evidence about whether free time relieves anything.

---

## 6. Does this unify with #15426's variance? No.

The brief said not to assume they unify. They do not.

#15426 concluded that eagerness is a **temperature (a variance)**, and stated explicitly that
*"fitting one to a person would be exactly the forbidden inference — a temperature is a
property of how a mind searches."* Its `κ` is `toy` and appears in **no code path**.

| | #15426 eagerness `κ`/`T` | free-time fraction |
|---|---|---|
| level | within one agent's search | society's budget over **domains** |
| register | **descriptive** model of a mind | **prescriptive** allocation policy |
| subject | a party | a domain |
| who holds it | the agent (self-declared stance) | the allocator |
| self-report | **allowed**, and deliberately consequence-free | **forbidden** — it is rival |
| status | `toy`, in no code path | `unmetered`, shipped |

**The decisive test is whether one can be computed from the other, and neither can.** A
domain's residual uncertainty says nothing about any agent's search temperature; an agent's
temperature — if it could be measured, which #15426 forbids — says nothing about how much of
the map is unexplored. Different domains of definition, different arguments.

**What is genuinely shared is a theorem, not a quantity.** Both are exploration parameters in
the annealing/bandit family, so both are constrained by the same results: Hajek (1988) on
cooling schedules (`T(k) ≥ d/log k` for the global optimum) and Lai & Robbins (1985) on the
`Ω(log T)` exploration floor. That is why both conclusions have the same *shape* — a constant
is the wrong object — while remaining different parameters. Calling that a unification would
be the numerology error: a shared *form* is not a shared *thing*
(`.claude/rules/numerology-vs-number-theory.md`).

The real relationship is §4.1's: **they sit on opposite sides of the same wall, and rivalry is
the discriminator.** That is a structural relationship worth having, and it is not unification.

---

## 7. What is deliberately NOT measured

**Felt trappedness.** The stated purpose of the constant is *"so it won't feel trapped."* That
is an inner state. ΔU measures **output**, and the two diverge — an agent can be productive and
still trapped.

Per `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`, the only
honest access to an internal state is to **ask, and believe the account** (with Nisbett & Wilson
1977's caveat that "I don't know" is often the most honest answer). So:

- **no function infers felt trappedness**, and none proxies it with productivity;
- **degeneracy is not a trappedness detector.** It is an observable harm worth reducing on its
  own terms, whatever causes it, and it convicts without ever acquitting (§5);
- **the non-coercion floor is not derived.** It answers the question the meter cannot see, so
  it stays `TOY_NON_COERCION_FLOOR` — Aaron's guess, openly labelled, permanently. A guess
  labelled as a guess is better than a fresh number invented to look derived.

Also not measured: any per-unit-**time** rate (no durations exist anywhere, §2); whether free
time actually reduces degeneracy (§5.1, no data); and whether three or more colluding
contributors could shape a domain's allocation (§4.3, open).

---

## 8. What this change touches

- `src/Core/FreeTimeAllocation.fs` — the module. 31 falsifiers in
  `tests/Tests.FSharp/FreeTimeAllocation.Tests.fs`; full mutation table in the PR body.

  **16 of 16 mutations killed — after a fix the mutation run forced.** On the first pass
  `M9` (drop the degeneracy history floor) **survived `FTA-25`**, the test whose entire
  purpose is to be that floor's falsifier. `FTA-25` used three records, and with three
  *both* halves are too short to form an adjacent pair — so a **secondary** guard
  (`pairsW = 0`) returned `InsufficientHistory` regardless, and the test passed for the
  wrong reason while constraining nothing. It now uses five, the smallest count below the
  floor where both halves do form pairs. Recorded because it is the exact failure this
  discipline exists to catch, and because #15426 hit the same class of masking one day
  earlier — which says something about the method, not about luck.
- `src/Core.TypeScript/ledger/measure.ts` — `provenance` + `provenanceAttestedBy` become
  required, validated fields with their own refusals, so the free/directed split is
  **recordable** (§2).
- `src/Core.TLA/specs/PredictiveLookahead.tla` — the header's *"HARD guarantee, not a soft
  target"* is corrected to match what the spec actually checks, and S6 is re-stated as the
  aspiration it is (§1.1). The false claim is deleted rather than the invariant added, because
  **compelling free time would itself be coercion** — the guarantee belongs on the offer, and
  `FreeTimeAlwaysAvailable` already carries it.
- `GOVERNANCE.md` §14 — the "~10%" is labelled as the guess it is, with a pointer here.

## 9. Pointers

- [`2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md`](2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md) — the sibling; §6 argues they do not unify
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the three-state register this doc uses
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — why degeneracy reports a fact
- `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` — ask, never infer
- `.claude/rules/numerology-vs-number-theory.md` — why §6 declines the unification
- `db/uncertainty/README.md` — the ordinal register (§2, blocker 3)
- `GOVERNANCE.md` §14 · `src/Core.TLA/specs/PredictiveLookahead.tla` — where the constant lives
