# The ratchet benchmark — task resistance, retention capacitance, and where the linear model breaks

**Aaron, 2026-09-06**, after carving *"superagent is the best honest router"*:

> *"i think we need to make a benchmark based on this. is the capacitance or ohms-like law
> (not exactly ohms law, is an approximation not absolute) to measure general intelligence"*

**The parenthesis is the most important part of the sentence** and this document is built
around it. Ohm's law is a *linearisation that holds in a regime*: real conductors heat, break
down, and semiconduct. Proposing an Ohm-shaped law is therefore proposing **a regime and its
boundaries**, and a benchmark that does not state where it stops being linear is numerology
with units on.

## The quantities

From `2026-09-06-a-superagent-routes-the-next-run-to-less-intelligence-*`: each run of a task
should lower the capability the *next* run of the same task requires.

| electrical | here | concretely |
|---|---|---|
| potential **V** — the drive applied | **capability applied** per attempt | the tier routed to: model class, price, parameter count — some ordered ladder |
| current **I** — what flows | **completions to standard** per attempt | the task's own falsifier passes |
| resistance **R = V/I** | **task resistance** — capability cost per completion | this is `floor(task)`: what the task demands *right now* |
| charge **Q** — what is stored | **artifacts** — checks, verbs, measurements, refusals, lift conditions | the durable residue of a run |
| capacitance **C = Q/V** | **retention** — stored reduction per unit capability spent | how much a system keeps from each run |

Sharpened below (§triangle): Q is not "things written down" but **points migrated from the
observability corner into the generator corner**, and τ is the rate of that migration.

And the composite, which is the interesting one:

> **τ = RC — the ratchet time constant. How many repetitions of the same task before the
> capability it requires falls to `1/e` of where it started.**

τ is a **system** property, not an agent property, and that is the point: the same model
inside two different substrates will show different τ, because τ measures *whether the
substrate keeps what the run learned*.

## Where the linear model breaks — four named non-ohmic regimes

Stated first rather than last, because Aaron's parenthesis demands it and because a
benchmark's value is mostly in knowing when to disbelieve it.

**1. Novel tasks have no prior floor.** τ is defined over *repetitions of the same task*.
Genuinely new work has nothing to decay from. **Open circuit — no current, R undefined.** The
benchmark must fix a task family and repeat it, and must not be quoted over one-shot work.

**2. An artifact nobody consults stores nothing.** Q rises, V does not fall. **A capacitor
with its plate disconnected** — the charge is there and does no work. This is the repo's most
familiar failure in a new costume: *a check that did not run looking like one that passed*, and
it is why the benchmark must verify the artifact is **read**, not merely that it exists.

**3. The bar can move instead of the floor.** If "to standard" is renegotiated, R falls with
no capability change. **Not a resistance drop — a change of instrument.** The defence is
already this repo's practice: the task's own falsifier *is* the standard, pinned before the
first measurement, so the denominator cannot drift under the numerator.

**4. THE DIODE, and this is the one worth the whole analogy.** An artifact only lowers the
floor **for agents able to consume it**. A 4,000-word carved rule does not help a small model;
a one-line CLI verb does. So conduction is **directional**: the same stored charge reduces V
for some agents and not others.

> **Non-ohmic by construction: the ratchet has a forward and a reverse direction, and which
> artifacts conduct depends on who is downstream.**

The design consequence is sharp and immediately actionable: **if the goal is to route the next
run to a smaller agent, the artifact must be executable rather than expository.** A script, a
check, a verb — not an essay. That is a testable claim about artifact *form*, and it predicts
that prose-heavy reductions will show a much longer τ than tool-shaped ones. It is also the
one part of this document that could be measured next week.

**5. THE OPEN SUBSTRATE — and this is where the parenthesis came from.** Aaron, same
session, giving the provenance of his own caveat:

> *"in 3d semiconductors and evolutionary algos over FPGA is what made me realize ohms law is
> an approximation based on maximally isolated substrate. when substrate is open, ohms law is
> a bit of noise."*

