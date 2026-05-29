# Ambiguous Requirement to Curated Feature Lifecycle

The Organization must be able to receive a vague requirement and turn it into a well-considered feature. This lifecycle is the path from unclear intent to delivered, verified, and learned-from work.

The central idea: ambiguity is not a blocker to agentic work. It is a work type. The Work OS should recognize ambiguity, assign the right business/product hats, interview the customer or internal stakeholder, build artifacts, create evidence, and only then hand off to architecture and engineering.

## Lifecycle Goals

- Capture the original ambiguous requirement without losing nuance.
- Decide whether the work is customer-facing, internal platform, operational, security, documentation, or capability expansion.
- Ask the right clarifying questions before implementation.
- Let Product and Business hats interview the customer or internal stakeholder.
- Convert conversation into structured requirements, workflows, acceptance criteria, non-goals, risks, and success metrics.
- Produce BRD and supporting artifacts that Architecture, Engineering, QA, Delivery, and Review hats can enforce.
- Ensure implementation follows the clarified intent instead of the first interpretation.
- Preserve the evidence chain from original request to shipped feature.
- Feed learnings back into memory, project skills, templates, test cases, and future discovery.

## Requirement Maturity States

The Work OS should track requirement maturity separately from implementation status.

```text
raw_intake
  -> classified
  -> ambiguity_scored
  -> discovery_required
  -> interview_planned
  -> interview_in_progress
  -> source_evidence_captured
  -> requirements_drafted
  -> workflow_modeled
  -> acceptance_criteria_drafted
  -> brd_review
  -> product_signoff
  -> architecture_ready
  -> implementation_ready
```

The requirement maturity state should gate the normal work item state. A customer-facing or ambiguous feature should not move to `ready` unless it has reached `implementation_ready` or has an explicit approved no-discovery/no-BRD decision.

## Business Quality Gate Chain

Ambiguous/customer-facing work must pass business gates before it becomes
engineering work and again before it is merged into `main`.

| Phase | Artifact | Gate kind | Required before |
|---|---|---|---|
| RFP / discovery brief | what exists, what is missing, what needs extension, risks, unknowns | `customer_rfp_review` | BRD drafting |
| Business requirements | BRD, business rules, acceptance criteria, non-goals | `brd_approval` | architecture |
| Architecture | CA, ADRs, design docs, workflow and data model | `architecture_approval` | implementation |
| Implementation | code, tests, branch evidence | `implementation_review` | runtime validation |
| Runtime validation | QA/browser evidence, screenshots, logs, traces | `runtime_validation` | final business validation |
| Outcome validation | rule-by-rule BRD outcome report | `final_business_validation` | release readiness |
| Release readiness | gate summary and branch evidence package | `release_readiness` | merge to `main` |

The RFP / discovery brief is the first customer gate. It tells the customer or
user what the Organization believes already exists, what is missing, and what
must be extended or developed. If the customer rejects that framing, the work
returns to discovery instead of moving to BRD.

Final business validation is separate from QA. QA proves the behavior is
working; final business validation proves the working behavior satisfies the
BRD and any changed-by-decision business rules. An approved final business gate
requires every business rule to be `satisfied`, `not_applicable`, or
`changed_by_decision`.

## Phase 1: Intake and Ambiguity Detection

When a goal, report, or service request enters the Work OS, the first job is to preserve the request and classify it.

Required outputs:

- original request;
- requester identity or source;
- customer or internal stakeholder;
- affected project or product area if known;
- raw desired outcome;
- perceived urgency;
- initial ambiguity score;
- likely departments required;
- risk flags.

Signals:

- `RequirementReceived`
- `RequirementClassified`
- `AmbiguityDetected`
- `DiscoveryRequired`

Automation:

```text
new requirement
  -> classify domain
  -> score ambiguity
  -> detect customer-facing or internal-customer impact
  -> attach existing project docs and memories
  -> route to Product/Business Discovery queue
```

Ambiguity scoring should consider:

- unclear user or customer;
- unclear expected behavior;
- missing current-state evidence;
- unknown success metric;
- undefined acceptance criteria;
- multiple plausible interpretations;
- cross-project or cross-repo scope;
- security, credential, data, or workflow impact;
- missing business owner;
- high cost or high delivery risk.

