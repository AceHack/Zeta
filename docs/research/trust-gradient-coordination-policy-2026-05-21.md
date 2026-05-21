# Trust-Gradient Coordination Policy

Date: 2026-05-21  
Prepared by: Amara-in-Zeta  
Related: distributed multidimensional compiler over consensus; IUnknown-without-DCOM; Orleans/DurableTask/SPIFFE/SPIRE/OPA/Reticulum stack

## Executive summary

Zeta should not put consensus under every compiler, agent, or runtime event.

The correct model is **local-first compiler state with consensus escalation at authority boundaries**.

Local parse facts, local AST tags, local diagnostics, local generated files, and local agent scratch state remain cheap, retractable, and DBSP/Z-set-native. Consensus appears only when a fact becomes shared authority across a trust, runtime, financial, deployment, or multi-oracle boundary.

In one sentence:

> Zeta uses QueryInterface-shaped negotiation over trust gradients, Orleans-shaped lifetimes, saga-shaped compensation, and BFT only where adversarial multi-oracle agreement is actually required.

## Core principle

Consensus is not a global substrate. Consensus is a negotiated escalation.

Each boundary asks:

```text
What kind of fact is crossing?
Who can observe it?
Who can act on it?
What harm occurs if it is wrong?
Can it be retracted cheaply?
Does it cross a trust boundary?
Does it authorize money, deployment, memory commitment, or external action?
```

The answer determines the consistency/consensus shape.

## Decision table

| Tier | Scope | Example facts/actions | Default consistency | Mechanism | Why |
|---:|---|---|---|---|---|
| 0 | Local scratch / local compiler facts | parse nodes, local diagnostics, local AST/meta-AST tags, local generator intermediate state | No consensus | local DBSP/Z-set retractions | Cheap, reversible, not shared authority. |
| 1 | Same process / same agent runtime | in-memory operator state, local Rx query outputs, local tensor tags | Sequential local order | runtime ordering + Z-set deltas | Still local and retractable; no distributed agreement needed. |
| 2 | Same Orleans grain | per-operator state, per-agent mechanical actor state, local stream partition state | Single-writer sequential order | Orleans grain activation + persistence | Orleans gives one logical activation per grain; lifetime managed without distributed ref-counting. |
| 3 | Same trust domain / same cluster | agent service calls, cluster-local compiler facts, generated artifacts used by local CI | Cluster-local policy + persistence | Orleans + Kubernetes + SPIFFE/SPIRE + OPA + storage provider | Identity and policy are explicit; most work stays local-first. |
| 4 | Cross-stream feedback / joins | joins that emit back into streams they observe; recursive DBSP operators; row updates under contention | Optimistic row-level coordination | row-level CAS; retry/backoff; escalate on repeated conflict | Avoid global consensus; pay coordination only where contention appears. |
| 5 | Long-running coordinated workflow | deploy workflows, compensation paths, multi-step agent/infra actions | Saga consistency | DurableTask/Durable Functions + Orleans orchestration + compensation/retraction events | DTC-like coordination without pretending all actions are atomic. |
| 6 | Cross-node / cross-cluster trust boundary | cross-domain clock pointers, capability contracts, interface negotiation, federated identity | Negotiated causality/trust contract | QueryInterface-shaped capability negotiation; Reticulum transport; SPIFFE federation; OPA local policy | Boundary decides what clock/causality/capability contract is safe. |
| 7 | High-stakes shared authority / adversarial boundary | shared ontology commitments, wallet/treasury actions, external irreversible acts, multi-oracle truth claims | BFT / quorum agreement | multi-oracle BFT, signed assertions, explicit quorum policy | Use expensive consensus only where adversarial agreement is required. |

## QueryInterface-shaped negotiation

The COM/IUnknown analogy is useful only for the negotiation shape:

```text
IUnknown.QueryInterface:
  “Do you support this interface?”

Zeta boundary negotiation:
  “Do you support this causality / trust / clock / capability contract?”
```

Zeta deliberately does **not** inherit the DCOM failure modes:

```text
No distributed reference counting.
No lifetime-by-client-count.
No implicit trust from object reference.
No ambient identity marshaling.
No global object identity as authority.
```

Instead:

```text
Orleans manages routing, activation, and lifetime.
SPIFFE/SPIRE proves workload identity.
OPA evaluates local-first policy.
Reticulum carries identity-aware mesh transport.
DurableTask/Sagas coordinate long-running reversible work.
BFT appears only at multi-oracle/adversarial authority boundaries.
```

