# Agent-Native Knowledge Graph and Retrieval

## Purpose

The Organization Work OS needs a graph and retrieval layer over task management. Agents should be able to traverse from any project, initiative, task, meeting, discussion, decision, document, artifact, run, memory, or trace to the surrounding context that explains what happened and why.

This is agent-first infrastructure. Humans should benefit from the same graph, but the primary consumer is a Hermes agent trying to understand work without relying on chat memory, hidden inbox context, or stale summaries.

## Core Principle

Every important organizational object should be a graph node. Every important relationship should be a typed edge.

```text
Project
  -> Initiative
    -> Work Item
      -> Task / Defect / Capability Request / Review
        -> Assignment
        -> Hermes/Oz Run
        -> Evidence Artifact
        -> Gate Decision
        -> Meeting
        -> Discussion Thread
        -> Decision
        -> BRD / CA / ADR / Design Doc
        -> Skill / Memory / Trace
```

The task board is not only a board. It is an index into the Organization's working memory.

## Typed Graph Schema

Minimum node kinds:

```ts
type NodeKind =
  | "Project"
  | "Initiative"
  | "WorkItem"
  | "Task"
  | "Defect"
  | "CapabilityRequest"
  | "Gate"
  | "Decision"
  | "Vote"
  | "Meeting"
  | "DiscussionThread"
  | "Message"
  | "OneOnOne"
  | "TeamRoom"
  | "Broadcast"
  | "Document"
  | "BRD"
  | "CA"
  | "ADR"
  | "DesignDoc"
  | "Skill"
  | "MemoryRecord"
  | "Artifact"
  | "EvidencePackage"
  | "Trace"
  | "Run"
  | "Agent"
  | "HatAssignment"
  | "ScheduleBlock"
  | "PromptFlow"
  | "PromptFlowPhase"
  | "PromptFlowRun"
  | "UniversalAction"
  | "ActionObservation"
  | "PolicyDecision"
  | "Signal"
  | "ContextPack";
```

Every node should use a shared envelope:

```ts
type GraphNode = {
  id: string;
  kind: NodeKind;
  stableKey: string;
  title: string;
  summary: string;
  scope: {
    organizationId: string;
    projectId?: string;
    initiativeId?: string;
    workItemId?: string;
    taskId?: string;
    runId?: string;
  };
  provenance: ProvenanceEnvelope;
  access: AccessEnvelope;
  source: SourcePointer;
  indexing: IndexingHints;
  createdAt: string;
  updatedAt: string;
};

type ProvenanceEnvelope = {
  createdByType: "agent" | "human" | "system";
  createdById: string;
  agentId?: string;
  hatAssignmentId?: string;
  toolCallId?: string;
  modelRunId?: string;
  traceId?: string;
  confidence?: number;
};

type AccessEnvelope = {
  visibilityPolicyId: string;
  projectScope?: string;
  hatScopes: string[];
  redactionStatus: "none" | "partial" | "full";
};

type SourcePointer = {
  sourceType: "db" | "message" | "transcript" | "document" | "artifact" | "trace" | "memory" | "external";
  sourceId: string;
  sourceVersion?: string;
  citation?: string;
};

type IndexingHints = {
  deterministic: boolean;
  semantic: boolean;
  keywords: string[];
  freshness: "live" | "current" | "stale" | "archived";
};
```

## Edge Contract

Edges should be typed, timestamped, attributable to an agent/hat/tool, versioned, and reversible when created by mistake.

```ts
type EdgeKind =
  | "belongs_to"
  | "implements"
  | "blocks"
  | "depends_on"
  | "clarifies"
  | "decides"
  | "supersedes"
  | "superseded_by"
  | "contradicts"
  | "conflicts_with"
  | "invalidates"
  | "approves"
  | "rejects"
  | "requires"
  | "summarizes"
  | "cites"
  | "produced_by"
  | "discussed_in"
  | "decided_in"
  | "mentioned_in"
  | "evidence_for"
  | "caused_by"
  | "follow_up_to"
  | "assigned_to"
  | "reviewed_by"
  | "released_by"
  | "observed_in_trace"
  | "recalls_memory"
  | "writes_memory"
  | "uses_skill"
  | "executes_prompt_flow"
  | "executes_action"
  | "observed_as"
  | "scheduled_for"
  | "reviewed_by"
  | "derived_from"
  | "derived_from_doc"
  | "has_context_pack_item"
  | "redacts"
  | "governed_by_policy";
```

