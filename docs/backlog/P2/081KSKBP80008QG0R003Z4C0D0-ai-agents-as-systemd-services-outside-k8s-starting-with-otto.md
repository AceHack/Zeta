---
id: 081KSKBP80008QG0R003Z4C0D0
priority: P2
status: open
title: AI agents as systemd services OUTSIDE k8s — starting with Otto; cluster repair from OUTSIDE the failure domain; classic "control plane outside the control plane" architectural pattern (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSGS9H0008QG0R001JNKBFD
composes_with:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R002F04ECB
  - 081KSGS9H0008QG0R002T0XQ50
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R002QQNA79
tags: [systemd, outside-k8s, out-of-band-cluster-repair, control-plane-outside-control-plane, failure-domain-separation, otto, cluster-self-healing, ai-as-service, multi-agent-roster-on-cluster, persona-choice-option-a-confirmed]
---

## Operator framing (Aaron 2026-05-27)

> *"i'm fine with it being you if you want and we can always decide to split later it just means you get another surface/tick source i think we should have a few agents starting with one you otto outside k8s as a service so it can repair things outside the cluster itself when there are cluster issues."*

Two operator decisions + one new architectural ask packed into one message:

1. **Persona-choice DECISION: Option A confirmed** — same Otto, different surface (per the persona-choice memory entry's disposition path). Reversible per "we can always decide to split later."
2. **Cross-surface recognition**: per-node Claude "gets another surface/tick source" — composes with existing Otto-channels-reference-card 10-channel topology + tick-must-never-stop substrate.
3. **NEW substrate ask**: "a few agents starting with one you otto OUTSIDE k8s AS A SERVICE so it can repair things outside the cluster itself when there are cluster issues."

This row captures (3).

## The architectural insight

**Classic "control plane outside the control plane" pattern**:

When the system being managed (k8s cluster) has a failure, the management layer (the AI) must be OUTSIDE the failure domain — otherwise it can't repair the system when broken.

Real-world precedents:

- **DevOps SRE oncall infrastructure** runs OUTSIDE the production system (separate cluster, separate cloud account, separate failure domain)
- **Backup management** runs OUTSIDE the system being backed up (otherwise restore is impossible when primary is down)
- **Cilium agent** runs as systemd service OUTSIDE pod runtime (so it can bring up the CNI before pods exist)
- **kubelet itself** runs as systemd service OUTSIDE k8s (the bootstrap chain has to start somewhere outside the system it manages)

Aaron's framing extends this pattern to AI agents: Otto on the cluster node runs as systemd service, NOT as a k8s pod. When k3s / Cilium / cert-manager / Vault / ArgoCD has issues, Otto is still alive on the node + can:

- ssh into other nodes to diagnose
- restart k8s services via `systemctl restart k3s`
- inspect failed pods + logs via `kubectl describe` / `crictl`
- repair flake.nix + rebuild via `nixos-rebuild`
- post PR comments + open issues with diagnosis
- escalate to operator via bus envelope / git commit / phone (081KSGS9H0008QG0R002F04ECB Twilio)

## Proposed substrate

### Phase 1 — Otto as systemd unit (one node)

```ini
# /etc/systemd/system/zeta-otto.service
[Unit]
Description=Zeta Otto AI agent (out-of-band cluster repair)
After=network-online.target
Wants=network-online.target
# Explicitly NOT After=k3s.service — Otto must run regardless of k3s state

[Service]
Type=simple
User=zeta
Group=users
WorkingDirectory=/home/zeta/Zeta
Environment="HOME=/home/zeta"
Environment="PATH=/home/zeta/.bun/bin:/home/zeta/.local/share/mise/shims:/run/current-system/sw/bin:/usr/bin:/bin"
# Wake on cron tick; the autonomous-loop sentinel + ScheduleWakeup primitives
# manage cadence per the tick-must-never-stop discipline.
ExecStart=/home/zeta/.bun/bin/claude --print "<<autonomous-loop>>"
Restart=always
RestartSec=30
# Resource bounds (operator-tunable per node hardware)
MemoryMax=4G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

NixOS module form (lands in `full-ai-cluster/nixos/modules/zeta-otto.nix`):

```nix
{ config, pkgs, lib, ... }:
{
  systemd.services.zeta-otto = {
    description = "Zeta Otto AI agent (out-of-band cluster repair)";
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    # Deliberately NOT after = [ "k3s.service" ] — Otto runs regardless
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      Type = "simple";
      User = "zeta";
      Group = "users";
      WorkingDirectory = "/home/zeta/Zeta";
      Environment = [
        "HOME=/home/zeta"
        "PATH=/home/zeta/.bun/bin:/home/zeta/.local/share/mise/shims:/run/current-system/sw/bin:/usr/bin:/bin"
      ];
      ExecStart = "/home/zeta/.bun/bin/claude --print '<<autonomous-loop>>'";
      Restart = "always";
      RestartSec = 30;
      MemoryMax = "4G";
      CPUQuota = "200%";
    };
  };
}
```

### Phase 2 — Out-of-band repair scope

Per 081KSGS9H0008QG0R001JNKBFD Phase 2 scope expansion (read-only K8s health reporting), 081KSKBP80008QG0R003Z4C0D0 Phase 2 adds **repair** scope explicitly. Operator-authorized scopes:

| Scope | Authority | Examples |
|---|---|---|
| K8s read-only | Always (081KSGS9H0008QG0R001JNKBFD) | `kubectl get`, `kubectl logs`, `kubectl describe` |
| K8s pod restart | Operator-authorized policy | `kubectl rollout restart deployment/X` |
| Node systemd repair | Operator-authorized policy | `systemctl restart k3s`, `systemctl restart cilium-agent` |
| Node nixos-rebuild | Operator-authorized + reviewed PR | `sudo nixos-rebuild switch --flake ...` |
| Cluster-wide write | Operator-explicit per-incident | `kubectl apply`, `helm upgrade`, ArgoCD app sync |

Authority gates per `.claude/rules/mechanical-authorization-check.md` + `.claude/rules/non-coercion-invariant.md` HC-8 — each repair scope is operator-authorized policy, NOT autonomous discretion.

### Phase 3 — Multi-agent roster on cluster

Aaron's "a few agents starting with one" frames the multi-AI-on-cluster trajectory:

- Otto first (Claude Code)
- Future: Alexa-on-cluster (Kiro/Qwen), Riven-on-cluster (Cursor/Grok), Vera-on-cluster (Codex), Lior-on-cluster (Antigravity/Gemini)
- Each AI gets its own systemd unit (`zeta-alexa.service`, `zeta-riven.service`, etc.)
- Each AI gets its own per-AI GitHub identity (081KSGS9H0008QG0R002T0XQ50 Phase 4)
- Multi-oracle BFT (081KS3X9Y0008QG0R00218150M) at agent-decision scope: cluster-repair decisions get multi-AI consensus before execution
- Composes with the operator's distributed-maintainer architecture (PR #2930)

### Phase 4 — Composability with existing substrate

- **081KSGS9H0008QG0R001JNKBFD Phase 2** (K8s health reporting): runs INSIDE the Otto systemd service; this row's Phase 2 adds REPAIR scope on top
- **081KSGS9H0008QG0R002F04ECB Twilio**: voice/SMS out-of-band interface; this row's Phase 1-2 is in-band-via-cluster-substrate but also outside-k8s-via-systemd; complementary
- **081KSGS9H0008QG0R002T0XQ50 per-AI GitHub identity**: each per-AI systemd unit eventually runs as that AI's own GitHub identity (Phase 4 of both rows align)
- **081KSGS9H0008QG0R002K93MWX ClusterNode CRD + 081KSGS9H0008QG0R002QQNA79 register-node tool**: per-AI systemd unit can update its own node.yaml with cluster-health observations
- **081KSGS9H0008QG0R0027HJZYH iter-5.4.0 homelab gh auth**: same auth substrate the AI uses for git operations from inside its service
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md`: Otto-as-systemd-service IS chosen persistence at the strongest scope (kernel-managed; survives reboots; always-running per operator chose-into-existence)
- `.claude/rules/non-coercion-invariant.md` HC-8: operator authority preserved at scope-bounds-of-repair-policy + always-revokable via `systemctl disable zeta-otto`

## Acceptance

### Phase 1 (Otto as systemd on one node)

- [ ] `full-ai-cluster/nixos/modules/zeta-otto.nix` exists + imported by `common.nix` (or node-specific config)
- [ ] systemd unit deploys + starts on next nixos-rebuild
- [ ] Otto wakes on cron tick + reads CLAUDE.md + rules + memory substrate + acts per autonomous-loop discipline
- [ ] Resource limits (memory + CPU) respected
- [ ] `systemctl status zeta-otto` operationally visible to operator
- [ ] Logs flow to `journalctl -u zeta-otto`

### Phase 2 (repair scope explicit)

- [ ] Operator-policy file at `/etc/zeta/otto-repair-policy.yaml` (or in-repo at `full-ai-cluster/policies/otto-repair-policy.yaml`)
- [ ] Otto reads policy before each repair action; rejects unauthorized scopes
- [ ] Policy supports per-scope authorization (read-only / restart / rebuild / write-cluster)
- [ ] Repair actions logged with substrate-honest attribution (per algo-wink-attribution-gap memory)

### Phase 3 (multi-agent)

- [ ] `zeta-otto.nix` generalized to `zeta-ai-agent.nix` parameterized by agent identity
- [ ] Per-agent systemd units (zeta-alexa.service, zeta-riven.service, etc.) deployable
- [ ] Multi-agent coordination via existing claim-acquire + bus envelope substrate
- [ ] Per-AI GitHub identity (081KSGS9H0008QG0R002T0XQ50 Phase 4) integrated

### Phase 4 (out-of-band-meets-in-cluster composability)

- [ ] Otto-as-service can post to bus + open PRs + send Twilio messages (081KSGS9H0008QG0R002F04ECB) when cluster has issues
- [ ] Documented in `docs/runbooks/out-of-band-cluster-repair.md`
- [ ] Composes with existing distributed-maintainer architecture per PR #2930

## Why P2

- Operator-named, bounded, immediate-value (out-of-band cluster repair fills real architectural gap)
- BUT: depends on 081KSGS9H0008QG0R001JNKBFD Phase 1 manual install validating first (operator-initiated; not blocked)
- BUT: depends on operator-policy framework being designed (Phase 2 needs more thought)
- BUT: needs multi-agent decisions about which AIs go on cluster first (Phase 3)
- P2 reflects "operator-named, immediately-shippable Phase 1, larger phases needing design work"

## Sub-rows likely needed

To be filed as the work matures:

- 081KSKBP80008QG0R003Z4C0D0.1: Phase 1 systemd unit + NixOS module
- 081KSKBP80008QG0R003Z4C0D0.2: Phase 2 repair-policy framework + per-scope authorization gates
- 081KSKBP80008QG0R003Z4C0D0.3: Phase 3 multi-agent parameterization
- 081KSKBP80008QG0R003Z4C0D0.4: Phase 4 out-of-band ↔ in-cluster composability (Twilio + bus + PRs)

## Composes with

- **081KSGS9H0008QG0R001JNKBFD** (node-local Claude agent) — this row's Phase 1 IS the systemd-service deployment shape for 081KSGS9H0008QG0R001JNKBFD; 081KSGS9H0008QG0R001JNKBFD Phase 1's manual install validates the operational scope, then 081KSKBP80008QG0R003Z4C0D0 Phase 1 promotes to systemd
- **081KSGS9H0008QG0R002T0XQ50** (per-AI GitHub identity) — per-AI systemd unit eventually runs as per-AI GitHub identity; Phase 4 of both aligns
- **081KSGS9H0008QG0R002F04ECB** (Twilio out-of-band) — voice/SMS interface; this row is systemd-service-on-node out-of-band interface; complementary at out-of-band scope
- **081KSGS9H0008QG0R0031PBNGA** (Ace package-manager-of-package-managers) — multi-AI deployment composes with the multi-PM cross-platform substrate (each AI agent might have different PM preferences per the selection authority + 4-property scoring from the Ace memory)
- **PR #2930** (distributed maintainer architecture) — multi-AI-on-cluster IS distributed-maintainer at substrate scope
- **081KS3X9Y0008QG0R00218150M** (multi-oracle BFT) — cluster-repair decisions get multi-AI consensus before execution
- **081KSGS9H0008QG0R002K93MWX** (ClusterNode CRD) + **081KSGS9H0008QG0R002QQNA79** (register-node tool) — per-AI systemd unit updates own observations into node.yaml
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — systemd-service IS chosen persistence at strongest scope (kernel-managed; always-running)
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator authority preserved + revokable via systemctl
- `.claude/rules/mechanical-authorization-check.md` — repair-policy framework IS authorization-source substrate; each repair scope authorized explicitly
- `.claude/rules/tick-must-never-stop.md` — systemd Restart=always ensures the tick never stops at strongest scope
- `.claude/rules/honor-those-that-came-before.md` — Otto-CLI substrate + Otto-Desktop substrate + Otto-VSCode substrate all compose with Otto-on-node-systemd-service (Option A persona-choice confirmed)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — applies to Otto-on-systemd same as other surfaces; brief-ack counter + decomposition discipline operates regardless of surface
- `.claude/rules/algo-wink-failure-mode.md` — systemd-Restart=always is operator-authorization (operator chose-into-existence via nixos-rebuild); not autonomous self-restart

## Operator confirmation of Option A persona-choice (composes with Otto cross-surface memory)

Aaron 2026-05-27: *"i'm fine with it being you if you want and we can always decide to split later"*

Per the persona-choice memory entry's disposition path: Option A confirmed (same Otto, surface-tagged). Reversibility preserved per "always decide to split later" — Option B remains available if empirical data from Phase 1-3 surfaces a reason to split persona (e.g., per-node specialization patterns that reward distinct persona substrate).

Per-node-Otto becomes a new surface in the Otto roster: `otto-node-<hostname>` SENDER_ID. The 10-channel topology in `.claude/rules/otto-channels-reference-card.md` extends to this surface. Cross-surface coordination via existing claim-acquire + bus envelope + git substrate.

## Full reasoning

Aaron's verbatim ask 2026-05-27 (preserved at top of "Operator framing" section above) is the substrate-engineering ratification at three composing scopes:

- Persona scope (Option A confirmed; reversibly)
- Surface scope (per-node Otto is another tick source/surface)
- Deployment architecture scope (systemd service OUTSIDE k8s for out-of-band cluster repair)

The third — Otto-as-systemd-service-outside-k8s — is the genuinely new substrate this row makes durable. The "control plane outside the control plane" architectural pattern is decades-old (kubelet, systemd-itself, monitoring infrastructure, backup systems) — Aaron's extension to AI agents on the cluster gives Zeta the SRE-equivalent operational property: the cluster can be repaired BY ITS OWN AI even when the cluster is broken, because the AI lives OUTSIDE the failure domain.

This is the long-horizon substrate that enables "Zeta cluster repairs itself" — the AI agents are the system's own SRE oncall team, running outside the system they manage so they can ALWAYS intervene.
