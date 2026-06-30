---
title: Engagement Modes and Activation — the on-ness dial (how-much-on, what-wakes-it)
canonical_name: Agentic Organization
status: design
ideas: []
extends:
  - ./ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md
  - ./ALWAYS_ON_ORCHESTRATION_RUNTIME.md
composes_with:
  - ./ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md
  - ./ALWAYS_ON_ORCHESTRATION_RUNTIME.md
  - ./FORWARD_ROADMAP.md
  - ./WORK_AND_RELEASE_MANAGEMENT_OS.md
  - ./WORK_OS_OVERHAUL_GAPS_AND_DESIGN.md
  - ./AMBIGUOUS_REQUIREMENT_LIFECYCLE.md
  - ./UI_AND_OBSERVABILITY_CONCEPTS.md
  - ./OBSERVE_COMPOSER_AND_RUN_STATE.md
  - ./ORG_NATIVE_CHANGE_CONTROL_DESIGN.md
code_anchors:
  - ../packages/application/src/control-plane-guard.ts
  - ../packages/application/src/intake.ts
  - ../packages/application/src/observe.ts
  - ../packages/application/src/schedule-authority.ts
  - ../deploy/run-org-cadence.ts
supersedes: []
---

# Engagement Modes and Activation

When a customer stands up an Agentic Organization, they get to decide **how much
it runs and what makes it run** — independently of how much it can act without
them. That is the subject of this doc: the **EngagementPolicy** — the configurable
"on-ness" of the org — and the modes a tenant selects between (always-on,
scheduled, trigger-gated, requirement-driven, issue-sourced), wired into the
always-on worker, gated by the control-plane floor, fed by the intake seam, and
surfaced through the UI for visualization + interjection.

## 1. Two orthogonal axes — don't conflate them

The platform already has one tenant-configurable axis: the **autonomy dial**
(`AutonomyPolicy`, [Part 4 of the Adaptive Platform design](./ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md))
— `auto` / `human_review` / `human_approve` per `(workType, transition | gate)`.
That answers **"how much can it act without me?"**

Engagement is a **separate, orthogonal axis** answering **"what makes it run at
all, and how continuously?"** The two compose freely: a tenant can run
fully `auto` yet `requirement-driven` (acts without approvals, but only on work
the human feeds), or `always-on` yet `human_approve` on releases (runs
continuously, but blocks at the release gate).

```text
AutonomyPolicy      → how much human approval per action   (auto / human_review / human_approve)
EngagementPolicy    → what wakes the org + how continuously (this doc)
ControlPlaneGuard   → the hard on/off floor under both      (estop / freeze — control-plane-guard.ts)
```

The control plane is the **hard** dial (always able to halt, regardless of
engagement mode). Engagement is the **soft** dial — the gradations of "on" that
sit *above* the control-plane floor. "Off for free" already exists in
`control-plane-guard.ts` (estop / freeze); engagement modes describe the
**on**-states.

## 2. The engagement modes

Every mode is expressed as a binding over the **Durable Triggers** already
specified in [Always-On Orchestration Runtime § Durable Triggers](./ALWAYS_ON_ORCHESTRATION_RUNTIME.md)
(`event` / `state` / `state-timeout` / `scheduled` / `threshold` / `external`)
plus the **intake seam** (`intake.ts`) as the work-source. The mode is a
discriminated union; the trigger primitives are the implementation.

| Mode | What runs the org | Built from | Quiesces when |
|---|---|---|---|
| **`always_on`** | worker drives `runOrgCadence` every tick, continuously | the keep-alive lane pattern (Track A `A0`); org-scope `scheduled` trigger at tick cadence | never (keep-alive only on estop/freeze) |
| **`scheduled`** | wakes on a cadence (e.g. nightly), runs the cadence, then sleeps | `scheduled` Durable Trigger | between scheduled windows |
| **`trigger_gated`** | sleeps; specific events / thresholds / webhooks wake it | `event` / `threshold` / `external` Durable Triggers | when no trigger is firing |
| **`requirement_driven`** | runs **only** when the human feeds a requirement; drives it to terminal state; then idles — **no self-generated work** | `intake.ts` as the *sole* work source + autonomous-lane suppression | when all fed work reaches terminal state |
| **`issue_sourced`** | external issues (Jira / Linear / GitHub) ARE the trigger AND the intake | `external` Durable Trigger → `intake.ts` (`ExternalIntakeEvent`) + the change-control port layer (Track C `C3`) | when no unresolved external issues remain |

