---
id: 081KSE6WT0008QG0R000R8CPFX
priority: P1
status: open
title: Unified namespace across F# / Kubernetes / Ontology + experiment-ID routing via Argo Rollouts + Cilium service mesh (existing standards)
effort: L
ask: aaron-mika-grok 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R001H3DA90
  - 081KSE6WT0008QG0R0018WZ7TH
composes_with:
  - 081KSE6WT0008QG0R002CC6314
  - 081KSE6WT0008QG0R003D199HE
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
  - 081KSE6WT0008QG0R00063R6HB
  - 081KSE6WT0008QG0R00049EFBD
  - 081KSE6WT0008QG0R0016CEE2Z
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R0008483B2
  - 081KSE6WT0008QG0R003CMCX84
  - 081KSE6WT0008QG0R003TBE2VB
tags: [namespace, unified, fsharp, kubernetes, ontology, experiment-id, otel, routing, argo-rollouts, cilium, service-mesh, gateway-api]
---

## Problem

Aaron-Mika-Grok 2026-05-25 continuation of 081KSE6WT0008QG0R0018WZ7TH distributed
type negotiation substrate:

> **Aaron**: "Yeah, and imagine you tie this into the cluster
> where you can do routing based on your namespace too. So this
> is like real Kubernetes namespaces tied into the F-sharp
> namespaces, tied into the ontology routing, so that basically
> you can have some sort of experiment ID passed through, just
> like, uh, just like a, uh, OTEL ID, except this will say,
> okay, I have these three versions running locally in a dev
> branch. Make sure for my request, you route through my local
> version in my local namespace."
>
> **Mika**: "So you can pass through an experiment ID (similar
> to how you pass a trace ID in OpenTelemetry), and the entire
> stack routes your request to the exact version of the code
> that lives in your personal namespace/branch."

And Aaron's follow-ups on existing standards:

> **Aaron**: "Yeah, can you search the internet? There's
> Kubernetes projects and even routing. Microsoft has some
> kind of routing project for this. I forgot what it's called.
> So that most of this trickery in the, in the routes are done
> for you."
>
> **Aaron**: "we have Argo. How will this go into Argo workflow?
> We have, I mean, not Argo workflow, Argo rollouts, and we can
> do whatever kind of flagging tools if we need any kind of
> feature flags too."
>
> **Aaron**: "we can probably use celium sevice mesh with our
> cni"

Per Mika's research: Gateway API + Istio + Argo Rollouts + NGINX
canary annotations all support header-based routing. Microsoft
doesn't have one single project; Gateway API and Istio (AKS App
Routing uses Istio under the hood) are the modern options.

Per Aaron: Argo Rollouts (already deployed) + Cilium service
mesh (composes with Cilium-as-CNI per 081KSE6WT0008QG0R00049EFBD wave-3) are the
substrate-honest existing standards to plug into.

## Target

Unified namespace identity across three substrate layers tied
together with experiment-ID-based routing using existing
standards:

| Substrate layer | What namespace means in this layer | How tied together |
|---|---|---|
| **F# namespace** (per 081KSE6WT0008QG0R001H3DA90 + 081KSE6WT0008QG0R0018WZ7TH) | F# `namespace` declaration; per-type registration; per-namespace consensus strictness | Same identifier as K8s + ontology |
| **Kubernetes namespace** | k8s namespace for resources (Pods, Services, ConfigMaps, etc.) | Same identifier; k8s namespace name = F# namespace name |
| **Ontology namespace** (per 081KSE6WT0008QG0R002CC6314) | Vocabulary scope for ontology translation | Same identifier; ontology namespace name = F# + K8s namespace name |

Operator passes an experiment-ID header (OTel-style trace ID
analog) → request routes to the namespace that matches the
operator's intent:

```http
GET /api/foo HTTP/1.1
x-zeta-experiment-id: aaron-mirror-dev-3
```

