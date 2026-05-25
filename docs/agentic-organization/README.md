# Hermes Organization Docs

This folder is the working design set for the Hermes-native Organization platform.

Current documents:

- [Foundational Context and Language](./FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md) - working vocabulary, values, Zeta project context, declarative cluster mental model, and active clarifications.
- [Implementation Concepts](./IMPLEMENTATION_CONCEPTS.md) - how to build the architecture as services, data models, MCP tools, workflows, and runtime infrastructure.
- [Always-On Orchestration Runtime](./ALWAYS_ON_ORCHESTRATION_RUNTIME.md) - the workers, triggers, rules, leases, schedulers, watchers, reconcilers, SLOs, incidents, runbooks, and self-healing loops that keep the Organization continuously operating.
- [Runtime Technology and Package Strategy](./RUNTIME_TECH_AND_PACKAGE_STRATEGY.md) - how Temporal TS, Dapr Actors, NATS, Oz/Warp run orchestration, OpenZiti transport, Hermes, Hindsight, and reusable `agentic-services` primitives fit into a new Hermes-native platform.
- [UI and Observability Concepts](./UI_AND_OBSERVABILITY_CONCEPTS.md) - how humans visualize and operate the Organization across work, agents, hats, runs, pods, clusters, meetings, reports, and evidence.
- [Department, Hat, and Tool Inventory](./DEPARTMENT_HAT_TOOL_INVENTORY.md) - the starter department map, hat catalog, tool bundles, approval gates, lifecycle ownership, and high-risk guardrails for the Organization.
- [Organization Layer Build Plan](./ORGANIZATION_LAYER_BUILD_PLAN.md) - the service layer, role workspaces, automation loops, state model, UI surfaces, and MVP sequence needed to make each department and hat operational.
- [Work and Release Management OS](./WORK_AND_RELEASE_MANAGEMENT_OS.md) - the custom backlog, project, task, assignment, signal, board, and release workflow product that keeps agent work reliable and visible.
- [Ambiguous Requirement Lifecycle](./AMBIGUOUS_REQUIREMENT_LIFECYCLE.md) - the discovery, customer interview, BRD, workflow modeling, architecture, decomposition, readiness, and learning path from vague request to curated feature.
- [Anti-Stall Prioritization Runtime](./ANTI_STALL_PRIORITY_RUNTIME.md) - the hat-owned schedules, blocker triage, queue SLO, reassignment, alternate-work, dependency reconciliation, and priority routines that keep the Organization moving.
- [Implementation Readiness Checklist](./IMPLEMENTATION_READINESS_CHECKLIST.md) - the decisions and contracts that should be defined before scaffolding the first implementation slice.
- [Cluster-Native Hat System](./CLUSTER_NATIVE_HAT_SYSTEM.md) - the theoretical CRD, OPA, hat binding, succession, reputation, graph rendering, and event model for enforcing hats on Kubernetes.
- [Cluster Execution and Memory Substrate](./CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md) - the k3s, sandboxed Hermes container, Cilium Service Mesh, SPIRE identity, Vault-backed secrets, Credential Proxy, NATS, Hindsight, and runtime observability contract.
- [AI Cluster Scaffold Context](./AI_CLUSTER_SCAFFOLD_CONTEXT.md) - the two-directory NixOS/k3s/ArgoCD scaffold assumptions, component clarifications, bootstrap constraints, and deferred/local-model gating.
- [Architecture Source](./ORGANIZATION_RUNTIME_ARCHITECTURE.md) - the current conceptual architecture and operating model.

The intent is to keep the architecture document focused on what the Organization is, while implementation documents describe how to build it incrementally.
