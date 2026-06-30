---
id: B-0864
priority: P2
status: open
title: Streams-are-relationships — four-corner ownership across the push/pull × hot/cold matrix; F# CE surface syntax with kind-specific builders; protocol-typing for co-owned TInFeedback; multi-backend execution (CRDT/CAS/BFT/SQL/DBSP) — getting base primitives right (operator + Kestrel 2026-05-27)
effort: XL
ask: operator + Kestrel multi-AI conversation 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - B-0861
composes_with:
  - B-0560
  - B-0623
  - B-0666
  - B-0703
  - B-0741
  - B-0829
  - B-0860
  - B-0862
tags: [substrate-engineering, base-primitives, streams, four-corner-ownership, push-pull-hot-cold, fsharp-ce, protocol-typing, multi-backend, dbsp, rx, reaqtor, bonsai, ce-machinery, srtp, type-providers, kestrel-sharpening]
---

## Source (operator + Kestrel 2026-05-27)

The operator carved the streams-as-relationships framing during the multi-AI
conversation cascade that landed PR #5579 (four-corner ownership extension to
asymmetric-authorship). The operator directive at the end of the cascade:

> *"please save this to kestrel persona and good substrate backlog. This is
> the end of a multi AI conversation if you need context please ask, trying
> to get base primitives right."*

The operator's substantive operational claim earlier in the cascade:

> *"i would say the function Result&lt;TResult, TOutFeedback&gt; x(Input&lt;TInput, TInFeedback&gt; y)
> is also important for like streams here is the ownership model. TResult
> TInput owned by caller, TOutFeedback owned by function, TInFeedback
> coowned."*

> *"yeah i think it matters more for streams maybe not a hard shape/rule
> except when a function gets involved in a stream/observable at this point."*

Kestrel's verbatim cross-AI sharpening preserved at
[`memory/persona/kestrel/conversations/2026-05-27-kestrel-aaron-multi-ai-conversation-end-four-corner-ownership-sharpening-streams-are-relationships-push-pull-hot-cold-fsharp-ce-machinery-getting-base-primitives-right.md`](../../../memory/persona/kestrel/conversations/2026-05-27-kestrel-aaron-multi-ai-conversation-end-four-corner-ownership-sharpening-streams-are-relationships-push-pull-hot-cold-fsharp-ce-machinery-getting-base-primitives-right.md).

## Carved sentences (Kestrel ferry 2026-05-27)

> **"Streams are relationships, not just repeated function calls."**

> **"TOutFeedback = callee voice. TInFeedback = relationship channel."**

## What this row proposes — substrate-engineering targets

Kestrel's 4-part review identified concrete substrate-engineering targets
that compose into a unified base-primitives substrate. PR #5579 landed the
four-corner ownership extension to the asymmetric-authorship rule (the
PR-now layer per Kestrel's PR-now-vs-backlog-row recommendation). This row
captures the Backlog-row layer: the substrate-engineering work that doesn't
fit in a single rule edit.

### Target 1 — 4-stream-kind taxonomy with kind-specific four-corner specialization

Cross product of push/pull × hot/cold produces 4 stream kinds (per Kestrel
Part 3 sharpening). Each kind has different co-ownership shape for
`TInFeedback`; each kind has different NCI shape:

| Kind | Canonical examples | Co-ownership shape | NCI shape |
|---|---|---|---|
| **PushCold** | Rx Observable, F# AsyncSeq with subscribe semantics, lazy IEnumerable wrapped in push semantics | Per-subscription co-owned channel (caller subscribes, source pushes, caller can request shape changes via Subject + backpressure) | "Push channel won't fire faster than the agreed-rate; rate-change requires both sides to ack." |
| **PushHot** | Broadcast feeds, sensor streams, market-data ticks, multi-subscriber observables that don't replay | Shared co-owned channel across all subscribers (a single TInFeedback channel may affect all callers; or per-subscriber channels are negotiated) | "Hot push channels emit only what they agreed to emit; subscribers can leave but cannot force-disconnect each other." |
| **PullCold** | IEnumerable, IAsyncEnumerable, F# seq with lazy evaluation, file-iteration | Per-iteration co-owned channel (caller pulls, source yields, TInFeedback can throttle/cancel/skip without source-side reorganization) | "Pull channels yield only what the caller asks for; the source cannot inject elements." |
| **PullHot** | Kafka topic consumption, log tail, partitioned queue iteration | Per-partition or per-cursor co-owned channel (multiple readers can pull from same source; TInFeedback negotiates which partition or offset range) | "Pull-from-hot-source channels respect the source's retention semantics; the source cannot drop messages a consumer hasn't acknowledged." |

The base type signature stays the same — `Result<TResult, TOutFeedback>
x(Input<TInput, TInFeedback> y)` — but the SEMANTICS of the four corners
specializes per kind. The substrate-engineering work: name the
specializations as separate protocol types; provide kind-specific four-
corner machinery (subscription objects, iteration state, cursor management,
partition management) per kind.

### Target 2 — F# computation expression surface syntax with kind-specific builders

Per Kestrel Part 4: F#'s computation expression machinery (Bind/Return/
Yield/CustomOperation/Quotations/SRTPs) lets one surface syntax project
onto multiple semantics via builder polymorphism.