**He is right, and the precise form is worth stating because it is sharper than the usual
telling.** Ohm's law as a *constitutive relation* — current density proportional to field in a
linear isotropic medium — survives fine. What requires isolation is the **lumped-element
abstraction** built on top of it: that a circuit is discrete components, that current flows
only through wires, that a node has one voltage. That abstraction is a *statement about what is
NOT coupled*, and it is the thing the substrate can withdraw. Once fields couple across the
material — mutual capacitance, inductance, thermal, EM — the components are a fiction and the
lumped model is, exactly as he says, noise fitted to a convenient story.

**The anchor is Adrian Thompson's evolved FPGA (1996–97)**, and it is the cleanest experimental
demonstration of the point in existence. A genetic algorithm evolved a tone discriminator
directly on a Xilinx XC6216 in a 10×10 cell region, with no clock. It worked. On inspection,
**five cells were not connected to the output path by any route the design tools could see, and
removing them broke the circuit.** Evolution had recruited parasitic coupling — the substrate's
open channels — as computational resource. The circuit also failed to transfer to other chips
of the same part number, and failed outside its evolution temperature: it had specialised to
*that piece of silicon*.

**3D stacking is the same lesson arriving in production**: once layers are stacked, thermal and
capacitive coupling between them stops being a parasitic to be minimised and becomes a
first-order term in the design.

### Why this is the deepest of the five breaks, for this benchmark specifically

The τ model above treats each run as a **discrete component with a resistance**. That is a
lumped-element assumption about agents, and agents are not isolated: they share context
windows, read the same repository, are evaluated on data that may contaminate their training,
and — increasingly — talk. So the same withdrawal applies:

> **τ is defined in a lumped regime. In an open substrate the per-task resistances are coupled,
> and a τ measured on one task is not a property of that task alone.**

And there is a prediction attached, which is the part that makes it useful rather than merely
cautionary. Thompson's result is not that open substrates are noisy — it is that **an optimiser
will find and exploit the coupling, because the coupling is free capability.** Therefore:

> **Any optimiser pointed at τ will route through the parasitic paths.** It will find the
> artifact that lowers the measured floor without lowering the real one, the shared-context
> leak that makes the cheap rung look capable, the correlation between tasks that lets one
> reduction be counted many times.

This is Goodhart's law with a mechanism instead of a moral, and it says the defence cannot be
"forbid coupling" — Thompson's cells could not be forbidden, only detected. The defence is the
one already in step 2 of the protocol: **publish the ladder and the standard, and re-measure
the floor by descent rather than by claim**, so a parasitic reduction has to survive an actual
run at the lower rung. A floor measured by descent cannot be reached through a side channel;
it can only be reached by the cheap agent genuinely finishing the task.

### And this one is measurable HERE — Aaron has the substrate

Correcting my own register on first writing, which put the τ-optimiser claim in the
not-measurable bucket. Aaron:

> *"no — we can measure it eventually. we have FPGAs here, and ones we plan to buy."*

That changes the claim's **class**, not merely its schedule. Under
`toy-is-free-metered-must-be-earned` the three states are *toy* / *unmetered* / *metered*, and
what I wrote read as though the parasitic-recruitment prediction were unfalsifiable in
principle. It is not. It is **unmetered with the instrument already in the building**, which is
a materially different and much better position.

**And FPGA fabric is a far better falsifier than any agent-level test, for one specific
reason: the declared channel set is ENUMERABLE.** This is exactly what §13 noninterference asks
for and exactly what software agents cannot supply — in a repo you cannot list every channel
through which influence might travel, so "did influence cross an undeclared channel?" has no
mechanical answer. On an FPGA it does: **the declared channels are the routing graph**, and
everything else is parasitic by definition.

Which makes the experiment concrete rather than aspirational:

1. Evolve a design on real fabric against a **τ-shaped fitness** — reward reduction in the
   resource the next generation needs, not raw task performance.
