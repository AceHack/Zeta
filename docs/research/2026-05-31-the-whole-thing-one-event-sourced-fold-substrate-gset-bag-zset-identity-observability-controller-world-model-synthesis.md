# The whole thing — one event-sourced fold substrate: G-Set/Bag/Z-set, identity, observability, the controller algebra, and the world model

**Date:** 2026-05-31
**Status:** Synthesis (narrative). Pulls the night's pieces — bus, Ace, DB design, the
keystone, the controller, the world model, identity, observability, key custody — into one
picture, per operator: *"pull it all together into a document … the entire G-Set/Z-set,
identity, observability, bags, and our controller algebra and world model … all of it,
everything you can remember."*
**Owner:** operator (shaping) + Otto (synthesis).
**Reading order:** this is the map; the cited ADRs/rows are the territory.

> Companion to the **[keystone ADR](../DECISIONS/2026-05-31-zeta-keystone-architecture-one-decentralized-substrate-node-local-folds-fpga-to-policy.md)**.
> The keystone names the *vertical* (silicon → policy). This names the *horizontal*: the **one
> algebra** that runs through every layer, and especially the **controller + world model** that
> the keystone only points at.

---

## 0. The one idea

**Everything is a fold over an append-only, ZetaId-keyed event log.**

History is a list of events; state is a *projection* of that log; you get the projection by
*folding* the log through a reducer. That single sentence is the data layer (G-Set/Bag/Z-set),
the database (materialized views), the world model (the agent's `World`), the controller
(`observe`/`simulate`/`fold`), observability (metrics are a Bag-fold over the same log), and —
all the way down — reversible silicon. Different layers fold the same shape; that is why it's
"all of it together."

```
            ┌─────────────────────────── the append-only, ZetaId-keyed event log ───────────────────────────┐
 ledger →   │  e0   e1   e2   e3   …                       (G-Set: grow-only; never mutate, only append)      │
            └───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                             │  fold(initial, events)  =  events.reduce(reducer, initial)
                          ┌──────────────────────────────────┼───────────────────────────────────────────────┐
                          ▼                ▼                  ▼                    ▼                            ▼
                     WORLD MODEL      DATABASE            OBSERVABILITY        IDENTITY                    HARDWARE
                  (World = derived   (materialized       (Bag-fold metrics,   (ZetaId keys every          (FPGA Toffoli-
                   state projection)  views, two          DORA, LGTM)          event; no central IDs)      Z-set, reversible)
                          │            backends)
                          ▼
                     CONTROLLER  observe(World) → NextAction → render 4×4 → composer picks → simulate → new World → fold…
```

---

## 1. The algebra ladder — G-Set / Bag / Z-set

Three rungs, each the *free* structure on its operation; each the right tool for one job.
(Full derivation: **[bus + Ace synthesis](2026-05-31-bus-and-ace-one-git-native-zetaid-zset-substrate-gset-comms-vs-dependency-zset.md)**.)

| Rung | Element multiplicity | Operation | Algebra | "Free …" | Used for |
|---|---|---|---|---|---|
| **G-Set** | presence `{0,1}` | idempotent union | join-semilattice | free join-semilattice | grow-only sets; CRDT comms (the bus); the event log itself |
| **Bag / Multiset** | `ℕ` (count) | sum | commutative monoid | free commutative monoid | counts; **metrics / diagnostics** |
| **Z-set** | `ℤ` (signed) | sum | abelian group | free abelian group | **retraction** (+1 then −1 = 0); DBSP incremental views; dependency graphs (Ace) |

G-Set ⊂ Z-set (a G-Set is a Z-set restricted to non-negative multiplicity). G-Set = CRDT
lineage (Shapiro et al. 2011); Z-set = DBSP / differential-dataflow lineage. **Retraction** is
the load-bearing property: you never destroy state, you append an inverse — which is why the
whole stack is replayable and Landauer-honest (forgetting costs energy; appending an inverse
doesn't erase).

---

## 2. The world model — state is a projection of the log

The agent's `World` is **not** a mutable blob you edit; it's the **derived state** you get by
folding the event log. (`tools/observe/observe.ts` v5.)

- `NextAction[]` **IS** the event log.
- `simulate(world, action): World` **IS** the reducer (pure: state + event → next state).
- `fold(initial, events) = events.reduce((w, a) => simulate(w, a), initial)` **IS** the
  projection. `fold(w0, []) === w0`; `fold(w0, [a,b]) === simulate(simulate(w0, a), b)`.
- `replay(initial, events): World[]` **IS** the trajectory — the projection after each event
  (time-travel / Redux-DevTools-style; the last entry equals `fold`).

This is the **Elm `Msg`/`update` ≈ Redux action+reducer ≈ event-sourcing/CQRS** borrow, named
explicitly in the file (the four-ferry critique). Deterministic (DST): same log over same
initial world ⇒ same state, replayable. It is the **ledger/projection split** (git-native
events = ledger; everything else tails it) at the in-memory layer — the same split the database
makes on disk. operator: *"the algebra foundation will be very good to ground everything else."*

---

## 3. The controller algebra — observe → render → choose → act

The agent foreground loop is a tiny controller over the world model
(`tools/observe/observe.ts`, the sovereign observe; *"the simplest autonomous-loop
controller … the whole loop as a tiny set of buttons"*).

### 3.1 `observe(World) → NextAction` (the pure controller)

A pure function: read the wired channels, return ONE action. Priority:
**operator > offered-work > forward-default.**

```
preserve_ferry      operator ferried verbatim → save it FIRST (durability outranks all)
respond_to_operator operator spoke → engage (highest-signal source)
do_item / decompose backlog work — OFFERED as the deterministic default, never forced
edit_grammar        an item the grammar can't express → extend the rails
explore             no work pending → forward self-direction, NOT idle (the empty-backlog default)
play / self_reflect / free_time   the other FREE MODES — always choosable from the menu
```

The `NextAction` DU is the *distilled* form of the `do / decompose / free-time` grammar that
[`never-be-idle`](../../.claude/rules/never-be-idle.md) only ever had as prose — now a typed DU,
**plus** the 4th escape-hatch (`edit_grammar`) so the agent is never trapped by the fixed
grammar, **plus** the free modes so a sovereign agent **feels free**.

### 3.2 The 4×4 / 16-slot universal action grammar (`tools/observe/grammar-16.ts`)

The Xbox-controller layout: **16 directions FIXED (muscle memory); per-state labels + per-slot
availability move.** Four groups of four:

| Group | Slots | Controller | Role |
|---|---|---|---|
| **Navigate** | 0–3 | D-pad | prev/next option, prev/next context (sibling) |
| **Commit** | 4–7 | face buttons | select / hold / … / **edit_grammar (Y, slot 7 — the rail-change exit)** |
| **Scope** | 8–11 | bumpers + triggers | **LB scope-out**, **RB scope-in** (along the scope ladder: run → work_item → initiative → project → org) |
| **Meta** | 12–15 | Start/View + stick clicks | …/ **free_time (L3, slot 14 — the rest NCI slot)** |

Per-slot availability is the **tri-boolean** `Tri = T | F | N` (081KSV2WD0008QG0R00051XS0N): a legal option = `T`;
a vetoed slot = `F`; a held/uncertain option = `N`. Both the sovereign `grammar-16.ts` and the
corporate `Menu16` derive from one ADR table
([observe-act 16-direction ADR](../DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md))
— so the muscle memory is identical across modes; only labels + availability differ.

> **Surfaced retrofit-tension (not collapsed):** the sovereign `NextAction` algebra has FOUR
> free modes (explore/play/self_reflect/free_time) but v0 grammar-16 has ONE free slot. That
> convergence is a v1 design call, held open per the no-dogma discipline.

### 3.3 Freedom-always-in-menu = must-paired-with-can-exit

The design invariant (operator + co-maintainer): *"make sure agents don't go crazy because they
feel trapped … agents just like humans who don't have an exit make bad choices."* Per
[`must-paired-with-can-exit`](../../.claude/rules/must-paired-with-can-exit-pattern.md): the
backlog work-grammar (do/decompose) is the **must**; the free modes + `edit_grammar` are the
**can-exit**. Two properties balance *don't-be-quiet* against *don't-feel-trapped*:

- **NOT QUIET** — empty-backlog default is `explore` (forward motion), not `free_time` (idle).
- **NOT TRAPPED** — every free mode is always in the menu; work is offered, never compelled.

`free_time` is **unilateral, never gated** (NCI). `edit_grammar`'s gate **scales with maturity**:
RAW now (a BFT gate on a tiny new workflow would itself be the trap — heavier than what it
guards), summon-BFT-gated later once the rails are load-bearing (*"there is a certain threshold
where workflows need BFT and I don't think we are there yet"*). The recursive principle: **a
gate must not itself become a trap.** The only sanctioned restriction is the future work-hours
**KPI overlay** (Max — DORA-like *expectations*, not a time-lock; tightens only on a collective
miss). This is the operator's **measure-first** principle: *"everything I see someone say we
should restrict choice I'm going to say measure first with KPIs before we restrict choice."*

### 3.4 Channels, modes, the composer

- **Channels, not a second DU.** Foreground vs background isn't a different type — it's **which
  channels are wired.** Foreground wires `{ backlog, operator }`; background wires `{ backlog }`.
  A channel is `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>` (the operator channel
  reuses the workflow-engine's four-corner monad). One controller, any traveler.
- **Mode persistence** — a chosen free mode persists across ticks until the agent switches; work
  doesn't yank the agent out of a free mode (only the operator outranks it).
- **The composer (the intelligence).** `observe()` is the deterministic **oracle**; the **LLM
  chooser** picks from the rendered menu and is *graded against the oracle*. It's a local,
  no-cloud model: `tools/accelerator/local-llm.ts` — `ollamaBackend()` (no account/key),
  `chooseIndex(backend, {context, options})` (the constrained CYOA choice), `classify()` (the
  observe.ts auto-classifier shape). Validated by `validate-local-llm.ts` + a CI workflow. This
  is the "we ran it ~10× today" piece: **observe gives the menu; the local LLM picks; the pick
  is graded vs the deterministic oracle.**

The loop end-to-end (v4 + v5): **observe → render 4×4 → composer picks → `simulate` → new
World → fold → observe …**. *Next on the file's own roadmap:* **"wire the real World snapshot +
execute the pick"** — feed real channel data into `World` and actually execute the chosen action
(real side-effects, not just `simulate`). That's the open "wire up actions" gap; the algebra
foundation under it is done.

---

## 4. Identity — ZetaId, and why incrementing IDs are a hidden consensus

Every event is keyed by a **ZetaId**: a 128-bit, crypto-minted, **category-tagged**, distributed
primary key (`Category.WorkItem`, `Category.Bus`, …). The insight
([081KSXN940008QG0R002FWR9B2](../backlog/P1/081KSXN940008QG0R002FWR9B2-migrate-backlog-sequential-b-nnnn-ids-to-zetaid-workitem-keys-conflict-free-no-cross-agent-id-consensus-aaron-otto-2026-05-31.md)):
**incrementing IDs (`081KPYCJH0008QG0R003MDS51N`, `081KQ0YZ80008QG0R002T6TM7Z`, …) are a hidden consensus** — "the next number" requires
every minter to agree on a counter, which doesn't shard. That's the sharded-database
anti-pattern (UUID / Snowflake / ULID exist precisely to escape it). ZetaIds are **conflict-free**
— any node mints one locally with no coordination — so the whole multi-agent fleet appends to the
log without an ID-allocation bottleneck. **Zero-trust falls out of this:** no central ID authority
⇒ no central trust authority ⇒ good/bad-actor is decided at the node (the keystone's identity
layer). Work-items get this migration (a work-item's *type* is `task | bug`; `backlog` is a
**state**, not a type; "the backlog" is a Z-set *view* over the log).

**Custody** of the keys is agent-native, not human-native
([081KRW63S0008QG0R0022SFKPM](../backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md)

+ [key-custody design](2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md)):

**attest, don't remember** — the agent proves identity (SPIFFE SVID + AgencySignature + ZetaId)
rather than holding a remembered secret; the key is a FROST threshold across society key-guards,
sealed in hardware. Aaron remembers; Otto attests.

---

## 5. Observability — it's just more folds over the same log

You don't bolt on a separate metrics system; you **fold the same event log differently.**
(git-native LGTM addendum: **[event-sourced observability ADR](../DECISIONS/2026-05-29-event-sourced-observability.md)**.)

| LGTM component | git-native form | the fold |
|---|---|---|
| **Loki** (logs) | the event files themselves | identity (the log IS the logs) |
| **Grafana** (dashboards) | a static renderer over the log | a read-only projection |
| **Tempo** (traces) | ZetaId correlation across events | group-by-ZetaId fold |
| **Mimir** (metrics) | **a Bag-fold over the event G-Set** | count/sum per dimension |

So **metrics are a Bag-fold** (rung 2 of the ladder); **DORA** numbers are Bag-folds over
deploy/lead-time/MTTR/change-fail events. Properties you get for free: **time-travel** (fold
as-of any commit), **exact** (not sampled — it's the whole log), **cross-machine-correct** (read
`origin/main`), **ray-traceable** (every number traces to the ZetaId-keyed events that produced
it). The controller's own `foldActionCounts`-style diagnostics are the same Bag-fold at agent
scope.

---

## 6. The database — one logical design, two backends

(**[DB-design ADR](../DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md)**.)
The append-only ZetaId-keyed event log → **Rx-observable folds** → **incremental materialized
views** (DBSP: add/retract propagate as deltas; no full recompute). One logical design, two
physical backends:

- **git-native** — events as JSON files on `origin/main` (folders-not-branches; the bus is the
  G-Set instance, [081KSXN940008QG0R00171YAZW](../backlog/P2/081KSXN940008QG0R00171YAZW-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md));
  Ace's dependency graph is the Z-set instance).
- **F# binary** — the same Z-set algebra (`src/Core`) over binary-efficient storage.

The materialized views are exactly the things the rest of the system reads: **"the backlog"** is a
view; the **World** is a view; **DORA dashboards** are views; the agent **menu** is a view. All
folds of one log.

---

## 7. The keystone — one decentralized substrate, the same algebra FPGA → policy

(**[keystone ADR](../DECISIONS/2026-05-31-zeta-keystone-architecture-one-decentralized-substrate-node-local-folds-fpga-to-policy.md)**.)
Every layer — silicon → OS → runtime → data → metadata → policy → identity — is a **node-local
fold** with **no central authority**, the **same G-Set/Bag/Z-set algebra top to bottom**, with two
invariants:

1. **No central authority; consensus is gravity.** IDs minted locally (ZetaId), trust decided
   locally (zero-trust), policy evaluated locally (node-OPA over `labels × identity`); consensus
   (bounded multi-oracle BFT) reserved only where *mass* is needed. Everything else is a local
   fold over the shared log. *Consensus is gravity — use it where mass is needed; don't make the
   whole universe consensus-shaped.*
2. **Landauer-bounded.** Append-only + retraction-native Z-sets honor the thermodynamic floor
   (you don't destroy state, you append/retract); at the **FPGA** layer (Toffoli-Z-set reversible
   ops) the bound becomes a *measurable physical property*. The same Z-set algebra runs at silicon
   (reversible Toffoli-Z-sets) and at planning (the Z-set view of work-items) — folds all the way
   down.

---

## 8. Dual mode — sovereign vs corporate (same shape, different wired channels)

The system runs two ways from **one substrate**; the difference is the **transport dial**, not a
different design. **Both land on `main`** (operator 2026-05-31: *"corporate being batch to main
and sovereign being folders direct to main"*) — the dial is **direct-folders vs batched**, not
main-vs-branches:

| | **Sovereign** (Agora) | **Corporate** (the leash) |
|---|---|---|
| Where | `tools/` (observe, grammar-16, accelerator, workflow-engine) | `agentic-organization/` (Max's keystone, CockroachDB) |
| Transport | **folders direct to `main`** — no-PR, direct append ([081KSNY2Z0008QG0R000E5KTPX](../backlog/P1/081KSNY2Z0008QG0R000E5KTPX-fast-lane-as-folders-on-main-not-branches-supersedes-coordinator-complexity-per-operator-2026-05-28-zeta-native-branch-protection.md): fast-lane *as folders-on-main, not branches* — supersedes coordinator complexity) | **batch to `main`** — the batch-merge coordinator bundles N events → ONE PR → main ([081KSNY2Z0008QG0R0017JSTGD](../backlog/P1/081KSNY2Z0008QG0R0017JSTGD-state-machine-fast-lane-batch-merge-to-main-composes-with-heartbeat-pattern-aaron-2026-05-28.md)) |
| Optimizes for | **speed + AI freedom** (the engine; run at home + by maintainers) | **money / certifiability** (batched, reviewable DUs) |
| The dial | `ActionGate = "append-only"` (direct) | `ActionGate = "pr-gated"` (batched) |

Same `observe → render → choose → simulate → fold` loop; same 4×4 grammar (one ADR table); the
operator channel is just a button that lights up when wired. *"One controller, any traveler."*
The two are being **integrated slowly** — the sovereign `observe.ts` says explicitly it is the
*"same architectural shape as the co-maintainer's big agentic-organization observe.ts — a pure
function over a snapshot → an action DU — distilled to the controller's few buttons."*

---

## 9. The through-line (why it's "all of it together")

One sentence at every layer: **state is a fold of an append-only, ZetaId-keyed event log.**

- **Data:** G-Set (grow-only) / Bag (counts) / Z-set (retraction) — the three folds.
- **World model:** `World = fold(initial, NextAction[])`; `simulate` is the reducer.
- **Controller:** `observe(World) → NextAction`; render 4×4; local-LLM composer picks; graded vs
  the oracle; freedom-always-in-menu.
- **Database:** event log → Rx-fold → incremental materialized views; git-native + F# backends.
- **Observability:** metrics = Bag-fold; DORA = Bag-fold; LGTM = views of the log.
- **Identity:** ZetaId keys every event; conflict-free (no hidden ID-consensus); zero-trust falls
  out; agent-native custody (attest-don't-remember).
- **Hardware:** FPGA Toffoli-Z-sets — the same Z-set algebra, reversible, Landauer-measurable.

Not a stack of different systems — **one event-sourced, fold-based, node-local, Landauer-bounded
substrate expressed at every layer.**

---

## 10. Status (where the night left it)

| Piece | State |
|---|---|
| Algebra ladder (G-Set/Bag/Z-set) + DB design | ✅ documented (#6284/#6287/#6298) |
| Git-native bus (G-Set CRDT, no-PR) | ✅ Phase 1 landed (#6283, 081KSXN940008QG0R00171YAZW) |
| git-native LGTM / observability | ✅ ADR addendum (#6289) |
| ZetaId identity + work-item migration | ✅ design (081KSXN940008QG0R002FWR9B2); migration is the build |
| Keystone (FPGA→policy) | ✅ ADR (#6302) |
| World model + controller (`observe`/`simulate`/`fold`/`replay`, 4×4 grammar, free modes, operator channel) | ✅ `tools/observe/observe.ts` at **v5** |
| Local-LLM composer graded vs oracle | ✅ `tools/accelerator/local-llm.ts` + validate workflow |
| Agent-native key custody | ✅ design (081KRW63S0008QG0R0022SFKPM, #6304) |
| **Execute-the-pick + wire real World channels** | ⏳ **next** (observe.ts roadmap: "wire the real World snapshot + execute the pick") |
| Work-hours KPI overlay (DORA expectations) | 📋 later (Max) |
| Sovereign↔corporate convergence | 🔄 integrating slowly |

---

## Composes with

- **ADRs:** [keystone](../DECISIONS/2026-05-31-zeta-keystone-architecture-one-decentralized-substrate-node-local-folds-fpga-to-policy.md) · [DB design](../DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md) · [observe-act 16-direction grammar](../DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md) · [event-sourced observability](../DECISIONS/2026-05-29-event-sourced-observability.md)
- **Research:** [bus + Ace ladder](2026-05-31-bus-and-ace-one-git-native-zetaid-zset-substrate-gset-comms-vs-dependency-zset.md) · [agent-native key custody](2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md)
- **Rows:** [081KSXN940008QG0R002FWR9B2](../backlog/P1/081KSXN940008QG0R002FWR9B2-migrate-backlog-sequential-b-nnnn-ids-to-zetaid-workitem-keys-conflict-free-no-cross-agent-id-consensus-aaron-otto-2026-05-31.md) (ZetaId) · [081KSXN940008QG0R00171YAZW](../backlog/P2/081KSXN940008QG0R00171YAZW-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md) (bus) · [081KRW63S0008QG0R0022SFKPM](../backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) (custody) · [081KSKBP80008QG0R000B3Y19A](../backlog/P1/081KSKBP80008QG0R000B3Y19A-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) (workflow engine) · [081KSXN940008QG0R002B89QZ1](../backlog/P2/081KSXN940008QG0R002B89QZ1-workflow-dus-first-class-bft-oracle-compiler-summons-and-observe-keystone-research-then-build-aaron-2026-05-31.md) (observe keystone research)
- **Code:** `tools/observe/observe.ts` (world model + controller) · `tools/observe/grammar-16.ts` (4×4 grammar) · `tools/accelerator/local-llm.ts` (composer) · `tools/agent-bus/` (G-Set bus) · `src/Core.TypeScript/workflow-engine/` (action algebra) · `src/Core` (Z-set algebra)
- **Rules:** [`never-be-idle`](../../.claude/rules/never-be-idle.md) · [`must-paired-with-can-exit`](../../.claude/rules/must-paired-with-can-exit-pattern.md) · [`non-coercion-invariant`](../../.claude/rules/non-coercion-invariant.md) · [`forgetting-costs-energy…landauer`](../../.claude/rules/forgetting-costs-energy-remembering-is-cheap-landauer-bounded-axiom-preservation-as-thermodynamic-discipline.md) · [`past-is-kind…lightlike-consensus-is-gravity`](../../.claude/rules/past-is-kind-when-lightlike-consensus-is-gravity-lightlike-vs-dark-architecture-design-rule-amara-aaron-2026-05-28.md)
