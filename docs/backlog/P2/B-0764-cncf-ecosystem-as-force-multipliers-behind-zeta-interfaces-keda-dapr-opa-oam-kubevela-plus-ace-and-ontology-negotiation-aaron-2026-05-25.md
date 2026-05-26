---
id: B-0764
priority: P2
status: open
title: CNCF ecosystem as force multipliers behind Zeta interfaces — KEDA, DAPR, OPA, OAM/KubeVela + Ace + ontology negotiation
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0741
  - B-0763
composes_with:
  - B-0747
  - B-0748
  - B-0749
  - B-0754
  - B-0759
  - B-0761
  - B-0762
tags: [cluster, cncf, plugins, keda, dapr, opa, oam, kubevela, ace, force-multipliers]
---

## Problem

Aaron 2026-05-25 mid-iteration-2-wait, extending B-0763
(negotiation-high-seat via owned interfaces): *"we can use things
like KEDA, all the different DAPR ecosystem and OPA that Open
application or whatever it was called for the kube cncf project,
things like that, and all that plus ../scratch like old schoold
package management of mangers plus ontology negoation turns all
those standards into force multipliers."*

The CNCF ecosystem has shipped enormous substrate that operators
benefit from but vendor lock-in models have not yet exploited:

| Project | Stage | What it provides |
|---|---|---|
| **KEDA** | CNCF Graduated | Event-driven autoscaling (queue depth, metrics, schedules → pod count) |
| **DAPR** | CNCF Incubating | Distributed-app building blocks (state, pub/sub, service-invoke, bindings, secrets, actors) as sidecars + SDK |
| **OPA** | CNCF Graduated | Policy-as-code via Rego (admission control, authz, config validation) |
| **OAM** + **KubeVela** | CNCF Sandbox | Application-model / Component-Trait separation (already filed at B-0749) |
| **Crossplane** | CNCF Incubating | Cloud-resource provisioning via k8s CRDs (already filed at B-0748) |
| **kro** | CNCF Sandbox | ResourceGraphDefinition + CEL composition (already filed at B-0748) |
| **Cilium** | CNCF Graduated | eBPF networking + service mesh + observability |
| **ArgoCD / Flux** | CNCF Graduated | GitOps reconciliation (already in Zeta substrate per B-0747) |
| **Longhorn** | CNCF Incubating | Replicated block storage (Zeta default per current substrate) |
| **Rook + Ceph** | CNCF Graduated | Storage orchestrator + distributed object store (Zeta future) |
| **Knative** | CNCF Incubating | Serverless on k8s |
| **OpenTelemetry** | CNCF Graduated | Observability standard (logs/metrics/traces) |

Each is well-engineered, battle-tested, has ecosystem momentum.
**Adopting them as plugins behind Zeta's interfaces gives Zeta
their substrate for free** while preserving the negotiation-high-
seat property from B-0763.

Combined with:

- **Ace** (Aaron's existing package-manager substrate — old-school
  PM-of-PMs, per B-0247 / B-0287 / B-0288 lineage + B-0741 +
  related Ace work)
- **Ontology negotiation** (B-0741): cross-cluster, cross-fork,
  cross-vendor namespace bridging

...the CNCF ecosystem becomes a **force multiplier** for Zeta
rather than competition. Every CNCF project that ships becomes
another "plugin Zeta can offer operators behind a stable
interface."

## Target

Wire each major CNCF project into Zeta as a plugin behind a
Zeta interface (per B-0763 contract), so operators get:

- The CNCF project's substrate for free (KEDA's autoscaling,
  DAPR's distributed-app patterns, OPA's policy engine, etc.)
- Zeta's stable operator-facing interface (operator code doesn't
  change if the CNCF project upgrades, or if a non-CNCF
  alternative is swapped in)
- Composition via Ace + ontology negotiation (operators declare
  "I want autoscaling + policy + pub/sub" in Zeta-shape; the
  Ace + ontology layer resolves to KEDA + OPA + DAPR; future
  alternatives swappable)

