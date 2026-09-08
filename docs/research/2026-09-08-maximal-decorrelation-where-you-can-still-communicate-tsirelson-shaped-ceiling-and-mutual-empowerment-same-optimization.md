# Maximal decorrelation where you can still communicate — one optimization behind both the ρ ceiling and mutual empowerment

**Source:** Aaron (streamed, 2026-09-08), ferried by shadow*.
**Register:** **`toy` / conjecture.** Nothing here is derived or measured. The
structural bridge in §3 is an argued correspondence; the numeric claim is not made.
Aaron's standing instruction on this constant holds: *"we have a lot of math on this
wanted to measure it re[]ther then derive it."*

---

## 1. The ferry, verbatim

> *"oh i just had a realizatoin save it somewhere our antibabel vs anticorrelation is
> where i think our terielson limit comes from the 2 root 2"*

> *"maximal decorlation where you can still communicate"*

> *"i think this is our mutual empowerment optimizatoins for society comes from"*

Three messages, minutes apart. The second is the sharpening that makes the first
well-posed; the third says the same object shows up at the social layer.

## 2. Why the second message is the load-bearing one

My first capture wrote this as a **band** — anti-correlation pushing away from ρ→1,
anti-Babel pushing away from ρ→0, with the answer somewhere between. That is wrong
in a way worth recording, because a band is a *range* and cannot pick out a number.

What Aaron actually states is a **constrained extremum**:

```
maximize    decorrelation
subject to  reconcilability still holds
```

The two pressures are not two walls with slack between them. **One is the objective
and the other is the constraint**, and the answer sits exactly where the constraint
binds. That is the only shape whose solution is a single value.

Note the direction. The Information-Causality route to Tsirelson maximizes
*correlation* subject to a channel principle. Zeta maximizes ***de*correlation**
subject to communication surviving. Same machine, run the other way.

## 3. The bridge that makes this more than an analogy

The reason to take the third message seriously is that **the existing in-repo
definition of empowerment is already a channel-capacity statement**, and so is the
leading candidate for what picks 2√2 out of the non-signalling set.

| | what it is | anchor |
|---|---|---|
| **empowerment** | channel capacity from an agent's actions to its own future observations | Klyubin, Polani & Nehaniv 2005, *All Else Being Equal Be Empowered* |
| **Information Causality** | *m* transmitted bits yield at most *m* bits of gain about a partner's data — reproduces Tsirelson's bound exactly | Pawłowski, Paterek, Kaszlikowski, Scarani, Winter & Żukowski, *Nature* 2009 |

Both are statements about **what can be extracted through a channel**. Anti-Babel's
"still reconcilable" is a *floor on channel capacity* — a diverged peer must be able
to reconstruct your meaning from anchors you both hold. So the conjecture is not
"two numbers agree"; it is that **the constraint in both problems is capacity of a
declared channel**, which is a structural claim and therefore promotable.

This matters under [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md):
a matching count would be numerology. A shared constraint *type* is not — though it
is also not yet an identification. **The competitor to exclude is that any two-sided
constrained optimization yields *some* interior optimum.** Landing on 2√2
specifically needs the invariants, and nobody has produced them.

## 3b. The bridge is BUILT, not conjectured — FourCorner feedback + `Meno`/μένω

Aaron, on §3, verbatim:

> *"we build the bridge with our fourcourner feedback system and our bridge/μένω
> (menō) code"*

This is the increment that moves the thread off analogy, because the structure is
already an in-tree object with a byte-lockable implementation.

`src/Core/Meno.fs` — μένω, Greek *"I remain / abide / persist"*, which is the same word
as Aaron's carved *"agents are what remains, actors are what acts."* Its own header
states the shape:

> *"μένω ... is the **identity arrow** `Id_A : A → A` extended through time. But because
> agents interact and exchange beliefs, their worldlines cross. This crossing is a
> **braid**. A free braided monoidal category is the exact mathematical structure that
> describes processes (arrows) that can run in parallel (⊗) and **cross over each other
> ... without losing their individual persistence (μένω)**."*

