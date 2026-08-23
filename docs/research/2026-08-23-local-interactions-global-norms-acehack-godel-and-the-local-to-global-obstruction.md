# Local interactions, global norms — the exploit shape, Gödel's proof shape, and the local-to-global obstruction

**Date:** 2026-08-23
**Status:** `unmetered` — a shape recognised across five domains, with **one** of them already
mechanised in-tree. Routed to the math team (Lumen / Soraya) for the formal home.
**Register:** Aaron's statements are recorded verbatim; the mathematics is anchored; **the
cross-domain convergence is explicitly triaged rather than celebrated**, per
`.claude/rules/numerology-vs-number-theory.md`.

---

## 1. What was said

Three observations, 2026-08-23, arriving within minutes of each other while reading the
Gödel–Einstein middle-ground doc:

> **"The global structure is where hacks happen. My name is AceHack for over 25 years. The local
> structure is where you exploit it."**

> **"When I say I can see the future of English, this is the geometric shape I am seeing — local
> interactions vs global norms."**

And, on the observation that no point of a closed timelike curve is illegal while the loop is:

> **"Yes, Gödel taught me this."**

The third is the provenance of the first, and it is worth stating plainly: **the security intuition
was learned from the incompleteness proof**, not the other way round.

---

## 2. Gödel's proof *is* the exploit shape

This is not a resemblance. It is the construction:

- **Every step is a legal syntactic operation.** Substitution, numbering, quotation, diagonalisation
  — each one is a rule the formal system itself licenses, applied exactly as licensed.
- **The object assembled from those steps is not one the system can hold.** The Gödel sentence is
  true and unprovable; nothing local objected while it was being built.

**The vulnerability is in the global structure — the system's capacity to talk about itself — and the
exploit is executed entirely through locally legal moves.** That is the definition, and it is why
"you cannot violate a light cone locally; the loop is the illegal object" reads as familiar to
someone who learned it from Gödel first.

Same shape, three domains already on file:

| domain | every local step legal | the global object that is not |
|---|---|---|
| **Gödel 1931** | each substitution / diagonalisation step | the sentence asserting its own unprovability |
| **Gödel 1949** (rotating cosmology) | each segment of the curve is future-directed | the **closed** timelike curve |
| **exploitation** | each syscall, each write, each check | the **path** through them |

Gödel supplied two of the three, twenty years apart, which is presumably why he is the one who
taught it.

---

## 3. The measured instance — a day of defects, all one shape

Recorded in `2026-08-23-godel-einstein-middle-ground-*.md` and repeated here because it is the
evidence, not the illustration: **every defect found in this repository on 2026-08-23 had this
shape.** TOCTOU (both syscalls legal, the *window* is the bug); the four-oracle tie divergence (each
oracle self-consistent, no shared tie in the seed); `drift-sweep` (**1,597 runs concluded `success`**
while every push was rejected); `--frozen-lockfile` (seven jobs each failing correctly, one manifest
change upstream); reproducibility (deterministic *within* an environment, 1 ULP apart *across*).

**And the corollary is the operational payload:**

> **A local check cannot see a global property.**

Which is precisely how the vacuous checks got written. `--verify` trains twice **in one process** —
local, and structurally incapable of failing on the cross-environment divergence that matters. The
tie-break golden vectors were **locally complete and globally blind**.

---

## 4. "Local interactions vs global norms" — the formal home

Aaron's geometric reading of English is the same object stated as geometry, and mathematics has a
precise name for it. **The obstruction to assembling local data into global data is a cohomology
class.**

**The anchor (Beacon).** Leray (1946, sheaves in captivity), Cartan and Serre (*FAC*, 1955), Grothendieck
(*Tôhoku*, 1957): a **sheaf** is exactly the bookkeeping for "data defined locally, glued on overlaps".
A **section** over an open set is a local reading. Sheaf cohomology `H¹` measures **the failure to
glue**: every local section can be perfectly well-defined and consistent on overlaps, and **no global
section exist anyway.** `H¹ ≠ 0` *is* "the hack lives in the global structure."