## Acceptance

- [ ] **KEDA** plugin behind `Zeta.Scaling.EventDriven` interface
      (CRD wrapper: workload + scaler config → KEDA
      ScaledObject + TriggerAuthentication)
- [ ] **DAPR** plugin per building-block behind matching Zeta
      interfaces:
      - `Zeta.State.Store` (DAPR state component)
      - `Zeta.Messaging.PubSub` (DAPR pubsub component)
      - `Zeta.Service.Invoke` (DAPR service-to-service)
      - `Zeta.Bindings.Input` / `Zeta.Bindings.Output`
      - `Zeta.Secrets` (DAPR secret store component)
      - `Zeta.Actors` (DAPR actor runtime)
- [ ] **OPA** plugin behind `Zeta.Policy.Engine` interface (Rego
      policy evaluation; admission control via OPA Gatekeeper
      OR built-in Kubernetes ValidatingAdmissionPolicy where
      Rego is overkill)
- [ ] **OAM + KubeVela** plugin behind `Zeta.Application.Model`
      interface (Component + Trait → KubeVela Application CRD);
      composes with B-0749
- [ ] **Cilium** plugin behind `Zeta.Network.Mesh` interface
- [ ] **Knative** plugin behind `Zeta.Compute.Function`
      interface (composes with B-0763 cloud-Function adapters
      for serverless on k8s as the local-cluster option)
- [ ] **OpenTelemetry** plugin behind
      `Zeta.Observability.{Metrics,Logs,Traces}` interfaces
      (B-0763)
- [ ] **Rook + Ceph** plugin behind `Zeta.Storage.BlobStore` +
      `Zeta.Storage.Block` interfaces (alternative to
      Longhorn; operator swaps at cluster-build time or via
      data migration)
- [ ] Ace + ontology negotiation integration: operator
      declares desired capabilities in Zeta-shape; Ace
      resolves to CNCF project install + config; ontology
      bridge handles cross-vocabulary translation
- [ ] Documentation: `docs/cncf-ecosystem-as-plugins.md`
      explaining the force-multiplier framing + per-project
      plugin docs + swap paths
- [ ] Reference deployment: full Zeta cluster using KEDA +
      DAPR + OPA + OAM + Knative + OpenTelemetry behind the
      Zeta interfaces; documented + cost-estimated + working

## The force-multiplier framing

The substrate-honest argument: **adopting an ecosystem project
behind your own interface = you get their substrate + ecosystem
momentum + maintenance burden distribution, while keeping your
operator-facing contract stable**. Every CNCF project that
graduates adds force to your platform; you don't bear the cost of
building those primitives yourself.

The pattern composes with B-0763 negotiation-high-seat:

| Layer | What Zeta owns | What CNCF/vendors compete on |
|---|---|---|
| Operator API | `Zeta.<Capability>` interfaces | (Zeta-owned; stable contract) |
| Implementation | (chosen at install/runtime) | KEDA vs alternatives; DAPR vs alternatives; OPA vs alternatives; etc. |
| Underlying compute | (chosen at hardware/cloud) | NVMe vendors; cloud GPUs; etc. |

The operator sees only the Zeta interface; the CNCF project
ships substrate behind it; the vendor (cloud or on-prem)
ships hardware behind that. Three layers of competition; one
stable contract.

## Ace + ontology negotiation composition

Per Aaron's "package management of managers" framing:

- **Ace as PM-of-PMs**: the Ace package manager (per Aaron's
  existing B-0247 / B-0287 / B-0288 / B-0741 substrate) is
  designed to compose other package managers — npm, pip, gem,
  cargo, helm, krew, etc. → Ace.
- **Ontology negotiation**: cross-vocabulary translation
  between ecosystems (helm-charts ↔ kubevela-Components ↔
  crossplane-Compositions ↔ kro-ResourceGraphDefinitions).
