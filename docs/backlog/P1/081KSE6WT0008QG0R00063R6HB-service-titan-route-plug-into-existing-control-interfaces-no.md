---
id: 081KSE6WT0008QG0R00063R6HB
priority: P1
status: open
title: ServiceTitan route — plug into existing control interfaces/structures (not new ones); ontology negotiation at the standards layer
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R002CC6314
composes_with:
  - 081KSE6WT0008QG0R000SH6E0R
  - 081KSE6WT0008QG0R003D199HE
  - 081KSE6WT0008QG0R002E6P098
  - 081KSE6WT0008QG0R001RG4FXD
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R003FG3E8R
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
tags: [strategy, standards, control-plane, ontology-negotiation, adoption, service-titan-route]
---

## Problem

Aaron 2026-05-25 mid-iteration-2-wait, sharpening the strategic
substrate from 081KSE6WT0008QG0R000WVYAJ2 (negotiation-high-seat) and 081KSE6WT0008QG0R0009YYNP4
(CNCF-ecosystem as force multipliers): *"i always follow the
service titan route now take advantage of existing control
interfaces/structure to spread faster and then our ontology
negoation can happen at the standards layer instead of each
project/cluster itself."*

The ServiceTitan strategic principle: **don't invent your own
control plane / interface / structure to compete with existing
ones; plug into the existing ones that have already won adoption,
then differentiate within those interfaces**. ServiceTitan's
success in trades-services SaaS came from plugging into existing
trade-business workflows (dispatch, payroll, inventory, customer
notifications) rather than asking operators to adopt new
workflows. The new value happened within the existing interfaces.

Applied to Zeta cluster-infrastructure substrate, this sharpens
081KSE6WT0008QG0R000WVYAJ2's "Zeta defines interfaces" framing:

| 081KSE6WT0008QG0R000WVYAJ2 abstract framing | 081KSE6WT0008QG0R00063R6HB ServiceTitan sharpening |
|---|---|
| Zeta defines interfaces; vendors implement | INSTEAD: Zeta uses EXISTING standard interfaces (k8s CRDs, OAM Components, Crossplane Compositions, Helm charts, OCI artifacts, ArgoCD Applications, Flux Kustomizations) |
| Plug CNCF projects behind Zeta interfaces | INSTEAD: contribute Zeta substrate AS standard k8s CRDs / OAM Components / Helm charts that operators using existing tooling can already consume |
| Vendor-swap via Zeta plugin layer | INSTEAD: vendor-swap happens at the EXISTING standards layer (k8s CRD substitution, OAM Trait swap, etc.); Zeta inherits the mechanism for free |
| Operator adoption requires Zeta interfaces | INSTEAD: operator already using k8s + ArgoCD + KubeVela ALREADY consumes Zeta substrate; adoption cost ≈ adding our chart/CRD to their existing manifests |

## Why this is the load-bearing strategic policy

The substrate-honest argument: **adoption cost dominates everything**.
Even a perfect new interface that operators have to learn loses
to a slightly-less-perfect interface they already know. The
control-plane / standards-layer market has already settled on:

- **k8s CRDs** — the universal "what runs on a cluster" interface
- **Helm charts** — the universal "how do I deploy something to k8s"
- **OCI artifacts** — the universal "how do I distribute artifacts"
- **OAM Components + Traits** — emerging app-model standard
- **Crossplane Compositions** — emerging cloud-resource-as-CRD standard
- **ArgoCD / Flux Applications** — universal GitOps reconciliation
- **OpenTelemetry** — universal observability wire protocol
- **OPA Rego** — universal policy expression
- **DAPR Components** — universal distributed-app primitive abstraction

Each is **already adopted, already deployed, already understood by
operators**. Zeta plugging into these standards inherits their
adoption + their ontology + their existing vendor-swap mechanisms.
Zeta competing with them at the standards layer would burn years
of adoption cost.

**The new value Zeta adds happens INSIDE these standards**, not
in parallel to them:

- AI-native cluster install (081KSGS9H0008QG0R002T3BJ2R) — shipped AS NixOS host
  configs + ArgoCD Application manifests + Helm charts; operators
  consume via their existing GitOps + helm flow; Zeta substrate
  is "the most ergonomic NixOS + ArgoCD + KubeVela composition"
