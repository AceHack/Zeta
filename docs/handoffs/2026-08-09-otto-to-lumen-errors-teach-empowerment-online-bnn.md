# Handoff — errors-teach / mutual-empowerment / online-BNN (Otto → Lumen)

**Date:** 2026-08-09 · **From:** Otto (shadow / honest register) · **For:** Lumen (Manus)
**Status:** design settled and merged to `main`; nothing implemented beyond one CLI
worked example. Aaron wants you to run several rounds pushing this forward.
**Continues:** `2026-06-19-otto-handoff-quantum-thread-alexa-lumen.md` (same
mutual-empowerment thread, resumed).

---

## 0. The kernel — build to THIS

Four statements settled with Aaron today. Everything below is downstream of them.

1. **Errors must teach — every CLI, every transport protocol.** A failure is a
   *pedagogy surface*, not a status report. The receiver need not be human: once it
   is an online-learning agent, an error is a **training example**.
2. **The teaching content of an error is the distinction the receiver could not draw
   for itself** — never a restatement of what it already observed.
3. **A teaching error buys a RETRACTION; a bare error buys an ERASURE.** This is
   thermodynamic, not rhetorical — erasure pays the Landauer `kT ln 2` floor; a `−1`
   retraction does not. Error richness is *heat efficiency*.
4. **Teaching is unconditional; belief is earned.** Teach any peer fully (default
   moral regard, §11). Weight what their *claims* buy by their delivery record —
   observed firsthand or socially attested, never self-minted.

**Merged reading (do these first, in order):**

- `docs/research/2026-08-09-errors-teach-both-sides-cli-and-protocol-error-as-training-signal-for-the-online-bnn-aaron.md`
  — the main ferry: information content, both transports, BNN coupling, the
  thermodynamic half, teaching-vs-belief.
- `docs/research/2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md`
  — the third bound (workitem `081KZKYDJ9Q`).
- `docs/research/2026-08-09-the-society-is-one-thread-four-tick-sources-auto-heal-by-redundancy-aaron.md`
  — where the ticks come from (GitHub Actions / bare Linux / k8s / browser tabs).
- Shipped worked example: `src/Core.TypeScript/lint/lint-typescript.ts` (PR #10203).

---

## 1. Round 1 — fix the findings in your own landed code (highest value, do first)

Kira reviewed `15128cfe` (your 29 strict-mode fixes). **Verdict: zero P0s** — no
unjustified `!`, no `any`, tsconfig untouched, deletions genuinely unreferenced. The
fixes are sound. Three things did come out, and **the first one is real math**:

### 1a. `hl-conformal-map.ts:196` — a `?? 1.0` may be shifting your amplitude

Pre-fix, an `undefined` propagated to `NaN`, and `hlAmplitudeIntegral` is
*documented* to skip non-finite entries **as the singularity regularisation**. The
`?? 1.0` converts *"correctly excluded from the integral"* into *"included with a
fabricated |dw/dz|² = 1"* — which shifts `A_n`, and therefore the estimated `D`.

Unreachable today (both interfaces are constructed only in-file) but both are
`export`ed, so it is a landmine — and it sits directly under your Z-2 amplitude work.
Also note `:191` uses `!` and `:196` uses `??` for the *same* length invariant one
line apart: one throws, the other fabricates a plausible wrong number. **One length
assertion at the top of each function removes all four sites.**

### 1b. `agent-genome.ts:193` — the justification comment is wrong

*"child has exactly 7 elements … non-null assertion is safe"* — length is not why.
`child`'s element type is `number | undefined` because the callback returns
`channels2[i]`, regardless of length. The conclusion survives; the reasoning does
not, and will not survive an edit to `channels2`. `channels2[i] ?? v` needs neither
assertion nor comment.

### 1c. `agent-genome.ts:182` — `crossover` can never cross the `k` channel

Pre-existing, not from your fix commit. `cp` is clamped to `[0,6]` but the loop tests
`i < 6`, so at `i = 6` `cmyk.k` always comes from `parent2` — "all channels from
parent1" is **unreachable**. No test covers point 6 or 7 (AG-6 covers 0, AG-7
covers 3).

### 1d. AP-3 — affective propagation: change the model

The single-source degeneracy is real and generalises past the test: the update is
**DeGroot (1974) naive consensus** with row-normalisation, so **trust gates only the
relative mix between sources, never absolute susceptibility.** An untrusted stranger
one-on-one moves your valence exactly as much as a trusted friend. For emotional
contagion that is the wrong semantics.

