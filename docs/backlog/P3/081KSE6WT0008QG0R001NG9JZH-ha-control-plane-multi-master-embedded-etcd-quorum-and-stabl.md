---
id: 081KSE6WT0008QG0R001NG9JZH
title: HA control-plane — multi-master k3s embedded etcd quorum + stable API endpoint (DNS round-robin or kube-vip virtual IP)
status: open
priority: P3
size: L
created: 2026-05-25
authors: [aaron, otto-cli]
composes_with: [081KSGS9H0008QG0R002T3BJ2R, 081KSE6WT0008QG0R003612WGJ]
depends_on: []
labels: [cluster, k3s, etcd, ha, networking]
---

## Problem

Current `modules/k3s-server.nix` configures a single-node
control-plane (default k3s backend = embedded SQLite). Aaron
2026-05-25: *"that sounds good also if we support mutiple control
plane nodes when i have two or more how is etcd involved?"*.

Single-node control-plane = single point of failure for cluster
API + scheduler + controller-manager. Plus the API endpoint
`control-plane.zeta.local:6443` is currently a single IP — no
failover even if multiple control-planes existed.

## Target

Cluster operator can run 1, 3, 5, or 7 control-plane nodes (odd
counts only — raft quorum requires odd numbers to avoid split-
brain on partition; explicitly refuse even counts at config-time).
Single-control-plane stays as the easy default for lab use; HA
opt-in via a new module surface.

## Acceptance

- [ ] `modules/k3s-server.nix` accepts a new option
      `zeta.cluster.controlPlane.mode` with values:
      `single` (default; embedded SQLite, current behavior)
      `ha-init` (first control-plane node; `--cluster-init`,
        embedded etcd)
      `ha-join` (additional control-plane nodes; joins via
        `--server https://<bootstrap-cp>:6443`)
- [ ] Documented even-count refusal: config-time error if HA
      mode is requested but the cluster would end up with 2, 4,
      6 control-planes; force operator to choose odd
- [ ] `--cluster-init` token shared via sops/age secret (k3s
      auto-generates; secret material rotated by operator)
- [ ] Stable API endpoint via one of:
      a. **DNS round-robin** — `control-plane.zeta.local` A
         records for all control-plane IPs (cheap; client-side
         retry handles dead nodes)
      b. **kube-vip / keepalived virtual IP** — single VIP
         floats across control-planes; requires NixOS module +
         config for kube-vip or keepalived (declarative)
      c. **External load balancer** — out of scope (assumes
         existing HAProxy / nginx / cloud LB; document the
         k3s --tls-san flag needed for cert SAN)
- [ ] PROVISIONING.md updated with HA section
- [ ] 081KSGS9H0008QG0R002T3BJ2R v1 first-boot role keystroke prompt extended to
      include 'h' for `ha-init` (first node) and 'j' for
      `ha-join` (additional nodes) when the operator opts in
- [ ] zflash `--ha-bootstrap-ip <ip>` flag for join nodes
      (need to know which existing control-plane to join)

## Notes on k3s embedded etcd

- Each control-plane node runs its own etcd member; raft
  quorum keeps consensus
- Etcd data lives at `/var/lib/rancher/k3s/server/db/etcd/` —
  Longhorn replication on this path is NOT recommended (etcd
  has its own replication; double-replicating is worse)
- Snapshot strategy: k3s built-in `--etcd-snapshot-schedule-cron`
  + retention; ship to S3 / local NFS / wherever the cluster
  has off-cluster storage
- Joining: `k3s server --server https://<existing-cp>:6443
  --token <node-token>` — token is at
  `/var/lib/rancher/k3s/server/node-token` on the bootstrap node
- Removing a control-plane: must use `k3s etcd-snapshot` +
  `k3s server --cluster-reset` if quorum is lost; standard
  removal is `kubectl drain` + `kubectl delete node` + take
  out of etcd cluster

## Notes on stable API endpoint

- **DNS round-robin**: simplest, no extra components. NixOS
  systemd-resolved or external DNS server serves the A records.
  Cluster clients (kubectl, k3s agent, services) must handle
  retry on connect failure — most do
- **kube-vip**: NixOS package exists; runs as DaemonSet or
  systemd unit; ARP/BGP modes; well-trodden in k3s/k0s land
- **keepalived**: NixOS module exists; VRRP; simpler than
  kube-vip but k3s-specific tutorials usually pick kube-vip

For Aaron's home lab, recommend DNS round-robin v1 (simpler;
existing DNS infra), kube-vip v2 if needed.

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R — zero-typing USB install (the keystroke prompt this
  extends; ha-init and ha-join modes)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy expansion (HA control-plane is
  another role variant)
- `modules/k3s-server.nix` — primary module surface
- `modules/k3s-agent.nix` — agents need to know the stable API
  endpoint for `--server` flag

## Out of scope

- External etcd (separate dedicated etcd nodes) — possible
  but not the default path; document if asked
- External DB backends (postgres, mysql) — k3s supports but
  not the path for HA we want
- Multi-region / federated clusters — different problem

## Origin

Aaron 2026-05-25, surveying the HA architecture during the
081KSGS9H0008QG0R002T3BJ2R v1 ship.
