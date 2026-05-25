---
id: B-0759
title: Cluster-install UX audit against first-time-CLI-user persona — "easier than Proxmox" bar + 3-node production-ready inflection
status: open
priority: P2
effort: M
created: 2026-05-25
last_updated: 2026-05-25
authors: [aaron, otto-cli]
composes_with: [B-0737, B-0738, B-0739, B-0743, B-0754, B-0755, B-0756, B-0757, B-0758]
depends_on: [B-0754]
tags: [cluster, ux, persona, docs, marketing]
---

## Problem

Aaron 2026-05-25 named the cluster-install target persona:
*"if i'm targeting first time commandline users that's the persona
i'm going for so this can spread easliy to home clusters easlier
than proxmox or any of that but prodicution ready once 3 nodes"*.

Today's cluster-install substrate (B-0737 + B-0754 + flash-
cluster-iso skill + PROVISIONING.md + zeta-install.sh +
zeta-first-boot.sh) was built incrementally without an explicit
persona filter. Some surfaces already pass it (the zflash
one-touch flow, the 10-sec role keystroke prompt, the auto-DHCP +
nmtui-fallback). Others probably don't (the manual override
documentation in PROVISIONING.md still assumes Linux fluency; the
zeta-install.sh error messages bail without recovery suggestions
in some cases; the role-name vocabulary `worker-gpu` /
`control-plane` is k8s-jargon-y for a first-time user).

## Target

Every cluster-install surface (operator-facing artifact only —
not maintainer / agent internals) passes the two filters:

1. **First-time-CLI-user persona filter** — plain language, no
   unexplained acronyms, actionable error messages, zero-config
   happy path
2. **3-node prod-ready inflection filter** — composes toward the
   "you just shipped a production-ready cluster in an evening"
   moment when the 3rd control-plane node joins

## Acceptance

- [ ] Audit pass on `full-ai-cluster/PROVISIONING.md` — rewrite
      sections that assume Linux fluency; add "what just
      happened" explainers after each step; surface the 3-node
      inflection as the canonical growth path
- [ ] Audit pass on `full-ai-cluster/README.md` — competitive
      framing (Proxmox / unRAID / Talos / k3sup); first-time-user
      "start here" path; explicit persona statement at the top
- [ ] Audit pass on `full-ai-cluster/usb-nixos-installer/zeta-install.sh`
      and `zeta-first-boot.sh` — error messages name next safe
      action; bail messages point at recovery / alternative
      paths (e.g., "no internal disks → see USB-persistent OS at
      B-0758")
- [ ] Audit pass on the in-ISO `/etc/zeta-install.md` text in
      `configuration.nix` — same persona filter
- [ ] Audit pass on `.claude/skills/flash-cluster-iso/SKILL.md`
      — agent-facing but documentation generation should mirror
      the persona
- [ ] Acronym glossary added: `k3s`, `nixos`, `disko`, `longhorn`,
      `ceph`, `rook`, `etcd`, `raft`, `mDNS`, `nmtui`, `ESP`,
      `EFI`, `DHCP`, `SOPS`, `age` — first use of each gets a
      one-line explanation in the docs they appear in
- [ ] Comparison table added to README: Zeta cluster-install vs
      Proxmox VE / unRAID / Talos / k3sup / k3os — honest
      strengths + scope-exclusions
- [ ] "Production-ready at 3 nodes" inflection celebrated:
      auto-discovery (B-0757) announces when the 3rd CP joins;
      docs explicitly call out the moment; recovery paths
      assume HA from that point
- [ ] "Zero-config happy path" tested end-to-end by a non-
      maintainer user (recruited externally) — empirical
      validation of the persona bet; results captured as
      research substrate; iteration based on actual failure
      modes

## Composes with

- B-0737 — zflash + Touch ID (one-touch Mac-side; already
  persona-aligned)
- B-0738 / B-0739 — Linux + Windows zflash extensions (must
  apply same persona filter)
- B-0743 — "I execute, you fingerprint" (consent UX pattern;
  already persona-aligned)
- B-0754 v1 — zero-typing first-boot + greedy N-disk
- B-0755 — role taxonomy expansion (persona-aligned role
  names: `all-in-one`, `storage-only`, etc.)
- B-0756 — HA control-plane (the 3-node inflection's
  technical substrate)
- B-0757 — cluster auto-discovery (the seamless growth path)
- B-0758 — USB-persistent OS unRAID-style (the explicit
  unRAID competitive framing)
- `.claude/skills/user-experience-engineer/SKILL.md` —
  first-10-minutes UX audit discipline applies here
- `.claude/skills/developer-experience-engineer/SKILL.md` —
  first-60-minutes friction discipline applies to power-user
  override paths
- `.claude/skills/branding-specialist/SKILL.md` — product
  identity + competitive positioning input

## Out of scope

- General Zeta library UX (Zeta.Core, Zeta.Bayesian) — separate
  persona (developer using Zeta as a library); covered by
  user-experience-engineer skill
- AI cluster workload UX (running ML training jobs on the
  installed cluster) — different persona; out of cluster-
  install scope
- Multi-region / enterprise prod ops — different persona;
  out of B-0754/B-0759 v1 scope

## Origin

Aaron 2026-05-25, mid-B-0754-v1 conversation, naming the
target persona that the cluster-install substrate has been
implicitly serving.