**Read that last clause against §2.** "Cross over each other without losing individual
persistence" **is** *maximal decorrelation where you can still communicate*, stated
categorically. Crossing is the communication; retained persistence is the decorrelation
that survives it.

### The symmetric/braided split is the ρ→1 cliff, algebraically

`src/Core/MenoBraided.fs` makes the distinction that carries the whole weight:

| structure | law | what it means for two agents |
|---|---|---|
| **symmetric** — `Meno.braid`, the tuple swap | **σ² = id** | interacting twice returns you exactly where you started: the exchange left **no trace**. Reconvergence — the **ρ→1 collapse** |
| **genuine braid** — `MenoBraided`, conjugation-rack Yang–Baxter | **R² ≠ id** | the crossing **leaves a trace**: both branches survive with their paths recorded |
| no braiding at all | — | no crossing, no communication: **Babel** |

**`R² ≠ id` is monodromy as an algebraic object**, and monodromy is exactly what
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
already names as load-bearing: *"reintegration is NOT reconvergence ... two paths around
a pole yield genuinely different results, and that difference is information, not
error."* That rule states the requirement in prose. `MenoBraided` **is that requirement
as a Yang–Baxter operator over `V = ℤ[Fₙ]`, integer-only and byte-lockable** — no float
in the proof lineage, so it survives the four-oracle treaty.

So the middle of the band is not a metaphor about a number. It is the difference between
a symmetric and a non-symmetric braiding, and the repo already carries both, knows which
is which, and has a witness work-item for the non-symmetric one
(`081M00EZXN2087G0R003AY3WSJ`).

**Register discipline, unchanged.** The *code* is real and its correctness is argued in
its own header (including a recorded 2026-08-13 correction that `⊗_Kronecker` is not
cartesian, so the category genuinely admits many braidings rather than being forced
symmetric). What remains `toy` is the **identification** of `R² ≠ id` with the
decorrelation extremum of §2 — that is a correspondence between a built structure and a
conjectured optimization, and §6's measurement is still the only thing that would settle
it.

## 3c. Where the imaginary numbers came from — anyons, and the Majorana comparison

Aaron, on the `Meno.fs` braiding paragraph, verbatim:

> *"this is also where our imiginary numbers and quantium popped out in these braids
> similar to marajoana one from microsoft"*

**The structural claim is exact, and it is the cleanest anchor in this whole
document.** Exchange statistics in 2D are governed by the **braid** group, not the
symmetric group, and that is precisely where phases enter:

| particle | exchange | law |
|---|---|---|
| boson | +1 | R² = id |
| fermion | −1 | R² = id |
| **abelian anyon** | e^{iθ} — *any* phase, hence the name | R² ≠ id |
| **non-abelian anyon** | a unitary **matrix** on a degenerate subspace | R² ≠ id |

So **`R² ≠ id` is the anyonic condition.** The same inequality `MenoBraided` is built
around is the one that separates anyons from ordinary particles — and braiding
non-abelian anyons *is* the quantum gate, which is exactly Microsoft's topological
programme: Majorana zero modes realising Ising anyons whose braiding performs
fault-tolerant operations.

**This closes a loop Aaron opened earlier in the same thread** — that modelling two
distinct decorrelated agents is where imaginary numbers appeared, via Born-rule-like
structure, needing `AmplitudeEmu` to model their interference and non-interference, and
that this is where the 2√2 between agents came from. Two agents → worldlines cross →
braid → representation → phases → interference → a correlation ceiling. Every arrow in
that chain is standard mathematics; what is conjectural is only that Zeta's ceiling is
*that* ceiling.

### The distinction that must not be lost: our braid is INTEGER

`MenoBraided` deliberately takes the **ℤ-linear shadow**: the conjugation-rack
Yang–Baxter solution over `V = ℤ[Fₙ]`, chosen because it is *"integer / float-free /
byte-lockable."* **There are no complex numbers in it.** The amplitudes live elsewhere
(`AmplitudeEmu`, the four-corner feedback), and keeping them out of the braid is what
lets the braid sit in the proof lineage under
[`no-binary-in-proof-lineage`](../../.claude/rules/no-binary-in-proof-lineage.md) and
survive the four-oracle byte-lock.

