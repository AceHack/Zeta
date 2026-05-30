---
title: Org-Native Change Control — internal review fabric; PRs/MRs become an optional port
canonical_name: Agentic Organization
status: design
composes_with:
  - WORK_AND_RELEASE_MANAGEMENT_OS.md
  - WORK_OS_OVERHAUL_GAPS_AND_DESIGN.md
  - STATE_RECONCILIATION.md
  - METRICS_AND_REVIEW_BOARD.md
  - BUSINESS_QUALITY_GATE_SYSTEM.md
  - DYNAMIC_MEMORY_SYSTEM_DESIGN.md
  - ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md
  - OBSERVE_COMPOSER_AND_RUN_STATE.md
code_anchors:
  - packages/domain/src/work-item-state-machine.ts
  - packages/domain/src/work-item.ts
  - packages/domain/src/org-event.ts
  - packages/application/src/org-decision.ts
  - packages/application/src/qa.ts
  - packages/application/src/observe-for-hat.ts
  - packages/memory/src/hindsight-memory.ts
---

# Org-Native Change Control

## 0. The reframe

A corporation does not "open a pull request." It **reviews a change** through its
own process and, *if it happens to host code on GitHub*, projects one stage of that
process onto a PR so a human outside the org can sign off. The Git PR is a
**leaf**, not the trunk.

> A Jira card moving `in progress → code review` is one coarse external hop. Inside
> the org it expands into a fine-grained pipeline the org owns — internal code
> review → internal QA → security → … — and only the stage that genuinely needs a
> human *external to the org* materializes as a PR/MR or an external sign-off.

This document specifies the **canonical internal change-control object** (the
`ChangeSet`) and the **port layer** that projects it onto GitHub / GitLab / Jira —
**bidirectionally, lazily, and optionally.** We are not implementing GitHub's
`branch → PR → review → merge` shape and bolting the org onto it. We implement the
org's process and give Git a translation adapter. An org that wants no external
system at all runs the entire review fabric internally with **zero projections**.

This is the same architectural move the [memory system](DYNAMIC_MEMORY_SYSTEM_DESIGN.md)
made with Hindsight: **one canonical object we own, composed with external engines
through a port — never forked, never subordinated.**

## 1. The five elegance invariants

Everything below follows from five rules. They are the whole design; the rest is
their mechanical consequence.

1. **One canonical object, many projections.** The `ChangeSet` is the source of
   truth. A GitHub PR, a GitLab MR, a Jira card are *projections* created on demand
   and reconciled back. Delete every external system and the org still works.
2. **A review stage is an `observe → decide` org cycle.** Determinism computes the
   legal advance/block/request-changes set; the stage's *authority* chooses within
   it; every transition emits one `org_event`. This is the keystone kernel
   ([`OBSERVE_COMPOSER_AND_RUN_STATE`](OBSERVE_COMPOSER_AND_RUN_STATE.md)) applied to
   review — identical to how the org cycle, Work OS, and memory maintenance work.
3. **The external PR is just a stage whose authority lives outside the org.** A
   stage's authority is a discriminated union — an internal hat, a quorum board, a
   human, or an *external system via a port*. The kernel handles all four
   uniformly. "Wait for a human to approve the GitHub PR" is not a special case; it
   is a `ReviewStage` with `authority = External(github)`, satisfied by a port poll.
4. **The change payload is Git-agnostic.** A `ChangeSet` reviews typed
   `ChangeArtifact`s — code diffs, doc edits, config changes, schema migrations,
   decision records, opaque artifact refs. A PR can only represent code-file diffs;
   the `ChangeSet` is a strict superset. The org reviews *any* change through one
   fabric; the Git port renders only the artifacts Git can carry.
5. **Clamp discipline holds.** A hat cannot advance a `ChangeSet` past a stage whose
   gate is unsatisfied, cannot approve a stage it does not own, cannot fabricate an
   external approval. Same kernel guarantee as the memory citation anti-laundering
   and the org-cycle legal-set clamp — `Math.max(0, Math.min(len-1, idx))` over a
   deterministically-computed legal set.

## 2. The canonical model

