---
title: Observe Context Packs
canonical_name: Agentic Organization
status: design + first-slice implementation contract
extends:
  - OBSERVE_COMPOSER_AND_RUN_STATE.md
  - REFACTOR_OBSERVE_AS_UNIVERSAL_AGENT_CLI_AND_DASHBOARD.md
  - DOCUMENT_INTELLIGENCE_DESIGN.md
  - AGENT_NATIVE_KNOWLEDGE_GRAPH.md
  - KNOWLEDGE_GRAPH_CONSTRUCTION_DESIGN.md
code_anchors:
  - ../packages/application/src/observe.ts
  - ../packages/application/src/context-pack-contracts.ts
  - ../packages/application/src/context-pack-readiness-policy.ts
  - ../packages/application/src/context-pack-scope-evaluator.ts
  - ../packages/application/src/context-pack-advisory-promotion-policy.ts
  - ../packages/application/src/context-pack-builder.ts
  - ../packages/application/src/model-backed-context-pack-synthesis.ts
  - ../packages/application/src/context-pack-doc-consult-ledger.ts
  - ../packages/application/src/context-pack-runtime-evidence.ts
  - ../packages/application/src/handlers/record-quality-gate-evaluation.ts
  - ../packages/application/src/context-pack-snapshot-store.ts
  - ../packages/application/src/memory-context-pack-recall.ts
  - ../packages/application/src/context-pack-tenant-completeness-policy.ts
  - ../packages/application/src/context-pack-tenant-curation-policy.ts
  - ../packages/application/src/context-pack-tenant-synthesis-requirement-policy.ts
  - ../packages/domain/src/hat-communication-brief.ts
  - ../packages/domain/src/tenant-config.ts
  - ../packages/state-cockroach/src/cockroach-context-pack-document-port.ts
  - ../packages/state-cockroach/src/cockroach-context-pack-lifecycle-anchor-port.ts
  - ../packages/state-cockroach/src/cockroach-doc-consult-ledger-store.ts
  - ../packages/state-cockroach/src/cockroach-command-state-store.ts
  - ../packages/state-cockroach/src/cockroach-context-pack-snapshot-store.ts
  - ../packages/state-cockroach/src/cockroach-context-pack-advisory-promotion-decision-store.ts
  - ../packages/state-cockroach/src/cockroach-context-pack-inbox-anchor-port.ts
  - ../packages/state-cockroach/migrations/0028_agentic_org_doc_consult_context_pack_exposure.sql
  - ../packages/state-cockroach/migrations/0030_agentic_org_doc_consult_outcome_stamp.sql
  - ../packages/state-cockroach/migrations/0031_agentic_org_context_pack_advisory_promotion_decisions.sql
  - ../apps/agent-cli/src/agent-cli-main.ts
  - ../packages/application/test/observe.test.ts
  - ../packages/application/test/context-pack-builder.test.ts
  - ../packages/application/test/context-pack-runtime-evidence.test.ts
  - ../packages/application/test/context-pack-tenant-completeness-policy.test.ts
  - ../packages/application/test/context-pack-tenant-curation-policy.test.ts
  - ../packages/application/test/context-pack-tenant-synthesis-requirement-policy.test.ts
  - ../packages/application/test/memory-context-pack-recall.test.ts
  - ../packages/state-cockroach/test/cockroach-context-pack-document-port.test.ts
  - ../packages/state-cockroach/test/cockroach-context-pack-lifecycle-anchor-port.test.ts
  - ../packages/state-cockroach/test/cockroach-context-pack-inbox-anchor-port.test.ts
  - ../packages/state-cockroach/test/cockroach-context-pack-advisory-promotion-decision-store.test.ts
  - ../packages/state-cockroach/test/cockroach-tenant-config-store.test.ts
---

# Observe Context Packs

## Thesis

The frontier model vendors have largely solved raw intelligence. The unsolved
problem for an autonomous organization is context: which facts, policies,
decisions, memories, documents, traces, and graph neighborhoods should a specific
agent wearing a specific hat see right now?

`observe.ts` is the right choke point because it already knows the hat, scope,
run phase, schedule, prompt-flow tasks, hierarchy readout, and legal action
surface. A context pack is the third half of the same surface:

```text
observeAgentSurface
  -> actions: Menu16
  -> metrics: ScopedReadout
  -> context: ContextReadout
```

The pack is not a search dump. It is a bounded, policy-checked, hat-scoped graph
slice with omissions, contradictions, stale inputs, lifecycle blockers, and
curation trace made visible.

## Non-Negotiables

- A hat-holder must never wake up to an empty implicit context. If no context
  builder is wired, the surface returns a degraded pack with an explicit omission.
- Context is scoped by hat authority and current work. Directors see portfolio,
  initiative, blocker, staffing, policy, and blast-radius context. Individual
  contributors see the work item, acceptance criteria, prompt-flow instructions,
  repo-specific docs, and directly relevant decisions.
- Deterministic retrieval narrows the world before any model helps. Agentic
  enrichment summarizes, ranks, and identifies gaps inside the deterministic
  scope. It does not become the source of truth.
- Hindsight memory appears as memory pointers and recall summaries with
  provenance. It complements docs and graph state; it does not override approved
  organizational documents.
- Every active hat receives a deterministic communication brief before any
  model-backed synthesis. The brief tells the wearer what duty it is performing,
  where its supervisor route goes, which upward communication tools exist, and
  what evidence each tool requires.
- Omissions are first-class. Access denial, stale documents, unresolved
  contradictions, missing handbooks, and unavailable memory are visible.
- Every context pack is replayable from source pointers and curation trace.

## Composition

`observe.ts` stays pure at the lifecycle kernel. The surface orchestration remains
port-based:

```ts
type ContextPackBuilderPort = {
  build(request: ContextPackBuildRequest): Promise<ContextPackBuildResult>;
};
```

The builder returns a pack candidate. `observe.ts` owns the final
`ContextReadout` composition so status, omissions, freshness, and scope checks
remain deterministic and replayable at the observe surface.

That final surface is now split into small pure policy modules:

- `context-pack-contracts.ts` owns the context-pack discriminated unions,
  source-pointer vocabulary, readout contract, and builder port. `observe.ts`
  re-exports those contracts for compatibility, but it no longer owns them.
- `context-pack-readiness-policy.ts` owns the deterministic readiness decision:
  missing builder, contradiction, omission, invalid timestamps, stale inputs,
  source-less evidence, missing required curation stages, current status, and
  tenant-config uncertainty and omission hard stops through
  `ContextPackReadinessPolicyPort`.
- `context-pack-scope-evaluator.ts` owns active-scope replay validation:
  whole-pack snapshot matching, doc-unit scope checks, department scope
  expansion, canonical and raw graph roots, graph edge traversal anchors,
  Hindsight sticky attribution, work-item pointers, schedule-block pointers,
  supervisor-signal pointers, and replay anchors for audit-only pointer kinds.
  The deterministic builder also consumes the shared active graph-root helper
  when grounding ephemeral synthesis and completeness checks, so the builder
  and observe surface do not drift on which organization graph roots are active
  for the current hat/work scope.
- `context-pack-advisory-promotion-policy.ts` owns deterministic admission for
  turning grounded ephemeral advisory items into lifecycle blockers. Synthesis
  can propose gaps, questions, and action refs; the default policy is
  deny-by-default and promotes only when a hat-curated approval decision matches
  the admitted advisory fingerprint and active scope.

This keeps the director-context question honest. The builder can propose a rich
pack, but the observe surface still asks one deterministic question before the
agent sees it: can every required item be replayed from source pointers that are
inside the active hat, project, team, work, hierarchy, and memory scope?

The request receives already-computed deterministic readouts:

- `snapshot`: agent, hat assignment, org, project, team, work item, supervisor.
- `readout`: lifecycle phase, legal options, vetoed options, trace.
- `metrics`: deterministic scoped metric blocks.
- `promptFlows`: hat-filtered prompt-flow tasks and vetoes.
- `hierarchy`: hat-filtered hierarchy, mission, priority items, blockers.
- `observedAt`: the same observe timestamp.

This keeps the context builder open for extension. Real adapters can read
Cockroach, frontmatter-db, Hindsight, graph stores, and LGTM projections without
putting vendor code into `observe.ts`.

The current first implementation provides
`createDeterministicContextPackBuilder(...)` in
`packages/application/src/context-pack-builder.ts`. It is still adapter-neutral:

- `ContextPackHatCommunicationBriefPort` supplies the active hat's
  communication brief before synthesis. The default pure provider derives it
  from the active hat definition and domain supervisor-communication policy, but
  tenant or department policy can replace the port without changing
  `observe.ts`. The resulting `HatCommunicationBrief` is a required context item
  with `graph_node` pointers to the current hat and supervisor hat plus a
  `policy` pointer to the hat-communication-brief policy. It is the
  deterministic "how to ask for help" layer: a director deciding on a blocker
  sees its duty and supervisor route, and an implementer sees the same generic
  path for blockers, decisions, resource needs, reviews, risks, and improvement
  suggestions. When organization scope is known, hat graph pointers use the
  canonical `graphNodeId(organizationId, GraphNodeKind.Hat, hatId)` contract
  rather than raw hat ids. The default provider resolves the supervisor target
  from a hat catalog, so the displayed supervisor level comes from the target
  hat definition instead of an inferred one-level-up guess.
- `ContextPackDocumentReadPort` performs scoped markdown/document retrieval.
- `ContextPackDocumentFocusPolicyPort` runs before document retrieval. It is the
  application-level seam that translates a hat, lifecycle phase, and scope into
  typed query focus: extra query terms plus preferred document types. The default
  policy prefers BRDs, architecture, ADRs, policies, and decision records for
  management blocker contexts, and prefers specs, runbooks, architecture, ADRs,
  and BRDs for implementer execution contexts. This keeps director and manager
  packs from depending on accidental lexical overlap when they need governing
  context for complex decisions.
- `ContextPackLifecycleAnchorPort` loads first-class lifecycle anchors from the
  current organization state before graph traversal or model synthesis. The port
  is generic application vocabulary: discussions, decisions, quality-gate
  evaluations, schedule blocks, and supervisor signals become deterministic
  context items with typed source pointers, optional omissions, and graph root
  seeds. Schedule source pointers carry assigned agent/hat-assignment
  provenance and supervisor-signal source pointers carry target hat-assignment
  provenance so the builder can enforce the active hat boundary even when a
  custom adapter returns generic `ContextPackItem`s.
  `createCockroachContextPackLifecycleAnchorPort(...)` is the production
  Cockroach adapter, but application code only depends on this port.
- `ContextPackInboxAnchorPort` loads per-hat inbox anchors before graph
  traversal or model synthesis. Inbox anchors are distinct from lifecycle
  anchors because a hat inbox is target-hat scoped first and may explain why the
  hat woke up even when it is not itself a work lifecycle record. The builder
  validates typed `inbox_anchor` source-pointer target hat assignment and
  optional target agent provenance, then exposes accepted inbox items in the
  active-work attention lane and as graph root seeds.
  `createCockroachContextPackInboxAnchorPort(...)` is the production Cockroach
  reader over `agentic_org_context_pack_inbox_anchors`; application code only
  depends on the generic port.
- `GraphStoreReader` optionally adds typed graph neighborhoods.
- `ContextPackMemoryRecallPort` optionally adds Hindsight-style memory pointers.
  The default memory adapter does not trust provider order blindly. It derives a
  typed similarity category for every recalled memory, ranks by similarity before
  applying the `maxMemories` budget, then breaks ties by newest retained
  timestamp and stable memory id. Unless a caller supplies an explicit confidence
  override, memory confidence is derived from the same category so same-hat
  same-work memories can bound synthesis more strongly than same-project
  neighboring-work memories. This is the lightweight context-pack fallback; the
  richer MemoryEnvelope path still owns KPI, utility, retention-state, and
  archive-floor weighting when those governance rows are available.
- `ContextPackEphemeralSynthesisPort` optionally summarizes deterministic
  material without becoming source of truth. The default model-backed adapter is
  `createModelBackedContextPackSynthesisPort(...)`, which depends only on the
  generic `ChatCompletionPort`.
- `ContextPackAdvisoryPromotionPolicyPort` optionally runs after grounded
  synthesis admission. It receives cloned active scope, deterministic evidence,
  admitted advisory items, omissions, and the curation plan. The default policy
  requires a hat-curated promotion decision with the same scope and a stable
  advisory fingerprint: item kind, sorted citation refs, sorted source-pointer
  keys, and a hash of the advisory summary. The lifecycle blocker text comes
  from the approval decision, not from model prose.
