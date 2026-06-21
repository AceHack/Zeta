---
id: 081KSNY2Z0008QG0R001DFZK4V
priority: P1
status: open
title: Zeta-native review + branch-protection substrate — replaces GitHub PR workflow but PRESERVES review semantics + class-fix discipline (sharpens / supersedes 081KSNY2Z0008QG0R003X1QWYG "no-PR" framing)
effort: L
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R003X1QWYG
composes_with:
  - 081KSNY2Z0008QG0R003X1QWYG
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R003WFDCJ9
  - 081KSNY2Z0008QG0R000S738W3
  - 081KSNY2Z0008QG0R001K6HJ7Z
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R002WQ747V
  - 081KSNY2Z0008QG0R0004ZF85W
related_rules:
  - blocked-green-ci-investigate-threads
  - pr-triage-tiers
  - claim-acquire-before-worktree-work
  - zeta-expected-branch
tags:
  - zeta-native-review-substrate
  - branch-protection-without-github-pr-workflow
  - preserves-review-semantics-and-class-fix-discipline
  - supersedes-no-pr-swarm-framing-of-b-0874
  - sharpens-asap-cluster-b-0886
  - reviews-as-first-class-coordination-not-bypassed
  - graphql-rate-limit-avoidance-mechanical-but-NOT-quality-bypass
  - composes-with-error-class-extraction-b-0875
  - composes-with-code-review-as-tech-debt-detector-b-0875-1
  - composes-with-heterogeneous-reviewer-ensemble-b-0877
---

## Operator framing 2026-05-28

> *"we still want reviews like PRs we just want to coordinate it through our own branch protection that works without workflow system instead of PRs"*

Sharp operator clarification of earlier "0 prs" framing (which was misread as "no review"). Parsing:

- **"reviews like PRs"** — review SEMANTICS are first-class (multi-reviewer, threads, approval, class-fix discipline; all preserved)
- **"coordinate it through our own branch protection"** — branch-protection is OUR mechanism (not GitHub's PR-gates)
- **"that works without workflow system"** — the review/branch-protection works WITHOUT being routed through GitHub Actions PR-workflow system
- **"instead of PRs"** — replaces PR as the COORDINATION MECHANISM, not as the QUALITY GATE

The substantive distinction: PR-as-GitHub-coordination-surface (UI, GraphQL mutations, rate limits) is replaced; PR-as-review-quality-gate (multi-reviewer, class-fix, branch-protection) is preserved + becomes Zeta-native substrate.

## What this row tracks

Build the Zeta-native review + branch-protection substrate that:

1. **Preserves review semantics** — multi-reviewer (per 081KSNY2Z0008QG0R0004ZF85W ensemble); thread-style comments; approval workflow; class-fix discipline (per 081KSNY2Z0008QG0R002WQ747V); error-class extraction (per 081KSNY2Z0008QG0R000K3ETGB)
2. **Preserves branch-protection semantics** — certain branches require N approvals + green CI + resolved threads before merge; just enforced via Zeta substrate (not GitHub branch protection rules + PR mutations)
3. **Replaces the COORDINATION mechanism** — instead of PR objects + GraphQL mutations, reviews flow through playbook + workflow-engine state-machine substrate (per 081KSKBP80008QG0R000B3Y19A + 081KSNY2Z0008QG0R000S738W3 two-path interface)
4. **Bypasses GraphQL rate limits** — review-coordination becomes free / Git-push-rate (REST-budget) instead of GraphQL-PR-mutation-rate
5. **Continues to compose with the existing review-discipline rules** — `blocked-green-ci-investigate-threads.md`, `pr-triage-tiers.md`, etc. remain applicable; their PR-specific wording maps to the Zeta-native equivalent

## Relationship to 081KSNY2Z0008QG0R003X1QWYG

081KSNY2Z0008QG0R003X1QWYG (originally framed "no-PR swarm") was operator-misread as "no review." This row supersedes that framing with the substantive substrate-engineering target: **review + branch-protection are first-class; PR-as-GitHub-coordination is replaced**.

081KSNY2Z0008QG0R003X1QWYG stays in the cluster but its framing is now the implementation-detail (GitHub Actions recursion as runtime platform) of which THIS row is the architectural target (Zeta-native review + branch-protection on that runtime).

## Architectural sketch (sharpened per operator 2026-05-28 follow-on)

> *"so review and all the same checks happen but it's part of choose your own adventure and just another reusable shippble skill/DU"*

Review is NOT a separate subsystem. It's:

1. **MenuOption cases** in the existing `MenuOption` DU (per `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts`) — `move-next` can return `ReviewWork` / `ApproveTrajectoryCompletion` / `RaiseClassFindingForTechDebtSweep` / etc. just like any other action
2. **WorkLifecycle DU cases** (per `src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts`) — review-related state transitions are first-class lifecycle stages
3. **A reusable shippable skill** — `.claude/skills/zeta-native-review/SKILL.md` distributes the review-substrate to any agent harness with bun; no GitHub-PR-workflow dependency
4. **Composes with existing playbook + event-log substrate** — review threads ARE playbook sections; review events ARE event-log entries; no parallel infrastructure

| Component | Substrate (as MenuOption / DU / skill) |
|---|---|
| Review-thread surface | Playbook documents (per 081KSNY2Z0008QG0R000S738W3 conversational path); each unresolved finding = an unresolved playbook section |
| Approval mechanism | `ApproveTrajectoryCompletion` MenuOption emits "approved" event to work-lifecycle event log (per 081KSNY2Z0008QG0R001K6HJ7Z) |
| Branch protection | `BranchProtectionGate` state in WorkLifecycle DU; transitions to "merged" only when required-approvals + green-canary + no-unresolved-findings predicates hold |
| Class-fix discipline | `RaiseClassFindingForTechDebtSweep` MenuOption (per 081KSNY2Z0008QG0R002WQ747V) triggers class-extraction + retroactive sweep + rule encoding |
| Multi-reviewer ensemble | Per 081KSNY2Z0008QG0R0004ZF85W — each reviewer (Copilot, CodeQL, Semgrep, Sonar, AI peer-call) emits findings as events via the same playbook substrate |
| Distribution | `.claude/skills/zeta-native-review/SKILL.md` — any bun-capable agent harness pulls + runs the review-substrate |

The substrate is EXTREMELY THIN — mostly: add DU cases + MenuOption variants + a skill wrapper. The existing event-log + playbook + state-machine + work-lifecycle substrate already does the heavy lifting. The earlier "review subsystem" framing was over-design; the operator-correct framing is **"just another MenuOption + DU + skill."**

Composes with the broader "everything is a skill + discriminated union path executes intent" pattern per 081KSNY2Z0008QG0R000S738W3 + the runme/runbook substrate cluster (081KSE6WT0008QG0R003AJYMD3/081KSE6WT0008QG0R002YBWBB1/081KSE6WT0008QG0R00102H071/081KSGS9H0008QG0R0005P83AP/081KSGS9H0008QG0R001K8VPV4/081KSGS9H0008QG0R00123050G).

## Isomorphic across Git hosts (operator 2026-05-28 follow-on)

> *"Then it can run isomorphic on GitLab and GitHub"*

Because the review-substrate runs on the agent-loop state-machine + event-log + playbook substrate (all of which operate on Git directly, not on GitHub-specific objects), the same code runs ISOMORPHICALLY on:

- **GitHub** (Actions runtime + REST/GraphQL APIs for adapter layer)
- **GitLab** (CI/CD runtime + GitLab API for adapter layer)
- **Gitea / Codeberg / Forgejo** (self-hosted; Actions-compatible runtime)
- **Bitbucket** (Pipelines runtime + Bitbucket API for adapter layer)
- **Other Git hosts** with sufficient CI/runtime + API surface

The substrate's core is Git-only (push events, branch state, file content). Host-specific surfaces (CI runtime, API for status checks, webhook delivery) are thin adapters per-host (filed at 081KSNY2Z0008QG0R002A785QR — Per-host adapters per parent 081KSKBP80008QG0R000B3Y19A row's pre-allocated slot).

