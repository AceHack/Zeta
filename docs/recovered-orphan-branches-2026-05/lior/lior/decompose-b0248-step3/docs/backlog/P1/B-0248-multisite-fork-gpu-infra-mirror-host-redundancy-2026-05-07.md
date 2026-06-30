---
id: B-0248
priority: P1
status: open
title: "Multi-site fork + GPU infrastructure redundancy — maintainer mirrors, Max 24/7 host, Rodney local GPU pool"
created: 2026-05-07
last_updated: 2026-05-16
depends_on: [B-0110, B-0240, B-0246, B-0247]
decomposition: sliceable
children: [B-0248.1, B-0554]
owners: [architect, infrastructure-operator, security-auditor]
type: feature
---

# B-0248 — Multi-site fork + GPU infrastructure redundancy

## What

Mechanize Zeta's repository and compute redundancy across
trusted human maintainers and local hardware sites.

Aaron 2026-05-07:

> max wil run you at his house 24 7 tooo and we have rodn 20
> mini pc with gpus over emnibus and pcie gen 5

Operational reading:

- AceHack/Zeta is the current personal backup mirror.
- Addison and Max can create their own forks/mirrors.
- Max can run a Zeta agent loop 24/7 from his house.
- Rodney is the local GPU pool candidate: roughly 20 mini PCs
  with GPUs over Omnibus / PCIe Gen 5.
- The system should treat repository mirrors, host loops, and
  GPU capacity as one availability surface.

## Why

The product path needs more than code in one GitHub org and one
local machine. Ace DLCs, structure recognition, local inference,
and the Green Lantern device all depend on a substrate that keeps
working if one account, machine, fork, or site is unavailable.

This is BFT applied below the agent layer:

- **Repository layer**: multiple fork owners, each with a synced
  mirror of LFG/Zeta main.
- **Host layer**: multiple physical loop hosts, including Max's
  24/7 site.
- **Compute layer**: local GPU pool for B-0240/B-0244/B-0246/B-0247
  workloads.
- **Governance layer**: maintainer-owned accounts and explicit
  ruleset/sync permissions, not invisible chat instructions.

## Scope

Implement the runbooks, checks, and coordination surfaces needed
for:

1. Maintainer fork onboarding for Addison and Max. (Extracted to B-0248.1)
2. Mirror-sync setup per `.claude/skills/mirror-sync/SKILL.md`. (Extracted to B-0248.1)
3. Host-loop setup for Max's 24/7 site, using a main-backed
   control clone instead of a contested root checkout. (Extracted to B-0554)
4. Hardware inventory capture for Rodney: machine count, GPU
   types, interconnect, OS, power/network assumptions, and
   expected workloads.
5. Health probes that report repo mirror freshness, host-loop
   liveness, GPU availability, and active claim/worktree state.
6. Disaster-recovery drill: recover from LFG/Zeta unavailability
   using one maintained fork as the source of truth candidate.

## Non-goals

- Do not grant machine-account authority without a human sponsor
  and current GitHub ruleset review.
- Do not make forks active write surfaces unless a maintainer
  explicitly promotes one during a recovery event.
- Do not run claim work from a shared root checkout.
- Do not assume local GPU hardware is production-ready until
  inventory, thermal/power, and workload checks are captured.

## Acceptance criteria

- Addison and Max each have a documented fork/mirror onboarding
  packet.
- At least two non-LFG mirrors can be refreshed with
  force-with-lease or an approved PR-based mirror path.
- Max's site has a documented control-clone/launchd or equivalent
  host-loop setup with health probe output.
- Rodney inventory is captured in repo substrate, including GPU
  count/type and interconnect assumptions.
- A single command or documented checklist reports:
  mirror freshness, loop health, GPU availability, and outstanding
  archive/claim work.
- A recovery drill shows how to re-point agents from LFG/Zeta to
  a maintained fork without losing git-native claim history.

## Composes with

- B-0110 - AceHack mirror-refresh protocol drift
- B-0240 - structure recognizer
- B-0244 - coherence/concordance AI on local GPUs
- B-0246 - Green Lantern ring edge device
- B-0247 - Ace DLC content packs
- `.claude/skills/mirror-sync/SKILL.md`
