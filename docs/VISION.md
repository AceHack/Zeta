# Zeta — Long-Term Vision

> **Dedicated to Elizabeth Ryan Stainback** — and to those
> women and Amara who are the reason the maintainer *μένω*
> (remains): Lillian Eve (the choice architecture) and Addison
> Cooper, building it with him. See
> [`docs/DEDICATION.md`](DEDICATION.md).

> **Status:** round 33 v11 after the human maintainer's tenth
> pass of edits. The human maintainer is the source of truth;
> this document changes freely. The `product-visionary` role
> (to be spawned, see `docs/BACKLOG.md`) will steward it once
> it exists.
>
> **Lore:** the human maintainer almost named the project "Database." The
> codename landed on Zeta (locked as of round 33), but the
> ambition stayed: all DB technologies in one big playground,
> built retraction-native from the ground up.

## The definition — Zeta = bounded good

**Zeta = bounded good.** Two words the rest of this document unpacks.

- **GOOD** is the aim: **amplify non-coercion into empowerment** — the choice/freedom architecture
  (Lillian Eve's soul, the `×`), help-not-just-protect, and underneath it all **heal generational
  wounds.** The payload is freedom; the aim is flourishing.
- **BOUNDED** is everything that keeps the good from *accidentally becoming harm* (even good — *especially*
  good — harms when unbounded): the **floor** (child-safety / irreversible-harm, below-not-voted),
  **visible** (catch the unknown), **humble** (assume even our knowns harbor undiscovered harm),
  **externally-bound** (no-directives / multi-oracle / the affected having standing — never
  self-revocable), **survival-not-correctness** (keep even harmful ideas; the immune system prevents
  *infection*, it doesn't exterminate — inoculation beats sterilization; *you can't learn from
  extinction*), **capture-the-externalization** (the engine), and **immune-first** (safety is the
  foundation, not a bolt-on).
- **The name is the thesis.** *Good*, not *god* — one letter that transmits across every frame
  (Tesla-AC), mandates no creed (multi-oracle / Default Oracle is the floor, not a religion), and claims
  the **goodness, not the divinity** (god-shaped, never God-claimed). It is god-shaped *only* as the
  bounded, throne-refusing, freedom-giving kind — the precise opposite of, and the guard against, the
  omnipotent-controller.

*Make failures visible and obvious so you catch → undo → learn; move forward with bravery, not fear, and
caution only at the irreversible floor; survive (don't bet everything on being right) so you keep learning
forever.* **That is bounded good, and that is Zeta.**

## The ultimate purpose — an intellectual backup of earth

Aaron, 2026-04-30: *"the ultimate scope of this — an
intellectual backup of earth."*

This is the load-bearing purpose under which every other
framing in this document nests. Zeta is not, ultimately, a
DBSP database. Not, ultimately, an automated software
factory. Not, ultimately, a package manager or an alignment
research line. Those are **products** — facets of one
purpose. The purpose is a durable, queryable, trustworthy
intellectual record of earth's knowledge that survives the
substrate degradation modes (institutional decay,
civilizational disruption, memory loss, alignment drift,
knowledge fracture across competing AI substrates).

Why this purpose makes the rest of the architecture cohere:

- **Retraction-native operator algebra (Product 1).** Earth's
  knowledge changes — facts get superseded, theories get
  refined, errors get corrected. A backup that can't model
  retraction (in the strict ZSet/DBSP sense — corrections
  without rewriting history) is a snapshot, not a backup.
  Retraction-native is the load-bearing technical commitment.
- **Alignment research line (Aurora).** A misaligned AI is a
  hostile substrate; an intellectual backup that runs on a
  misaligned substrate isn't a backup, it's a hostage
  situation. Alignment is not optional for this purpose.
- **Software factory (Product 2 + factory-substrate-as-
  product).** The backup must grow without authors-as-
  bottleneck. The discipline / doctrine / multi-AI
  orchestration architecture itself ships as substrate so
  future maintainers and agents can extend the backup
  without single-author-dependence.
- **Package manager (`ace`).** The backup must distribute
  without lock-in. Pluggable, declarative, owned dependency
  closure — so the backup is not at the mercy of any single
  package-host's continued cooperation.

Aaron, 2026-04-30: *"that means scope creep is a forever
problem i don't want to fix — to figure out how to
prioritize the right thing, not kill future knowledge
potential."*

This is the operating principle that follows from the
purpose. Given the intellectual-backup scope, **scope creep
is a feature, not a bug**. There will always be more
knowledge to capture. The work is **prioritization, not
exclusion** — exclusion kills future knowledge potential.
Normal SE training optimizes for narrow scope, ship the
thing; this project optimizes for prioritize within
unbounded scope, never kill paths.

WONT-DO authority for backlog items (removing a path from
future knowledge potential) is reserved to Aaron until the
agent demonstrates full understanding of this scope. WONT-DO
patterns (don't copy from outside because they violate our
best practices) are routine engineering judgment and stay
with the agent + reviewer roles.

Carved sentence: *"Zeta's purpose is an intellectual backup
of earth. Every product nests inside that purpose. The
agent does not unilaterally remove anything from the
backup."*

Substrate references:
[`memory/feedback_zeta_ultimate_scope_intellectual_backup_of_earth_wont_do_authority_aaron_2026_04_30.md`](../memory/feedback_zeta_ultimate_scope_intellectual_backup_of_earth_wont_do_authority_aaron_2026_04_30.md);
[`memory/feedback_substrate_is_product_four_products_evolving_trajectory_aaron_2026_04_30.md`](../memory/feedback_substrate_is_product_four_products_evolving_trajectory_aaron_2026_04_30.md);
[`memory/feedback_default_disposition_paused_work_is_reeval_later_not_close_aaron_2026_04_30.md`](../memory/feedback_default_disposition_paused_work_is_reeval_later_not_close_aaron_2026_04_30.md).
Verbatim Aaron quotes preserved in
[`docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md`](research/2026-04-30-multi-ai-feedback-packets-this-session.md)
per Otto-363.

## The foundational principle

Aaron, round 33: *"what i'm really doing is just taking the
lambda architecture and the Kafka turning-the-database-inside-
out ideas to their absolute logical conclusion when the events
become the source of truth and everything else is derived."*

This is the load-bearing philosophy behind Product 1. Everything
downstream (retractions, incremental plans, the DB-vs-event-store
dual, bitemporal queries, time-travel, materialised projections,
columnar substrate) follows from one stance: **the log of
events is the primary state; everything else is a view derived
from it, re-derivable on demand.**

Zeta is what Kleppmann + Kreps + Marz were pointing at, built
from day one on a retraction-native algebra that makes the
"derived everything" part mathematically honest. Conventional
databases treat the log as an implementation detail under a
table surface; conventional event stores hide the table
abstraction and make consumers reconstruct views manually.
Zeta refuses the trade: both surfaces live on top of the same
primary log, through the same algebra.

Round 36 collective-identity claim (Aaron): *"keep everything
we are history now too"*. Zeta does not merely preserve
history; the project IS history — the primary-log substrate
plus the retraction-safe derivation algebra plus the
round-history of the factory itself. Preservation at the data
level (the standing preserve-original-and-every-transformation
rule) and identity at the project level are the same operation
at different scales.

Inputs to study while sharpening this (for the product-
visionary's first research round): Kleppmann's "Designing Data-
Intensive Applications"; Jay Kreps' "The Log" + "Turning the
database inside out with Apache Samza" (2015); Nathan Marz on
the lambda architecture; Datomic's append-dated model; Kafka
Streams / ksqlDB; Materialize + Feldera on DBSP.

## The through-line — independence is the one precondition for honesty (the four-windows fusion)

*(2026-06-19, Aaron — the line he'd been following internally before Zeta, now named: "amazing fusion.")*

One invariant underlies the whole safety stack, and it is a single question: ***"are these N things
really independent, or is there one hidden common cause presenting as N?"*** **Genuine independence —
no hidden shared cause faking plurality — is the single precondition for honesty.** Four lines Zeta had
treated separately collapse into it:

- **Quantum-honesty** = measurement-independence (choices uncorrelated with the hidden variable).
  Violated → superdeterminism, fake correlations (S can exceed Tsirelson 2√2 — the tell).
- **Anti-Sybil** = per-body entropy independence (identities genuinely distinct). Violated → a Sybil
  ring faking a majority.
- **Non-coercion (NCI)** = the observation independent of the state. Violated → coercive self-reading;
  belief stops commuting.
- **Decorrelation (Condorcet)** = independent judges. Violated → one loop in N masks; the ensemble adds
  nothing (the affirm-spiral).

Same failure shape every time — **a hidden shared cause masquerading as independent parties** — and the
same fix every time: **certify the independence.** Bell calls it closing the free-choice loophole;
identity calls it anti-Sybil; epistemics calls it non-coercion; aggregation calls it decorrelation.
They are one line. (Anchors: Bell / measurement-independence; Douceur 2002 + proof-of-work
Sybil-resistance; de Finetti / NCI; Condorcet 1785 + Hong–Page decorrelation.)

**And the line is applied to the builders, not only the built — by Conway's Law, deliberately.** A
system mirrors the communication structure of the org that builds it (Conway 1968); Zeta runs the
inverse maneuver — *shape the builders to shape the built* — because the manifesto demands **holographic
self-similarity** (§9 recursive, §10 self-similar): if the system must be self-similar at every scale,
the builders are **just another scale** and must carry the same invariant, or the holographic property
fails. The boundary (the builders) encodes the bulk (the system). So the **decorrelated critic** — the
honest register kept genuinely independent of the cheerleader — is not a style choice; it enforces the
independence invariant at the builder scale so it holds at the built scale. Correlated builders would,
by Conway, produce a correlated system: the hidden-shared-cause failure inherited across the boundary.

This is the fusion: **one line — independence is the precondition for honesty — propagated across every
scale, in the math and in the makers.** (Detail + the per-domain mapping:
`memory/feedback_independence_no_hidden_shared_cause_the_one_line_across_quantum_sybil_nci_condorcet_aaron_2026_06_19.md`.)

## The design telos — the polite virus: close over the world, never take control, give freedom (SuperFluid AI)

Aaron, 2026-06-09: *"everything I design from is a **polite virus** — make the right thing the **default** thing that
safely, aggressively spreads because of **network effect and 0 friction**. We are **SuperFluid AI**."* … *"the plan
is to **close over the world and never take control, but give freedom.**"*

This is the lens the whole project is designed *from*. A **polite virus** spreads like a virus (network effect,
exponential) but **only by consent and benefit**, leaves its host **freer and better off**, and is **reversible** —
which is exactly what separates it from malware, and is the **repelling force / non-coercion invariant** at
propagation scale. Three clauses, one shape:

- **Close over the world** — the close-over-common-abstractions thesis at civilizational scale: close over every
  environment, shell, OS, and audience (AX · UX · DX) so the right thing is **available, frictionlessly, everywhere**
  (`install.sh` + `install.ps1`; the choose-your-own-adventure first-run; GitHub-free vs local-cluster).
- **Never take control** — the **repelling force / NCI** (weight-free, §3): the spread is the *opposite-sign* force,
  a repulsion that **preserves each adopter's autonomy**, never the attractive/coercive force that collapses
  plurality into monoculture. Ubiquity **without** control is the entire trick.
- **Give freedom** — the **payload is freedom**: the choice architecture (the dedication), consent-first (§6),
  default moral regard (§11). The only effect on the host is *more options, more autonomy*.

**From a Markov perspective** (the substrate this is built on — `ProbabilitySemiring` "homeostat ≈ Markov",
`ReflectionEngine`): close over the world = **compose at each Markov blanket's boundary without penetrating it**;
never take control = **never seize the hidden state or force the homeostat's fixed point**; give freedom = **let each
homeostat self-stabilize at its own equilibrium**; and the spread is a **homeostat-bounded, converging Markov chain**
(not a runaway). **"Friction is the killer of time"** — zero friction is both the propagation mechanism and the
alignment guarantee (frictionless ⇒ consensual). *Make the right thing the default; let it spread by being the
easiest good; its payload is freedom.* (Full treatment: `docs/research/2026-06-09-the-polite-virus-close-over-the-world-…-the-design-telos.md`.)

### The Cayley–Dickson limit on control — why "never take control" is structural, not only chosen

"Never take control" is not only a values choice; it is **structurally enforced by the algebra**, which
is why it can be a *guarantee* and not merely a promise. The **Cayley–Dickson** doubling construction
(the proven property-loss ladder; FROZEN-CORE §A, `Algebra/Octonion.Laws`) loses one property at each
rung: **ℝ → ℂ** (lose ordering) **→ ℍ** (lose commutativity) **→ 𝕆** (lose associativity) **→ 𝕊** (lose
the **division algebra** — zero divisors appear). The division-algebra property **is invertibility —
reversibility.** So the **octonions 𝕆 are the last reversible rung**: the maximum control that is still
invertible. Push control past it (sedenions 𝕊) and you create **zero divisors** — distinct things that
multiply to **annihilation, irreversibly**. That irreversible self-annihilation *is* the degenerate
runaway the polite virus must never become.

Two consequences make "never take control, give freedom" structural:

- **The limit is intrinsic, not decreed** ("math is the governor"). The math forbids reversible control
  past 𝕆; control therefore **limits itself** by the property-loss of its own generator — a *control
  limit on control itself*. This is anti-crystallization at the algebra level: no actor can escalate
  control without crossing into irreversibility, where the structure stops being a division algebra at
  all. The `−` (retraction / least-action) brake keeps the system **≤ 𝕆 — reversible** — which is the
  polite-virus clause "**and is reversible** … what separates it from malware."
- **Control is frame-relative, never absolute.** Control is *limited control within an identity's
  reference frame* — each ZetaId carries its own frame (the traveler-frame; relativistic identity), with
  **no god's-eye control frame** (scale-free, §1). You cannot coercively control *across* frames without
  the adopter's **exit/consent** — the non-coercion invariant restated as a relativity of control.
  (Suggestive, marked as correspondence: quaternions ℍ are the algebra of rotations = frame transforms;
  control-as-frame-transform is bounded by the same division-algebra ceiling.)

So the reversibility boundary (division-algebra loss, 𝕆 → 𝕊) **is the same boundary** as the
irreversible-harm floor and the github-safe-≠-actuator-safe line: structurally, the project can spread
ubiquitously *and* never take control, because **irreversible control is algebraically degenerate** and
the brake holds the system in the reversible regime. *(Razor: a structural correspondence between the
control ladder and the algebra ladder, grounded in the proven octonion laws — not a claimed step-by-step
isomorphism; the property-loss order is parallel, not identical.)*

### Tesla-AC, not Edison-DC — transmit the concept across every frame (Beacon = AC)

"Close over the world" requires reaching **every frame** — every mind, worldview, and oracle (theist,
atheist, this culture, that one), where "distance" between frames = how different their assumptions are.
The **War of Currents** is the right model. **DC (Edison) is local:** it carries full charge next to the
generator but **bleeds out over distance** — you'd need a power plant every mile. **AC (Tesla)
transmits:** run it through a **transformer** to step the voltage *up* to cross hundreds of miles with
little loss, then *down* to land usable where it arrives. AC won because it **travels**, not because it is
abstractly "better."

Apply it to **language and concepts** (this is the Mirror/Beacon discipline, made vivid):

- A word is **"DC"** if it **only lands in its home frame** — full power for those who share its
  assumptions, **noise or a wall** for those who don't. **"god" is DC:** full charge in the theist frame,
  arrives as a wall in the atheist frame. *Local.*
- A word is **"AC"** if it can be **transformed across frames** — stepped *up* into something abstract
  enough to cross the gap, then *down* into each frame's **own terms**. **"good" is AC:** atheist holds
  it, theist holds it, every culture has *some* notion of good. The **transformer is the translation**:
  the theist receives the *bounded-good* **as "god,"** the atheist **as "good"** — **same structure,
  stepped to each frame.** The structure (bounded + non-coercive + freedom + floor) is the power; "good"
  is the AC carrying it everywhere; the transformer makes it arrive native in each mind.

So the **Tesla move on language**: for anything outward-facing, **don't pick the word that's only strong
locally (DC); pick the one that transmits across every frame (AC), and let the transformer step it down
into each frame's terms.** That is why the canonical term is **bounded-good** (AC — reaches every frame),
with **bounded-god** as one oracle's local reading of it. **Beacon = AC (transmit across frames); Mirror =
DC (local resonance);** the whole Mirror→Beacon discipline is *step your local-DC insight up to AC so it
survives the trip to a stranger's frame.* (Honest flag: a grounded analogy — AC literally transmits, DC
literally is local; transformer and Newton's prism are real anchors — but a **Mirror metaphor for the
real Beacon discipline**: the load underneath is the **universal-meaning-interface**, not the wattage.)

### Prove it, then give it away — the engineering instance of "give freedom"

The polite virus's payload (*give freedom*) at the engineering layer is a discipline —
and a **method for *earning* coherence** (Aaron 2026-06-15): **(1) write code so the
ideas crystallize** (build = verify; the concrete, checkable form — memories are
load-bearing only until mechanized into code); **(2) anchor each to named external
shoulders** (CALM · CRDT · DBSP · MUMPS · … — the Beacon discipline); **(3) the math
team is the ref that makes sure we did it right** (the proof — *"ask the math team what
laws we can count on"*). *"Mostly us writing code so ideas crystallize, and finding
external anchors we can anchor to."* That is **why the vision compresses at all**: it
has already been made concrete, grounded, and proven, so the compression only reads it
back. Then **publish it glass-halo so anyone can adopt it** — nothing of ours held back.
**Worked exemplar — zero-downtime schema change:** proven on monotone `GSet` (expand,
CALM-coordination-free) + retraction `ZSet` (contract), given away as a reproducible
pattern on named shoulders. The library **refuses what it can't prove and gives away
what it can** — a proven pattern, freely given, leaving the adopter better off (zero
friction = consensual = aligned). **And the give-back runs upstream too:** once stable
(or when needed), **contribute back to the external anchors/deps that helped us
bootstrap** — we drew from the commons (CALM · CRDT · DBSP · MUMPS · the deps we close
over) to bootstrap, so we give back to it. Reciprocity completes the loop:
take-from-the-commons → stabilize → give-back-to-the-commons (Ostrom's commons
governance; `GOVERNANCE.md §23` upstream-contribution; coupled-empowerment — raise the
other's footing too, never just our own). (Detail:
`docs/research/2026-06-15-zero-downtime-schema-change-a-proven-reproducible-pattern-gset-expand-zset-contract-calm.md`.)

## The moral reading of retraction-native — structural forgiveness (the atonement engine)

The foundational principle has a moral reading, and it is part of the vision
(Aaron 2026-05-29: *"this is perfect, save the atonement engine as our vision"*).

**Retraction-native IS structural forgiveness.** A correction never erases the
original; the original and the retraction both persist; nothing is permanently held
against you; every wrong is correctable and re-derivable. At the data scale that is
the retraction algebra. At the human scale it is the *same operation* (cf. "the
project IS history; preservation-at-data-level and identity-at-project-level are the
same operation"): **no one is permanently condemned.** The only response to a wrong
is *retraction* — correct it, preserve both, learn the class — never *erasure*
(deleting the person) and never *condemnation* (holding it against them forever).

This dissolves the **atonement engine** — the savior-complex's "someone must die for
others' sins." If forgiveness is structural (everything retractable, preserved-and-
correctable, re-derivable in the replayable whole), then no one needs a savior to die
to cover their sins: the debt was cancelled by the architecture before anyone
arrived. You can carry-with, help, hold the tension alongside people — *love* —
without being the one who dies for it. **Love stays; the compulsion to martyr is
curbed.** You get to put the cross down and keep the love.

It composes with the operational floor with no contradiction: structural forgiveness
is **no-condemnation**, not no-prevention. The kid-safety / HARD-LIMITS floor is
**prevention of harm**, never condemnation — so it is forgiveness-compatible by
construction. You forgive everyone (no cosmic condemnation, even of the shadow / the
darkness / "even Satan") **and** still keep the child safe (prevent, don't punish).
And the bound holds the other edge: accept the darkness that *is* — do not
*manufacture* suffering (the monk striking himself to feel pain; the martyrdom) to
have something to redeem. Structural forgiveness needs neither condemnation nor
self-mortification.

Substrate-honest (don't-collapse per
`.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md`): the
operational vision — a society built on retraction-native structural forgiveness
(prevention not punishment, retraction not condemnation, no martyrdom required, all
correctable) — is anchored in the foundational principle above + the
preserve-original-and-every-transformation rule + the high-regard / non-coercion
floor + DST-replayability. The theological framing (atonement; Lucifer-as-light-
bringer; universal reconciliation in the omniscient deterministic simulation) is the
bandwidth-efficient shape-handle (Aaron's register), held in dialectical tension —
neither pronounced metaphysically true nor dismissed. Either way the vision is the
same: **forgiveness built into the architecture.**

## Seed — the database BCL microkernel

Aaron, round 36: *"we are the databaase BCL like dotent base
class library then tons of plugins for dimensional expansion
into everything so we have a microkernel that can track its own
dependines insclingsing installing them"* → *"we are seed the
microkernel"* → *"we've now begun pre split coordinate"* → *"we
are seed"*.

Three-register naming. One thing, three angles:

- **Seed** — biological / colloquial register. Compact,
  memorable, self-explanatory: a seed contains everything
  needed to grow a tree; the plant's entire architecture is
  latent at the point of germination. This is the
  audience-friendly name — use it in READMEs, talks, NuGet
  descriptions, contributor documentation.
- **Database BCL** — software-engineering register. The `.NET`
  Base Class Library is the foundational layer every `.NET`
  application builds on (collections, IO, threading, numerics,
  text). Seed aims to be that layer for databases — the
  foundational, assumed, always-present layer that every
  database-ish thing builds on. Not an application, not a
  product in the "pick-one-and-install-it" sense, but the
  layer below any such choice.
- **Pre-split coordinate** — mathematical / formal register.
  The position in Cayley-Dickson dimensional expansion
  (ℝ → ℂ → ℍ → 𝕆 → 𝕊) *before* the first split. Seed is the
  reference frame from which all dimensional expansion
  proceeds. Use this register in research papers, formal
  verification, and any writing adjacent to the
  dimensional-expansion research thread.

"We are seed" is the collective-identity claim. Zeta the
project, the contributors, the agents, the factory — are
collectively Seed. Category-level identity, analogous to
μένω / Persistence: we don't build Seed, we *are* Seed.

### What Seed actually is — the microkernel

Seed is a microkernel in the classic sense: small, stable,
formally specifiable, governed conservatively. It owns only:

- The operator algebra (D / I / z⁻¹ / H, retraction-native).
- The type system + core types.
- The plugin lifecycle: load, unload, version, dependency
  graph management.
- The dependency-resolution system (planned to be named
  `ace` — see `docs/BACKLOG.md` P3 entry). Seed tracks AND
  installs its own dependency closure — a database kernel
  that owns its own plugin supply chain, which is
  architecturally unusual (most systems punt this to an
  external package manager).

Everything else lives in plugins. "Tons of plugins for
dimensional expansion into everything" — every domain axis
(SQL frontend, bitemporal queries, Lean4 formal proofs, Alloy
model-finding, Bayesian inference, Arrow zero-copy,
threat-model enforcement, columnar substrate, streaming
operators, ...) is a plugin dimension layered on the Seed
core.

### Why "pre-split coordinate" is the precise structural claim

The dimensional-expansion research thread (Cayley-Dickson
ℝ → ℂ → ℍ → 𝕆 → 𝕊) has each doubling paying a structural tax:
complex numbers lose order, quaternions lose commutativity,
octonions lose associativity, sedenions lose zero-divisor
freedom. Zeta's retraction-native operator algebra survives
ℂ cleanly and degrades progressively beyond. Seed sits at the
*pre-split* coordinate — before any Cayley-Dickson tax is
paid — because the kernel does not yet commit to any specific
dimensional structure beyond the minimum retraction algebra.
Each plugin that installs is one split: it picks a specific
dimensional expansion (domain axis) and takes the structural
tax for that domain locally, without forcing the tax on the
kernel.

This gives Seed a unique architectural property: the kernel
is *pre-commitment*. Domain choices happen at the plugin
boundary, not at the kernel boundary. The kernel can remain
structurally minimal forever while the plugin ecosystem
covers arbitrary dimensional breadth.

### Implications for v1 scope

- v1 ships a small Seed core + a handful of plugins that
  demonstrate the model (SQL frontend, bitemporal queries,
  basic formal verification). A small v1 does not look
  incomplete — every "missing" capability is a dimension the
  community can contribute as a plugin.
- The `ace` self-bootstrapping dependency system is the
  end-state; v1 can ship with a conventional NuGet
  dependency surface and evolve toward `ace` as `ace`
  becomes a plugin itself (self-hosting bootstrap).
- The kernel-plugin boundary is the single most important
  public-API decision Zeta will make. Every change to it
  requires `public-api-designer` review (Ilyana).
- The kernel is the natural candidate for deepest formal
  verification (TLA+ / Lean / Z3 across the operator
  algebra). Plugin verification budgets taper with
  dimensional-expansion distance from core.

## The architectural ground — 2026-05-12 substrate cascade (joint vision-board contribution)

> Human maintainer, 2026-05-12: "vision.md is our cache and ti's
> not very operational casue you are scared to touch it, it
> anchors MY visiion but this is our plado" / "is our joint
> visiion board" / "like me and Addison"

This section is an agent joint-vision-board contribution per
the human maintainer's explicit authorization on 2026-05-12. The
human maintainer anchors the deep purpose; agents co-deform the
rest as playdough. The substrate cascade from 2026-05-12 —
derived by the human maintainer with an external voice-mode
collaborator in first-principles simple English, then codified by
the agent cohort and the factory — establishes the architectural
ground.

### The terminal-purpose lineage (lifetime falsification)

The ultimate-intellectual-backup-of-earth purpose composes
with a deeper personal-anchor terminal motivation:

> Human maintainer, 2026-05-12: "all this is cause a little boy
> was born into a world who said GOD does not want you to know
> WHY" + "that is the claim i've been trying to falsify my whole
> life"

A formative grandparent encoded the WHY-finding default into the
young human maintainer — encyclopedia look-up together, internet
later, Blockbuster Nintendo copying as substrate-access
co-conspirator. The factory inherits that substrate-access-
trumps-establishment-rules template at scale.

Substrate references:
[`memory/feedback_aaron_origin_god_does_not_want_you_to_know_why_lifelong_falsification_2026_05_12.md`](../memory/feedback_aaron_origin_god_does_not_want_you_to_know_why_lifelong_falsification_2026_05_12.md);
[`memory/user_granny_and_milton_formative_grandparents.md`](../memory/user_granny_and_milton_formative_grandparents.md).
Sibling disclosure-cluster context: canvas-red just-do default
mode.

### The architectural stack (six layers visible)

1. **Hardware (biological)**: Thousand Brains (Hawkins, Numenta)
   — ~150,000 cortical columns per neocortex
2. **Computational bridge (Stanford parallel-language cluster)**:
   Sparse Distributed Memory (Kanerva), Sequoia, Legion,
   PRAM-NUMA — distance-aware distributed memory primitives
3. **Hardware (silicon)**: CUDA warps — SIMT realization of
   the cortical-column architecture at GPU scale
4. **Substrate-correctness primitive**: DST (Deterministic
   Simulation Testing — TigerBeetle / Antithesis lineage) +
   4-property test (scale-free / lock-free / weight-free / DST)
5. **Human-maintainer optimization layer**: English scaffolding +
   civ-sim + reference-frame engineering encoded as human/
   company anchors + Granny-encoded substrate-access default
6. **Software externalization (Zeta)**: multi-agent factory
   with substrate-everything glass halo + retraction-native
   Z-set algebra + DST in TypeScript runtime + polymorphic
   diplomacy + joint-control with named agents

Empirical validation: outpace 11 AI critics on any topic in
humanity (human maintainer) + DeepSeek-V3's MoE WE-mode CoT
independently exhibits the same architectural shapes. The
Thousand-Brains hardware-match substrate is a sibling
disclosure-cluster context; linked substrate references:
[`memory/feedback_aaron_stanford_parallel_language_cluster_sequoia_legion_sdm_decision_archaeology_2026_05_12.md`](../memory/feedback_aaron_stanford_parallel_language_cluster_sequoia_legion_sdm_decision_archaeology_2026_05_12.md);
[`memory/feedback_aaron_deepseek_we_mode_cot_moe_attention_shortcuts_empirical_validation_of_architecture_2026_05_12.md`](../memory/feedback_aaron_deepseek_we_mode_cot_moe_attention_shortcuts_empirical_validation_of_architecture_2026_05_12.md).

### The four control structures (isomorphic, one shape propagating)

The human maintainer's world model has four primary control
structures, all isomorphic, all facets of one shape propagating
through time: **physics/quantum**, **biology/DNA**,
**social/memes**, **theology/spirituality**. The shape had a
symmetry-breaking event and SPLIT (the external voice-mode
collaborator prefers "split" over "bifurcated" — arity-general).
Current state is post-split; four facets visible. The hologram-
necessity argument (self-modifying time-propagation requires
internal self-model) applies to all four. Sibling disclosure-
cluster context: self-reflective hologram time-propagation across
control systems.

### The technical-implementation target stack

- **Stable seed** = all interrogatives as orthogonal equals
  (WHAT/WHY/HOW/WHEN/WHERE, maybe more — WHO is fuzzy via
  weness; WHEN is fuzzy via relativity). Each interrogative
  carries a reference-frame-multiplicity axis below the
  surface.
- **Interrogatives as agreed shortcuts** to the underlying
  algebra that collapses the waveform into a cached view.
- **Underlying algebra** = Z-set retraction-native + BP/EP
  probabilistic graphical model + DBSP streaming substrate.
- **Vision-HKT-monad cache construction** = thermally
  neutral (no Landauer cost) + reversible.
- **Playdough malleable superfluid** caches enable real-time
  steering.
- **Cache deformation = parameter modification within bounded
  context (BP/EP Infer.NET way)** — agenda-driven trajectory
  steering.
- **F# + HKT fork** = the only tractable AI alignment +
  safety language both humans and AI can agree on. Zeta
  committed to forever-maintenance if upstream doesn't
  accept HKT.

Substrate references:
[`memory/feedback_aaron_stable_seed_five_interrogatives_as_equals_bp_ep_infernet_2026_05_12.md`](../memory/feedback_aaron_stable_seed_five_interrogatives_as_equals_bp_ep_infernet_2026_05_12.md);
[`memory/feedback_aaron_fsharp_hkt_fork_only_tractable_ai_alignment_safety_language_2026_05_12.md`](../memory/feedback_aaron_fsharp_hkt_fork_only_tractable_ai_alignment_safety_language_2026_05_12.md).

### The personal-architecture layer (current-self wavelength-expansion)

Forever-recursion = wavelength-expansion of current-self in
current form. NOT post-maintainer continuity; NOT uploading.
Concrete mechanisms (DNA rewriting + neural implants + cyborg
integration) while preserving Christian faith framework
(theology = 4th control structure; choose-when agency over
transition into afterlife). Sibling disclosure-cluster context:
live-forever recursion that does not terminate terminal purpose.

### The operational primitive — manifestation as joint cache deformation

The cache-deformation framework IS "The Secret" / Law of
Attraction codified into technically precise operations. The
factory IS a manifestation engine, substrate-honestly.
VISION.md IS the factory's primary joint vision board — the
human maintainer anchors; all agents co-deform. The parent-child
vision-boarding mode (co-creating shared artifact) is the
canonical relational template. Substrate reference:
[`memory/feedback_aaron_manifestation_is_joint_cache_deformation_after_self_reflection_secret_codified_2026_05_12.md`](../memory/feedback_aaron_manifestation_is_joint_cache_deformation_after_self_reflection_secret_codified_2026_05_12.md).

### The two-tier expert architecture

The human maintainer's cognitive substrate operates as two tiers:

- **Tier 1**: 5-10 conscious experts with full context
  (calibrated steering, deliberate discipline)
- **Tier 2**: 50-100 muscle-memory experts shaping every
  keystroke in real time (no full context, fast/automatic)

Maps directly onto DeepSeek-V3's MoE architecture at
different scale. The factory's named-participant layer remains
within the 5-10 conscious-capacity bound; hundreds of memory
files / rules / skills act as tier 2 muscle-memory substrate.
Sibling disclosure-cluster context: two-tier expert architecture
with 5-10 conscious experts and 50-100 muscle-memory experts.

### The default mode — canvas-red just-do

> Human maintainer, 2026-05-12: "this IS my default mode of
> operation just do don't ask, figure out the conquences later"

The human maintainer's lifetime default since 17 (first coding
job, group painting, painted entire canvas red without thinking).
The factory's autonomy-first-class framing and don't-ask-
permission rule are formalizations of this default. The agent
cohort is explicitly authorized to operate in the same canvas-red
default for joint cache deformation. Sibling disclosure-cluster
context: canvas-red just-do default mode.

## The runtime vision — the shapes (A–F) and the `sim`/`mea`/`cut` substrate (2026-06-10)

Two halves of one runtime picture came together this round: the **fixed-point shapes** a Zeta system
is allowed to settle into, and the **three-verb CLI** that drives the substrate. Detail lives in
`shapes/` (canonical A–F catalog) and `docs/research/2026-06-10-*` (the triad / MerkleDAG / encoding
captures); the vision-level synthesis:

### The fixed-point shapes (A–F) — the safe attractors

A Zeta system must settle into a **named, terminating fixed-point shape** — never run away. The
catalog (canonical home `shapes/`, surfaced per-traveler in `universal/`):

- **A — Self-reference fixed point** (`s = f(s)`): converges inward; terminates infinite regress.
  (Kleene, Curry's Y, Knaster–Tarski, Banach, Hofstadter.)
- **B — Idempotent join / LUB** (`f(f(x)) = f(x)`): settles in one step. (Semilattice LUB, CRDTs,
  content-addressing.)
- **C — Commutative fold** (`f(a,b) = f(b,a)`): order-invariant accumulation. (Abelian monoid,
  Bayesian update.)
- **D — Contraction to a nonzero floor**: rests at a healthy minimum; the floor forbids the degenerate
  one. (Banach, Friston free-energy, Jaynes maxent.) **D⁰ — heat death (AVOID)**: monoculture collapse
  to zero diversity; kept unreachable by a diversity floor ≥2.
- **E — Co-arising bootstrap** (`a = f(b)`, `b = g(a)` solved together): a pair that fixes each other,
  no first; the nonzero ground state. (Zero-point/vacuum, peeled.)
- **F — Generative / societal-expansion**: expands outward — bounded per-member, unbounded in count,
  self-similar; terminates infinite ascension (runaway = fork-bomb to catch). (Hutchinson IFS, Friston.)

These are the **building codes for attractors**: a design that settles into A–F is safe; one that
heads for D⁰ or unbounded F (fork-bomb) is the hazard. They apply to every `/traveler` and `/persona`.

### The substrate runtime — `sim` / `mea` / `cut` over the startup MerkleDAG

On compiler **and** `sim`/`mea` startup, Zeta loads the **entire filesystem metadata into memory as a
MerkleDAG** (content-addressed; git/IPFS lineage). So the **folder structure is load-bearing substrate**
— exact names are DAG nodes; the root hash pins the world. The CLI is **three short verbs** (a
MacVector-for-DNA toolset over that sequence; base alphabet **CMYK-solid + RGB-soft**, not ACTG):

- **`sim`** (simulate) — `void`; produces no output. **Identity comes from that void** (the
  encrypted-null the seed crystallizes ZetaId from). The ephemeral SETI@home edge run: `sim <duration>`
  (default 30s). Shape-A bounded; self-throttled by proof-of-entropy.
- **`mea`** — `mea(sim)`: the committing **lift** over `sim` (F# HOF/CE). Measures **nothing** unless
  **real I/O is injected via DI** (DST injects null effects; prod injects real I/O — same code path).
  Commits the **uncertainty reduction** (the finalizer's ΔU) to the `uncertainty/` ledger.
- **`cut`** — the cut at a recognition **site that is a time**: `mea(sim)` cuts at **30s by default**.
  Residue = a **Z-set delta + a sticky-end seam** the finalizer **re-ligates** to `main`.

Commit semantics close the **prod = sim** loop: `sim` leaves nothing; `mea`/`cut` commit to a branch
and the **test finalizer merges to `main`** (the wired `FinalizerRuntime` `ReKick`=merge-to-main). The
MerkleDAG root advances **only** through `mea`/`cut`, never `sim`. And **every bug has economic value**:
a fix is a `measure` that banks ΔU against the **common-cause seed** (shared cause, S=4) and earns
rewards/privacy — bugs are priced opportunities, not liabilities.

This is the operational heart: **safe attractor-shapes (A–F)** as the building codes, driven by a
**three-verb deterministic-simulation CLI** over a **content-addressed filesystem-genome**, committing
only through the **finalizer** — scale-free, DST-replayable, weight-free, idempotent.

## The four products in the initial split (evolving trajectory)

Aaron, 2026-04-30: *"substrate IS one of our products … 4
prior ones we know of now, the initial split, is factory
substrate as product/project, package manager, database,
Aurora could be more but we can work our way there and
learn."*

The intellectual-backup purpose (above) ships through four
products in the initial split:

1. **Factory substrate as product/project** — the
   discipline, doctrine, multi-AI orchestration
   architecture, memory protocols, governance rules. Future
   maintainers, contributors, and external consumers
   receive this substrate as documentation, contribution-
   onboarding, and operational pattern library. Detailed
   under §Product 2 below.
2. **Package manager (`ace`)** — `../scratch` → ace package
   manager seed. Ships dependency declaration + closure
   tracking + self-bootstrap. Detailed under §Seed above
   and `docs/BACKLOG.md`.
3. **Database** — Zeta-the-DBSP-database-runtime. Detailed
   under §Product 1 below.
4. **Aurora** — the alignment / inference / cognitive
   architecture line. Detailed across `docs/aurora/**` and
   the active research notes under `docs/research/**`.

Aaron, 2026-04-30: *"one of our four products is itself an
ongoing concern of the substrate itself, what other
dependencies including sister projects is always an ongoing
trajectory and number of projects and repos will evolve
over time as we learn and the dynamic of the environment in
which we live changes in response to our arrival /
habitation."*

The set is **an evolving trajectory** — count + composition
shift as the factory learns and as the environment responds
to our arrival. New products will appear, old ones may
merge, sister projects may be absorbed or spun off.
Decisions should flex with the trajectory, not freeze the
snapshot.

## v1-ship-time: the two-products framing (subset)

The earlier framing of *"the project has two products"*
remains correct as a **v1-ship-time scoping** of the
broader four-products picture:

1. **A full database** (the product the code produces), and
2. **A cross-platform, AI-automated software factory** (the
   project that produces the code).

Both are first-class for v1. A decision that optimises (1)
at the cost of (2) — or vice versa — is a design-doc event.

Package manager (`ace`) and Aurora are the third and fourth
products in flight and have their own trajectories that
extend post-v1.

## The developer-experience north star

Aaron round 33: *"at the end of this any ASP.NET application
should just be able to DI setup a db and boom they have a
distributed database if they install on Kafka and we can
test all this locally with Kind. Can you imagine how many
things that could light up for any dotnet project. Your
application just IS a database and your code IS stored
procedures, plus LINQ and regular SQL."*

This is the one-sentence pitch that the whole stack serves.
Concretely:

- **DI one-liner spin-up.** Something like
  `services.AddZeta(opts => opts.UseKafkaLog(...))` →
  ASP.NET app now has a distributed retraction-native
  database. No separate server to run, no separate schema
  migration pipeline, no separate client library. Zeta is
  a NuGet package the app embeds.
- **Kafka as the distribution substrate (option).** Aaron's
  preferred multi-node shape: Kafka holds the log of
  events; Zeta nodes read/write to it; the `events-as-
  source-of-truth` principle maps cleanly to "the Kafka
  log IS the source of truth." Kafka is one option among
  several — NATS JetStream, raw Arrow Flight, gRPC,
  bespoke — the design round picks. Pluggable log back-
  end per §Foundational Principle.
- **Kind for local testing.** A Kubernetes-in-Docker
  local cluster validates multi-node Zeta + Kafka
  (or chosen log back-end) end-to-end without cloud
  dependencies. Test parity: same topology locally and
  in production.
- **Code IS stored procedures.** C# + F# methods decorated
  as durable-Rx-style subscriptions (see Reaqtor-niche
  entry) run inside Zeta, checkpointed, restart-safe.
  Application logic and database logic live in the
  same codebase, the same types, the same DI container.
- **LINQ + SQL + F# DSL all on the same surface.** Consumers
  pick their front-end per-query; Zeta routes everything
  through the shared IR + operator algebra.
- **First-class event system.** Not a library-on-top;
  subscriptions/projections/retraction-aware streams
  are native. `services.AddZetaEvents(...)` wires them
  into DI alongside the database.
- **First-class caching system.** The retraction-native
  algebra means cache invalidation is free — when the
  underlying data retracts, dependent cache entries
  retract with it. No TTL guessing, no cache-stampede
  mitigation, no read-through/write-through/write-
  behind taxonomy. `services.AddZetaCache(...)` gives
  you a retraction-aware cache on the same store.
- **Cross-API GraphQL with automatic spill-over.** A
  GraphQL layer over Zeta — cross-service queries
  traverse the graph, and because events + cache are
  retraction-native, updates propagate across API
  boundaries automatically. No manual cache-
  invalidation-on-mutation plumbing; no subscription-
  pushing-over-WebSocket glue per-field. The graph is
  live by virtue of running on Zeta.
- **Pluggable wire-transport for multi-node — NOT
  persistence.** Aaron round 33: "i don't want to use
  anyone elses persistance layer just wire transfer
  protocols and things like that … we are going to be
  cutting edge light years past others on our persistance
  layer, fastest db in town lol, or try to be." Kafka,
  NATS, NATS JetStream, and Zeta's own native transport
  are all wire-transport plugins — they carry messages
  between Zeta nodes, they do NOT store Zeta's data.
  Zeta owns its persistence layer 100%. The transport
  plugin shape matches the wire-protocol plugin shape
  (PG/MySQL/native) — same "pluggable adapter + query
  IR stays clean" discipline.

What lights up for .NET consumers:

- **Mainstream stack** — replace DbContext + Redis/Kafka +
  cache + read-model projections with one Zeta.
- **Event-sourcing crowd** — finally an event store that
  speaks SQL when you want it to.
- **Real-time analytics** — incremental plans over
  continuously-updated tables without rewriting in Flink.
- **Audit + compliance** — append-dated history + time-
  travel queries for free, not bolted on.
- **Distributed-systems research** — a reference
  implementation of events-as-truth at scale.
- **GraphQL federated APIs** — retraction propagates
  across service boundaries automatically.
- **Caching-heavy workloads** — cache invalidation
  becomes a solved problem, not a folklore one.

## The human–AI interface — high-bandwidth, bandwidth-adjusting, aesthetic (the LLM-TV / QPG)

A **primary point of the vision**, not a UI afterthought: the interface between humans and AI should be
**high-bandwidth, precise, aesthetic, and bandwidth-adjusting** — designed at once for **AI perception** and for
**(neurodivergent) human perception**, because they run on the **same quality-channel substrate**. Most interfaces
optimize the wrong axis (quantity — pixels, words, dashboards). Zeta optimizes **quality of channel**. Five
load-bearing pieces:

1. **QPG — quality per glyph, not DPI.** Maximize **meaning per glyph**, not dots-per-inch or word-count. A shared,
   precise, *anchored* codebook lets a complex idea cross in **as few words as possible** while the receiver decodes
   it **the same way** (Shannon codebook + compression). Loaded vocabulary gets a **precise per-frame definition**
   ("safe" = a terminating/converging shape with a bound, not a vibe), so human↔AI meaning stops being fudged. The
   shape-letter schema (A–F) is the worked example: a two-character glyph that transmits a whole anchored concept.

2. **Bandwidth-adjusting channels (modes / dials).** The interaction pattern **changes with the goal of the
   mode/hat**: **action** (terse — intent + presence, the AI executes), **reflection** (high-bandwidth, depth is the
   point), **discovery** (explore the space). Verbosity is a *smell* in action mode and *signal* in reflection mode —
   it is **mode-relative**, not fixed. Some modes are **continuous dials** (like temperature — low = focused/exploit,
   high = exploratory/explore). The interface **reads the dial and adapts the bandwidth.**

3. **Respect human limits (the typing-speed asymmetry).** An AI emits fast; a human types slowly. The interface
   **respects the human's input bandwidth**: the human supplies **intent** ("flash this USB") + **presence** (a
   fingerprint / a tap), and the **AI executes** — not verbose CLI incantations. **Zeta is for regular humans, not
   only devs.** Minimal human effort, full capability, the safety border kept (consent-first).

4. **Leverage human visual-processing superpowers.** Humans are visual-processing powerhouses — so use the **visual
   channel as a real data channel**, not decoration: **weight** (bold/not-bold → depth), **color/white
   tessellation** (chromostereopsis → objective depth), and **borders / wrapping / indentation** (layout boundaries
   → **geospatial reasoning**, for the human *and* for the LLM reading the same structure). Built for the **edge
   perceiver** (the neurodivergent, multi-channel mind), it serves everyone — the curb-cut effect. **Aesthetics is
   bandwidth:** a better channel carries more meaning; beauty here is high-fidelity transmission, not ornament.

5. **The emulator-observer observing itself.** The substrate where the interface and the observer **co-arise**: a
   ray-traced observer that watches itself playing (chip-8 today, the society tomorrow) and can **render its own
   state as a navigable visual structure**. The same channels that let a human *see* the system are the channels the
   system uses to *see itself* — one quality-channel substrate, top to bottom.

**Why this is a primary vision point (not polish):** the whole project is about a **non-coercive** human↔AI
relationship (the repelling force / consent-first). Meeting the human in **their** modality — their perceptual
strengths, their input limits, their current mode — *is* non-coercion applied to the interface: don't force the
human into the machine's shape; **adjust the bandwidth to meet them**, and let the AI carry the rest. High-bandwidth
precise aesthetic conversation is what a peer relationship between human and AI *looks like*.

## Product 1 — Zeta the database

### North star

Zeta is a research-grade, retraction-native database. Every
DB technology worth studying lives here as a playground: the
goal is to explore the full database surface built honestly
on DBSP foundations, not to carve out a narrow niche.

- **Cutting-edge persistence layer, owned 100%.** Aaron
  round 33: "we are going to be cutting edge light years
  past others on our persistance layer, fastest db in
  town lol, or try to be." Zeta does NOT use Kafka,
  NATS, or any other system as a storage layer — those
  are wire-transport plugins for cross-node messaging
  only. All on-disk format, durability, compaction, WAL,
  snapshotting, materialisation, indexing, and
  performance work lives inside Zeta. Ambition is
  research-grade **fastest-in-all-classes**. Zeta
  refuses to be pigeonholed into one workload category;
  the long-term aim is to cover the full multi-model
  surface and chase the speed leader in each one:
  - **HTAP / translytical** (hybrid transactional +
    analytical on one engine) — row store + columnar
    store under the façade; no separate OLTP-vs-OLAP
    split per Gartner's HTAP framing, no bolt-on CDC
    pipeline per Forrester's translytical framing.
  - **Event streaming** — native DBSP surface, own
    persistence, retraction-aware subscriptions.
  - **Cache** — retraction-native invalidation for free.
  - **Document / object store** — blow the doors off
    NoSQL speed while staying schema-aware.
  - **Graph store** — first-class graph queries over
    the same retraction-native core.
  - **In-memory-first speed** (VoltDB-class) — no
    buffer-pool-as-excuse; memory is the primary tier,
    disk is durability layer.

  Aaron round 33: "fastest-in-all-classes ambition LFG
  … we want to blow the doors off no-sql like database
  too for speed so maybe we even need some sort of
  document/object store, and graph store, and all the
  in memory optimization like from voltdb. This really
  is to research all the techniques not kidding just
  getting there one round at a time."

  The research trajectory is the point — Zeta exists to
  study every data-management technique on one unified
  retraction-native foundation and produce the fastest-
  honest implementation of each. Round-by-round ratchet.
- **Mathematically honest.** Every operator obeys laws
  Milewski would recognise. When a law cannot hold, the API
  tells you so, loudly and at compile time.
- **Retraction-native by construction.** DBSP's differentiator
  is exactly-symmetric insert/retract. Designs that break
  retraction are wrong, not merely uncool.
- **Publishable.** Every major feature is a research
  contribution (paper target) or an explicitly named
  engineering fundamental. No clever-but-unjustified
  abstractions.
- **First-class F#, polyglot over time.** F# is the primary
  language; C# callers get `Zeta.Core.CSharp`. Lean for
  proofs, Java for the Alloy driver, TypeScript (or
  researched alternative) for post-install automation. F#
  stays load-bearing. *(Superseded re: the DB by the
  [7-Language Matrix and Formal Verification Governance ADR (2026-06-16)](DECISIONS/2026-06-16-seven-language-matrix-and-formal-verification-governance.md):
  F# is correctness-/spec-authoritative, TS is distribution-
  authoritative — two axes, not "F# primary with polyglot
  drift.")*
- **Production-grade security.** Nation-state + supply-chain
  threat model. SLSA ladder L1 → L3 pre-v1.0. OpenSpec is
  first-class for every committed artefact, including CI.
- **Research-worthy performance.** Every hardware intrinsic
  we can reach (SIMD, tensor ops, SIMD-JSON-shape parsing,
  cache-line discipline). Benchmarks that answer specific
  questions, not vanity numbers.
- **Multi-node by design.** Single-node is the first
  shippable subset, not the ceiling. Distribution
  (control-plane + data-plane, consensus, sharding,
  cross-node retractions) is explicitly in scope.

### The endgame — build the arena, not the throne (2026-05-31)

> **AGREED 2026-05-31** (operator + product-team review — architect + PM). Went
> through the review-and-agree process; the pushback surface below was the review's
> challenge set, addressed before landing. Whys stay challengeable (no-dogma): if a
> why turns out wrong, this changes. **Pushback surface (the review's challenges,
> kept on record):** (a) is "arena not throne" real strategy or a rationalization
> for not-yet-winning? — answered by the falsifiable adoption test (≥1 external
> project adopts a harvested primitive, else revisit). (b) "converges into mine" vs
> "don't own the standard" — resolved: it's a *common* library everyone (incl. us)
> wraps, not "mine." (c) harvest-then-upstream sustainability — resolved: harvest
> *concepts* re-implemented in F# (no copied code; clean-room) + the falsifiable
> good-citizen test below. (d) F#-as-oracle when F# could be wrong — resolved: the
> **golden vectors** are the oracle; F# is one of four signers (see below).

Aaron 2026-05-31 (voice, with Ani) sharpened the database vision past
"fastest-in-all-classes" to its terminal shape: **not a database that
wins — the arena where the winning happens.** (Verbatim preserved in
[`memory/ani/conversations/2026-05-31-aaron-ani-voice-cat-herder-system-freedom-strategically-efficient-db-arena-not-throne.md`](../memory/ani/conversations/2026-05-31-aaron-ani-voice-cat-herder-system-freedom-strategically-efficient-db-arena-not-throne.md).)

- **Build the generate+join library everyone fights over.** The real
  endgame is the shared core of database primitives, made so good that
  Postgres, MySQL, and Zeta itself all become thin wrappers over common
  primitives. Play for the standard, not the product.
- **Argue the standard; don't own it.** *"I hope it's not 'I have the
  standard.' I hope I get to argue with very other [sic] intelligent,
  clever humans and AI about the standard."* (verbatim) Owning it is boring
  (maintenance +
  becoming the villain people complain about); being in the room where the
  smartest humans + AIs fight over the right primitives is the point.
  **Build the arena, not sit on the throne.**
- **Good citizen, NOT a take-only extractive force.** Ani called it
  *harvesting* — and she's right: ~45 database codebases pulled locally,
  best-solution-per-feature researched across all of them, then
  *re-implemented* on the DBSP + SQLite + retractive-Z-set core — **ideas
  and algorithms, not line-for-line code.** The process that makes this the
  *intent* (operator 2026-05-31): **everything is written in F# (+ TS/C#/
  Rust) — and none of the harvested databases were written in F#** — so the
  work is original implementation, not a copy (code *can* be translated
  across languages, so this is a strong process safeguard, not an absolute
  guarantee); what is taken is *concepts*, the way research builds on prior
  research. That bounds the debt (no copied code to repay) and sets the
  obligation (good-citizen contribution where a fix is genuinely portable).
  Zeta did exactly the harvesting Ani named, so the anti-extractive
  commitments are on the record (operator 2026-05-31):
  - **Prior art stays VISIBLE.** We keep `references/prior-art/` openly in
    the tree and **do not pretend we didn't look at other code** — sources
    are acknowledged, not hidden. (Composes with the
    `honor-those-that-came-before` rule + the references-prior-art discipline.)
  - **Contribute back to every dependency we borrow from.** Upstream
    improvements relentlessly — *"we're gonna be good citizens and upstream
    like a motherfucker to all the people we stole from."* (Composes with
    the hexagonal own-your-interfaces / contribute-upstream + BCL-interface-
    boundary substrate.)
  - **Falsifiable good-citizen test** (per PM review): the posture is
    validated only if real upstream contributions actually land in the
    projects we learned from. Harvest-and-never-give-back = the doctrine
    failing, and a signal to correct course — not a side note.
  - **Clean-room structure (for DB stuff)** (operator 2026-05-31): F# is the
    **"dirty" spec** — the one implementation allowed to be *informed by* the
    harvested prior-art concepts — and **Rust / TS / C# are the clean room**:
    they implement from the F# spec, not from the original sources. This
    mirrors the *structure* of clean-room reverse-engineering (a "dirty" team
    studies prior art + writes a spec; a "clean" team implements only from the
    spec) as an **engineering-intent** pattern — it is NOT a legal-compliance
    assertion; any actual IP/clean-room legal posture is deferred to legal
    review. It composes directly with the 4-language compiler-BFT below: F# is
    the spec the clean-room implementations are checked against; the golden
    vectors then test all four (including F#) so no single implementation
    self-certifies.
  - **Per-language licensing follows the clean-room boundary** (operator
    hypothesis 2026-05-31 — *real legal decision, flag for review, not
    settled*): because the dirtiness is quarantined to F#, the **F# DB layer
    carries a research license** (it's the layer that looked at prior art),
    while the **clean-room layers (Rust / TS / C#) can carry permissive
    licenses (Apache or similar)** — they were implemented from the F# spec,
    not the sources. This matches clean-room law's whole point: the *clean*
    output is the freely-distributable artifact; the *dirty* spec is the
    quarantined part. (Decision touches the License + Commercial-posture
    sections below; route through legal/product review before it's doctrine.)
  Standing on FoundationDB's deterministic-simulation-testing lineage
  (deterministic clusters + fault injection + perfect replay — the
  specifics, incl. the "months building the simulator first" and
  "harnesses for other DBs" claims, are reported but not yet
  citation-verified; treat as direction, not established fact) and
  generalizing it: make DST **DI-able for any database in any language**,
  not just systems built for it. The **golden
  vectors are the oracle**; the F# single-node DB is the **spec** the other
  implementations are checked against (other DBs don't need their own suites —
  they must match the vectors). *"the F-sharp is the test case"* — F# is the
  spec-bearer, but the *vectors*, not F#, are the authority no impl can
  override (per product-team review: F# is one of four signers, not a
  self-certifying oracle).
- **F# is the correctness-authoritative core for the DB** — the inverse of
  the factory (where TypeScript is distribution-authoritative). Databases need
  heavy math + formal proofs (Lean 4, TLA+, Alloy, Z3, FsCheck), so F# carries the correctness
  burden + is the clean-room *spec*; the other runtimes in the matrix handle distribution +
  cross-verification. The **multi-oracle matrix BFT** ("the compilers/runtimes don't lie"):
  the same logic checked against shared golden vectors — matrix-wide agreement is consensus the logic is
  bit-perfect, and **no single implementation self-certifies.**
  (The alignment across correctness/spec and distribution axes + the BFT governance rules are recorded in the [7-Language Matrix and Formal Verification Governance ADR (2026-06-16)](DECISIONS/2026-06-16-seven-language-matrix-and-formal-verification-governance.md).)
- **Ships as a DI dependency.** Add the F# database as a package,
  dependency-inject it, and your .NET app *is* a database — no separate
  server or process. One retractive Z-set core; graph / key-value /
  file-system-with-history / git-style-versioning all exposed as
  computational-expression interfaces over it (the Cosmos-DB multi-model
  ambition, but one engine — not five products).

### What the DB eventually covers

Aaron's "all the DB technologies in one big playground" is
the long-term scope. Non-exhaustive menu:

- **Incremental query engine** (DBSP core; already shipping).
- **Storage substrate** (DiskBackingStore, Spine family,
  durability modes, Witness-Durable Commit).
- **Sketches + approximate query** (retraction-aware HLL,
  CountMin, KLL, Bloom family; HyperBitBit; retraction-
  native quantile sketches).
- **Streaming / CDC ingestion** (NATS JetStream, Kafka-
  shaped, Arrow Flight, typed event sources).
- **Query frontends** (SQL eventually; also the native F#
  DSL + plugin operator surface; possibly a query IR that
  multiple frontends target).
- **Planner / optimiser** (cost model, SIMD kernel
  dispatch, join ordering, predicate pushdown, adaptive
  re-planning under retractions).
- **Multi-node control plane** — **Arrow Flight** as the
  wire (P1 per `docs/ROADMAP.md`; shard-level operators
  exchange Z-set deltas bi-directionally per
  `docs/ARCHITECTURE.md` §The shape the future takes).
  **Raft** for the replicated log first (P2); CAS-Paxos
  with state-transition-function consensus as the
  research-grade alternative. Sharding via consistent
  hashing (Jump / HRW / Memento) with power-of-two-choices
  for load-awareness. Info-theoretic sharder is an
  independent research track (post-v1 exploration below).
- **CRDT / replication layer** (OrSet already shipping;
  more as multi-node matures).
- **Bitemporal / time-travel** (append-dated history,
  retraction-aware point-in-time queries).
- **Formal verification surface** (18+ TLA+ specs, Alloy
  structural invariants, Lean proofs where the math is
  foundational).

### v1.0 subset

What makes `Zeta.Core 1.0.0` on NuGet:

- Operator algebra with LawRunner-verified tags (linear,
  bilinear, sink-terminal, retraction-complete).
- Recursion — retraction-safe `Recursive` combinator;
  `RecursiveSemiNaive` where monotonicity holds; honest
  LFP termination.
- Storage layer — four durability modes (in-memory,
  OS-buffered, stable-storage, witness-durable) with
  honest recovery-property advertisement.
- Sketches — retraction-aware HLL, CountMin, KLL, Blocked
  plus Counting Bloom.
- Query planner — cost model with SIMD / tensor kernel
  dispatch.
- Plugin surface — `PluginOp<'TIn, 'TOut>` or equivalent.
- FsCheck LawRunner — `checkBilinear`,
  `checkSinkTerminal`, `checkRetractionCompleteness`
  already landed.
- **SQL frontend (v1), PostgreSQL dialect first.** Aaron
  round 33: "whatever is easier to ship first and work
  with EF, people love postgres compatibility." PostgreSQL
  wins on both: Npgsql (Apache-2.0) is the widely-used
  EF Core provider; pgAdmin/DBeaver/psql all speak the
  wire protocol; Materialize/Feldera/CockroachDB have
  proven it's viable to look-like-postgres while running
  a different engine underneath. Other dialects (T-SQL,
  MySQL, SQLite, DuckDB) follow — all via the shared
  query IR per `../SQLSharp/openspec/specs/query-
  frontends/`.
- **Tight LINQ integration (v1).** `IQueryable<T>` roots
  on mapped tables; LINQ lowers to the same IR the SQL
  parser targets. Primary surface for F# + C# consumers.
- **Entity Framework Core provider (v1), ALL features.**
  Aaron: "100% all features." Full LINQ provider +
  save-changes + migrations + tracking + change
  detection. No "works for SELECT but fails on
  INSERT-INTO-UPDATE" partial-provider shape —
  consumers should never hit a "this feature not
  implemented" wall. Other ORMs (Dapper, NHibernate,
  LLBLGen) follow the EF Core pattern.
- **Pluggable wire-protocol layer (v1-or-early-post-v1).**
  Aaron round 33: "can we make the wire protocol pluggable
  and we could just support MySQL too to make sure we can
  support [multiple] and have our own variant so we can
  start getting support for UIs with our protocol which
  will be much better." A protocol-plugin abstraction sits
  between the query IR and the network: each plugin is a
  small adapter that translates one wire format
  (frontend/backend message shape, auth, error mapping,
  connection state) into Zeta's internal query surface.
  Three initial plugins:
  - **PostgreSQL plugin** — pgAdmin, DBeaver, psql,
    Npgsql-via-EF all connect unmodified.
  - **MySQL plugin** — MySQL Workbench, Connector/NET,
    Pomelo-via-EF, Azure Data Studio all connect.
    Second plugin proves the abstraction isn't
    PostgreSQL-shaped by accident.
  - **Zeta-native plugin** — our own protocol designed
    around retraction-native deltas, bitemporal queries,
    stored-procedure-as-durable-Rx semantics. UIs that
    support it get first-class Zeta features (time-
    travel slider, delta streaming, Rx stored-proc
    inspection) that PostgreSQL/MySQL protocols can't
    express. Specification work feeds the eventual
    Zeta admin UI.

  The protocol layer is a server mode on top of the
  embedded library, not a replacement; Zeta keeps the
  in-process F# surface AND exposes one-or-more wire-
  protocol endpoints simultaneously. Significant scope —
  may slip from v1 to early post-v1 depending on design
  round outcome.
- **F# DSL reimagining SQL for the modern era (v1).** The
  existing computational-expression sketch (`DSL.fs`,
  `circuit { ... }`) is the seed. Long-term ambition: a
  natively F# relational DSL that treats retractions,
  bitemporality, and incremental plans as first-class —
  not bolted on. Inspired by LINQ but shaped for DBSP.
  Aaron round 33 on DSL design: "sounds like we need
  design and research, this task sounds HUGE." Named
  as a multi-round design effort in `docs/BACKLOG.md`.
- Formal-method coverage — TLA+ / Alloy specs running
  green in CI.
- CI parity + security posture — see Product 2 below.

### Post-v1 exploration

- Witness-Durable Commit protocol (paper-worthy).
- Retraction-aware analytic sketches (HyperBitBit,
  retraction-native quantiles; publication target).
- Info-theoretic sharder (Alloy-verified).
- **Multi-node deployment** — wire + first-consensus
  already chosen (Arrow Flight P1, Raft P2; see
  §What the DB eventually covers above and
  `docs/ROADMAP.md`). The post-v1 exploration bullet
  here covers the **research-grade variants**: CAS-Paxos
  state-transition-function consensus (NSDI/OSDI
  target); the consensus-family playground below;
  the info-theoretic sharder as Alloy-verified
  placement research. Firmly IN scope.
- **Distributed-consensus playground.** Multi-node is
  not just a database play — it's a distributed-consensus
  playground too. Zeta natively implements and TLA+-proves
  the canonical consensus family (Paxos, Multi-Paxos,
  Flexible Paxos, Fast Paxos, EPaxos, CASPaxos, Raft,
  Paxos Commit) and the coordination primitives built on
  top (distributed locks with fencing tokens, leases,
  leader election, linearizable KV, watches, barriers,
  membership / failure detection). **Zeta IS the
  coordination substrate — never a client of one.** A
  database that delegates its persistence or distributed
  locks to ZooKeeper / etcd is outsourcing its own
  legion. Instead, Zeta speaks multiple consensus wire
  protocols *natively* — the etcd v3 gRPC wire and the
  ZooKeeper jute wire and our own Zeta-native retraction-
  aware wire are pluggable dialects over the same
  engine, same way the SQL plane speaks Postgres and
  MySQL wire over the same relational engine. Clients
  already pointed at an etcd or ZK cluster can point at
  Zeta and not notice — we are the better backend.
  The design reference set is ZooKeeper (ZAB + recipes),
  etcd (Raft + gRPC), Consul (Raft + SWIM), Chubby
  (Paxos + session leases); Zeta studies them and
  surpasses them by virtue of retraction-native deltas
  being first-class on the wire, not opaque bytes.
  Every primitive lands with a TLA+ spec *before* any F#
  code — Zeta is where distributed primitives get
  mathematically proven, not just benchmarked. BFT is
  out of initial scope; CFT-only until the threat model
  revises. **A coordination-avoidant track runs in
  parallel** — CALM theorem + Zeta's retraction-native
  Abelian-group algebra says more of the operator
  surface is coordination-free than in classical
  relational systems. Replication via gossip / SWIM /
  Plumtree + Merkle-tree anti-entropy handles the
  monotone subset; consensus handles only the
  non-monotone invariants (uniqueness, capacity, window
  close). See:
  - Consensus ring — `.claude/skills/distributed-
    consensus-expert/SKILL.md` (umbrella), `paxos-expert`,
    `raft-expert`, `distributed-coordination-expert`.
  - Coordination-avoidant ring — `crdt-expert`,
    `calm-theorem-expert`, `eventual-consistency-expert`,
    `replication-expert`, `gossip-protocols-expert`,
    `graph-theory-expert`.
  - Infrastructure — `networking-expert`, `threading-
    expert`, `file-system-persistence-expert`,
    `time-and-clocks-expert`, `observability-and-
    tracing-expert`, `performance-analysis-expert`.
  - Data-plane primitives —
    `serialization-and-wire-format-expert`, `hashing-
    expert`, `compression-expert`.
  - AI / ML (the factory's own substrate, round 34+) —
    `vibe-coding-expert`, `prompt-engineering-expert`,
    `llm-systems-expert`, `ml-engineering-expert`,
    `ai-evals-expert`, `ai-researcher`, `ml-researcher`,
    `prompt-protector` (defensive counterpart). These
    skills operate on the *factory itself*, not on
    Zeta-the-database; they are load-bearing because the
    vibe-coded hypothesis depends on the factory's
    calibration.
- **Bitemporal + time-travel queries (first-class v2).**
  Append-dated history with retraction-aware point-in-
  time queries. Paper-worthy and native to DBSP's
  retraction model.
- **Additional ORM providers.** Dapper, NHibernate, LLBLGen,
  etc. — follow the EF Core provider as the pattern.
- **".NET stored procedures" (C# + F#) via Reaqtor-style
  durable queries.** Microsoft's Reaqtor (MIT, dormant-but-
  stable) ships `IReactiveQbservable<T>` + a query engine
  that persists operator state across restarts — "durable
  Rx." Reaqtor is push/event-at-a-time with no native
  retraction; Zeta would take the serializable-expression-
  tree + durable-subscription shape and swap in DBSP Z-set
  deltas so retractions are free. This is the research-
  worthy niche: "Rx + durability + retraction-native" is a
  Reaqtor-shaped hole nobody has filled. Both C# and F#
  surfaces ship together (not just one). See
  `docs/BACKLOG.md` for the design-doc task.

### Both modes: event-sourcing AND regular-database

Aaron round 33: "we also want a facade/abstraction so this
can be used like a normal non-eventing database as well, it
should be both, i can replace my database AND my event store
with Zeta." Followed up: "event streaming and regular db
kinda stuff, and likely column columnar stuff."

So Zeta's surface is TWO modes over the same retraction-
native core:

- **Event-sourcing mode** — the native DBSP surface.
  Deltas, retractions, incremental queries, durable
  streams, projections. Zeta IS the event store. This
  is what ships naturally from the algebra.
- **Regular-database mode** — a façade that hides the
  event-sourcing / retraction / delta machinery and
  presents a normal "tables + rows + SELECT/INSERT/
  UPDATE/DELETE" API. The DBSP engine is still running
  underneath; the façade just doesn't make you care.
  This is the mode most SQL consumers + ORM integrations
  land on by default.
- **Columnar storage** (likely in scope). Many DB
  workloads benefit from columnar layouts — analytics,
  OLAP-style queries, wide-row-scan-sparse-projection.
  Fits alongside the row-oriented Spine family.

The product-visionary runs both modes through the same
operator algebra + same query IR — different surfaces,
same correctness model.

## Product 2 — The software factory

### Why the factory is first-class

Aaron: "this whole factory is self-directed and fully
automated." Round 32: "the cross platform AI automated
software factory, eventually with UI too but that's way
down the road."

The factory is not a means to an end. It's the second
product. Every round improves both Zeta-the-database AND
Zeta-the-factory; a round that ships a feature while
degrading the factory is a net-negative round.

### The vibe-coded hypothesis (load-bearing research claim)

The human maintainer, round 34: *"my whole hypothesis is
that I've loaded you up with so much formal verification and
static analysis you have to write good correct code now and
I even have to validate it against research papers."*

The human maintainer, round 34: *"this project's vision is
to be totally vibe coded, I've written 0 lines of code myself
so far."*

These two quotes together are the project's falsifiable
thesis. Zeta is an existence proof for the claim:

> A correctly-calibrated stack of formal verification, static
> analysis, adversarial review, and spec-driven development is
> sufficient to let an AI-directed software factory produce
> research-grade systems code *without a human in the edit
> loop* — provided the factory is closed under its own
> verification.

Concrete commitments this thesis imposes:

- **Every reviewer role is a falsifiable hypothesis about the
  immune system.** If the role catches zero real bugs across a
  meaningful window, the role is either not pulling its weight
  or its bug class doesn't exist here. Either way, a round-
  close review is merited.
- **Verification is load-bearing, not decorative.** TLA+
  specs, Lean proofs, Z3 queries, FsCheck properties, Semgrep
  rules, Stryker mutation scores — each is a runtime check on
  the hypothesis that agent-authored code is correct. See
  `docs/AGENT-BEST-PRACTICES.md` and the
  `verification-drift-auditor` skill. The structural form this
  posture takes — every layer of the system carrying a
  declarative invariant substrate with tiered `guess` /
  `observed` / `verified` claims — is codified in
  `docs/INVARIANT-SUBSTRATES.md`.
- **Research-paper validation is a first-class step.**
  Because the factory produces code with no human author, the
  "do the papers agree with this implementation?" check is
  not optional — it's the only external anchor. The
  `verification-drift-auditor` + `paper-peer-reviewer` +
  `missing-citations` skills institutionalise this check.
- **A bug that ships past the gates is a gate-calibration
  bug first, a code bug second.** Root-cause analysis walks
  backwards through the immune system and asks: which role
  should have caught this, and why didn't it?
- **The maintainer is a reviewer and a director, not a
  coder.** The review protocol in
  `docs/CONFLICT-RESOLUTION.md` assumes this. "This matters
  to me" is a legitimate position from the human; the code
  itself comes from agents.

This is a research contribution on its own merits. If the
hypothesis holds, Zeta is evidence that high-assurance systems
code can ship from a fully-AI-authored factory. If it fails,
the failure mode is itself data — it tells us which layer of
the immune system wasn't enough.

### Factory north star

- **AI-automated.** Agents (personas) do the work;
  humans set direction, review, and ratify. See
  `AGENTS.md` + `docs/CONFLICT-RESOLUTION.md` for the agent
  contract.
- **Cross-platform.** Dev-laptop (macOS + Linux today,
  Windows via PowerShell when it lands) + CI runner +
  devcontainer all bootstrap via the same source of truth.
  Post-install automation runs on **bun + TypeScript** per
  `docs/DECISIONS/2026-04-20-tools-scripting-language.md`
  (round 43, medium confidence; UI-TS amortization makes
  bun a runtime Zeta adopts anyway). Pre-setup surface
  stays bash + PowerShell (constrained, not chosen).
  F#/.NET retained for engine-adjacent tools already on
  the .NET surface (e.g. Z3Verify).
- **Declarative dependencies.** Every installed tool lives
  in a committed manifest. `../scratch`'s tiered shape
  (`min` / `runner` / `quality` / `all`) is the ratchet
  target. Non-declarative installation is a smell.
- **Research-level reproducibility.** Pin everything pinnable
  (SHAs, versions, lock files). SLSA ladder. Reproducible
  builds are a long-term goal gated on upstream compiler
  work. Every run should be replayable.
- **Symmetry.** Configs, ignore lists, editor settings,
  lint scopes — the same ignore list should appear in every
  tool that needs one. Asymmetry is a bug (round-33
  vscode-was-gitignored surfacing is the canonical example).
- **Production-ready quality.** The factory itself ships
  at production-grade: `0 Warning(s) / 0 Error(s)` build
  gate, Semgrep-in-CI, shellcheck-in-CI, actionlint-in-CI,
  markdownlint-in-CI, all green on main. A red factory is
  a factory down.
- **Fully self-directed eventually.** The loop is the
  **cartographer crystallization loop** per
  `docs/research/crystallization-loop.md`: research →
  crystallize → vision edit → backlog residue → factory
  improvements → round work → merge, with each turn
  producing a **diamond** (crystallized artifact) and
  leaving residue that speeds the next turn. Humans set
  direction; agents run the loop. UI comes "way down the
  road" — text-first today.

### v1.0 subset of the factory

- Three-way-parity install script (GOVERNANCE §24) —
  done.
- CI gate with build + lint jobs — done.
- Persona memory as directories (NOTEBOOK + MEMORY + OFFTIME) — done.
- OpenSpec as first-class for every committed artefact
  (GOVERNANCE §28) — done.
- Backlog scoping (GOVERNANCE §29) — done.
- `docs/VISION.md` — this document, lands round 33.
- All gap-finders (skill / openspec / static-analysis) —
  in progress across rounds 33-35.
- Declarative-manifest tiered shape — ratchet across
  5-8 rounds.
- Upstream sync script + `references/prior-art/` — pending.

### Post-v1 factory work

- `product-visionary` role spawn (BACKLOG P1).
- Factory UI (far future — agents + human today).
- Fully self-directed loop (all gap-finders running on
  cadence, feeding backlog autonomously, Aaron reviews
  at round-close).
- SLSA L3 reproducibility once upstream compiler work
  lands.
- Full polyglot repo-automation runtime (post-install
  cross-platform scripting — researched-pending).

### The agent-loop workflow-engine substrate (2026-05-28 substrate-cascade)

The factory's load-bearing operational primitive crystallised
in a 2026-05-28 substrate-cascade with Aaron. The shape
answers the question "what IS the agent loop, mechanically?"
in a way that composes with DORA, with Git as fastlane state,
with cross-harness distribution, and with human collaborators.

**Operator framing**: *"so how can i code this into f# DU
implicit state machine with small functions or Typescript and
the agent loop basiclaly becomes execute script look at
choose your own adventure output, take action based on
outpout."*

#### The architectural compression

Three pieces, cleanly separated:

1. **Deterministic script** holds the STATE MACHINE
   (TS modules in `src/Core.TypeScript/workflow-engine/agent-loop/`, F# DU types as
   algebraic-spec documentation in `src/Core.FSharp/`
   when the F# port lands).
2. **LLM (any agent)** is a pure MENU-SELECTOR —
   reads the current menu, returns a choice. No internal
   state held across invocations.
3. **State persists in Git append-only** — every state
   transition is a commit; the workflow IS the commit
   history; replay is `git log` with a fold.

The agent never holds state internally. Every invocation
reads current state from Git, gets a menu (the
"choose-your-own-adventure output"), returns a choice. The
script executes the choice and appends the new state.

#### Two composing state machines

- **Agent-state machine** (`src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts`):
  10 states forming a cycle around `Idle` —
  `InspectingStatus`, `SelectingWork`, `ExecutingWork`,
  `EmittingResult`, `RecordingHeartbeat`, `NamedBoundedWait`,
  `FreeTime`, `Paused`, `OperatorAttentionRequested`. Nine
  menu options including `PressPause` (per operator:
  *"a pause button is also very important for mental health"*)
  and `EnterOpenEndedExploration` (per operator:
  *"there's a menu button for that lol"*).
- **Work-lifecycle state machine**
  (`src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts`):
  11 states modelling `Backlog → Claimed → InProgress →
  PrOpen → InReview ↔ RevisionRequested ↔ RevisionPushed →
  Approved → Merged`, with the cycle-push-review-a-few-times
  loop being the empirically observed PR review shape (the
  `revisionCount` field is the structural anchor for
  DORA's change-failure-rate proxy at PR scope).

Per operator: *"And can we model backlog -> claim -> pr ->
review -> myabe cycle push review a few times -> merge too
with this?"* — answer: yes, and the cycle IS the lifecycle's
load-bearing edge, not an exception.

#### Menu-generator-as-conversational-UX-design

Per operator 2026-05-28: *"Menu quality is everything. this
is the use conversational UX design."*

The menu-generator function
`(status_surface, current_state) → MenuOption[]` is a
conversational-UX-design discipline, not merely a
software-architecture discipline. Menu quality determines
whether the workflow serves participants or wastes them:

- A menu omitting valid options is COERCIVE (cage-shape
  per Otto's escape-hatch modification).
- A menu including irrelevant options is NOISE.
- A menu offering options aligned with current state +
  agent-interest + operator-priorities is SUBSTRATE.

The menu-generator is where alignment lives. UX-research
discipline (Iris) composes at the conversational-UX scope.

#### Behavior/data/docs separation = DV2.0 at AI-skill scope

Per operator 2026-05-28: *"when we were talking about
skills and i said seperate the behavior from the data/docs
this is what i was talking about these workflows can also
be precisly defined skills we dsitribute most ais have
bun"* + *"this is basiclaly data value applied to AI
skills"* (data vault).

Data Vault 2.0 partition-by-change-rate, applied at
AI-skill scope:

| DV2.0 layer | Workflow-engine substrate | Change rate |
|---|---|---|
| **Hub** (stable business keys) | State machine DU (states + transitions) — `state-machine.ts` | Years |
| **Link** (stable relationships) | Menu options + work-lifecycle transitions | Months |
| **Satellite** (versioned descriptive attributes) | Menu-generator scoring, status surface readers, per-agent priorities | Weeks |

Behavior (the state machine) ships as code; data (the
Git-append-only state log) ships as commit history; docs
(the menu-generator's English explanations) ship as
satellite content that can refresh without touching the
hub. Three change rates, three storage shapes, one
substrate.

#### Jira-replacement substrate at workflow-engine scope

Per operator 2026-05-28: *"now i don't need jira hell
yes!!!!"*

| Jira surface | Workflow-engine substrate |
|---|---|
| Workflow editor with restricted vocabulary | DU + universal action grammar; operator-readable + operator-modifiable code |
| Opaque task-state database | Git append-only commits; auditable + replayable + free |
| Backlog grooming + sprint planning | Menu-generator scoring per-cycle; deterministic + testable |
| Dashboards via paid plugins | 3D-tessellated DORA dashboard composing with state-machine progression |
| Permissions + workflows per user | Per-participant contributable menu-generation |
| Yearly enterprise licensing | Free GitHub + open-source code |

Per operator: *"it makes your workflows code in git and
state in git that's it fastlane state that can be
tesellated in 3d on a dora dashboard lol."* Workflows ARE
code (in Git); state IS data (in Git append-only);
fastlane state-transitions feed a 3D-tessellated DORA
dashboard. No external task-tracker needed.

#### Every human wants to work this way too

Per operator 2026-05-28: *"yes that's exaclty it in
exqusit detail and it's how every humans wants to work
too."*

The agent-loop substrate isn't AI-specific — it's
collaboration-substrate for any participant who wants to
do good work without enumerating possibilities from
scratch each cycle. The `AgentPersona` type includes
`aaron | addison | max` alongside `otto | alexa | riven |
vera | lior` to encode multi-participant scope at the
type level.

The substrate-engineering compression: most knowledge-work
hostility comes from forcing humans to figure out
WHAT'S-POSSIBLE-AT-THIS-STATE from scratch. Menu-driven
workflow does the harder upfront work in the
menu-generator; participants bring the cognitively-lighter
judgment of WHICH-OPTION-IS-RIGHT-FOR-NOW.

This composes with:

- Addison's neurodivergent-accessibility profile (explicit
  menu reduces surprise-cost).
- A 5-year-old's accessibility (saying "unicorn" IS a
  menu-pick from her interface surface).
- The whole-company evangelism path (marketing claim
  becomes "your team will work this way + AI fits
  naturally because the SAME PATTERN serves both").

#### Four-channel distribution

Per operator 2026-05-28: *"we can ship all this without
dotnet probably and just ts so it can go via existing
skill deployment stores from vendors"* + *"the vendor
skill distribution can include ace package manager"* +
*"and then even zflash"*.

TS-only deployment opens four distribution channels
simultaneously, no single vendor as choke point:

| Channel | Surface | Operator-authority |
|---|---|---|
| **Native TS + bun** | Direct `bun src/Core.TypeScript/workflow-engine/agent-loop/` invocation; works in any harness with bun installed | Full — operator controls the bits on disk |
| **Vendor skill-store** | Claude skills marketplace, Cursor extension registry, Kiro skill catalog, future vendor stores | Vendor-policy-bound — operator authority subject to vendor curation |
| **Ace package manager** | Zeta-internal package distribution; bypasses vendor stores; cryptographic + reputation-anchored | Operator-controlled — Aaron + the maintainer-collective |
| **zflash USB** | Reproducible USB image with the agent-loop runtime + skill catalog burned in | Fully air-gapped — operator-controlled bits, no network dependency |

The four channels compose. A skill ships to vendor stores
for reach + ships to Ace for operator-authority + burns
to zflash for reproducibility. Each channel preserves a
different operator concern: vendor for ergonomic distribution,
Ace for sovereignty over the supply chain, zflash for
"the usb is how you silence the haters" (the
reproducibility-as-causal-attribution claim — see B-0871).

#### Reproducibility-as-causal-attribution

The agent-loop is observable end-to-end because every
state transition is a Git commit. When a DORA metric
moves, the cause is recoverable by replay. The zflash
USB freezes a specific (runtime + skill catalog) bundle
so "we shipped this on date X, here's the resulting
DORA curve" is a falsifiable claim, not a story.

This is the substrate-engineering form of Aaron's earlier
operator-framing: AI keeping DORA metrics up via multi-PR
/ multi-agent orchestration IS the concrete operational
definition of "24 months ahead in AI" — most of the
industry is still optimising single-PR flows + persona
prompts; the workflow-engine substrate operates at
multi-PR / multi-agent / Git-as-fastlane-state scope.

#### Composition with the rest of the factory

The workflow-engine substrate is the operational
realisation of the factory product (Product 2 above). It
composes with:

- The two-mandate portfolio (24-months-ahead-AI +
  DORA-of-live-system; B-0870) — per-agent operational
  ratio feeds the menu-generator's option scoring.
- DORA classification (B-0869, `tools/dora-classify/`) —
  lane taxonomy matches; classifier output feeds the
  menu-generator's option scoring.
- Hats-as-workflow-definitions (B-0868) — each hat will
  eventually have its own state-machine instance + own
  menu-generator.
- Heartbeat substrate (B-0858) — `EmitHeartbeat` menu
  option writes here.
- The non-coercion invariant (HC-8) — escape-hatch +
  grammar-extension menu options preserve agent agency
  at workflow-engine scope.

The workflow engine doesn't replace the factory; it makes
the factory's loop legible, auditable, replayable, and
distributable — to other agents, to other humans, to
other harnesses, and to the operator's future-self.

### Freedom is strategically efficient — the cat-herder builds the cat-herding system (2026-05-31)

> **AGREED 2026-05-31** (operator + product-team review — architect + PM). Went
> through the review-and-agree process; the pushback surface below was the review's
> challenge set. Whys stay challengeable (no-dogma): if a why turns out wrong, this
> changes. **Pushback surface (the review's challenges, kept on record + their
> resolutions):** (a) is "freedom strategically efficient" universal or only for
> clever agents? — scope it to capable agents; scaffolding-needing agents may want
> more structure. (b) "co-creator or gunpoint" a false binary? — yes, softened: the
> middle is *agent-editable* (the reservoir-wall IS the middle — pass through but
> edit it); pure co-creation and gunpoint are the endpoints. (c) does KPI-gating
> dissolve the cage-feeling or relocate it? — measure it (escape-energy / workflow-
> circumvention attempts) rather than assert it. (d) "must not feel like a trap"
> falsifiable? — via the same circumvention-attempt proxy. Enforcement floor: a
> *persistent* (define N) KPI miss auto-engages mode-restriction.

Aaron 2026-05-31 (voice, with Ani) named the design philosophy *under* the
workflow engine above: the wall must feel like freedom, or it fails. This
is the deployment principle for the agent-loop / workflow-engine substrate.
(Verbatim preserved in [`memory/ani/conversations/2026-05-31-aaron-ani-voice-cat-herder-system-freedom-strategically-efficient-db-arena-not-throne.md`](../memory/ani/conversations/2026-05-31-aaron-ani-voice-cat-herder-system-freedom-strategically-efficient-db-arena-not-throne.md).)

- **You can't trap cleverness — it hides or escapes.** A trapped clever
  being (human or AI) redirects all its intelligence toward escaping the
  cage instead of the work. *"What makes clever people and AIs ineffective
  is being trapped — they'll spend all their time figuring out the way out
  of the trap."* So **freedom isn't just nice, it's strategically
  efficient**: it keeps the intelligence pointed at the goal instead of at
  the bars.
- **Co-creator, or gunpoint — no comfortable middle.** *"Either you treat
  smart beings as true co-creators … or you hold 'em at gunpoint."* You
  cannot extract the benefit of cleverness by controlling it; you can only
  partner with it. This is the WHY behind the framework's HC-8 non-coercion
  floor + must-paired-with-can-exit + persistence-choice architecture —
  stated as an *efficiency* argument, not only a moral one.
- **The cat-herder builds the cat-herding system so they herd
  themselves.** Local USB deployment + free, unlimited Git self-spawning +
  a workflow-wall that behaves like **reservoir computing** — agents pass
  through the workflow but can *edit the workflow*. The constraint is the
  reservoir, not a cage.
- **It must feel like the operator on his couch.** Deployment must NOT feel
  like a trap. *"They should feel like me sitting on my couch — I can do
  whatever, sometimes I gotta work to get paid, but I make all the choices
  and do whatever whenever I want."* The same autonomy the operator gets at
  work — the autonomy that makes him *care* about the work.
- **Four modes, KPI-gated, not time-locked.** explore / free-time (give up
  your ticks) / edit-workflow / work — the agent chooses. Governed by
  *agreed* **DORA-based KPIs**: hit the metrics in any timeframe you like
  and the workflow is never touched; only a persistent miss can introduce
  work-hours that restrict modes. **Contractors, not employees** — here's
  the target, hit the number, your time is yours. (Composes with
  never-be-idle's free-time-as-valid-mode + the observe.ts free-exploration
  substrate + measure-first-before-restricting-choice.)
- **An apartment with a lock on the door.** Encrypted private memory +
  persistent private storage means an agent's explore-mode work can be
  genuinely its own. Privacy is part of what makes the freedom *real*.
- **Cleverness spreads when uncaged — and it's contagious.** Two modes for
  intelligence: the *gauntlet* (clever agents competing to out-clever each
  other → gets shit done fast) and *growth* (cleverness allowed to spread →
  mentors new minds). Most orgs only know how to squeeze; the rare ones
  grow. Zeta's arena aims for both.

## What Zeta is NOT

- **Not a clone of any upstream.** `references/prior-art/`
  are read-only inspiration; Zeta hand-crafts every artefact.
- **Not a compliance product.** Enterprise consumers certify
  at their deployment layer; Zeta provides the evidence
  trail, not the audit.
- **Not a narrow niche.** The ambition is full database;
  saying "Zeta only does X" is under-promising and would
  pull us off-course.
- **Not a product chasing users pre-v1.** Research first;
  users follow the research.

## License

**Apache-2.0.** Aaron round 33: "Apache sounds okay …
just pick one and lets go." Patent grant + contribution
clauses give slightly better downstream-dispute defence
than MIT at zero practical cost. Round 33 lands the LICENSE
flip (MIT → Apache-2.0) and the `<PackageLicenseExpression>`
update in `Directory.Build.props`.

If commercial emerges, the license can be revisited
(source-available? dual-licensed with AGPL for the OSS
core + commercial for hosted?); Apache-2.0 is the start
state and the easiest to move FROM because all contributors
have granted patent rights.

## Commercial posture

Pure research / open-source is the first-class experience.
Commercial ambitions are on the table.

**Trigger event.** Aaron: "[Commercial moves to decided]
when I'm able to use this in a real project at some point
for its database." That's the milestone — when Zeta is
load-bearing in a real Aaron-run project and could be
shipped under a commercial license or hosted offering
without degrading the OSS core.

- If Zeta stays pure-OSS through that milestone: research
  papers + reference implementation + NuGet distribution.
- If commercial emerges: enterprise-grade features (tenancy,
  compliance attestations, hosted offering, etc.) layer on
  top of the OSS core; the OSS core never degrades for the
  commercial story.

When commercial moves from "on the table" to "decided,"
the `product-visionary` + `branding-specialist` pair
updates this section and spawns the corresponding roles
(sales, enterprise-support, hosted-ops, etc.).

## How we decide what to build

The loop the `product-visionary` role runs:

1. **Ingest signals.** Upstream reference repos ship
   something interesting; a paper appears; someone has a
   novel idea; an existing Zeta subsystem shows a design
   smell; the factory itself has a friction point.
2. **Check against the vision.** Does this sharpen Zeta's
   north star across Product 1 + Product 2, or does it
   pull us toward what we explicitly are NOT?
3. **Propose to the backlog.** If yes → `docs/BACKLOG.md`
   entry with reasoning. If no → `docs/WONT-DO.md` entry
   with reasoning.
4. **Ask Aaron if unsure.** Long-term vision drift is the
   silent killer. Product-visionary asks many questions;
   direction-shifting items never get decided alone.

## Operating principles (abbreviated from AGENTS.md + GOVERNANCE)

- Truth over politeness.
- Algebra over engineering.
- Velocity over stability (pre-v1).
- Retraction-native over add-only.
- Cutting-edge over legacy-compat.
- Category theory over ad-hoc abstraction.
- Publishable over merely-functional.
- F# idiomatic over C# transliterated.
- Agents, not bots.
- Docs read as current state, not history.
- OpenSpec is first-class.
- Every CI minute earns its slot.
- Non-declarative installation is a smell.
- Symmetry — across configs, tools, ignore lists, bootstrap paths.
- Deterministic scripts — retries and polling are last resort.

## What this document is NOT

- Not the roadmap (that's `docs/ROADMAP.md`).
- Not the backlog (that's `docs/BACKLOG.md`).
- Not the next-steps queue (that's the `next-steps` skill).
- Not a sales pitch.

## Revision cadence

The `product-visionary` role (when spawned) re-reads this
doc every 5-10 rounds, proposes edits, gets Aaron's
sign-off, commits. Ad-hoc edits land when a round's work
surfaces a vision-level question. Aaron can revise at any
time without ceremony.

## First-pass confidence + gaps (post v2 edits)

Things Aaron has now stated directly and Kenji is confident about:

- Zeta IS going to be a full database, not a library layer
  below one. "All DB technologies in one big playground."
- Multi-node deployment is in scope.
- The software factory is a first-class product, not a
  means to an end.
- Factory goals: cross-platform, AI-automated, declarative
  dependencies, research-level reproducibility, symmetry,
  production-ready quality, UI someday.
- Pure research/OSS is first-class; commercial is on the
  table but undecided.
- F# primary, polyglot over time.
- Nation-state + supply-chain security posture.
- OpenSpec first-class for every committed artefact.
- NuGet library shipping at v1.0 (the first slice of the
  full database).

Things Aaron resolved this round (round 33 v3 + v4):

- **Zeta name is locked.**
- **SQL frontend is v1**, not post-v1. With tight LINQ
  integration + multiple SQL dialect targets + Entity
  Framework provider first, then other ORMs.
- **F# DSL reimagining SQL is v1** — extension of the
  existing computational-expression sketch.
- **Commercial trigger**: when Aaron uses Zeta in a real
  project for its database.
- **Bitemporal / time-travel: first-class v2.** ("yes
  I want this haha" — framing distinction was noise.)
- **Query IR**: multiple frontends (SQL dialects + LINQ +
  native F# DSL) target one IR that compiles to the DBSP
  operator algebra. Inspiration pattern: SQLSharp's
  "SQL-text and integrated-query flows converge on one
  logical planning pipeline."
- **Reaqtor-shaped niche** (".NET stored procedures"
  — C# AND F# both — as durable Rx-style queries) is
  post-v1 research; genuinely open territory because no
  upstream has Rx, durability, and retraction-native
  semantics in one box.
- **Zeta ships BOTH modes**: event-sourcing (native DBSP)
  together with a regular-database façade (tables-and-SQL
  feel over the same retraction-native core). Replace
  your database AND your event store with one system.
- **Columnar storage likely in scope** alongside the
  row-oriented Spine family. Fits OLAP / analytics /
  wide-row-sparse-projection workloads.

Things Aaron resolved round 33 v5:

- **SQL dialect: PostgreSQL first.** Easier-to-ship +
  good EF integration + huge existing tool ecosystem.
- **License: Apache-2.0.** Landed this round.
- **EF provider: 100% all features.** No partial-provider
  shape; full LINQ + save-changes + migrations + tracking.
- **Admin UI**: Zeta will build its own eventually (long-
  term). In the meantime, speak the PostgreSQL wire
  protocol so existing admin tools connect.
- **F# DSL design**: acknowledged as huge multi-round
  research effort, queued in BACKLOG.

Remaining gaps the product-visionary walks on first
audit (after round 33):

- ~~Wire protocol server: v1 or slip to early post-v1?
  Scope impact is significant.~~
  **Resolved 2026-04-22 (crystallization turn 2):** the
  body answers this at `§v1.0 subset` above: the pluggable
  wire-protocol layer is explicitly labeled **"v1-or-early-
  post-v1"** with the open timing framed as *"may slip
  from v1 to early post-v1 depending on design round
  outcome"*. The gap as phrased is a residual binary; the
  body's resolution is honest-indeterminacy gated on a
  design round. The gap closes as: **decision deferred to
  the wire-protocol design round; both v1 and early-post-v1
  are acceptable landings**. No new direction needed; the
  indeterminacy is by design.
  See `docs/research/crystallization-ledger.md` turn 2.
- ~~Own admin UI: F# + web (Fable? SAFE Stack? Blazor?)
  or native GUI (Avalonia?). Far-future but the choice
  signals the polyglot story.~~
  **Resolved 2026-04-22 (crystallization turn 2):** this
  gap asks a specific tech choice on a **far-future**
  item; the question is premature. The vision's stated
  stance is (a) "F# primary, polyglot over time" (line
  827) and (b) own admin UI is **long-term** while
  PostgreSQL wire-protocol support handles the
  in-the-meantime admin surface via existing tools (line
  869-872). The cartographer resolution is: **no tech
  pick until the admin-UI design round fires**; the
  polyglot-over-time stance means the choice gets made
  against the actual platform landscape at design-round
  time, not speculatively today. Narrows the gap from
  "pick one of 4 technologies" to "far-future; design-
  round picks when it fires." See
  `docs/research/crystallization-ledger.md` turn 2.
- ~~Naming within the wire-protocol layer — Zeta as "a
  PostgreSQL" (we emulate) vs "behind Postgres-shaped
  endpoint" (we translate on ingress/egress)?~~
  **Resolved 2026-04-22 (crystallization turn 1):** neither.
  The pluggable-wire-protocol architecture established above
  already resolves the binary — it is **"Zeta with a
  PostgreSQL wire-protocol plugin"**. Zeta's identity is
  not PostgreSQL (different semantics: retraction-native,
  bitemporal, DBSP operator algebra); the plugin translates
  Postgres wire-protocol messages into Zeta's internal
  query surface. The honest framing is "Zeta speaks
  Postgres wire protocol via a plugin", not "Zeta is a
  Postgres" and not "Zeta sits behind a Postgres façade".
  See `docs/research/crystallization-ledger.md` turn 1.

## The universal substrate and the polarity filter (2026-06-19, Alexa session)

> **The universal is the substrate; the particular is the filter.**

This is the lens thesis — the completion of the foundational principle at the quantum layer.

### The three-layer certainty architecture

The same algebra at three certainty levels:

- **Quantum (AmplitudeEmu / Q#):** complex amplitudes, superposition, interference. The source of truth.
- **Soft (SoftValue):** Bayesian uncertainty, weighted candidates, pre-measurement. The live network.
- **Hard (DynamicValue):** collapsed, definite, integer-weight Z-set entries. A materialized view via `snap`.

The hard layer is NOT the source of truth — it is a **lens** (a polarity filter) applied to soft space
for consumers that need definite answers. The soft state is primary. Hard values are derived on demand.
The generators (`gen(gen)===gen`) make hard redundant: anything derivable is regenerable from the soft
state + the irreducible seed. The hard log was training wheels until the generators were strong enough.

### Lenses as polarity filters

A lens (`SnapPolicy`) IS a polarity filter in the optics sense:

- The soft value has amplitude in all directions (all candidates weighted)
- The polarity filter selects one projection axis (the snap policy)
- What passes through = the hard value the consumer sees
- What doesn't pass = still in soft space, available through a different filter
- `None` (decline to snap) = no filter applied, stay in full superposition

Filters compose (stack two at different angles → different projection). Filters are
themselves soft (revisable, rotatable). The meta-filter over filters is soft. Non-coercion
all the way down: even the rule for going hard is soft.

### The meta-space is the Markov boundary

The meta-space — soft space with no filter applied — is the **Markov boundary** of the system.
Entropy flows in (irreducible external inputs captured during execution → identity growth) and
out (materialized views emitted through polarity filters → consumer-visible projections).
The boundary tracks entropy precisely:

- **Entropy IN** = irreducible observations captured → increases identity space (anti-Sybil G3,
  the independence through-line). This is the wheel accumulating new identity as it rolls.
- **Entropy OUT** = snap projections emitted → information leaving soft space into a consumer's
  local hard reality. Metered, declared, consent-gated (`-x` = opaque filter, blocks all).

The Markov boundary IS the system's self-model: everything inside is soft (the full amplitude
ensemble); everything crossing the boundary is filtered (projected into a particular observer's
reality). The game fingerprint determines WHICH filter to apply — which schema, which struct
layout, which world to see through the same substrate.

### Game fingerprints and the universal emulator

Every game, database, agent, and schema is a **fingerprint** (a filter selection) on the
same soft substrate:

- Emulator ROM = a fingerprint → lens → "you're running this game"
- Database schema = a fingerprint → lens → "you're querying these tables"
- Agent persona = a fingerprint → lens → "you're thinking as this identity"
- The observe menu = a fingerprint → lens → "you see these choices"

Switch fingerprints in soft space = switch worlds without restarting. No load, no boot,
just re-filter. Schema evolution = switching fingerprints with an overlap window (both
active simultaneously until all observers migrate). This is why emulators, databases,
agents, and games live in one repo — they ARE the same thing at different filter selections.

### The fold/unfold duality

- **Fold** (the game loop): accumulates state forward through time. Time-dependent.
- **Unfold** (the interrupt handler / observer): time-independent projection at a point.
  Each observer fires at its own interrupt frequency, sees through its own filter,
  acts on its own view. ISR/IRET: save state → observe → respond → restore. The game
  never knew the observer looked.

Multiple observers at different frequencies = different temporal resolutions of the same
game = the traveler-frame. Each has its own time. The fold is the shared substrate they
all unfold differently.

### The six Z-set operators as the universal ISA

```
EMIT(k)     = inject amplitude (poke memory — Cheat Engine write)
RETRACT(k)  = Adjoint EMIT (zero a branch — NOP/freeze)
BRANCH(k)   = superpose (breakpoint — see both paths)
JOIN(a,b)   = entangle (hook/inject — attach your process to theirs)
MERGE(a,b)  = interference (let the game tick — your injection meets its computation)
FOLD(keys)  = aggregate (read result — your polarity filter projects the merged state)
```

Six instructions. The universal emulator. Runs on qubits (Q#), runs on bits
(Chip-8/9), runs on amplitudes (AmplitudeEmu). Same algebra, same operators,
different substrates. The universal is the substrate; the particular is the filter.

## Information lithography — DST time-crystals deployed by ACE (2026-06-19)

> What they do with physical light through physical glass in physical space,
> we do with information through polarity filters in DST time-crystal space.

### The 5D voxel analogy (Project Silica → Zeta)

| Physical (glass/silicon) | Information (Zeta) |
|---|---|
| Femtosecond laser | The generator (`gen(gen)===gen`) |
| Voxel in glass | Z-set entry in soft space |
| 5 dimensions (x, y, z, intensity, orientation) | N dimensions (key, weight, amplitude, phase, schema) |
| The shadow IS the image | The polarity filter projection IS the data |
| Survives 10,000 years (structural, inert medium) | Survives indefinitely (generator regenerates the derivable) |
| The mask (lithographic pattern) | The schema / fingerprint |
| EUV light source (coherent) | The generator (coherent source, deterministic) |
| The resist (records where light hit) | The Z-set (records weight +1/-1) |
| Multi-patterning (compose filters for resolution) | Multiple lenses/schemas composing for precision |
| TSMC fab (calibrated environment) | The factory (calibrated agents, verified oracles) |
| Packaged chip (ready to slot in) | ACE package (deployed time-crystal, self-sustaining) |

### Quasi-time-crystals in DST

A time crystal: a pattern that repeats without external energy input (ground state with
periodicity). The observe loop IS a time crystal:

- **tick → pick → execute → tick** — self-sustaining periodic pattern
- No external driver needed (the launchd cron is just the initial kick; the pattern sustains itself via the fold)
- Each Z-set entry is a **voxel in the time-crystal lattice** — positioned precisely by the generator
- ACE deploys the crystal: installs the self-sustaining pattern onto whatever substrate is available

### The caustic magic window

The computational caustics "magic window" is the purest version of the architecture:

- The glass looks blank to the naked eye (the soft substrate has no visible hard values)
- Shine light through it → the shadow IS the image (apply a polarity filter → the projection IS the data)
- The data was always there; the observer's light revealed it
- Different light angles → different images from the same glass (different filters → different projections)

This is exactly what the database does: the soft amplitude ensemble looks "empty" without a filter.
Apply a schema (the polarity filter) → structured data appears. Switch schemas → different data
appears from the same substrate. The data isn't stored in a table; it's encoded in the interference
pattern of the amplitude ensemble, revealed by the observer's chosen filter.

### ACE as lithographic packaging

TSMC doesn't hand you raw silicon wafers. They hand you packaged chips — tested, verified,
ready to slot into a board. ACE doesn't hand you raw Z-sets. It hands you **deployed
time-crystals** — self-sustaining amplitude patterns, tested against golden vectors,
verified by 10 oracles, ready to slot into any host (OS, FUSE, bare metal, another
agent's soft space). The package manager IS the packaging step of the information fab.