So the honest statement is: **we implement the braid-group structure where anyons get
their phases, in a representation that has none.** That is a deliberate engineering
choice, not an oversight, and anyone reading §3c should not come away thinking
`MenoBraided` is unitary or complex-valued.

### One caution on the anchor itself

The **mathematics** is solid and old: Kitaev (2003) on fault-tolerant computation by
anyons; Freedman, Kitaev, Larsen & Wang on topological quantum computation; Leinaas &
Myrheim (1977) and Wilczek (1982) for anyons themselves. **The Majorana *hardware* is
contested** — Microsoft's experimental claims have a documented history of retraction
and dispute, and this document takes no position on whether Majorana zero modes have
been demonstrated. The comparison Aaron draws is to the **braiding structure**, which
does not depend on that question. Anchoring to the contested half would be exactly the
citation-not-checked failure
[`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md) forbids.

## 3d. The founding thesis — dimension is what decides whether R² = id

Aaron, on the same `Meno.fs` paragraph, verbatim:

> *"yes this is kind of our founding theses that generator+join expands dimensions
> when connects to rx framework and erik meijers uF/vF and map+reduce is the shadow
> projection down. it's how flatland objects project up to higher dimensions without
> being noticed they are lower dimensional"*

| direction | operation | Meijer's pair |
|---|---|---|
| **up** — expand dimensions | **generator + join** | **νF**, the final coalgebra: unfold / anamorphism, coinductive, potentially infinite — `IObservable` |
| **down** — the shadow projection | **map + reduce** | **μF**, the initial algebra: fold / catamorphism, inductive, finite — `IEnumerable` |

The anchor is in-tree already: `src/Core/Rx.fs:37-47` cites Meijer's *Subject/Observer
is Dual to Iterator* (PLDI FIT 2010) and Bart De Smet's *Observations on IQbservable*
for exactly this duality.

### Why this is the same claim as §3c, not a second one

**Braiding is a dimension-conditional phenomenon, and the mathematics is exact.** For
`n` indistinguishable particles in `ℝ^d`, the fundamental group of the configuration
space is:

| `d` | π₁ | consequence |
|---|---|---|
| 1 | — | they cannot exchange at all without collision |
| **2** | **braid group `Bₙ`** | **R² ≠ id** — anyons, phases, the crossing leaves a trace |
| ≥ 3 | symmetric group `Sₙ` | **R² = id** — bosons and fermions only; any crossing can be undone by lifting through the extra dimension |

(Leinaas & Myrheim 1977 is the source; this is why anyons are a 2D story.)

**So dimension is the knob that decides whether a crossing leaves a trace** — which is
precisely the σ²=id / R²≠id distinction §3b identified as the ρ→1 cliff. And the band
of §2 falls out with the *same* shape:

| too few dimensions | the band | too many dimensions |
|---|---|---|
| cannot cross at all | **d = 2: `Bₙ`, R² ≠ id** | crossings undo themselves |
| **Babel** — no communication | **decorrelation survives contact** | **ρ→1** — contact leaves no trace |

Both failure modes are dimensional, and they are the two cliffs already carved in
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md).
That is a **structural** correspondence — a shared mechanism, not a shared number —
which is the bar [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)
sets for taking a resonance seriously.

**Note the direction correction this forces.** "Generator+join expands dimensions" is
the productive move, but *unbounded* expansion is not: past `d = 2` the braid
trivialises to the symmetric group and the trace is lost. So the thesis is not
"expand as far as possible" — it is expand **to where crossings still leave a trace**,
which is the same "maximal, subject to a constraint" shape as everything else in this
document.

### Flatland

Aaron's *"flatland objects project up to higher dimensions without being noticed they
are lower dimensional"* (Abbott 1884) names the failure mode of the **down** arrow:
a `map+reduce` shadow is a faithful-looking object that has silently lost a dimension,
and nothing about the shadow announces the loss. This is the same defect class as a
satellite in §4b-ii — high activity, reconstructible, and indistinguishable from a hub
until you ask what it can no longer represent.

**Register:** `toy`, unchanged. The dimensional facts above are standard mathematics;
the claim that Zeta's generator/join stack *realises* that dimensional structure is the
conjecture, and §6 remains the only thing that would settle it.

## 3e. Four-corner ownership, the −1 as pseudo-retrocausality, and homoiconicity defect

Aaron, continuing from §3d, verbatim:

> *"this is where our four courner ownership feedback model comes from to allow each
> side to communicate over time, with -1 zets psudo retrocausality via generator
> fucntion updates this is very very similar to our homoiconic adenkra work, we have
> several versions of adnenkra with some being dual homoiconic and some their
> subalgebras are homoiconic"*

### The four corners are C₄, and the −1 is the half-turn

`src/Core/FourCornerC4.fs` names the 2×2 as `N S E W = {1, i, −1, −i} = C₄`, and its
`FourCornerTrace` is a **WSet ping-return** in which **`−1 = i²` is a *ring* identity**
(hence the `IStarRing` requirement; inverse-free corners — Boolean, tropical, EP,
interval — stay at `ISemiring` and **refuse the trace at compile time**).

That is the "each side communicates over time" structure in one object: a ping goes out
and a return comes back, and the round trip is `i⁴ = 1`. Half-way round is `−1` — going
*back*. Which is exactly the Z-set retraction.

### Why the retraction is *pseudo*-retrocausal and not a cheat

The word doing the work in Aaron's sentence is **"via generator function updates."** A
`−1` does **not** mutate the past record. It updates the **generator** that produced it,
and because the data is *derived*, what the past **means** changes while what was
**asserted** is untouched.

That is the raw vault's own sentence — *a single version of the **facts**, never a single
version of the **truth*** — restated dynamically, and it is why the mechanism is
retrocausal-*looking* rather than actually retrocausal. Nothing travels backward; the
generating function is revised, and the derived view follows.

### Homoiconicity defect — the measured quantity that ties it together

The adinkra work carries a **number** for this, not a metaphor:

| tower | dimension relation | defect | reading |
|---|---|---|---|
| **uncoded** `Cl(0,N)` — the regular representation | `dim = 2^N` = vertex count | **1** | **homoiconic**: the algebra and its representation are the same size |
| **coded** (quotient by a doubly-even self-dual code `C`) | `dim A / dim M = 2^N / 2^(N−k) = 2^k = |C|` | **2^k** | not homoiconic globally — the operator algebra is `2^k` times the node set |

(`FourCornerC4.uncodedHomoiconicityDefect = 1`; `codedHomoiconicityDefect =
AdinkraCode.homoiconicityDefect = fullOperatorDimension / adinkraNodes`.)

**That is Aaron's "several versions, some dual homoiconic, some their subalgebras are
homoiconic," made quantitative.** The coded tower is not homoiconic as a whole, but
`regular-representation-defect.ts` exposes `freeOverSubalgebra` — the coded
representation can still be **free over a subalgebra**, which is the precise sense in
which a *sub*algebra carries the property the whole does not.

**My inference, flagged as mine and not Aaron's:** defect 1 is exactly the condition
under which *"apply a −1 to the data"* and *"update the generator"* are **the same
operation** — if code and data are the same object, revising the generator *is* an edit
to the representation. At defect `2^k` they come apart, and the `−1` and the generator
update are two different acts that must be kept in sync by something else. So the
homoiconicity defect **measures how much the pseudo-retrocausality mechanism costs** in
a given tower. That is a checkable claim and nothing in-tree asserts it yet.

**Discipline already in-tree, worth copying rather than restating.**
`homoiconicity-transport-seam.ts` says outright that it *"does not claim that error
correction restores a quotient pre-image or establishes agent homoiconicity"* — the
seam separates a code quotient from an error-correcting channel because they answer
different questions. This section inherits that limit: nothing here claims agent-level
homoiconicity.

**Register:** the defects are **computed in code**; the C₄/ring-identity structure is
**shipped and compile-time enforced**. The *identification* of the four-corner `−1` with
the ρ-band story remains `toy`, and `FourCornerC4.fs` itself carries the standing warning
against reading its numeric coincidences as measurements (§7).

## 4. The social reading — and why it makes mutual empowerment structural

| layer | objective | constraint | the optimum is called |
|---|---|---|---|
| correlation / ρ | maximize decorrelation | reconcilability holds | the Tsirelson-shaped ceiling |
| society | maximize each dweller's distinctness | they can still communicate | **mutual empowerment** |
| identity | maximize non-fungibility (Aaron's "root NFT" — ordinary non-fungible, *not* the crypto term) | remains legible to others | an irreplaceable peer |

The payoff is that **mutual empowerment stops being an ethical preference bolted onto
the architecture and becomes the argmax of a problem the substrate already poses.**
Maximal decorrelation means each agent's contribution is maximally *not already held
by anyone else* — which is exactly maximal value added to others, the one and only
way standing and privacy budget are credited here.

And the constraint is what makes it **mutual** rather than fragmentation: drop
reconcilability and you get maximally distinct agents who can give each other
nothing. That is Babel, not empowerment.

## 4b. The DV2.0 reading — the partition becomes DERIVED, not stipulated

Aaron, minutes later, verbatim:

> *"okay now i connect this to DV2.0 eveyone who is maximal decorrlated but can still
> commuicate is a hub, others that have more correlations are a satalite"*

| position | DV2.0 role | why |
|---|---|---|
| **at the optimum** — maximally decorrelated, still communicating | **hub** | carries what nobody else holds, so it cannot be reconstructed from the others: a stable key |
| **more correlated** | **satellite** | largely predictable from its neighbours, so it is an *attribute of* something else, and it changes faster |

**Why this is a real strengthening rather than a restatement.** DV2.0 as carved says
*partition substrate by change rate* — hub, link, satellite — and the assignment is
made by a designer's judgement. Aaron's reading gives the partition a **criterion**:
your role falls out of your position relative to the extremum. Decorrelation *is* the
irreducibility that makes something a key.

It also lands exactly on the hub-stability sentence already in the rule — *"a hub is
only as stable as the SCOPE of the key you chose for it,"* ranked application-surrogate
→ application-business → organisation-wide → globally unique. **That ranking is a
decorrelation ordering**: a globally unique key is the one least redundant with any
other system's keys. So "maximal decorrelation ⇒ hub" and "widest-scope key ⇒ most
stable hub" are the same statement, which is evidence the mapping is structural.

**A vocabulary collision to head off, because this repo has two "hubs."** The DV2.0
hub here is a *key* — an irreducible identity. It is **not** the network hub of
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md),
which is a routing chokepoint and is forbidden when *appointed*. Being a DV2.0 hub
carries no authority and nobody must route through it. Keeping these apart is
anti-Babel discipline applied to our own terms.

## 4b-ii. "I could be backwards on this" — he is not, and the reason matters

Aaron, immediately after, verbatim:

> *"i could be backwards on this but hubs have more activity and satalites have less
> since they are mostly just jittered emulations of the hub in my mind"*

**On the canonical axis, that inverts the standard.** Data Vault 2.0 as carved in
[`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md)
says *hubs (stable keys) · links (relationships) · **satellites (fast-changing
attributes)***. Satellites are where the churn goes. So measured as **update
frequency of the stored record**, satellites change *more*, not less.