Argo Rollouts + Cilium service mesh routes this request to:

- F# code from `Mirror.aaron.dev-3` namespace
- Kubernetes resources from `mirror-aaron-dev-3` namespace
- Ontology vocabulary from `mirror.aaron.dev-3` namespace
- Twin substrate scope per same namespace
- Per 081KSE6WT0008QG0R0018WZ7TH: this namespace is mirror-tier, no consensus
  required for type changes

Without the header → route to stable common namespace.

## Standards-layer composition (per 081KSE6WT0008QG0R00063R6HB ServiceTitan-route)

| Existing standard | Role | Why this standard | Already deployed |
|---|---|---|---|
| **Argo Rollouts** | Header-based canary / experiment routing; integrates with service mesh | Aaron already deployed it; native fit; AnalysisTemplate + Rollout resources support header routing strategy | ✓ `full-ai-cluster/k8s/applications/argo-rollouts` |
| **Cilium service mesh** | L7 routing layer (Envoy under the hood with eBPF data plane); native fit if Cilium is the CNI | Composes with Cilium-as-CNI per 081KSE6WT0008QG0R00049EFBD wave 3; no separate Istio install needed | Future (composes with existing Cilium adoption) |
| **Gateway API** | Standard k8s API for L7 routing (HTTPRoute, GatewayClass); replaces older Ingress API | CNCF / Kubernetes core; modern; widely adopted | Future addition |
| **OpenTelemetry** | Trace ID propagation pattern Zeta's experiment-ID follows | Existing CNCF standard; same propagation mechanism | Already in cluster (loki / tempo / alloy) |
| **k8s namespaces** | Resource isolation primitive | k8s core | Native |
| **F# namespaces** (per 081KSE6WT0008QG0R001H3DA90) | Type isolation primitive | F# language core | F# substrate base |
| **DAPR Components per namespace** | Per-namespace state stores, pub/sub, etc. | DAPR pattern (already deployed) | ✓ `full-ai-cluster/k8s/applications/dapr` |

Substrate-honest layering: existing standards do the heavy
lifting (Argo Rollouts for routing logic; Cilium for L7 data
plane; OTel for trace propagation; k8s + F# for namespace
primitives). Zeta substrate adds:

- Unified namespace identity (same name across F# / K8s /
  ontology)
- Per-namespace strictness for type negotiation (per 081KSE6WT0008QG0R0018WZ7TH)
- Per-namespace twin substrate scope (per 081KSE6WT0008QG0R0008483B2)
- Per-namespace routing config via Argo Rollouts AnalysisTemplate

## Acceptance

- [ ] `Zeta.Namespace` unified namespace concept documented
      in `docs/unified-namespace.md`: per-namespace identity
      spans F# + K8s + ontology + twin + routing
- [ ] Namespace declaration pattern:
      ```fsharp
      // F# namespace declaration also triggers:
      // - K8s namespace creation (if not exists)
      // - Ontology vocabulary scope registration
      // - Twin substrate scope registration
      // - Argo Rollouts routing rule per namespace
      namespace Mirror.aaron.experiments
      ```
- [ ] Argo Rollouts header-routing config per-namespace:
      ```yaml
      apiVersion: argoproj.io/v1alpha1
      kind: Rollout
      metadata:
        name: app-rollout
      spec:
        strategy:
          canary:
            trafficRouting:
              cilium: {}  # OR gateway-api: {} OR istio: {}
            steps:
            - setHeaderRoute:
                name: "experiment-id-route"
                match:
                - headerName: x-zeta-experiment-id
                  headerValue:
                    prefix: "mirror.aaron"  # per-operator routing
      ```
- [ ] OpenTelemetry trace context: experiment-ID becomes
      part of standard W3C Trace Context (`traceparent` /
      `tracestate`); Zeta substrate adds `x-zeta-experiment-id`
      as a baggage field per OTel baggage spec
