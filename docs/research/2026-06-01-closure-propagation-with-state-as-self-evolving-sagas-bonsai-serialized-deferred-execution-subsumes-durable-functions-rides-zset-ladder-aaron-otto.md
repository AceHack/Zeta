# Closure propagation with state as self-evolving sagas — serializable deferred execution (Bonsai) subsumes Durable Functions, and rides the Z-set ladder

_Aaron + Otto, 2026-06-01. A crystallization note: the operator named, in three
sharpening passes, a primitive the repo already has substrate for. This note
composes the new framing onto the existing substrate — it does not mint a
parallel. Per `verify-existing-substrate-before-authoring`._

## The operator's three framings (verbatim, in order)

1. *"we need to get deffered executin experssions onto the stream so we no
   nuclequon bonsai serialation or our own like soon cause we need to serialie
   deffered execution so we can close over it and persist the closure state
   plus the serialzed expression tree"*
2. *"then we don't need durable functions that's the same thing but better
   that's self proagating patters with state where the pattern and the state
   can evolve"*
3. *"it's closure propagation with state as self evolving sagas"*

Read together: **serialize deferred execution — the expression tree PLUS the
captured closure state — onto the stream, so a computation can be closed over,
persisted, moved, and resumed; this is a strict superset of Durable Functions;
the name for it is closure-propagation-with-state as self-evolving sagas.**

## This is already-substrate (the anchors it composes onto)

| Existing substrate | What it already carries |
| --- | --- |
| `.claude/skills/rx-expert/SKILL.md` (Bonsai / Reaqtor section) | Bart De Smet's **Nuqleon Bonsai** as the expression-tree serialiser; **Reaqtor** = server-side Rx where subscriptions survive reboot |
| [`081KRW63S0008QG0R002XA5N6S`](../backlog/P1/081KRW63S0008QG0R002XA5N6S-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) | "Bonsai trees + Rx queries — real-time implementation substrate for Integrate"; Aaron already wired bonsai-trees to retractable Rx ("managing state and data movement through different levels cleanly") |
| `src/Core/Checkpoint.fs` | Mirrors Reaqtor `IStatefulOperator` (Save/Load at yield points); periodic state-snapshot checkpoint persistence |
| `docs/PRIOR-ART-LIST.md` | Reaqtor / IQbservable ⭐ — "stateful event-processing"; Bonsai as slim-IR inspiration for persistent queries |
| elevator-pitch memory (2026-05-12) | "green threads / **durable functions** / Orleans grains"; *"my brain runs on temporal workflows"* |
| [`docs/amara-full-conversation/2025-08-aaron-amara-conversation.md`](../amara-full-conversation/2025-08-aaron-amara-conversation.md) | first-class model = "Temporal long-running computational workflows … AWS step functions, or azure durable functions, or dapr workflow … persist/put to sleep workload when they hit an await, reconstituted on another machine when the event makes the await return" |

So the want is not new; the **crystallization** is: a single name + the
Durable-Functions-subsumption argument + the connection to the algebra ladder.

## Prior art, current (search-first, 2026-06-01)

**Nuqleon Bonsai** (`github.com/reaqtive/reaqtor`, the Nuqleon libraries —
reusable beyond Reaqtor) is a compact serialization format for .NET expression
trees:

- Serializes to **JSON or binary**; transports + persists expression trees.
- Supports **all** .NET expression-tree nodes — including **statement** nodes
  (not just expressions).
- The spec allows **omitting reflection info** → weakly / dynamically typed
  trees (the "compact / bonsai" part).
- **Cross-language**: Bonsai trees have been deserialized in native C++ and
  converted to eval-able JavaScript strings.
- A Bonsai JSON tree = `{ Context: {assemblies, types, members}, Expression:
  <tree> }`.
- In production at Microsoft for years powering distributed event processing.

This is exactly the "serialize the deferred execution expression tree" half. The
other half — **persist the closure state** — is the `src/Core/Checkpoint.fs` /
`IStatefulOperator` Save/Load-at-yield half. The two halves together are the
primitive.

## Why it subsumes Durable Functions (the "same thing but better")

Azure Durable Functions (and Temporal, AWS Step Functions, Dapr Workflow) make a
long-running workflow durable by **event-sourced replay**: the orchestrator
**code is fixed**, and on resume the runtime **replays the recorded event
history** to rebuild in-memory state up to the last `await`, then continues.