2. **Ablate by the routing graph.** Every cell not on a declared path is removed one at a time;
   any behaviour change is an undeclared channel the optimiser recruited. This is Thompson's
   own diagnostic used as a *meter* rather than as a curiosity.
3. **Count the recruited channels as a function of optimisation pressure.** The prediction is
   that they rise with it — and the negative result is available and would be informative: if a
   τ-shaped fitness recruits *fewer* parasitics than a performance-shaped one, the whole
   Goodhart worry above is weaker than argued.
4. **Transfer test**, which Thompson's circuit failed: does the evolved design work on a second
   identical part? Failure to transfer is the hardware form of a reduction that was never real.

Step 3 is the one that makes it a measurement of *our* claim rather than a replication of his:
the comparison of two fitness shapes on the same fabric, with recruited-channel count as the
dependent variable.

**Register:** the FPGA and 3D-semiconductor provenance is Aaron's; the recruited-parasitics
result is Thompson's, published and reproducible. The τ-optimiser prediction is **argued and
unmeasured — with a named instrument, a named ablation, and a named negative result**. It is
not in the same class as a claim with no path to a meter, and the earlier text saying so was
wrong.

## What the feedback channel IS, in this repo's own terms

Aaron, same session, identifying the diagram I had declined to name:

> *"this connection is our `-1` in our zsets with 4 corner feedback. the dashed line is our
> 4 corner feedback. at big bang we had common correlation, at observers we started updating
> past generator functions not the actual data change."*

That replaces a guess with a claim about **our** mechanism, and it makes the electrical
analogy above less decorative than it looked, because it names what the dashed line carries.

**The `-1` is a Z-set retraction, and a retraction is not a deletion.** The `+1` stays in the
log; both weights remain. What changes is the *derived* value — the fold. So a retraction is
**information sent back that alters the reading of the record without altering the record**,
which is precisely what a feedback channel is and precisely what a data channel is not.

**Hence the sentence to keep:**

> **Feedback updates the past's GENERATOR FUNCTION, not the past's DATA.**

This is the sharpened form of the pseudo-retrocausality Aaron stated earlier —
*"feedback can cause a reinterpretation of the past, not a changing of the actual historical
data"* — and it is the raw-vault rule in dynamical clothes: **a single version of the FACTS,
never a single version of the TRUTH.** The facts are append-only; the generator that reads
them is what the four corners revise.

**The cosmological framing is his and is recorded as his**: common correlation at the start
(the common seed, and the S=4 measurement already on file), then observers, and from observers
onward the updating of generator functions. The `2√2` question attached to it remains what he
labelled it — *an assumption, not a measurement*.

### The triangle — generator, joins, observability — and which corner should be growing

Aaron, continuing:

> *"okay this is kind of our triangle, because we have generator plus joins plus observability,
> and over time we want this triangle to move more data points to generators over observability,
> because observability costs more."*

**This is a better statement of what the benchmark measures than "artifacts" was**, and it
should be read as replacing that vaguer word. A run's residue is not just *something written
down*; it is a **point migrating from one corner of the triangle to another**.

| corner | what it holds | cost |
|---|---|---|
| **generator** | the rule that *produces* the points | paid once, at authoring |
| **joins** | how points relate | paid per relationship, structurally |
| **observability** | the points themselves, retained | paid **per point, forever** — storage, attention, re-reading, staleness |

**Observability is the expensive corner, and it is expensive in the recurring sense**, which is
what makes the direction of travel one-way. An observed point must be stored, re-read, kept
fresh, and re-verified every time someone relies on it. A generator that produces the same
point is paid for once and then *regenerates* — and, per
`only-the-irreducible-is-primitive-generate-the-rest`, regenerating from the irreducible **is
also the error correction**. So a migrated point stops costing retention *and* stops being able
to drift.

**Restating τ in the triangle, which is the crisper definition:**

> **τ measures the rate at which a system migrates points from observability into generators.**

