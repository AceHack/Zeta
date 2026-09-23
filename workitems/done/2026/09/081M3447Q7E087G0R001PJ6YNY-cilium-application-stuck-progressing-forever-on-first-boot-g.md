---
id: 081M3447Q7E087G0R001PJ6YNY
type: bug
state: done
priority: P2
slug: cilium-application-stuck-progressing-forever-on-first-boot-g
title: "cilium Application stuck Progressing forever on first-boot: GatewayClass never Accepted (vendored Gateway API CRDs v1.2.1 missing v1 TLSRoute/BackendTLSPolicy/ReferenceGrant that cilium 1.20.1 requires)"
created: 2026-09-22T08:38:05.806Z
completed: 2026-09-22T08:59:41.115Z
depends_on: []
composes_with: []
---

# cilium Application stuck Progressing forever on first-boot: GatewayClass never Accepted (vendored Gateway API CRDs v1.2.1 missing v1 TLSRoute/BackendTLSPolicy/ReferenceGrant that cilium 1.20.1 requires)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3447Q7E087G0R001PJ6YNY-*.md` glob. -->

## Evidence

`bun src/Core.TypeScript/cluster/first-boot-replica.ts --run --target-revision main`
(2026-09-22): the `cilium` Application (wave -80) sat `Synced`/`Progressing`
indefinitely with every Cilium pod `Running`/`1/1` — DaemonSet `cilium`,
DaemonSet `cilium-envoy`, and Deployments `cilium-operator`/`hubble-relay`/
`hubble-ui` all fully Ready. The one unhealthy resource in
`.status.resources[]`'s live tree is `GatewayClass/cilium`:
`status.conditions[Accepted] = {status: Unknown, reason: Pending, message:
"Waiting for controller"}`, timestamped the Unix epoch — the chart's own
static placeholder, never updated live.

`cilium-operator` logs at startup:
```
level=error msg="Required GatewayAPI resources are not found, please refer to
docs for installation instructions" ... error="customresourcedefinitions...
\"tlsroutes.gateway.networking.k8s.io\" not found\nCRD \"referencegrants...\"
does not have version \"v1\"\ncustomresourcedefinitions...
\"backendtlspolicies.gateway.networking.k8s.io\" not found"
```

Cilium 1.20.1's operator (`operator/pkg/gateway-api/helpers/schemes.go`,
`RequiredGVKs`) refuses to start its Gateway API controller unless
GatewayClass/Gateway/HTTPRoute/GRPCRoute/ReferenceGrant/BackendTLSPolicy/
TLSRoute are ALL present at `v1`. The vendored
`full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml` was Gateway API v1.2.1
STANDARD channel (5 CRDs, no TLSRoute, no BackendTLSPolicy, ReferenceGrant at
`v1beta1` only) — this repo's own `cilium-kind-lane.ts` had already caught
and tracked 2 of the 3 gaps (`GATEWAY_API_CRD_GAP_REASONS`), but its coverage
checker only tests CRD-name presence, not version presence, so it never
caught the ReferenceGrant `v1`-vs-`v1beta1` gap.

Confirmed per Cilium's own docs (docs.cilium.io/en/stable/network/
servicemesh/gateway-api/gateway-api/): Cilium 1.20 requires Gateway API
v1.6.1 minimum, all 7 kinds at v1.

## Fix

Bumped the vendored bundle to the official Gateway API v1.6.1 STANDARD
channel install (`kubernetes-sigs/gateway-api` release asset
`standard-install.yaml`, verbatim + a provenance comment) — closes all three
gaps at once (adds TLSRoute v1, BackendTLSPolicy v1; ReferenceGrant gains a
`v1` version alongside its existing `v1beta1`). Updated `cilium-kind-lane.ts`
(`GATEWAY_API_CRD_GAP_REASONS` now empty; docstrings updated) and its test
file to match the closed gap.

LIVE VERIFIED on the running replica: applied the new bundle, restarted
`cilium-operator`, `GatewayClass/cilium` went `Accepted=True "Valid
GatewayClass"` within seconds, and a forced ArgoCD refresh moved the `cilium`
Application from `Progressing` to `Healthy`.

## Classification

METAL DEFECT, not a replica artifact — `full-ai-cluster/k8s/bootstrap/
gateway-api-crds.yaml` is applied identically by `k3s-server.nix` on real
NixOS metal; nothing about this defect depends on Docker/container nesting.