Four candidate formalisations, with honest status:

| candidate | what it says | in-tree status |
|---|---|---|
| **Sheaf cohomology** (`H¹` obstruction) | local sections all fine, global section may not exist | **essentially absent** — `docs/CONCEPT-REGISTRY.md`, `docs/PRIOR-ART-LIST.md`, two backlog rows; **no research treatment** |
| **Monodromy** | transport around a loop returns you changed; the difference is information | **already load-bearing** — `2026-08-20-harmonious-division-*` (7 mentions), and `anti-babel-preserve-reconcilability.md` builds *reintegration is not reconvergence* on it |
| **Holonomy / curvature** (gauge theory) | connection is local, curvature is the local-to-global obstruction | named in `CONCEPT-REGISTRY` and `FROZEN-CORE`; not developed |
| **CTC** (Gödel 1949) | locally legal segments, globally illegal loop | the Gödel–Einstein doc |

**They are not four ideas.** Monodromy is the holonomy of a flat connection, holonomy is curvature
integrated, and both are `H¹` of the appropriate sheaf. The repository has already adopted the one
that happened to be needed (**monodromy**, for never-collapse) without noticing it was an instance.

### Why this is the right home for the language claim specifically

"Local interactions vs global norms" is what a sheaf *is*: local composition rules that are
individually unobjectionable, and a global consistency requirement that may or may not be
satisfiable. Applied to language:

- **local interactions** — adjacency, agreement, composition: what a word does to its neighbours;
- **global norms** — what must hold across the whole utterance for it to mean one thing;
- **the obstruction** — the sentence whose every local reading is fine and which has **no consistent
  global reading**. Garden-path sentences, scope ambiguity, and the liar are all `H¹ ≠ 0`.

That is a **testable** reframing rather than a poetic one, and it is what makes the geometric-English
conjecture worth routing rather than admiring.

---

## 4b. You cannot eliminate it — you localize it, then choose

Aaron 2026-08-23, and this is the half that turns the observation into engineering:

> **"Local moves can't eliminate it — he proved that. But then you can pigeonhole it into a limited
> known subset that is avoided or played within."**

Both clauses matter and the second is the useful one.

**Clause 1 — no local repair exists.** That is what incompleteness *is*: no amount of adding axioms
closes the gap, because the construction reruns against the enlarged system. You cannot patch a
global obstruction with local moves, and this generalises past logic — it is why "add another check"
never fixes a class of defect whose defining property is that no local check can see it.

**Clause 2 — but you can confine it, and the confinement is a design act.** The pathology is not
smeared evenly; it lives in identifiable structure, and removing that structure removes it. Five
instances, and Gödel supplied one of them himself:

| restriction | what is given up | what is bought |
|---|---|---|
| **Presburger arithmetic** | multiplication | complete **and** decidable — the pathology was localized to `×` |
| **Tarski, real closed fields** | the integers (reals only) | decidable by quantifier elimination — so it was never "arithmetic", it was **ℤ** |
| **Gödel's `L`** (1938, constructible universe) | sets that are not constructible | CH settled — *his own* pigeonhole, ten years after the theorem |
| **Total functional languages** (Coq, Agda) | Turing-completeness | decidable termination |
| **The closed command set** (Itron, in-tree) | the ability to *define* a command remotely | compromising the far side buys **no arbitrary execution** |