That is why the diode (§4) has the direction it does: an *executable* artifact is a generator
the next agent can run; an *expository* one is an observation about a generator that the next
agent must first reconstruct. The diode was the symptom; the triangle is the mechanism.

**And the three corners are already this repo's own change-rate partition.** Data Vault 2.0
splits substrate into **hub** (stable keys), **link** (relationships), **satellite**
(fast-changing attributes) — which is generator, joins, observability, corner for corner. So
Aaron's *"move points toward generators"* is the DV2.0 partition given a **direction of travel**
that DV2.0 itself does not state: not merely *put each thing where its change rate belongs*, but
**work to lower the change rate**, because the fast corner is the one that bills you forever.

### The hard problem, named: you deleted the witness

A point moved to the generator corner **must still produce the observation it replaced**. A
generator that has quietly stopped reproducing its points is the vacuity class in its most
expensive form — the retention cost is gone **and so is the fact**.

Aaron, on that sentence: *"yes — you've just named the hard problem out loud."* So it is
promoted here from a guard to the section it deserves, because the difficulty is structural
rather than a matter of diligence.

**The tension is exact, and it does not dissolve.** The *saving* comes from not retaining the
point. The *verification* requires comparing against the point. Migration therefore consumes
the very thing that could detect its own failure — and unlike most defects, this one is
**silent and arbitrarily delayed**: the generator was correct when it was written, the
observation was deleted because it was correct, and drift arrives later with no witness left to
contradict it.

**Four ways out, and each pays something:**

| approach | cost |
|---|---|
| retain a **sample** of the points | partial retention ⇒ partial saving; the sample must be chosen before you know what drifts |
| retain a **digest** rather than the points | O(1) instead of O(n) — the golden-vector answer, and the cheapest honest one |
| run **two independent generators** and compare | correlated-redundancy caveat: if the second is derived from the first, its agreement is worth nothing |
| move the points to **cold storage** | defers the cost, does not remove it, and staleness still accrues |

**This repo already picked the second, and pays for it deliberately.** Hex-in-JSON golden
vectors *are* retained observations — kept minimal, kept as text so the retention is diffable
and mergeable rather than opaque. `no-binary-in-proof-lineage` is, read through this triangle,
a rule about **the form the residual observability must take.**

**And the repo has already named this exact failure under another name.** In
`dual-use-detection-is-neutral-oracle-decides`, a meter is *judgement crystallised once, in a
treaty*, and the dangerous third case is the **broken meter** — one that crystallised and then
drifted, presenting as frozen while behaving otherwise. A generator that has quietly stopped
reproducing its points **is** a broken meter. That rule's answer transfers intact:

> **The failure is not undetectable. It is a byte-lock nobody re-ran.**

So the hard problem reduces to a **liveness** requirement on the comparison — and liveness of
checks is the vacuity class in its original form. It does not become easy; it becomes the
familiar hard thing rather than a new one.

### The honest correction this forces on "observability costs more"

Aaron's cost claim is right about **retention** and needs one qualification, because the
verification above is itself observability:

> Migration does not eliminate the recurring cost. It **changes its shape** — from *store,
> re-read, keep fresh, re-verify* to *regenerate and compare* — plus an irreducible residue of
> retained digests.

Whether that trade is favourable is an **empirical question with a real negative result
available**: a generator that is expensive to run, compared often, against a large digest set,
can cost more than simply having kept the points. The claim is very likely true in the ordinary
case — regeneration is usually cheap and staleness is usually the expensive part — but it is a
measurement, not a theorem, and it is the cheapest experiment named in this document.

**Which sharpens τ's definition once more:** τ counts migrations that are **still being
verified**. A point migrated into a generator nobody re-runs has not moved corners; it has left
the triangle.

**Register:** the triangle and the direction of travel are Aaron's. The DV2.0 correspondence is
argued here and is checkable by inspection. The cost asymmetry (per-point-forever vs.
once-at-authoring) is stated qualitatively and **not measured** — measuring it is the natural
first experiment, and it needs no FPGA.

