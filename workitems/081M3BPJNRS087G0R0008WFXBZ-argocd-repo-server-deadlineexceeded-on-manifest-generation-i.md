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

---

# RUN 2 RETRACTS THE BASELINE THIS ITEM WAS BUILT ON

Run **36114004943**, WP11-scoped, on **the same commit** as the run above
(`7b806b60cd`) and with **no capacity fix applied**. It looks nothing like run
1, and the difference is not in the direction anyone predicted.

| | run 1 (36097310492) | run 2 (36114004943) |
|---|---|---|
| `sync=Unknown` + `DeadlineExceeded` rows | **19** | **0** |
| dominant unconverged state | `OutOfSync`/`Unknown` + `Healthy` | **`sync=Synced health=Progressing` — 60** |
| Applications seen | 35 | **43** |
| best Synced+Healthy | 25/35, then regressed to 13 | **16/43**, then 12 |
| `zeta-root` sync | `Unknown` (never compared) | **`OutOfSync` (compared, has drift)** |
| pods at last good sample | **not sampled** | **100 Running / 148 total** |
| probe failures | 17 of 59 | 9 of 39 |
| eviction/OOM/MemoryPressure lines | 0 | 0 |

**THE REPO-SERVER STARVATION SYMPTOM DID NOT REPRODUCE.** Three consequences,
none of them comfortable:

## 1. Run 1 is not a reliable baseline

Anything measured as "before the capacity fix" using run 1's 19
`DeadlineExceeded` rows is comparing against a sample that **does not
reproduce on its own commit**. A before/after pair built on it cannot support
the weight a controlled comparison normally carries.

## 2. The BestEffort measurement stands; the CAUSAL LINK to run 1's symptom is weaker

WP32 measured, **by rendering the manifests**, that nine ArgoCD containers
carry no `resources.requests` and the control plane therefore sits at
`cpu.weight` 1 against a roster total of 507. **That is true independent of any
run**, and a BestEffort control plane is wrong regardless of whether it was the
proximate cause on any particular day — so the fix remains correct and should
land.

What is weaker is the claim that **it is what produced run 1's
`DeadlineExceeded`.** A symptom that vanishes on re-run, on the same commit,
with no fix applied, is **load- or timing-dependent**. The capacity PR should
not be read as having fixed a thing we have since watched not reproduce.

Recorded in the same register WP32 used when it retracted its own eviction
inference: the measurement is kept, the causal claim is downgraded.

## 3. The dominant run-2 state is the more important finding anyway

**`sync=Synced health=Progressing`, 60 occurrences**, with **148 pods** on a
**4-vCPU / 12 GiB** node and a best-ever **16 of 43** Synced+Healthy.

**The roster SYNCED.** ArgoCD rendered, compared and applied. The workloads
simply did not become Healthy inside the bound.

> That is **not a control-plane defect and not an application defect**. It is a
> box that is too small for the roster.

Which is exactly what `zeta-first-boot-k3s-verify.nix`'s header now claims
verdict 7 measures — *"the roster converges on a 4-vCPU / 12 GiB node"*, against
registered ClusterNodes of 16-22 cores and 66 G — and nothing else in this repo
says out loud.

## The eviction pathway is now REFUTED, not merely unobserved

Run 2 carried the per-sample pod counts (081M3BSXAD6087G0R001XQ0WNY):

```
t=1104   apps 16/43   pods  90/152
t=1334   apps 12/43   pods  96/148
```

**Applications fell while running pods went UP.** Eviction predicts the pod
count falling *with* the Application count; it did the opposite. Combined with
zero `evicted|OOMKilled|MemoryPressure` lines across **both** runs, this is the
difference between *"we found no evictions"* and *"we watched pods hold while
Applications fell"* — and only the second is a finding.

## What would settle it

A **single** before/after pair cannot, now that the symptom is known to be
intermittent. What would: run the same commit N times and report the RATE at
which `DeadlineExceeded` appears, before and after. Two samples give 1/2
pre-fix; that is a rate estimate with no power.

---