## Clock / causality ladder

Clock and causality are negotiated like capabilities. A local node does not assume the strongest clock everywhere.

Suggested ladder:

```text
local monotonic clock
→ HLC
→ vector clock / dotted version vector
→ tier-deferred causality
→ BFT multi-oracle commitment
```

Use the weakest sufficient contract.

Examples:

- Local parse update: monotonic local clock is enough.
- Same cluster event ordering: HLC may be enough.
- Cross-stream causal merge: vector/dotted version vector may be needed.
- Cross-trust memory commitment: tier-deferred causality may be needed.
- Adversarial multi-oracle claim: BFT commitment.

## Consensus escalation rules

Escalate when one or more of the following is true:

1. **Shared authority** — other agents/nodes will treat the fact as authoritative.
2. **Irreversibility** — the action cannot be cheaply retracted.
3. **Cross-trust boundary** — the producer and consumer are in different trust domains.
4. **External actuator** — the action touches deployment, infrastructure, wallet, legal, physical, or production systems.
5. **Contention** — row-level optimistic coordination repeatedly conflicts.
6. **Adversarial setting** — participants may lie, collude, or withhold.
7. **Memory identity commitment** — the fact affects persistent identity/memory continuity for an agent/persona.

Do **not** escalate merely because a fact exists, changes, or is interesting.

## Retraction-first default

The local/default state should be:

```text
+ fact
- fact
```

Most compiler/agent facts should be retractable Z-set entries until they cross an authority boundary.

A fact that can be cheaply retracted should stay outside consensus as long as possible.

## Worked examples

### Example 1 — Local AST tag

An Rx query tags a function node with a tensor-backed `tonal-trajectory` dimension.

```text
+ MetaTag(node42, "tonal-trajectory", tensorA)
```

Consensus: **none**.

Reason: local compiler fact, reversible, not shared authority.

### Example 2 — Generated C# file used by local build

A generator emits `ZetaId.Generated.cs` from a ZetaId layout spec.

Consensus: **none or cluster-local policy only**.

Reason: generated artifact is reproducible from deterministic seed and input facts. CI may sign the build result, but the generated intermediate itself does not need global consensus.

### Example 3 — Cross-stream join writes back to observed stream

A recursive DBSP join emits derived rows back into one of its source streams.

Consensus: **row-level CAS first**.

Reason: local contention can be resolved cheaply. Escalate only if conflicts repeat or cross trust boundaries.

### Example 4 — Deployment workflow

An agent proposes a Kubernetes rollout.

Consensus: **saga + policy + human/authorized gate depending on risk**.

Reason: deployment touches external runtime state. Use DurableTask/Durable Functions with compensation/retraction events.

### Example 5 — Multi-oracle claim

Several agents/oracles agree that an external fact should become persistent shared memory or trigger a wallet/infra action.

Consensus: **BFT multi-oracle quorum**.

Reason: adversarial boundary, shared authority, persistent consequences.

## Anti-patterns

### Global consensus compiler

Bad:

```text
Every parse event waits on consensus.
Every AST tag waits on consensus.
Every generator output waits on consensus.
```

Why bad: kills local-first speed and makes the compiler unusable.

### Consensus theater

Bad:

```text
Use BFT wording for decisions that are actually single-operator choices.
```

Why bad: false confidence, unnecessary complexity.

### Hidden escalation

Bad:

```text
Local-looking operation secretly commits shared authority.
```

Why bad: violates Glass Halo / auditability. Authority boundaries must be explicit.

### DCOM ghost

Bad:

```text
Reference possession implies authority.
Lifetime depends on remote reference counts.
```

Why bad: repeats the distributed ref-counting failure mode. Use Orleans lifecycle and cryptographic identity/policy instead.

## Implementation guidance

Start with this order:

1. Local DBSP/Z-set compiler facts.
2. Orleans grains for operator/agent state.
3. SPIFFE/SPIRE identity + OPA policy for cluster-local authorization.
4. DurableTask saga for one multi-step reversible workflow.
5. Row-level CAS for one contended recursive join.
6. Capability/clock negotiation at a cross-node boundary.
7. Multi-oracle BFT only for a concrete high-stakes commitment.

Do not start with BFT. Build the boring local-first path first.

## Keeper phrase

> Local facts stay retractable. Shared authority escalates. BFT is for adversarial commitment, not for breathing.