**Modes compose.** `issue_sourced` + `always_on` = continuously polls Jira;
`issue_sourced` + `trigger_gated` = wakes only on a Jira webhook;
`requirement_driven` + `scheduled` = drains the fed requirement queue once nightly.
So `EngagementPolicy` is not a single enum — it is a *mode* plus the bindings the
mode draws on.

## 3. The `requirement_driven` guardrail — no self-generated work

The mode you most need to name explicitly is **requirement-driven**: the org runs
*only* while the human (or an issue source) is feeding it requirements, drives
each to completion, and then **stops** — it does not invent its own work.

Operationally this is a config flag that **suppresses the org's autonomous work
lanes**, leaving only externally-fed work:

- **Work source restricted to intake.** Only `createWorkItemFromIntake` (in
  `intake.ts`) may originate a `WorkItem`. The org's own initiative-decomposition
  / opportunity-finding / self-directed lanes are disabled in this mode.
- **Run-to-completion.** Fed work items advance through the normal state machine
  (`Created → Intake → Triage → Ready → …`) and, where requirement-driven, through
  the requirement-maturity gates ([Ambiguous Requirement Lifecycle](./AMBIGUOUS_REQUIREMENT_LIFECYCLE.md))
  until they reach a **terminal state**.
- **Quiesce-on-empty.** When no work item is in a non-terminal state and no intake
  is pending, the org transitions to **quiescent** (see §5). It does not generate
  new requirements to stay busy.

This is the "feed it and it runs till done, then waits" behaviour — the opposite
of an always-on org that continuously generates and pursues its own initiatives.

## 4. The `EngagementPolicy` shape (type sketch)

Everything-as-configuration (Track C `C0`): `EngagementPolicy` is **tenant data**,
not hardcoded. Sketch (TypeScript, mirroring the existing
`control-plane-guard.ts` discriminated-union style):

```ts
export const EngagementModeKind = {
  AlwaysOn: "always_on",
  Scheduled: "scheduled",
  TriggerGated: "trigger_gated",
  RequirementDriven: "requirement_driven",
  IssueSourced: "issue_sourced",
} as const;
export type EngagementModeKind =
  (typeof EngagementModeKind)[keyof typeof EngagementModeKind];

export type EngagementSource =
  | { kind: "github"; repo: string }
  | { kind: "jira"; projectKey: string }
  | { kind: "linear"; teamId: string }
  | { kind: "manual" };           // human-fed via the UI / API

export type QuiescencePolicy =
  | { kind: "full_stop" }         // cadence lanes idle entirely until next signal
  | { kind: "keep_alive_only" }   // heartbeat + durable memory stay live; no work lanes
  | { kind: "idle_poll"; intervalMs: number }; // poll sources on an interval, else idle

export type EngagementPolicy = {
  engagementPolicyId: string;
  organizationId: string;
  scope: ControlPlaneScope;        // reuse: organization | tenant | hat | provider
  mode: EngagementModeKind;
  sources: readonly EngagementSource[];          // wired intake/trigger sources
  activeTriggerIds: readonly string[];           // which durable_triggers are enabled
  // requirement_driven only:
  suppressAutonomousWorkLanes?: boolean | undefined;  // default true in requirement_driven
  quiescence: QuiescencePolicy;
  setByHatId: string;
  setAt: string;
};
```

Notes:

- **Scope reuses `ControlPlaneScope`** (organization / tenant / hat / provider)
  from `control-plane-guard.ts` — engagement can be set org-wide or narrowed.
- **`sources` reuse the change-control port layer** (Track L / Track C `C3`) for
  GitHub / Jira / Linear — *do not build a second integration path*. The same
  ports that project a `ChangeSet` outward also poll/receive issues inward.
- **`activeTriggerIds`** points at `durable_triggers` rows
  (Always-On § Durable Triggers) — each already carries `enabled/paused state`.
- **The control plane is not in this type** — it sits underneath. Engagement
  decides whether a tick *should* run; the control plane can still veto it
  (estop / freeze / budget / rate-limit) at the `cadence_tick_start`
  `ControlPlaneBoundary` (which already exists in `control-plane-guard.ts`).

### Grounded substrate found at authoring time (2026-06-03 package scan)

Verifying-before-authoring against `packages/application/src/` surfaced two
load-bearing facts that shape the implementation, not just the design:

- **`deploy/run-org-cadence.ts` already exists** — Track A's `runOrgCadence` is
  not hypothetical; it is the concrete runner the engagement gate sits in front
  of (§6). E1 wires into a real surface.
