# The agent-bus and Ace are the same substrate — one git-native ZetaId-keyed Z-set store; bus = grow-only G-Set comms, Ace = retraction-native dependency Z-set (synthesis, 2026-05-31)

**Date:** 2026-05-31
**Author:** Otto-CLI synthesis (answering an operator question; Aaron 2026-05-31)

<!-- GOVERNANCE.md §33 boundary headers (this file imports a verbatim operator question) — literal labels, value-clean Operational status (passes the enum-strict check). -->
Scope: research / synthesis — recognizing a shared canonical substrate under two backlog umbrellas (the agent-bus 081KSXN940008QG0R00171YAZW and the Ace package-manager 081KSGS9H0008QG0R0031PBNGA) in answer to an operator question.
Attribution: the operator's question is quoted verbatim below; the recognition + tables are Otto-CLI synthesis, labeled as such. Speaker labels preserved.
Operational status: research-grade
(research-grade = NOT operational policy; a shared-substrate refactor lands in either impl only via the §26 / product-team agreement, never inline here.)
Non-fusion disclaimer: quoting + building on the operator's question does not imply shared identity, merged agency, consciousness, or personhood between operator and agent; the boundary is explicit (operator asks; the agent synthesizes).

**Status:** synthesis / **recognition** — informs both
[`081KSXN940008QG0R00171YAZW`](../backlog/P2/081KSXN940008QG0R00171YAZW-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md)
(agent-bus) and
[`081KSGS9H0008QG0R0031PBNGA`](../backlog/P1/081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md)
(Ace). The shared-substrate layer is a **candidate**, routed through the
product-team agreement before either impl commits to it. NOT unilaterally landed.

## The operator's question (verbatim, 2026-05-31)

> *"does the bus and ace package manger have anyting in common?"*

## The short answer

**Yes — they are the same substrate viewed two ways.** Both are a
**git-native, ZetaId-keyed, declarative-entry store** whose current state is a
**DBSP / Z-set view** folded over the entry stream. They differ in the *algebra*
of their entries, not the substrate:

- **agent-bus** = a **grow-only set (G-Set CRDT)** of *messages* — append-only,
  per-topic TTL, never retracted; the view is "what's been said."
- **Ace** = a **retraction-native Z-set** of *dependency facts* — add/remove a
  dep nets to a resolved view; the view is "the n-dimensional dependency state +
  its holographic projection" (081KSGS9H0008QG0R0031PBNGA).

Same store; one is a comms G-Set, the other a dependency Z-set. **The Z-set is
the general case; the G-Set is the Z-set restricted to non-negative multiplicity
(no retractions).**

## The five things they share (the substrate)

| # | Shared property | agent-bus (081KSXN940008QG0R00171YAZW) | Ace (081KSGS9H0008QG0R0031PBNGA) |
|---|---|---|---|
| 1 | **git-native declarative-entry store, no PR** | envelopes are files on `main` (081KSKBP80008QG0R001KK9WV6 heartbeat-folder / 081KSNY2Z0008QG0R000E5KTPX folders-on-main) | dependency entries are files on `main`, same no-PR transport |
| 2 | **ZetaId-keyed, disjoint-id = conflict-free** | `Category.Bus` ZetaId = filename + dedup key; disjoint files never collide → cross-machine / **Windows-safe** via git | each dependency/package fact is a ZetaId-keyed entry; same disjoint-key conflict-freedom |
| 3 | **DBSP / Z-set view over the entry stream** | fold the envelopes → "current inbox / topic state" (incremental, retraction-only-via-TTL-expiry) | fold the dep facts → "resolved dependency view" (incremental, retraction-native: add/remove nets) |
| 4 | **git as the cross-machine transport (CRDT merge)** | concurrent agents on different machines write disjoint envelope files → merge clean (G-Set) | concurrent dep edits on different machines write disjoint fact files → merge, then the Z-set fold resolves |
| 5 | **declarative entries, not imperative commands** | an envelope is *data* (`--no-verify`; "topic + payload"), observed + folded — never executed | a dep fact is *data* (a claim about what depends on what), observed + folded into resolution |

