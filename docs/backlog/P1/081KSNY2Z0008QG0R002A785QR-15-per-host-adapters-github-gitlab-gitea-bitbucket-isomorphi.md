---
id: 081KSNY2Z0008QG0R002A785QR
priority: P1
status: open
title: Per-host adapters — GitHub + GitLab + Gitea/Codeberg/Forgejo + Bitbucket; isomorphic cross-host substrate per parent 081KSKBP80008QG0R000B3Y19A pre-allocation
effort: L
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R001DFZK4V
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KSNY2Z0008QG0R003X1QWYG
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KSNY2Z0008QG0R0034FR5FG
tags:
  - per-host-adapters
  - github-adapter
  - gitlab-adapter
  - gitea-codeberg-forgejo-adapter
  - bitbucket-adapter
  - isomorphic-cross-host-substrate
  - parent-allocated-subdecimal
  - thin-adapter-layer-on-git-only-core
  - vendor-independence-at-host-scope
  - composes-with-zeta-native-review-b-0887
  - composes-with-github-actions-recursion-b-0874
---

## What this row tracks

The 081KSNY2Z0008QG0R002A785QR slot allocated by the parent workflow-engine row. Operator 2026-05-28 explicit framing made this concrete:

> *"Then it can run isomorphic on GitLab and GitHub"*

Build thin per-host adapters so the agent-loop substrate (081KSKBP80008QG0R000B3Y19A + 081KSNY2Z0008QG0R001DFZK4V + 081KSNY2Z0008QG0R003X1QWYG + the runtime cluster) runs isomorphically on any major Git host.

## Architecture (Git-only core + thin per-host adapters)

The substrate's CORE operates on Git directly:

- Push events (Git push protocol)
- Branch state (refs)
- File content (Git objects)
- Event log (commits + tree)
- Playbook documents (markdown files in tree)

The substrate's PER-HOST surface (thin adapter layer) handles:

- CI runtime invocation (GitHub Actions vs GitLab CI vs Bitbucket Pipelines vs self-hosted runners)
- API surface for status checks, branch protection rules, webhook delivery
- Authentication (GitHub token vs GitLab PAT vs SSH key vs OAuth)

## Adapter targets

| Host | Adapter scope |
|---|---|
| **GitHub** | Actions runtime; REST + GraphQL APIs (existing — 081KSNY2Z0008QG0R003X1QWYG builds here) |
| **GitLab** | CI/CD runtime; GitLab REST API |
| **Gitea / Codeberg / Forgejo** | Gitea Actions (Actions-compatible); Gitea API |
| **Bitbucket** | Bitbucket Pipelines runtime; Bitbucket API |
| **Self-hosted (no host UI)** | Pure Git protocol; runner via systemd / launchd / cron — minimal adapter |

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/hosts/github.ts` — extracts existing GitHub-specific code into adapter
- `src/Core.TypeScript/workflow-engine/agent-loop/hosts/gitlab.ts` — GitLab equivalent
- `src/Core.TypeScript/workflow-engine/agent-loop/hosts/gitea.ts` — Gitea / Codeberg / Forgejo equivalent
- `src/Core.TypeScript/workflow-engine/agent-loop/hosts/bitbucket.ts` — Bitbucket equivalent
- `src/Core.TypeScript/workflow-engine/agent-loop/hosts/pure-git.ts` — self-hosted no-UI adapter (minimal)
- `src/Core.TypeScript/workflow-engine/agent-loop/hosts/index.ts` — host-detection + adapter dispatch
- Core agent-loop substrate (state-machine, work-lifecycle, event-log, playbook) remains host-agnostic; only adapters touch host-specific APIs
- Tests cover: adapter contracts (each host produces identical observable behavior for the same agent-loop operations); host-detection correctness; fallback to pure-git
- README documents the adapter contract + how to add a new host

## Composition

- **081KSKBP80008QG0R000B3Y19A** (parent) — pre-allocated this slot
- **081KSNY2Z0008QG0R001DFZK4V** (Zeta-native review substrate) — runs isomorphic across hosts via these adapters
- **081KSNY2Z0008QG0R003X1QWYG** (GitHub Actions recursion) — the GitHub-specific runtime adapter for the no-PR-swarm substrate
- **081KSNY2Z0008QG0R0011XCT94** (zflash USB-bound credential substrate) — vendor-independence at credential-store scope composes with vendor-independence at host scope (different vectors of vendor-independence)
- **081KSNY2Z0008QG0R0034FR5FG** (ASAP cluster umbrella) — host-adapters are part of the cluster's vendor-independence story; should be added to umbrella's composition

## Strategic implication

Vendor-independence at GIT HOST scope. Operator can run Zeta on GitHub free-tier today, migrate to GitLab self-hosted tomorrow, run on Codeberg next month, all without changing core substrate. Different from 081KSNY2Z0008QG0R0011XCT94's USB-vendor-independence (credential-store level); different from "spread outside vendors" framing in 081KSNY2Z0008QG0R0034FR5FG (which referred to AI-vendor harnesses).

Three orthogonal vendor-independence axes:

| Axis | Substrate |
|---|---|
| AI vendor harness independence | 081KSNY2Z0008QG0R0034FR5FG cluster (skill distribution; runs on any bun-capable harness) |
| Credential-store vendor independence | 081KSNY2Z0008QG0R0011XCT94 + 081KSKBP80008QG0R003AX2A69 cluster (USB-bound, no cloud-vendor key escrow) |
| Git host vendor independence | THIS ROW (isomorphic on GitHub/GitLab/Gitea/etc.) |

Each composes independently; together they make Zeta deployable in any combination.

## Substrate-honest framing

P1 per operator's just-now isomorphic-cross-host framing. Effort L because adapter contracts need careful design (different host APIs have different shapes; the contract must be expressive enough to absorb that variation without leaking host-specifics into core).

## Full reasoning

Operator 2026-05-28: *"Then it can run isomorphic on GitLab and GitHub"*

Parent 081KSKBP80008QG0R000B3Y19A row pre-allocated this slot for "Per-host adapters (GitHub state machine, GitLab state machine, etc.)" — this row makes the slot concrete and fills it with the per-host adapter design.

Composes with 081KSNY2Z0008QG0R001DFZK4V (the Zeta-native review substrate that benefits from isomorphic-cross-host); 081KSNY2Z0008QG0R003X1QWYG (the GitHub-specific runtime that becomes one of N adapters); 081KSNY2Z0008QG0R0034FR5FG (the ASAP cluster umbrella).