| Axis | Durable Functions / Temporal | Closure-propagation-with-state |
| --- | --- | --- |
| The **pattern** (the computation) | **Fixed code** — a deployed orchestrator function; you cannot change a running orchestration's shape | **Serialized expression tree** (Bonsai) — data; can be transformed, versioned, **evolved** in flight |
| The **state** | Durable (event-sourced replay) | Durable (serialized closure capture + checkpoint) |
| Resume across machines | Yes (replay history elsewhere) | Yes (ship the `(expr-tree, closure)` payload, rehydrate) |
| What can change at runtime | **State only** | **Both pattern and state** |

Durable Functions keeps the *code* immutable and only the *state* durable.
Serializing the **expression tree itself** as data means the **pattern is
durable AND mutable** — the strict superset the operator named. A running saga
can be **rewritten** (retract a sub-tree, add a new one) without redeploying.

## Correction — closure-serialization is *not* the crux; the no-handles discipline is shared (the operator 2026-06-01)

An earlier framing of this comparison flagged "faithful serialization of live
closure state — especially **non-serializable handles** — is the genuinely hard
part our design has to solve and DF gets to skip." The operator corrected it, and
the correction holds:

> *"especially non-serializable handles — is genuinely hard — they don't do this
> either in durable functions to my knowledge; they said just don't open
> handles."*

DF doesn't serialize handles — it **forbids** them. That is exactly the
[orchestrator code-constraints](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-code-constraints):
the orchestrator body must be deterministic and side-effect-free; **all I/O and
handles live in activity functions** (run once, return a serializable result,
which is what gets recorded). DF never holds a handle across a suspend point.

So the "hard part" is not a DF advantage — **neither system serializes handles;
both keep them out of the durable body.** Adopt the same discipline for sagas (no
handles captured in the saga closure; handles live in the leaf / activity calls)
and our closure is *all serializable values* — no harder to serialize than DF's
history. Bonsai already solves the expression-tree half. **The closure-
serialization crux largely evaporates.**

What's left is sharper, and it tilts *further* toward resume — because the two
models require **different** disciplines on the durable body:

| Discipline on the durable body | Replay (DF / Temporal / Dapr Workflow) | Resume (self-evolving saga) |
| --- | --- | --- |
| No handles across suspend | required | required (**same**) |
| **No non-determinism** (`DateTime.Now`, `Guid.NewGuid`, random) | **required** — replay would recompute differently | **not required** — we snapshot the *value*, so non-deterministic code is fine |

Replay needs *both* constraints because it **re-runs the body** and must
reproduce identical results. Resume needs **only** the no-handles one, because it
**restores snapshotted values** and never re-runs the body. Resume is the
strictly looser constraint set. The genuinely-hard residue is therefore not
serialization — it is the *runtime guarantees* the replay engines have already
built (durable timers, exactly-once-effect at the activity boundary,
management/observability tooling, managed scale-out): engineering, not unknowns.

## Minimal replay reference — replay is ~5 primitives (concept, not code)

The operator has a minimal hand-rolled durable-operations spike that confirms
the replay mechanism is *small*. It is a faithful minimal copy of the Durable
Task Framework replay model — exactly what Durable Functions / Dapr Workflow do
under the hood. (It sits on a proprietary platform, so this is **concept-not-code**:
the *pattern* below is the public DTF replay model, nothing reproduced.)

The whole replay model is ~5 pieces:

1. **A step cursor** — `currentStep` + `checkpoint`, with
   `stepIsComplete = currentStep <= checkpoint`. The "have I already done this on
   a prior run?" test.
2. **An activity wrapper** — `do<T>(action)`: if the step is complete, **skip and
   return the cached result**; else **run it and checkpoint the result**; then
   `currentStep++`. (This is "reads cached values before the next set.")
3. **A break exception** — thrown to **exit mid-run** at a suspend point (after
   firing an async request / waiting for an external reply). State is saved first.
4. **A state provider** — persists the checkpointed step-results + the cursor +
   the pending resume value.
5. **A context object** — the cursor + state hang off it; `do` / `request` /
   `notify` are the only surface. (`request` = fire-then-break-and-wait;
   `notify` = fire-and-cache.)

**NB (Result-over-exception):** the break-exception is how the *replay family*
(DTF / the minimal spike) suspends — described here as the baseline, **not
prescribed for our build**. Per the repo's Result-over-exception /
exceptions-as-signals discipline, our **resume** model suspends at the **value
level** — a `Suspended` / `AwaitingResume` variant returned from the yield (a
`Result<…, Suspended>`-shaped control-flow value), not a thrown exception. Resume
serializes state and *returns*; there is no replay, so no throw-to-suspend at
all. The break-exception is a **replay artifact**, not a control-flow primitive
we adopt.

