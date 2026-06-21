---
id: 081KSGS9H0008QG0R00280HHA7
priority: P2
status: open
title: iter-6.3 — deploy-rs from CI (GitOps push-shape) — alt to system.autoUpgrade (081KSGS9H0008QG0R002T6J6FS); CI bumps flake.lock + runs `deploy .#<host>` per node with auto-rollback on health-check failure; better for private repos / faster-cadence ops; pick autoUpgrade XOR deploy-rs (not both)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001EKTS5A
composes_with:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R003GM7TYN
  - 081KSGS9H0008QG0R0034ZYYR8
  - 081KSGS9H0008QG0R002BC2ZR7
tags: [iter-6, deploy-rs, gitops, ci-driven, auto-rollback, nixos, cluster-self-update, no-manual-operator, full-ai-cluster, alternative-shape]
---

## Problem

[081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) `system.autoUpgrade` is the pull-from-cluster shape: each node fetches its own flake + rebuilds locally. Tradeoffs:

| Concern | autoUpgrade (081KSGS9H0008QG0R002T6J6FS) | deploy-rs (this row) |
|---|---|---|
| Auth | Public repo needed (or per-node SSH key) | CI auth only; cluster nodes need no upstream auth |
| Rollback on health-check failure | NixOS auto-rollback if rebuild fails; NOT auto-rollback if rebuild succeeds but workload health fails | deploy-rs probes a configurable health-check post-switch; rolls back if check fails |
| Per-node ordering | Random / jittered timer; multi-node simultaneously possible (kured serializes reboots but not rebuilds) | CI controls order; explicit canary-then-fleet |
| Operator visibility | journalctl per node | CI logs centralized |
| Cadence | Scheduled (weekly default) | Triggered (every CI run = potential deploy) |
| Private-repo support | Hard (cluster needs auth) | Easy (CI has the auth) |

deploy-rs is the right choice IF:

- Repo becomes private (which is on the roadmap per the homelab-first decision)
- Want auto-rollback on workload-health failure (not just rebuild-failure)
- Want centralized control over per-node ordering (canary → fleet rollout)

## Decision: which one?

**Pick one. Don't deploy both.** They both run `nixos-rebuild switch`; running both creates race conditions.

Recommendation (defer to maintainer): start with 081KSGS9H0008QG0R002T6J6FS autoUpgrade (simpler; existing public-repo state covers auth). When repo goes private OR when we want CI-controlled rollouts, switch to deploy-rs.

This row exists so the substrate-engineering option is captured even if we pick autoUpgrade first.

## Target

If chosen over autoUpgrade:

### Sub-target 1 — Add deploy-rs flake input

`full-ai-cluster/flake.nix`:

```nix
inputs = {
  # ... existing inputs ...
  deploy-rs = {
    url = "github:serokell/deploy-rs";
    inputs.nixpkgs.follows = "nixpkgs";
  };
};

outputs = { ..., deploy-rs, ... }@inputs: {
  # ... existing outputs ...
  deploy.nodes = {
    pc1 = {
      hostname = "pc1.local";  # or static IP
      profiles.system = {
        user = "root";
        path = deploy-rs.lib.x86_64-linux.activate.nixos self.nixosConfigurations.pc1;
      };
    };
    # ... per-node entries ...
  };
  checks = builtins.mapAttrs (system: deployLib: deployLib.deployChecks self.deploy) deploy-rs.lib;
};
```

### Sub-target 2 — CI workflow `deploy-rs-rollout.yml`

Triggers on push to main of `full-ai-cluster/flake.lock`. Per node:

1. `nix flake check --no-build`
2. `nix run github:serokell/deploy-rs -- .#pc1 --skip-checks --auto-rollback --magic-rollback`
3. Health-check probe (configurable per host)
4. If healthy, mark node as deployed; proceed to next per-node
5. If unhealthy, deploy-rs auto-rolls back via the "magic rollback" SSH heartbeat

Canary-then-fleet pattern: PC1 first, wait 24h, then rest of cluster.

### Sub-target 3 — Health-check shape

Per-host activation health-check. Default: SSH heartbeat (deploy-rs's magic rollback). Optional: HTTP probe of a known endpoint, k8s node `Ready` status check, ArgoCD app sync status.

### Sub-target 4 — SSH access from CI

CI runner needs SSH access to cluster nodes. Two options:

- WireGuard tunnel from runner into cluster network
- Self-hosted runner inside the cluster network (preferred for private/airgapped clusters)

Self-hosted runner composes with 081KSGS9H0008QG0R0027HJZYH homelab gh-auth substrate.

## Acceptance

- [ ] `full-ai-cluster/flake.nix` adds `deploy-rs` input + `deploy.nodes` output
- [ ] `.github/workflows/deploy-rs-rollout.yml` exists + triggers on flake.lock changes
- [ ] CI SSH-to-cluster path established (self-hosted runner OR tunnel)
- [ ] PC1 canary deploy succeeds end-to-end including health-check
- [ ] Documented in PROVISIONING.md as the chosen update-shape (assuming autoUpgrade is disabled when this lands)
- [ ] 081KSGS9H0008QG0R002T6J6FS autoUpgrade disabled if this row is the chosen shape (mutually exclusive)

## Out of scope

- Multi-cluster / multi-region rollouts
- Blue-green node-pool patterns
- Distro-upgrade orchestration (081KSGS9H0008QG0R0034ZYYR8)

## Composes with

- [081KSGS9H0008QG0R001EKTS5A](../P1/081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — must land first
- [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — alt-shape; pick ONE of (autoUpgrade, deploy-rs)
- [081KSGS9H0008QG0R003GM7TYN](081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md) — kured handles reboots either way (deploy-rs handles rebuild orchestration; kured handles reboot orchestration)
- [081KSGS9H0008QG0R0034ZYYR8](081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md) — distro-upgrade runbook uses deploy-rs's canary-then-fleet shape naturally
- [081KSGS9H0008QG0R0027HJZYH](../P1/081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md) — self-hosted-runner-inside-homelab substrate (node-self-registers-in-git GitOps shape)

## Sources

- [deploy-rs (serokell/deploy-rs)](https://github.com/serokell/deploy-rs) — official repo + docs