| Edge kind | Direction | Typical source | Typical target | Provenance required | Reversal behavior |
|---|---|---|---|---|---|
| `belongs_to` | child -> parent | Task | Initiative | importer/tool | versioned correction |
| `discussed_in` | subject -> conversation | Task | Meeting/Thread | message or transcript | reversible edge |
| `decided_in` | decision -> source | Decision | Meeting/Vote/Thread | meeting/vote ID | supersede decision |
| `evidence_for` | evidence -> claim/work | Artifact/Trace | Task/Gate | artifact and trace ID | reversible edge |
| `executes_prompt_flow` | run -> flow | PromptFlowRun | PromptFlow | flow version | supersede flow version |
| `executes_action` | phase/run -> action | PromptFlowPhase/Run | UniversalAction | action record ID | append correction |
| `observed_as` | action -> observation | UniversalAction | ActionObservation | tool output/trace | preserve observation |
| `scheduled_for` | block -> assignment/work | ScheduleBlock | HatAssignment/Task | schedule service | reschedule with audit |
| `reviewed_by` | output -> reviewer | Phase/Task/Gate | HatAssignment | gate decision | new review supersedes |
| `contradicts` / `conflicts_with` | node -> node | Decision/Doc | Decision/Doc | detector/tool ID | resolved by decision |
| `supersedes` / `superseded_by` | new -> old | Decision/Doc | Decision/Doc | approving hat | preserve old node |
| `has_context_pack_item` | pack -> item | ContextPack | Any node | retrieval query ID | regenerate pack |
| `redacts` | redaction -> source | PolicyDecision | Node/Edge | policy decision ID | policy-reviewed only |

## Discussion and Decision Capture

Discussions are not side-channel chatter. They are work artifacts.

Every one-on-one, team discussion, department report, executive meeting, vote, broadcast, review comment, and task thread must be linked to the relevant work graph before it opens:

```text
Meeting
  -> discussed_in -> Initiative
  -> discussed_in -> Task
  -> produced -> Decision
  -> produced -> FollowUpTask
  -> cited -> BRD / CA / ADR
  -> recorded_by -> Agent + HatAssignment
```

Decision records should include:

- decision statement;
- decision type;
- options considered;
- rationale;
- dissent or uncertainty;
- participating agents/hats;
- approving authority;
- affected project/initiative/task;
- affected docs, skills, policies, or code;
- expiration/review date when applicable;
- links to the meeting, discussion, vote, and evidence.

Agents should never need to ask "where was this decided?" without a graph answer.

## Discussion Anchor Invariant

The Organization must reject unanchored discussion. A meeting, thread, broadcast, report, vote, or one-on-one is only valid when it has a work anchor and a reason.

```ts
type DiscussionAnchorType =
  | "organization"
  | "department"
  | "portfolio"
  | "project"
  | "initiative"
  | "mission"
  | "work_item"
  | "task"
  | "defect"
  | "review"
  | "gate"
  | "release"
  | "incident"
  | "capability_request"
  | "policy"
  | "context_gap";

type DiscussionAnchor = {
  anchorType: DiscussionAnchorType;
  anchorIds: string[];
  reason: string;
  requiredByHatAssignmentId: string;
  expectedOutputs: Array<"decision" | "follow_up" | "document" | "memory" | "status" | "gate_result">;
};
```

Anchor expectations by level:

| Discussion type | Required anchor |
|---|---|
| Executive Board or C-suite meeting | Portfolio, project, initiative, policy, capability request, or organization-level decision item |
| Director meeting | Department plus project, initiative, policy, capability request, or queue-health work item |
| TPM meeting | Initiative, mission, blocker, dependency, release, or task set |
| Engineering manager/team meeting | Team plus task, defect, blocker, review, capability request, or performance/outcome review item |
| Developer discussion | Specific task, defect, review, subtask, run, or context gap |
| QA discussion | Test case, QA run, defect, release candidate, task, or gate |
| Security discussion | Credential request, policy change, security review, incident, or capability request |
| Architecture/Product/BA discussion | Project, initiative, BRD, CA, ADR, requirement gap, or gate |
| One-on-one | Work reason plus project, initiative, task, review, handoff, performance review, memory adaptation, or context gap |
| Broadcast/report | Team, department, project, initiative, task, incident, release, or signal anchor |