- [ ] Per-namespace twin substrate (per 081KSE6WT0008QG0R0008483B2): twin events
      flow scoped per namespace; CEO + cross-DIO operators
      (per 081KSE6WT0008QG0R003CMCX84) can subscribe to per-namespace twin
      Observables
- [ ] Per-namespace plugin instances (per 081KSE6WT0008QG0R002275NDE): each
      namespace can have its own plugin backend (e.g., Redis
      cluster per namespace; or shared with namespace-prefix
      keys)
- [ ] Operator workflow: developer creates branch → namespace
      auto-created (`mirror.<operator>.<branch>`) → all 4
      substrate layers (F#/K8s/ontology/twin) get the
      namespace → developer's requests route to their branch
      automatically via experiment-ID baggage
- [ ] Cleanup: when developer's branch merges or is deleted,
      namespace can be torn down (per `kubectl delete
      namespace`); twin substrate per-namespace events
      preserved per retention policy
- [ ] Documentation per substrate layer:
      - F# namespace strictness (per 081KSE6WT0008QG0R0018WZ7TH) per namespace
      - K8s resource isolation per namespace
      - Ontology vocabulary scope per namespace
      - Twin substrate scope per namespace
      - Argo Rollouts routing rules per namespace

## Cilium service mesh vs Istio vs Gateway API decision

Per Aaron's preference + 081KSE6WT0008QG0R00063R6HB ServiceTitan-route discipline:

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Cilium service mesh** | Native if Cilium is CNI (per 081KSE6WT0008QG0R00049EFBD); eBPF data plane (perf); single tool for CNI + L4 + L7 | Newer (vs Istio); fewer integration tutorials | **PRIMARY** — substrate-honest fit |
| **Istio** | Mature; most tutorials; AKS App Routing uses it; battle-tested | Separate install; sidecar overhead (vs Cilium ambient); CNCF graduated | Alternative if operator already runs Istio |
| **Gateway API** | CNCF standard; Cilium + Istio + others implement it; future-proof | Implementation maturity varies | Compose UNDER both Cilium and Istio (use as the API surface) |
| **NGINX Ingress canary** | Mature; simple; widely deployed | Less powerful header-routing than Gateway API; older annotation pattern | Fallback for operators without Cilium / Istio |

Aaron's pick: Cilium service mesh (composes with Cilium-as-CNI
per 081KSE6WT0008QG0R00049EFBD) is the primary. Gateway API as the operator-facing
surface (Cilium implements Gateway API). Argo Rollouts drives
the per-namespace routing config.

## Operator workflow example

```bash
# Developer creates branch
git checkout -b aaron/experiment-3

# Argo CD detects branch + creates per-branch namespace
# (via existing Argo CD ApplicationSet pattern)
# Namespace = mirror.aaron.experiment-3 across:
#   - F# (compiler registers per-namespace types)
#   - K8s (namespace created; resources scoped here)
#   - Ontology (vocabulary scope per namespace)
#   - Twin (per-namespace event stream)
#   - Argo Rollouts (routing config matches header)

# Developer iterates in their branch; F# types changes are
# mirror-tier per 081KSE6WT0008QG0R0018WZ7TH (no consensus required); fast
# iteration.

# Developer's requests via browser / curl / Postman carry
# the experiment-ID header:
curl https://api.zeta.local/foo \
  -H "x-zeta-experiment-id: aaron-mirror-experiment-3"

# Cilium service mesh routes the request to the namespace
# matching the header (via Argo Rollouts AnalysisTemplate
# header-route step).

# Developer sees their branch's behavior; everyone else sees
# stable common-namespace behavior. No interference.

# When branch merges → namespace torn down (or graduated to
# common namespace per 081KSE6WT0008QG0R0018WZ7TH type-negotiation consensus).
```

## Why P1 priority

- Without unified namespace + experiment-ID routing, 081KSE6WT0008QG0R0018WZ7TH
  distributed-type-negotiation doesn't compose with operator
  workflow at request-level granularity