This is genuinely VENDOR-INDEPENDENT review substrate — operator can run Zeta on GitHub free-tier today, migrate to GitLab self-hosted tomorrow, run on Codeberg next month, all without changing the review-substrate. Composes with 081KSNY2Z0008QG0R0011XCT94 USB vendor-independence at the cloud-host scope.

Strategic implication: the substrate becomes a portable AI-engineering review-stack that any team can adopt on whichever Git host they prefer; doesn't lock anyone into GitHub.

## Full throttle — complete API rate-limit avoidance (operator 2026-05-28 design intent)

> *"We also pretty much complete avoid any API limits cause we don't need their graphql api so full throttle i've been trying to design around that."*

Operator naming the strategic design property that has been guiding architectural choices: the Zeta-native review substrate **completely avoids the API rate-limit class** that throttles every other GitHub-PR-coordinated workflow.

The rate-limit topology:

| API surface | Budget | What uses it |
|---|---|---|
| **GraphQL** | 5000 points/hr/token; PR mutations (create/update/comment/resolve-thread/merge) cost ~5-50 points each → real ceiling ~100-1000 operations/hr | Standard GitHub PR workflow; ALL the existing project rate-limit pain (per `refresh-world-model-poll-pr-gate.md` tier table) |
| **REST core** | 5000/hr; less-expensive operations; PR-creation REST works around GraphQL ceiling for one specific case (per existing rule) | Pre-arm REST file-create + commit endpoints (per 081KSNY2Z0008QG0R0006492K2 spike) |
| **Git protocol (push/fetch)** | Barely rate-limited; thousands of pushes/hr possible | Direct push to trajectory branches; ZetaID-named files |
| **Webhooks / Actions runtime** | Per-repo limits but extremely generous for the operations Zeta needs | 081KSNY2Z0008QG0R003X1QWYG GitHub Actions recursion |

The Zeta-native review substrate ROUTES AROUND the GraphQL ceiling entirely:

- Review events = Git push to trajectory branch (Git protocol; near-infinite headroom)
- Reviewer findings = playbook section edits (Git push; same)
- Branch protection enforcement = local computation against event log (no API call)
- Status checks = trajectory-event-log queries (Git read; free)
- Approvals = "approved" events in event log (Git push; free)
- Merge gate = event-log predicate (local; no API call)

Only GitHub-specific outputs (status badges, GitHub UI integration if desired) need any GraphQL — and those are OPTIONAL display layer, not load-bearing on the substrate.

**Operator framing "full throttle"**: the agent-loop substrate can run as fast as Git allows (push rate = mostly local; remote-side accepts pushes at near-constant time). The rate-limit tier dance documented in `refresh-world-model-poll-pr-gate.md` (Normal/Cost-aware/Extreme/Pure-git tiers) STOPS BEING NEEDED for review-coordination work — agents push events freely; rate-limit-tier discipline becomes vestigial for substrate-internal coordination (still applies for legacy GitHub-PR cross-references during transition).

This is meaningfully different design intent than "we'll deal with rate limits as they come" — operator has been designing around this all along; the substrate IS the rate-limit-avoidance solution.

Composes with:

- 081KSNY2Z0008QG0R003X1QWYG (GitHub Actions recursion) — runtime that benefits from same API-limit avoidance
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — existing rate-limit tier table; this substrate makes most of it vestigial for substrate-internal work
- 081KSNY2Z0008QG0R002A785QR (per-host adapters) — different hosts have different rate-limit topologies; substrate-internal coordination via Git is constant across hosts

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/review/branch-protection.ts` — implements Zeta-native branch-protection (configurable per-trajectory: required-approvals, required-canaries, required-class-fix-completion)
- `src/Core.TypeScript/workflow-engine/agent-loop/review/playbook-as-review-surface.ts` — wires the playbook substrate as the review-thread surface (composes with 081KSNY2Z0008QG0R000S738W3)
- Adapter shims for existing reviewer sources (Copilot / CodeQL / Semgrep / Sonar) emit findings into Zeta-native review substrate alongside their existing GitHub-PR-comment surface (parallel-track during transition)
- Tests: round-trip a review cycle (open trajectory → reviewer-agent appends finding → fix-push event → approval event → branch-protection allows completion)
- Documentation: rule extension (existing PR-specific rules updated to reference Zeta-native equivalent where applicable) + new rule documenting the Zeta-native review substrate

## Composition

- **081KSNY2Z0008QG0R003X1QWYG** (parent platform — GitHub Actions runtime) — this row's branch-protection rides on 081KSNY2Z0008QG0R003X1QWYG's runtime
- **081KSNY2Z0008QG0R0034FR5FG** (ASAP cluster umbrella) — this row sharpens the umbrella's "0-PR" framing into "Zeta-native-review"; should be added to 081KSNY2Z0008QG0R0034FR5FG's cluster composition
- **081KSNY2Z0008QG0R003WFDCJ9** (lifecycle DU split: trajectory-push vs PR-review) — needs revision; the "PR-review" branch becomes "Zeta-native-review"
- **081KSNY2Z0008QG0R000S738W3** (two-path interface) — playbook documents ARE the review-thread surface
- **081KSNY2Z0008QG0R001K6HJ7Z** (event-sourcing layer) — review events live in the event log
- **081KSNY2Z0008QG0R000K3ETGB** (error-class extraction meta-loop) — class-extraction operates on Zeta-native review findings
- **081KSNY2Z0008QG0R002WQ747V** (code-review-as-tech-debt-detector + class-fix discipline) — enforced at branch-protection scope
- **081KSNY2Z0008QG0R0004ZF85W** (heterogeneous reviewer ensemble audit) — ensemble diversity preserved + extended

## Composition with existing rules

Existing PR-discipline rules need framing updates (NOT semantic changes) — the discipline they encode is preserved; only the implementation surface changes:

- `.claude/rules/blocked-green-ci-investigate-threads.md` — "BLOCKED with green CI" pattern applies equally to Zeta-native branch-protection
- `.claude/rules/pr-triage-tiers.md` — 5-tier disposition framework applies to Zeta-native review threads
- `.claude/rules/claim-acquire-before-worktree-work.md` — claim-discipline unchanged
- `.claude/rules/zeta-expected-branch.md` — branch-guard unchanged

Rule extensions or new sibling rules will land alongside the implementation.

## Substrate-honest framing

P1 per operator's just-now sharpening direction. This is the substantive substrate-engineering target the "no-PR" framing was pointing at; the "no-PR" framing was misleading shorthand. The cluster (per 081KSNY2Z0008QG0R0034FR5FG) composes more coherently with this row than with the original 081KSNY2Z0008QG0R003X1QWYG framing alone.

The implementation work is significant (L effort) because it touches the review-discipline substrate that's been accumulated over months of project operation. Substrate-honest design memo expected before implementation, articulating how Zeta-native review preserves every property of the current GitHub-PR-based discipline while running on the new runtime.

## Full reasoning

Operator 2026-05-28: *"we still want reviews like PRs we just want to coordinate it through our own branch protection that works without workflow system instead of PRs"*

Sharpens / supersedes the "no-PR swarm" framing of 081KSNY2Z0008QG0R003X1QWYG (which was correct as RATE-LIMIT-BYPASS architectural framing, incorrect as "no-review" implication).