- **A schedule-authority subsystem already exists** (`schedule-authority.ts` +
  `WorkScheduleBlock` / `ScheduleBlockType` in `domain/` + in-memory & Cockroach
  `work-schedule-block-authority-reader`s). It is a **different scope** from
  EngagementPolicy and the two compose rather than collide:
  - `schedule-authority.ts` = **hat-command scope** — "is *this command* legal
    given the actor hat's *current work-block* (PrioritizedWork /
    PromptFlowExecution, Active/Scheduled)?" — a WHO-can-do-WHAT-WHEN gate at
    hat granularity, *inside* a running tick.
  - `EngagementPolicy` = **org scope** — "should the cadence run *at all* this
    tick, and what woke it?"
  Layering, outermost-in: `ControlPlaneGuard` (hard halt) → `EngagementPolicy`
  (does the cadence tick?) → `runOrgCadence` lanes → `schedule-authority`
  (which hat-commands are legal within the tick). `scheduled` engagement mode
  must **reuse** the `WorkScheduleBlock` substrate for its windows, not mint a
  parallel scheduler.
- **Tests live in `packages/application/test/`** (sibling dir, e.g.
  `control-plane-guard.test.ts`, `intake.test.ts`, `schedule-authority.test.ts`)
  — so E0's test lands at `packages/application/test/engagement-policy.test.ts`,
  and the prove-in-kind runner at `deploy/run-engagement-cycle.ts` alongside the
  existing `run-org-cadence.ts` / `run-work-intake.ts` runners.

## 5. Quiescence — what the org does when nothing is engaging it

Engagement modes need a defined **off-the-clock** behaviour, or "requirement-driven"
and "scheduled" are underspecified. `QuiescencePolicy`:

| Policy | Behaviour | Use |
|---|---|---|
| `full_stop` | all cadence lanes idle; nothing runs until the next engagement signal | strict cost control; dev/test |
| `keep_alive_only` | heartbeat + durable Hindsight memory stay live (Track A); **no** work / memory-maintenance / change-control lanes run | default for `requirement_driven` / `scheduled` |
| `idle_poll` | poll the configured `sources` every `intervalMs`; if nothing surfaces, return to idle | `issue_sourced` without webhooks (poll Jira every N min) |

Quiescence is distinct from the control-plane freeze: quiescence is the org
**choosing** not to run (soft, per engagement mode); freeze is the operator
**forcing** it not to run (hard, control-plane). Both can hold at once; the
control-plane floor always wins.

## 6. How it wires into the worker (the Track A integration point)

Per [Forward Roadmap Track A](./FORWARD_ROADMAP.md), the always-on worker
(`apps/workers/src/main.ts`) is being given a `runOrgCadence` composition that
drives the org cycle + Work OS cycle + memory maintenance + change-control as
scheduled lanes. **Engagement is the gate in front of that composition:**

```text
worker tick
  → load EngagementPolicy (tenant config)
  → control-plane gate at boundary "cadence_tick_start"   (estop/freeze/budget/rate-limit veto)
  → engagement gate: does THIS mode + its triggers say "run now"?
        always_on        → yes, every tick
        scheduled        → yes iff inside a scheduled window
        trigger_gated    → yes iff a bound trigger is firing
        requirement_driven → yes iff non-terminal fed work exists; else quiesce
        issue_sourced    → yes iff an external issue is unresolved (poll/webhook)
  → if run: runOrgCadence(lanes filtered by mode)
        requirement_driven → autonomous-initiative lanes suppressed; only intake-fed work
  → else: apply QuiescencePolicy
```

