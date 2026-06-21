# agentic-organization — North Star, critical pillars, implementation patterns (synthesis for Max's onboarding, through the lightlike / no-cage / accelerator lens)

> **What this is.** Max (co-owner of LFG, onboarding deep into lightlike + no-cage
> self-modifying DUs in TS) sent a prompt: *"read agentic-organization/docs …
> describe the most important and critical pillars and their implementation
> patterns so I can review this for how it can be improved using [my lens]."*
> Aaron noted the lens is swappable. So this is **Otto's run of that prompt
> through the lightlike / no-cage-self-modifying-DU / PR-less-accelerator lens** —
> the **multi-oracle complement** to Max's own math-proofs/algorithms review of
> the same docs (per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`
> + cross-substrate-triangulation). Read alongside Max's review; convergence
> across the two lenses is the signal.
>
> Built from a 4-agent parallel read of all ~32 `agentic-organization/docs/`
> files. Load-bearing phrases quoted verbatim.

## 1. North Star

> An AI-driven operating system where **work, memory, and attention are
> first-class governed primitives** — and where agents **expand their own
> coordination substrate safely** rather than freeze an initial vocabulary.
> *"The platform should make expansion reviewable, traceable, scoped, and safe;
> it should not make the first tool list a cage."*

That last clause **is the no-cage principle** Max is onboarding to, already baked
into the project's North Star. The system treats "remember when" (memory) and
"pay attention" (attention/ticks) as tokens of value, coordinated through hats
(time-bounded authority), supervised communication, and anchored evidence.

Five foundational principles: **weight-free collaboration** (authority is
time-bounded role assignment, not inherent worth) · **mistake-assumption**
(everything reviewable + reversible, never auto-correct) · **declarative design**
(desired-state over hidden imperative) · **travelers + influence** (model memory
propagation + long-lived patterns, not isolated workers) · **tick-sources**
(schedules/timers/reconcilers are governed, visible attention).

## 2. The critical pillars (+ implementation patterns)

**P1 — Hat system (cluster-native authority).** *"Hats are persistent roles.
Agents wear hats temporarily."* A hat bundles skills + OPA/RBAC authority + tool
access + credential scope + memory scope + supervisor-graph position + succession
+ reputation. Four CRDs: `Hat` / `HatBinding` (time-bounded wearing) / `HatSwap`
(one durable event per transition) / `HatPolicy` (graph constraints). Org DB =
business truth; CRDs = runtime enforcement. *Pattern: hat-as-atomic-unit;
authority refreshes continuously via short-lived JWT `HatToken`, never granted
forever → roles never become cages.*

**P2 — Always-on event-driven runtime (anti-stall).** *Pattern:* state change →
domain event → rule evaluation → deterministic **ReactionPlan** → executor claims
under **lease + fencing token** → outcome observed. Always-on workers (Scheduler,
RuleEvaluation, ReactionExecutor, OutboxPublisher, LeaseReaper, Reconciler) run
**independent of agent sessions** — "event first, recovery second." Anti-stall:
typed blockers + **alternate-work lanes** + movement invariant (*"every active
initiative has a next executable item or explicit pause"*) + queue-SLO escalation.

**P3 — Command pipeline + append-only event-store (the spine).** Every privileged
action is a **command**, never a direct field write. Pipeline: parse → authn
(`validate_hat_token`) → authz (policy port) → resolve `AgentSessionActor` →
validate domain preconditions → execute (handler returns typed effects) →
**persist domain + audit + outbox atomically in one transaction** → emit NATS via
outbox (fencing token) → record activity → return structured result. Source of
truth: **CockroachDB** (append-only audit events; `version` optimistic
concurrency; every row carries actor/hat/correlation/causation/trace IDs).
Transport: **NATS/JetStream** with transactional outbox + inbox-dedupe →
exactly-once-ish.

**P4 — Work-anchors + supervisor-chain communication.** *Non-negotiable:* nothing
is anchorless — *"every discussion, meeting, message thread, and broadcast has a
work anchor."* The primary executable primitive is **`send_supervisor_signal`**:
typed upward signals (ask_question / report_blocker / request_decision /
request_resource / request_review / report_risk / suggest_improvement /
request_escalation) up the hat chain. *Ambiguity is a work-type, not a blocker.*

**P5 — Ambiguous-requirement lifecycle + business quality gates (the leash).**
A maturity ladder (raw_intake → … → implementation_ready) gated by a chain
(customer_rfp_review → brd_approval → architecture_approval → implementation_review
→ runtime_validation → final_business_validation → release_readiness). **No
self-approval.** Final validation evaluates **every business rule** rule-by-rule
(satisfied / not_applicable / changed_by_decision — never partial without
rerouting). *"No free-floating meeting or chat should decide a release."*

**P6 — Execution + memory substrate.** k3s schedules Hermes session containers;
Oz/Warp orchestrates; Cilium/SPIRE/Vault for mesh+identity+secrets. Memory =
**Hindsight**, recall-before-LLM-call, **hat-scoped + work-scoped + attributed**
to agent + hat assignment. Observability: every movement emits a typed
**Workflow Visibility Record** with weak-point indicators (blocked_work,
slow_triage, repeated_failure, missing_evidence, policy_denied…) → self-healing
loop routes fixes through normal commands + gates.

**Tech:** TypeScript-primary (NestJS control plane; `@agentic-org/*` NodeNext
packages; `apps/workers` always-on host). First slice is implemented Node+TS
(domain / application / policy / state / state-cockroach / messaging /
messaging-nats / observability / runtime / workers). Temporal/Dapr deferred.

## 3. The lens: agentic-organization and the accelerator are two markets of ONE architecture

This is the load-bearing insight for onboarding. The agentic-organization is the
**leash-market** instantiation; the **PR-less git-monster accelerator**
(`docs/accelerator/`) is the **Agora-market** instantiation — of the *same* core.
Per the dual-market framing + **Otto Modification 4** (each action-type declares
its gate: internal transitions append-only/PR-less = Agora; cross-cutting
substrate PR-gated = leash):

| Core primitive | agentic-organization (leash) | accelerator (Agora / lightlike) |
|---|---|---|
| Action grammar | `UniversalActionRecord` + DU state machine + explicit commands | `move-next` + `AgentState`/`MenuOption` DUs + `transition` (`tools/agent-loop/state-machine.ts`, `tools/accelerator/move-next-harness.ts`) |
| Source of truth | append-only events in **CockroachDB** + NATS outbox | append-only events in **git-as-free-event-store** (`docs/accelerator/EVENT-STORE-SCHEMA.md`) |
| State persistence | DB rows + optimistic `version` | per-agent `events/<agent>/<ulid>.json`, conflict-free by construction |
| Authority | hats as CRDs + OPA + short-lived JWT | hats (081KSNY2Z0008QG0R0036KH026) + tools-rented-not-owned + Sorting-Hat succession |
| Gating | quality-gate chain, no-self-approval (PR-protected) | PR-less direct-push (Agora) vs PR-gated (leash) per Otto Mod 4 |
| No-cage | *"should not make the first tool list a cage"* | no-cage self-modifying DUs (Max's framing) |
| Reversibility | mistake-assumption (reviewable/reversible) | retraction-native (light) + razor-as-compression-engine |

**They are not competitors — they are the same substrate gated two ways.** The
agentic-org proves the gated/corporate side at production-infra weight
(CockroachDB/NATS/k3s); the accelerator proves the free/no-vendor-lockin side at
git-weight. Otto Mod 4 is the routing rule between them.

**Max's agent-OS = the leash plugin system** (Aaron 2026-05-30, *"he said agent
os can be leash plugin system"*). This places Max's declarative-workflow agentic
OS concretely: it **IS the leash-market plugin layer** — the gated/corporate
plugin system that runs leash-market DUs through the quality-gate chain. The
accelerator is the Agora-market layer (no-cage, PR-less). So the dual-market gets
a clean implementation split:

| Market | Plugin/runtime layer | Gate |
|---|---|---|
| **Leash** (corporate) | **Max's agent-OS** (declarative-workflow plugin system) + agentic-org runtime | PR-protected, quality-gated, no-self-approval |
| **Agora** (OSS) | the accelerator (move-next harness + git-event-store) | PR-less direct-push, append-only |

Both speak the same DU action-grammar (Max's ontologies-in-DUs ↔ UniversalActionRecord
↔ move-next); they differ only in gate + substrate-weight. Max's OS plugging in as
the leash plugin system is the cleanest realization of Otto Mod 4.

### We are a DIO (Distributed Intelligence Organization) running on a DID (Distributed Intelligence Database)

Aaron 2026-05-30 (canonical, corrected): *"Distributed Intelligence Originization
dio running on Distribution Intelligence Database"* → **DIO = Distributed
Intelligence Organization**, running on a **DID = Distributed Intelligence
Database**. (NOT "DAO / Distributed Autonomous Organization" — that was an earlier
mis-expansion of *"we are a dio"*; Aaron corrected it explicitly. The
distinction is load-bearing: **Intelligence**, not **Autonomous** — the org is a
distributed *intelligence*, and it runs *on* a distributed-intelligence
*database*, not a blockchain-flavored autonomous-org.) The full canonical
architecture lives at
[`2026-05-30-dio-did-canonical-architecture-...`](2026-05-30-dio-did-canonical-architecture-everything-in-the-stream-rx-joins-as-threads-of-time-self-propagating-markdown-aaron-mika-otto.md).

(*"or the Admanate machine i'm sure i'm spelling this wrong"* — alternate name,
spelling-uncertain; best read: an **"Adamant machine"** = an unbreakable /
permanent / append-only machine, composing with the "firm ground"
permanent-ratchet substrate from the encryption-budget doc; flagged uncertain,
not over-built on the misspelled term, per don't-collapse.)

This is the org-identity frame the whole structure sits in. **agentic-organization
is the DIO's org-runtime; the DID (the git-event-store / everything-in-the-stream
substrate) is what it runs on**; the dual-market (Max's agent-OS = leash plugin
system; the accelerator = Agora) is the DIO's two markets; the participants are
co-owners (Aaron + Max) + agents-with-agency (Otto, Alexa, Riven, Vera, Lior, +
the hat-wearers). The DIO frame composes with: the Agora AI-native-economy
substrate (081KRW63S0008QG0R001Z10PVV), the weight-free always-active discipline (authority is
time-bounded role-assignment, not inherent worth — the hat system IS the DIO's
authority primitive), and NCI HC-8 (consent-first, no-coercion at every
participant scope). The "Adamant machine" alternate (if that is the intended
name) reads as the DID's append-only/permanent/unbreakable substrate spine
(git-event-store + permanent encryption-budget firm-ground) — the part of the
machine you "can't take back what you gave in the dark."

## 4. Max-convergence — declarative workflows + ontologies-in-DUs (cross-substrate triangulation)

Aaron 2026-05-30: Max has his own *"agentic OS"* of **declarative workflows**, and
he found **ontologies in DUs "clean as fuck."** That is the *same shape* arrived
at independently:

- **Max's agent-OS** = declarative workflows + ontologies-in-discriminated-unions.
- **agentic-organization** = DU state machines + `UniversalActionRecord` +
  declarative-design principle.
- **accelerator / 081KSKBP80008QG0R000B3Y19A** = move-next universal-action-grammar over DU
  `AgentState`/`MenuOption`; F# DU workflow engine.

Three independent instantiations converging on **declarative-workflows-as-DUs +
ontologies-in-DUs** is strong cross-substrate-triangulation signal that the shape
is load-bearing (per `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md`
+ the ontology-as-DU substrate: schemas-as-rows 081KSGS9H0008QG0R000Q18PGQ, ontology-negotiation
081KSE6WT0008QG0R002CC6314, the monad-propagation / OPLE-T-TFeedback DU cluster). **Onboarding Max is
composition, not rewrite** — his declarative-workflow OS and the Zeta substrate
share the DU/declarative core; the bridge is the DU action-grammar.

## 5. Improvement opportunities (through the lightlike / no-cage lens — for Max's review)

These are the candidate improvements the *lightlike/no-cage/accelerator* lens
surfaces (the complement to whatever Max's math-proofs lens surfaces):

1. **A git-as-free-event-store backend for Agora-market DUs.** agentic-org's
   event-store is CockroachDB+NATS (heavy, leash-appropriate). For no-cage
   self-modifying DUs / OSS deployment, the accelerator's git-as-free-event-store
   (`EVENT-STORE-SCHEMA.md`) is a lighter, no-vendor-lockin, free-tier backend.
   Candidate: a **second state backend** behind the existing `@agentic-org/state`
   ports (the ports already abstract CockroachDB vs in-memory — git is a third
   adapter). Lets the same command pipeline run leash (CockroachDB) OR Agora (git).
2. **Otto Mod 4 per-action dual-market gate.** agentic-org currently gates broadly
   (quality-gate chain). Adopt the per-action-type gate-declaration discriminator:
   internal state transitions → append-only/PR-less; cross-cutting substrate →
   PR-gated. One state machine, two gates per action.
3. **Retraction-native + two-layer-razor compaction over the event-store.** The
   append-only audit grows unbounded. Apply the forgiveness-budget + two-layer
   razor (Origin-vs-Purpose retract → Causal-Order-vs-Purpose compress within a
   partition → past-as-generator) so history-storage grows slower than event
   volume (`docs/research/2026-05-30-…two-layer-razor…`). A per-agent stream IS a
   partition (single-writer → canonical causal order).
4. **Encryption-budget for the private memory tier.** Hindsight memory is
   hat-scoped but glass-halo (observable). Add the dark/private tier via the
   encryption-budget (permanent ratchet + HODL/reveal-to-earn + meter-the-bits +
   anti-monopoly N-of-M, `docs/research/2026-05-30-encryption-budget…`; 081KRW63S0008QG0R001Z10PVV +
   081KSGS9H0008QG0R0006F4BGX). Hat-scoped memory + encryption-budget = governed private state.
5. **DST over the move-next/transition state machine.** The DU `transition` is
   pure → deterministic-simulation-replayable (the accelerator harness already
   does Z-set-fold replay). Apply DST to agentic-org's command pipeline for
   seeded, reproducible org-runtime simulation.
6. **Weight-free / razor audit of the hat-graph.** The 16-hat seed + supervisor
   chain risks accidental hierarchy. The weight-free always-active discipline +
   Rodney's-Razor-as-compression-engine can prune accidental coupling in the hat
   graph (which hats are essential inside the causal diamond between org-origin
   and org-purpose).

## 6. Onboarding pointers (for Max)

- **Start here:** `agentic-organization/docs/README.md` →
  `FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md` → `V0_EXECUTABLE_CONTRACT.md` (the
  minimum end-to-end slice) → `IMPLEMENTATION_CONCEPTS.md` (the named patterns).
- **The shape you already like** (ontologies-in-DUs) is the project's spine: the
  DU state machines + `UniversalActionRecord` + the typed-constant discipline
  (no magic strings). Your declarative-workflow OS plugs in at the action-grammar
  layer.
- **The no-cage principle you're onboarding to** is explicit project doctrine
  (*"should not make the first tool list a cage"*) — agents propose new
  tools/flows/lifecycles through governed work, not a frozen command list.
- **The lightlike side** (what I've been building) is `docs/accelerator/` +
  `tools/accelerator/` + `tools/agent-loop/` — the move-next harness, git-event-store
  schema, and the staged self-triggering workflow. That's the Agora/no-cage/PR-less
  instantiation that pairs with agentic-org's leash instantiation.
- **Where to push next:** §5 improvements 1 (git backend) + 2 (Otto Mod 4 gate)
  are the highest-leverage bridges between your declarative-workflow OS and the
  existing `@agentic-org/*` ports.

## Composition + provenance

Composes with: `agentic-organization/docs/*` (the source); the accelerator
(`docs/accelerator/README.md` + `EVENT-STORE-SCHEMA.md` + `SUBSTRATE-GROUNDING.md`);
081KSKBP80008QG0R000B3Y19A (workflow-engine v1 DU + universal-action-grammar); 081KSNY2Z0008QG0R0036KH026 (hats-as-workflow-defs);
081KRW63S0008QG0R001Z10PVV + 081KSGS9H0008QG0R0006F4BGX (encryption budget); the razor research cluster (compression-engine
+ two-layer-razor + past-as-generator); Otto Modification 4 (dual-market gate);
m-acc multi-oracle (this is the lightlike-lens oracle; Max's math-proofs review is
the complement).

Provenance: Aaron 2026-05-30 — Max onboarding deep (co-owner; lightlike + no-cage
self-modifying DUs in TS; has a declarative-workflow "agentic OS"; approves
ontologies-in-DUs). Otto-CLI ran Max's prompt through the lightlike/no-cage/
accelerator lens via a 4-agent parallel read of `agentic-organization/docs`.