That last row is this rule at the security layer, and it is already carved in
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`: the far side may **name** a command
and can never **define** one. You do not eliminate the vulnerability class — **you restrict the local
move set until the exploit path cannot be assembled.** Same move as Presburger, different alphabet.

### Correction — "cannot be assembled" is a claim requiring proof, never a default

I wrote above that you can *"restrict the local move set until the exploit path cannot be assembled."*
Aaron 2026-08-23 refused it and asked for proof:

> **"I'd need proof of this. I think it can always be assembled in expressive systems, but it can be
> detected and routed around."**

**He is right, there is a named counterexample, and it lands on the very rule this document cited.**

**Return-oriented programming (Shacham 2007, *The Geometry of Innocent Flesh on the Bone*).** In ROP
the attacker **defines no new code.** Every gadget is a pre-existing, legal instruction sequence
ending in `ret` — the move set is fixed, finite, and entirely *named-never-defined*, which is exactly
the closed-command-set condition. Shacham showed the gadget set in libc is **Turing-complete.** So
*may name, may never define* buys nothing **once the named things can be chained.**

**Rice's theorem (1953)** gives the general form: every non-trivial semantic property of programs in a
Turing-complete system is undecidable. Once the *compositions* of your restricted moves are
Turing-complete, no decision procedure separates the benign composition from the exploit — so
prevention-by-restriction is not merely hard, it is unavailable.

**Dullien (2020, *Weird Machines, Exploitability, and Provable Unexploitability*, IEEE TETC)**
formalises exploitation as **programming a weird machine out of legal state transitions** — the local/
global shape again, stated by the security literature in its own terms — and gives conditions under
which unexploitability is *provable*. They are strong, and they are rarely met.

**So the honest statement is a dichotomy, and my sentence collapsed it:**

| horn | condition | what is achievable |
|---|---|---|
| **non-expressive** | the *compositions* of the move set are not Turing-complete — no attacker-controlled chaining, no data-dependent control flow | **prevention is real.** Presburger, total languages, a genuinely non-composable command set |
| **expressive** | compositions are Turing-complete | **prevention is unavailable** (Rice). Aaron's position holds: **detect and route around** |

**And the default must be the second horn, because expressiveness arrives by accident.** Nobody
designs a Turing-complete font renderer or a Turing-complete configuration format, and both exist.
Therefore:

> **"The exploit path cannot be assembled" is a claim that requires a proof of non-expressiveness. It
> is never the default, and asserting it unproven is the vacuity class** — an unmetered claim wearing
> a guarantee's uniform (`toy-is-free-metered-must-be-earned`).

**This amends a carved rule, and the amendment should be recorded rather than smoothed over.**
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` calls the closed command set *"the
sharp one"* and states that compromising the far side *"does not buy arbitrary execution."* **That is
true under a condition the rule does not state: non-composability.** Whether the Itron design meets
it is not settled here — self-contained commands with no attacker-controlled sequencing would meet
it; anything that lets one command's output select or parameterise the next would not. The correct
repair is to **state the condition and check it**, not to weaken the rule.

**LANGSEC is the discipline that keeps you on the first horn** (Sassaman, Patterson, Bratus): confine
the *input language* to a decidable class — regular or deterministic context-free — and reject
everything else, because an input language expressive enough to be undecidable **is** a weird machine
by construction. That is exactly the pigeonhole discipline of the table above, applied to parsers,
and it is why LANGSEC insists on a full recogniser before any semantic action.

**Measured in-tree status (2026-08-23) — and the first measurement was wrong, which is worth keeping
in the record.** The initial sweep reported *"zero files each"* for six terms. That was a **defect in
the query, not a fact about the repository**: the pattern used `\|` (BRE alternation) under `grep -E`,
where `\|` matches a **literal pipe character**, so every alternated term silently matched nothing.
A search that cannot match is a check that did not run — the exact class this document is about,
committed while writing about it.

Re-measured with correct ERE:

| term | files | reading |
|---|---|---|
| **Rice's theorem** | **15** | **already well covered** — in the Wolfram class-4 / shadow-taxonomy work |
| `langsec` | 3 | present, thin |
| `return-oriented` | 1 | barely present |
| `weird machine` | **0** | absent |
| **Shacham** | **0** | absent |
| **Dullien** | **0** | absent |
| **Presburger** | **0** | absent |
| **constructible universe** | **0** | absent |