- USB as repair tool (081KSE6WT0008QG0R003WG0V6P) — shipped AS standard kubeadm /
  k3sup join-flow extensions; operators get the repair semantics
  by adopting Zeta's k8s manifests in their existing cluster
- ARC-AGI reference architecture (081KSE6WT0008QG0R0015ZF2G6) — published AS a
  reference GitOps repo any operator can `argocd app create`
  against; benchmark scenarios shipped AS standard ResourceGraphs
  + Compositions + Charts
- Telemetry flywheel (081KSE6WT0008QG0R003FG3E8R) — shipped AS standard OpenTelemetry
  exporters + ArgoCD ApplicationSet diff submitters
- CNCF force multipliers (081KSE6WT0008QG0R0009YYNP4) — every CNCF project Zeta
  adopts is already a standard the operator may already use;
  Zeta wires them coherently
- Cloud-native plugins (081KSE6WT0008QG0R000WVYAJ2) — re-framed: instead of
  Zeta-shaped interfaces, ship as standard k8s CRDs / OAM
  Components / Crossplane Compositions that the operator's
  existing tooling already consumes

## Ontology negotiation at the standards layer (the killer feature)

The 081KSE6WT0008QG0R002CC6314 ontology-negotiation substrate becomes **far more
valuable when it operates AT the standards layer** instead of
per-project or per-cluster:

- An OAM Component declared in Zeta-vocabulary is automatically
  understandable by KubeVela operators using OAM's standard
  vocabulary — ontology negotiation happens once at the
  standards-layer translation, not per-operator
- A Crossplane Composition published by Zeta is automatically
  consumable by Crossplane operators — the substitution
  semantics are Crossplane's, not Zeta's
- An OPA Rego module published by Zeta is automatically usable
  by any OPA deployment — the policy language is standard
- DAPR Components published by Zeta work in any DAPR deployment

**The standards layer is where ontology negotiation has the
highest leverage** because every operator using that standard
benefits, not just Zeta-cluster operators.

## Acceptance

- [ ] Document the policy explicitly in `docs/strategic-substrate.md`
      OR in CLAUDE.md+AGENTS.md so every future substrate
      authoring decision is filtered through it
- [ ] Audit existing cluster-install substrate (081KSGS9H0008QG0R002T3BJ2R v1
      currently in iteration-2 testing) against this filter:
      what parts INVENT new control interfaces? Which parts plug
      into existing standards? Refactor toward existing standards
      where it doesn't cost much
- [ ] Backlog audit: every open cluster-install row gets a
      "ServiceTitan filter pass" — does this row invent or
      adopt? If invent, can it be re-shaped to adopt?
- [ ] Catalog of standards Zeta plugs into: k8s CRDs, OAM
      Components + Traits, Crossplane Compositions, Helm 3 OCI
      charts, ArgoCD Applications + ApplicationSets, Flux
      Kustomizations, OpenTelemetry exporters, OPA Rego modules,
      DAPR Components, NixOS host configurations, disko shapes
- [ ] First adopted-standard implementation:
      `Zeta.Storage.BlobStore` (081KSE6WT0008QG0R000WVYAJ2) refactored from
      "Zeta-defined interface" to "standard k8s CRD that Zeta
      ships + operator consumes via their existing kubectl / helm
      / ArgoCD flow"
- [ ] Reference: README updates to position Zeta as
      "the most ergonomic composition of existing CNCF + k8s
      standards" rather than "a new cluster product with its own
      interfaces"
- [ ] Documentation cross-link: every Zeta substrate artifact
      includes a "this is which standard" header — operators can
      grep for "OAM Component" or "Crossplane Composition" and
      find every Zeta substrate that fits

## Composes with + supersedes-by-sharpening

This row **does NOT retract** 081KSE6WT0008QG0R000WVYAJ2 or 081KSE6WT0008QG0R0009YYNP4 — both remain
useful at the abstract level. It **sharpens** them with the
ServiceTitan strategic filter: every cluster-install substrate
decision should pass through "are we inventing or adopting?"
and prefer adopting.

The composition with 081KSE6WT0008QG0R002CC6314 (ontology negotiation):