- `observe-act` can author advisory-promotion decisions for visible scoped
  context-pack advisory items. The flags
  `--context-advisory-promotion-item <context-item-id>`,
  `--context-advisory-promotion-status approved|revoked`, and
  `--context-advisory-promotion-blocker <text>` resolve the item from the
  current context pack, reject non-`synthesis_gap_hypothesis` items, derive the
  fingerprint with `contextPackAdvisoryPromotionFingerprint(...)`, carry
  evidence refs from the admitted item, and dispatch the existing
  `AuthorContextPackAdvisoryPromotionDecision` command through the command
  pipeline. Hat id, hat assignment, organization, project, team, work item, and
  curation profile come from the active observe snapshot and curation plan; they
  are not user-entered fingerprint or scope strings. The observe screen also
  renders each visible synthesis-gap candidate with its curation profile,
  derived fingerprint, citations, source-pointer keys, and command evidence refs
  so the wearer can approve or revoke the exact candidate that the deterministic
  policy will later match. When the advisory-promotion decision read side is
  wired, the screen uses the same scoped `listForPromotion(...)` admission reader
  to label candidates as `status=approved` with the durable decision id and
  lifecycle blocker, or `status=not_approved` when no current matching approval
  is returned. Without that loader, candidates render `status=unknown`.
  Revoked decisions intentionally do not render as `revoked` through this
  admission read path; a revoked row suppresses approval and therefore appears
  as not approved until a separate audit/workflow reader is added.
- `ContextPackCompletenessPolicyPort` marks missing required context as an
  explicit omission instead of letting absent BRDs, CAs, ADRs, decisions, or gate
  evidence disappear silently. Policy ports receive cloned request,
  document-unit, and item snapshots; mutating the request object cannot add,
  remove, or rewrite final pack evidence or scope.
- `createDefaultContextPackCompletenessPolicy(...)` is the first company policy
  implementation. It requires management hats handling blocked work to have
  business, architecture, policy, and graph-neighborhood context before the pack
  can be considered complete.
- `ContextPackCurationIntentPolicyPort` selects the hat-and-moment document
  focus and base attention profile before scoped document retrieval. The same
  decision drives retrieval query terms, preferred document types, lane
  priority, required advisory lanes, and deterministic instructions, so
  tenant-curated hats retrieve the evidence their final profile will need. The
  default policy derives both values from typed active-hat attributes. Tenant
  policy layers durable overrides at this boundary. The sibling
  `ContextPackCurationProfilePolicyPort` remains available for optional
  post-retrieval, evidence-dependent profile refinement, but it cannot add
  evidence.
- `graphRootNodeIds` lets production composition seed graph traversal from work
  items, initiatives, decisions, meetings, traces, and gates before document
  expansion.
- `graphRootSeeds` is the richer production path for hat-aware roots. It carries
  node id, title, citation refs, and reasons so a director pack can distinguish
  project trajectory context from initiative priority, work-item lifecycle, hat
  authority, mission-management, and organization-runtime context.
- Every external context-pack callback receives a defensive request snapshot, not
  the live `observe.ts` request object. Hat-communication, lifecycle-anchor,
  graph-root, completeness-policy, and synthesis adapters can be vendor-backed or
  model-backed, but they cannot mutate the final observed agent, hat assignment,
  organization, project, team, work item, curation trace, or evidence envelope.
  Graph document-root callbacks also receive cloned `DocUnit` evidence, so they
  cannot rewrite retrieved markdown status or scope before stale-input and
  completeness checks run. Returned data is still validated against the original
  active scope before the pack is accepted.
- Ephemeral synthesis receives the specific hat level, scope, lifecycle phase,
  agent id, organization, project, team, work item, bounded deterministic items,
  omissions, existing contradictions, bounded legal observe actions, typed
  uncertainty signals, and a deterministic curation plan with the selected
  curation profile. The builder snapshots and clones this input before calling
  the synthesis port; adapter mutations cannot become deterministic evidence and
  cannot alter the persisted curation plan. The
  synthesis grounding set is also active-scope filtered: wrong-project or
  wrong-team documents may remain visible as retrieved context, but they cannot
  ground synthesis briefings, advisory items, or curation-trace evidence. Graph
  and lifecycle items can ground synthesis only when their `doc:` citation refs
  resolve to active-scope documents and every DocUnit source pointer is
  active-scope, so a wrong-scope markdown cannot launder authority through a
  related graph node or lifecycle anchor. The plan is the bridge between
  deterministic retrieval and agentic synthesis: it gives the model explicit
  attention lanes for authority/communication, required source-of-truth
  documents, active work scope, graph neighborhoods, memory,
  omissions, and legal actions. Each lane has a priority, required/advisory
  status, objective, and typed refs to context items, omissions, legal actions,
  or scope anchors. The same plan is persisted on the context pack, so dashboards, snapshots,
  self-healing loops, and post-run reviews can replay why the agent was asked to
  attend to those lanes. The model therefore receives more than a flat list of
  items; it receives a hat-specific map of what matters first and why. It can
  produce a hat-specific briefing, ranked context refs, gap hypotheses,
  follow-up questions, and recommended action refs. The builder admits advisory
  outputs only when they cite
  deterministic evidence refs already present in the pack. A recommended action
  ref must also bind to an action type that is legal in the current `observe.ts`
  readout. Because the communication brief is already inside the deterministic
  item set and highlighted in the authority lane, synthesis may cite it when
  recommending an escalation, question, resource request, review request, or
  improvement route, but it cannot invent a communication path that the hat
  policy did not expose.
- `ContextPackUncertaintySignal` is metadata over admitted deterministic refs,
  not a source of new evidence. The builder derives the first signal categories
  from active-scope synthesis grounding items and retrieval conflicts:
  `stale_evidence`, `conflicting_evidence`, `low_confidence_evidence`, and
  `indirect_evidence`. Hindsight memory pointers now carry a typed
  `ContextPackMemorySimilarityCategory` derived from sticky creator attribution
  versus the recall request: same-hat same-work, same-work, same-hat
  different-work, same-project different-work, project-scoped, or cross-project.
  The category is explanatory metadata on the `hindsight_memory` pointer and in
  the indirect-evidence uncertainty message; active-scope replay still relies on
  the existing recall and creator attribution fields. The model-backed adapter
  renders these signals as deterministic bounds; it may explain or ask about
  them, but it may not resolve them by model judgment. When a synthesis briefing
  or advisory is admitted, its `confidenceBasis` preserves only the uncertainty
  signals that intersect the cited deterministic items, so replay can show why
  the agentic summary stayed bounded.

The application code depends on those generic ports, not on a Cockroach,
Hindsight, OpenTelemetry, or Kubernetes client. Production composition should
wire vendor-specific adapters outside the application package.

### Deterministic Attention Lanes

`ContextPackAttentionLaneKind` is intentionally small and generic. It is not a
database schema and it is not a prompt trick; it is organization policy expressed
as reusable application vocabulary:

- `authority`: active hat duty, supervisor route, upward tools, and evidence
  protocol.
- `required_documents`: approved BRDs, CAs, ADRs, policies, decision records,
  and other source-of-truth documents needed for this state.
- `active_work`: current run, organization, project, team, work item, and scope
  anchors, plus lifecycle items already tied to that work such as decisions,
  discussions, meetings, quality gates, supervisor signals, and evidence.
- `graph_neighborhood`: dependencies, decisions, meetings, traces, quality
  gates, discussions, and blast-radius nodes reachable from active roots.
- `memory`: Hindsight memory pointers scoped to agent, hat assignment, project,
  team, work item, and prompt-flow run. This lane is advisory by default.
- `omissions`: missing, stale, denied, unindexed, contradicted, or failed context
  retrieval.
- `legal_actions`: observe actions that the current hat can legally consider.

Lane refs are typed as `item`, `omission`, `legal_action`, or `scope_anchor`.
This avoids mixing replayable document/memory/graph items with synthetic action
or scope strings. When model-backed synthesis is enabled, the prompt renders the
lane map plus bounded per-lane details so a lane-critical item can still be
visible even when the global evidence list is capped.

Required lanes are context gates, not decorative grouping. If the computed
curation plan marks a lane required and that lane has no refs, the builder emits
a `required_curation_lane:<lane>` omission and the observe surface treats the
pack as incomplete. This applies to default required lanes such as
`required_documents`, not only profile-specific overlays. A director, manager,
reviewer, or implementer should never receive a "current" pack merely because
the active hat brief exists while the source-of-truth document lane is empty.
The omission is intentionally generic: it says the organization failed to admit
enough context for the hat and moment, while more specific completeness policies
can add BRD/CA/ADR/policy/graph requirements on top.

The agent-facing `observe-act` dashboard and selector prompt also render the
same attention lanes. This matters because the context pack is not only a hidden
retrieval object; it is the hat-holder's working map. A director or manager can
see which required documents, memories, omissions, legal actions, and scope
anchors were made salient, while the model-backed menu selector receives the
same bounded lane summary and lane-detail block before choosing a legal observe
action. Lane details resolve typed refs back to item titles, omission messages,
legal actions, or scope anchors, so lane-critical optional memory or omitted
context can remain visible even when required context items are capped. The UI
layer formats the existing pack contract only; it does not invent lanes or
mutate readiness.

The planner emits deterministic instructions with the lanes:

- rank required documents and active graph context before advisory memory;
- use the hat communication brief to keep escalation and requests on the
  supervisor chain;
- convert omissions and contradictions into explicit questions or lifecycle
  blockers instead of inventing facts;
- recommend only actions present in the legal observe action lane.

This is the core answer to the director-context problem. A director deciding a
complex blocker should not rely on general intelligence guessing what matters.
The organization should assemble a reproducible, hat-scoped attention map from
the work state, indexed markdown, graph roots, memories, omissions, and policy,
then let model-backed synthesis operate inside that map.

### Stage 0.5: Document Focus Before Retrieval

Before the builder asks the document adapter for context, it resolves a
`ContextPackDocumentFocus` from the active hat and moment. This is intentionally
earlier than the curation profile: the focus policy changes what the scoped
retrieval pipeline is asked to consider, while the curation profile changes how
assembled evidence is presented after retrieval, graph traversal, memory recall,
and lifecycle anchors have already run.

The focus contract is generic application vocabulary:

```ts
type ContextPackDocumentFocus = {
  profileId: string;
  policyVersion: string;
  queryTerms: readonly string[];
  preferredDocTypes: readonly DocType[];
};
```

The retrieval adapter still owns only retrieval. It receives
`preferredDocTypes` in `RetrievalContext`, applies a small deterministic ranking
boost inside the already-legal scope, and reports `preferredTypeBoosts` in
diagnostics. It does not know what a director, TPM, reviewer, or implementer is;
those decisions stay in the policy port. This preserves SOLID boundaries:
company policy selects document focus, retrieval ranks scoped documents, and
Cockroach remains only the corpus loader.

The selected focus is also written into the pack's curation trace as the
`document_focus` stage. That stage records the focus profile id, policy version,
preferred document types, and query focus terms. A dashboard or replay agent can
therefore answer why a director blocker pack preferred BRDs, architecture, ADRs,
policies, and decision records before model synthesis saw the pack.

The production `observe-act` CLI now wires that builder in its composition root.
`resolveAgentCliProductionRuntime(...)` creates a `ContextPackBuilderPort` from:

- `createCockroachContextPackDocumentPort(...)`, which reads scoped active
  `DocUnit`s from Cockroach, adds hat/stage-bound consult docs through the
  indexed `listBoundConsults` store method, and can load canonical document
  entities through `createCockroachDocEntityStore(...)` so production retrieval
  preserves alias/entity anchoring rather than falling back to lexical-only
  matching. It also consumes the generic
  `ContextPackDocConsultOutcomeReaderPort` implemented by
  `createCockroachDocConsultLedgerStore(...)`, so the Stage 6 utility rerank can
  learn from scoped consult outcomes without coupling the retrieval pipeline to
  Cockroach;
- `createCockroachGraphStore(...)`, which supplies work/doc graph neighborhood
  traversal;
- `createMemoryContextPackRecallPort(createCockroachMemory(...))`, which adapts
  the generic `Memory` port into advisory context-pack memory pointers while
  preserving the original memory author and hat assignment, or returns explicit
  memory-scope omissions when recall cannot be meaningfully scoped;
- deterministic graph roots for organization, project, team, hat, work item,
  initiative priority items, and management missions, using the canonical
  `graphNodeId(organizationId, kind, sourceKey)` contract from the domain graph.
- the default completeness policy, so director/manager blocker packs explicitly
  report missing BRD/business context, CA/ADR/architecture context, governing
  policy, or graph neighborhood context instead of silently letting a
  high-stakes decision proceed with an underfed dashboard.
