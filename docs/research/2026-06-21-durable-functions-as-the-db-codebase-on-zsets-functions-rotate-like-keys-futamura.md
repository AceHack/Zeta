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