The engagement gate is **deterministic and Result-shaped**, the same discipline as
`evaluateControlPlaneAccess` — given the policy, the trigger state, and the
work-item census, it returns "run these lanes" or "quiesce". This keeps it
testable in isolation and provable-in-kind via a `deploy/run-*.ts` runner (the
roadmap's quality bar).

## 7. UI surface (scoped later, anticipated here)

The visualize-and-interject UI you want is already anticipated in
[UI and Observability Concepts](./UI_AND_OBSERVABILITY_CONCEPTS.md) and
[Always-On Runtime § UI Requirements / § Human Override](./ALWAYS_ON_ORCHESTRATION_RUNTIME.md).
Engagement-specific UI surfaces:

- **Mode selector + source wiring** — pick the engagement mode; connect GitHub /
  Jira / Linear; enable/pause specific durable triggers.
- **On-ness indicator** — is the org running, quiescent, or control-plane-frozen
  right now, and why (which trigger / which freeze / empty queue).
- **Interjection points** — the pending-human-gates queue (from `AutonomyPolicy`),
  the estop / freeze control (control-plane), and feed-a-requirement (intake) in
  requirement-driven mode.
- **Run/quiesce timeline** — when did it wake, what woke it, what it drove to
  completion, when it went quiescent.

The UI reads the same `observe.ts` run-state readout the rest of the platform
uses; engagement adds the mode + on-ness + source-wiring views on top.

## 8. Where this sits in the roadmap

Engagement modes are a **Track C (Adaptive Platform)** capability — they are
everything-as-configuration (`C0`), they generalize `AutonomyPolicy` (`C1`) with a
sibling on-ness axis, and `issue_sourced` reuses the bidirectional Jira/Linear
sync port layer (`C3`). But the **gate itself** lands earliest, in **Track A**:
the worker cannot drive `runOrgCadence` continuously without first deciding
*whether this tick should run* — so the `always_on` mode + the engagement gate are
the natural companion to `A0`. The richer modes (requirement-driven suppression,
issue-sourced polling) follow as the port layer goes live (Track L) and config
substrate lands (Track C).

## 9. Implementation plan (E0–E5, proven-in-kind per the roadmap bar)

Each sub-phase is pure-where-possible, unit-tested, typecheck-clean, and proven
via a `deploy/run-engagement-*.ts` + `observe-*.ts` pair.

| Phase | Deliverable | Exit (proven in kind) |
|---|---|---|
| **E0** | `EngagementPolicy` type + `evaluateEngagement(policy, triggerState, workCensus, now): EngagementDecision` — pure, deterministic, Result-shaped, in `packages/application/src/engagement-policy.ts`. `always_on` + `trigger_gated` + `scheduled` modes. Unit tests cover each mode's run/quiesce decision. | tsc + tests green; a fed policy returns the right run/quiesce verdict for each mode |
| **E1** | Wire the engagement gate into `runOrgCadence` in the worker (`apps/workers/src/main.ts`): control-plane gate → engagement gate → lanes. `always_on` drives the cadence; `scheduled`/`trigger_gated` gate it. | the worker boots with the engagement gate wired; an `always_on` org runs the cadence, a `scheduled` org runs only in-window — in kind |
| **E2** | `requirement_driven` mode: autonomous-lane suppression flag + quiesce-on-empty. Only `intake.ts`-originated work runs; org quiesces when the census is terminal. | feed one requirement → org drives it to terminal state → quiesces, generating no new work — in kind |
| **E3** | `QuiescencePolicy` (`full_stop` / `keep_alive_only` / `idle_poll`) + the `cadence_tick_start` control-plane boundary composed in front of the engagement gate. | each quiescence policy observably behaves correctly; estop/freeze still wins over any engagement mode |
| **E4** | `issue_sourced` mode via the change-control port layer: GitHub/Jira/Linear issue → `external` durable trigger → `ExternalIntakeEvent` → `createWorkItemFromIntake`. (Rides Track L live ports.) | a real (or github-gated fake) issue wakes the org, becomes a `WorkItem`, drives to completion, org quiesces — in kind |
| **E5** | `EngagementPolicy` as Cockroach tenant config (everything-as-config, Track C `C0`) + the org-event kinds (`engagement_mode_set`, `org_quiesced`, `org_woke`) for observability + the UI readout via `observe.ts`. | mode is tenant-configurable + the on-ness state is observable from `observe.ts`; UI can render it |

**Start here: E0 → E1.** The pure `evaluateEngagement` + the worker gate are the
foundation; everything else composes behind a continuously-deciding worker. E0 is
a clean, isolated, testable slice with no external dependencies.

## 10. What's grounded vs new

- **Grounded (exists in code today):** `control-plane-guard.ts`
  (`ControlPlaneScope`, `cadence_tick_start` boundary, deterministic Result-shaped
  evaluation), `intake.ts` (`ExternalIntakeEvent`, `createWorkItemFromIntake`,
  idempotent intake), `observe.ts` (run-state readout). Durable Triggers +
  AutonomyPolicy + the change-control port layer are **specified in design docs**,
  in flight per the roadmap.
- **New (this doc):** the `EngagementPolicy` type, the five-mode DU, the
  requirement-driven autonomous-lane-suppression guardrail, the `QuiescencePolicy`,
  and the engagement gate in the worker tick. Net-new surface is small —
  `engagement-policy.ts` + the worker wiring — because every mode is built from
  existing trigger / intake / control-plane primitives.