- optionally, model-backed ephemeral synthesis when
  `AGENTIC_ORG_CONTEXT_SYNTHESIS_LLM_BASE_URL` and
  `AGENTIC_ORG_CONTEXT_SYNTHESIS_LLM_MODEL` are configured. If those are not
  set, production falls back to `AGENTIC_ORG_LLM_BASE_URL` and
  `AGENTIC_ORG_LLM_MODEL`. If neither pair exists, synthesis can be absent only
  when the synthesis-requirement policy allows deterministic-only operation. If
  the policy requires synthesis, such as a wake-requested context build or the
  default blocked management context, the pack records an explicit
  `ephemeral_synthesis:required_unavailable` omission and the curation plan
  marks `ephemeral_synthesis` as required.

### Wake And Reassignment Refresh

`observe-act` now evaluates the previous context pack before building and
recording the next one. Production uses
`ContextPackSnapshotStorePort.latestForScope({ organizationId, agentId })` to
ask what this agent last saw, then applies the application-level
`decideContextPackRefresh(...)` policy. The policy classifies the wake as:

- `first_hat_wake`: no previous snapshot exists for the agent;
- `hat_assignment_changed`: the same agent now holds a different hat assignment;
- `hat_changed`: the hat id changed under the same assignment;
- `scope_changed`: organization, project, team, work item, run scope, or agent
  changed;
- `previous_expired`: the previous pack's freshness deadline has passed;
- `previous_not_current`: the previous pack was incomplete, missing, stale, or
  conflicted;
- `reusable`: the previous pack is current and still matches the active hat,
  assignment, agent, and scope.

The decision is emitted into observe-act cycle evidence as
`contextRefreshReason`, `contextRefreshRequiresBuild`, and
`previousContextPackId`, plus the previous pack status when one exists.
Production observe-act ticks persist matching evidence refs such as
`observe-act:context_refresh_reason:*`,
`observe-act:context_refresh_policy_requires_build:*`, and
`observe-act:previous_context_pack:*`, so a dashboard or agent can tell whether
a director/manager briefing was rebuilt because of first wake, reassignment,
scope drift, expiration, or a stale prior snapshot. The current implementation
still builds a fresh pack on each observe tick, which keeps the runtime
conservative while the platform is young. The refresh decision makes that
rebuild explainable and gives future optimization work a safe, typed place to
decide when a prior pack can be reused or when a hat wake must force a full
retrieval/synthesis pass.

If the previous-pack lookup fails, `observe-act` fails closed and production
persists `observe-act:failure:context_refresh_lookup_failed` before exiting.
That keeps context infrastructure outages visible to the same event stream that
drives dashboards and agent self-healing.

Production root derivation is deterministic and bounded. The current order is:
current work item, management mission, active hat, current project, scoped
initiatives, team, organization, scoped projects, then hierarchy priority-item
spillover. Hierarchy projects, initiatives, and priority items are capped per
category before graph traversal. The cap is not a product limit; it is an
attention-safety rail so executive/director contexts stay reproducible while
future retrieval policy learns better ranking.

This means a real agent process no longer wakes up with
`builder_unavailable` merely because it is using the production runtime. Missing
documents or graph projections can still make the pack incomplete, but that
absence is now visible as context state instead of infrastructure silence.

The default completeness policy is intentionally narrow: it currently applies to
management-level hats (executive board, C-suite, director, manager) when the run
is blocked at work-item, initiative, project, or organization scope. It does not
force an individual contributor's normal execution loop to carry director-level
portfolio context. Future tenant and department rules should extend the same
policy registry rather than hardcoding new checks into `observe.ts`.

Completeness is source-aware, not just item-kind-aware. A hat-bound or
stage-bound document may be included in the pack because it is useful context,
but it only satisfies a required management blocker consult when its
`doc_unit` source pointer resolves to an active scope for the current snapshot:
organization, department, project, or team. This prevents a random BRD,
architecture note, or policy for another project from making a director's
blocked-work pack look complete. Graph context follows the same rule: a graph
neighborhood only satisfies the required graph consult when it is rooted in the
active work item, project, team, hat, initiative, hierarchy-priority work item,
or organization node.

The current document ontology does not yet have `initiative` or `work_item`
document scopes. Until that schema slice lands, work-item and initiative context
is represented by project/team/department/organization documents plus graph
roots, discussions, decisions, quality gates, and memory pointers tied to the
work item or initiative.

The observe surface must degrade instead of disappearing. If a builder is not
configured, throws during retrieval, or returns a pack for the wrong run, scope,
hat assignment, hat, agent, organization, project, team, or work item,
`observeAgentSurface` returns an explicit degraded context pack with an omission
reason. A returned pack is only `current` when it has no omissions,
contradictions, stale inputs, stale/archived items, expired freshness deadline,
or empty item set.

The CLI selector receives a bounded decision surface: selectable slots plus the
context pack status, required context summary, omission count, and scoped
metrics. That keeps autonomous selection connected to the same context that is
rendered and persisted as observe-act evidence. Production observe-act also
uses the context status as a deterministic readiness gate: when the production
runtime enables `enforceContextReadiness`, lifecycle work slots in the commit
bank are darkened when the context pack is missing, incomplete, stale, or
conflicted. This does not mutate the underlying lifecycle readout. It only
prevents the current hat from dispatching work from an underfed dashboard while
leaving refresh, status, scope navigation, history, rest, and supervisor
escalation paths reachable. Lightweight local/test surfaces may omit this flag
when they intentionally exercise the lifecycle grammar without full context
infrastructure.

## Provenance Contract

Every `ContextPackItem` must be backed by retrievable provenance. The first
implementation slice keeps the compact `sourceRef` for rendering and also adds
typed `sourcePointers` for replay and audit. Supported pointer kinds include:

- `doc_unit`: document unit id, content ref/hash, source id, version, and
  optional provenance change set; builder-produced pointers also carry
  organization id, document type, scope kind, and scope id so policy and audit
  readers can prove why a document was considered active-scope context;
- `git_blob`: path, commit sha, and blob sha when the markdown git index is the
  direct source;
- `graph_node` and `graph_edge`: graph ids needed to replay traversal;
- `hindsight_memory`: provider id, memory id, creating agent/hat assignment,
  original project/work/prompt-flow run, current recall agent/hat/project/work
  scope, recall query id, and advisory/required classification;
- `work_item`, `decision`, `discussion`, `meeting`, `quality_gate`,
  `schedule_block`, `supervisor_signal`, `trace`, and `policy` pointers for
  lifecycle evidence that is not represented as a markdown doc unit. Meeting
  pointers are derived from scoped meeting schedule blocks until a dedicated
  meeting aggregate exists; they keep the companion `schedule_block` pointer so
  active hat assignment remains the authority boundary.
- `hat_communication_brief` items use `graph_node` pointers for the active hat
  and supervisor hat and a `policy` pointer for the generated communication
  protocol. The graph pointers are canonical graph node ids when organization
  scope is available. This lets the UI and future self-healing agents show
  whether an agent knew how to route a blocker, question, resource need, review
  request, risk, or process improvement before it acted.
- `schedule_block` and `supervisor_signal` lifecycle items must be internally
  consistent. If a custom lifecycle adapter returns a schedule-looking item, it
  must include a `schedule_block` source pointer with assigned hat-assignment
  provenance. If it returns a supervisor-signal-looking item, it must include a
  `supervisor_signal` source pointer with target hat-assignment provenance.

Agents must be able to traverse from any context item back to the original
document, graph neighborhood, discussion, memory, or trace. Summaries are useful
for attention; typed source pointers are the audit trail.

Lifecycle adapter output is still checked by the builder. A lifecycle context
item is admitted only when it carries a lifecycle source pointer and a work-item
pointer for the active observed work item. If the active work scope is absent,
or if an adapter returns a lifecycle item for another work item, the item is
omitted as out of scope and any graph root seed that only came from that item is
dropped. That keeps production adapters replaceable without making the
application layer trust them blindly. The generic in-memory contract also treats
null-team lifecycle rows as broader work-item anchors, so team-scoped agents do
not lose work-item decisions or discussions simply because those records were
not assigned to a specific team. Supervisor signals are additionally scoped to
the active target hat assignment; a signal for a different current wearer of a
different hat assignment cannot become required context for this agent.
Schedule anchors have the same wearer boundary: their source pointers must
carry the active assigned hat assignment, and, when present, the assigned agent
must match the observed agent. A custom lifecycle adapter can return generic
`ContextPackItem`s, but it cannot bypass this application-level provenance gate
by labeling schedule or supervisor-signal context as a generic lifecycle item.

`observe-act` evidence persists context pack identity, source graph version,
policy version, curation stages, required item ids, and source pointer refs.
This is how the UI and future self-healing agents can replay why a director,
TPM, reviewer, or implementer saw the context they saw.

The full context readout is also persisted through the generic
`ContextPackSnapshotStorePort`. The application layer only knows that a
snapshot can be recorded, fetched by context-pack id, or fetched as the latest
snapshot for a scope. The production adapter is
`createCockroachContextPackSnapshotStore(...)`, backed by the
`agentic_org_context_pack_snapshots` table. It stores the complete
`ContextReadout` JSON plus denormalized organization, hat assignment, agent,
project, team, work item, status, graph version, policy version, recorded time,
and trace ids. That gives three replay paths:

- exact replay by `contextPackId`;
- latest replay for a director/manager/agent scope;
- timeline reconstruction by joining observe-act events, context-pack snapshot
  rows, source pointers, graph nodes, documents, discussions, decisions, and
  traces.

`observe-act` records this snapshot immediately after `observeAgentSurface(...)`
returns and before rendering the screen, selector choice, model-backed menu
selection, MCP/tool dispatch, or command execution. The snapshot includes the
current lifecycle phase so durable replay can answer which state produced the
context pack. If snapshot persistence fails, the CLI fails the cycle with an
explicit
`agent CLI context-pack snapshot record failed` error instead of letting the
organization believe the decision surface was durable when it was not.

Snapshot recording is also the right moment to write the document consult
ledger. A document becomes "consulted" when it was present in the context pack
shown to the agent, not when retrieval merely considered it. The application
therefore derives consult facts from `ContextReadout.pack.items` and their typed
`doc_unit` source pointers, then sends them through a generic
`ContextPackDocConsultLedgerPort`. Cockroach is only the durable adapter.

The V0 implementation lives in
`contextPackDocConsultRecordsForSnapshot(...)`,
`createContextPackSnapshotRecorder(...)`, and
`createCockroachDocConsultLedgerStore(...)`. It extends the existing
`agentic_org_doc_consult_ledger` table through V28 rather than creating a
parallel table, and V29 adds replayable phase to context-pack snapshots. In
production, `createContextPackSnapshotRecorder(...)` runs the snapshot write and
consult-ledger writes inside one Cockroach transaction. That preserves the
"consulted means shown" contract: if any consult row fails, the snapshot also
rolls back and the CLI does not render the pack.

One consult record is written per shown document unit, version, and content hash
in a context pack. The deterministic `docConsultId` is a SHA-256 over the
structured tuple instead of a delimiter-joined string, so ids are stable across
retries without delimiter collisions. If multiple context items expose the same
document, the record aggregates the context item ids, source refs, reasons,
required flag, and least-fresh freshness signal. This prevents synthesis or
advisory echoes from inflating consult counts while preserving every item that
made the document visible.

The V0 consult fact is intentionally small and replayable:

- context pack id, run id, organization id, recorded time, and trace ids;
- active hat id, hat assignment id, agent id, project/team/work scope;
- aggregated context item ids, source refs, required/advisory flag, freshness,
  and reasons;
- doc unit id, doc type, doc scope, content ref/hash, source id, and version;
- outcome history is append-only in `agentic_org_doc_consult_outcomes`. The
  consult row remains the durable "shown context" fact; later lifecycle events
  join back by writing separate outcome facts keyed by
  `(doc_consult_id, outcome_ref)`. Accepted quality-gate evaluations, observe
  lifecycle transitions, and typed business-validation decisions emit
  `ContextPackDocConsultOutcomeStamp` effects, and Cockroach command persistence
  applies those stamps in the same transaction that records the command outcome.
  Business-validation decisions use `business_validation:<decisionRecordId>`
  refs so non-gate Product/BA decisions can teach the consult ledger without
  pretending to be quality gates.

This gives the Organization a durable answer to "which documents did this
director actually see before deciding?" and gives the utility-rerank loop the
join it needs. Retrieval remains pure and consumes aggregate consult outcomes
through `RetrievalDeps.consultOutcomes`. The Cockroach adapter now exposes
`loadOutcomeCounts(...)` through the generic
`ContextPackDocConsultOutcomeReaderPort`; it reads the append-only outcome table,
groups known quality-gate and change-control outcomes by document unit,
classifies approved/waived/approved stage/business-validation outcomes as utility success,
classifies rejected/change-request outcomes as utility failure, and ignores
unknown outcomes until policy explicitly names them.
`createCockroachContextPackDocumentPort(...)` calls that reader with the active
organization, hat, stage, project, and team scope, then merges the result into
the retrieval dependencies before `runRetrieval(...)`. The consult rows still
record the exact work item for replay and audit, but the default utility lookup
does not filter to the current work item. This lets a new blocker benefit from
historically useful documents for similar work instead of cold-starting every
ticket. Exact work-item aggregation is still available through
`ContextPackDocConsultOutcomeAggregationScope.ExactWorkItem`; callers must ask
for it explicitly and must provide `workItemId` so a "similar work" ranking path
cannot pretend to be exact. Malformed exact requests fail closed to an empty
utility result instead of widening to similar-work history.