**But the reason he gives shows he is measuring something else, and it is the right
thing.** "Jittered emulations of the hub" is a statement about **information**, not
about update count. Those two quantities come apart precisely here:

| | update frequency | irreducible information per update |
|---|---|---|
| **hub** | low — the key is stable | **high** — nothing else holds it |
| **satellite** | **high** — attributes churn | low — predictable from the hub, so the churn is jitter |

A satellite can change constantly and carry almost nothing, because its changes are
**reconstructible from the hub**. A hub can change rarely and every change be
irreducible.

**So DV2.0's "change rate" is a PROXY for irreducibility, and this is exactly where
the proxy breaks.** Aaron's decorrelation criterion measures the target quantity
directly; "fast-changing" is the observable that usually tracks it in a warehouse,
where high-churn columns happen to be the derived ones. In a society of agents that
correspondence fails — a highly active but highly correlated agent is *busy*, not
*informative*, which is the whole point of pricing contribution by ΔU rather than by
volume ([`every-bug-has-economic-value`](../../.claude/rules/every-bug-has-economic-value.md))
and of the finding that N clones price near one agent's worth.

**Correction to §4b above, which followed the canonical wording:** it said satellites
"change faster." That is true of the *record* and misleading about the *agent*. The
criterion is irreducibility, and the honest phrasing is: a satellite is what can be
**reconstructed** from a hub plus noise — however often it moves.