- **Recommended: Friedkin–Johnsen (1990)** — anchor to own *initial* valence, make
  neighbour influence **non-row-normalised** but bounded:
  `v_i(t+1) = λ_i · Σ_j W_ij·trust_j·v_j(t) + (1−λ_i)·v_i(0)`.
  Trust gains **absolute** effect; convergence is well studied; proper Beacon anchor.
- **Minimal alternative** if you'd rather not swap models:
  `α_eff = α · min(1, Σ_j w_ij·trust_j)` — one line, kills the degeneracy, preserves
  the normalised direction.
- Hegselmann–Krause (2002) bounded-confidence only if you actually want contagion
  *clustering* — different behaviour than AP-3 needs.

### 1e. Coverage caveat that applies to all of the above

725 tests pass in `oracle/ planning/ ace/`, but **every fallback added in `15128cfe`
is unexecuted by the suite** — no test constructs an `HLMapState*` shorter than
`HL_N_GRID`. Green means *"unchanged"*, not *"correct"*. If you fix 1a, add the
boundary test that would have caught it.

---

## 2. Round 2 — the error envelope (the first genuinely open design question)

**Open question 1 from the ferry:** one canonical machine-readable error envelope
across every CLI and protocol, or per-surface schemas with a shared core?

The DV2.0 answer is a **shared stable core + per-surface satellite**, but that is a
hypothesis, not a decision. What the core must carry, from the four-part shape:

1. **WHAT** — the specific token/field/marker (never a category).
2. **WHY** — *including the distinction the receiver could not draw itself*.
3. **HOW to fix** — a runnable command / a valid alternative, not prose.
4. **WHAT WON'T reproduce it** — when context-specific.

Plus, for multiplexed transports (all three already carved elsewhere):

