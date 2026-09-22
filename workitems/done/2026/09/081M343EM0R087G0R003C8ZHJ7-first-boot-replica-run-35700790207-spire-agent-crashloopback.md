---
id: 081M343EM0R087G0R003C8ZHJ7
type: bug
state: done
priority: P2
slug: first-boot-replica-run-35700790207-spire-agent-crashloopback
title: "first-boot replica run 35700790207: spire-agent CrashLoopBackOff on ArgoCD-managed spire (not the bootstrap install hook)"
created: 2026-09-22T08:24:23.320Z
completed: 2026-09-22T08:59:36.118Z
depends_on: ["081M340NKP9087G0R000F8YHXQ"]
composes_with: []
---

# first-boot replica run 35700790207: spire-agent CrashLoopBackOff on ArgoCD-managed spire (not the bootstrap install hook)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M343EM0R087G0R003C8ZHJ7-*.md` glob. -->

## Evidence

Run 35700790207 (`first-boot-replica.yml --serve-tree dev`, WP1b, PR #17495):

- Stage 6 verdict: `` `spire` | Synced | Progressing | FAIL | spire-agent-mcbl9:CRASHLOOP(CrashLoopBackOff) ``
- Stage 6 soak (300s, sampled every ~10s): `` restartCount regression on spire/spire-agent-mcbl9[spire-agent] `` —
  the container restarted AGAIN during the soak window, so this is an ongoing crash
  loop, not a one-time blip caught mid-restart.

## Why this is a DIFFERENT defect than PR #17478

PR #17478 ("pin KubeVersion-derived SPIRE kubectl image") fixes the `spire` chart's
`kubectl` HOOK image (the post-install Job the k3s bootstrap `HelmChart` CR runs).
This run's stage 3 already shows `spire=OK(2 retries)` — the bootstrap
`helm-install-spire` Job succeeded, so the hook-image defect #17478 targets is not
what is happening here (if it were, `helm-install-spire` would `ErrImagePull`-loop
forever and never succeed). The CrashLoopBackOff observed here is on
`spire-agent-mcbl9`, a pod belonging to the SEPARATE, dual-owned ArgoCD `spire`
Application (`full-ai-cluster/k8s/applications/spire/`) — the spire-agent runtime
DaemonSet, not the install hook.

Root cause not yet investigated (would need `kubectl logs --previous
spire-agent-mcbl9 -c spire-agent`, which this harness's own
`collectFailureDiagnostics` only captures on an unhandled exception, not on a
structured stage-6 FAIL — a possible small follow-up to
`first-boot-replica.ts`: dump crash-loop container logs into stage 6's evidence the
same way `argocd-health-test.ts`'s `collectCrashLoopLogs` already does for its own
lane). Plausible candidates, unconfirmed: a single-node/single-agent SPIRE trust
bundle or workload-API socket assumption that does not hold on this replica's
container-in-Docker topology, or a dependency on the dev longhorn alias / another
Secret this replica does not mint (see 081M343EEP8087G0R000BAF6QF, the sibling
finding on this same run).

## RESOLVED 2026-09-22 (WP12, 081M3447Q7E087G0R001PJ6YNY follow-on)

Root cause found: `could not open attestation stream to SPIRE server: ... dial
udp <clusterIP>:53: i/o timeout`. A control probe (hostNetwork +
`dnsPolicy: ClusterFirstWithHostNet` busybox, spire-agent's exact policy)
could not reach kube-dns's ClusterIP AT ALL from inside the Docker replica
container, while an otherwise-identical pod-network probe reached the same
server fine. Cilium's ClusterIP socket-LB is not covering hostNetwork sockets
when k3s runs nested inside a Docker container.

**Classification: REPLICA ARTIFACT, not a metal defect — CONFIRMED, not
inferred.** Rather than reason from Docker-only evidence, two subtests were
added directly to `full-ai-cluster/nixos/tests/k3s-first-boot-roster.nix` (the
real-NixOS-VM oracle, no container nesting between spire-agent's host network
namespace and Cilium's socket-LB attachment point) and run on an actual VM:

- hostNetwork+`ClusterFirstWithHostNet` resolves
  `kubernetes.default.svc.cluster.local` via the ClusterIP DNS server: **PASS**
  (run 35706939767; the first attempt, run 35706223651, false-negatived on a
  search-domain-expansion quirk with the short name `kubernetes.default` —
  fixed to the FQDN, which is the honest form of the same test).
- `spire-agent` stays Ready with a stable restart count for a 180s window:
  **PASS** — `restartCount samples over ~180s: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 3, 3]` (3 restarts during ordinary startup churn while cluster networking
  settled, then completely flat — no ongoing crash loop).

Recorded as a named DIVERGENCE in `first-boot-replica.ts`
(`spire-agent-hostnetwork-dns-in-nested-container`) so the harness reports a
spire crash loop on this replica as expected rather than as an unexplained
FAIL. No metal-side fix needed for this item.
