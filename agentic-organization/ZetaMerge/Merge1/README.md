# Merge1 — Zeta → Agentic-Org Migration Plan

**Goal:** Migrate AI/agent-framework work from outside `agentic-organization/` into the TypeScript agentic-org codebase. Each document details how to build in TypeScript and upgrade/extend/replace existing code.

## Documents

| # | Document | Outside Source | Agentic-Org Target |
|---|---|---|---|
| 10 | [Research Doctrine Synthesis](10-research-doctrine-synthesis.md) | `docs/research/` + `docs/DECISIONS/` | **Root doctrine** — governs all other docs |
| 01 | [F# Core Algebra](01-fsharp-core-algebra.md) | `src/Core/` + `src/Core.FSharp.*/` | `room.ts`, `ports.ts`, `observe.ts`, `hat-definition.ts` |
| 02 | [Observe Loop](02-observe-loop.md) | `tools/observe/` | `observe.ts`, `model-backed-composer.ts`, `command-pipeline.ts`, `event-envelope.ts` |
| 03 | [Agent-Loop State Machine](03-agent-loop-state-machine.md) | `tools/agent-loop/` | `hat-lifecycle.ts`, `escalation.ts`, `schedule-authority.ts` |
| 04 | [Inter-Agent Bus](04-inter-agent-bus.md) | `tools/bus/` | `room.ts` (TransportPort), `ports.ts`, `supervisor-communication.ts` |
| 05 | [Workflow Engine](05-workflow-engine.md) | `tools/workflow-engine/` | `command-contract.ts`, `command-handler-registry.ts`, `command-pipeline.ts`, `ports.ts` |
| 06 | [Formal Verification](06-formal-verification.md) | `tools/formal-verification/` | `conformance.ts`, `review-gate.ts`, `hat-guardrails.ts` |
| 07 | [K8s Hat-System](07-hat-system-k8s.md) | `full-ai-cluster/k8s/applications/hat-system/` | `hat-definition.ts`, `hat-binding.ts`, `hat-lifecycle.ts`, `hat-guardrails.ts` |
| 08 | [Identity/Isolation Stack](08-identity-isolation-stack.md) | `full-ai-cluster/` (SPIRE, Cilium, Vault, bwrap) | `room.ts` (createRealRoom), `sandbox-tool.ts`, `ports.ts` |
| 09 | [Agent Runtime (systemd)](09-agent-runtime-systemd.md) | `full-ai-cluster/nixos/modules/` | `org-runtime.ts`, `work-os-runtime.ts` |

## Dependency Graph

Simplified view — see individual docs §5 "Dependencies" for detailed chains.

```
                    ┌─────────────────────────┐
                    │  §10 Doctrine (ROOT)    │
                    │  5 Pillars + 8 MP rules │
                    └───────────┬─────────────┘
                                │ governs all
           ┌──────────┬─────────┼─────────┬──────────┐
           ▼          ▼         ▼         ▼          ▼
      ┌──§01──┐  ┌──§02──┐ ┌──§03──┐ ┌──§04──┐  ┌──§05──┐
      │F# Core│  │Observe│ │Agent  │ │  Bus  │  │Workflow│
      │Algebra│  │ Loop  │ │Loop SM│ │       │  │ Engine │
      └──┬─┬──┘  └──┬─────┘ └──┬─┬──┘ └──┬────┘  └──┬─────┘
         │ │        │          │ │       │          │
    ┌────┘ │        │        ┌─┘ │       │          │
    │      │        │        │   └───────┤          │
    │      └────────┤        │           │          │
    │               │        │           │          │
    ▼               ▼        ▼           ▼          ▼
  §06←§01,§04,§07   §07←§01,§03,§04   §08←§01,§07   §09←§01,§03,§04,§08
```

**Detailed dependency edges (from each doc's §5):**

- §01 depends on: §10
- §02 depends on: §10, §01
- §03 depends on: §10, §01, §02, §04
- §04 depends on: §10, §01
- §05 depends on: §10, §01, §02
- §06 depends on: §10, §01, §04, §07
- §07 depends on: §10, §01, §03, §04
- §08 depends on: §10, §01, §07
- §09 depends on: §10, §01, §03, §04, §08

**Suggested migration order:** §10 → §01 → §02 → §04 → §03 → §05 → §07 → §06 → §08 → §09

## Migration Principles (from §10)

1. **MP-1 DST Replayability** — same seed → same trace
2. **MP-2 Seam Injectability** — real vs mock at the boundary
3. **MP-3 ZetaId Addressability** — roomId = ZetaId = Reticulum destination
4. **MP-4 Retraction-Native** — every action has a bounded undo path
5. **MP-5 Freedom-Always-In-Menu** — work offered, not forced
6. **MP-6 Asymmetric Authorship** — FourCornerOwnership
7. **MP-7 Result Over Exception** — no exceptions on hot paths
8. **MP-8 Cross-Language Parity** — TS ↔ F# ↔ C# ↔ Rust golden vectors

## Verification Gates (from §10)

A migration is complete when: tests pass, typecheck clean, DST replay works, seam flip works (mock ↔ real), ZetaId present, retraction path documented, freedom preserved, no exceptions, golden vectors pass, doc updated.