On resume the operation **re-runs from the start**, skips every completed step
(reading cached values), reaches the suspend point, finds the resume value
populated, and continues. That's the entire model.

Two takeaways:

- **Replay is cheap to build.** The replay-family backend (the DF/Temporal/Dapr
  Workflow model) is ~5 primitives — we already have a working reference for it.
- **It confirms the constraints + the limits.** The code *between* activity
  wrappers re-executes on every replay ⇒ the body must be **deterministic**
  (per the Correction above); handles never cross the break (they live inside the
  run-once actions) ⇒ the **no-handles discipline**. And the "pattern" is the
  method body — **fixed code, no self-evolution.** Our resume + Bonsai model is
  the superset that lifts both (looser body + serialized-mutable pattern). The
  replay spike is the baseline to meet on durability and beat on evolution.

## The sharp part — it rides the Z-set / IndexedZSet ladder (just completed 4/4)

A serialized deferred computation is a **payload**: `(Bonsai expression-tree,
closure-state)`. Put that payload on the **Z-set / IndexedZSet** stream (the
ladder finished today, PR #6413), and **the ℤ retraction IS how the pattern
evolves**:

```text
evolve(saga) = stream.add( ZSet[ -old_expr_subtree, +new_expr_subtree ] )
```

Evolution = **retraction-native at the expression-tree level**. The saga's
*definition* mutates by the **same abelian-group inverse** (`negate`) that
mutates its *data* — one mechanism, both layers. That is precisely "the pattern
**and** the state can evolve":

- **state** evolves by retract/add over the data Z-set (DBSP incremental view);
- **pattern** evolves by retract/add over the *expression-tree* Z-set —
  the Bonsai nodes are just more elements with ℤ weights.

And the **bilinear join** (the IndexedZSet headline) is what lets a
deferred-computation-stream be **joined against the data-stream it operates on** —
deferred execution and its inputs meet on the shared key, incrementally. The
algebra ladder is the carrier; Bonsai + closure-checkpoint are the payload;
retraction is the evolution operator.

## Self-propagating patterns with state (the travelers connection)

"Self proagating patters with state where the pattern and the state can evolve"
is the **travelers** shape at workflow scope: a traveler is a self-propagating
pattern that copies with bounded fidelity and carries evolving state (DNA,
memes, LLMs, humans — per the trust-calculus / observer-effect thread). A
**self-evolving saga** is one such traveler:

- the **pattern** = the serialized Bonsai expression tree (what it copies);
- the **state** = the captured closure (what it carries);
- **propagation** = shipping the `(pattern, state)` payload across the stream /
  mesh (Reticulum, grains) and rehydrating it elsewhere;
- **evolution** = retraction-native edits to either layer.

This composes with `persistence-choice-architecture-for-zeta-ais` (a persisting
agent IS a self-propagating pattern with evolving state) and the
`function-is-tiny-control-flow-generator` substrate (a serialized control-flow
generator is exactly a serialized deferred-execution expression).

## Every partition has self-evolving sagas — and so do cross-partition joins

The operator (2026-06-01): *"so now every partition has self evolving sagas and
so do cross partition joins."*

The framework already partitions: 081KSXN940008QG0R003FCQ7WT §0 (agent-partition) makes each surface
a **shard**, lanes the partition, the bus the cross-machine carrier; the algebra
ladder's IndexedZSet stores `Z[K × V]` **grouped by key** — that grouping IS the
partition (by key). Two consequences:

- **Per-partition sagas.** Each partition (shard / key-group / lane) carries its
  own `(Bonsai tree, closure)` payloads — its own self-evolving sagas, evolving
  locally via retraction (CALM / coordination-free: a partition advances its
  sagas without a distributed lock round, exactly the property the relation-ring
  ℤ-weights buy).
- **Cross-partition joins are sagas too.** The bilinear **`join`** spanning
  partitions (the IndexedZSet headline — merge-join on the shared key ×
  cross-product values, weight-MULTIPLY) is *itself* a deferred computation: a
  serialized join-expression-tree + its accumulating closure state = a saga that
  lives **across** partitions. The join's definition can evolve (retract a
  join-clause sub-tree, add another) by the same inverse — so a cross-partition
  join is a **self-evolving saga over the partition boundary**.