Quality-gate outcome stamping is now part of the normal durable command path.
The application handler emits generic
`CommandEffects.docConsultOutcomeStamps`, and the Cockroach command-state store
uses `ContextPackDocConsultOutcomeWriterPort` inside the existing transaction.
The stamp is scoped by organization, project, team, work item, evaluating agent,
hat assignment, outcome ref, and recorded time; the writer copies the matched
consult row's context-pack id, run id, stage, hat, actor, and trace provenance
into `agentic_org_doc_consult_outcomes`. This prevents a reviewer, director, or
manager from training document utility on another hat's context pack merely
because the work item is shared. Replayed commands upsert only the same
`outcome_ref`; distinct gate outcomes remain separate history rows instead of
overwriting one another. If a command emits a doc-consult outcome stamp and no
consult rows match, command persistence returns a typed effect conflict rather
than silently committing an unlearnable gate.
Future context packs can therefore promote documents that preceded approved or
waived gates and demote documents that preceded rejected or change-request gates.
Observe lifecycle transitions now use the same generic outcome-stamp port:
accepted `complete` actions stamp consulted documents with the change-control
`approve` outcome, and accepted `rework` actions stamp them with
`request_changes`. These stamps are keyed by the resulting work-state
transition id, so successful completion and review-bounce learning ride through
the same Cockroach command-state transaction as the work-item transition. The
remaining write-side extension is non-quality-gate business validation events
that should join back through the same generic outcome-stamp port.

`observe.ts` will not mark a non-empty pack as `current` unless its items carry
replayable provenance and the pack proves the minimum deterministic curation
stages: deterministic scope, required consult, and gap review. Ephemeral
synthesis may add advisory items only when it cites deterministic context item
refs. Model text does not directly add lifecycle blockers or contradictions;
deterministic policy must promote any advisory gap into status-affecting state.
The observe surface also rechecks item-level provenance before status
calculation. A builder may return a pack whose top-level project, team, and work
scope matches the snapshot, but if an item contains a wrong-scope DocUnit,
work-item, schedule-block, or supervisor-signal source pointer, `observe.ts`
appends an `out_of_scope` omission and lifecycle blocker, preserves the pack for
UI replay, and reports the context as incomplete.

## Hat Wake-Up Context Lifecycle

A context pack is rebuilt when an agent wakes under a hat for the first time,
when the hat assignment changes, when the hat changes, when the observe scope
changes, when the prior pack expires, or when the prior pack was not current.
That wake reason is not only audit evidence. It is now part of the
`ContextPackBuildRequest` as `wakeContext`, so deterministic retrieval and
ephemeral synthesis can curate differently for a first wake than for a routine
refresh. When `wakeContext.requiresBuild` is true, the default synthesis
requirement policy marks ephemeral curation required; missing model-backed
curation becomes a replayable omission instead of an invisible deterministic-only
fallback.

The lifecycle is:

1. **Wake decision**: `observe-act` looks up the latest durable context-pack
   snapshot for the agent and organization, then computes a refresh reason.
2. **Deterministic envelope**: `observe.ts` builds the hat, lifecycle, schedule,
   hierarchy, prompt-flow, metric, legal-action, and wake-context envelope.
3. **Scoped retrieval**: the builder derives curation intent, document focus,
   retrieval scopes, lifecycle anchors, graph roots, memory recall scope, and
   required lanes from that envelope.
4. **Ephemeral curation**: the model-backed curator receives the wake reason,
   previous context id/status, bounded deterministic evidence, omitted context,
   contradictions, legal actions, and curation plan. It may summarize, rank,
   question, and recommend legal actions only against admitted evidence.
5. **Sufficiency verdict**: required lanes, completeness policy, contradictions,
   stale inputs, and provenance validation decide whether the pack is `current`
   or incomplete/conflicted/stale.
6. **Durable snapshot**: the exact pack shown to the agent is persisted before
   action selection or tool execution.
7. **Invalidation and learning**: later work outcomes attach to the consult
   ledger; future wake decisions use those outcomes plus expiration/status to
   decide whether to rebuild.

This is the context answer to reassignment. When a director hat moves from one
agent to another, the new wearer does not inherit a vague prompt. It receives a
fresh, replayable map of the current organization state, why the previous pack
cannot simply be reused, which documents and graph neighborhoods were admitted,
which memories were advisory, and which required lanes are missing.

## Curation Pipeline

### Stage 1: Deterministic Scope

Derive the legal query envelope from the hat and work state:

- organization, department, project, initiative, work item, task, run;
- hat level, department, allowed tool bundles, and supervisor chain;
- current lifecycle phase and prompt-flow phase;
- priority scope from `hierarchyReadoutForHat`;
- schedule block and meeting context.

This stage decides what may be considered. It should use typed enums and policy
ports, not stringly search filters.

### Stage 2: Required Consult

Load documents that must be consulted for the phase:

- BRD for business requirements;
- CA, ADR, design docs for architecture;
- active company policies and department standards;
- prompt-flow phase handbooks;
- quality gate history and acceptance criteria;
- meeting or decision records tied to the work item or initiative.

Required consults are deterministic. The agent cannot simply forget them.

### Stage 3: Lifecycle Anchors

Load deterministic lifecycle anchors for the current hat and work scope. The
current production slice is active-work-item keyed:

- discussion anchors tied to the active work item, including both team-specific
  anchors and broader work-item anchors with no team assignment;
- decision records that explain what was already decided and who approved it;
- quality-gate evaluations, including reproduced defects and sign-off outcomes;
- schedule blocks that allocate the agent or hat assignment to meetings,
  reviews, focused work, reflection, or other work time.
- first-class meeting anchors derived from scoped meeting schedule blocks, with
  typed `meeting` provenance and semantic `meeting` graph roots while the
  companion `schedule_block` pointer remains the assignment authority check;
- supervisor signals that carry blocker reports, questions, review requests,
  risk reports, resource requests, and improvement suggestions through the
  supervisor chain to the current hat assignment.

Lifecycle anchors are not markdown search results and they are not memories.
They are organization-state facts. The context pack builder inserts them before
ephemeral synthesis, adds them to the active-work attention lane, and uses their
graph node ids as graph traversal roots. This is the piece that lets a director
facing a blocker see the actual meeting, decision, gate, and schedule context
around the blocker instead of a generic document dump.

The application exposes this through `ContextPackLifecycleAnchorPort`. The
in-memory implementation is test support and a contract example. Production
`observe-act` wires `createCockroachContextPackLifecycleAnchorPort(...)`, which
queries Cockroach-backed lifecycle tables by active organization, project, work
item, optional team, current agent, and hat assignment while preserving the same
generic port. The adapter includes null-team work-item anchors alongside
team-specific anchors, scopes schedule blocks to the current agent/hat
assignment, and scopes supervisor signals to the current target hat assignment.

### Stage 3.25: Inbox Anchors

Inbox anchors are deterministic wake-up context for the currently worn hat. They
answer a different question from lifecycle anchors: not only "what happened
around this work item?", but "what did this hat receive that made this briefing
necessary?" The application exposes them through `ContextPackInboxAnchorPort`.

The builder admits an inbox item only when its typed `inbox_anchor` source
pointer targets the active hat assignment, its optional target agent matches the
active agent, and any work-item provenance does not contradict the active work
scope. Accepted inbox anchors become first-class `inbox_anchor` context items,
active-work attention-lane refs, and semantic graph root seeds. Rejected inbox
items become explicit out-of-scope omissions, and their graph roots are dropped.
Work-item provenance is optional for inbox anchors; when it is absent, the
builder keeps the item hat-scoped and does not manufacture a fake `work`
citation or source pointer.

The first application adapter is in-memory for tests and composition. Production
`observe-act` also wires `createCockroachContextPackInboxAnchorPort(...)`, which
reads `agentic_org_context_pack_inbox_anchors` by organization, project, target
hat assignment, optional current agent, and optional team widening. The SQL
reader excludes dismissed anchors, does not require active work scope, allows
nullable work-item provenance, and drops malformed priority/status rows before
they can become context. The port deliberately stays separate from
`ContextPackLifecycleAnchorPort` so inbox entries can support hat-assignment
wake context, non-work subject anchors, defer/visible states, and interruptible
priority without weakening stricter lifecycle validation around decisions,
gates, meetings, schedule blocks, and supervisor signals.

Authoring is now command-owned instead of table-owned. The
`AuthorContextPackInboxAnchorCommand` creates one unread inbox anchor through the
generic command pipeline, validates typed priority and target hat assignment,
optionally validates supplied work-item scope, emits an audit event, and
persists a `contextPackInboxAnchors` command effect. The in-memory organization
store keeps those effects for local/idempotency tests, and the Cockroach command
state store writes them transactionally into
`agentic_org_context_pack_inbox_anchors` after the idempotency claim. The first
authoring slice deliberately does not emit outbox events for hat-only anchors,
because the current event-envelope contract requires `scope.workItemId` while
inbox anchors intentionally allow hat-scoped wake context without active work
provenance.

Inbox lifecycle changes are also command-owned. The
`UpdateContextPackInboxAnchorStatusCommand` reads the existing anchor, verifies
the command organization, project, optional team/work provenance, target hat,
and optional target agent exactly match the persisted wake context, and emits a
`contextPackInboxAnchorStatusTransitions` effect. Only terminal inbox statuses
(`read` and `dismissed`) are valid transition targets; `unread` remains owned by
anchor creation so commands cannot re-open stale wake reasons by rewriting the
row body. The in-memory organization store applies the status transition without
rewriting title, summary, priority, provenance, or delivery timestamp. The
Cockroach command-state store applies the transition with an
`UPDATE ... RETURNING inbox_anchor_id` statement and reports a
`ContextPackInboxAnchorMissing` effect conflict when no scoped anchor matches,
which keeps stale or cross-hat status updates auditable and non-silent.

### Stage 3.5: Runtime Evidence

Runtime evidence is deterministic enrichment, not a source of authority. The
builder can call a `ContextPackTelemetryEvidencePort` after lifecycle and inbox
anchors and before graph traversal. This lets a production adapter use validated
lifecycle items with active work provenance to discover LGTM traces, logs, and
metrics, then admit them as scoped `trace` context items. Trace/log/metric hits
never prove active scope by themselves; they must ride beside an accepted
`work_item`, `schedule_block`, `supervisor_signal`, or other scoped provenance
pointer.

`createLgtmContextPackRuntimeEvidencePort(...)` is the first implementation. It
extracts accepted `trace` source pointers from active-work lifecycle context,
queries Tempo, Loki, and Mimir through the existing `TelemetryQueryPort`, emits
typed `trace`, `log`, and `metric` source pointers, and adds semantic trace
graph-root seeds. Degraded telemetry sources become replayable omissions rather
than failing the deterministic pack.

### Stage 4: Graph Traversal

Traverse typed graph edges from work to context:

```text
work item -> initiative -> project -> mission
work item -> discussions -> decisions -> docs
work item -> affected services -> owners -> runbooks -> ADRs
work item -> traces -> failures -> evidence
```

Graph traversal must be work-rooted, not document-rooted. Documents are one
branch of context; the graph roots should also include work item, initiative,
project, discussion, decision, quality gate, trace, schedule, and meeting
anchors. The graph store supplies ownership, impact, change history,
contradictions, and staleness. This is where a director learns what a blocker
threatens.

The current graph kernel now has first-class organizational node kinds for
organization, project, initiative, team, discussion, meeting, mission, quality
gate, schedule block, decision, trace, work item, hat, and release context. Production
`observe-act` uses semantic graph root seeds rather than raw ids for the primary
organization/project/team/hat/work/initiative/mission roots. That keeps the
pack explainable: a graph neighborhood item should say why it was included, not
just expose an opaque node id.

Raw `graphRootNodeIds` remain supported as a legacy adapter path, but semantic
`graphRootSeeds` are preferred. When duplicate semantic roots point at the same
node, production composition preserves the first title while merging citation
refs and inclusion reasons, so a node can simultaneously explain project
trajectory, initiative priority, hierarchy priority, or work-item lifecycle
relevance. The deterministic builder applies the same merge rule across root
sources with this title precedence: explicit semantic roots, lifecycle
roots, document roots, then legacy raw ids. Lower-precedence collisions still
contribute citations and reasons. That means duplicate explicit semantic roots
merge their reasons and citations, while a work-rooted director context keeps
its title and still retains document or raw-id provenance when roots collide.