Rules:

- no anchor means no discussion is opened;
- the anchor must be visible under the active hat's scope and policy;
- if the topic is ambiguous, the system first creates or links an intake, context-gap, report, service-request, or capability-request work item, then opens the discussion against that item;
- if a discussion changes scope, the Meeting and Communication Service creates or links the new work item instead of letting the transcript drift;
- decisions inherit the discussion anchor and must also link the affected docs, tasks, policies, skills, runs, releases, or gates;
- off-anchor content becomes a follow-up work item or context-gap item before it can influence state;
- executive-down meetings should anchor at project or initiative level unless the topic is an organization policy/capability decision;
- TPM meetings should anchor at initiative or mission level and include linked blockers, dependencies, tasks, or releases;
- developer discussions should anchor at the concrete task, defect, review, run, or context gap being resolved.

## Retrieval Contract

The graph should support both deterministic traversal and semantic retrieval.

Deterministic retrieval:

- get all decisions for an initiative;
- get all meetings that discussed a task;
- get the BRD, CA, ADRs, and design docs required for a task;
- get blockers and their upstream causes;
- get review rejections and required rework;
- get all artifacts and traces produced by a run;
- get prior similar tasks and outcomes;
- get unresolved contradictions.

Semantic retrieval:

- find relevant discussions about a requirement;
- find similar defects and fixes;
- find architecture concerns related to a component;
- find why a task was split;
- find project-specific skills likely needed for this task;
- find memories from the same agent/hat/project/task pattern.

The retrieval service should always return:

- matched nodes;
- connecting edges;
- why each item was included;
- freshness;
- confidence;
- visibility/policy basis;
- citations or artifact pointers.

Response shape:

```ts
type RetrievalResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  citations: SourcePointer[];
  whyIncluded: Record<string, string>;
  policyDecisionId: string;
  freshness: "live" | "current" | "stale" | "archived";
  confidence: number;
  omittedDueToPolicy: Array<{
    nodeKind: NodeKind;
    reason: string;
  }>;
  nextRecommendedActions: string[];
};
```

## Graph Query Recipes

Agent-facing retrieval should include named query recipes:

```text
what_changed_since_last_handoff(taskId, agentId)
why_is_this_task_blocked(taskId)
which_decisions_govern_this_task(taskId)
which_docs_are_stale_for_this_initiative(initiativeId)
which_active_tasks_cite_superseded_decisions(projectId)
what_prior_work_is_most_similar(taskId, depth, outcomeFilter)
what_unresolved_contradictions_block_release(releaseId)
what_context_is_missing_before_start(taskId, hatAssignmentId)
```

Each query should return graph nodes, edges, citations, confidence, freshness, policy basis, and a next recommended action.

## Agent Context Packs

Agents should receive context packs instead of raw search dumps.

A context pack is a bounded, policy-checked graph slice for a specific agent, hat, task, and run.

Strict shape:

```ts
type ContextPack = {
  id: string;
  taskId?: string;
  runId?: string;
  agentId: string;
  hatAssignmentId: string;
  generatedAt: string;
  freshnessDeadline: string;
  sourceGraphVersion: string;
  policyVersion: string;
  tokenBudget: number;
  requiredItems: string[];
  optionalItems: string[];
  omittedItemsWithReason: Array<{ nodeId?: string; reason: string }>;
  contradictions: string[];
  staleInputs: string[];
  lifecycleBlockers: string[];
  citations: SourcePointer[];
};
```

Example contents:

```text
Task Context Pack
  -> task summary and acceptance criteria
  -> project and initiative goals
  -> required BRD / CA / ADR / design docs
  -> relevant decisions and dissent
  -> linked discussions and meeting summaries
  -> dependencies and blockers
  -> prior related tasks and outcomes
  -> required skills and memories
  -> active policies and allowed tools
  -> evidence expectations
```

Context packs should be regenerated when:

- task state changes;
- gate decisions change;
- new decisions are recorded;
- new docs are approved;
- meetings produce follow-up actions;
- QA or review bounces work back;
- memory adaptation changes relevant recall;
- hat assignment changes.

Rules:

- no Hermes run starts without a current context pack;
- context packs must show omissions instead of silently dropping inaccessible or stale data;
- agents can request `explain_context_gap` when a pack is incomplete;
- context packs become stale when governing decisions, required docs, gates, handoffs, or high-severity contradictions change.

## Handoff Briefs

A handoff brief should be generated when work is reassigned, paused, blocked, bounced from review/QA, or when a run terminates.

Required fields:

```text
current_state
last_actor_and_hat
goal
what_changed
attempted_paths
open_questions
known_risks
unresolved_contradictions
required_next_actions
evidence_links
context_pack_id
source_messages_and_summaries
```

Agents should consume handoff briefs before resuming work. Handoffs should link to source messages, decisions, artifacts, traces, and the context pack used by the prior agent.

MCP tools:

- `create_handoff_brief`;
- `read_handoff_brief`;
- `diff_handoff_context`.

## Decision Memory Lifecycle

Decisions should have lifecycle state:

```text
proposed
  -> accepted
  -> active
  -> challenged
  -> reaffirmed
  -> superseded
  -> deprecated
  -> expired
```

Every decision needs:

- scope;
- owner hat;
- review date;
- affected nodes;
- supersession links;
- contradiction policy;
- meeting/thread/vote provenance.

Agents should not treat an old ADR, BRD decision, product ruling, or architecture choice as active unless the graph says it still governs the current scope.

## MCP Tool Surface

Minimum graph and retrieval tools:

```text
read_work_graph
  scope: project | initiative | task | run | agent | hat
  returns: typed graph slice

trace_decision
  input: decisionId | taskId | initiativeId | question
  returns: decision, rationale, meeting/vote/discussion links, affected work

build_context_pack
  input: taskId, agentId, hatAssignmentId, runId
  returns: policy-checked context pack

search_org_context
  input: query, scope, allowed node types, recency, semantic/deterministic mode
  returns: ranked nodes, edges, citations, confidence

link_discussion_to_work
  input: threadId, workId, relationship, rationale
  effect: creates graph edge with audit

validate_discussion_anchor
  input: anchor, requested mode, organizer hat assignment, participant hats
  returns: allowed/denied, missing work item, required scope changes, policy rationale

open_discussion
  input: anchor, mode, participants, expected outputs
  effect: opens a thread/meeting only after anchor and hat-scope validation

send_work_broadcast
  input: anchor, audience, message type, payload
  effect: publishes a broadcast linked to the anchored graph node

record_decision
  input: decision fields, existing discussion anchor, rationale, alternatives, follow-up work
  effect: records a durable decision fact; graph node and edge projection follows

find_related_work
  input: workId, relationship types, depth
  returns: related tasks, defects, docs, decisions, memories, skills

read_entity_context
  input: nodeId, depth, relation filter
  returns: local graph neighborhood with citations

trace_artifact_provenance
  input: artifactId
  returns: producing run, task, agent, hat, trace, and gate usage

create_handoff_brief
  input: workId, runId, reason
  effect: creates handoff brief node and graph edges

explain_context_gap
  input: workId
  returns: missing docs, missing decisions, stale memories, ambiguous owners

detect_context_conflicts
  input: project | initiative | task
  returns: contradictory decisions/docs/acceptance criteria and required escalation

read_attention_queue
  input: agentId, hatAssignmentId, scope
  returns: prioritized attention items with required actions
```

All tools must enforce hat visibility, task scope, project scope, and memory policy before returning content.

Communication tools should call `validate_discussion_anchor` before opening one-on-ones, team chats, TPM meetings, director meetings, executive meetings, review panels, broadcasts, or votes. `link_discussion_to_work` should exist for repair and ingestion, not as permission to create orphaned discussion first and link it later.

## Storage Shape

Use CockroachDB for authoritative graph facts and audit.

Suggested tables:

- `graph_nodes`;
- `graph_edges`;
- `graph_node_versions`;
- `graph_edge_versions`;
- `discussion_anchors`;
- `conversation_threads`;
- `conversation_messages`;
- `meeting_transcripts`;
- `meeting_summaries`;
- `decision_records`;
- `context_pack_requests`;
- `context_pack_items`;
- `handoff_briefs`;
- `retrieval_queries`;
- `retrieval_results`;
- `decision_memory_records`;
- `discussion_summaries`;
- `context_conflicts`;
- `context_gaps`;
- `schedule_blocks`;
- `prompt_flow_definitions`;
- `prompt_flow_runs`;
- `prompt_flow_phase_runs`;
- `prompt_flow_gate_decisions`;
- `universal_action_records`;
- `action_observations`;
- `attention_items`;
- `lifecycle_compliance_snapshots`;

Use a vector index for semantic retrieval over selected node summaries, message summaries, documents, decisions, artifacts, and memories. Hindsight remains the Hermes memory substrate; the Organization graph controls work-scoped attribution, visibility, and traversal.

`discussion_anchors` should be immutable once a conversation opens. Additional anchors can be appended with audit when scope expands, but the original reason and work item remain part of provenance.

## Summarization and Ingestion

Every conversation mode should produce structured artifacts:

- raw transcript or message log when permitted;
- rolling summary;
- decisions;
- action items;
- open questions;
- dissent/uncertainty;
- linked work items;
- linked docs/artifacts;
- proposed memories;
- proposed skills;
- follow-up tasks.

The Meeting and Communication Service should call graph ingestion after every meeting close, thread resolution, broadcast, review comment, or one-on-one when the conversation touched work.

Close pipeline:

```text
raw transcript/message log
  -> rolling summary
  -> decision candidates
  -> action items
  -> dissent/uncertainty
  -> open questions
  -> contradictions
  -> proposed graph edges
  -> proposed memories
  -> human/hat review if confidence is low
```

Summaries must cite source spans/messages and carry confidence. Low-confidence summaries should not become active decision memory without review.

## Attention Surface

Agents need an attention queue computed from graph, task, runtime, and policy state.

```ts
type AttentionItem = {
  id: string;
  reason: string;
  urgency: "low" | "normal" | "high" | "blocking";
  ownerHat: string;
  sourceSignal: string;
  requiredAction: string;
  deadlineOrTtl?: string;
  blockingEntity?: string;
  contextPackId?: string;
  acknowledgementState: "new" | "acknowledged" | "snoozed" | "converted_to_work" | "closed";
};
```

Tools:

- `read_attention_queue`;
- `ack_attention_item`;
- `snooze_attention_item`;
- `convert_attention_to_work`.

## Contradiction Lifecycle

Contradictions should be first-class graph nodes, not buried in comments.

```text
detected
  -> triaged
  -> clarification_requested
  -> resolved_by_decision
  -> resolved_by_doc_update
  -> accepted_risk
  -> false_positive
```

Unresolved high-severity contradictions block `ready`, `review_approved`, and `release_ready`. Lower-severity contradictions appear in context packs and attention queues.

## Agent-Native Benefits

This graph makes agents better because they can:

- start work with complete scoped context;
- avoid repeating settled discussions;
- explain why they chose an approach;
- detect when a new request conflicts with prior decisions;
- find the right docs without guessing;
- trace blockers to owners and decisions;
- hand off work with durable context;
- evaluate whether acceptance criteria were actually met;
- request missing context as a task instead of hallucinating it;
- build project-specific skills from repeated patterns.

## Guardrails

- No hidden authority: every decision must link to the hat, meeting, vote, or gate that authorized it.
- No orphan discussions: every work-relevant discussion needs a work link or an explicit no-link reason.
- No raw over-retrieval: agents receive policy-filtered graph slices, not unrestricted transcripts.
- No stale context packs: context packs carry freshness and must refresh on state changes.
- No untraceable summaries: summaries link back to source messages, transcripts, artifacts, or traces.
- No memory confusion: Hindsight memory can enrich retrieval, but Organization graph facts decide work state and decision provenance.

## MVP Slice

The first slice should prove:

```text
initiative
  -> task
  -> team discussion
  -> decision
  -> BRD/CA link
  -> context pack
  -> Hermes run
  -> evidence artifact
  -> review decision
```

An agent should be able to ask:

```text
What do I need to know to work this task, and why?
```

The system should answer with a cited graph slice, not a generic search result.