- **Without this row**: Zeta builds its own ontology layer +
  asks operators to translate from their vocabulary to Zeta's
- **With this row**: Zeta's ontology negotiation happens AT the
  standards layer (OAM ↔ Crossplane ↔ Helm ↔ ArgoCD); every
  operator using ANY of those standards benefits regardless of
  whether they use Zeta directly

That's the leverage point. Ontology negotiation at the standards
layer is the load-bearing differentiator.

## Composes with

- 081KSE6WT0008QG0R002CC6314 — ontology+category negotiation (the substrate that
  operates at the standards layer per this row's sharpening)
- 081KSE6WT0008QG0R000SH6E0R — FIDO2/WebAuthn auth bridge (plug into existing
  WebAuthn + OIDC standards rather than invent new auth
  protocols)
- 081KSE6WT0008QG0R003D199HE — git-native per-machine state + GitOps reconciliation
  (the existing GitOps standard Zeta plugs into via ArgoCD /
  Flux)
- 081KSE6WT0008QG0R002E6P098 — kro/Crossplane/Koreo/middleware spectrum (the
  existing k8s-CRD-substitution substrate Zeta adopts)
- 081KSE6WT0008QG0R001RG4FXD — KubeVela/OAM Component/Trait (the existing app-model
  standard Zeta adopts)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (must be auditable against
  this filter)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona (the persona benefits
  when Zeta plugs into standards they may already know)
- 081KSE6WT0008QG0R0015ZF2G6 — open reference architecture (the reference IS the
  most ergonomic composition of existing standards)
- 081KSE6WT0008QG0R003FG3E8R — AI auto-submit-back telemetry (plugs into existing
  GitHub Issues + PR substrate, OpenTelemetry exporters)
- 081KSE6WT0008QG0R000WVYAJ2 — cloud-native plugins fit Zeta interfaces (sharpened
  by this row: prefer standard k8s CRDs over Zeta-defined
  interfaces where the CRD exists)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF ecosystem force multipliers (every adopted CNCF
  project IS a standards-layer plug)

## What this prevents

Failure modes:

- Zeta invents a new k8s-CRD-alternative → competes with k8s;
  loses on adoption
- Zeta invents a new GitOps reconciliation engine → competes
  with ArgoCD; loses on adoption
- Zeta invents a new app model → competes with OAM + Helm;
  loses on adoption
- Zeta invents a new policy language → competes with Rego;
  loses on adoption
- Zeta invents a new observability protocol → competes with
  OpenTelemetry; loses on adoption
- Zeta defines its own BlobStore interface → operators already
  using k8s CRDs for storage have to learn ours; adoption cost
  spike

Each "invent-our-own" decision burns adoption velocity. Adopting
existing standards + competing INSIDE them on quality of
composition + AI-nativity + UX-for-first-time-CLI-users +
reference-architecture-clarity is where Zeta wins.

## What this preserves

The 081KSE6WT0008QG0R000WVYAJ2 + 081KSE6WT0008QG0R0009YYNP4 thesis still holds at the strategic level:
**operator-in-the-negotiation-high-seat**. The sharpening is
HOW we achieve it — by plugging into standards layers that
already deliver swap-mechanism + ecosystem + adoption, rather
than building parallel substrate. The operator wins because
they get standards-layer benefits + Zeta's coherent composition.

## Out of scope

- Reconciling 081KSE6WT0008QG0R000WVYAJ2's "Zeta-defined interface" framing with
  this row's "standards-first" framing in detail per interface
  — handle case-by-case as each interface ships
- Standards-body engagement (CNCF membership, OASIS
  participation, etc.) — premature; ship working compositions
  first
- Forced retirement of any existing Zeta substrate that
  invents new interfaces — handle via the audit acceptance
  criteria above

## Origin

Aaron 2026-05-25, mid-iteration-2 wait, naming the
ServiceTitan-route strategic principle as the
filter every cluster-install substrate decision should pass
through. Drawn from Aaron's ServiceTitan operational experience
(plug into existing trade-business workflows rather than ask
operators to adopt new ones; new value happens inside existing
interfaces). The principle is well-tested in SaaS go-to-market
and directly applies to cluster-infrastructure substrate.