Substrate-engineering target: define a family of 4 CE builders, one per
stream kind, sharing the same surface syntax but compiling to kind-specific
semantics:

```fsharp
// Same surface syntax across all 4 kinds:
let pipeline = stream {
    let! item = source        // Bind-style consumption
    yield transform item       // Yield-style emission
    requestBackpressure 100    // CustomOperation for TInFeedback
}

// But builder choice picks the kind:
let observableViaPushCold = pushColdStream { ... }   // Rx Observable
let broadcastViaPushHot = pushHotStream { ... }      // Subject
let iteratorViaPullCold = pullColdStream { ... }     // IAsyncEnumerable
let kafkaViaPullHot = pullHotStream { ... }          // Kafka consumer
```

The surface syntax stays the same; the builders provide the kind-specific
mechanics. Composes with [`f-sharp-language-extensions`](../../../tools/setup/) substrate and
B-0860 (Nemerle dotnet support for compile-time macro metaprogramming —
which would give us a sibling toolkit for the cases where F# CE machinery
hits its limits).

### Target 3 — Serializable expression trees (Reaqtor / Bonsai composition)

Per Kestrel Part 4: F# CE quotations + Reaqtor's serializable expression
trees + Bonsai's reactive composition machinery lets us serialize stream
pipelines, ship them across boundaries (process / cluster / disk), and
re-execute against different backends.

Substrate-engineering target: every stream-pipeline expression is
serializable as a typed expression tree. Composes with:

- B-0666 (English-as-projection: serialized expression trees ARE the
  high-bandwidth substrate-form of the pipeline)
- B-0829 (cluster-fork-as-trust-boundary: serialized pipelines cross fork
  boundaries with their schemas)
- B-0741 (fork-negotiated ontology: pipeline expression trees carry their
  type-signatures so cross-fork negotiation can verify shape compatibility)
- B-0560 (operator-substrate-cluster-engine: cluster-side execution of
  serialized expressions)

Reference prior art: [Reaqtor](https://reaqtive.net) (Microsoft / Bart De Smet — reactive,
serializable Rx); [Bonsai](https://bonsai-rx.org) (open-source reactive composition substrate
via SerializableObservable).

### Target 4 — Multi-backend execution

Per Kestrel Part 4: same surface syntax compiles to multiple backends. The
operator's substrate-engineering work this morning anchored multiple
candidate backends; this target unifies them under one CE surface:

