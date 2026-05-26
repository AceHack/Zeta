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

## Current focus — tier-2 Docker Desktop dev-experience (added 2026-05-25)

Beyond the agentic-organization design + hat-system substrate, Max's near-term workstream (added by Aaron 2026-05-25) is **owning the tier-2 Docker Desktop + Kubernetes dev-experience** for the Zeta cluster substrate. Full scope + sub-scopes are documented in [`PERSONA.md`](PERSONA.md) under "Current focus — tier-2 Docker Desktop dev-experience workstream"; this section names the cold-boot reading list for an AI collaborating with Max on this workstream.

### Cold-boot reading list (in order)

1. [`CLAUDE.md`](../../../CLAUDE.md) — repo bootstream, conventions, governance pointers
2. [`AGENTS.md`](../../../AGENTS.md) — cross-cutting governance
3. [`.claude/rules/`](../../../.claude/rules/) — auto-loaded behavioral rules. Especially: [`rule-0-no-sh-files.md`](../../../.claude/rules/rule-0-no-sh-files.md), [`dont-ask-permission.md`](../../../.claude/rules/dont-ask-permission.md), [`claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md), [`zeta-expected-branch.md`](../../../.claude/rules/zeta-expected-branch.md)
4. [`docs/backlog/P1/B-0780-*.md`](../../../docs/backlog/P1/B-0780-local-loop-deterministic-simulation-testing-of-kubernetes-deployments-lexisnexis-lineage-three-tier-testing-argocd-apps-as-packages-aaron-mika-2026-05-25.md) — tier-2's parent substrate; Max's workstream IS tier-2
5. `docs/backlog/P1/B-0759-*.md` — first-time-CLI-user persona Max's `zeta dev up` UX serves
6. [`full-ai-cluster/tools/zflash-setup.ts`](../../../full-ai-cluster/tools/zflash-setup.ts) — canonical Touch ID + PAM + sudo-elevation pattern Max gets to use for all privileged macOS operations
7. [`full-ai-cluster/usb-nixos-installer/zeta-install.sh`](../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh) — zero-typing install pattern Max should emulate at Docker-Desktop scope
8. The "simplest first; add complexity only when simple shape demonstrably doesn't fit" feedback memory at `~/.claude/projects/.../memory/feedback_simplest_first_*` (Aaron-Mika 2026-05-25) — the substrate-engineering discipline Max applies at every backend / topology / profile decision

### Disciplines that apply to the tier-2 workstream

- **Substrate-or-it-didn't-happen** — chat doesn't count; commit + push
- **Simplest first** — pick the simplest tool / shape that fits known requirements; promote only when simple shape demonstrably fails
- **No directives** — Aaron's only directive is that there are no directives; Max's input is framing, not orders
- **Glass halo** — log substrate-honestly; surface gaps; don't hide failures
- **Verify before deferring** — if something looks broken, check it before classifying it as "someone else's problem"
- **Skills-and-scripts encoding contract** — every Docker Desktop interaction Max performs ends as a TS script (per Rule 0), a Claude Code skill, or a backlog row. Nothing gets lost in chat
- **Touch ID over passwords** — for any privileged macOS operation, use the zflash Touch ID pattern; never reach for a password prompt

### Concrete first deliverables for the tier-2 workstream (in order of value-per-effort)

1. **Read the cold-boot list above** + write a short observation note to Max on what's already-substrate vs gap
2. **Author `.claude/skills/docker-desktop-tier-2/SKILL.md`** — initial skill covering: install Docker Desktop, enable Kubernetes via the native kind provisioner, set node count via DD settings API, verify `kubectl` works
3. **Author `tools/dev/docker-desktop-k8s-enable.ts`** — TS script that programmatically configures DD's native kind provisioner (settings API; edits `~/Library/Group Containers/group.com.docker/settings.json` where API doesn't cover). Documents any GUI-only steps as sibling `.md` with screenshots
4. **Author `tools/dev/zfingerprint.ts`** — thin wrapper around the zflash Touch ID + expect pattern, generalized for any Max-side privileged operation (not just USB flashing)
5. **File backlog row B-NNNN** — Docker Desktop tier-2 dev-experience substrate (composes with B-0780). Use the agent-roster ID allocation discipline (`git ls-tree origin/main -- docs/backlog/` to find current top + `gh pr list --search "B-NNNN"` to check in-flight). Row's acceptance criteria are the skills + scripts to ship over the coming ticks

### Updated success metrics (first 30 days of the tier-2 workstream)

- `zeta dev up` defaults to DD-managed 3-node kind via DD's settings API; cold under 5 min, warm under 1 min
- `--single-node` and `--nodes N` flags drive DD settings programmatically
- Chart coverage matrix with three columns (single-node / multi-node-DD / cluster-only) for every chart
- Profiles (`minimal` / `data` / `observability` / `full` / custom) wired with documented resource requirements
- CockroachDB 3-node consensus + Argo CD HA leader-election + Longhorn 3-replica all green in tier-2
- OTel Shape B traces matching prod shape
- GitHub workflows: per-PR `data` profile on kind; nightly `full` profile; separate `federation` workflow runs multi-cluster kind matrix
- Skills shipped: `tier-2-dd-kind/`, `tier-2-profiles/`, `argocd-sync-wave-debug/`, `tier-2-observability/`, `tier-2-ci-kind-k3d/`, `tier-2-federation-debug/`
- Zero passwords typed by Max for admin operations on his Mac (everything via Touch ID)
- Every Docker Desktop GUI click Max made at least twice has been encoded as either a script or a documented "GUI-only — here's why" comment

## Composes with

- [`PERSONA.md`](PERSONA.md) — fuller persona context
- [`memory/persona/addison/PERSONA.md`](../addison/PERSONA.md) — co-architect
- [`memory/persona/aaron/PERSONA.md`](../aaron/PERSONA.md) — sponsor + senior architect
- [`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`](../../../docs/AGENT-AUTHORING-AND-PR-REVIEW.md) — Max's operational onboarding (the doc that answers his two questions: where the code-quality discipline lives + the adversarial-review hierarchy he can hook into)
- B-0724 (TS hat-system operator; Max's primary substrate-engineering target + learning path)
- B-0728 (destructive-tool authoring contract; pattern for any tool Max writes that destroys things)
- B-0546 (manifesto → building-codes recast; addresses Max's pattern-match-as-manifesto reading of the original framing)