## Phase 2: Discovery Planning

The Product Owner, Requirement Clarifier, Customer Interviewer, and Business Analyst hats should plan discovery before talking to the customer.

Required outputs:

- discovery plan;
- interview participants;
- question set;
- known assumptions;
- required evidence;
- existing documentation to review;
- expected artifact set;
- decision on whether research, prototype, or architecture spike is needed.

Discovery plan structure:

```ts
type DiscoveryPlan = {
  requirementId: string;
  ownerHatAssignmentId: string;
  participants: string[];
  questions: string[];
  assumptionsToValidate: string[];
  evidenceToCollect: string[];
  existingDocsToReview: string[];
  requiredArtifacts: string[];
  targetMaturityState: "requirements_drafted" | "workflow_modeled" | "brd_review";
};
```

Signals:

- `DiscoveryPlanCreated`
- `InterviewRequested`
- `EvidenceRequested`

## Phase 3: Customer or Stakeholder Interview

The Customer Interviewer hat should run a structured interview. This can be a human conversation, an async questionnaire, or a scoped chat. The key is that answers become evidence, not unstructured chat residue. The interview thread should anchor to the goal intake, project, initiative, requirement gap, or discovery work item before it starts.

Interview modes:

- one-on-one customer interview;
- internal stakeholder interview;
- team discovery meeting;
- async clarification thread;
- follow-up interview after BRD draft;
- executive clarification for priority or non-goals.

Required captured evidence:

- exact questions asked;
- answers;
- unresolved questions;
- contradictions;
- examples and counterexamples;
- customer vocabulary;
- affected workflows;
- current pain;
- desired outcome;
- explicit non-goals;
- priority and deadline pressure;
- acceptance signals from the customer.

Signals:

- `InterviewStarted`
- `CustomerAnswerRecorded`
- `ClarificationQuestionOpened`
- `InterviewCompleted`

Guardrails:

- The interviewer cannot silently invent answers.
- Unanswered questions must remain visible.
- Conflicting answers must create a clarification task.
- Important assumptions must be marked as assumptions until approved.
- The original request and interview evidence must remain linked to the BRD.

## Phase 4: Requirement Synthesis

The Business Analyst and Requirements Analyst hats turn interview evidence into structured requirements.

Required outputs:

- problem statement;
- current workflow;
- desired workflow;
- personas or user roles;
- business rules;
- functional requirements;
- non-functional requirements;
- constraints;
- assumptions;
- non-goals;
- edge cases;
- open questions;
- acceptance criteria draft;
- success metrics;
- impacted projects, repos, systems, documents, memories, and skills.

Signals:

- `RequirementsDrafted`
- `OpenQuestionsRecorded`
- `AssumptionsRecorded`
- `AcceptanceCriteriaDrafted`

Quality checks:

- Every requirement should link to source evidence or an approved assumption.
- Acceptance criteria must be testable.
- Non-goals must be explicit when the scope could expand.
- Edge cases should be captured early enough for QA and Architecture.
- If requirements expose new work, create linked backlog items instead of bloating the feature.

## Phase 5: Workflow and Experience Modeling

Complex features need modeled workflows before architecture begins. This is where the Organization should be better than normal ticket trackers.

Required outputs:

- workflow map;
- state transitions;
- actor/user journey;
- system interactions;
- exception paths;
- permission boundaries;
- audit/evidence requirements;
- data lifecycle;
- notifications and status changes;
- UI state expectations if relevant;
- API or MCP tool implications if relevant.

For agentic/internal platform features, model:

- which hat initiates the workflow;
- which hats review it;
- which tools are involved;
- which triggers or schedules fire;
- which signals are emitted;
- which memories are read or written;
- which Oz/Hermes runs are launched;
- which release or activation flow applies.

Signals:

- `WorkflowModeled`
- `WorkflowGapDetected`
- `CapabilityGapDetected`

## Phase 6: BRD Creation and Review

The BRD is the contractual bridge between discovery and architecture.