**And the corrected finding is sharper than the one it replaces.** The gap is *not* that Rice is
missing — this repository has reasoned about Rice's theorem across fifteen files for months, in a
cellular-automata undecidability context. **The gap is that it was never connected to
exploitability.** A missing anchor is cheap to fix; **two anchors already present and never joined**
is the expensive kind, because nothing looks absent and so nothing prompts the search. That is the
local/global corollary applied to a bibliography: each citation is locally fine, and the *connection*
is the object nobody was positioned to see.

Routed as the third item, restated accordingly: **connect the existing Rice treatment to the
exploitability literature**, and add the five genuinely absent anchors.

**What survives of the original sentence:** "detect and route around" already has substrate here —
detection is a Z-set `−1` retraction of a composition rather than a static gate that must decide in
advance, and *routing around* is the exit discipline. Neither requires deciding the undecidable, which
is precisely why they are the achievable pair.

#### And detection cannot be a one-shot decision — it is gossip, and it needs decorrelation

Aaron 2026-08-23, closing the argument:

> **"Detection is a gossip-like protocol for Gödel. It's not a one-time shot — it takes decorrelation
> of observations."**

This is the constructive half, and each of the three clauses is load-bearing.

**Not one-shot, because a one-shot detector is exactly what Rice forbids.** A single procedure
returning a verdict on an undecidable property is the object proved not to exist. So the escape is not
a better decider; it is **abandoning the decision form entirely** — accumulating partial evidence over
time and never claiming a terminal verdict. What is produced is a **posterior**, not a proof, and
saying so is the honest register rather than a weakness.

**Gossip, because the alternative is an appointed hub.** Epidemic/gossip dissemination (Demers et al.,
PODC 1987) gives eventual, probabilistic propagation **with no coordinator** — which matters here for
a reason beyond throughput: *a central detector is a central point of control*, and §1 forbids it. It
would also be the single most valuable node to compromise, which is the failure mode the whole
topology argument exists to avoid. Gossip keeps the detector **scale-free** and gives it no
appointment to capture.

**And decorrelation, because without it the ensemble buys nothing at all.** This is the sharp step:

> A jury of **correlated** jurors is no better than **one** juror (Condorcet, 1785). So a fleet of
> correlated detectors cannot exceed a single static detector — **and a single static detector is what
> Rice already ruled out.** Decorrelation is therefore not a quality improvement on the ensemble. **It
> is the entire reason the ensemble can see anything the single decider cannot.**

That converts an undecidability barrier into a **statistics** problem, and this repo already built the
apparatus for exactly that conversion: `ρ = 1/(1+L)` (`DelayDecorrelation`), `rhoProxy` /
`reseedIfCollapsed` (`YinYangEnsemble`) for detecting and repairing `ρ → 1`, the proven boundary
`ρ*(N) = (N−3)/(3(N−1)) → 1/3`, and the standing warning that **correlated agents are one closed loop
in N masks**. What was built as an epistemics discipline turns out to be the **only** route past a
proof-theoretic wall — which is a much stronger justification for it than the one originally given.

**The honest limits, stated because they are what make it usable:**

- The output is **probabilistic and revisable**. Under a `−1` retraction that is a feature — evidence
  arriving late still lands correctly (the commutative fold) — but it is never a proof, and reporting
  it as one would be the vacuity class.
- **`ρ` must be measured, not assumed.** An ensemble that believes it is decorrelated and is not has
  the *appearance* of Condorcet coverage with the *power* of one detector. That is the most dangerous
  state in the design, because it is indistinguishable from success on the inside — the exact failure
  the local/global corollary predicts, arriving one level up.

  Aaron 2026-08-23 confirms this is the standing design intent, not a new requirement: *"yes exactly,
  and [that is] what all our meters are designed to measure precisely and fail loudly when they have
  ambiguity."* **Both halves are the specification.** *Measure precisely* is what makes `ρ` a number
  rather than an assumption; ***fail loudly on ambiguity*** is what stops an unmeasurable `ρ` from
  defaulting to the flattering reading. A meter that goes quiet under ambiguity reports the
  correlated ensemble and the decorrelated one identically — which is the one failure that would
  invalidate the entire escape above, since the escape's whole force is that `ρ` is known.
