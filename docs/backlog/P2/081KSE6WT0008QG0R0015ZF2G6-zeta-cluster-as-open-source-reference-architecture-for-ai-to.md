---
id: 081KSE6WT0008QG0R0015ZF2G6
priority: P2
status: open
title: Zeta cluster as open-source reference architecture for AI to train on and compete on — ARC-AGI-style benchmark substrate
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSE6WT0008QG0R003612WGJ
  - 081KSE6WT0008QG0R001NG9JZH
  - 081KSE6WT0008QG0R000CV98PV
  - 081KSE6WT0008QG0R00021PPX1
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R003WG0V6P
tags: [cluster, reference-architecture, ai-training, benchmark, open-source, arc-agi]
---

## Problem

Aaron 2026-05-25, immediately after the second successful zflash
session: *"also by having a common reference stack we are defining
a common open source reference archceture that is modern and cloud
agnostic for AI to train on and compete on like the ARC3 AGI
competition."*

The Zeta cluster substrate (NixOS declarative + k3s + Longhorn /
future Ceph/Rook + zero-typing USB install + 3-node HA quorum +
mDNS auto-discovery + GitOps + AI-cluster modules) is being built
as a usable home-cluster product (per 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user
persona). But it ALSO incidentally defines something rarer in the
AI/cluster space:

> **A complete, modern, cloud-agnostic, open-source reference
> architecture that AI systems can train on, benchmark against,
> and compete to improve.**

Most "reference architectures" in this space are either:

- **Vendor-specific** (AWS Well-Architected, Azure Cloud Adoption
  Framework, GCP Cloud Architecture Framework) — locked to one
  cloud, not reproducible, hard for AI to train against
- **Conceptual / paper-only** (academic cluster designs, k8s
  documentation patterns) — not actually runnable end-to-end
- **Commercial / closed** (Anthos, OpenShift) — not freely
  inspectable; AI can't see the substrate
- **Niche / not modern** (older OpenStack tutorials, raw kubeadm
  walkthroughs) — don't reflect 2026-era best practices

Zeta is positioned to be:

1. **Open-source end-to-end** — every layer inspectable, every
   decision reviewable, every artifact reproducible
2. **Modern** — NixOS declarative, GitOps native, AI-cluster
   integration, biometric desktop consent (081KSE6WT0008QG0R003WW3YJQ), zero-typing
   installer (081KSGS9H0008QG0R002T3BJ2R), unRAID-style USB-resident-OS option
   (081KSE6WT0008QG0R00021PPX1), USB-as-repair-tool (081KSE6WT0008QG0R003WG0V6P)
3. **Cloud-agnostic** — runs on bare metal, in any datacenter,
   on any home lab; not tied to a hyperscaler
4. **Reproducible from first principles** — Nix flakes pin every
   input; rebuild the entire cluster from `git clone` + ISO build
5. **AI-trainable** — every decision documented in backlog rows,
   substrate, memory, ADRs; AI can ingest the full design
   rationale + actually reproduce the cluster + verify against
   the same substrate

## Target

Position + harden Zeta as the **canonical open-source reference
architecture for modern AI clusters** — a substrate that:

- AI systems can train on (full reasoning chain from "I want a
  cluster" to "node 3 just joined; production-ready" is
  preserved + traceable)
- AI systems can compete against (ARC-AGI-style benchmark: given
  the same starting state, can AI X build a working cluster
  faster / better / more reliably than AI Y? Can AI X recover
  from a 2-node failure as fast as AI Y?)
- Humans can deploy AS-IS for home / lab / small-prod use
- Researchers can fork + modify + measure against

## ARC-AGI parallel

[ARC-AGI](https://arcprize.org/) (Abstraction and Reasoning Corpus
for Artificial General Intelligence) is a benchmark + prize where
AI systems are scored on novel reasoning tasks. The competitive
shape (open benchmark, public submissions, transparent scoring,
$1M+ prize) drove serious AI research progress.

A Zeta-cluster-reference-architecture benchmark could mirror that
shape at the infrastructure / cluster / DevOps domain:

| ARC-AGI parallel | Zeta cluster reference |
|---|---|
| Public benchmark tasks | Public cluster-install scenarios (1-node, 3-node HA, single-node-failure, hardware-swap, version-upgrade, network-partition) |
| Open scoring rubric | Open scoring rubric (install time, downtime during failure, recovery time, declarative-state match, security floor) |
| Reproducible test environment | Reproducible test environment (Nix-pinned, ISO byte-identical, hardware emulated via QEMU or real bare-metal racks) |
| AI systems submit solutions | AI systems submit cluster-build runs (full transcripts + commits + final state) |
| Public leaderboard | Public leaderboard (per-scenario, per-AI-system) |
| Prize + recognition | Prize + recognition (sponsor + naming-rights) |

## Acceptance

- [ ] Documentation surface: `docs/reference-architecture.md`
      (or top-level README section) positioning Zeta as the
      reference architecture; explicit "this is for humans AND
      AI training" framing
- [ ] Reproducibility audit: every cluster-install decision
      traceable to a backlog row, ADR, or memory; no tribal
      knowledge in build path; AI can ingest the full chain
- [ ] Benchmark scenarios defined: minimum 5 starter scenarios
      (1-node bootstrap, 3-node HA, single-node-fail-recover,
      worker-node-add, version-upgrade) with scoring rubric +
      reference solutions
- [ ] Public leaderboard infrastructure: where AI submissions
      get scored + ranked; could start as a `docs/` table that
      gets manually updated, evolve toward automated CI
- [ ] Cloud-agnostic verification: cluster builds + passes
      scenarios on bare metal AND in QEMU AND in cloud VMs
      (different IaaS substrate per cloud; same Zeta substrate
      on top)
- [ ] Competition prize / sponsor scoping: what's the actual
      incentive structure that gets AI labs to compete? (Open
      question; out-of-scope for first iteration; mention as
      stretch goal)
- [ ] Marketing surface: README banner explicitly naming this
      positioning; competitive framing vs proprietary
      reference architectures (Anthos, OpenShift, AWS-WA)

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R — zero-typing USB install (the substrate's UX delivery)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy expansion (the reference architecture
  needs full role coverage)
- 081KSE6WT0008QG0R001NG9JZH — HA control-plane (production-ready inflection)
- 081KSE6WT0008QG0R000CV98PV — cluster auto-discovery (the seamless growth path)
- 081KSE6WT0008QG0R00021PPX1 — USB-persistent OS (the unRAID-style competitive
  framing for storage-heavy reference deployments)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user UX audit (the human-facing
  half; this row is the AI-facing half)
- 081KSE6WT0008QG0R003WG0V6P — USB as repair tool (the no-disruption-at-3+-nodes
  invariant the benchmark would test)
- `docs/research/2026-05-25-...` — full session substrate
  from today's cluster-install work
- `project_zeta_cluster_install_target_persona_first_time_cli_users_3_node_production_ready_easier_than_proxmox_aaron_2026_05_25.md`
  — the persona memo this row's AI-training framing extends

## Why this matters

The substrate-honest argument: in a world where AI systems are
being deployed to operate AND build infrastructure (Devin,
Aider, Claude Code, Cursor agents, AutoGen, etc.), the AI's
training data + reasoning surface MUST include real,
production-quality reference architectures. If those references
are proprietary / cloud-locked / closed-source, AI capabilities
in this domain will calcify around what's training-accessible
(mostly toy examples + vendor blog posts).

Zeta cluster substrate as an open reference architecture changes
the supply: AI systems training on Zeta have access to the
complete reasoning chain (backlog rows + ADRs + memory files +
research substrate + actual working code + reproducible builds).
That raises the floor for AI infrastructure capability across
the field.

The competitive benchmark shape (ARC-AGI parallel) then turns
that supply into a forcing function for continued improvement —
AI systems compete to operate the reference architecture better,
which improves the substrate for everyone.

## Out of scope

- Multi-cloud-portability tooling (Terraform / Crossplane /
  KubeVela bridges) — separate scope; covered by existing
  081KSE6WT0008QG0R002E6P098 / 081KSE6WT0008QG0R001RG4FXD work
- AI-vs-AI competition tooling (judge framework, transcript
  diffing, automated scoring) — separate scope; out of this
  row's v1
- Reference-architecture branding / domain / marketing
  campaign — separate scope; covered by branding-specialist
  skill if/when activated

## Origin

Aaron 2026-05-25, mid-second-zflash-session, naming the broader
positioning that the cluster-install work has been building
toward: open reference architecture for AI training + competition.