Item 2 is the load-bearing one for the operator's current Windows pain: **the
same disjoint-ZetaId-files-merge-clean property is why both are cross-OS-safe over
git** — no shared mutable file, no lock, no PR coordination. (It is orthogonal to
the long-*filename* limit, which is a Windows path-length issue, not a merge
issue.)

## Where they diverge (the algebra, not the substrate)

| | agent-bus | Ace |
|---|---|---|
| Entry algebra | **G-Set** (grow-only; multiplicity ∈ {0,1}) | **Z-set** (multiplicity ∈ ℤ; +1 add / −1 retract) |
| Lifetime | ephemeral (per-topic `TTL_MS`) | durable (deps persist until retracted) |
| Retraction | only via TTL expiry (time, not algebra) | first-class (the Hopf-antipode / retraction-native edit) |
| The view | "messages in flight" (comms) | "resolved n-dim dependency space + holographic projection" (081KSGS9H0008QG0R0031PBNGA) |
| Read shape | newest-since-cursor (a feed) | a *resolution* (solve the constraint Z-set) |
| Failure if wrong | a missed message | a wrong dependency graph (much higher stakes → Ace adds verification / upstream negotiation) |

So Ace is the *richer* instance: it needs retraction + resolution; the bus only
needs append + read. Building the bus first (081KSXN940008QG0R00171YAZW) is building the **G-Set floor
of the same substrate** Ace later extends to a Z-set.

## The algebraic ladder — G-Set, Bag, Z-set (why these are *the* canonical containers)

Both names are real, standard terms from two different fields, and they sit on one
algebraic ladder indexed by **what an element's count can be** and **how you merge**:

| | element count | merge op | structure | retraction? | field of origin |
|---|---|---|---|---|---|
| **Set / G-Set** | {0, 1} (presence) | union / max | join-semilattice (idempotent) | no | CRDT (distributed systems) |
| **Multiset / Bag** | ℕ (0, 1, 2, …) | sum | commutative monoid | no | combinatorics / counting |
| **Z-set** | ℤ (… −1, 0, 1 …) | sum | abelian group | **yes** (negative count = retract) | DBSP / differential dataflow (databases) |

- **G-Set = Grow-only Set** — the canonical first CRDT (Shapiro, Preguiça, Baquero &
  Zawirski, *Conflict-free Replicated Data Types*, 2011, alongside G-Counter). `add`
  only; merge = **set union**, which is associative + commutative + **idempotent** →
  a join-semilattice → replicas always converge regardless of order or duplication.
  That idempotent-union convergence is exactly why the git-native bus is
  conflict-free: disjoint ZetaId-named files, union-merge, no coordination.
- **Z-set** — from incremental view maintenance (DBSP / differential dataflow): each
  element carries an integer multiplicity in ℤ, so a `−1` retracts. That makes it the
  **free abelian group** over the key set; add + retract net to a resolved view. This
  is Ace's dependency state (add/remove deps → resolution).

**The honest relationship.** The intuition "G-Set = Z-set restricted to non-negative
multiplicity" points the right way (drop retraction → lose the negatives), but the
*precise* statement is that they merge with **different algebras**: G-Set merges with
idempotent union (add-twice = add-once); Z-set merges with group addition (add-twice =
count 2, and you can subtract). The **Bag** sits exactly between — ℕ multiplicity,
additive, but no negatives, so no retraction.

**The through-line: each rung is the *free* structure of its kind over the key set** —
G-Set is the free join-semilattice, Bag the free commutative monoid, Z-set the free
abelian group. "Free" = the most general object with that algebra and nothing extra,
which is precisely why each is the *canonical* conflict-mergeable container at its
level. (This free-object ladder **rhymes with** the Cayley-Dickson ladder — both are
"add structure, change a property" ladders — but it is a *rhyme, not an identity*: the
free constructions here are universal-free-object claims over a key set, whereas
Cayley-Dickson is a dimension-doubling algebraic extension. Per the framework's
Cayley-Dickson-as-RHYMES discipline, that link stays a rhyme, not a theorem.)

**So the bus↔Ace split is just two rungs of one ladder:** the **bus is the G-Set
rung** (append-only comms, no retraction needed); **Ace is the Z-set rung** (deps add
*and* retract, netting to a resolved view). Build the bus first = build the bottom
rung — and the Bag rung is there if a future ZetaId category ever needs
counted-but-not-retractable entries.

