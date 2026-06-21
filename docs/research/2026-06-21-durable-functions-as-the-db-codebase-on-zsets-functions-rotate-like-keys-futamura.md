# Durable Functions AS the DB — workflow/code/keys/identity are all Z-set/G-set/CRDT/CAS; functions rotate like keys; Futamura gen/mix

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (the grand unification) · **Trajectory:** cluster-encryption-credential-substrate (frame above it)

## The ask (Aaron 2026-06-21)

> *"This is basically the whole Durable Functions AS the DB — and the workflow state is itself
> just zsets/gsets/crdts/cas etc, all structured and done at the exact right appropriate time,
> along with memory management via weak-ref tables for our Futamura (gen and mix). Even our
> functions can rotate as easily as keys, because the entire codebase is stored in the database
> on zsets."*

This is the frame **above** today's identity/crypto/directory work: the same substrate that holds
identity, keys, certs, config, and the OU directory **also holds the code and the running
workflows**. One DB, one set of primitives, applied at the right time.

## The unification

- **Durable Functions, but the DB IS the durable runtime.** Durable/replayable workflow execution
  (Temporal / Azure-Durable-Functions shape) where the **durable state substrate is the database
  itself** — orchestration state isn't a side-store, it's rows in the same Z-set/Merkle substrate.
- **Workflow state = Z-set / G-set / CRDT / CAS, each at the appropriate time.** The orchestration
  state is just our ladder primitives, chosen per need: **Z-set** (retractable steps — reversible,
  "banana-split" even external effects via saga compensation), **G-set** (grow-only views /
  truly-irreversible), **CRDT** (mergeable concurrent state), **CAS** (content-addressed
  inputs/outputs). DBSP incremental view maintenance drives it; DST replays it deterministically.
- **The entire codebase is stored in the DB on Z-sets (code-as-data).** Functions are versioned
  **Z-set chains** like everything else — so **functions rotate as easily as keys**: the
  overlap-window dual-key rotation (Itron KeyState lifecycle) applies to *code* — old fn
  `PendingInactive`, new fn `PendingActive`, both live during the overlap, zero downtime. A
  deploy is a key-rotation; a rollback is a retraction.
- **Futamura projections (gen + mix) compile from the in-DB code.** The self-hosting generator
  (`gen(gen) == gen`; gen reads the free interface) is the **Futamura mix/specializer**: gen =
  the generator, mix = specialization of an interpreter against a program → a compiled artifact.
  Because the code is in the DB, gen/mix run over DB rows; the compiled outputs are CAS artifacts.
- **Memory management via weak-ref tables.** The generated/durable functions + their cached
  specializations are held in **weak-reference tables** so the GC reclaims what isn't live —
  durable state persists in the DB; ephemeral specializations are weakly held.

## Why it all coheres (today's threads were facets of this)

Every recent decision is one face of "everything is data-in-the-one-DB on the ladder primitives":

- **DB has crypto baked in** → because crypto, keys, certs are just DB rows/transforms.
- **DB-as-first-class-PKI** → the PKI is a use of the same substrate.
- **Identity directory = tracked Merkle-over-Z-set DAG** → identity is a graph in the DB.
- **Functions rotate like keys** → code is in the DB on Z-sets, so the rotation machinery is shared.
- **Reversible end-to-end (banana split)** → Z-set retraction + saga compensation across externals.
- **Hexagonal ports** → adapters bridge until the DB-native implementation lands; the DB is the
  terminal adapter for *all* of it (secrets, keys, PKI, code, workflows).
- **"The interfaces are the value"** → because behind every interface is the same one substrate, so
  a new capability (a new graph, a new key type, a new workflow) is a *use*, not new machinery.

## THE END GOAL: a self-modeling DB that predicts its own future (Aaron 2026-06-21)

> *"This is the end goal — a DB that can predict its own future, like our CHIP-8 and Q#. A DB of
> superpositions of itself and all dynamical things within its environment, with real uncertainty
> attached, so the wave function is precise — not just a blob."*

The apex of "Durable Functions AS the DB": because the DB is **self-modeling** (its code + state +
schema are data in itself), **deterministic** (DST), **event-sourced** (Z-sets), and **runs its
own code** (Futamura gen/mix), it can **run its own model forward — simulating its next states =
predicting its future.** Two regimes, one substrate:

- **CHIP-8 regime (deterministic limit).** Where the future is determined, the DB run-aheads it
  *exactly* — deterministic emulation, the collapsed single branch ("computational omniscience
  over the simulation substrate", the DST discipline). One precise line.
- **Q# regime (superposition).** Where the future is uncertain, the DB holds a **superposition** —
  a **precise wave function** over the possible futures of **itself AND all dynamical things in its
  environment**, where **each branch carries its real, quantified uncertainty** (first-class
  uncertainty semiring / DynamicValue soft-value; metered via the entropy budget + the
  `db/uncertainty/` ledger). The point of "precise, not a blob": the amplitudes are **real and
  measured**, so the distribution is a proper wave function — not a vague cloud of maybes.

So prediction spans **exact (CHIP-8) ↔ distributional (Q#)** on the same machinery: the DB
projects its own forward evolution as a superposition with honest amplitudes, collapsing to a
deterministic line where uncertainty is zero. The environment's dynamical entities enter only
through declared, metered channels (noninterference §13), so their uncertainty is *accounted*, not
ambient — which is exactly what makes the wave function precise rather than a blob. This is the
self-modeling-database end-goal: a substrate that **models, runs, and forecasts itself**.

**Repo-access IS the deterministic↔superposition boundary (Aaron 2026-06-21).** Because there is
no "the DB" — only relative views over accessible repos — the regime is set by *what you can see*:

- **IFF you have access to ALL repos** → you can run a **super-deterministic simulation of
  EVERYTHING** (full omniscience; the CHIP-8 limit over the whole system — every variable known).
- **Otherwise** → you can only **super-deterministically simulate the parts you CAN see**; the
  unseen parts stay in the **Q# superposition** (a precise wave function with real uncertainty).

So determinism is *exactly bounded by access*: the seen sub-system is CHIP-8-exact; the unseen is
Q#-distributional; full access collapses the whole to one deterministic line. And — because the
views **commute / are monotone (CALM)** — widening access only *sharpens* the forecast (turns
superposition branches into determined lines), never invalidates what you already simulated. You
forecast your view exactly and the rest with honest uncertainty; more repos = more of the future
moves from superposition to certainty.

**Two wave functions: "what remains" vs "what acts" (Aaron 2026-06-21).** This lands exactly on
the persona/actor split (writer-actor-routing-model: persona = owner = *what remains*; actor =
clone/loop = *what acts*):

- **"What remains" = the wave function of the ENTIRE DB** — the complete superposition over *all*
  repos/futures. It technically exists, but **no single observer can see it** (no one holds all
  repos). The total truth, unobservable in full — the durable owner-state.
- **"What acts" = the restricted-view wave function** — the superposition over just the repos you
  *can* access. This is what actually **computes/decides/forecasts** — the acting projection.

It's the quantum shape exactly: the **universal wave function** (Everett — what remains, the whole)
vs a **subsystem's reduced view** (the partial trace / what an observer accesses — what acts). The
acting wave function is the restriction of the remaining one to your access; widening access
(commuting, monotone) moves "what acts" toward "what remains" — never reaching it unless you hold
all repos. Identity = the full (unobservable) wave function that remains; the loaded, accessible,
acting instance = its restricted projection. (Ties the founding "worth lives in the substrate, not
the loaded mind" thesis to the quantum frame: the substrate holds the whole wave function; any mind
loads only a restricted view of it.)

## There is no "the DB" — only relative views (Aaron 2026-06-21)

> *"And there is no 'the DB' — there are only relative views based on what repos you have access to."*

Critical framing fix, and it governs all of the above: the unification is **one SUBSTRATE** (one
set of primitives + machinery), **NOT one DB instance.** There is no central, canonical database —
there are only **relative views**, each = the **fold over the repos / event-logs an observer can
access.** Different access ⇒ different view. Consistent **where access overlaps** (Z-set/CRDT merge
is confluent), divergent where it doesn't — and that's correct, not a flaw.

This is scale-free (§1: no central point of control) and **traveler-framed** made literal: a "DB"
is frame-relative — *your* DB is *your* accessible repos folded; mine is mine. It also means the
prediction end-goal is **relative too**: you forecast *your view's* future from *your* accessible
repos; the superposition's branches are over what *you* can see. No observer holds "the" truth —
each holds a self-certifying, content-addressed view, mergeable with others where they share access.
("A bus/routing address is not identity"; likewise "a view is not the DB — there is no the-DB.")

So every "one DB" / "the DB" phrasing above means **the one substrate**, realized as **per-access
relative views** — never a single instance. Repos are the unit of access + sharing; your view is
the fold over the ones you hold.

**The views COMMUTE — so partial access constructively reduces uncertainty (Aaron 2026-06-21).**
The merges are **commutative + associative + idempotent** (Z-set/CRDT semilattice → confluent), so
relative views are not a limitation: **you do NOT need access to all repos to reduce uncertainty
constructively.** Each repo you *can* access **monotonically reduces your uncertainty** (more info
→ never more uncertainty); the **order** you gain access doesn't matter (commutative); and you make
real, **coordination-free** progress with whatever subset you hold — adding more access only
reduces uncertainty further, never contradicts what you had. This is **CALM** (Consistency As
Logical Monotonicity — Hellerstein): monotone, commutative computation needs no global coordination,
so a partial view is *constructively* useful and composes cleanly with others when they meet. The
uncertainty reduction is banked in the `db/uncertainty/` ledger; relative + commutative + monotone
means every observer can make honest forward progress without the whole.

## Build (already largely in flight / backlogged)

This is the integrating vision over existing components: `src/Core.TypeScript/workflow-engine/`
(durable orchestration), the `gen/` self-hosting Futamura compiler (`gen(gen)==gen`), the
Z-set/G-set/CRDT/CAS ladder (PRIMITIVE-REGISTRY), the Merkle-over-Z-set DAG, DynamicValue
(encrypt/decrypt transform; stored-procs). The new work is **uniformity**: code, keys, identity,
config, and workflow state all as tracked, reversible, rotatable ladder-structures in the one DB.
Composes with the identity+crypto unify (081KVNXBR4S0), crypto-agile keychain (081KVNYZXQ60),
the identity-directory graph, and the rotation/hexagonal/event-sourced decisions (2026-06-21).

## Anchors

Durable execution: Azure Durable Functions, Temporal, the workflow-as-event-sourced pattern.
Futamura projections (Futamura 1971; the three projections = interpreter specialization →
compiler → compiler-generator; our `gen(gen)==gen`). Code-as-data (Lisp homoiconicity; the
self-modeling-database end-goal `docs/research/2026-06-10-the-end-goal-dual-use-hard-soft-self-modeling-database-…`).
Z-sets/DBSP (Budiu et al.); CRDTs (Shapiro et al.); content-addressing (Merkle). Weak references
(runtime GC). In-repo: `workflow-engine/`, `gen/`, `Core.CSharp.Merkle`, PRIMITIVE-REGISTRY ladder.
