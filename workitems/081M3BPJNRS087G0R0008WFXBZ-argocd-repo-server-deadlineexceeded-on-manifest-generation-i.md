---
id: 081M3BPJNRS087G0R0008WFXBZ
type: bug
state: backlog
priority: P2
slug: argocd-repo-server-deadlineexceeded-on-manifest-generation-i
title: "ArgoCD repo-server DeadlineExceeded on manifest generation is what stops the roster converging on an installed disk"
created: 2026-09-25T07:13:20.153Z
depends_on: []
composes_with: []
---

# ArgoCD repo-server DeadlineExceeded on manifest generation is what stops the roster converging on an installed disk

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BPJNRS087G0R0008WFXBZ-*.md` glob. -->

## The sharpest datum: convergence went BACKWARDS, then stalled

This is not slowness, and that distinction is the whole item. Dispatch
**36097310492**, WP11 verdict 7's first live run on a real installed disk:

| t (unit clock) | Synced + Healthy |
|---|---|
| 153s | roster empty, `zeta-root sync=Unknown` |
| **1214s** | **25 / 35 — the PEAK** |
| 3007s | 13 / 35 |
| 3579s | 13 / 35 |
| 3652s | 13 / 35 |
| 3730s | 13 / 35 |

**Twelve Applications that WERE Synced+Healthy stopped being so**, and the
count was then FLAT across the last four samples spanning **723 seconds**.

That rules out the comfortable hypothesis. *"It just needs longer"* predicts a
monotonically rising count; what was measured is a rise, a fall, and a stall.
**More wall clock demonstrably does not help** — which is also why WP11's bound
was reduced rather than raised (081M3BP768B087G0R0010C6GPR), and why raising it
again would be the wrong response to this item.

## What is failing, in ArgoCD's own words

Verdicts 1-6 all PASSED at t=152s — `k3sServiceActive` 16s, `nodeReady` 58s,
`helmJobs` 136s (all seven bootstrap charts), `rootLanded` 136s, `noBadPods`
152s over 38 pods. **The cluster came up.** Of the 100 `unconverged` rows
printed on serial:

| count | message |
|---|---|
| 73 | (none — `Progressing` / `OutOfSync`, no message) |
| **19** | `Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = DeadlineExceeded desc = context deadline exceeded` |
| 7 | `Failed to load live state: failed to get cluster info for "https://kubernetes.default.svc": error synchronizing cache state : failed to get server version` |
| 1 | `Resource discovery.k8s.io/EndpointSlice cilium-ingress is excluded in the settings` |

The 19 read **`sync=Unknown`** — ArgoCD never completed a comparison at all.
That is a **ComparisonError**, not an unhealthy application: the **repo-server**
could not render the source inside its timeout. Affected: `cloudnativepg`,
`external-secrets`, `hat-system`, `headscale`, `kube-prometheus-stack`,
`mimir`, among others.

The 7 say the **API server itself** was intermittently unreachable —
corroborated independently by verdict 7's own collection, which could not list
Applications at all on **17 of 59 samples**.

**`zeta-root` itself read `sync=Unknown`** for most of the run, which is why
only **35** Applications were ever created (the tree declares 49; the Docker
replica sees 42).

One story: **the ArgoCD control plane is starved.**

## The substrate, MEASURED — and it is a hard ceiling

| | WP11 guest | registered ClusterNodes | ratio |
|---|---|---|---|
| vCPU / cores | **4** (`K3S_VERIFY_CPU_COUNT`) | 16, 16, 22, 22 | **18–25 %** |
| memory | **12 GiB** (`K3S_VERIFY_MEMORY_MB = 12288`) | 66 G × 4 | **~18 %** |

Sources: `src/Core.TypeScript/ci/qemu-full-install-test.ts` lines 216-217;
`maintainers/*/cluster-nodes/*/node.yaml` (4 registrations — two Ultra 9 285H
at 16 cores, two Ultra 9 185H at 22 cores, all 66 G).

**The guest cannot be given more.** The GitHub-hosted `ubuntu-24.04` runner is
itself 4 vCPU / 16 GiB, so the guest already takes *all four* vCPUs and 12 of
the host's 16 GiB. That is a ceiling on what this lane can ever measure, not a
setting anyone forgot to raise.

And on those 4 vCPUs, simultaneously: k3s server + kubelet, containerd pulling
against a **134-entry** image roster
(`full-ai-cluster/k8s/image-resolvability.json`), and ArgoCD's controller +
repo-server rendering 49 Applications.

## Leading hypothesis for the REGRESSION — with a named falsifier

Register: **hypothesis, not a finding.** Nothing here has been measured against
it yet.

`argocd-cm`'s `timeout.reconciliation` defaults to **180s**. Every Application
is therefore re-rendered by the repo-server every three minutes, *forever*,
whether or not it already converged. With `repoServer.replicas: 1` (see
`full-ai-cluster/k8s/bootstrap/argocd-install.yaml`), no resource requests set,
and a fraction of one contended vCPU, a 49-app sweep plausibly cannot finish
inside one 180s period — so each sweep arrives while the previous is still
running, renders time out, and Applications that had been `Synced` flip to
`Unknown`.

That predicts exactly the measured shape: a rise while the first sweep
succeeds, then a fall as sweeps overlap, then a stall at whatever fraction the
repo-server can sustain.

**Falsifier:** raise `timeout.reconciliation` well above one full sweep
(e.g. 900s) with everything else unchanged. If the hypothesis holds, the peak
should be *retained* rather than regressing. If the count still falls back to
~13/35, the mechanism is something else and this paragraph is wrong.

## Candidate directions (product fix, not a test fix)

An operator installing this on a modest box gets **exactly what was measured**:
a root Application that never completes a comparison and a roster stalled at a
third. That is squarely the "the applications do not start" failure the
maintainer asked about.

All of these live in `full-ai-cluster/k8s/bootstrap/argocd-install.yaml` and
its mirrored `full-ai-cluster/k8s/applications/argocd/Application.yaml`, which
`audit-argocd-pin-parity.ts` requires to stay in lockstep:

1. **`timeout.reconciliation`** — the falsifier above. Cheapest to try, and it
   is the one the measured shape points at.
2. **Repo-server render timeout** — `ARGOCD_EXEC_TIMEOUT` (default 90s) and
   `--repo-server-timeout-seconds` (default 60s). These address the
   `DeadlineExceeded` text directly, but note they do **not** explain the
   regression on their own: a too-short timeout gives a low plateau, not a
   fall from a higher one.
3. **Resource requests for `argocd-repo-server` and the controller** — none are
   set today. On a contended 4-vCPU node, requests are what stop kubelet and
   containerd image pulls from starving them.
4. **Controller processors** — `--status-processors` / `--operation-processors`
   (defaults 20 / 10) are sized for a much larger node; lowering them reduces
   the concurrent render load rather than increasing it.

**Derive the numbers from a re-measurement, not from these defaults.** The
honest input is one sweep's wall-clock cost on this guest, which nothing has
measured yet.

**Do NOT respond to this item by relaxing WP11 verdict 7's bound.** More wall
clock was measured not to help (see the table above).

## Cross-lane agreement worth keeping

`cilium`'s `ExcludedResourceWarning: Resource discovery.k8s.io/EndpointSlice
cilium-ingress is excluded in the settings` appeared **here, on real metal**,
independently of the Docker replica that first measured it. Two lanes on
different substrates, two independent derivations, the same defect named —
that is the corroboration the replica's fidelity has been short of. WP26 owns
that fix.

## Origin

081M3BEGSQR087G0R003610CGB (WP31), dispatch 36097310492 — the first live run of
WP11 verdict 7. The check's own three defects on that run are
081M3BP768B087G0R0010C6GPR; this item is the CLUSTER's finding.