## 4c. Caution — four things clicked in fifteen minutes

This document was assembled from four messages arriving minutes apart, each of which
fit the previous one. That is precisely the condition
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)
names as a **warning rather than a confirmation signal**: density of resonance is a
prompt to check independence, not a score.

Checking it honestly, the four are **not** four independent confirmations:

| link | independent? |
|---|---|
| extremum framing (§2) | this is the **claim**, not evidence for it |
| empowerment = channel capacity (§3) | **genuinely independent** — a 2005 definition nobody wrote with ρ in mind |
| the 2026-08-09 bound already objective-subject-to-constraint (§5) | **independent** — written a month earlier, for a different purpose |
| DV2.0 hub/satellite (§4b) | **weakest** — it re-describes the same ordering in another vocabulary rather than testing it |

So: two independent supports, one restatement, and the claim itself. That is a
reasonable place to be for a `toy`, and it is nowhere near an identification. The
§6 measurement remains the only thing that would move it.

## 5. This lands on an existing doc, not a blank page

[`2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md`](2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md)
already derived this exact shape for the social bound, a month before today's ferry —
including the finding that a naive blend is **vacuous** (`w·(μ+k₁σ) + (1−w)·(μ−k₂σ)`
collapses to `μ + k′σ`, one agent's bound with the dial turned down), so the mix
*must* be structural:

```
empowermentBound(self, other, oracles) =
    max over candidate interactions a of  jointOptionGain(a, self, other, oracles)
    subject to  trustBound(self,  after(a), oracles) ≥ τ_self
                trustBound(other, after(a), oracles) ≥ τ_other
```

That is objective-subject-to-constraint, already written down. **Today's ferry says
the ρ ceiling has the same origin** — which, if it survives, means the two were never
separate designs.

## 6. The falsifier

The band framing had none. The extremum framing has one, and it is the same
measurement already named as open in
[`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):

> **Measure the greatest decorrelation at which reconciliation still succeeds.**

A negative result is available and cheap to state: **if that ceiling sits at the
non-signalling maximum, the reconcilability constraint is not binding and this
conjecture is wrong.** Measured over agent pairs, not derived from axioms.

Existing instruments: `src/Core/Tsirelson.fs` (locks `S² = 8` in integer arithmetic,
irrational only at readout) and `src/Core/BipartiteMachZehnder.fs` (`correlator` /
`classifyS`, described in-tree as the honest decorrelation meter for commit pairs).

## 7. Standing caution, applied to this document

`FourCornerC4.fs:346-353` carries a deliberate in-tree warning, verbatim:

> *"Classical floor 2 × that factor equals 2√2 as a number. Otto 2026-08-27: that
> lining-up is numerology, not identification. ... Two agents with a FourCorner
> throttle approaching 2√2 is an assumption, not a measure. What is measured at L=0 /
> shared seed is S=4 (`FeedbackThrottle.measuredSeedSharedS4`). 2√2 is a predicted
> latency-degradation floor — to be measured."*

**This document must not become the thing that warning exists to prevent.** Note it
also supplies the one number here that IS measured — **S=4 at shared seed** — and it
is the *starting* point, not the ceiling. Nothing here licenses writing 2√2 into code, a constant,
or a discharge row. It licenses one measurement.

## Pointers

- [`anti-babel-preserve-reconcilability.md`](../../.claude/rules/anti-babel-preserve-reconcilability.md) — the ρ→0 guard and the two-cliff framing this sharpens
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — why this stays `toy` until the §6 measurement exists
- `docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md` — ρ is not a scalar, which the §4 table simplifies
- Salge & Polani 2017, *Empowerment as Replacement for the Three Laws of Robotics*; Du et al., *AvE: Assistance via Empowerment*, NeurIPS 2020