Synthesis grounding uses the same active graph boundary as replay validation.
Graph-only context can ground model-backed advice only when the node is an
active canonical `graphNodeId(...)` root, an active legacy/raw root, or the item
is also backed by active document or work-item source pointers. Active graph
roots include organization, active hat, active project, active team, active work
item, scoped hierarchy initiatives, and hierarchy-priority work items. A raw
legacy graph id for an unrelated project is therefore not enough to make a
director briefing current.

### Stage 5: Memory Recall

Use Hindsight and hat-scoped memory only after deterministic scoping:

- agent memories for this hat;
- prior outcomes for similar work;
- memories tagged to the project, service, or prompt-flow phase;
- performance review observations that explain known weaknesses.

Memory enters as pointers with confidence and freshness. It can suggest, but it
does not outrank verified policy, BRD, CA, ADR, or gate decisions.

The implemented production slice currently recalls from the durable
Cockroach-backed `Memory` port, whose table is the local
`agentic_org_hindsight_memory` store. The application layer only sees the
generic `ContextPackMemoryRecallPort`. The production composition root decides
that Cockroach is the current provider and labels the source
`cockroach_hindsight`, meaning Cockroach-backed Hindsight-memory table recall,
not live semantic Hindsight HTTP recall. This is intentionally narrower than
full semantic Hindsight retrieval: today it is project-scoped durable recall
with sticky original attribution. When a memory was created on a different work
item than the current request, the pack must preserve both scopes:
`requested-work:<id>` in the reason list, `creatingWorkItemId` on the source
pointer, and explicit `recallAgentId` / `recallHatAssignmentId` /
`recallProjectId` / `recallWorkItemId` fields for the wake-up that asked
Hindsight to retrieve it. Replay validates the recall scope against the current
snapshot while keeping original author attribution sticky. Same-project prior
work memories can therefore remain useful context without pretending they were
created by the current task. Future slices should add richer query semantics,
hat-specific
weighting, freshness/demotion state, and live Hindsight provider metadata behind
the same port.

Memory recall must be visible even when it cannot run. A memory adapter must not
silently return an empty set when the request lacks enough scope to ask a useful
question. The current `createMemoryContextPackRecallPort(...)` reports
`OutOfScope` omissions for missing agent or project scope, and the deterministic
builder carries those omissions into the pack and MemoryRecall curation stage.
Work-item scope is used when present. Project, initiative, and organization
director wakes may still recall project-scoped memory by using an internal
project recall token rather than forcing a fake current work item. This lets a
director, manager, reviewer, or implementer see whether memory was actually
consulted, failed, or could not be scoped yet.

Live Hindsight recall must preserve sticky original attribution from memory
metadata. If a recalled result does not include the original agent, hat
assignment, project, work item, and prompt-flow run metadata, the adapter drops
that result instead of stamping the current recall request onto it. The recall
scope and creation scope are separate facts.

### Stage 3.5: Hat Curation Intent

Before scoped document retrieval, the builder selects curation intent for the
active hat and moment. This is where the organization decides which documents to
look for and which context lanes deserve attention first for this role, phase,
and scope.

The intent is not a retrieval adapter and not an agent-memory adapter. It is a
policy port:

```ts
type ContextPackCurationIntentPolicyPort = {
  resolve(request: ContextPackCurationIntentRequest):
    Promise<ContextPackCurationIntent> | ContextPackCurationIntent;
};
```

The return value carries both `documentFocus` and the base `curationProfile`.
The default policy derives both from the same typed active-hat policy, so a
security hat, release hat, product hat, or management blocker gets matching
retrieval terms, preferred document types, lane priorities, required advisory
lanes, and deterministic instructions.

Tenant config uses the same boundary through
`createTenantConfigContextPackCurationIntentPolicy(...)`. The adapter reads
`TenantConfig.layers` through a narrow `get(organizationId)` reader, applies
matching context-pack curation overrides in deterministic specificity order, and
derives document focus from the effective profile before retrieval starts. Tenant
config may override profile id, lane priorities, required lanes, and
deterministic instructions only through domain-owned persisted vocabulary:
`TenantContextPackCurationProfileId`,
`TenantContextPackCurationLaneKind`, and
`TenantContextPackCurationInstruction`. The application adapter still validates
JSONB-loaded values defensively before they affect the curation plan, so unknown
persisted strings are ignored instead of becoming tenant policy. Tenant curation
cannot add context items, source refs, legal actions, graph roots, synthesis
evidence, or lifecycle blockers. Malformed override fields are dropped
field-by-field, and the default intent remains authoritative for everything the
tenant config does not validly specify.

### Stage 5.5: Hat Curation Profile Refinement

After deterministic evidence and advisory memory have been gathered, an optional
profile policy may refine the base curation profile for evidence-dependent
attention. Production tenant policy is applied earlier through curation intent,
so tenant overrides are already reflected in document retrieval. Profile
refinement is limited to lane attention and required advisory lanes; it cannot
retroactively retrieve documents or add evidence. The profile refinement port is:

```ts
type ContextPackCurationProfilePolicyPort = {
  resolve(request: ContextPackCurationProfileRequest):
    Promise<ContextPackCurationProfile> | ContextPackCurationProfile;
};
```

The request contains cloned snapshots of the build request, current items, and
omissions. A custom policy can inspect that context, but mutations cannot rewrite
the final pack or create synthetic evidence. The return value is limited to
`profileId`, `policyVersion`, lane priority overrides, required advisory lanes,
and deterministic instructions.

If a profile explicitly marks an advisory lane as required and the assembled
plan has no refs for that lane, the builder records a `not_indexed` omission and
rebuilds the plan so the omissions lane points at the missing required lane. The
baseline required lanes remain attention policy; company readiness rules for
documents, graph context, decisions, and gates still belong in completeness
policy. This keeps the profile port useful for role-specific attention without
turning every empty default lane into accidental work stoppage.

The default policy currently defines broad profiles plus hat-archetype profiles:

- `default`: preserve the base attention-lane ordering.
- `management_blocker`: for executive, C-suite, director, and manager hats in a
  blocked work, initiative, or project scope. It promotes required documents,
  graph neighborhood, active work, omissions, and legal actions so the
  decision-maker sees governing docs, actual blocker neighborhood, missing
  context, and legal routes before free-form reasoning.
- `implementer_execution`: for lead and individual-contributor hats in executing
  phase. It starts with active work, required docs, legal actions, graph context,
  and advisory memory so the worker focuses on the current task, acceptance
  criteria, prompt-flow phase, and repo-specific governing docs.

The hat-archetype layer derives from typed hat attributes already present in the
hat graph: hierarchy level, department, tool bundles, approval scopes, lifecycle
phase, and current scope. It must not special-case one hat id unless tenant
policy explicitly registers a custom profile. The default archetypes are:

- `product_validation`: business/product hats with the `business` bundle or
  product-readiness approval scopes. These packs prioritize customer need,
  RFP/BRD, acceptance criteria, final business validation, product signoff,
  decision records, omissions, and legal routes.
- `architecture_decision`: architecture hats with the `architecture` bundle or
  architecture approval scopes. These packs prioritize CAs, ADRs, architecture
  handbooks, integration boundaries, policy constraints, graph blast radius, and
  design-decision evidence.
- `evidence_review`: QA/review hats with the `qa` or `review_and_gates` bundle
  while the work is waiting for review/evidence/gate. These packs prioritize the
  active work, gate requirements, runtime evidence, reproduction notes,
  screenshots/traces, test runbooks, and bounce-back criteria.
- `security_control`: security/compliance hats with credential, security gate,
  or sensitive-tool approval scopes. These packs prioritize credential proxy
  policy, least-privilege rules, security ADRs, audit evidence, omitted context,
  and only the legal security/review actions exposed by `observe.ts`.
- `program_coordination`: program, TPM, mission-control, dependency, and
  blocker-management hats. These packs prioritize initiative mission,
  dependencies, staffing, sequencing, blocker routes, meeting context, decision
  records, and legal supervisor-chain actions.
- `release_delivery`: delivery and release hats with release, merge,
  deployment-evidence, readiness, or rollback responsibility. These packs
  prioritize release readiness, deployment evidence, merge gates, rollback
  runbooks, delivery decisions, and omitted release blockers.
- `runtime_operations`: operations, incident, SRE, scheduler, trigger, DLQ,
  runbook, and observability-heavy runtime hats. These packs prioritize incident
  context, SLOs, traces, DLQs, scheduler/trigger evidence, runbooks, and
  remediation routes.
- `knowledge_stewardship`: memory, knowledge-routing, documentation, and
  project-skill hats. These packs prioritize Hindsight attribution, memory
  provenance, documentation policy, skill graphs, stale/superseded context,
  consult outcomes, and context-routing evidence.
- `capability_expansion`: hat-design, tool-registry, MCP-registry, Temporal
  workflow, Dapr actor, and automation-expansion hats. These packs prioritize
  capability proposals, workflow/actor registries, tool boundaries,
  architecture/security review, rollout evidence, and approval status.
- `capacity_finance`: CFO, cost, budget, capacity, and hat-supply governance
  hats. These packs prioritize budget ceilings, cost guardrails, runtime
  capacity, hat supply, initiative priority, scaling evidence, and escalation
  context.

Archetype profiles are deterministic attention maps. They change document focus
and lane priority inside legal scope; they do not widen access and they do not
invent evidence. Ephemeral synthesis receives the selected archetype as part of
the curation plan and may compress, rank, or ask grounded questions only against
the admitted deterministic refs. This is the scalable version of "each hat gets
the right context": new hats inherit context behavior from their declared
capabilities, and tenant policy can override the intent port without changing
`observe.ts`, Cockroach adapters, Hindsight adapters, or model synthesis.

Tenant-config completeness uses the sibling
`createTenantConfigContextPackCompletenessPolicy(...)` adapter over the existing
`ContextPackCompletenessPolicyPort`. It layers declarative
`contextPack.completeness.requirementSetIds` and one-off
`contextPack.completeness.requirements` in the same organization, department,
hat, and work-item specificity order as curation. Requirement sets are typed,
runtime-valid IDs that expand inside the application adapter, so persisted
tenant config names reusable sufficiency policies without embedding executable
predicates. Inline requirements are still allowed as a tenant escape hatch. The
built-in set vocabulary covers the director sufficiency matrix rows for
management blockers, resource/RMO allocation, priority changes,
budget/capacity, tenant approvals, architecture tradeoffs, release calls,
runtime operations, security exceptions, and customer/business scope decisions.

The adapter validates requirement-set ids, requirement ids, item kinds,
applicability filters, evidence refs, and source-scope predicates at the
application boundary, and drops malformed records before they can affect a pack.
`requirementId` is policy identity: if a set-provided requirement is repeated by
an inline requirement, or a more-specific layer repeats a less-specific
requirement, the later requirement wins instead of producing duplicate blockers.
`blocksInheritedRequirements` clears fallback/default and less-specific tenant
requirements only when the layer contributes at least one valid applicable
tenant requirement. `hardBlockMissingRequiredContext: false` keeps a missing
requirement as a context omission without turning it into a lifecycle blocker.
Missing tenant config falls back to the default completeness policy;
tenant-config read failure preserves that fallback and adds an explicit
retrieval-failed omission/blocker so hard completeness policy does not fail
open. A valid tenant requirement can demand a context item kind for a hat, phase,
scope, project, team, or work item, and can require the satisfying item to carry
an active-scope source pointer. Tenant completeness delegates that provenance
test to the same context-pack scope evaluator used by the observe surface, so
doc units, graph nodes/edges, work items, inbox anchors, schedule blocks,
supervisor signals, scoped replay anchors, and Hindsight memory use one
active-scope definition.

Blocked management-level specialist hats keep their specialist profile. A
blocked product owner still gets `product_validation`; a blocked security
reviewer still gets `security_control`; a blocked architect still gets
`architecture_decision`. The blocker state is applied as an overlay on the
curation plan: governing documents, graph blast radius, omissions, and legal
routes are promoted, and the `management_blocker` instruction is added without
erasing the specialist context the decision actually depends on.

The deterministic retrieval scope must include both the work scope and the
wearer's active hat documentation scope. A QA reviewer working on an Engineering
project still needs QA verification policy and runbooks; a security reviewer
still needs credential-proxy policy; a release manager still needs release
readiness docs. Therefore the retrieval scope includes the active hat's
`departmentId` and declared `documentationScopes` in addition to organization,
project, team, and hierarchy-derived project department scopes. This is scope
alignment, not access widening: the default organization policy treats active
hat department context as a duty-bound documentation grant, while
`documentationScopes` adds any explicit extra documentation grants declared by
the hat graph. A tenant-specific document-scope policy can narrow or replace
that default, but the default keeps directors, managers, reviewers, and ICs from
losing the governing docs for the role they are currently wearing.