### 2.1 `ChangeSet` — the internal "PR" (Git-agnostic)

```ts
// CONTENT-ADDRESSED like memory: changeSetId = uuidv5(org:workItem:targetRef:revision)
export type ChangeSet = {
  changeSetId: string;
  organizationId: string;
  workItemId: string;            // the work this change advances (the join to the Work OS)
  proposerHatId: string;         // who opened it (authority under which it was proposed)
  title: string;
  targetRef: string;             // what it changes against (a branch name, a doc id, a service…)
  phase: ChangeSetPhase;         // overall lifecycle (House-DU)
  pipelineId: string;            // the ReviewPipeline (stages-as-data) it runs through
  currentStageIndex: number;     // cursor within the pipeline while in_review
  artifacts: readonly ChangeArtifact[];
  projections: readonly ProjectionRef[];  // external materializations (PR/MR/card), if any
  revision: number;              // bumps on each changes-requested → resubmit
  openedAt: string;
  updatedAt: string;
};
```

### 2.2 `ChangeSetPhase` — the lifecycle (House-DU, mirrors `HatBinding`/`MemoryPhase`)

```ts
export const ChangeSetPhase = {
  Drafted: "drafted",            // proposer assembling artifacts
  InReview: "in_review",         // moving through the pipeline (cursor = currentStageIndex)
  ChangesRequested: "changes_requested",  // a stage returned blocking findings
  Approved: "approved",          // every blocking stage passed
  Applied: "applied",            // change materialized into target (+ external merge if projected) — TERMINAL
  Rejected: "rejected",          // hard-rejected — TERMINAL
  Withdrawn: "withdrawn",        // proposer pulled it — TERMINAL
} as const;
export type ChangeSetPhase = (typeof ChangeSetPhase)[keyof typeof ChangeSetPhase];

export const TerminalChangeSetPhases: ReadonlySet<ChangeSetPhase> =
  new Set([ChangeSetPhase.Applied, ChangeSetPhase.Rejected, ChangeSetPhase.Withdrawn]);
```

The legal transitions are a pure function — the determinism half of the kernel.
The chooser (a hat / human / port) picks within it; the kernel clamps:

```ts
export function legalChangeSetTransitions(cs: ChangeSet, pipeline: ReviewPipeline): readonly ChangeSetPhase[] {
  switch (cs.phase) {
    case "drafted":            return [P.InReview, P.Withdrawn];
    case "in_review":          return moreStagesRemain(cs, pipeline)
                                 ? [P.InReview, P.ChangesRequested, P.Rejected, P.Withdrawn]   // advance | bounce | kill
                                 : [P.Approved, P.ChangesRequested, P.Rejected, P.Withdrawn];  // last stage → approve
    case "changes_requested":  return [P.InReview, P.Withdrawn];  // proposer revises + resubmits (revision++)
    case "approved":           return [P.Applied, P.Withdrawn];
    default:                   return []; // terminal
  }
}
```

### 2.3 `ChangeArtifact` — typed, Git-agnostic change payload

```ts
export type ChangeArtifact =
  | { kind: "code_diff";       path: string; diff: string; language: string }
  | { kind: "doc_change";      path: string; before: string; after: string }
  | { kind: "config_change";   key: string;  before: string; after: string }
  | { kind: "schema_migration"; migrationId: string; sql: string }
  | { kind: "decision_record"; decisionId: string; summary: string }
  | { kind: "artifact_ref";    uri: string;  contentType: string };
```

> **Why this is more general than a PR.** A GitHub PR can natively represent only
> `code_diff` (and, awkwardly, `doc_change`/`config_change` as file diffs). The
> review fabric reviews a `schema_migration`, a `decision_record`, or an
> `artifact_ref` through the *same* stages, gates, threads, and approvals. When such
> a `ChangeSet` projects to GitHub, the port renders the Git-representable artifacts
> as a branch/PR and leaves the rest internal — the review of record stays ours.

### 2.4 `ReviewPipeline` — review stages as DATA, not Git's opinion

