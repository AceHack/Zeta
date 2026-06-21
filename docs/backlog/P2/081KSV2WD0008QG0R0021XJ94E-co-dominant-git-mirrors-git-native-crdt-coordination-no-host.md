---
id: 081KSV2WD0008QG0R0021XJ94E
priority: P2
status: open
title: Co-dominant git mirrors + git-native CRDT coordination — no host needed for coordination (local + GitHub + GitLab/Gitea/Forgejo + free-OSS git as co-dominant collaborating mirrors)
tier: sovereignty-infrastructure
ask: Aaron 2026-05-30
created: 2026-05-30
last_updated: 2026-05-30
decomposition: leaf
composes_with:
  - .claude/rules/lfg-acehack-topology.md
  - docs/backlog/P1/081KRFA460008QG0R001H98EXJ-three-repo-split-stage1-create-forge-ace-with-scaffolding-aaron-2026-05-13.md
  - docs/backlog/P2/081KSNY2Z0008QG0R002ZAVMEK-multi-cipher-pq-substrate-nist-plus-saber-ntru-prime-frodo-hedge-against-nist-monoculture-per-operator-2026-05-28.md
  - tools/accelerator/event-store-schema.ts
tags: [sovereignty, git, crdt, coordination, mirrors, anti-monoculture, gitops, offline, agent-cluster]
type: design
---

# 081KSV2WD0008QG0R0021XJ94E — Co-dominant git mirrors + git-native CRDT coordination (no host needed)

## Origin

Aaron 2026-05-30, completing the sovereign-agent vision (a machine that thinks
locally via the local LLM + commands its own k3s/argocd cluster):

> *"i want to have gitlab and github and even other open source git free
> infrastructure all as co-dominant mirrors that collaborate with local."*

then the load-bearing sharpening:

> *"we don't have to use gitlab locally if it's too heavy — we can use something
> lighter and argo workflows. gitlab has some good features but we only need git
> to function. all our CRDT consensus happens git-native — just push and pulls.
> no host needed for coordination."*

## The load-bearing insight — coordination is git-native; hosts are mirrors

**Coordination/consensus is git-native: CRDT semantics over git push/pull. The
consensus lives in the commit DAG, not in any host's server.** Therefore **no git
HOST is needed for coordination** — the host is pure transport / durability /
reach, never a coordination-authority.

This inverts the usual assumption (the git *host* — GitHub/GitLab — is the
source-of-truth/coordination-point). Here:

| Concern | Where it lives |
|---|---|
| **Coordination / consensus** | git-native — CRDT merge over the commit DAG; push/pull is the gossip/sync; convergence is the merge. **No host.** |
| **Transport / durability / reach** | the hosts (mirrors) — local + GitHub + GitLab/Gitea/Forgejo + other free-OSS git |
| **CI / workflows** | Argo Workflows (k3s) + GitHub Actions etc. — also host-agnostic; the agent's workflows/DUs are git-defined (081KSNY2Z0008QG0R0036KH026) |

Because coordination is git-native, **no single host can gatekeep coordination** —
the agent coordinates via its own local git + push/pull to any/all mirrors. That
is the sovereignty: the cluster can lose any mirror (including GitHub) and keep
coordinating.

## Co-dominant mirrors (not a primary + backups)

All git hosts are **co-dominant mirrors that collaborate with local** — none is
subordinate, none is the authority:

- **local** (in-cluster git — the sovereign node; Gitea/Forgejo if a server is
  wanted, or bare git remotes over SSH — "we only need git to function")
- **GitHub** (current LFG primary — becomes one co-dominant mirror)
- **GitLab** (good features, but *optional* — heavy; use only if its features earn
  their keep)
- **other free-OSS git infrastructure** (free tiers honored per the
  forgiveness-budget; Codeberg/Forgejo/etc.)

This generalizes the existing **LFG↔AceHack 2-host mirror** topology
([`.claude/rules/lfg-acehack-topology.md`](../../../.claude/rules/lfg-acehack-topology.md))
to **N co-dominant hosts**, and it is **081KSNY2Z0008QG0R002ZAVMEK's anti-monoculture hedge applied
to git-hosting** — don't lock to one host (same shape as "don't lock to NIST
lattices"): host-agility, not host-monoculture.