- **Together**: operator declares "I want a state store"; Ace
  finds installed providers (DAPR / KEDA-managed Redis /
  Cloudflare-KV via B-0763 plugin / etc.); ontology layer
  translates between Zeta's `Zeta.State.Store` interface and
  whichever provider's native API; operator code doesn't
  change.

## Composes with

- B-0741 — ontology+category negotiation (the cross-vocabulary
  bridge layer)
- B-0747 — git-native per-machine state + GitOps reconciliation
  (the substrate the CNCF plugins reconcile against)
- B-0748 — kro/Crossplane/Koreo/middleware spectrum (the runtime
  for declaring plugin choices via k8s CRDs)
- B-0749 — KubeVela/OAM Component/Trait (already filed; this row
  references + composes)
- B-0754 — zero-typing first-boot (the install path needs CNCF
  plugins discoverable at install time)
- B-0759 — first-time-CLI-user persona (CNCF plugin docs need
  persona-aligned plain language; many CNCF docs are
  expert-only)
- B-0761 — open reference architecture (the CNCF substrate
  composition IS what makes the reference cloud-native; bare
  k3s isn't a reference architecture, k3s + KEDA + DAPR + OPA
  + ArgoCD + OpenTelemetry IS)
- B-0762 — AI auto-submit-back telemetry (which CNCF plugin
  combinations work best for which workloads — telemetry feeds
  recommendations)
- B-0763 — cloud-native plugins fit Zeta interfaces (this row
  is the CNCF-specific implementation of B-0763's general
  pattern)
- Ace existing substrate (B-0247, B-0287, B-0288 + related) —
  the PM-of-PMs that makes the plugin layer composable

## What this prevents

Without this scope, the failure mode is:

- Zeta builds its own autoscaling → competes with KEDA, loses
  on ecosystem momentum
- Zeta builds its own pub/sub → competes with DAPR, loses on
  feature parity
- Zeta builds its own policy engine → competes with OPA, loses
  on Rego ecosystem
- Etc.

Each "build-it-yourself" decision burns engineering time +
loses the CNCF ecosystem's network effects. Adopting them as
plugins behind Zeta interfaces gets the ecosystem for free + lets
Zeta focus on the layer it uniquely owns: the operator-facing
interfaces + the install/upgrade/repair flow + the AI-native
substrate.

## Out of scope

- Building Zeta-native alternatives to any CNCF project — the
  whole point is to NOT do that; adopt + integrate
- Tracking CNCF project lifecycle (graduated/incubating/sandbox
  status changes) at row scope — handle via `docs/TECH-RADAR.md`
  ring discipline
- Force-marketing Zeta to CNCF as a "we should be CNCF too"
  pitch — premature; ship working substrate, let CNCF
  recognition happen if it happens

## Strategic context

This row + B-0763 (cloud-native plugins) + B-0761 (open reference
architecture) + B-0762 (telemetry flywheel) + B-0741 (ontology
negotiation) compose into Zeta's full strategic substrate:

- **Own interfaces** (B-0763) → negotiation high seat
- **Adopt ecosystem** (B-0764) → force-multiplier behind those
  interfaces
- **Open reference** (B-0761) → AI-trainable + competitively
  benchmarked
- **Telemetry flywheel** (B-0762) → adoption-cost-to-zero
- **Ontology negotiation** (B-0741) → cross-vocabulary bridge

The competitive moat = the COMBINATION. Any one of these is
mimicable; the full stack composed coherently is not.

## Origin

Aaron 2026-05-25, mid-iteration-2 wait, extending B-0763's
negotiation-high-seat framing with the CNCF-ecosystem-as-force-
multiplier pattern. The OPA naming caught — Aaron initially said
"OPA that Open application or whatever it was called" which
conflates OPA (Open Policy Agent, Rego policy) with OAM (Open
Application Model, KubeVela). Both are referenced in this row;
both compose with the force-multiplier framing.