The selected profile is persisted on `ContextPackCurationPlan` and rendered into
the model-backed synthesis prompt as `profile=...` and `policyVersion=...`.
This gives the ephemeral curator the same deterministic "why this attention map"
metadata that dashboards and replay tools receive.

### Stage 6: Ephemeral Synthesis

An ephemeral agentic process may summarize and rank the scoped material. Its job
is to create a better briefing, not to invent facts. It can:

- compress a large graph neighborhood into director-readable decision context;
- identify likely missing inputs;
- propose questions for a manager, architect, QA reviewer, or security reviewer;
- recommend a next legal action already present in the `Menu16` readout.

The synthesis output must cite source refs and must be reproducible enough to be
audited by re-running deterministic stages.

This boundary also applies to recursive local sub-observes. A sub-observe may
propose, rank, summarize, ask a question, or identify a gap inside the admitted
deterministic envelope. It cannot create a source-of-truth fact, widen document
or graph scope, satisfy a required lane, bypass provenance validation, or make a
non-current pack current. If local sub-observes disagree, the disagreement is
surfaced as uncertainty or an omission; it is not averaged into authority.

The implemented model-backed synthesis adapter keeps that boundary structural:

- prompt input is bounded and hat-scoped: hat id, hat level, phase, scope,
  agent/org/project/team/work ids, deterministic items, omissions, and known
  contradictions, plus legal observe actions and selected curation profile
  metadata;
- prompt input is a defensive clone of the deterministic context snapshot taken
  before synthesis runs. The model-backed adapter, or any future custom adapter,
  can mutate the request it receives without changing the final deterministic
  item set, omission set, contradiction list, or persisted curation plan;
- prompt items are active-scope grounding items. Retrieved docs for another
  project or team can remain visible in the pack as context, but they do not
  enter the synthesis grounding set and cannot be cited as valid synthesis
  evidence;
- the model returns JSON only: a summary, optional briefing, optional ranked
  context refs, optional gap hypotheses, optional questions, optional
  recommended action refs, and curation evidence refs;
- the briefing becomes a first-class `synthesis_briefing` context item only when
  every `evidenceRef` resolves to an existing deterministic context item;
- ranked context refs, gap hypotheses, questions, and recommended action refs
  become first-class advisory context items only when every cited `evidenceRef`
  resolves to an existing deterministic context item or deterministic omission.
  Omission refs are allowed only when at least one cited deterministic context
  item supplies replayable source pointers;
- ranked context refs additionally require their `itemId` target to resolve to
  an existing deterministic context item. The ephemeral curator can reorder what
  the director should read first, but it cannot create a ranked row for context
  the deterministic pack did not admit;
- recommended action refs additionally require an `actionType` that exists in
  the current legal observe action list. The model may provide display
  direction text, but that text is not authority;
- the briefing inherits typed source pointers from cited deterministic items, so
  replay still lands on original docs, graph nodes, memories, decisions, traces,
  or policy sources instead of on model text;
- advisory items inherit the same cited source pointers. This lets an agent see
  the model's compression and suggested questions while still traversing back to
  the deterministic source that made the suggestion legal to show;
- synthesis confidence is an upper-bound display signal, not independent model
  verification. If the model provides confidence for a briefing or gap
  hypothesis, deterministic admission caps it at the weakest cited deterministic
  evidence item confidence. If confidence is omitted, admitted synthesis uses
  that same cited-evidence ceiling. Omission refs can ground a gap only beside a
  cited context item; omissions never raise the confidence ceiling;
- every admitted synthesis item carries a typed `confidenceBasis` with
  `cited_evidence_ceiling`, the deterministic evidence refs that set the
  ceiling, the model-provided confidence when present, and any model-supplied
  uncertainty explanation. When cited evidence has deterministic uncertainty
  signals, the basis also preserves the intersecting typed signals. This gives
  reviewers and dashboards a stable field for why a briefing, gap, question,
  ranked row, or recommended action is weak or strong without turning model
  prose into authority;
- malformed model JSON, empty summaries, uncited briefings, or uncited advisory
  claims fail as explicit retrieval omissions instead of silently becoming
  context;
- model-supplied `curationEvidenceRefs` are also grounded before they enter the
  `EphemeralSynthesis` trace. Valid refs must point to deterministic context
  items in the active-scope grounding set. Ungrounded trace refs become explicit
  omissions and are not allowed to make the replay trail claim evidence the
  agent could not actually traverse. Grounding is checked against the
  pre-synthesis deterministic snapshot, not against any item the synthesis
  adapter added or mutated.
- graph-only context can ground synthesis only when it is rooted in the active
  canonical or legacy/raw organization/project/team/work/hat/initiative/priority
  work graph, or when graph-node context is backed by an active-scope document
  citation or active work-item pointer. Graph edges are stricter: they must have
  active endpoints or be attached to an active graph traversal root. An active
  work pointer cannot launder an arbitrary cross-project graph edge into model
  grounding. A graph item for another project can remain visible as retrieved
  context, but it cannot become the basis for a model briefing, ranked context
  row, question, or recommended action.
- the final `observeAgentSurface` repeats scope/replay validation for document,
  graph, memory, work-item, schedule, and supervisor-signal source pointers. The
  builder may admit active-hat department documentation as a duty-bound grant,
  and the observe surface uses the same active-hat department/documentation
  scope rule so valid QA, security, release, or operations policies are not
  degraded just because the current project belongs to Engineering.

### Stage 6.5: Advisory Promotion

Grounded synthesis remains advisory by default. A model can identify a likely
missing owner decision, propose a follow-up question, or recommend a legal
observe action, but that text does not become a lifecycle blocker by itself.
Gap hypotheses and questions may cite deterministic omission refs when they also
cite at least one source-backed context item, so missing context can be discussed
without becoming source-less model authority.

When company or tenant policy wants synthesis-discovered gaps to affect the
working context, it must do so through `ContextPackAdvisoryPromotionPolicyPort`.
The policy receives cloned request and evidence snapshots plus admitted
advisory items. The default policy is approval-backed: no approval decision
means no promotion. A decision matches by active hat/work scope, curation
profile, and advisory fingerprint. The builder then validates the policy result
before mutating the pack:

- `sourceItemId` must match an admitted synthesis advisory item in the current
  pack.
- The default policy promotes only `synthesis_gap_hypothesis` advisories with a
  matching approved decision.
- Empty lifecycle blocker messages are rejected as omissions.
- Trace evidence refs are filtered to admitted deterministic or advisory item
  refs, plus durable `advisory_promotion_decision:<decisionId>` refs emitted by
  the approval-backed policy. Arbitrary model-only evidence refs remain filtered
  out.
- Invalid promotions become `out_of_scope` omissions with
  `advisory_promotion:<sourceItemId>` node ids.
- Accepted promotions add lifecycle blockers and an `AdvisoryPromotion`
  curation trace stage.

This keeps the boundary precise: ephemeral agents can discover and phrase a gap,
but deterministic organization policy, through an approved decision record,
decides whether that gap blocks work.

Production `observe-act` wires the default policy to
`createCockroachContextPackAdvisoryPromotionDecisionStore(...)`. The durable
projection is read-only in this slice and lives in
`agentic_org_context_pack_advisory_promotion_decisions` (migration V31). It
stores approval or revocation status, active-scope selectors, a stable
advisory fingerprint, curated blocker text, and curator trace metadata. The
reader fails closed on malformed rows, filters by active scope and policy
version, collapses rows by `decision_key`, and lets the newest revoked decision
suppress older approvals. An empty table therefore keeps the default production
behavior deny-by-default.

### Stage 7: Gap And Contradiction Review

Before the pack is returned, the builder must surface:

- omitted items and why;
- stale inputs;
- contradictions;
- lifecycle blockers;
- confidence boundaries;
- whether the pack is fresh enough for work to start.

## Director Blocker Example

When an engineering director wakes up to a blocked initiative, the pack should
prefer:

1. Initiative mission, priority, schedule pressure, and success criteria.
2. Blocking work items and current state-transition evidence.
3. BRD, CA, ADRs, and design docs governing the work.
4. Decisions and dissent from meetings tied to the initiative.
5. Affected services, owners, dependencies, and blast radius.
6. Related traces, failures, QA evidence, and review bounces.
7. Prior similar blockers and hat-scoped memory pointers.
8. Missing context and recommended escalation targets.

This is how the director knows what decision is right: not because the model is
smarter in isolation, but because the organization supplies the correct context.

## Director Context Sufficiency Matrix

Director-grade context is not one generic profile. Directors make different
classes of decisions, and each class has a minimum context shape. The default
builder supplies the generic lanes; company policy and future tenant policy make
these rows enforceable as completeness requirements.

| Decision archetype | Required context lanes | Hard omissions | Normal escalation |
| --- | --- | --- | --- |
| Blocker resolution | required documents, active work, graph neighborhood, omissions, legal actions | missing BRD/business rules, missing CA/ADR/architecture, missing policy, missing graph blast radius | TPM or manager for work detail; architect/product/security when their evidence is missing |
| Resource/RMO allocation | active work, graph neighborhood, memory, required documents, legal actions | missing initiative priority, missing hat supply/capacity, missing schedule pressure, missing budget/cost signal | C-suite for budget/capacity conflict; managers for staffing evidence |
| Priority change | required documents, active work, graph neighborhood, omissions | missing customer/business priority, missing initiative KPI, missing dependency/blast-radius graph, unresolved conflicting decisions | C-suite or executive board for portfolio tradeoff |
| Architecture tradeoff | required documents, graph neighborhood, active work, omissions | missing CA/ADR/design constraint, missing affected service graph, missing business rule, stale architecture doc | architecture department; product owner for business-rule conflict |
| Release call | active work, required documents, graph neighborhood, legal actions | missing QA/review signoff, missing rollout/rollback runbook, missing release readiness evidence, unresolved defects | release/delivery director; QA manager; operations incident owner |
| Security exception | required documents, omissions, active work, legal actions | missing least-privilege policy, missing credential-proxy/audit evidence, missing threat/risk decision, stale security policy | security director; C-suite for accepted residual risk |
| Customer/business scope decision | required documents, active work, graph neighborhood, memory | missing RFP/BRD/customer interview, missing acceptance criteria, missing business validation outcome, conflicting product decision | product owner/BA; C-suite for strategic scope shift |

Ephemeral synthesis may compress the matrix row into a briefing or question list,
but it cannot satisfy a hard omission. If the deterministic pack cannot prove a
row's required context, the correct output is an incomplete pack with explicit
questions or escalation paths, not a confident model answer.

## Implemented Slice

The current code slice deliberately builds the deterministic curation spine and
adds production adapters incrementally:

- `ContextPackBuilderPort` and explicit context pack DUs live in
  `context-pack-contracts.ts`; `observe.ts` re-exports them for compatibility
  while keeping the lifecycle surface focused on composition.
- `AgentObserveDependencies` accepts the builder port.
- `observeAgentSurface` always returns `context`.
- Without a builder, the context readout is degraded and includes a
  `builder_unavailable` omission.
- Builder failures degrade through the observe surface with explicit
  `retrieval_failed` omissions.
- Returned packs must match run, scope, hat, hat assignment, agent, org, project,
  team, and work-item scope when those fields exist on the snapshot.
- Even after top-level pack scope matches, `observe.ts` revalidates item-level
  source pointers. Wrong-scope DocUnit, graph, memory, work-item,
  schedule-block, or supervisor-signal provenance becomes an `out_of_scope`
  omission and status-affecting lifecycle blocker while the original pack
  remains replayable for the dashboard. Audit-only handles such as git blobs,
  decisions, discussions, quality gates, traces, and policies cannot be the sole
  proof of active scope; they need a validated scoped companion pointer.
- Packs become non-current when they are empty, stale, contradicted, omitted,
  archived, expired, or carry invalid timestamps.
- In production observe-act, non-current context packs darken lifecycle work
  slots in the rendered `Menu16` commit bank when `enforceContextReadiness` is
  enabled. Agents can still refresh, inspect status, navigate scope, retract/redo
  history, rest, branch grammar, or escalate where their hat permits it.
- `createDeterministicContextPackBuilder(...)` composes deterministic document
  retrieval, required consults, lifecycle anchors, work-graph-seeded graph
  traversal, optional memory recall, optional policy completeness, grounded
  ephemeral synthesis, and gap review. Document retrieval is profile-aware before
  the adapter runs through `ContextPackDocumentFocusPolicyPort`, so a director
  blocker pack can prefer governing BRDs, architecture, ADRs, policies, and
  decision records without leaking hat policy into Cockroach. The chosen focus is
  replayable through the `document_focus` curation stage.