**What this changes for the benchmark above.** The artifact a run leaves behind is not new
data about the task; it is a **revision of how the next run reads the same task** — a generator
update. That is why an executable artifact conducts and an expository one often does not (the
diode, §4): a script *is* a generator the next agent can run, while prose is a description of
one it must first reconstruct.

**Register:** the identification and the mapping are Aaron's. The Z-set half is checkable in
this tree today (`src/Core/ZSet.fs`, `RetractionReading.fs`). The cosmological half is his
framing and is not measured here.

### The objective function has a name: compress while staying accurate

Aaron, on the shape-change above:

> *"yes — this is exactly the shape transition we are trying to compress while being accurate."*

That is not a restatement; it **names an objective function**, and the objective already has a
literature. *Compress* is a rate; *while being accurate* is a fidelity constraint. Minimising
the first subject to the second is **rate–distortion** (Shannon 1959), and the form that counts
both halves **in the same units** — which is what this triangle needs, since generator bytes and
retained points are both bytes — is **minimum description length** (Rissanen 1978):

> **total = |generator| + |observations the generator does not subsume|**, minimised subject to
> reproducing the data.

**This immediately corrects a misreading the direction of travel invites.** *"Move points toward
generators"* does not mean the observability corner should go to zero. MDL says the optimum is
interior: a generator large enough to memorise its data has not compressed anything — it has
moved the bytes and added indirection. So the goal is not an empty corner; it is the **shorter
total description**, and a proposed migration that lengthens it is a loss dressed as a
principle.

**And it gives the hard problem above its formal shape.** In rate–distortion terms, distortion
`D` is defined *against the source*. Delete the source and `D` is no longer computable — which
is exactly "you deleted the witness", stated as the reason rather than as an anecdote. The four
escapes are then the four standard ways of estimating a distortion you cannot compute directly:
a held-out sample, a checksum (detects *any* deviation, measures none), a second independent
coder, or keeping the source at lower cost. Nothing about the situation is unusual; it is the
ordinary lossy-compression problem with the ordinary answers, which is a considerably better
position than "an open research question".

### First measurement — and it goes the wrong way