```ts
export type ReviewStage = {
  id: string;                    // "internal-code-review" | "internal-qa" | "security" | "external-code-review" | "human-qa-signoff"
  ownerLabel: string;           // human-readable owner ("code_reviewer", "qa_reviewer", …)
  authority: ReviewAuthority;    // WHO satisfies this stage (the elegance: a DU)
  gate: ReviewGateKind;          // WHAT must be true to pass
  blocking: boolean;             // must pass to advance vs advisory
  projectTo?: ExternalSystem;    // if set, materialize an external PR/MR/card for this stage
};

export type ReviewPipeline = { pipelineId: string; organizationId: string; stages: readonly ReviewStage[] };
```

`ReviewAuthority` is the keystone DU — it unifies internal hats, the ≥3-agent
review board, humans, and external systems under one kernel:

```ts
export type ReviewAuthority =
  | { kind: "hat";      hatId: string }                              // an internal hat decides (observe→decide chooser)
  | { kind: "quorum";   hatIds: readonly string[]; threshold: number } // the ≥3-agent review board (METRICS_AND_REVIEW_BOARD)
  | { kind: "human";    role: string }                              // a human must sign off → org pauses (HITL)
  | { kind: "external"; system: ExternalSystem };                   // satisfied by a port poll (GitHub PR approved, …)
```

```ts
export const ReviewGateKind = {
  ArtifactsPresent: "artifacts_present",     // the change actually carries the claimed artifacts
  TestsGreen: "tests_green",                 // QA: the test run for this change passed (reuses qa.ts)
  NoBlockingFindings: "no_blocking_findings",// no unresolved blocking review thread (our thread-resolution, org-owned)
  QuorumAgreed: "quorum_agreed",             // ≥ threshold reviewers approved (the review board)
  ExternalApproved: "external_approved",     // the projection's external state reports approved
} as const;
```

A `ChangeControlPolicy` (per work-type or per-org, **tenant configuration** per the
[Adaptive Platform](ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md)) selects which pipeline
a `ChangeSet` runs. A fully-internal org's pipeline has **no `projectTo` and no
`human` stages**; a GitHub-using org adds one `external-code-review` stage with
`authority = External(github)` and `projectTo = github`.

## 3. The kernel — a review stage is an `observe → decide` cycle

```ts
// determinism computes the legal stage outcomes; the stage's AUTHORITY chooses; clamp; one org_event.
export type StageOutcome = "approve" | "request_changes" | "reject";

export function legalStageOutcomes(stage: ReviewStage, gate: GateEvaluation): readonly StageOutcome[] {
  if (!gate.satisfiable) return ["request_changes", "reject"]; // can't approve an unsatisfied gate — the clamp
  return stage.blocking ? ["approve", "request_changes", "reject"] : ["approve", "request_changes"];
}

export async function runReviewStage(cs: ChangeSet, stage: ReviewStage, deps): Promise<StageResult> {
  const gate = await evaluateGate(stage.gate, cs, deps);          // observe: is the gate satisfiable?
  const legal = legalStageOutcomes(stage, gate);
  const decision = await decideByAuthority(stage.authority, cs, stage, legal, deps); // decide: WHO + clamp
  // decision is clamped to `legal` exactly like chooseWithinLegal in org-decision.ts
  return applyStageDecision(cs, stage, decision); // emit: ReviewStageAdvanced | ChangesRequested | ChangeSetRejected
}
```

`decideByAuthority` is the one place the four authorities differ, and they differ
*only in where the choice comes from* — the legal set, the clamp, and the emitted
event are identical:

| `authority.kind` | How the choice is obtained | HITL? |
|---|---|---|
| `hat` | the owning hat's chooser (deterministic baseline or model-backed), clamped to `legal` | no |
| `quorum` | collect ≥ `threshold` hat approvals (the review board); `QuorumAgreed` gate | no |
| `human` | **pause** the `ChangeSet` and surface a HITL task; resume on the human's decision | yes |
| `external` | `port.pull(ref)` until the external state is terminal; map it to a `StageOutcome` | yes (external) |