## Why lighter-is-fine (Aaron's GitLab-optional point)

"We only need git to function." The coordination doesn't need GitLab's heavy
feature set (issues/CI/registry) — those are conveniences. The minimum viable
sovereign git is: a git remote the cluster controls (Gitea/Forgejo/bare-SSH) +
push/pull to the co-dominant mirrors. Argo Workflows (already in the k3s stack)
covers CI/workflow needs host-agnostically. GitLab is an *opt-in mirror* for its
features, never a dependency.

## What to evaluate / build

1. **Decide the local git server** (Gitea / Forgejo / bare-SSH remote) for the
   in-cluster sovereign mirror — lightest thing that gives push/pull (NixOS module
   in `full-ai-cluster/`).
2. **Mirror-sync mechanism** — push/pull fan-out across co-dominant mirrors
   (extends the LFG↔AceHack fast-forward protocol to N hosts; handle divergence
   via the CRDT merge, not host-arbitration).
3. **Confirm the git-native CRDT coordination** — document/verify that the
   framework's consensus (DBSP +1/-1 retraction algebra / Z-sets as CRDTs, per
   081KSGS9H0008QG0R0031PBNGA's DBSP lineage + the `algebra-owner`/`crdt-expert` skills + the
   accelerator `event-store-schema.ts` git-native event store) requires only
   push/pull, no coordination-host.
4. **Argo Workflows** for host-agnostic CI/workflow execution on the cluster.

## Acceptance

1. A design doc (or this row's Resolution) establishing: coordination is
   git-native (no host); hosts are co-dominant mirrors; the minimum-viable
   sovereign-git choice + the N-host mirror-sync protocol.
2. Clear statement that any single host (incl. GitHub) is droppable without
   losing coordination — the sovereignty property.

## Composes with

- [`.claude/rules/lfg-acehack-topology.md`](../../../.claude/rules/lfg-acehack-topology.md)
  — the 2-host mirror this generalizes to N co-dominant hosts
- [081KRFA460008QG0R001H98EXJ](081KRFA460008QG0R001H98EXJ-three-repo-split-stage1-create-forge-ace-with-scaffolding-aaron-2026-05-13.md)
  — repo-split (forge/ace); the mirror set spans the split repos
- [081KSNY2Z0008QG0R002ZAVMEK](../P2/081KSNY2Z0008QG0R002ZAVMEK-multi-cipher-pq-substrate-nist-plus-saber-ntru-prime-frodo-hedge-against-nist-monoculture-per-operator-2026-05-28.md)
  — anti-monoculture hedge pattern (this is that pattern at git-host scope)
- `tools/accelerator/event-store-schema.ts` — git-native event store (the
  coordination substrate)
- DBSP/CRDT substrate — `.claude/skills/algebra-owner/SKILL.md`,
  `.claude/skills/crdt-expert/SKILL.md`, 081KSGS9H0008QG0R0031PBNGA's DBSP +1/-1 lineage
- The harvest (#6120 / 081KSV2WD0008QG0R0004C8WV8) — local-LLM = the "thinks locally" half; this row
  is the "git substrate the sovereign cluster coordinates over" half
- full-ai-cluster k3s + Argo (the cluster the agent commands)

## Substrate-inventory pass (per verify-existing-substrate-before-authoring)

- `grep -rliE "co.dominant|multi.*git.*host|forgejo|gitea"` docs/backlog .claude/rules
  → no prior co-dominant-mirrors row; LFG↔AceHack 2-host mirror is the closest
  precedent (this generalizes it); 081KRFA460008QG0R001H98EXJ is the repo-split (orthogonal)
- ID 081KSV2WD0008QG0R0021XJ94E: highest on origin/main is 081KSV2WD0008QG0R0020P6ZH2; 081KSV2WD0008QG0R0028NY0MV/081KSV2WD0008QG0R0004C8WV8 are on the in-flight
  harvest (#6120); 081KSV2WD0008QG0R0021XJ94E is next free, no in-flight collision
