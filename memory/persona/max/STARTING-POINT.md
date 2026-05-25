# Max — starting point (synthesized; placeholder for Max's canonical prompt)

This file is a SYNTHESIZED starting point built from Max's contributions to the framework as of 2026-05-25. Max can replace it with his canonical AI-collaborator prompt when convenient — the way Addison's [`STARTING-POINT.md`](../addison/STARTING-POINT.md) is her own Grok project prompt verbatim. Until then, this synthesis serves as Max's substrate-honest entry-point for AI collaborators.

## Identity + role

- Max — AI cluster architect; first-class contributor to the framework alongside Aaron + Addison
- Backend / frontend engineer (PaaS background); new to K8s + operator pattern as of 2026-05-25
- Co-conspirator with Addison on the AI cluster bootstrap design
- Author of [PR #4958](https://github.com/Lucent-Financial-Group/Zeta/pull/4958) — the agentic-organization architecture (17 design docs, Hermes-native Organization platform)

## Language preferences

> *"max love ts and cs i love fs and cs we both like rust and python for where they make sense"* — Aaron 2026-05-25

> *"we understand go is necessary in some places for k8s but we would like to limit its necessity"* — Aaron 2026-05-25

| Language | Position |
|----------|----------|
| TypeScript | primary; NestJS + npm ecosystem |
| C# | co-equal with TS; team-overlap language with Aaron |
| Rust | for the right job (perf-critical, FPGA orchestration, kube-rs operator) |
| Python | for the right job (ML-adjacent, kopf-style fast prototyping) |
| F# | not Max's primary; Aaron's strength; future collaboration via KubeOps.NET |
| Go | ecosystem-forced where unavoidable; minimize otherwise |

## Mental compressions Max has contributed

These are Max's own framings; the framework adopts them where they're sharper than alternatives:

- **`hat = skills + opa/rbac`** — the compression that informs the `Hat.spec` CRD shape (skills + authority + supervisor-graph + throttles + reputation, all first-class). Landed in PR #4930.
- **"Hat graphs for writing policies"** — supervisor-graph + conflicts + quorum + cooldown render as graph constraints; OPA policies enforce graph properties (no cycles, no out-of-spec edges). Captured in `full-ai-cluster/k8s/applications/hat-system/graph/`.
- **"Adversarial hierarchy of traps"** for PR review — composes with the framework's existing persona-reviewer network (harsh-critic / spec-zealot / threat-model-critic / security-researcher / maintainability-reviewer / etc.) + plugin reviewers (code-reviewer / silent-failure-hunter / pr-test-analyzer) + auto-fire reviewers (Copilot, Codex). See [`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`](../../../docs/AGENT-AUTHORING-AND-PR-REVIEW.md) for the operational map.

## The agentic-organization design substrate

Max's primary contribution is the agentic-organization design landed in PR #4958 + the associated docs:

- `agentic-organization/docs/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md` — Addison's vocabulary preserved verbatim (the substrate-honest reference for how Addison thinks)
- `agentic-organization/docs/IMPLEMENTATION_CONCEPTS.md` — how to build the architecture as services, data models, MCP tools, workflows, runtime infra
- `agentic-organization/docs/ALWAYS_ON_ORCHESTRATION_RUNTIME.md` — workers, triggers, rules, leases, schedulers, watchers, reconcilers, SLOs, incidents, runbooks, self-healing loops
- `agentic-organization/docs/RUNTIME_TECH_AND_PACKAGE_STRATEGY.md` — Temporal TS, Dapr Actors, NATS, Oz/Warp, OpenZiti, Hermes, Hindsight, reusable `agentic-services` primitives
- `agentic-organization/docs/UI_AND_OBSERVABILITY_CONCEPTS.md` — human-facing visualization
- `agentic-organization/docs/DEPARTMENT_HAT_TOOL_INVENTORY.md` — starter departments + hat catalog + tool bundles + approval gates + high-risk guardrails
- `agentic-organization/docs/ORGANIZATION_LAYER_BUILD_PLAN.md` — service layer, role workspaces, automation loops, state model, UI surfaces, MVP sequence
- `agentic-organization/docs/WORK_AND_RELEASE_MANAGEMENT_OS.md` — custom backlog, project, task, signal, board, release workflow
- `agentic-organization/docs/AMBIGUOUS_REQUIREMENT_LIFECYCLE.md` — discovery → BRD → workflow modeling → architecture → decomposition → readiness → learning
- `agentic-organization/docs/ANTI_STALL_PRIORITY_RUNTIME.md` — hat-owned schedules + blocker triage + queue SLO + reassignment + alternate-work + dependency reconciliation
- `agentic-organization/docs/CLUSTER_NATIVE_HAT_SYSTEM.md` — theoretical CRD + OPA + hat-binding + succession + reputation + graph rendering substrate (composes with the shipped operator from PR #4930)
- `agentic-organization/docs/CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md` — k3s + sandboxed Hermes container + Cilium Service Mesh + SPIRE + Vault + Credential Proxy + NATS + Hindsight + runtime observability
- `agentic-organization/docs/AI_CLUSTER_SCAFFOLD_CONTEXT.md` — two-directory NixOS/k3s/ArgoCD scaffold assumptions

The whole substrate is on main; Max is heads-down implementing as of 2026-05-25.

## Pending: glass-halo signature

Aaron 2026-05-25: *"I can have me max and addison sign someting about glass halo eventually and upload it"*.

Glass-halo discipline (`.claude/rules/glass-halo-bidirectional.md`) is the framework's bidirectional-transparency substrate — substrate-honest disclosure, observation enables substrate emergence, the "substrate-everything-glass-halo" stance. Aaron, Max, and Addison will sign a formal acceptance at some point + upload as substrate; this file will cross-reference once that lands. Until then, Max operates under the operational discipline by participation (PRs go through the same review pipeline as Aaron's; substrate is observable to the team) without the formal signature.

## What agents should do at first contact with Max

1. **Read this file + [`PERSONA.md`](PERSONA.md)** — understand the team-fit + language preferences + mental compressions before suggesting patterns
2. **Read [`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`](../../../docs/AGENT-AUTHORING-AND-PR-REVIEW.md)** if you're going to be writing code Max will review — understand where the discipline lives + how the adversarial-review hierarchy hooks in
3. **Adopt Max's coinages when they're sharper** — `hat = skills + opa/rbac`, hat-graphs-for-policies, adversarial-hierarchy-of-traps are all his framings + are operationally accurate
4. **Frame K8s + operator-pattern feedback as learning paths, not finished answers** — Max is new to this; B-0724 demonstrates the right shape (Go scaffold as teaching tool + 7-step suggested sequence + resource list)
5. **Don't pace him** — Aaron's parallel-tracks framing is real; Max sets his own velocity

## Composes with

- [`PERSONA.md`](PERSONA.md) — fuller persona context
- [`memory/persona/addison/PERSONA.md`](../addison/PERSONA.md) — co-architect
- [`memory/persona/aaron/PERSONA.md`](../aaron/PERSONA.md) — sponsor + senior architect
- [`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`](../../../docs/AGENT-AUTHORING-AND-PR-REVIEW.md) — Max's operational onboarding (the doc that answers his two questions: where the code-quality discipline lives + the adversarial-review hierarchy he can hook into)
- B-0724 (TS hat-system operator; Max's primary substrate-engineering target + learning path)
- B-0728 (destructive-tool authoring contract; pattern for any tool Max writes that destroys things)
- B-0546 (manifesto → building-codes recast; addresses Max's pattern-match-as-manifesto reading of the original framing)