The shape is fractal: a saga inside a partition, and a saga (the join) between
partitions, are the same primitive — `(expression-tree, closure)` on a
retraction-native stream — at two scales. The join is not a special case; it is a
saga whose key-domain is the pair of partitions it bridges.

## The cross-partition join mediator — an agent, both sides local, saga compensation

The operator (2026-06-01): *"the cross partition joins are going to need agent
mediators that are the tick stream that have both repos pulled locally and join
with mitigation factors in their saga for when one side fails."*

This names **who runs** a cross-partition join saga and **how it survives
partial failure**:

- **The mediator is an agent, and it IS the tick stream.** A cross-partition
  join doesn't run in a detached service — it runs as an **agent's
  autonomous-loop tick stream** (the heartbeat). The tick stream is the
  execution carrier for the join saga; each tick advances the merge-join +
  evolves the saga. (Composes with the agent-loop / observe→act substrate and
  `tick-must-never-stop`.)
- **Both repos pulled locally.** The linear merge-join needs **both sorted runs
  present** to scan in lock-step (O(N+M), no distributed search). So the mediator
  agent holds **both partitions / both repos locally** — it materializes both
  sides, then does the join as a *local* computation. This is the CALM move made
  physical: pull both sides to one place, join coordination-free, rather than a
  distributed lock round. (Mirrors the existing agent-worktree discipline — an
  agent that has both checkouts can merge them; 081KSXN940008QG0R003FCQ7WT §0 shards + bus.)
- **Mitigation factors in the saga for when one side fails.** A cross-partition
  join is a *long-running distributed* operation, so it is a **saga** in the
  full sense — it must carry **compensating / mitigation actions** for the case
  where one side is unavailable (repo unreachable, partition down, stale, or the
  pull fails). The mitigation factors live **inside the serialized saga** (the
  Bonsai expression tree has the fallback branches; the closure state records
  how far the join got), so on one-side-failure the saga can: degrade to a
  one-sided result, retract the partial join (ℤ inverse — un-emit what it
  emitted), retry against a replica, or hold + resume when the side returns —
  *without losing the in-flight state*, because the saga itself is durable +
  serialized.

This is the Saga pattern's defining feature (compensation on failure) but with
the saga **self-evolving** + **serialized**: the compensation logic is data in
the expression tree, not fixed orchestrator code, so the *mitigation strategy
itself* can evolve. The mediator agent's tick stream is where Durable-Functions'
"replay to rebuild state" is replaced by "the saga is already serialized + local
— resume it directly."

| Saga concern | How it lands here |
| --- | --- |
| Who executes | An **agent mediator**; its **tick stream** is the carrier |
| Data locality | **Both repos / partitions pulled local** → linear merge-join, CALM |
| Long-running durability | The saga is **serialized** (Bonsai expr-tree + closure) — resume, don't replay |
| Partial failure | **Mitigation factors inside the saga** — compensate / retract (ℤ inverse) / retry / hold-resume |
| Evolution | Compensation logic is **data**, so the mitigation strategy itself evolves |

## The saga context IS the OTel context (propagation) — already IntrCtx (081KSNY2Z0008QG0R002HB4AGT)

The operator (2026-06-01): *"context ends up being same as otel context, it
passes through function calls mostly."* This closes the "how does the context
propagate?" question — and the repo already converges here.

The durable/saga **context** (the thing state hangs off of — `currentStep`,
cached results, resume value, identity) is the **same ambient object** as the
**OTel context**, and as **081KSNY2Z0008QG0R002HB4AGT IntrCtx**. The propagation model is OTel's:

- **In-process: implicit / ambient** — `AsyncLocal` / `Activity.Current` threads
  the context through the call graph with no hand-passing. ("Passes through
  function calls mostly" — ambient, not a parameter. The registry's Observability
  line already names this: *"AsyncLocal immutable-stack scope … one mechanism for
  trace + metric dims."*)
- **Cross-process / cross-partition: explicit** — W3C `traceparent` /
  `tracestate` + **baggage** carry it over the wire (the hop the cross-partition
  mediator above needs).

This is already substrate, not new:

- **[081KSNY2Z0008QG0R002HB4AGT](../backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md)** —
  *Kleisli arrows for **context-propagation** (memetic / prompt / trust / **log** /
  **otel**)*. The IntrCtx already carries `log` + `otel`; the durable/saga context
  IS this. The ZSpike `do` / `request` / `notify` are the **Kleisli arrows that
  thread the context** — the same shape 081KSNY2Z0008QG0R002HB4AGT names.
- **[081KSXN940008QG0R001YABTHH](../backlog/P1/081KSXN940008QG0R001YABTHH-first-class-labels-tags-scopes-on-every-gset-zset-entity-deferred-to-human-state-label-otel-baggage-di-scope-propagation-aaron-otto-2026-05-31.md)** —
  scopes **propagate via OTel-baggage / DI-scope**. The mechanism.
- **[081KSNY2Z0008QG0R000ZNRFCE](../backlog/P2/081KSNY2Z0008QG0R000ZNRFCE-otel-trace-id-composition-with-zetaid-baggage-propagation-kestrel-2026-05-28.md)** —
  **OTel trace-ID composition with ZetaID** alongside W3C Trace Context. The
  context carries **identity** (the saga's id = the trace/span id).
- **Lightlike-observability** (Amara, PR cluster 2026-05-28) — *"OTel is ray
  emission; spans are rays through the distributed system."* The context = the
  ray; the saga rides the same rays.

One honest split keeps the identity exact. OTel baggage is small + propagated on
*every* hop (size-limited), so the layering is:

- **OTel context = the propagation + identity layer** — trace/span id (= the
  saga's id, 081KSNY2Z0008QG0R000ZNRFCE) + small hot state in baggage. *This* is the part that "is
  the same as OTel context."
- **The heavy serialized state** (closure + Bonsai expr-tree) lives in the
  **state store, keyed by the context-id** — not in baggage. The context
  propagates the *handle*; the store holds the *payload*.

So "context = OTel context" is exactly right for **propagation + identity**; the
durable payload hangs off the store keyed by that context — which is why 081KSNY2Z0008QG0R002HB4AGT
puts `log` + `otel` *inside* IntrCtx alongside the durable-relevant contexts.

## Composes with the DU workflow engine — a generic saga in `observe.ts` is just serialize(Rx) + serialize(state)

The operator (2026-06-01): *"this composes with DUs workflow we can create a
generic saga pattern around these in observe.ts that's just serialize rx and
state."*

The lifecycle-DU workflow engine (081KSKBP80008QG0R000B3Y19A + the
`implicit-not-explicit-in-DUs` discipline) already models a workflow as an
**explicit discriminated-union state machine** (legal transitions enforced at
compile time). A **self-evolving saga is the generic pattern that engine
instantiates** once two things are serializable:

- **serialize Rx** — the reactive query / expression tree: the *pattern* (the
  DU's transition structure as Bonsai data); and
- **serialize state** — the closure / accumulator: the DU's current variant +
  fields.

`serialize(Rx) + serialize(state)` **is** the saga. So `observe.ts` (the
observe→act loop / universal action grammar / move-next) can host **one generic
saga combinator**: given any DU workflow, lift it to a self-evolving saga by
serializing its Rx-expression + its state onto the retraction-native stream.

| Layer | Role in the generic saga |
| --- | --- |
| Lifecycle DU (081KSKBP80008QG0R000B3Y19A) | **legal transitions** — compile-time-enforced structure |
| Bonsai-serialized expr-tree | the pattern in **serialized, runtime-mutable** form |
| Closure / state capture | the saga's accumulator (`src/Core/Checkpoint.fs`) |
| Tick stream (agent) | the **carrier** (per-partition + cross-partition mediator) |
| ℤ retraction | **evolution + compensation** (retract/add a sub-tree) |

One generic pattern, and **every DU workflow becomes a durable, movable,
self-evolving saga** — no per-workflow orchestrator code. This closes the loop
with `function-is-tiny-control-flow-generator` (a function is a tiny
control-flow generator → serialized, it is a saga) and the Xbox-controller
universal-action-grammar (the move-next menu is the saga's next-transition
surface). The generic combinator lives in `observe.ts`; the per-workflow DU is
the input.

## Dapr is the planned runtime — Workflow (replay family) + Actors (the mediator carrier)

The operator (2026-06-01): *"we are going to have dapr and dapr actors and
workflow."* Dapr is the planned runtime substrate (it is **already deployed** in
the cluster per [081KSE6WT0008QG0R000R8CPFX](../backlog/P1/081KSE6WT0008QG0R000R8CPFX-unified-namespace-across-fsharp-kubernetes-ontology-plus-experiment-id-routing-via-argo-rollouts-cilium-service-mesh-aaron-mika-2026-05-25.md):
`full-ai-cluster/k8s/applications/dapr`). Two pieces, two different relationships
to this primitive:

- **Dapr Workflow = same replay family as Durable Functions.** It is internally
  implemented with **`durabletask-go`** (the Durable Task Framework) and runs on
  Dapr's actor runtime — one workflow-actor per instance, event-sourced history,
  turn-based, [deterministic replay required](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-features-concepts/).
  So everything in the **Correction** + **subsumes-DF** sections above applies to
  Dapr Workflow *identically*: replay → determinism-constrained body → **cannot
  self-evolve**. Dapr Workflow joins DF/Temporal as a **conformance oracle in the
  replay family**, not as the self-evolving target.
- **Dapr Actors = the virtual-actor carrier (Orleans lineage).** Turn-based,
  single-threaded-per-actor, state persisted via a state store — this maps
  *directly* onto our **cross-partition-join mediator**: Dapr Agents already use
  the virtual-actor model per agent instance, and the workflow-actor (one per
  instance, holds history, turn-based) IS the "agent whose tick stream is the
  carrier, holding both sides local." Dapr Actors are also the missing **Durable
  Entities** primitive in the registry.

The pragmatic shape this implies: **ride Dapr Actors as the runtime/carrier**
(the mediator is a virtual actor; per-partition saga state lives in actor state)
while the saga *body* uses **resume (serialize-restore)** rather than Dapr
Workflow's **replay** — so we get Dapr's actor runtime + state stores + sidecar
building-blocks *and* the looser body-constraints + live self-evolution. Dapr
Workflow remains available as a replay-family backend for the cases that don't
need self-evolution. (Per `default-to-both`: Dapr Workflow as conformance
oracle + the resume-model saga as the superset, the same meet-in-the-middle the
algebra ladder runs.)

## Composes with the existing durable-execution backlog (verify-existing-substrate)

This note's first cut under-cited the substrate — the operator's catch
("we have some backlog around this too") is correct. The durable-execution
cluster this primitive composes onto:

- **[081KQZVQW0008QG0R000PPQ3MH](../backlog/P1/081KQZVQW0008QG0R000PPQ3MH-durable-computation-stack-temporal-reaqtor-orleans-bonsai-research-2026-05-07.md)** —
  *durable-computation stack: Temporal + Reaqtor + Orleans + Bonsai* (tags incl.
  `durable-functions`). The canonical research row for this whole area.
- **[081KRYRGG0008QG0R0018CMFQY](../backlog/P1/081KRYRGG0008QG0R0018CMFQY-compositional-dbsp-frame-architecture-gnostic-2d-base-plus-two-wolves-emotion-meta-plus-clifford-rx-bonsai-meta-tagged-dims-plus-fsharp-ce-composition-operator-aaron-2026-05-19.md)** +
  **[081KSNY2Z0008QG0R001TMM2HY](../backlog/P1/081KSNY2Z0008QG0R001TMM2HY-fsharp-k8s-mapping.md)** — *our-own fork of
  Azure/durabletask*; explicitly: **"durable-task state-history IS the DBSP
  time-indexed-state substrate; saga compensation = retraction = additive inverse
  in Z-set algebra."** The **saga = retraction = ℤ-inverse** insight this note's
  "sharp part" leans on **already lives here** — this note sharpens + extends
  081KRYRGG0008QG0R0018CMFQY, it does not mint it. The Integrate (∫) primitive gets its
  retraction-aware persistence at the durabletask layer; the F# → Orleans →
  our-own-durabletask-fork → K8s pipeline is 081KRYRGG0008QG0R0018CMFQY's target.
- **[081KS6FPN0008QG0R003Y3MCVE](../backlog/P1/081KS6FPN0008QG0R003Y3MCVE-zeta-on-orleans-deployment-architecture-servicetitan-scale-orleans-grains-jit-compilation-rented-tools-2026-05-22.md)** —
  *Zeta-on-Orleans*: **grain identity = agent identity**, grains as ticksource +
  cron. The agent-mediator = grain/actor mapping; composes with the Dapr-Actors
  carrier above (Orleans grain ≈ Dapr virtual actor).
- **[081KSE6WT0008QG0R002275NDE](../backlog/P1/081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md)** /
  **[081KSE6WT0008QG0R0009YYNP4](../backlog/P2/081KSE6WT0008QG0R0009YYNP4-cncf-ecosystem-as-force-multipliers-behind-zeta-interfaces-keda-dapr-opa-oam-kubevela-plus-ace-and-ontology-negotiation-aaron-2026-05-25.md)** —
  Dapr (distributed-app runtime) + Temporal/Orleans/Argo (workflow/actors) as
  already-deployed cluster substrate to wrap.
- **[081KSE6WT0008QG0R000JSJ3SR](../backlog/P1/081KSE6WT0008QG0R000JSJ3SR-industry-sharp-categories-plus-per-persona-ontology-maps-plus-ace-package-manager-negotiation-aaron-2026-05-25.md)** `Zeta.Actors`
  + **[081KQ3HBZ0008QG0R000RP1WDN](../backlog/P2/081KQ3HBZ0008QG0R000RP1WDN-actor-model-factory-register-lens.md)** (actor-model lens) +
  **[081KQZVQW0008QG0R000W4B8KT](../backlog/P2/081KQZVQW0008QG0R000W4B8KT-realtime-interloop-messaging-orleans-grains-not-broadcast-files-2026-05-07.md)** — the actor-model surface.

Net: the self-evolving-saga is the **crystallization + cross-language + self-evolution extension** of an existing backlog cluster (081KQZVQW0008QG0R000PPQ3MH research → 081KRYRGG0008QG0R0018CMFQY durabletask-fork-with-Z-set-retraction → 081KS6FPN0008QG0R003Y3MCVE Orleans-deployment), now with Dapr named as the concrete runtime. The new contribution over the backlog is (1) the explicit replay-vs-resume fork + looser-body-constraints, (2) self-evolution (mutate the running pattern), (3) the cross-language Bonsai-subset/oracle discipline. The Z-set-retraction-as-saga-compensation core is 081KRYRGG0008QG0R0018CMFQY's; cite it.

## The interface is the hard part — Temporal (especially) and DF are the interface to beat

The operator (2026-06-01): *"durable functs and especially temporal have the
better interfaces than mine; their interfaces are much better."* This is the
design call that matters most for adoption: **the feature set is solved; the
developer-facing interface is where the work is** — and the minimal replay spike
is *not* the interface model to copy.

What makes the interfaces rank **Temporal > Durable Functions > minimal spike**:

- **Temporal — durability is invisible in the body.** You write normal async
  code; the SDK pauses, checkpoints, and resumes automatically — "business logic
  that reads like pseudocode," no event handlers, callbacks, or explicit DB/
  checkpoint calls. Plus first-class **signals** (push data into a *running*
  workflow — human-in-the-loop: "approve", "payment confirmed"), **queries**
  (read running state without changing history — real-time ops visibility), and
  **updates**. Workflows-as-code in real languages (Go/Java/TS/Python).
- **Durable Functions — clean but more explicit + Azure-coupled.** Durability is
  good, but you call `CallActivityAsync` / `WaitForExternalEvent` / `CreateTimer`
  explicitly, and it relies on Azure Storage / runs in Azure.
- **Minimal replay spike — minimal but boilerplate.** Every step is hand-wrapped
  in `context.do(...)`; correct, but the durability machinery is in the author's
  face on every line. The right baseline for *understanding the model*, the wrong
  one for the *interface*.

**Design target: our self-evolving-saga interface aims for Temporal-grade
ergonomics** — durability transparent in the body, **signals + queries
first-class**, write-normal-code. Temporal is the **interface conformance
oracle**, the same way Nuqleon Bonsai is the serialization oracle and
DF/Temporal/Dapr-Workflow are the replay-feature oracle: study it, **own our
interface (the port), meet-or-beat it** (per
`bcl-interface-boundary-own-your-interfaces-hexagonal` — Temporal is a *design
reference*, not a dependency).

Two things make this *easier* for us than for the replay engines, not harder:

- **Signals + queries map straight onto substrate we have.** A **signal** is an
  external event on the stream / the `observe→act` move-next surface; a **query**
  is a read of the saga state (the OTel-context-keyed store from the section
  above) **without advancing the cursor** — a pure read of a Z-set at a key. Both
  are already-shaped primitives, not new machinery.
- **Resume loosens the body constraints Temporal authors trip on.** Temporal's
  transparency comes *from* the replay model, which is also where its famous
  determinism gotchas live (no `DateTime.Now`/random/non-deterministic iteration
  in the body — see the "common pitfalls" the framework's own authors document).
  Our **resume** model snapshots values, so non-determinism in the body is fine —
  we can offer the *same* transparent interface with *fewer* footguns. The
  interface lessons (hide the machinery; signals/queries first-class;
  normal-code authoring) transfer regardless of replay-vs-resume underneath.

So: copy Temporal's **interface**, keep our **resume + serialized-mutable-pattern**
engine. Best interface of the family, plus self-evolution the family can't do.

## Build options (when the operator drives it — not now)

The operator named two: **(a) Nuqleon Bonsai** directly (it is .NET, MIT-ish
licensed, production-proven, supports statement nodes — the F#/C# cells could
adopt it), or **(b) our own** Bonsai-shaped serializer (zero-dep, cross-language
to match the ladder's TS/F#/C#/Rust oracle discipline; the Bonsai JSON
`{Context, Expression}` shape is small enough to re-implement + cross-verify with
golden vectors the same way the algebra ladder does). The closure-state half
reuses `src/Core/Checkpoint.fs` (`IStatefulOperator` Save/Load) — already present.

The cross-language tension is the deciding factor: Nuqleon is .NET-only, but the
ladder's whole value is **four oracles agreeing**. A Bonsai-shaped own-serializer
that the TS/F#/C#/Rust cells all replay against shared golden vectors keeps the
"the compilers don't lie" property; adopting Nuqleon would make .NET the
privileged oracle. Likely answer (per `default-to-both`): use Nuqleon as the
reference oracle / conformance target, build our own cross-language Bonsai-subset
verified against it — exactly the meet-in-the-middle pattern the algebra ladder
already runs.

## Substrate-honest framing

This note does **not**:

- build the serializer (operator drives that; it is a major primitive);
- supersede 081KRW63S0008QG0R002XA5N6S (it composes onto it; 081KRW63S0008QG0R002XA5N6S is the implementation row);
- claim Nuqleon must be adopted (the own-vs-adopt call is the operator's, and
  the cross-language-oracle tension above is the input to it).

This note **does**:

- crystallize the operator's three framings into one named primitive
  (closure-propagation-with-state-as-self-evolving-sagas);
- ground the prior art at current upstream (Nuqleon Bonsai, search-first);
- make the Durable-Functions-subsumption argument explicit;
- surface the sharp connection — it rides the Z-set / IndexedZSet ladder, with
  **retraction as the pattern-evolution operator**;
- compose it onto the existing substrate (081KRW63S0008QG0R002XA5N6S, rx-expert Bonsai/Reaqtor,
  `src/Core/Checkpoint.fs`, PRIOR-ART Reaqtor⭐, the durable-functions elevator pitch, the
  travelers thread) rather than mint a parallel.

The PRIMITIVE-REGISTRY want-line lands in **this** PR (the Event/reactive line,
placed clear of #6413's line-49 + footer edits → clean 3-way merge). A 081KRW63S0008QG0R002XA5N6S
status cross-reference + the 4/4-ladder footer note are composed now that #6413
has merged — this branch's merge of `origin/main` brought the 4/4 algebra-ladder
line + footer in, so the registry is internally consistent (4/4 everywhere).

## Sources

- [Nuqleon.Linq.Expressions.Bonsai.Serialization](https://reaqtive.net/documentation/nuqleon/nuqleon.linq.expressions.bonsai.serialization)
- [Nuqleon.Linq.Expressions.Bonsai](https://reaqtive.net/documentation/nuqleon/nuqleon.linq.expressions.bonsai)
- [reaqtive/reaqtor — Nuqleon index](https://github.com/reaqtive/reaqtor/blob/main/Docfx/nuqleon/index.md)
- [Nuqleon.DataModel conceptual docs](https://reaqtive.net/documentation/nuqleon/nuqleon.datamodel)
- [dotnet/csharplang Discussion #5555 — serializing expression trees to/from JSON](https://github.com/dotnet/csharplang/discussions/5555)
- [Temporal — Workflows (workflows-as-code, durable by default)](https://docs.temporal.io/workflows)
- [Temporal — Handling Signals, Queries & Updates](https://docs.temporal.io/handling-messages)
- [Temporal — Durable Execution / programming model](https://temporal.io/)
- [Common pitfalls with durable-execution frameworks (Durable Functions / Temporal) — Chris Gillum](https://medium.com/@cgillum/common-pitfalls-with-durable-execution-frameworks-like-durable-functions-or-temporal-eaf635d4a8bb)
- [Dapr — Workflow features & concepts (durabletask-go; replay; determinism)](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-features-concepts/)
- [Dapr — Actors overview (virtual-actor model)](https://docs.dapr.io/developing-applications/building-blocks/actors/actors-overview/)