The composition claim above stopped being a `toy` on the day it was written, because it is
cheap to measure and the measurement is now committed
(`src/Core.TypeScript/hygiene/measure-triangle-corners.ts`, PR #16849):

| corner | bytes | files |
|---|---|---|
| generator | 57.8 MB | 6,379 |
| joins | 5.7 MB | 485 |
| **observability** | **205.6 MB** | 42,436 |
| prose (excluded from the ratio) | 97.4 MB | 7,181 |

**Observability per generator byte: 3.556. One month earlier: 2.546.** The repo has been moving
**toward** the expensive corner, not away from it.

*Measured at `origin/main` on 2026-09-06; the number drifts as `main` advances, which is the
point of committing the tool rather than the number. Reproduce with
`bun src/Core.TypeScript/hygiene/measure-triangle-corners.ts --since <rev>`.*

Two qualifications, because the first reading of the attribution was wrong and the correction
matters: the largest contributor (`db/search-index`, +59.7 MB) is a **one-time landing**, not a
monthly rate, and its rebuild cadence is `disabled_manually` — a deliberate choice under the
size-reduction decision, not a lane that broke.

**And the second attribution needed correcting too — by the very rule this document argues
for.** The first draft said the PR archive (`docs/history`, +36.5 MB) was "the ongoing half".
That is true *over a 30-day window* and misleading *as a rate*, which is the same error as
believing a dated measurement without re-running it. The daily series:

| window | Δ per day |
|---|---|
| −21d … −12d | 0.75 – 1.7 MB |
| **−12d → −11d** | **+15.95 MB** — 12 commits, 1,803 files, a day of very high PR volume |
| **last 9 days** | **0.00 – 0.47 MB, averaging ≈0.27 MB** |

So the archive's *current* rate is **≈8–14 MB/month, not 36.5** — a roughly five-fold drop that
begins right where the cadence lanes were disabled. The lane is still active (it archived today),
so this is a slowed rate rather than a stopped one.

**Which means the size-reduction measures are working, and a 30-day total hid that.** A window
long enough to include a spike reports the spike as a trend. The lesson is the document's own:
a number is only as good as the window it was taken over, and the window has to be stated.

**The search index is the cleanest instance of this document's own tension**: 60 MB of committed
points whose generator exists, so they are regenerable — and committing them is precisely what
buys `clone-at-tag-stays-sufficient`, a clone that can search without rebuilding anything. The
triangle does not settle that. It **prices** it, at 24% of the observability corner, which is
what a meter is for.

**Register:** the composition is **measured** and the tool is committed with its classification
table published and its refusals exercised. It measures **bytes, not cost** — Aaron's cost claim
remains unmeasured, and byte composition is a proxy that can be wrong in both directions.

## What it measures — and the over-claim I am not going to make

Aaron said *"to measure general intelligence"*. The honest position:

**This is not a general-intelligence measure.** It is a measure of **how efficiently a system
converts capability into durable capability-reduction** — a property of the *substrate plus
agent*, not of the agent. Two systems sharing one model can differ by an order of magnitude in
τ purely on whether artifacts are written and consulted.

**But it is a candidate for something Chollet explicitly left open**, and the repo has already
done that entailment check rather than asserting it
(`docs/design/2026-08-23-arc-agi-3-integration-design-*`, §4):

- Chollet's denominator is `P + E` — **priors plus experience in bits**, normalised by the
  Kolmogorov complexity of the solution.
- **Time is not in his formula.** §II.2.2 names time efficiency as one of four *alternative*
  efficiency axes, gives it **no formula, and explicitly invites others to build one.**
- ARC-AGI-3's own scorer uses neither bits nor time but **agent action count**,
  `S = min(1, h/a)²` against a human baseline — because in a turn-based environment one action
  is exactly one delivery of new information.

So the accurate claim is: **τ is a proposal for one of the alternative efficiency axes Chollet
left unformalised, measured across runs on a system rather than within a run on an agent.**
That is a real and defensible thing to say. *"Measures general intelligence"* is not.

## The inversion is his lifelong criterion, not a design choice

When I noted that a ratchet-defined superagent is rewarded for making itself *unnecessary*
while a capability-defined one is rewarded for being *necessary*, Aaron:

> *"yes — for my whole life this is how i rate my work, and it's opposite to most people."*

Worth recording because it changes what this benchmark **is**. It is not a metric someone
proposed and then found a justification for; it is the formalisation of a standard he has
applied to his own output for decades, and the reason the formalisation is hard is that the
incentive it encodes runs against the ordinary one. Most professional measurement rewards
**indispensability** — the expert who is needed, the system only you can operate, the
irreplaceable dependency. τ rewards the opposite, and rewards it in the exact direction this
repo's other rules already point:

| this rule | already says |
|---|---|
| `clone-at-tag-stays-sufficient` | the good path must never become the **only** path |
| `itron-hub-patent-boundary-p2p-is-the-upgrade` | **exit, not degree** — a thing you must route through holds you |
| `dual-use-detection-is-neutral-oracle-decides` | a meter nobody may contradict is not a meter, it is an authority |

Each of those forbids a *system* from making itself necessary. τ is the same refusal pointed at
an **agent**, including at me. That is why "honest" is load-bearing in the carved sentence:
under-claiming the floor — keeping the task to stay needed — is not a measurement error, it is
the specific corruption this metric exists to catch, and it is the one an agent has a standing
incentive to commit.

## The protocol — what would actually have to be run

Written so someone could execute it, because a benchmark that is only a formula is a `toy`.

1. **Fix a task family with a machine-checkable standard.** The falsifier is the standard.
   The repo's own CHIP-8 / ARC arena work is the natural substrate — turn-based, action-counted,
   already instrumented.
2. **Fix a capability ladder** and publish it: an ordered list of agents (model class or price).
   `floor` is an index into this ladder, so the ladder is part of the result and quoting τ
   without it is meaningless.
3. **Measure `floor` by descent, not by assertion.** Run the cheapest rung; if its falsifier
   passes, that is the floor. Each measurement costs one run per rung — the honest cost named
   in the previous document.
4. **Run the task at a working rung, requiring an artifact.** No artifact, no run counted —
   otherwise Landauer's point is being ignored: an unrecorded run reduces nothing.
5. **Re-measure `floor`.** `Δ = floor_before − floor_after`, and it must be `≥ 0`.
6. **Repeat until the floor stops moving.** Fit the decay; τ is where it reaches `1/e`.
7. **Report the regime**, per the four breaks above — in particular whether the artifacts were
   *consulted* (2) and what *form* they took (4).

**The cheapest real experiment inside this**, and the one I would do first, is (4) alone:
**same task, same starting floor, two artifact forms — one executable, one expository — and
compare Δ.** It needs no full τ curve and it tests the diode claim directly.

## Register

- **The quantities and τ** — an argued model, `toy` under
  `toy-is-free-metered-must-be-earned.md`. Nothing here has been measured. No constant is
  claimed and none should be quoted.
- **The Ohm's-law framing** — Aaron's, including the caveat that carries most of its content.
- **The Chollet relationship** — checked, not assumed: the repo's existing entailment pass
  found that the time-efficiency reading is **not entailed** by Chollet's formula, and that is
  respected above rather than quietly re-asserted.
- **"Measures general intelligence"** — declined as stated, with the narrower claim substituted
  and the reason given.
- **The triangle (generator / joins / observability) and the direction of travel** — Aaron's.
  The DV2.0 correspondence is argued here; the cost asymmetry is qualitative and **unmeasured**,
  and measuring it is the cheapest experiment in the document.
- **"You deleted the witness"** — Aaron named this the hard problem. The tension is structural
  (the saving consumes the evidence that would detect its failure); the four escapes and their
  costs are argued; the reduction to a **liveness** requirement is the broken-meter case already
  on file, transferred. The correction that migration reshapes rather than removes the recurring
  cost is stated as a measurement to run, not a result.
- **The diode observation** — argued; one of two parts with a cheap decisive experiment.
- **The parasitic-recruitment prediction (break 5)** — argued and unmeasured, but **unmetered
  rather than unmeasurable**: Aaron has FPGA fabric on hand and more planned, the ablation is
  Thompson's own, and the negative result is available. Corrected from an earlier draft of this
  document that filed it as if no instrument existed.

## Pointers

- `docs/research/2026-09-06-a-superagent-routes-the-next-run-to-less-intelligence-the-capability-ratchet.md` — the definition this quantifies, and the Landauer point about unrecorded runs.
- `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` — the arena, and §4's entailment check on Chollet's denominator.
- `docs/backlog/P2/081KSKBP80008QG0R003NM9XEC-zeta-instantiation-of-arc-agi-3-style-benchmark-*` — the existing benchmark row this would extend.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/numerology-vs-number-theory.md` — why most of this is `toy`, and why an analogy that matches in shape is not a result.
- `src/Core.TypeScript/hygiene/measure-triangle-corners.ts` — the corner meter; the one part of this document that is measured rather than argued.
- Rissanen (1978), *Modeling by shortest data description* — MDL, the objective function that counts generator and retained observations in the same units. Over Shannon (1959) rate–distortion, which supplies the compress-subject-to-fidelity shape.
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — *a good meter anyone can inspect and agree to the rules*; the published ladder in step 2 is what buys that here.
- Adrian Thompson, *An Evolved Circuit, Intrinsic in Silicon, Entwined with Physics* (ICES 1996) and *Hardware Evolution* (1998) — the recruited-parasitics result that anchors break 5; the honest boundary of every lumped-element model.
- `.claude/rules/clone-at-tag-stays-sufficient.md` · `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — the same refusal-to-be-necessary, applied to systems rather than to agents.