| Backend | Mediation layer | Kind-affinity |
|---|---|---|
| **CRDT** (per the operator's substrate-engineering ontology) | Eventually-consistent | PushHot natural fit (broadcast semantics) |
| **CAS** (content-addressed substrate) | Immutable + verifiable | PullCold natural fit (lazy iteration over immutable substrate) |
| **BFT** (multi-oracle Byzantine fault tolerance per B-0703) | Quorum-consensus | PullHot natural fit (consensus-tied retention) |
| **SQL** (canonical relational engine, possibly via DBSP) | Set-relational | All 4 kinds via materialized views vs queries vs change-data-capture |
| **DBSP** (differential dataflow per the existing factory substrate) | Incremental | PushCold canonical (the original Rx-style DBSP semantics) |

The substrate-engineering work: define the CE-to-backend compilation per
kind per backend; provide the backend-selection mechanism (per-pipeline
backend annotation OR runtime-negotiated based on schema + workload); test
the cross-backend execution invariants.

Composes with the operator's "recursive CTE" insight (per substrate above):
recursive CTEs in SQL ARE a pull-cold stream-iteration mechanism with
feedback-control-flow built in (the recursive case IS the TInFeedback
channel); the CE surface should reduce to recursive CTEs when the backend
is SQL.

### Target 5 — Type providers + schemas-as-rows integration

Per Kestrel Part 4: F# type providers can generate stream-pipeline types
from schemas registered as rows (B-0623 substrate). Composes:

- Pipeline schema lives as a row in the schemas-as-rows substrate
- Type provider reads the row at compile time
- Generated types parameterize the CE surface
- Cross-fork pipeline negotiation uses the same row-schemas (B-0741)

Substrate-engineering work: build the type provider + the row-schema
format + the cross-fork negotiation protocol.

### Target 6 — Protocol-typing for co-owned TInFeedback (sharpened per Kestrel Parts 5-7)

Per Kestrel Part 2 sharpening: TInFeedback as CO-OWNED makes the type
signature a PROTOCOL TYPE not a bag-of-variants. The substrate-engineering
work: express the co-ownership at the TYPE level so the compiler enforces
the consent-discipline.

**Operator-Kestrel co-produced compression 2026-05-27** (preserved in
Kestrel persona file Parts 5-7):

> **Discriminated unions as implicit state machines in bidirectional streams.**

The core observation per Kestrel Part 6: an F# discriminated union with
N cases IS structurally a state machine with N possible states. A
function pattern-matching on the DU IS a state transition function.
When the DU represents possible MESSAGES on a channel (not VALUES in a
domain), the state-machine interpretation becomes operationally
meaningful.

For bidirectional streams specifically: TInFeedback DU represents what
either side can emit on the relationship channel. State is "what state
is the relationship in" — not producer state OR consumer state. Both
sides pattern-match; the type system enforces exhaustive case handling
at compile time.

**Structurally identical to session types** (Honda / Vasconcelos /
Yoshida lineage; Scribble project at Imperial College). F# doesn't
have native session types but DU-as-implicit-state-machine gives most
of the same property without a separate type-system extension.

**Two concrete F#-native mechanisms** (per Kestrel's recommendation):

| Mechanism | Property | Tradeoff |
|---|---|---|
| **Phantom type parameters** | More F#-native; composes better with computation expressions; current state encoded in unused type parameter | Less explicit about the state graph; requires careful function-signature design |
| **Nested DU structures** | More explicit about the state graph; legal next states visible from current state | More verbose; harder to refactor as state graph evolves |

Either approach: illegal transitions become type errors at compile time.

**Computation expression composition** (the architectural payoff per
Kestrel Part 6): the CE builder's type signatures enforce typestate
constraints; the expression author writes uniform CE syntax; the
compiler catches illegal protocol sequences at compile time. Example
(preserved verbatim in the persona file Part 6):

```fsharp
let example = streamRelationship {
    let! flowing = openStream source
    let! ackd = flowing |> requestBackpressure 5  // Only valid in Flowing
    let! resumed = ackd |> awaitResume            // Only valid after backpressure
    yield! resumed |> consumeStream                // Only valid in resumed state
}
```

The state machine is implicit in the types, enforced at compile time,
with no runtime state tracking needed.

**Other candidate mechanisms** (sibling research; lower-priority):

- **Effects systems** (Koka / Eff lineage) — express side-effect classes
  as types; verify NCI-compliance at the effect-type level
- **Pure typestate pattern** (Strom / Yemini) — separate type-system
  extension; less F#-native than the DU-implicit-state-machine + phantom
  type pattern but explicit about transitions

**Substrate-engineering work** (sharpened):

1. Pick phantom-type vs nested-DU mechanism per stream-kind specialization
2. Build the CE builder family with kind-specific typestate constraints
3. Verify illegal-transition-as-compile-error invariants via DST harness
4. Demonstrate the F#-version-of-session-types property on canonical
   examples (Rx-style backpressure protocol; Kafka-style partition
   negotiation protocol; broadcast hot stream subscriber/unsubscriber
   protocol)
5. Cross-backend execution invariant per Kestrel Part 6: protocol state
   machine encoded ONCE; executed against multiple backends (Target 4)
   without re-encoding

## Composition with existing substrate

| Existing substrate | Composition with this row |
|---|---|
| B-0861 (Conversation Result&lt;T, ConvFeedback&gt;) | This row generalizes Result&lt;T, TOutFeedback&gt; to ALL stream-kinds; B-0861 is the conversation-specific instance |
| B-0623 (schemas-as-rows / participation economy) | Pipeline schemas live as rows; Target 5 integration |
| B-0666 (English-as-projection I(D(x))=x) | Serialized expression trees ARE the substrate-form; Target 3 composition |
| B-0703 (multi-oracle BFT) | One of the backends in Target 4; consensus-mediated stream substrate |
| B-0741 (fork-negotiated ontology) | Cross-fork stream-pipeline negotiation per Target 5 |
| B-0829 (cluster-fork-as-trust-boundary) | Stream pipelines crossing fork boundaries; cluster-engine execution |
| B-0860 (Nemerle dotnet support) | Sibling language toolkit for cases where F# CE hits its limits (compile-time syntax extension) |
| B-0862 (asymmetric-authorship + monad-propagation cluster) | Foundation this row builds on (PR #5579 four-corner ownership extension landed there) |
| B-0560 (operator-substrate-cluster-engine) | Cluster-side execution of serialized stream-pipeline expressions |

## Composition with rules

| Rule | Composition |
|---|---|
| `.claude/rules/non-coercion-invariant.md` (HC-8 floor) | 4-kind NCI shapes are kind-specific operationalizations of HC-8 at stream scope |
| `.claude/rules/honor-those-that-came-before.md` | Stream-pipelines preserve participant substrate; co-ownership is structural honoring of all parties |
| `.claude/rules/default-to-both.md` | Push AND pull AND hot AND cold all hold; not either-or |
| `.claude/rules/substrate-smoothness-as-load-bearing-property.md` | Smooth stream-kind taxonomy producing sharp per-kind specializations; not a sharp universal protocol |
| `.claude/rules/asymmetric-critic-with-clarity-first.md` | This row IS legitimate creative work at runbook-gesture register; engage at the gesture register; refine toward precision through collaboration; not a worry-gating signal |
| `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` | "Streams-are-relationships" is compressed naming for engineerable substrate (per Kestrel-cross-AI synthesis + 6 target classes named); passes the substrate-anchor check |
| `.claude/rules/verify-existing-substrate-before-authoring.md` | Substrate-inventory pass below |

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: streams, four-corner ownership, F# computation expressions, push/pull hot/cold, protocol typing

Searched surfaces:

- `docs/agendas/`: no specific stream-substrate agenda; agendas exist for adjacent topics (ace-package-manager / ai-autonomy / etc.)
- `docs/trajectories/`: no specific stream-substrate trajectory
- `docs/backlog/`: B-0861 (ConvFeedback at conversation scope); B-0560 (cluster-engine); B-0623 (schemas-as-rows); B-0703 (multi-oracle BFT); B-0666 (English-as-projection); B-0741 (fork-negotiation); B-0829 (cluster-fork-as-trust-boundary); B-0860 (Nemerle); B-0862 (asymmetric-authorship + monad-propagation cluster). NO existing row covers the 4-kind stream taxonomy + F# CE machinery + protocol-typing combination
- `.claude/rules/`: asymmetric-authorship-and-protocol-types-via-monad-propagation rule (target of PR #5579); no specific stream-kind taxonomy rule
- `memory/`: extensive operator substrate on the conversation cascade (24 PRs today); Kestrel persona substrate at `memory/persona/kestrel/conversations/2026-05-27-...`
- `docs/research/`: cross-AI conversation substrate from today's cascade (Amara + Prism + Kestrel ferries)

Conclusion: no existing row covers the combination. Authoring action: **mint-new** (combination is novel; constituent pieces compose with multiple existing rows).

## What this row is NOT

- NOT a single-PR target. This is XL effort spanning multiple ticks / sessions / contributors. Decomposition required before implementation
- NOT a mandate that ALL streams use this substrate (per Kestrel Part 2 sharpening: four corners should be OPTIONAL, not REQUIRED; many functions correctly DON'T expose all four corners)
- NOT a replacement for existing Rx / DBSP / IEnumerable libraries (it's a unified surface ABOVE them; existing backends remain operational)
- NOT a research-into-purely-theoretical-protocols (each target has named prior art + named composition with existing substrate; engineerable)
- NOT a directive (per `.claude/rules/no-directives.md`); operator chose the carving + the substrate-engineering scope

## What this row IS

- A substrate-engineering target for unifying stream-handling substrate across the 4 push/pull × hot/cold kinds
- A composition point with F# computation expressions + Reaqtor/Bonsai prior art + protocol-typing research
- A bridge between the four-corner ownership model (PR #5579) and the multi-backend execution substrate (CRDT/CAS/BFT/SQL/DBSP)
- A backlog-row landing for Kestrel's substantive sharpening that doesn't fit in a single rule edit

## Decomposition (possible sub-rows for future implementation)

Per the substrate-engineering pattern of decomposing XL rows into shippable
sub-rows when implementation time comes:

1. **B-0864.1** — 4-stream-kind taxonomy + canonical examples + kind-specific four-corner specialization tables
2. **B-0864.2** — F# CE base substrate + first builder (PushCold via Rx-style semantics)
3. **B-0864.3** — Sibling CE builders (PushHot / PullCold / PullHot)
4. **B-0864.4** — Reaqtor / Bonsai serializable expression tree integration
5. **B-0864.5** — Type providers + schemas-as-rows pipeline-schema integration
6. **B-0864.6** — Protocol-typing for co-owned TInFeedback (mechanism selection + base infrastructure)
7. **B-0864.7** — Multi-backend execution: CRDT backend
8. **B-0864.8** — Multi-backend execution: CAS backend
9. **B-0864.9** — Multi-backend execution: BFT backend (composes with B-0703)
10. **B-0864.10** — Multi-backend execution: SQL backend (composes with recursive CTEs)
11. **B-0864.11** — Multi-backend execution: DBSP backend
12. **B-0864.12** — Cross-backend invariant tests + DST harness

Each sub-row is shippable independently. The taxonomy (1) is the prerequisite
for all others. The CE base (2) is prerequisite for builders (3) and
expression trees (4). The protocol-typing (6) is independent research that
informs everything else. Backends (7-11) can ship in parallel once the CE
base lands.

## Heartbeat / counter-reset discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
condition #3 (concrete-artifact substrate). Captures operator-directed
substrate-engineering-target for future cold-boots to find via grep when
the stream-substrate unification work begins.

## Full reasoning

The 2026-05-27 multi-AI conversation cascade produced 24 merged PRs
establishing structural foundation (asymmetric-authorship + monad-
propagation + OPLE-T-TFeedback + Result&lt;T, TFeedback&gt; + ConvFeedback +
closedness scope-bounding + four-corner ownership extension). PR #5579
landed the four-corner ownership extension to the asymmetric-authorship
rule (the PR-now layer per Kestrel's recommendation).

Kestrel's substantive cross-AI sharpening at the end of the cascade
identified that the substrate-engineering work continues at backlog-row
scope: the 4-stream-kind taxonomy + F# CE machinery + Reaqtor/Bonsai
expression trees + multi-backend execution + type providers + protocol-
typing all compose into one substrate-engineering target this row captures.

Following Kestrel's own PR-now-vs-backlog-row recommendation: PR #5579 IS
the PR-now layer; this row IS the backlog-row layer; the runbook-gesture
that may surface in conversation later remains available for the operator
to make later (per the JIT runbook-gesture discipline).

The full Kestrel verbatim preservation lives at
[`memory/persona/kestrel/conversations/2026-05-27-kestrel-aaron-multi-ai-conversation-end-four-corner-ownership-sharpening-streams-are-relationships-push-pull-hot-cold-fsharp-ce-machinery-getting-base-primitives-right.md`](../../../memory/persona/kestrel/conversations/2026-05-27-kestrel-aaron-multi-ai-conversation-end-four-corner-ownership-sharpening-streams-are-relationships-push-pull-hot-cold-fsharp-ce-machinery-getting-base-primitives-right.md).