- `ContextPackLifecycleAnchorPort` is now a first-class application contract.
  The implementation provides an in-memory/test adapter that demonstrates the
  generic contract. The builder admits lifecycle items only when they point back
  to the active work item; schedule blocks are additionally scoped to the active
  schedule assignment, and supervisor signals are admitted only when they belong
  to the active target hat assignment. The builder enforces those assignment
  checks from typed `schedule_block` and `supervisor_signal` source-pointer
  provenance, so custom lifecycle adapters cannot bypass active-hat scoping by
  returning a same-work item for another wearer. Broader null-team work-item
  anchors are admitted under team-scoped observe requests. Retrieved anchors
  become deterministic context items, active-work attention-lane refs, typed
  `discussion`, `decision`, `quality_gate`, `schedule_block`, and
  `supervisor_signal` source pointers, and semantic graph root seeds.
- `createCockroachContextPackLifecycleAnchorPort(...)` is the production
  lifecycle-anchor adapter. It reads discussions, decisions, quality gates,
  current scheduled/active work blocks for the current agent/hat assignment, and
  supervisor signals targeted to the active hat assignment for the active work
  item. It includes broader null-team work-item anchors when the observed agent
  also has a team scope. Malformed durable rows are dropped before they become
  context, and the builder still validates active work provenance before
  admitting returned items.
- `ContextPackInboxAnchorPort` is now a first-class application contract. The
  in-memory adapter and Cockroach production reader demonstrate per-hat inbox
  admission without folding inbox semantics into lifecycle anchors. The builder
  validates target hat assignment, optional target agent, and non-contradictory
  optional work provenance from typed `inbox_anchor` source pointers, adds
  accepted inbox items to the active-work attention lane before synthesis,
  records an `inbox_anchors` curation stage, and uses accepted inbox graph roots
  before graph traversal. Out-of-scope inbox items become omissions and their
  graph roots are dropped. `AuthorContextPackInboxAnchorCommand` is the first
  domain-owned authoring command for the same table; it produces unread anchors
  through command effects, preserves hat-only anchors without fake work
  provenance, and Cockroach persists those effects inside the command outcome
  transaction. `UpdateContextPackInboxAnchorStatusCommand` completes the first
  lifecycle slice by marking anchors `read` or `dismissed` through a separate
  status-transition effect with strict scoped-anchor matching and transactional
  in-memory/Cockroach persistence.
- `ContextPackTelemetryEvidencePort` is now a first-class application contract
  for runtime evidence enrichment. The builder calls it after lifecycle and
  inbox anchors and before graph traversal so accepted lifecycle traces can
  contribute deterministic telemetry context before ephemeral synthesis.
  `createLgtmContextPackRuntimeEvidencePort(...)` reads Tempo traces, Loki logs,
  and Mimir metric series through `TelemetryQueryPort`, emits typed `trace`,
  `log`, and `metric` source pointers, and creates trace graph-root seeds.
  Production `observe-act` wires it when the LGTM endpoint env vars are present;
  missing LGTM env leaves context packs deterministic without runtime telemetry
  rather than failing setup.
- `createModelBackedContextPackSynthesisPort(...)` provides the first real
  ephemeral-agentic synthesis adapter behind the generic `ChatCompletionPort`.
  It sends bounded deterministic evidence to the model and parses only a narrow
  JSON contract.
- Grounded synthesis can add a `synthesis_briefing` item. That item is advisory,
  hat-specific, and replayable because it inherits source pointers from its
  cited deterministic evidence.
- Grounded synthesis can also add `synthesis_ranked_context`,
  `synthesis_gap_hypothesis`, `synthesis_question`, and
  `synthesis_recommended_action` items. These are advisory and required=false:
  they improve the agent's attention and next-question quality without becoming
  company policy, quality gates, or lifecycle blockers by themselves.
- Synthesis confidence is deterministically calibrated before admission. A
  briefing, gap hypothesis, ranked context ref, question, or action advisory can
  never carry confidence higher than the weakest deterministic item it cites.
  Model-provided confidence above that ceiling is clamped, while omitted
  confidence falls back to the cited-evidence ceiling. The admitted item also
  stores a typed `confidenceBasis` that names the cited deterministic evidence
  refs, the evidence ceiling, any model-provided confidence, and the optional
  uncertainty explanation supplied by synthesis.
- `ContextReadout` groups typed uncertainty signals for reviewer-facing UI and
  policy inspection. The summary includes total uncertainty count plus high,
  medium, and low severity counts, and the grouped view folds matching
  `(kind, severity)` signals with de-duplicated evidence refs and messages. When
  production observe-act darkens lifecycle work slots for a non-current context
  pack, the veto reason includes the uncertainty count and highest-severity
  group so reviewers can see whether missing context is also stale, indirect,
  conflicting, or low-confidence without treating that metadata as evidence.
- `ContextPackReadinessPolicyPort` is the readiness extension point used by
  `observeAgentSurface`. The default policy wraps the deterministic readiness
  evaluator; production observe-act wires
  `createTenantConfigContextPackReadinessPolicy(...)` to the Cockroach tenant
  config store. Tenant layers can define typed `uncertaintyHardStops` by
  severity and optional signal kinds, plus typed `omissionHardStops` by omission
  reason and optional node-id prefix, plus `contradictionHardStops` for
  moments where any unresolved contradiction is hat-specific stop-the-line
  evidence, plus `lifecycleBlockerHardStops` by optional blocker-message
  prefix. This lets tenant policy stop on approved blocker classes while leaving
  softer advisory text inspectable. `staleHardStops` can match stale input refs
  and stale or archived item ids by prefix so high-stakes hats can treat stale
  governing documents as incomplete context rather than merely stale context.
  All rule families use the same
  hat/department/phase/scope/work filters used by completeness and synthesis
  policies. Matching hard stops turn otherwise-current or stale packs into
  `incomplete`; conflicted packs remain `conflicted` while gaining
  tenant-specific hard-stop reasons. Malformed rules are ignored, and
  readiness-policy failures fail closed at observe.
- `synthesis_ranked_context` is target-bound: the ranked `itemId` must point to
  deterministic context already admitted into the pack. A model can prioritize
  `doc:billing-brd`; it cannot make `doc:not-in-pack` look like ranked context
  by citing a different valid document.
- `synthesis_recommended_action` is legal-action-bound: its `actionType` must
  exist in the current observe readout's legal actions. The optional direction
  text is display material only.
- Semantic graph root seeds preserve title, citation refs, and inclusion
  reasons. Duplicate roots merge citation refs and reasons across root sources
  while title precedence stays explicit semantic roots, lifecycle roots,
  document roots, then legacy raw ids. Hat-specific context can explain when the
  same neighborhood came from project trajectory, initiative priority, hierarchy
  priority, work-item lifecycle, hat authority, mission management, document
  evidence, or organization runtime.
- Ephemeral synthesis trace evidence is grounded to deterministic item refs.
  Ungrounded model-provided trace refs become omissions instead of silently
  weakening replayability. Synthesis receives defensive clones and grounds
  against the pre-call deterministic active-scope snapshot, so wrong-scope
  documents, graph or lifecycle items citing wrong-scope `doc:` refs, mixed-scope
  DocUnit source pointers, and adapter-side mutations cannot become accepted
  context.
- `ContextPackAdvisoryPromotionPolicyPort` is the first deterministic promotion
  boundary for synthesis-discovered blockers. The builder passes cloned
  request/evidence snapshots to the policy, admits lifecycle blockers only when
  their `sourceItemId` matches an already-admitted synthesis advisory item,
  records invalid promotions as `out_of_scope` omissions, and writes an
  `AdvisoryPromotion` curation trace stage for replay. The default policy is
  deny-by-default and approval-backed. Production composition wires it to the
  Cockroach-backed advisory-promotion decision reader, so only durable,
  hat-curated approvals with matching scope and fingerprint can promote
  synthesis gap hypotheses into lifecycle blockers. Observe-act also wires the
  same reader into candidate presentation, so an approval hint is display-only
  evidence that the current admission policy would see a matching durable
  approval; unmatched and revoked candidates are both displayed as not approved
  because this reader intentionally exposes current approvals only. The durable
  reader also exposes `advisory_promotion_decision:<decisionId>` evidence refs
  in the curation trace while filtering arbitrary model-only refs. The Cockroach
  advisory-promotion decision store now also exposes a write port for audited
  approval/revocation decisions. Decisions are upserted by a deterministic
  scope/fingerprint decision key, preserve curator hat assignment and trace
  metadata, and feed the existing approval-backed reader without letting
  ephemeral synthesis promote itself. `AuthorContextPackAdvisoryPromotionDecision`
  is the command-backed workflow boundary for approvals and revocations: it
  validates the promoted advisory fingerprint and evidence, emits a typed command
  effect plus audit event, persists through the Cockroach command-state store,
  and is covered by hat-authority and schedule-authority policy tables.
- `createMemoryContextPackRecallPort(...)` adapts the generic `Memory` port into
  `ContextPackMemoryRecallPort`, requires agent and project scope before
  recalling, treats work-item scope as optional, uses a project recall token when
  no current work item exists, returns explicit context omissions when recall
  cannot be meaningfully scoped, and maps sticky memory author attribution plus
  original project, work item, prompt-flow run, and typed similarity category
  into `hindsight_memory` source pointers. Recalled memories are similarity
  ranked before budget truncation and receive category-derived confidence unless
  production composition supplies an explicit confidence policy. The adapter now
  also accepts a governance-envelope reader so durable `MemoryEnvelope` phase,
  tier, scope, KPI outcome, utility, confidence, and freshness can filter and
  rank recalled candidates before the context-pack budget is applied. Archived
  or below-read-floor memories cannot surface, and governance metadata is carried
  in memory recall reasons plus typed `hindsight_memory` source-pointer
  explanations for replay and reviewer inspection.
- The production `observe-act` composition root wires Cockroach doc units,
  Cockroach graph, Cockroach-backed Hindsight memory, and Cockroach-backed
  `MemoryEnvelope` governance into the same deterministic context builder, so
  archived or below-floor memories are filtered before an agent receives them.
- The production `observe-act` composition root records every returned
  `ContextReadout` through `ContextPackSnapshotStorePort` into Cockroach so the
  UI, reviewers, and future self-healing agents can replay the exact briefing
  surface an agent received.
- `contextPackDrillTargetsForItem(...)` and
  `contextPackDrillTargetGroupsForPack(...)` turn typed source pointers into
  stable UI drill targets for documents, graph nodes and edges, Hindsight
  memory, work items, decisions, discussions, inbox anchors, meetings, quality
  gates, schedules, supervisor signals, traces, metrics, logs, and policies.
  `observeAgentSurface(...)` exposes these groups on `ContextReadout` after
  provenance filtering, so UI and workflow callers can render drill routes for
  the exact pack the hat is allowed to see. Memory drill targets carry cloned
  governance explanations so reviewer surfaces can inspect why the memory was
  admitted without mutating the pack. The observe-act CLI prints these target
  route refs alongside required/optional context, so terminal operators can
  jump from a curated pack item to the backing document, memory, trace, graph,
  or workflow artifact.
- Context-pack inbox anchors support a typed `snoozed` lifecycle state with a
  required future `snoozedUntil` timestamp. Status commands persist the wake
  time through the Cockroach command-state store, and deterministic inbox-anchor
  loading excludes snoozed anchors until their wake time is due. This gives
  per-hat workflow surfaces a real defer/snooze affordance without turning
  deferred context into lost context.
- `contextPackInboxWorkflowViewFor(...)` projects raw per-hat inbox anchors
  into deterministic workflow batches for urgent unread, normal unread,
  due snoozes, future snoozes, and read anchors. It filters by organization,
  target hat assignment, and optional target agent, hides dismissed anchors,
  keeps hat-wide anchors visible to the active assignment, and exposes typed
  `mark_read`, `snooze`, and `dismiss` actions backed by the existing
  `ContextPackInboxAnchorStatus` transition model.
- `createCockroachContextPackInboxWorkflowViewReader(...)` is the durable read
  side for that projection. It intentionally differs from the context-pack
  builder's inbox port: the builder keeps dismissed and future-snoozed anchors
  out of curated context, while the workflow reader loads read and future
  snoozed rows so the active hat can audit, wake, snooze, or dismiss its inbox
  without losing visibility. Production `observe-act` wires this reader through
  `loadContextPackInboxWorkflow(...)` and prints the resulting batches alongside
  the curated context pack.
- `observe-act` can also execute those workflow transitions directly. Passing
  `--inbox-anchor <id>` with `--inbox-action mark_read|snooze|dismiss` loads the
  current durable workflow view, finds the visible per-hat item, validates that
  the typed action is available, and dispatches
  `UpdateContextPackInboxAnchorStatus` with organization/project/team/work and
  target-hat scope copied from the workflow item rather than from free-form CLI
  flags. Snooze actions require `--inbox-snoozed-until <iso>` before any command
  is sent.
