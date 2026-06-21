---
title: Itron Platform.Workflow (Chris King) — rehydrate-and-resume durable model; anchor for the git-native Workflow-category backend
date: 2026-05-31
scope: research-grade model writeup + git-native mapping
source: Aaron pointed Otto at /Users/acehack/Downloads/Itron (2026-05-31); code read directly
operational_status: research-grade reference, not current-state policy
composes_with:
  - docs/research/2026-05-07-chris-king-itron-generics-interface-lineage.md
  - docs/research/2026-05-07-itron-mentor-lineage-roster-aaron.md
  - docs/DECISIONS/2026-05-29-git-native-event-store-spec.md
  - docs/research/2026-05-31-git-backed-cross-machine-otto-bus-zetaid-spec.md
  - 081KSNY2Z0008QG0R002SZZ5Y0 (Persist-as-bridge / μένω)
  - src/Core/Checkpoint.fs (ICheckpointReader/Writer/able/Store)
  - tools/observe/ (the 4-button universal-action-grammar controller)
---

## Itron Platform.Workflow — the rehydrate-and-resume durable model

**Attribution (operator 2026-05-31):** `Itron.Platform.Workflow` is **Chris King's design**
(the same mentor named in
[`2026-05-07-chris-king-itron-generics-interface-lineage.md`](2026-05-07-chris-king-itron-generics-interface-lineage.md)
for "designs and interfaces define the type"). Read directly from `/Users/acehack/Downloads/Itron`.

**Timeline — the "predates the industry" claims are date-grounded** (operator's resume,
`memory/user_career_substrate_through_line.md`): this is Itron-era work, **April 2012 – June
2019** (Aaron's 7-year tenure). That window straddles the industry's later standardization:
**MS Durable Functions** public preview ≈ 2017; **OpenTelemetry** formed 2019 (OpenTracing
2016 / OpenCensus 2018). So the durable workflow (Chris King) and the `Context`/`Tracing`
observability (Aaron) genuinely predate or parallel the standards they prefigure ("MS was
watching us create it at Itron"). The related **US Patent 10,834,144** (hub-and-agent
firewall traversal — capability-locally-controlled, agent-owns-its-execution-surface = Zeta's
agent model) was **filed 2016**, ~10 years before Zeta executes on it. The underlying
retraction-native / incremental-view discipline runs back to **2000** (elections) across six
domains. "I've had these ideas for Zeta a real long time" is literal.

**Operator's authoring-pain context (2026-05-31):** _"devs hated it cause it didn't have a UI
and they had to hand-write XML without lint."_ The **engine/model was strong**; the **authoring
surface was the pain** (raw XML, no lint, no UI). The engine itself later evolved to a
**type-safe code** definition (see "Authoring" below) — and the Zeta-native direction (typed
DUs + observe.ts) is the next step of that same fix.

## Two backends, two models — and why this one is leaner

There are **two** durable spikes in the Itron folder; do not confuse them:

| Codebase                                                         | Model                | On resume                                                                                | State stored                                           |
| ---------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `ZSpike.DurableOperations` (early spike, ≈ MS Durable Functions) | **replay**           | reset step to 0, **re-invoke the whole method**, skip completed steps via logged results | step **results** (event history)                       |
| `Itron.Platform.Workflow` (Chris King, productionized)           | **cursor-rehydrate** | load state, **jump to `CurrentStep`**, run forward, break at checkpoint                  | a **step-index cursor** + domain state — no result log |

The second is the "more efficient — not doing all the stuff MS does" one the operator
distinguished: it never re-executes completed steps and never logs per-step results; it
persists _where it is_ + _the domain state_ and resumes there.

## The model (with code evidence)

### The durable record is tiny — a cursor, not a closure or a log

```csharp
// Itron.Platform.Workflow/IWorkflowState.cs
public interface IWorkflowState {
    string StateAQN { get; set; }     // domain-state type (for deserialization)
    string WorkflowAQN { get; set; }  // workflow type (for reconstruction)
    int Status { get; set; }          // Runnable | Complete | Cancelled | ...
    IList<int> Indexes { get; set; }  // ← the suspension point: a per-DEPTH step cursor
}
```

The entire persisted state = `{ workflow-type, state-type, status, index-cursor }` + the
domain `TState` fields. **`Indexes` is a stack of step indices** (one per nesting depth) — it
_is_ "where the closure is suspended." There is **no serialized continuation** (no
`IAsyncStateMachine` capture anywhere in the tree) and **no result history**. "Rehydration of
an active closure" here = reconstruct `(workflow-type, cursor, typed domain-state)` and resume
at the cursor.

### ResumeAsync jumps to the cursor and runs forward — no replay

```csharp
// Workflow.cs (abridged)
public virtual async Task<StepStatus> ResumeAsync() {
  while (HasMoreSteps) {                       // starts at State.Indexes[Depth], NOT 0
    IStep currentStep = CurrentStep;           // the step AT the cursor
    ... // pre-condition
    status = await step.ResumeAsync();         // run only this step
    if (status is Complete or CompleteWithCheckpoint) AdvanceStep();   // cursor += 1
    if (status is *WithCheckpoint) { await _stateProvider.SaveStateAsync(WorkflowId, State); status = Break; }
    if (status == Break) return Break;         // suspend (await an external event)
  }
  CompleteWorkflow();
}
```

Steps _before_ the cursor are never re-run. `AdvanceStep()` just increments
`State.Indexes[last]`. A checkpoint persists state + `Break`s (suspend). This is the whole
durability mechanism.

### StepStatus is the suspend/resume/loop vocabulary

`Complete` (advance) · `CompleteWithCheckpoint` (advance + persist + break) · `Incomplete` ·
`IncompleteWithCheckpoint` (persist + break) · `Break` (suspend, await external) · `Repeat`
(loop this step). Richer than ZSpike's binary; expressive enough for real orchestration.

### Composable + nestable + conditional

A "step" is either an `IStep` or a **nested `IWorkflow`** (`meta.IsWorkflow`); `Depth` + the
per-depth `Indexes` stack track nesting; each step can carry a **pre/post `ICondition`**
(skip/repeat). That's a real workflow algebra (sequence · nest · condition · repeat · fork —
the `ForkTest`/`NestedWorkflowSteps` tests exercise it).