# RUN 3, POST-#17666: THE EXCLUSION PATH FINALLY RAN, AND API REACHABILITY IS THE SIGNAL

Run **36117868219**, `verify/post-capacity-fix` at `7bd6978871`, carrying
#17666 (requests on the nine previously-BestEffort ArgoCD containers, plus
`kube-reserved` / `system-reserved` / `eviction-hard` on the k3s server).

```
verdict 7/7 rosterConverged=false after 3174s (90 samples, bound reached):
  25/49 Synced+Healthy, 20 did NOT converge, 4 excluded,
  0 undecidable, 0 unattributed,
  0 of 90 samples could not reach the API server
  pods 85/134 Running/total, zeta-root sync=Synced
```

| | run 2 (pre-#17666) | run 3 (post-#17666) |
|---|---|---|
| roster | 43, **INCOMPLETE** | **49, COMPLETE** |
| `zeta-root` | `OutOfSync` | **`Synced`** |
| converged | 12 | **25** |
| excluded | 0 | **4** |
| **API unreachable** | **9 of 39 samples (23 %)** | **0 of 90 (0 %)** |
| `DeadlineExceeded` | 0 (run 1 had 19) | 0 |

## The API-reachability line is the one to lead with

**23 % of samples could not reach the API server before; none of 90 could not,
after.** And unlike the `DeadlineExceeded` symptom — which
[retracted itself](#run-2-retracts-the-baseline-this-item-was-built-on) by
vanishing on re-run with no fix — this one has a **mechanism** rather than a
correlation:

> The **k3s server process lives outside every pod cgroup.** Pod-level
> `resources.requests` cannot reach it. Only a **node-level** reservation
> (`kube-reserved` / `system-reserved`) could have protected it from the
> roster's own pods, and that is precisely the half of #17666 this measures.

That is the half that cannot be explained away by the intermittency found in
run 2.

## The exclusion path RAN — and it is the last NOT to close

081M3BEGSQR087G0R003610CGB reported three runs running that the manual-sync
exclusion path had never executed on a cluster: `excluded: 0` with the named
apps **absent**, because `zeta-root` never reached `Synced` so they were never
created. This run has `zeta-root sync=Synced` and the full 49, and all four
classified **by name, with the reason printed**:

```
roster excluded-manual-sync: cdi      -- nothing on this boot runs `argocd app sync`
                                          and the Application declares zeta.io/sync-policy: manual ...
roster excluded-manual-sync: kubevirt -- ...
roster excluded-manual-sync: ollama   -- ...
roster excluded-manual-sync: vllm     -- ...
```

`excluded: 4`, not 0. The diagnosis for why it never fired was correct, and the
gap is closed by a cluster rather than by an assumption.

## What the 20 remaining non-convergences ARE — and it is the substrate finding

`grep -cE 'Evicted|OOMKill|MemoryPressure|DeadlineExceeded|Liveness probe failed'`
on this run's serial returns **0**. No evictions, no OOM kills, no liveness
kills, no render timeouts. The 20 are `sync=Synced health=Progressing`
(cockroachdb, headscale, nats, opensearch, orleans, redis, tempo, weaviate …)
or Degraded for reasons already classified — `hindsight`'s external credential,
`openbao` sealed by design (081M3BKQFNC087G0R003MDGSAX).

> **The roster does not converge on this hardware, and it is not converging
> slowly because something is broken. Nothing is crash-looping. There is just
> not enough machine.**

That is the cleanest statement of the substrate limit `zeta-first-boot-k3s-
verify.nix`'s header claims verdict 7 measures: 4 vCPU / 12 GiB against
registered ClusterNodes of 16-22 cores and 66 G, 134 pods, 53 minutes.

## What this pair CANNOT attribute

**#17666 bundles two changes** — pod-level requests on nine containers AND
node-level reservations — so a single pair cannot say which produced which
effect. The mechanism argument above points the API-reachability result at the
node-level half, but that is reasoning, not a measurement. Separating them
needs a run with one half applied.

And it remains **one pair**. The intermittency established in run 2 applies
here too: a rate needs N runs, not two.
