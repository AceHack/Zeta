# Argo CD Applications stuck Progressing on first-boot: cilium, spire, openbao, longhorn

WP12 (081M3447Q7E087G0R001PJ6YNY, 081M343EM0R087G0R003C8ZHJ7). Investigation of
run 35696323545's finding: on main's `first-boot-replica.ts` run, `cilium`,
`spire`, `openbao` and `longhorn` all sit `Synced`/`Progressing` for the whole
run even though their pods are Running. This matters because a pending change
gates later sync waves on child-Application health (`zeta.io/gates-later-waves`,
PR #17477/#17497), so any provider stuck Progressing stalls the whole catalog
on metal.

## Method

Reproduced locally: `bun src/Core.TypeScript/cluster/first-boot-replica.ts
--run --target-revision main --keep`, Docker Desktop, then inspected each
unhealthy Application's `.status.resources[]` and the live objects directly
(`kubectl -n argocd get application <app> -o json`, `kubectl describe`/`logs`
on the owning workloads). For spire, cross-checked against the already-running
NixOS VM test (`k3s-first-boot-roster-vm.yml`) and added a targeted metal-only
subtest to get a direct answer rather than reasoning from Docker-only evidence.

## Findings table

| App | Resource | Root cause | Classification | Fix |
|---|---|---|---|---|
| cilium | `GatewayClass/cilium` | `status.conditions[Accepted]` stuck at the chart's static `Unknown/Pending: Waiting for controller` placeholder — cilium-operator 1.20.1 refuses to start its Gateway API controller because the vendored Gateway API CRD bundle (v1.2.1 STANDARD) is missing `TLSRoute`/`BackendTLSPolicy` entirely and ships `ReferenceGrant` at `v1beta1` only, while `RequiredGVKs` wants all seven Gateway API kinds at `v1` | **METAL DEFECT** — `full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml` is applied identically by `k3s-server.nix` on real NixOS metal; nothing here depends on Docker | Bumped the vendored bundle to the official Gateway API v1.6.1 STANDARD channel install (verbatim release asset). Live-verified: `GatewayClass/cilium` went `Accepted=True` and the Application went `Healthy` after re-running the operator against the new CRDs. |
| spire | `spire-agent` DaemonSet pods | CrashLoopBackOff: `could not open attestation stream to SPIRE server: ... dial udp <clusterIP>:53: i/o timeout` — a control probe (identical hostNetwork + `dnsPolicy: ClusterFirstWithHostNet` busybox pod) could not reach kube-dns's ClusterIP at all, while an otherwise-identical pod-network probe reached the same server fine. Isolated to hostNetwork sockets not being covered by Cilium's ClusterIP socket-LB in this environment | **REPLICA ARTIFACT — CONFIRMED on the metal oracle, not inferred** (run 35706939767) | Two subtests added to `k3s-first-boot-roster.nix` and run on a real NixOS VM: (1) hostNetwork+`ClusterFirstWithHostNet` resolved `kubernetes.default.svc.cluster.local` via ClusterIP DNS — **PASS**; (2) `spire-agent`'s restartCount held flat (`[3,3,3,...]`, settled during ordinary startup churn) over a 180s window — **PASS**, no ongoing crash loop. Recorded as a named `first-boot-replica.ts` DIVERGENCE (`spire-agent-hostnetwork-dns-in-nested-container`); no metal-side fix needed. |
| openbao | `openbao-0` (server container) | `core: security barrier not initialized`, `core: seal configuration missing, not initialized` — no PKCS#11/TPM seal is wired yet (no HSM/TPM in CI or in this Docker replica) and no `openbao-unseal-shares` Secret exists to auto-unseal via the `extraContainers` sidecar | **EXPECTED, by design, on BOTH the replica and metal today** — the Application.yaml's own header states this explicitly: "NO PKCS#11 SEAL HERE YET, AND THAT IS THE HONEST PART... A missing share cache must wait, not crash-loop: the Secret is optional and the sidecar returns `[]` rather than exiting." Not a replica artifact to fix; it becomes Healthy once real HSM/TPM seal wiring and an unseal-shares Secret land on metal | None needed. Confirmed the ONLY cause is the absent seal/unseal material, not a secondary defect. |
| longhorn | `longhorn-manager` DaemonSet | CrashLoopBackOff — no block devices are attached to the Docker replica container, so Longhorn (an ArgoCD-owned child Application, not in the bootstrap roster) cannot discover any disk to manage | **REPLICA ARTIFACT** — already named in `first-boot-replica.ts`'s `DIVERGENCES` list (`no-longhorn-disks`) before this investigation started; confirmed correct and unchanged. A NixOS metal node has real block devices (`longhorn-disks.nix`) | None needed for the replica; already correctly classified and printed. |

## cilium — detail

`cilium-operator`'s Gateway API leader-lifecycle controller logs, on every
first boot with the old bundle:

```
level=error msg="Required GatewayAPI resources are not found, please refer to
docs for installation instructions" ... error="customresourcedefinitions...
\"tlsroutes.gateway.networking.k8s.io\" not found\nCRD \"referencegrants...\"
does not have version \"v1\"\ncustomresourcedefinitions...
\"backendtlspolicies.gateway.networking.k8s.io\" not found"
```

This repo's own `src/Core.TypeScript/cluster/cilium-kind-lane.ts` had already
caught two of the three gaps (`GATEWAY_API_CRD_GAP_REASONS`, each entry naming
"LIFTS WHEN: ... v1.6.1" as the fix) but never applied it — the third gap
(`ReferenceGrant` present but not at `v1`) went uncaught because that
module's coverage checker only tests CRD-name presence, not version presence.
Cilium's own docs (docs.cilium.io) confirm Cilium 1.20 requires Gateway API
v1.6.1 minimum with all seven kinds at `v1`.

Fix: `full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml` now vendors the
official `kubernetes-sigs/gateway-api` v1.6.1 STANDARD channel
`standard-install.yaml`, verbatim, with a provenance comment. `cilium-kind-lane.ts`'s
gap registry is now empty and its tests updated to match. Live-verified on the
Docker replica: applying the new CRDs and restarting `cilium-operator` moved
`GatewayClass/cilium` to `Accepted=True "Valid GatewayClass"` within seconds,
and a forced ArgoCD refresh moved the Application from `Progressing` to
`Healthy`.

## spire — detail

Control experiment on the Docker replica, same cluster, same CoreDNS/Cilium
config:

- Pod-network busybox, `dnsPolicy: ClusterFirst`, `nslookup spire-server.spire`
  → reaches the DNS server (`10.99.192.10:53`), gets an authoritative
  `NXDOMAIN` (short name, no full FQDN — the server answered).
- hostNetwork busybox, `dnsPolicy: ClusterFirstWithHostNet` (spire-agent's
  exact policy), same query → `connection timed out; no servers could be
  reached`.

This isolates the defect to hostNetwork sockets not reaching the ClusterIP
under Cilium's socket-LB in this environment, matching a class already
extensively diagnosed (but left unresolved) in `.github/workflows/
k8s-argocd-health-test.yml`'s k3d lane: "`bpf-lb-sock-hostns-only=true` ...
hostNetwork ClusterIP still FAIL, pod IP OPEN."

Because `first-boot-replica.ts` boots k3s nested inside a Docker container —
and already needs a `mount --make-rshared /` workaround purely to let Cilium's
sibling-container bind mounts succeed, a workaround NixOS metal's
systemd-managed shared root does not need — container-nesting cgroup/mount
differences were the leading hypothesis for why this reproduces here. Rather
than assert that, two subtests were added directly to `k3s-first-boot-roster.nix`
— the one test in this repo that boots the real roster on an actual NixOS VM
with no container nesting between spire-agent's host network namespace and
Cilium's socket-LB attachment point — and run on a real VM to get a direct
answer:

- First attempt (run 35706223651) FAILED, but the log showed the query
  actually REACHED CoreDNS and got an authoritative `NXDOMAIN` for the short
  name `kubernetes.default` — a search-domain-expansion false negative in
  busybox's `nslookup`, the same shape as the `spire-server.spire` short-name
  NXDOMAIN seen on the pod-network control probe above. Fixed to query
  `kubernetes.default.svc.cluster.local` (FQDN) instead.
- Re-run (run 35706939767): **PASS** on both subtests — the FQDN resolved
  cleanly via the ClusterIP DNS server from a hostNetwork pod, and
  `spire-agent`'s own restartCount held flat at 3 (settled during ordinary
  startup churn, then completely stable) across a 180-second sampling window.

**Verdict: CONFIRMED REPLICA ARTIFACT, not a metal defect.** hostNetwork
ClusterIP DNS resolution and `spire-agent` itself both work correctly on real
NixOS metal. Recorded as a named DIVERGENCE in `first-boot-replica.ts`
(`spire-agent-hostnetwork-dns-in-nested-container`) so the Docker replica
reports this crash loop as expected rather than as an unexplained FAIL. No
Cilium-values or spire-agent-config change was needed on the metal side.

## Pointers

- `src/Core.TypeScript/cluster/first-boot-replica.ts` — the Docker replica harness
- `full-ai-cluster/nixos/tests/k3s-first-boot-roster.nix` — the metal oracle
- `src/Core.TypeScript/cluster/cilium-kind-lane.ts` — Gateway API CRD coverage tracking
- `full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml` — the fixed vendored bundle
- `.github/workflows/k8s-argocd-health-test.yml` — prior (k3d-lane) diagnostics for the same hostNetwork DNS class
- workitems: 081M3447Q7E087G0R001PJ6YNY (cilium), 081M343EM0R087G0R003C8ZHJ7 (spire)