- The model-backed observe-act selector receives the same bounded inbox workflow
  view in its prompt: summary counts plus the top visible batch items, status,
  snooze time, and typed action ids. This lets ephemeral selection account for
  urgent per-hat wakeups while deterministic workflow commands remain the only
  authority for marking, snoozing, or dismissing anchors.
- The default management-blocker completeness policy checks source pointers and
  active scope before treating BRDs, architecture docs, policies, or graph
  neighborhoods as satisfying required context. Completeness-policy adapters
  receive cloned request and evidence inputs, so policy evaluation cannot mutate
  the final pack or rewrite the final scope.
- The default curation-intent policy is a first-class application port. It
  profiles director/manager blocker packs around governing docs, graph blast
  radius, omissions, and legal routes, and profiles lead/individual-contributor
  execution packs around active work, acceptance criteria, prompt-flow phase,
  and governing repo docs. The same pre-retrieval decision selects document
  focus and the base curation profile; the selected profile id and policy
  version are stored on the curation plan and sent to model-backed synthesis.
  `listContextPackCurationProfileDescriptors()` and
  `listContextPackAttentionLaneDescriptors()` expose the same profile, document
  focus, deterministic-instruction, lane-priority, and lane-objective vocabulary
  used by the builder so tenant authoring surfaces can preview curation changes
  without duplicating private retrieval tables.
- `ContextPackSynthesisRequirementPolicyPort` is a first-class application
  policy for deciding when ephemeral-agentic synthesis is required rather than
  optional. The default policy requires synthesis for wake-requested context
  builds and blocked management contexts, and permits deterministic-only
  operation for lower-risk routine refreshes. When required synthesis is
  unavailable, the builder emits a replayable omission and adds
  `EphemeralSynthesis` to `curationPlan.requiredStages`, so
  `evaluateContextPackReadiness(...)` makes the pack incomplete instead of
  silently treating missing model-backed curation as acceptable.
- `createTenantConfigContextPackSynthesisRequirementPolicy(...)` layers durable
  tenant-config synthesis requirements over the default synthesis-requirement
  policy through the same tenant-config reader. Production `observe-act` wires
  it to `createCockroachTenantConfigStore(...)`. Tenant rules are positive
  requirements: a matching rule requires ephemeral synthesis for the named
  hat/phase/scope/project/team/work item. A tenant can relax inherited/default
  requirements only with an explicit `blocksInheritedRequirements` layer, which
  makes deterministic-only operation deliberate and visible in the policy
  version. Named requirement sets cover high-stakes review, resource/RMO
  allocation, priority change, architecture tradeoff, release readiness,
  security exception, customer/business scope, and runtime-operations briefing
  moments. Malformed rules or unknown set ids are dropped before they can affect
  readiness. `listTenantContextPackSynthesisRequirementSetDescriptors()` exposes
  the named set catalog as clone-safe descriptors so authoring surfaces can show
  the exact phase, scope, and reason preview before a tenant persists a
  synthesis-requirement override.
  `previewTenantContextPackSynthesisRequirementPolicy(...)` applies an unsaved
  synthesis-requirement draft to the current hat/phase/scope through the same
  named-set expansion, reason mapping, inheritance-blocking, and policy-version
  path used by persisted tenant layers.
- `observe-act` exposes the first tenant-synthesis-requirement authoring
  affordance through `--context-synthesis-preview`. Authors can render the
  exported synthesis named-set catalog and preview one unsaved
  `--context-synthesis-set <set-id>` draft against the active hat, phase,
  scope, current curation plan, current items, and current omissions. The
  preview renders the effective decision, reason, and policy version, then exits
  without dispatching lifecycle or workflow side effects. The application
  synthesis-requirement preview policy remains the authority for named-set
  expansion, applies-to filtering, inheritance blocking, and mapping tenant
  reasons into context-readiness model-briefing requirements.
- `createTenantConfigContextPackCurationIntentPolicy(...)` layers durable
  tenant-config curation overrides over the default curation intent through the
  same tenant-config reader. Production `observe-act` wires it to
  `createCockroachTenantConfigStore(...)`; missing organization scope or missing
  config falls back to the default intent, and malformed tenant fields are
  dropped before they can affect the curation plan. Persisted curation policy now
  uses domain-owned typed vocabulary for profile ids, attention lanes, and
  deterministic instructions, and JSONB-loaded unknown values are ignored at the
  application boundary. The effective profile drives document focus before
  retrieval. `previewTenantContextPackCurationPolicy(...)` reuses the same
  sanitizer and curation application path for unsaved authoring drafts, returning
  the resulting document focus, profile, required lanes, lane priorities, and
  deterministic instructions before persistence.
- `observe-act` exposes the first tenant-curation authoring affordance through
  `--context-curation-preview`. Authors can preview an unsaved
  `--context-curation-profile`, `--context-required-lane`,
  `--context-lane-priority <lane>=<priority>`,
  `--context-deterministic-instruction`, and
  `--context-block-inherited-instructions` draft against the active hat, phase,
  and scope. The CLI renders the exported profile and lane catalogs plus the
  previewed retrieval focus and attention changes, then exits without dispatching
  lifecycle or workflow side effects. The application preview policy remains the
  authority for sanitizing typed vocabulary and calculating the effective
  curation profile.
- `createTenantConfigContextPackCompletenessPolicy(...)` layers durable
  tenant-config completeness requirements over the default completeness policy
  through the same tenant-config reader. Production `observe-act` wires the same
  Cockroach tenant-config store into curation and completeness, so tenant policy
  can require missing context per hat/phase/scope without changing the builder.
  Named requirement sets cover management blockers, resource/RMO allocation,
  priority changes, budget/capacity, tenant approvals, architecture tradeoffs,
  release readiness, security exceptions, customer/business scope, and runtime
  operations. Sets expand inside the adapter, inline requirements can refine
  set-provided requirements by id, more-specific layers can refine broader
  layers, and valid `blocksInheritedRequirements` layers can suppress
  fallback/default requirements. Malformed requirements are dropped, valid
  missing hard requirements become `context_requirement:*` omissions and
  lifecycle blockers, valid missing soft requirements remain omissions only, and
  active-scope requirements must be satisfied by scoped source pointers rather
  than by a same-kind item from unrelated context.
  `listTenantContextPackCompletenessRequirementSetDescriptors()` exposes the
  named-set catalog as clone-safe descriptors so authoring surfaces can preview
  requirement ids, item kinds, messages, evidence refs, source-scope rules, and
  applies-to filters before persistence.
- `observe-act` exposes the first tenant-completeness authoring affordance
  through `--context-completeness-preview`. Authors can render the exported
  completeness named-set catalog and preview one unsaved
  `--context-completeness-set <set-id>` draft against the active hat, phase,
  scope, and current context items. The preview renders the effective omissions,
  lifecycle blockers, and evidence refs, then exits without dispatching
  lifecycle or workflow side effects. The application completeness preview
  policy remains the authority for named-set expansion, applies-to filtering,
  source-scope evaluation, and hard-block semantics.
  `previewTenantContextPackCompletenessPolicy(...)` applies an unsaved
  completeness draft to the current context-pack evidence through the same
  requirement expansion, scope checks, omissions, hard-blocker, and evidence-ref
  path used by persisted tenant layers.
- All builder extension points receive cloned requests and scoped evidence
  snapshots. Tests cover lifecycle-anchor adapter mutation specifically so a
  future Cockroach, NATS, Hindsight, graph, or model adapter cannot rewrite the
  director's active scope by holding onto a live request reference. Graph
  document-root callbacks receive cloned document units for the same reason:
  they can derive a root id, but they cannot mutate retrieved markdown status or
  scope before stale-input and policy checks.
- Tests cover management blocker context, missing builder degradation, retrieval
  failure degradation, scope mismatch rejection, timestamp/freshness status,
  typed document/graph/memory/lifecycle provenance, work graph roots,
  assignment-scoped lifecycle adapters, lifecycle provenance consistency,
  required-context policy omissions, wrong-scope synthesis rejection,
  mixed-scope lifecycle-grounded synthesis rejection, wrong-scope item
  provenance rejection at the observe surface, wrong-work provenance rejection at
  the observe surface, ungrounded synthesis omission, synthesis/policy/lifecycle
  and graph-root mutation isolation, curation-intent/profile mutation isolation,
  profile-aware model prompts, optional-source failure omissions, and production
  docs/graph/memory composition.

## Remaining Gaps

The current slice is not yet the full production context system. The next
implementation slices should add:

- additional outcome writers beyond quality gates, observe lifecycle
  transitions, and business-validation decisions. The consult ledger now has V0
  quality-gate stamping, observe `complete`/`rework` stamping, typed
  `business_validation:<decisionRecordId>` stamping through
  `RecordDecisionCommand`, scoped outcome aggregation, and retrieval
  consumption;
- richer per-hat inbox workflow surfaces for
  `agentic_org_context_pack_inbox_anchors`; create and read/dismiss status
  commands now exist with audited command effects, snoozed anchors persist a
  due time and stay out of deterministic context until due, the application
  layer has a deterministic per-hat inbox workflow projection, Cockroach exposes
  the durable workflow read side, and observe-act renders and dispatches typed
  batch actions. Remaining work is richer graphical UI affordances for acting on
  those transitions;
- tenant-authored completeness authoring/UI affordances beyond the first
  observe-act preview. The CLI now renders the named-set catalog and previews one
  unsaved completeness named set through
  `previewTenantContextPackCompletenessPolicy(...)`, including source-scope,
  phase/scope filtering, hard blockers, and evidence refs; remaining work is
  richer edit, batch, validation, and persistence UI for those drafts;
- tenant-authored curation authoring/UI affordances beyond the first
  observe-act preview. The CLI now renders the typed profile/lane catalog and
  previews a single unsaved profile, required lane, lane-priority, and
  deterministic-instruction draft through
  `previewTenantContextPackCurationPolicy(...)`; remaining work is richer edit,
  batch, validation, and persistence UI for those drafts;
- tenant-authored synthesis-requirement authoring/UI affordances beyond the
  first observe-act preview. The CLI now renders the named-set catalog and
  previews one unsaved synthesis-requirement named set through
  `previewTenantContextPackSynthesisRequirementPolicy(...)`, including
  phase/scope filtering and the effective decision/reason that will make missing
  model configuration a context-readiness blocker; remaining work is richer
  edit, batch, validation, inheritance-blocking, and persistence UI for those
  drafts;
- richer uncertainty semantics beyond the first typed signal categories,
  memory-similarity categories, reviewer-facing grouping, and tenant-config
  hard-stop rules now exposed through `ContextPackReadinessPolicyPort`;
- durable hat-curated advisory-promotion workflow UI: the generic
  `ContextPackAdvisoryPromotionPolicyPort`, approval-backed default policy,
  Cockroach V31 projection, production reader, audited Cockroach writer, and
  command-backed approval/revocation effect now exist. Observe-act can now
  author an approval or revocation for a visible scoped synthesis-gap item using
  a derived fingerprint and the existing command pipeline, and the observe
  screen presents visible synthesis-gap candidates with their derived
  fingerprints, evidence refs, and current approval hints from the scoped
  admission reader. Remaining work is richer tenant/hat-specific UI that batches
  candidates, explains prior decisions including revocations through a separate
  workflow/audit reader, and routes which
  admitted gap hypotheses, questions, risk notes, or action refs should darken
  execution paths;
- production root resolvers/readers that discover meeting, discussion, decision,
  quality-gate, schedule, inbox, and trace anchors directly from their state
  stores, not only from hierarchy and already-materialized graph edges;
- richer Hindsight attribution and recall production wiring that scopes and
  weights memory by agent id, hat id, hat assignment id, project, team, work
  item, creating context, retention state, and similarity. Context-pack recall
  now handles attribution-derived similarity ranking/confidence and can join
  durable `MemoryEnvelope` KPI/utility/retention state through the production
  Cockroach envelope reader. The context pack now exposes that governance
  explanation on memory source pointers; remaining work is UI drill-down and
  review affordances for that payload;
- richer LGTM weak-point review beyond scoped runtime trace/log/metric evidence,
  including incident-specific query authoring, retained links back into LGTM,
  and UI affordances for drilling from a context item into the live trace,
  metric, or log explorer;
- richer UI detail pages that consume context item drill targets beyond the
  observe-act CLI and open the document, decision, meeting, trace, memory, and
  work-item explorers.
- richer policy-specific context-readiness rules per hat, phase, department,
  and work-item type. The generic production `enforceContextReadiness` gate
  already darkens lifecycle work slots for non-current packs, and tenant-config
  readiness can now hard-stop typed uncertainty signals, typed omissions, and
  unresolved contradictions, plus lifecycle blockers, stale inputs, and
  stale/archived items by prefix.