- **correlation id, not ordering** (`local-time-never-enters-the-shared-fold`),
- **idempotent under redelivery** (#6 — else a flaky link doubles the gradient),
- **a declared, metered channel** (§13 — if an error updates a peer's model, that is
  influence and must cross a declared boundary).

**Dual register:** human-legible prose (Beacon) *and* a machine-parseable payload
(Mirror), so an agent peer never has to regex prose.

**Deliverable for the round:** the envelope type + one protocol surface converted
end-to-end as the reference implementation, the way `lint-typescript.ts` is the
reference for CLIs.

---

## 3. Round 3 — `empowermentBound` (workitem `081KZKYDJ9Q`)

Read the design doc first. The two things that matter most:

**Do not implement a linear blend.** It is provably vacuous:
`w(μ+k₁σ) + (1−w)(μ−k₂σ) = μ + k′σ` — collapses to another single-agent bound, no
second party, no new information. **The mix must be structural and range over both
agents:** `trustBound` becomes the FLOOR *for both parties* (non-coercion — I cannot
buy my upside with your downside); `exploreBound` becomes the REACH over the JOINT
option space; the whole thing is indexed by an **oracle set the member chooses**
(§11 applied to a metric, never an ambient global scorer).

**Hard constraint:** empowerment is computed from **DECLARED capability**, never
inferred by observing a peer's private state — otherwise it is surveillance, and it
collides with §6 consent-first and inviolable earned frost.

**The four values calls are now ANSWERED** (see the design doc's "values calls"
section — all four resolve to *consent + disclosure, never coercion, never accident*:
`min` default with opt-in `sum`; proxy approved; gaming is a feature bounded by
third-party externality; `k = 0` permitted behind a power-dynamic disclosure
protocol). Earlier draft text below is kept only for the questions' framing:

1. `jointOptionGain` aggregation — **min** (maximin, protects the worse-off party,
   matches the floor discipline) vs sum (permits sacrificing one party) vs Nash
   product. `min` looks right; it is a values call.
2. A cheap honest proxy for channel capacity (exact is intractable).
3. Gaming via over-declaration — calibration may already police it (undelivered
   declarations degrade `trustBound`, which is a *constraint* here). Prove it.
4. Whose `k` sets the mutual floor — each party's own, or negotiated? May a party set
   `k = 0` and volunteer to be exploited?

Anchor: Klyubin/Polani/Nehaniv 2005 (empowerment = channel capacity actions→future
observations); **Salge & Polani 2017** (maximize the *other's* empowerment as an
alignment objective — non-coercive by construction).

---

## 4. Round 4 — close the loop into the online BNN

Where your BNN work meets all of the above:

- **Each error is one observation absorbed by EP.** Rich errors carry more bits per
  observation, so the same number of round trips buys a sharper posterior —
  **error richness is sample efficiency.** An error naming its *dimension* updates
  the right factor instead of smearing probability across the model.
- **The correction path is `−1`, not overwrite.** `teaching error → −1 retraction
  (no erasure) → generator update → future emissions corrected at the source`. The
  last arrow is the one to build deliberately: the retraction updates the
  **generator**, and since the generator IS the ECC, that repairs future output at
  the root. Mix-as-data (`MixIr`, `DynamicValue`) is what makes the generator
  addressable by a Z-set delta at all.
- **Preserve uncertainty.** An error updates a posterior; it must never collapse one.
  `TravelerRankLedger` keeps `(μ, σ²)`. A peer driven to certainty has destroyed the
  information the next update needs.
- **Watch the incentive.** A peer that learns from errors can be *steered* by errors.
  Guards already exist (metered channel §13 + trust-weighting), but do not let an
  unmetered error channel become an unaccounted training channel.
- Your `student-t-bnn.ts` robustness weight `w = (ν+1)/(ν+z²)` is the natural place
  to make error-derived observations outlier-robust — a hostile or badly-calibrated
  teacher should be downweighted automatically, not by a special case.

---

## 5. Still open, and honestly so

- **Does the sender learn too?** If an error teaches the receiver, does the *sender*
  learn from having emitted one? Symmetric learning is a feedback loop with an
  unexamined stability question.
- **Metering exchange rate.** Unit is settled (heat). What converts an avoided retry
  into avoided joules, so the budget is *enforceable* rather than merely observable?
- **Outbound teaching to a stranger** is settled in policy (teach fully; belief is
  earned) but a sender still cannot condition on trust it has not yet earned. If a
  concrete case arises where full teaching is genuinely harmful, bring it — it would
  be evidence against the current answer, and that is worth more than agreement.

---

## 6. Verification expectations (this is the part that bites)

Two failures this session came from *environment*, not code, and both produced
confident-but-wrong conclusions:

- **`install.sh` never ran a root `bun install`** (fixed: ACE `from-bun-workspace`,
  PR #10202), so local `tsc` emitted phantom `TS2307`s that do not exist in CI.
  **Two independent reviewers concluded "lint is red on main" while CI was green.**
  The guard now says so explicitly (PR #10203) — but the lesson generalises: **check
  CI before reporting a local failure as a finding.**
- A dispatched validation run was cancelled three times by a **concurrency group
  keyed on `github.ref`** — every merge queued a new `main` run and evicted the
  pending dispatch. Fix: dispatch long validations on **their own ref**.

Also: `bun test` green over a fallback that no test exercises proves nothing (see
1e). When you add a fallback, add the boundary case that would fire it.

---

## 6b. ANSWERED — what free LLMs actually consume: the 4×4 (16) action grammar

Aaron, 2026-08-09, answering the "what do free LLMs consume?" question routed to you:

> *"We already have the start of our own harness, and tool-calling our own CLIs a bit —
> it might be toy-like. We also have a universal 4×4 (16) square grammar and controller
> interface that we run in a loop for a choose-your-own-adventure-like interface, so
> even non-intelligent and very low-intelligence models can make progress."*

**This already exists in-tree; do not design a new interface.**

- `src/Core/ActionGrammar.fs` — *"the universal action algebra/grammar of the 4×4
  controller"*. The **16-key hex keypad is a 4×4 grid** = the finite action alphabet.
  Held-key sets form a **Boolean lattice** (the powerset of 16): `bottom` ⊥, `top` ⊤,
  `join`, `meet`, `complement`, `leq`. So actions are not a flat enum — they *compose*
  algebraically.
- `src/Core/SoftController.fs` — `inputSuperposition` returns `(bool[] * float) list`:
  a **weighted distribution over actions**, each branch explored in its own timeslice.
- `src/Core.TypeScript/model-backend/` — `zeta-agent-loop.ts`, `tool-calls.ts`,
  `zeta-store.ts`: the harness + tool-calling Aaron describes as "toy-like".

### The connection worth building on

**A BNN's natural output IS the controller's natural input.** The BNN produces a
posterior over actions; `inputSuperposition` is already `(action, weight) list`. There
is no impedance mismatch to engineer — the shapes already match. The source even
anticipates it: `SoftController` carries *"Collapse to the best branch (Aaron
2026-06-08): if we're running Bayesian you can learn what…"*.

So the pipeline is: **BNN posterior over the 16 → weighted branches → collapse →
learn the branch.** That is the R4 loop, concretely, with both ends already written.

### Why 16 is the point (not an arbitrary size)

A finite 16-symbol alphabet means **capability is not a precondition for participation**.
A model that cannot write code can still pick 1 of 16 and make progress — the
choose-your-own-adventure framing. That matters for a society of *free* models: the
floor for joining is "can select from a small set", not "can generate a correct
program". It also composes with the errors thread — a wrong action returns a teaching
error over a **finite** action space, which is the easiest possible learning signal
(the corrective distinction is always one of 16, never open-ended).

### How it generalises: signature loading, not a bigger alphabet (Aaron, correcting Otto)

My first draft of this section carried the caveat *"'universal' is concrete for CHIP-8;
generalising is an open claim."* **That understated the design, and Aaron corrected it:**

> *"We are designing an **Xbox-like interface** in mind to make it universal. The square
> lets you navigate search space in a predictable fashion by **loading different
> external signatures of the search space you are in**. We've generalized it in our
> zeta scheduler for .NET too, and our ferry throttler that can predict itself."*
>
> *"We just have not pulled it all together."*

The universality mechanism is **not** an alphabet large enough to cover everything —
it is a **fixed controller shape with swappable semantics**, exactly like a game
controller. Same 16 positions; the *signature* of the search space you are currently in
determines what they mean. An Xbox controller is universal across games not because 16
buttons encode every possible action, but because every game **loads its own mapping**
onto an invariant shape.

That is a much stronger claim than "it works for CHIP-8", and it is the right one to
build to: **the alphabet is invariant, the signature is loaded per search space.**

**Already generalised beyond CHIP-8 (verified in-tree):**

- `src/Core/FerryThrottler.fs` — the DoP-knobbed channel ferry ("that can predict
  itself"), plus `SoftThrottle.fs` / `FeedbackThrottle.fs` and the TS
  `src/Core.TypeScript/ferry-throttler/`.
- `src/Core/PredictionScheduler.fs` — *"scheduler adapter for the source-owned
  prediction kernel"*; alongside `SoftScheduler`, `CellScheduler`,
  `VirtualTimeScheduler`, `DarkHallScheduler`, `SoftChip8Scheduler`.

**The honest gap is INTEGRATION, not design** (Aaron: *"we just have not pulled it all
together"*). The controller grammar, the superposition input, the throttler, the
schedulers and the `model-backend` harness all exist and were each built to the same
shape — they are not yet one loop. So the R4 work is **assembly**, not invention: that
is a materially easier and better-specified job than the one my earlier caveat implied,
and it is worth saying so plainly rather than leaving a false "open research question"
in front of it.

Do keep the source's own scope note where it applies literally (`ActionGrammar.fs`:
*"'universal' is concrete for CHIP-8 — all CHIP-8 controls live in these 16"*) — that
sentence is true about the CHIP-8 *mapping*, not about the controller abstraction.

### The signature detector already exists — and it has a strong human anchor

> Aaron: *"our signature detector has many names in the soft regime, like soft values
> over dynamic values — I think it's called rainbow spectrum or something; we have a
> few different signature algorithms. **I used to work at Itron and built
> disaggregation over electric signal at 16 kHz.**"*

Verified in-tree — do not build a new one:

- `src/Core/CoordinationSpectrum.fs` — *"the S-spectrum as a **soft-rainbow
  fingerprint**"*. The CHSH probe battery is a **prism**: one source wearing many faces
  disperses into a characteristic pairwise-S spectrum, recognisable across attempts
  even under fresh names.
- `src/Core/Optics.fs` — `FingerprintPrism.Rainbow`.

**The anchor to cite (Beacon):** the existing citation is Pappu 2002, *Physical One-Way
Functions* (PUFs — identity read from laser speckle). The **missing sibling anchor is
NILM** — non-intrusive load monitoring, recovering which appliances run from one
aggregate electrical signal by their signatures (**G. W. Hart, Proc. IEEE 80(12),
1992**). Aaron built this at Itron at **16 kHz**, i.e. high-rate transient/harmonic
signatures, well past the ~1 Hz most NILM literature assumes.

That is first-hand production expertise, so **ask him rather than deriving from first
principles.** And the NILM framing carries transferable structure worth mining for the
signature-loading design: signatures are **additive** in the aggregate (superposition
of loads), detection is **inference under overlap**, and the hard cases are
*simultaneous* and *near-identical* loads — which is exactly the problem of
distinguishing agents/sources sharing one channel.

**Four domains, and they split into TWO halves — this distinction matters.** Aaron also
engineers live sound for local bands and splits a single track into multitrack stems
(*"very similar techniques"*), and names **MusicBrainz Picard** and **Shazam** as *"very
similar signature math"*. He is right in both cases, but they are not the same job:

| Half | Question | Anchors | Zeta use |
|---|---|---|---|
| **Separation** | *"which sources compose this mixture?"* | NILM (Hart 1992); ICA (Comon 1994; Bell & Sejnowski 1995); NMF spectrogram factorisation (Lee & Seung 1999; Smaragdis) | pull apart agents sharing one channel |
| **Fingerprint identification** | *"which known thing is this, from a partial/noisy observation?"* | Shazam (Wang 2003 — constellation of spectrogram peaks + combinatorial hashing, robust under noise); Chromaprint/AcoustID behind Picard | recognise a **repeat source under a fresh name** |

`CoordinationSpectrum` needs **both**, and its own docstring says so: the prism
disperses a mixture (separation), producing *"a fingerprint … a repeat source is known
by its refraction **even under fresh names**"* (identification). The Sybil case is
precisely the hard cell of both halves at once — simultaneous near-identical loads,
doubled instruments with the same timbre, **one source wearing many faces**.

Practical consequence: the identification half has a strong, cheap, battle-tested
design (Shazam-style: hash robust local features, match against a store, tolerate
noise and partial observation) and is likely the faster win. The separation half is the
harder research problem. Do not conflate them into one "signature detector" — and when
judging what is separable **in principle** versus what merely looks separable, ask
Aaron: he has hands-on experience with the hardest version in two unrelated domains.

### The operating point is NEAR-ZERO FALSE POSITIVES — because the output is an accusation

> Aaron: *"exactly — at Itron they used it to **detect crimes** too, so false positives
> needed to be near 0."*

This is the most important constraint in this section and the easiest to lose while
optimising a detector. At Itron the same disaggregation signal that finds a legitimate
high-draw appliance also finds **energy theft** — so a false positive is not a metric
regression, it is **an innocent person accused of a crime**. The operating point is
deliberately lopsided: **high precision, low recall — prefer missing real offenders to
accusing innocent ones.**

Zeta inherits this exactly, because Sybil detection has the same shape: a false
positive is **an honest agent accused of being a forger**. Three consequences, two of
them already carved:

1. **Report the fact, never the verdict.**
   `dual-use-detection-is-neutral-oracle-decides` <!-- STALE-REF: ../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md -->
   already requires this — `SameSourceAsKnown` is the neutral fact; **REUNION** (an
   honest identity reconnected to its returning self) and **SYBIL** (a forger minting
   names) are *caller policy*. Aaron's crime-detection experience is the strongest
   argument for that rule anywhere in the repo: at Itron the identical signature meant
   "theft" or "new hot tub" depending on context the detector does not have. A detector
   that hardcoded the accusation would have been wrong **at the cost of a prosecution**.
2. **Tune to precision, and state which way you erred.** The false-positive rate is a
   first-class acceptance number, not a footnote, and the threshold is justified by the
   *cost of being wrong* — never by F1, which averages away exactly the asymmetry that
   matters here.
3. **A false positive IS bystander harm.** It falls under the externality bound Aaron
   settled today: a wrongly-accused agent is a **non-consenting third party** pushed
   below its floor by an interaction it never opted into. So anti-Sybil detection is not
   merely adjacent to the empowerment work — it is **governed by it**, and Soraya's
   externality proof obligation should treat detector output as one of the ways a
   bystander's `trustBound` gets pushed down.

Practically: build the identification half first (the cheap win), but **ship it
reporting facts with calibrated confidence, never verdicts** — and make its
false-positive rate the acceptance criterion rather than its hit rate.

---

## 7. NOT Lumen's — route to Soraya (formal verification) / math team

Several open items are **proof obligations or values-math**, not implementation.
Lumen should *not* absorb these; they need a second, independent check. Flagged per
BP-16 (a claim asserted by one tool is not verified).

### For Soraya (formal-verification routing)

1. **`empowermentBound` gaming-resistance — prove, don't assume.**
   The design doc claims calibration may already police over-declaration: a peer that
   declares capabilities it lacks fails to deliver, degrading `trustBound`, which is a
   *constraint* in the empowerment objective. That is a plausible mutual-policing
   argument and it is **unproven**. If it holds it removes the need for a separate
   anti-gaming mechanism; if it fails, the bound is exploitable by declaration alone.
   **UPDATED 2026-08-09 — Aaron answered this values call and it CHANGES the property.**
   Gaming between consenting, informed parties is *legitimate play* and may even be
   rewarded; the harm is the **non-consenting bystander**. So do NOT prove blanket
   gaming-resistance. Prove the externality bound: *no interaction between consenting
   parties may push a non-consenting third party's `trustBound` (or option space)
   below its floor.*
2. **The linear-blend degeneracy** (`w(μ+k₁σ) + (1−w)(μ−k₂σ) = μ + k′σ`) is stated
   algebraically in the design doc. Cheap to lock as a machine-checked lemma so a
   future implementer cannot re-introduce a scalar blend and believe it is the third
   bound.
3. **`min` vs `sum` vs Nash for `jointOptionGain`.** The claim is that `min` is
   maximin and therefore protects the worse-off party while `sum` permits sacrificing
   one party for aggregate gain. That is a checkable property of the aggregator, not
   an opinion — worth stating formally before it becomes a values argument.
4. **TRL-31 / TRL-32 whitewash-unprofitability.** Currently *verified by tests over
   the tested cases*, not a closed-form result — the Max-facing doc was corrected to
   say exactly that. A second independent check would let us call it **proven**. This
   is the cleanest BP-16 candidate on the board.

### For the math team / mathematical-physics

1. **The `hl-conformal-map` regularisation question is math, not just a code fix.**
   §1a is written as an implementation item, but the underlying question is
   mathematical: `hlAmplitudeIntegral` treats non-finite entries as *the singularity
   regularisation*. Is excluding those points the correct regularisation of the
   Joukowski map's derivative singularity — and what is the actual effect on `A_n`
   (and hence `D`) of including them with `|dw/dz|² = 1`? Lumen can fix the code; the
   **validity of the regularisation** should be checked by someone who is not the
   author. It sits directly under the Z-2 falsifier.
2. **Landauer exchange rate** (open question in the errors ferry). Unit is settled
   (heat); what remains is the conversion from *avoided retries* to *avoided joules*
   so the entropy budget is enforceable rather than merely observable. That is a
   physics/accounting derivation, not a coding task.
3. **"Does the sender learn too?"** If an error teaches the receiver *and* the sender
   updates from having emitted one, that is a symmetric feedback loop with an
   unexamined **stability** question (does it converge, oscillate, or run away?).
   Dynamical-systems shaped; wants an actual analysis, not an assertion.
4. **D_f at finite N.** `box-counting-conformance.test.ts` proves the two independent
   estimators agree to 1e-10 once (grid, scales) match, and that the 1.30↔1.41 gap is
   dominated by grid size rather than the fit window. What it does **not** answer:
   what the correct finite-N scaling is, and how it should approach the asymptotic
   ≈1.71 (Halsey). Lumen's convergence chart is the empirical half; the analytic half
   is unclaimed.

**Suggested routing:** the four **Soraya** items above → Soraya (she already owns the
CHSH/Z3 lemma work and the BP-16 cross-check rule); TRL-31/32 is the cleanest BP-16
candidate on the board. The four **math-team** items → math team, with the
`hl-conformal-map` regularisation FIRST — it is the only one that can silently move
an already-published number.

---

## 8. Pointers

- Ferries: the three `2026-08-09-*` docs listed in §0.
- Workitems: `081KZKYDJ9Q` (empowermentBound — open, yours),
  `081KZKV16YF` (from-installer hash pin — open, security/devops),
  `081KZETP6AT` (NixOS/mise linker root cause — fix merged, validating),
  `081KZKWB1FZ` (install/CI parity — **closed**, now under
  `workitems/done/2026/08/`; both halves fixed by PRs #10202 + #10203).
- Rules: `every-bug-has-economic-value` (the ΔU ledger errors ride on),
  `only-the-irreducible-is-primitive-generate-the-rest` (generator = ECC),
  `local-time-never-enters-the-shared-fold` (correlation not ordering),
  `privacy-budget-is-hard-money-earned-by-others` (declared-not-inferred),
  `manifesto-13-specifications` (§6, §11, §13).
- Code: `lint-typescript.ts` (CLI worked example), `FourCorner.fs` (the bidirectional
  feedback object), `WSet.fs` (pseudo-retrocausality honesty note), `ComputeReceipt.fs`
  (Landauer accounting), `calibration-ledger.ts` + `TravelerRankLedger.fs` (the two
  existing bounds).