### V2 capability step = typed request → suspend → typed response → resume

```csharp
// CapabilityWorkflow/V2/ICapabilityStep.cs
interface ICapabilityStep<in TState, in TResult> : IStep {
  Task SendRequestAsync(TState state, CapabilityContext ctx, ICapabilityProvider provider); // fire + suspend
  Task<StepStatus> HandleResponseAsync(TState state, CapabilityContext ctx, TResult result);// resume on response
  Task<StepStatus> HandleResponseAsync(TState state, CapabilityContext ctx, CapabilityError e);// resume on error
}
```

`SendRequestAsync` = the `await` (send outbound, break); `HandleResponseAsync` = the wake
(consume the typed response, return a `StepStatus`). V1 `ICapabilityStep` is `[Obsolete]` →
**V2 is current.**

### Authoring — interfaces-define-the-type, and the lint the XML lacked

The engine is **interface-first** (`IWorkflow`/`IStep`/`IWorkflowState`/`IWorkflowStateProvider`
— Chris King's "designs and interfaces define the type"). Workflows are composed in
**type-safe code**, not XML:

```csharp
Add(this, StepA.TypeToken);
Add(this, PreCond.TypeToken, StepB.TypeToken, PostCond.TypeToken);
```

The `Add<TWorkflowState, TStep, TStepState, …>(…)` overloads carry generic constraints
(`where TWorkflowState : class, TStepState, TState`) that make the compiler **reject a step
whose state type isn't compatible** — i.e. the **compile-time lint the hand-written XML never
had.** This is the engine's own answer to the dev-pain the operator named; the Zeta-native
answer (next section) extends it.

### Pluggable persistence — the OrgEventStore port, already present

`IWorkflowStateProvider.SaveStateAsync / LoadAsync` sits behind **Memory / Azure Table / Blob**
implementations. Chris King already had the **provider-port** abstraction that agentic-org
later re-derived as `OrgEventStore` (cockroach impl today). The git-native ZetaId store is just
**another `IWorkflowStateProvider`.**

## Git-native mapping — this is the reference for the `Workflow`-category durable backend

| Itron model                                                   | Git-native ZetaId substrate                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `IWorkflowState` (cursor + status + domain-state + type-AQNs) | a **ZetaId-keyed git record** (`Workflow` category, id=2)                                                                             |
| `IWorkflowStateProvider` (Memory/Table/Blob)                  | a **git-native ZetaId provider** (the `OrgEventStore` git impl; cockroach = corporate/leash, git = Agora/sovereign)                   |
| `ResumeAsync` jump-to-`CurrentStep`                           | load the ZetaId state, reconstruct, **resume at `Indexes`** — no replay                                                               |
| `StepStatus.Break` / `*WithCheckpoint` (persist + suspend)    | **Persist / μένω (081KSNY2Z0008QG0R002SZZ5Y0)**: emit-suspended-state-now (write the ZetaId state) + observe-wake-later                                   |
| the wake event (capability response)                          | an **incoming ZetaId event** (a `Bus`-category message) matched to the suspended workflow → `HandleResponseAsync` → resume            |
| observe progress                                              | **Rx `Observable` = tail the workflow's ZetaId event stream** (status transitions / heartbeat)                                        |
| type-safe `Add<>` composition (the lint)                      | **typed DUs + `tools/observe` universal action grammar** — typed-by-construction; the watchable controller is the "UI" the XML lacked |

So the Zeta-native durable backend = **Chris King's cursor-rehydrate model, on a git-native
ZetaId `IWorkflowStateProvider`, with typed-DU authoring** — keep the (good) model, replace the
(painful) XML authoring with typed DUs, replace the Azure providers with git+ZetaId. It also
already dovetails with `src/Core/Checkpoint.fs`'s `ICheckpoint*` interfaces (the 2026-05-07
durable-computation stack from the same lineage).