> This is the elegance: **"wait for a human to approve the PR" is not bespoke
> orchestration.** It is `authority: External(github)` whose gate is
> `ExternalApproved`, satisfied by the port. Internal stages and external sign-off
> are the same shape; the pipeline is a flat list of stages and the kernel walks it.

### 3.1 Advancing the `ChangeSet`

```
runReviewStage(currentStage):
  approve          → currentStageIndex++ (emit ReviewStageAdvanced)
                     if no stages remain → phase = Approved (emit ChangeSetApproved)
  request_changes  → phase = ChangesRequested (emit ChangesRequested); back to proposer
  reject           → phase = Rejected (emit ChangeSetRejected) — terminal
```

On `ChangesRequested → InReview` the proposer resubmits with `revision++`; the
pipeline re-runs from the first stage whose gate the revision could have changed
(deterministic: re-run blocking stages whose artifacts changed). `Approved → Applied`
runs the apply step: materialize the artifacts into the target and, if projected,
merge the external PR/MR through the port.

## 4. The port layer — projections, not forks

```ts
export type ExternalSystem = "github" | "gitlab" | "jira" | "none";

export type ProjectionRef = {
  system: ExternalSystem;
  externalId: string;            // PR number, MR iid, Jira key
  url: string;
  lastSyncedState: string;       // the external state we last reconciled
  syncedAt: string;
};

export interface ChangeControlPort {
  system: ExternalSystem;
  project(cs: ChangeSet, stage: ReviewStage): Promise<ProjectionRef>;            // create the PR/MR/card
  pull(ref: ProjectionRef): Promise<ExternalReviewState>;                        // poll external state (approved? merged?)
  push(ref: ProjectionRef, stage: ReviewStage, outcome: StageOutcome): Promise<void>; // mirror internal → external
}
```

Adapters: `createGitHubPrPort`, `createGitLabMrPort`, `createJiraCardPort`, and the
**`NullChangeControlPort`** for internal-only orgs (every method a no-op; the fabric
runs unchanged). This is structurally identical to
[`createHindsightMemory`](hindsight-memory.ts) behind the `Memory` port — *compose,
don't fork.* The internal `ChangeSet` is canonical; the port is a translation seam.

**Bidirectional reconciliation** is two deterministic arrows:

- **internal → external** (`push`): when a projected stage advances internally, mirror
  the status onto the PR/MR/card (a status check, a comment, a card transition).
- **external → internal** (`pull`): when a human approves the GitHub PR, the next
  `runReviewStage` over that `External` stage reads `port.pull(ref) = approved`,
  satisfies the `ExternalApproved` gate, and advances the `ChangeSet`. The external
  approval *flows into the internal kernel* as a gate satisfaction — it does not
  bypass it.

### 4.1 Per-artifact projection

A port projects only the artifacts its system can carry. `createGitHubPrPort`
renders `code_diff` (and `doc_change`/`config_change` as file diffs) into a branch +
PR; a `schema_migration` or `decision_record` stays an internal artifact referenced
from the PR body. The review of record — threads, quorum, gates — remains the
`ChangeSet`'s. GitHub becomes a *view* a human can use, not the system of record.

## 5. Storage — Cockroach `ChangeControlV17`

Mirrors the established pattern (TS-generated SQL + on-disk `.sql` mirror + parity
test; CHECK constraints from `Object.values(enum)`):

```sql
CREATE TABLE agentic_org_change_sets (
  change_set_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  proposer_hat_id STRING NOT NULL,
  title STRING NOT NULL,
  target_ref STRING NOT NULL,
  phase STRING NOT NULL,
  pipeline_id STRING NOT NULL,
  current_stage_index INT8 NOT NULL,
  artifacts JSONB NOT NULL,         -- ChangeArtifact[]
  projections JSONB NOT NULL,       -- ProjectionRef[]
  revision INT8 NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT agentic_org_change_sets_phase_check CHECK (phase IN (…Object.values(ChangeSetPhase)…)),
  INDEX change_sets_by_work (work_item_id),
  INDEX change_sets_by_org_phase (organization_id, phase)
);

CREATE TABLE agentic_org_review_stage_status (   -- the per-stage audit ledger
  change_set_id STRING NOT NULL,
  stage_id STRING NOT NULL,
  revision INT8 NOT NULL,
  outcome STRING NULL,              -- approve | request_changes | reject | (pending)
  decided_by STRING NULL,           -- hatId | "human:<role>" | "external:<system>"
  decided_at TIMESTAMPTZ NULL,
  PRIMARY KEY (change_set_id, stage_id, revision)
);
```

