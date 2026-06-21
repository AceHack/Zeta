---
id: 081KSGS9H0008QG0R000JVGZKG
priority: P2
status: open
title: Cluster-node registration heartbeat / expiration pattern — keep git registration physically in sync with machine; re-register on cadence or expire stale entries (081KSGS9H0008QG0R000JVGZKG design row)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R0037H3W4T
  - 081KSGS9H0008QG0R002K93MWX
composes_with:
  - 081KSGS9H0008QG0R000EPPQTR
  - 081KSGS9H0008QG0R00153CQ8B
tags: [cluster-node, registration, heartbeat, expiration, gitops, physical-sync, stale-state-cleanup, iter-5-4-design]
---

## Problem

iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T) registers a machine via a one-shot commit at install time. iter-5.4.2 (081KSGS9H0008QG0R002K93MWX) reconciles the cluster on that commit's PR-merge. **But there's no mechanism to detect when the registered state has drifted from physical reality.**

Drift scenarios:

- Machine physically removed (operator decommissioned, sold, returned) but git entry stays → ArgoCD thinks node exists; pods get scheduled to nowhere
- Machine reformatted / re-installed without proper deregister → old git entry stale; new install would conflict
- Machine offline for an extended period → indeterminate (operationally dead? offline temporarily? maintenance window?)
- Hardware changed (GPU swap, disk replace) but `node.yaml`'s `hardware:` block still shows old → reconciler routes workloads to wrong specs

The maintainer 2026-05-26: *"the next step will be how do keep registration status physically in sync with machine, like maybe you have to reregister once a day or week or something or it expires"*.

## Target

Design + implement a heartbeat/expiration pattern that keeps `maintainers/<op>/cluster-nodes/<host>/node.yaml` in sync with physical reality.

## Design options (substrate-honest tradeoffs)

### Option A — TTL-based expiration (operator's first sketch)

Each `node.yaml` includes a `registration.expires_at` field. A scheduled GitHub Action (or ArgoCD CronJob) scans the tree daily; entries past their `expires_at` get flagged + (after grace period) auto-deregistered via the tool from 081KSGS9H0008QG0R000EPPQTR.

- **Pros**: simple; no node-side daemon required; entire policy is git-substrate-visible
- **Cons**: nodes that go offline for legit reasons (maintenance, vacation, weekend power-off) need manual re-register; TTL choice (daily / weekly / 30-day) is policy guesswork

### Option B — Node-side heartbeat daemon

Each node runs a systemd timer (`zeta-heartbeat.service`) that commits + pushes a `registration.last_heartbeat: <timestamp>` field update to its own `node.yaml` on cadence (e.g., every 6h). A separate scanner (Action or ArgoCD job) flags entries with `last_heartbeat` older than 24h.

- **Pros**: actual physical-presence signal; tunable cadence; can detect partial-network-isolation (heartbeat fails but node up = different state from node fully off)
- **Cons**: every node generates git churn (one commit per heartbeat × N nodes × 4/day = significant noise); commits-as-heartbeats pollutes git history; needs deduplication

### Option C — Hybrid: TTL + on-demand refresh

`node.yaml` has `registration.expires_at` set at registration time (default: 30d). A node-side daemon checks "am I within 7 days of my expiry?" on cadence; if so, opens a refresh-PR that bumps `expires_at` forward. No-op when not near expiry → no git churn. Past-expiry entries auto-flagged for deregister.

- **Pros**: combines TTL simplicity with on-demand signal; minimal git churn; explicit "I'm still here" signal from node-side
- **Cons**: needs the node-side daemon (more substrate); refresh-PRs need auto-merge or operator review (UX decision)

### Option D — Use Kubernetes node-status as the truth

ArgoCD-reconciled K8s node status (NodeReady, NotReady, Unknown) IS already a heartbeat (kubelet → API server). Add a controller that watches K8s nodes; when a node is `NotReady` for >24h, auto-open a deregister-PR.

- **Pros**: zero new daemon; leverages existing kubelet heartbeat; no git churn except deregister-PRs
- **Cons**: requires K8s node ↔ ClusterNode CR association; needs the controller as part of iter-5.4.2 reconciler + can't detect "machine physically gone, K8s just doesn't know"

### Operator's pick required

Per the maintainer 2026-05-26 framing ("maybe you have to reregister once a day or week or something or it expires") — Option A or Option C is closer to the stated intent. Option D is the most cluster-native but requires more substrate to ship first. Recommendation: **Option C** (TTL + on-demand refresh) for the homelab default; **Option D** as upgrade-path once iter-5.4.2 reconciler is mature.