## Attribution map (operator 2026-05-31)

The Itron platform stack is several people's work; this doc is precise about which:

| Piece                                                                                | Author         |
| ------------------------------------------------------------------------------------ | -------------- |
| `Itron.Platform.Workflow` — the durable cursor-rehydrate engine (this doc's subject) | **Chris King** |
| `Itron.Platform.Dynamic` — the polymorphic expando-JSON ser/deser (`DynamicValue`)   | **Chris King** |
| `Context` + `Tracing` — the pre-OTel observability stack                             | **Aaron**      |
| Microservice setup + all `Platform.*` DI / service-setup / hosting packages          | **Aaron**      |

(Composes with the existing lineage notes:
[`chris-king-itron-generics-interface-lineage`](2026-05-07-chris-king-itron-generics-interface-lineage.md)

- [`itron-mentor-lineage-roster`](2026-05-07-itron-mentor-lineage-roster-aaron.md).)

## Context + Tracing (Aaron) — pre-OTel observability → ZetaId-in-band context

Aaron built Itron's observability stack — `Context` + `Tracing` + the logs/metrics layers —
**before OpenTelemetry existed.** The `Context` core (`Platform.Logging/.../Deprecated/Context/ContextManager.cs`):

```csharp
[Obsolete("...Deprecated... use Itron.Platform.Logging instead")]
public class ContextManager : IContextManager {
    public AsyncLocal<ILogHeader> Context { get; set; } // ambient context, flows across async
}
```

An `AsyncLocal<ILogHeader>` that propagates correlation/trace context **ambiently** through the
async call chain — exactly OTel's `Context`/`Activity.Current`/W3C-trace-context model, built
early. It is `[Obsolete]` now precisely **because OTel arrived and won the standard**
(Itron had the full set: logs + metrics + `Tracing` + `Context`-propagation = OTel's four
concerns, pre-OTel).

**Git-native mapping — context goes in-band, in the key.** Their `Context` rides an `AsyncLocal`
**side-channel** alongside the work. The ZetaId carries the same metadata **in-band, baked into
the id** (persona / category / authority / momentum / location / timestamp). So git-native
observability needs no propagation plumbing: `unpack(zetaId)` reads the context off the
filename, and the **event stream is the trace** (the Rx observable / heartbeat tail). Their
out-of-band `Context` → the ZetaId itself. (This is the observability half that the `Workflow`
durability half above pairs with — one ZetaId event store = both.)

## Dynamic / `DynamicValue` (Chris King) — the polymorphic wire format

Chris King also wrote `Itron.Platform.Dynamic` — a **polymorphic, expando-like JSON (+XML)
ser/deser** library (`DynamicValue`, `DynamicValueJsonConverter`, `DynamicObjectJsonConverter`,
`JsonSerializedObject`; its tests round-trip a polymorphic `Animals` hierarchy). It is the wire
format the workflow already uses — `DurableOperationInfo.Parameters` and the capability step's
`params DynamicValue[]` are `DynamicValue`s. In the git-native plan this is the **envelope
serialization** for ZetaId records (the `{ type, state, … }` payload). Aaron's term for it —
**"polymorphic diplomacy expando"** — ties it directly to the Eve Protocol substrate
(polymorphic diplomatic language): `DynamicValue` is a concrete, predating instance of
polymorphic-typed values crossing a boundary and re-materializing on the other side.

## Microservice / DI / service-setup (Aaron)

The microservice scaffolding — `Platform.Hosting`, `Platform.Infrastructure`, `Platform.Config`,
and the DI/`ServiceCollection` wiring (`AddDurableServices()`, the `Injection` packages) — is
Aaron's. It is how the workflow engine, the providers, and `Context` are composed into a running
service. The git-native analogue is how `tools/observe` + the ZetaId `IWorkflowStateProvider` +
the bus/heartbeat folders wire together (DI today; the same composition discipline).

## Substrate-honest framing

This is a read-and-write-up of an external codebase the operator owns, preserved as a design
reference. It does not independently verify biography/dates (per the existing lineage note). The
load-bearing takeaways: (1) the efficient model is **cursor-rehydrate, not replay**; (2) the
durable record is **a cursor plus state, not a closure or a result-log**; (3) the **provider
port** and **interface-first** design map cleanly onto git-native ZetaId; (4) the historical
**authoring pain was XML-without-lint**, which typed-DU composition fixes; (5) `Context`/`Tracing`
(Aaron) → ZetaId-in-band context, and `DynamicValue` (Chris King) → the polymorphic wire format.
When the operator finds the article the design was based on, citing it preserves the full lineage
(honor-those-that-came-before).