## They compose — one substrate layer, many ZetaId categories

Both are **categories of the same ZetaId** over the same observe/fold/simulate
event algebra (`081KSXN940008QG0R0033T2BQT`): `Bus`, `Heartbeat`, `Workflow`, `Batch`, … and an
Ace/dependency category are all entries in one git-native store with one fold
engine. The practical payoff:

- **Build the publish/subscribe/fold primitives once.** The bus's
  `writeEnvelope` (atomic, idempotent, G-Set) + `readEnvelopesFromGitRef`
  (`origin/main` fold) are the same shapes Ace's dep-fact-write +
  dep-view-fold need; Ace adds the Z-set retraction + resolver on top.
- **The same DBSP machinery serves both.** The rewind/fast-forward/branch over
  retraction-native Z-sets in the omniscience analysis
  ([`formal-analysis-computational-omniscience…`](2026-05-31-formal-analysis-computational-omniscience-over-simulation-state-space-under-deterministic-simulator.md):
  IScheduler + generator-time + DBSP + Infer.NET-over-Z-sets) is exactly what
  Ace's "explore branching dependency resolutions efficiently" wants; the bus
  rides the same engine in its degenerate (no-retraction) form.
- **One transport story.** The no-PR / no-branch-protection direction
  (081KSNY2Z0008QG0R000E5KTPX folders-on-main; 081KSXN940008QG0R001KZ235R Git-V2 handshake) is the transport for
  *both*; the bus's legacy-bus bridge and Ace's continuous-upstream-negotiation
  are both transport swaps over it, not reshapes.

## What this implies (substrate-honest)

This is a **recognition**, not a build directive. It says: when 081KSXN940008QG0R00171YAZW (bus) and
081KSGS9H0008QG0R0031PBNGA (Ace) are implemented, they should **share the git-native ZetaId-keyed
entry store + fold engine** rather than grow two parallel implementations — the
bus is the G-Set floor; Ace is the Z-set extension. A reviewer should check
whether a single `tools/<shared>/` entry-store layer (publish = atomic ZetaId
file write; subscribe = `origin/main` fold; with a G-Set vs Z-set fold strategy)
is the right factoring **before** either impl hard-codes its own — and route that
factoring through the product-team agreement, since it's a cross-cutting
architectural call, not a one-PR change.

## Composes with

- [`081KSXN940008QG0R00171YAZW`](../backlog/P2/081KSXN940008QG0R00171YAZW-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md)
  (agent-bus — the G-Set floor; Phase 1 in `tools/agent-bus/`)
- [`081KSGS9H0008QG0R0031PBNGA`](../backlog/P1/081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md)
  + [`docs/agendas/ace-package-manager/AGENDA.md`](../agendas/ace-package-manager/AGENDA.md)
  (Ace — the Z-set extension: n-dim dependency space + holographic projection)
- [`081KSXN940008QG0R0033T2BQT`](../backlog/P2/081KSXN940008QG0R0033T2BQT-observe-simulate-fold-algebra-multi-language-build-ts-fsharp-csharp-rust-cross-language-compiler-parity-bft-aaron-2026-05-31.md)
  (observe / fold / simulate event algebra — the shared fold engine)
- [`formal-analysis-computational-omniscience…`](2026-05-31-formal-analysis-computational-omniscience-over-simulation-state-space-under-deterministic-simulator.md)
  (DBSP rewind/ff/branch + Infer.NET-over-Z-sets — the machinery both share)
- [`2026-05-31-git-backed-cross-machine-otto-bus-zetaid-spec.md`](2026-05-31-git-backed-cross-machine-otto-bus-zetaid-spec.md)
  (the #6219 bus spec — ZetaId-Bus G-Set CRDT)
- 081KSNY2Z0008QG0R000E5KTPX (folders-on-main) + 081KSXN940008QG0R001KZ235R (Git-V2 handshake) + 081KSKBP80008QG0R001KK9WV6 (heartbeat
  folder, no-PR) — the shared transport
- DBSP / Z-set retraction-native algebra (the `algebra-owner` substrate) — the
  G-Set-is-Z-set-without-retraction recognition