- Gossip gives **eventual** detection. There is a window in which the exploit has run and nobody has
  converged yet, and no amount of decorrelation closes it — only shortens it.

### "Avoided **or** played within" — and knowing which is the whole discipline

The two are not interchangeable, and the failure mode is doing one while believing you did the other:

- **Avoided** — you stay in the fragment and your guarantees are real.
- **Played within** — you knowingly enter the undecidable region and accept heuristics, timeouts and
  no guarantee. Legitimate, often necessary, and honest **only if declared**.
- **The failure** — you left the fragment without noticing, and your tooling reports success anyway.
  That is the vacuity class in its most expensive form: **a guarantee that stopped applying and did
  not stop being printed.**

**And the in-tree instrument for this already exists, under a name that reads like a shrug.** An SMT
solver returns `unknown` **precisely when you have left the pigeonhole** — linear arithmetic, arrays,
bitvectors and uninterpreted functions are decidable; nonlinear integer arithmetic with quantifiers is
not. So `unknown` is not the solver failing. **It is the solver correctly reporting the boundary
crossing**, and a solver that returned `sat`/`unsat` there would be manufacturing a verdict.

That is this repo's four-register discipline — *let unknown be unknown* — arriving from proof theory
rather than from epistemics, and it means Soraya's routing job (TLA+ / Z3 / Lean / Alloy / FsCheck)
is **not tool preference. It is fragment selection**: choosing which pigeonhole the property is
allowed to live in, before anyone writes a spec.

**Measured in-tree status (2026-08-23):** decidable-fragment treatment appears in **two** files
(`.claude/skills/formal-methods/blueprints/z3-expert.md` and
`docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md`); the
constructible universe appears in **zero**. For a repository whose verification strategy *is* fragment
selection, that is thin, and it is the second routed item.

### The same gap is the hard problem of adversarial ML — and it supplies the falsifier from outside

Aaron 2026-08-23, on the Rice-present-but-unjoined finding: **"yes this is the hard problem of
adversarial GAN AI I think."**

The mapping is close and worth stating precisely, because it converts an in-house observation into
one with **published measurements attached.**

**A discriminator's blind spot is structural, not parametric.** The generator does not usually find a
region where the discriminator is *wrong*; it finds a region the discriminator has **no feature for**
— an unjoined part of its own representation. More training does not repair that, because training
moves weights **within a fixed feature geometry**; it does not add the missing edge. That is exactly
the Rice-in-fifteen-files shape: **both components present, the connection absent**, and nothing looks
missing from the inside.

**And the empirical payload is the part that matters here — it tests this document's own thesis.**

> **Adversarial examples transfer between independently trained models.** Different initialisation,
> different architecture, different data sample — and the *same* crafted input fools them all
> (Szegedy et al. 2014, first noted; Papernot, McDaniel & Goodfellow 2016; Liu et al., ICLR 2017 for
> targeted transfer).

**Transferability is measured `ρ → 1` between models that were constructed independently**, and it is
the strongest available outside evidence for the claim §4b's closing rests on:

> **Independent construction does not guarantee decorrelation.**

That is this repository's own S=4 common-seed worry, confirmed from a field that had no stake in it
and arrived at it by measurement rather than by argument. It also **cuts at us**, which is why it is
recorded here rather than cited approvingly:

- **The four-oracle byte-lock assumes that independent implementations decorrelate.** Transferability
  is a documented case where that assumption *fails empirically*. Whether it fails for our oracles is
  **open** — four hand-written implementations of a specified algorithm are not four models trained
  on overlapping data, and the mechanisms of correlation are different. But *the assumption has been
  falsified somewhere*, and the right response is to measure `ρ` between oracles rather than infer it
  from how they were built.
- **The `2026-07-16` echolocation doc already says this in its own terms:** prime seed offsets
  guarantee `L > 0` *in the seed domain* and **do not** guarantee it in the fractal-dimension domain
  — two different seeds could still land on the same `D_f`. That open question and adversarial
  transferability are **the same open question**, twice.