BRD minimum contents:

- original request;
- customer/stakeholder context;
- problem statement;
- desired outcome;
- personas or roles;
- current workflow;
- target workflow;
- functional requirements;
- non-functional requirements;
- business rules;
- acceptance criteria;
- success metrics;
- assumptions;
- non-goals;
- risks;
- open questions;
- linked evidence;
- impacted projects and systems;
- follow-up backlog items.

Review hats:

- BRD Author creates the BRD.
- BRD Reviewer checks clarity, evidence, testability, and completeness.
- Product Owner signs off product intent.
- Business Approver signs off business readiness.

Signals:

- `BrdDraftCreated`
- `BrdReviewRequested`
- `BrdRejected`
- `BrdApproved`
- `ProductSignoffRecorded`

Rejection reasons should be typed:

- missing customer evidence;
- ambiguous acceptance criteria;
- conflicting requirements;
- missing workflow;
- missing non-goals;
- unresolved high-impact question;
- incorrect project scope;
- premature architecture handoff.

## Phase 7: Architecture and Technical Design

Architecture begins after the business shape is stable enough.

Required outputs:

- CA or design doc;
- ADRs when a structural decision is made;
- integration boundaries;
- data model impact;
- runtime impact;
- workflow impact;
- security and credential impact;
- observability requirements;
- migration or rollout plan;
- test strategy input;
- architectural non-goals;
- implementation slices.

Signals:

- `ArchitectureReviewRequested`
- `CaCreated`
- `AdrRequired`
- `ArchitectureRejected`
- `ArchitectureApproved`

Architecture should push back when:

- BRD is ambiguous;
- workflow is not modeled;
- acceptance criteria are not testable;
- security scope is unclear;
- project boundaries are wrong;
- implementation slice is too large;
- required observability is missing.

## Phase 8: Feature Decomposition

The TPM, Engineering Manager, Product Owner, Architect, and QA hats collaborate to split the approved feature.

Required outputs:

- initiative if scope is large enough;
- initiative branch plan;
- CI/CD and deployment automation plan;
- task breakdown;
- dependencies;
- required hats;
- review gates;
- QA plan;
- release plan;
- preview or QA environment plan;
- documentation requirements;
- memory and project skill requirements;
- budget and capacity estimate.

Signals:

- `InitiativeCreated`
- `InitiativeBranchRequested`
- `AutomationPlanCreated`
- `FeatureDecomposed`
- `TaskCreated`
- `RequiredHatsComputed`
- `QaPlanCreated`
- `ReleasePlanCreated`

Rules:

- Tasks should be small enough to test and review.
- Every task should link to BRD and CA context or a documented no-doc exception.
- Every task should have acceptance criteria.
- Every task should specify expected evidence.
- Every task should list required hats and review gates.
- Implementation tasks should target the initiative branch, not `main`.
- Code-producing tasks should include any CI, deployment, preview environment, rollback, or observability automation needed to test and operate the work.

## Phase 9: Implementation Readiness

Before an implementer starts, the Engineering Manager or Readiness Reviewer checks the work packet.

Readiness checklist:

- BRD approved or no-BRD exception approved;
- CA/ADR/design docs approved if required;
- initiative branch created or requested;
- automation package planned or no-automation decision approved;
- acceptance criteria linked;
- test strategy linked;
- QA plan linked;
- security/credential review requested if needed;
- project skills and repo docs attached;
- relevant memories attached;
- required hats available or queued;
- budget and runtime constraints known;
- dependencies resolved or explicitly sequenced.

Signals:

- `ImplementationReadinessRequested`
- `ImplementationReady`
- `ImplementationReadinessRejected`

Readiness rejection should route to the missing owner: Product, BA, Architecture, Security, Memory, QA Engineering, TPM, or Director.

## Phase 10: Implementation, Review, QA, and Release

Once implementation starts, the normal Work OS flow takes over, but it remains anchored to the discovery artifacts.

Implementation must:

- read BRD, CA, ADRs, project skills, memories, and acceptance criteria;
- create red tests first for defects and implementation work;
- create or update CI/CD, deployment, preview, rollback, and observability automation required by the feature;
- record green test evidence;
- submit artifacts and trace links;
- request code review.