`ReviewPipeline` definitions are tenant config (one row per pipeline, stages JSONB)
co-located with the other Adaptive-Platform configuration tables.

## 6. Reconciliation — extend `STATE_RECONCILIATION`, never duplicate

The `ChangeSet` does **not** invent a parallel state model. It reconciles into the
one authoritative mapping ([`STATE_RECONCILIATION`](STATE_RECONCILIATION.md)):

| ChangeSet phase @ stage | WorkItemState | GitHub | Jira |
|---|---|---|---|
| `in_review @ internal-*` | `review` | *(none — internal only)* | `In Review` |
| `in_review @ external-code-review` | `review` | PR `open, review_requested` | `In Review` |
| `changes_requested` | `in_progress` | PR `changes_requested` | `In Progress` |
| `approved` | `review` | PR `approved` | `In Review` |
| `applied` | `done` / `release` | PR `merged` | `Done` |

The external systems see **coarse** transitions; the org runs the **fine-grained**
pipeline between them. That gap — the internal stages a card silently passes through
— *is the product.*

## 7. `org_event` trace (added to the union)

`ChangeSetOpened`, `ReviewStageAdvanced`, `ReviewFindingRaised`, `ChangesRequested`,
`StageApproved`, `ChangeSetApproved`, `ChangeSetApplied`, `ChangeSetRejected`,
`ProjectionCreated`, `ProjectionSynced`, `HumanSignoffRequested`. Every transition is
one `org_event` with `actorHatId`, `supervisorChain`, `decision`, and
`correlation/causation/trace` — readable in the same snapshot as the rest of the org.

## 8. Who owns it — reuses seeded hats, no new department

The review fabric is run by hats the org already seeds (see
`state-reconciliation.ts`): `code_reviewer` (internal code review stage),
`qa_reviewer` + the QA department (the `tests_green` gate, reusing
[`qa.ts`](../packages/application/src/qa.ts)), a security reviewer (security stage),
the ≥3-agent **review board** ([`METRICS_AND_REVIEW_BOARD`](METRICS_AND_REVIEW_BOARD.md))
for `quorum` stages, and `release_manager` (the apply step + port sync). No new
department — change control is the **release stage of the Work OS turned inside out.**

## 9. Phased build plan (each phase proven in kind, the established bar)

| Phase | Deliverable |
|---|---|
| **CC0** | This doc + the `OrgEventKind` additions + the two Cockroach tables (migration `ChangeControlV17` + on-disk mirror + parity test). |
| **CC1** | Domain: `ChangeSet`/`ChangeSetPhase` (House-DU) + `ChangeArtifact` + `ReviewStage`/`ReviewAuthority`/`ReviewGateKind` DUs + `legalChangeSetTransitions` + `legalStageOutcomes` — pure, unit-tested. |
| **CC2** | Cockroach stores (change-set + stage-status) + parity test; content-addressed `changeSetId`. |
| **CC3** | The kernel: `runReviewStage` (observe→decide, clamp, emit) + `decideByAuthority` (hat / quorum / human-pause / external) + `advanceChangeSet` + the anti-fabrication clamp (can't approve a gate you don't own) — unit-tested. |
| **CC4** | The `ChangeControlPort` + `NullChangeControlPort` + an in-process fake external system; the reconciliation-table extension; `ChangeControlPolicy`-as-data. |
| **CC5** | `createGitHubPrPort` (first real adapter): `project`/`pull`/`push` + bidirectional sync + per-artifact rendering. Live GitHub proof is credential-gated; the **in-kind proof uses the fake port** to exercise the full projection + reconciliation seam without external tokens. |
| **CC6** | **Integrate into the Work OS release stage + prove end-to-end in kind:** a work item produces a `ChangeSet` → runs the internal pipeline (code review → QA quorum → security) → a `human` stage **pauses** (HITL) → approved → applied — first with `ExternalSystem.none` (zero projections), then re-run with the fake `external-code-review` stage showing the projection materialize + an external approval flow *back into* the gate. Observe via the org snapshot. |