## Sub-targets (when implementation begins)

### Sub-target 1 — Schema extension for node.yaml

Add `registration.expires_at` (ISO 8601 timestamp; 30d-default at registration time). Either Option A or Option C uses this field.

### Sub-target 2 — Scanner (GitHub Action OR ArgoCD CronJob)

Daily scan of `maintainers/*/cluster-nodes/**/node.yaml` for past-expiry entries. Opens deregister-PR via 081KSGS9H0008QG0R000EPPQTR tool for each (with `--reason "expired registration; last_heartbeat <timestamp> exceeded TTL"`).

### Sub-target 3 — Node-side refresh daemon (Option C only)

`zeta-heartbeat.service` systemd timer (weekly default; tunable per node). Checks own `expires_at` field; if within 7d of expiry, opens refresh-PR bumping `expires_at` forward by another 30d.

### Sub-target 4 — Grace period policy

Past-expiry entries get a 3-day grace (operator can manually refresh or rollback) before scanner auto-deregisters. Configurable per maintainer via `maintainers/<op>/cluster-policy.yaml`.

### Sub-target 5 — Documentation

`docs/cluster/registration-lifecycle.md` documents the full registration → heartbeat → expiration → deregister lifecycle. Operator-facing.

## Acceptance

- [ ] Maintainer's pick from Options A/B/C/D documented + locked in
- [ ] Schema extension to `node.yaml` (`registration.expires_at`)
- [ ] Scanner implementation per picked option
- [ ] (Option C only) Node-side daemon
- [ ] Grace-period policy implemented + tunable
- [ ] Documentation
- [ ] End-to-end empirical: register a test node, wait past expiry, scanner opens deregister-PR

## Out of scope

- Cross-maintainer policy (single-maintainer per cluster default; 081KSGS9H0008QG0R0027HJZYH sub-target 6 future)
- Predictive failure detection (separate concern; consumed by operator UX dashboard not by registration lifecycle)
- Network-partition detection (compose with 081KSE6WT0008QG0R003C9KGQE Reticulum cluster substrate; out of this row's scope)

## Composes with

- **[081KSGS9H0008QG0R0027HJZYH](../P1/081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — parent cluster-bring-up substrate
- **[081KSGS9H0008QG0R0037H3W4T](../P1/081KSGS9H0008QG0R0037H3W4T-iter-5-4-1-self-registration-commit-push-to-maintainers-cluster-nodes-builds-on-iter-5-4-0-gh-auth-foothold-aaron-2026-05-26.md)** — registration flow that creates the `expires_at` field
- **[081KSGS9H0008QG0R002K93MWX](../P1/081KSGS9H0008QG0R002K93MWX-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — reconciler that consumes the deregister-PR's effect
- **[081KSGS9H0008QG0R000EPPQTR](../P1/081KSGS9H0008QG0R000EPPQTR-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md)** — deregister tool used by the scanner
- **[081KSGS9H0008QG0R00153CQ8B](../P1/081KSGS9H0008QG0R00153CQ8B-zero-dev-machines-cluster-native-architecture-all-prs-from-cluster-voice-as-primary-operator-surface-aaron-2026-05-26.md)** — zero-dev-machine end-state benefits from automatic stale-node cleanup

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rlF "heartbeat"` → existing references (081KSE6WT0008QG0R003C9KGQE Reticulum, 081KS3X9Y0008QG0R00218150M multi-oracle BFT) are at different scopes; no overlap
- `grep -rlF "expires_at"` → no existing usage; safe
- `grep -rlF "physical-sync"` → no existing usage; safe
- ID 081KSGS9H0008QG0R000JVGZKG next-free per `git ls-tree origin/main` (081KSGS9H0008QG0R000EPPQTR in same PR; 081KSGS9H0008QG0R002K93MWX in PR #5212)

## Origin

The maintainer 2026-05-26 in the iter-5.4 substrate-engineering session, immediately after requesting the deregister tool (081KSGS9H0008QG0R000EPPQTR):

> *"Or the next step will be how do keep registration status physically in sync with machine, like maybe you have to reregister once a day or week or something or it expires"*

Filed as P2 (not P1) because deregister tool (081KSGS9H0008QG0R000EPPQTR) covers the manual deletion case the maintainer named first; the automatic heartbeat/expiration is the second-order extension. Once iter-5.4.1 + 5.4.2 + 081KSGS9H0008QG0R000EPPQTR land + validate, 081KSGS9H0008QG0R000JVGZKG becomes the natural follow-on.