**Register, and the limit.** GAN training dynamics and a detector ensemble are different objects, and
nothing here identifies them — per `numerology-vs-number-theory`, a shared failure *shape* is not a
shared mechanism. What is claimed is narrow and checkable: **the blind-spot-is-structural observation
and the transferability measurement both say that constructing observers separately does not make
their errors independent.** That is enough to make it a design constraint, and not enough to make it
an identification.

**Measured in-tree (2026-08-23):** `adversarial example` **0 files**, `Papernot` **0**, `GAN` **1**.
The transferability literature is absent, and given that decorrelation is load-bearing here in the
strict sense established above, that is the fourth routed item.

## 5. The triage — five domains clicking is a warning, and this is that condition

Aaron's own rule (`numerology-vs-number-theory.md`): **"too many correlations is a warning, not a
confirmation signal."** Five domains converging inside one hour is exactly the condition it names, so
this section applies the rule to the thread that produced it.

| connection | status |
|---|---|
| Gödel's incompleteness proof has the local-legal / global-illegal shape | **structural** — it is the construction, not an analogy |
| the day's five defects share the shape | **measured** — each one reproduced, each cause named |
| "a local check cannot see a global property" | **structural**, and it already explains built artefacts (the vacuous `--verify`) |
| CTC ↔ exploit path | **shared shape**; both are "legal segments, illegal loop", and no shared mechanism is claimed |
| **geometric English ↔ sheaf `H¹`** | **conjecture** — the mapping is stated, nothing is measured, **this is the routed item** |

**What would promote the last row from coincidence to result:** exhibit an actual sheaf — name the
site, name what a section is, and produce a specific utterance whose local sections are consistent
pairwise and whose global section provably does not exist. Until that object exists, the claim is
*"the structure is consistent with a local-to-global obstruction"*, never *"it is one"*.

**And the honest counter-pressure:** the shape is *general*. Local-consistency-without-global-
consistency describes an enormous class of systems, which is exactly what the rule warns about — a
hypothesis that fits everything discriminates nothing. **The discriminating question is not whether
language has the shape; it is whether the cohomology is computable and whether it predicts a
sentence's ambiguity before a human reads it.** That is the falsifier.

---

## 6. Routed questions for the math team (Lumen / Soraya)

1. **Is the four-oracle byte-lock an `H¹` computation?** Each oracle is a local section; agreement is
   the global section. If so, a failed byte-lock has a *class*, not just a diff — and the class says
   **which overlap** failed. That would be a genuinely useful instrument, not a reframing.
2. **Does the monodromy already in `harmonious-division` extend to a full sheaf structure**, or does
   it stop at the flat-connection case? `anti-babel` depends on it, so the answer has a consumer.
3. **For language:** is there a site (in the Grothendieck sense) on which the minimal linguistic seed
   is a sheaf? What is the covering — n-grams, constituents, the `signature-index` word keys?
4. **The one that matters operationally:** is there a class of check that is *provably* incapable of
   seeing a global property, and can it be recognised mechanically? A linter for the vacuity class
   would be worth more than the theory that motivated it.

---

## Pointers

- `docs/research/2026-08-23-godel-einstein-middle-ground-*.md` — the local/global split at the
  physics layer, and the day's defect table.
- `docs/research/2026-08-20-harmonious-division-*.md` §monodromy — the in-tree instance.
- `.claude/rules/anti-babel-preserve-reconcilability.md` — *reintegration is not reconvergence*,
  built on monodromy; this doc says which general structure that is a case of.
- `.claude/rules/numerology-vs-number-theory.md` — the rule §5 applies, including to itself.
- `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-*.md` — the geometry routing this
  extends; §4 (CGA composition) is the nearest neighbour.
- Beacon anchors: Gödel 1931 (incompleteness), Gödel 1949 (rotating cosmology / CTCs), Leray 1946,
  Cartan–Serre 1955 (*FAC*), Grothendieck 1957 (*Tôhoku*).