- Operator workflow for "try my version of this type" needs
  the routing layer to route requests to that version
- Composes with 081KSE6WT0008QG0R0008483B2 digital twin per-namespace scope;
  without this, twin can't be per-experiment-meaningfully-
  isolated
- Composes with 081KSE6WT0008QG0R003CMCX84 DIO + CEO-scale: per-DIO namespaces
  + per-experiment-per-DIO namespaces compose naturally
- All existing-standards composition per 081KSE6WT0008QG0R00063R6HB ServiceTitan-
  route; no new control plane invented

## Out of scope

- Specific Argo Rollouts AnalysisTemplate configurations per
  every workload — operator authors per-workload; pattern
  documented in v1
- Cross-cluster federation of namespaces per 081KSE6WT0008QG0R000QXSG91 — separate
  scope; per-cluster v1, federated v2
- Per-namespace billing / cost-allocation — separate scope;
  out of routing-substrate territory
- Multi-tenancy isolation guarantees beyond what k8s namespaces
  provide — separate scope; this row composes with existing
  k8s isolation; doesn't add new isolation primitives
- Visual operator tooling for namespace management — community
  can build on top; substrate is API-first

## Composes with

- 081KRFA460008QG0R0018SN61J — F# fork for AI safety (substrate base)
- 081KSE6WT0008QG0R002CC6314 — ontology negotiation (per-namespace vocabulary
  scope)
- 081KSE6WT0008QG0R003D199HE — git-native per-machine state (per-branch namespace
  auto-creation via Argo CD ApplicationSet)
- 081KSE6WT0008QG0R000WVYAJ2 — operator-in-the-negotiation-high-seat (Cilium /
  Istio / Gateway API all swappable per operator preference)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF force multipliers (Argo Rollouts + Cilium +
  Gateway API all CNCF-adopted)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (existing standards all the way
  down; Zeta adds the unified-namespace concept layer above)
- 081KSE6WT0008QG0R00049EFBD — slow-replace k8s (Cilium as CNI is one of the
  Wave 3 binary-compatible substrate; service mesh extends
  same Cilium deployment)
- 081KSE6WT0008QG0R0016CEE2Z — Zeta-native scheduler (namespace-aware scheduling
  composes; per-namespace workload placement)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable fabric (per-namespace
  scoped Observables; per-namespace command emission)
- 081KSE6WT0008QG0R0008483B2 — cluster as digital twin (per-namespace twin
  substrate scope)
- 081KSE6WT0008QG0R001H3DA90 — F# type system as universe boundary (F#
  namespaces become the unified-namespace identity source)
- 081KSE6WT0008QG0R003CMCX84 — DIO + CEO-scale (per-DIO + per-experiment-per-DIO
  namespaces compose naturally)
- 081KSE6WT0008QG0R003TBE2VB — eliminate tool wars (one namespace identifier
  across 4 substrate layers; operator doesn't fight per-layer
  namespace mappings)
- 081KSE6WT0008QG0R0018WZ7TH — distributed F# type negotiation (per-namespace
  strictness configuration)

## Origin

Aaron-Mika-Grok 2026-05-25 continuation of 081KSE6WT0008QG0R0018WZ7TH (distributed
type negotiation). Verbatim preservation at
`docs/research/2026-05-25-aaron-mika-grok-...md` (extended
segment with Argo Rollouts + Cilium discussion).

Unified namespace across F# / K8s / Ontology + experiment-ID-
based routing via existing standards (Argo Rollouts + Cilium
service mesh + Gateway API + OpenTelemetry baggage). Operator
workflow: branch → per-branch namespace across all 4 substrate
layers → requests with experiment-ID header route to operator's
version. Mirror-tier strictness (081KSE6WT0008QG0R0018WZ7TH) + per-namespace twin
substrate (081KSE6WT0008QG0R0008483B2) + Argo Rollouts header-route step all
compose.