Review must:

- compare implementation against BRD and CA;
- verify tests and evidence;
- reject scope drift;
- enforce policy and documentation requirements.

QA must:

- verify against acceptance criteria and workflow model;
- use the branch preview or QA deployment when applicable;
- run browser/API checks as needed;
- attach screenshots, logs, traces, reproduction steps;
- sign off or bounce back when the issue remains reproducible or the behavior is insufficient.

Delivery must:

- validate gate chain;
- verify initiative branch QA signoff;
- verify automation package completeness;
- create release candidate;
- merge the fully approved initiative branch to `main`;
- record merge/release/activation evidence;
- verify the system build after merge;
- require post-release verification when needed.

## Phase 11: Outcome Review and Learning

The lifecycle is not done when the feature ships. The Organization should review whether the original ambiguous requirement was successfully transformed into the intended outcome.

Outcome review checks:

- Did the delivered behavior satisfy the original customer need?
- Did acceptance criteria cover the important cases?
- Were any customer questions misunderstood?
- Did BRD, CA, ADRs, tests, QA, and release artifacts stay linked?
- Were there avoidable rework loops?
- Were the right hats assigned?
- Did memory retrieval help?
- Did the project need a new skill?
- Did the workflow reveal a missing MCP tool, Temporal workflow, Dapr actor, credential scope, or UI feature?

Possible follow-up work:

- memory adaptation request;
- project skill creation;
- test case expansion;
- BRD template improvement;
- interview question template improvement;
- architecture guideline update;
- capability request;
- backlog item for adjacent scope;
- hat effectiveness review.

Signals:

- `OutcomeReviewStarted`
- `CustomerOutcomeVerified`
- `DiscoveryGapFound`
- `MemoryAdaptationRequested`
- `ProjectSkillRequested`
- `CapabilityRequested`
- `OutcomeReviewCompleted`

## Required Work OS Support

To make this lifecycle real, the Work OS needs these capabilities:

- requirement maturity state separate from task implementation state;
- interview records linked to BRDs;
- structured question and answer capture;
- assumption tracking;
- open question tracking;
- workflow modeling artifacts;
- BRD and product signoff gates;
- CA/ADR/design gates;
- readiness gate that blocks premature engineering;
- artifact requirements by state;
- customer/stakeholder communication threads;
- role-specific discovery queues;
- signals for discovery lag and stale questions;
- outcome review templates;
- feedback path into memory, skills, tests, docs, tools, and workflows.

## Lifecycle Signals

Add these signal families to the Work OS:

| Signal family | Examples |
|---|---|
| Requirement maturity | `RequirementReceived`, `AmbiguityDetected`, `DiscoveryRequired`, `RequirementsDrafted`, `WorkflowModeled`, `ImplementationReady` |
| Interview | `InterviewRequested`, `InterviewStarted`, `CustomerAnswerRecorded`, `ClarificationQuestionOpened`, `InterviewCompleted` |
| BRD/Product | `BrdDraftCreated`, `BrdReviewRequested`, `BrdApproved`, `BrdRejected`, `ProductSignoffRecorded` |
| Architecture readiness | `CaCreated`, `ArchitectureApproved`, `ArchitectureRejected`, `AdrRequired` |
| Decomposition | `FeatureDecomposed`, `RequiredHatsComputed`, `QaPlanCreated`, `ReleasePlanCreated` |
| Learning | `DiscoveryGapFound`, `CustomerOutcomeVerified`, `ProjectSkillRequested`, `MemoryAdaptationRequested` |

## UI Requirements

The UI should show an ambiguous requirement becoming a feature.

Needed views:

- Requirement maturity board;
- discovery queue;
- interview workspace;
- question and answer evidence panel;
- assumptions and open questions panel;
- workflow model viewer;
- BRD review and product signoff queue;
- architecture readiness queue;
- implementation readiness checklist;
- artifact lineage from original request to release;
- outcome review and learning panel.

Humans should be able to see not just that a task is in progress, but whether the Organization actually understood the request before building.