The M-track / H-track independence pattern applies: the real Git/GitLab/Jira ports
(CC5+) can land any time after CC4 (the port already exists); the internal fabric
(CC0–CC4, CC6-with-fake) proves entirely in kind with no external accounts.

## 10. Worked example (what the trace will show)

```
work-42 reaches the release stage
  → ChangeSetOpened  cs-42  proposer=code_author  artifacts=[code_diff×3, schema_migration×1]
  → pipeline = [internal-code-review(hat), internal-qa(tests_green), security(quorum≥3), external-code-review(External github), human-qa-signoff(human)]

  [ReviewStageAdvanced]  internal-code-review  approve (code_reviewer)
  [ChangesRequested]     internal-qa           tests_green FAILED → back to proposer
  → proposer resubmits (revision 2); re-run from internal-qa
  [ReviewStageAdvanced]  internal-qa           approve (tests green)
  [ReviewStageAdvanced]  security              quorum_agreed 3/3 (review board)
  [ProjectionCreated]    external-code-review  → GitHub PR #128 (renders the 3 code_diffs; schema_migration stays internal)
  …human approves PR #128 externally…
  [ReviewStageAdvanced]  external-code-review  approve (External github → ExternalApproved gate satisfied via pull)
  [HumanSignoffRequested] human-qa-signoff     ⏸ org pauses for HITL
  …QA lead signs off…
  [ChangeSetApproved]    cs-42
  [ChangeSetApplied]     cs-42  → artifacts materialized to target; PR #128 merged via port
```

Externally, Jira saw `In Progress → In Review → Done` and GitHub saw one PR. The org
ran **five internal stages, a quorum board, a revision bounce, a projection, and two
human gates** between those hops. That internal trace is the org doing its own work.

## 11. Roadmap placement

Recommended order (this track **before** Document Intelligence):

```
1. Org-Native Change Control (CC)  ← this doc; PRs become a port; the review spine
2. Document Intelligence (D)        ← rides memory; references the ChangeSet for change-provenance
3. Knowledge Graph (G)              ← under D; change-edges reference ChangeSets
4. Adaptive Platform (C)            ← AutonomyPolicy (the human-gate config) + Jira/Linear sync reuse the port layer
```

Rationale: Change Control is a **constitutional substrate decision** — *how the org
ships* — and it removes the implicit Git-PR coupling the Work OS currently inherits.
Everything downstream (doc provenance, the graph's change-edges, the Adaptive
Platform's external sync) should reference the canonical `ChangeSet`, so it belongs
before the tracks built on top of it. It depends only on already-built substrate
(the Work OS + the gate model + the ≥3-agent board), introduces no new
infrastructure, and the port layer it establishes *is* the Adaptive Platform's
bidirectional-sync mechanism, generalized.

## 12. Composition summary

| Existing substrate | How Change Control composes |
|---|---|
| Work OS gates + `WorkflowPolicy` (built) | `ReviewGateKind` reuses the gate model; the pipeline is gates-as-data at review scope |
| ≥3-agent review board ([`METRICS_AND_REVIEW_BOARD`](METRICS_AND_REVIEW_BOARD.md)) | the `quorum` authority IS the review board |
| QA dept + `qa.ts` (built) | the `tests_green` gate runs the QA cycle for the change |
| `STATE_RECONCILIATION` | extended, not duplicated — ChangeSet phase maps into the one authoritative table |
| `org-decision.ts` `chooseWithinLegal` (built) | `decideByAuthority` clamps every stage decision to the legal set |
| `Memory` port + Hindsight (built) | the port-not-fork pattern this design mirrors exactly |
| Adaptive Platform `AutonomyPolicy` | configures which stages are `human` and which `projectTo` external |

The org reviews its own work, its own way, and lends Git a translator on request.
