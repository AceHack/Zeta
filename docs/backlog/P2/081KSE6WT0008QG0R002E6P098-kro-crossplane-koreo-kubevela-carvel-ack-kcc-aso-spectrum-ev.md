---
id: 081KSE6WT0008QG0R002E6P098
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: kro + Crossplane + Koreo + KubeVela + Carvel + ACK/KCC/ASO spectrum evaluation for Zeta — adopt where it composes (Aaron 2026-05-25 'kro yes' endorsement + 'we need lots of research in this area and backlog' direction); evaluate adoption against 081KSE6WT0008QG0R000YYH3DY reference stack + 081KSE6WT0008QG0R003D199HE machine-state reconciler + 081KSE6WT0008QG0R002CC6314 cross-cluster federation + downstream-fork story
domain: agentic-organization
ferried_by: aaron
owners: [aaron, max, addison]
composes_with:
  - 081KSE6WT0008QG0R003D199HE
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSE6WT0008QG0R002CC6314
  - 081KSE6WT0008QG0R0006HKTXJ
  - 081KSE6WT0008QG0R003C9KGQE
related_substrate:
  - docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md
  - docs/research/2026-05-25-radius-terraform-pulumi-controllers-crossplane-alternatives-aaron-forwarded.md
  - full-ai-cluster/k8s/applications/
tags: [kro, crossplane, koreo, kubevela, carvel, ack, kcc, aso, radius, terraform-controller, pulumi-kubernetes-operator, oam, k8s-control-plane-spectrum, declarative-operators, ResourceGraphDefinition, RGD, CEL, function-kro, evaluation-scope]
---

# 081KSE6WT0008QG0R002E6P098 — kro + Crossplane + middleware spectrum evaluation

## Carved blade

> Aaron 2026-05-25: *"kro yes and we need lots of research in this area and backlog"*. The k8s composition spectrum (ACK/KCC/ASO → Koreo/KubeVela/Carvel → kro → Crossplane) covers low-level provider operators → middle-tier orchestration → no-code high-level abstraction → universal control plane. Aaron's endorsement of kro signals adoption direction; the research-and-backlog ask signals the evaluation surface across the spectrum needs substrate-honest decomposition. Evaluate each layer against 081KSE6WT0008QG0R000YYH3DY reference k8s stack + 081KSE6WT0008QG0R003D199HE machine-state reconciler scope + 081KSE6WT0008QG0R002CC6314 cross-cluster federation needs + downstream-fork story; adopt where it composes with existing substrate (Vault + SPIRE + cert-manager + ESO + ArgoCD); document trade-offs substrate-honestly per layer.

## Origin

Aaron 2026-05-25, after the 081KSE6WT0008QG0R003D199HE substrate landed:

> *"kro yes and we need lots of research in this area and backlog. composes with machine outside k8s and other things gitops like."*

Plus extensive research dump (preserved verbatim at [`docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md`](../../research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md)) explaining the kro / Crossplane / middleware spectrum.

## The spectrum (per Aaron-forwarded research)

```
[ Lower-Level/Imperative ] ──> ──> ──> [ Higher-Level/Declarative Control Planes ]
Cloud Provider Operators   ──> Middleware Layer  ──> No-Code Abstraction ──> Universal Control Plane
(ACK / KCC / ASO)              (Koreo / KubeVela /     (kro: RGD + CEL)        (Crossplane: XRDs +
                                Carvel kbld+ytt)                                Compositions + Functions)
```

| Layer | Primary use | Logic language | Complexity |
|---|---|---|---|
| **ACK/KCC/ASO** (low-level provider operators) | Turn cloud APIs into k8s CRDs | None (raw YAML) | Low |
| **Koreo** (middleware orchestrator) | Map outputs of one operator into inputs of another | Imperative workflows | Medium |
| **KubeVela** (middleware abstraction delivery) | Sit on top of operators; model multi-resource apps | CUE templates | Medium |
| **Carvel kbld + ytt** (YAML injection) | Template-free overlays + dependency logic | YAML overlays | Medium |
| **kro** (no-code high-level abstraction) | Single RGD blueprint over any CRDs; auto-DAG; CEL | CEL expressions inline | Low (single RGD file) |
| **Crossplane** (universal control plane) | Build custom infra APIs via XRDs + Compositions | Go/Python via Composition Functions | High |
| **function-kro** | kro embedded inside Crossplane pipelines | Both | High base + low addition |

## Per-tool evaluation surface for Zeta

### kro — Aaron-endorsed; primary evaluation target

**Strengths matching Zeta substrate**:

- Single RGD blueprint composes with 081KSE6WT0008QG0R0004HV6RR hat-ontology (RGDs could declare hat-bindings as part of cluster resource graphs)
- CEL inline matches Zeta's declarative-everything posture
- Works with cloud-provider operators (ACK/KCC/ASO) when Zeta needs cloud-tier provisioning per 081KSE6WT0008QG0R0006HKTXJ 4-tier topology
- SimpleSchema strips OpenAPI v3 boilerplate — composes with Zeta's substrate-engineering hygiene
- Backed by AWS + Google + Microsoft collaboration — substrate adoption-bandwidth is real
- Cross-cluster: per-fork RGDs can be the unit Aces dispatches; composes with 081KSE6WT0008QG0R002CC6314 ontology negotiation

**Substrate-honest concerns**:

- "Bleeding-edge engine" per research; maturity evaluation needed
- CEL has its own substrate-engineering footprint; operator + AI both need to learn
- Composition with existing reference stack (Vault + SPIRE + cert-manager + ESO + ArgoCD) needs design pass

### Crossplane — heavy; specific use cases only

**Strengths**:

- Universal infrastructure control plane; if Zeta needs to define custom infra APIs that downstream forks consume, Crossplane is the established substrate
- Composition Functions enable Go/Python logic for complex orchestration
- Large ecosystem; multi-cloud abstraction layer

**Substrate-honest concerns**:

- XRD + Composition + Functions = substantial substrate-engineering overhead
- Conflicts with Zeta's existing investment in ArgoCD + cert-manager + ESO + Vault — those tools handle most of what Crossplane would
- function-kro is the integration path IF both adopted; otherwise pure-Crossplane has the dual-coupling problem

**Evaluation recommendation**: defer Crossplane adoption unless specific scope (custom-infra-APIs-for-forks) materializes. kro's lighter scope likely fits Zeta's current needs better.

### Koreo — cross-provider orchestration

**Strengths**:

- Workflow orchestration for cross-provider (AWS + GCP + Azure) cluster composition
- Useful IF cross-cloud federated forks become load-bearing per 081KSE6WT0008QG0R002CC6314

**Substrate-honest concerns**:

- Today's single-cluster + bare-metal focus doesn't need cross-provider orchestration
- Future scope when fork ecosystem actually spans clouds

### KubeVela — CUE-based abstraction

**Strengths**:

- CUE is a substrate Aaron has noted before (per prior memory; could compose well)
- Sits between ArgoCD apps + underlying k8s resources for higher-level app modeling
- Established CNCF project

**Substrate-honest concerns**:

- CUE adds another language to Zeta's substrate (alongside TS, F#, Bash, Markdown, JSON-LD, …)
- Substrate-honest evaluation needs to weigh against existing Helm + Kustomize patterns in the reference stack

### Carvel (kbld + ytt) — template-free YAML injection

**Strengths**:

- Programmatic YAML injection; could compose with 081KSE6WT0008QG0R003D199HE reconciler at the "render desired-state files" step
- VMware-backed; reasonable maturity

**Substrate-honest concerns**:

- Adds another layer between the operator's intent + the rendered k8s state
- Less natural fit for Zeta's already-Helm-heavy substrate

### ACK / KCC / ASO — cloud provider operators

**Strengths**:

- Native cloud-API → k8s CRD; first-class for cloud-tier clusters per 081KSE6WT0008QG0R0006HKTXJ 4-tier topology
- Required IF Zeta cluster needs to provision cloud resources (e.g., AWS RDS, GCP CloudSQL, Azure CosmosDB)

**Substrate-honest concerns**:

- Today's bare-metal-first focus deprioritizes
- Production cloud tier composes when shipped

## Scope items

### Scope item 1 — kro adoption design pass (Aaron-endorsed; highest priority)

- Evaluate kro adoption against 081KSE6WT0008QG0R000YYH3DY reference stack
- Define which substrate landscapes become kro RGDs (likely candidates: hat-system + per-cluster app composition + per-fork delta declarations)
- Document trade-offs of kro vs Helm vs Kustomize vs Crossplane for each substrate
- Acceptance: design pass document; at least one substrate area concretely planned for kro adoption

### Scope item 2 — Crossplane evaluation (deferred unless concrete need surfaces)

- Document where Crossplane WOULD compose with Zeta IF adopted (custom-infra-API surface for forks; etc.)
- Recommendation: defer adoption unless concrete need
- Acceptance: written evaluation; recommendation documented

### Scope item 3 — Middleware evaluation (Koreo / KubeVela / Carvel)

- Per-tool evaluation against specific scope items (cross-provider; CUE-based app modeling; YAML injection)
- Recommendation per tool: adopt now / adopt when scope materializes / skip
- Acceptance: written evaluation per tool

### Scope item 4 — Cloud provider operator evaluation (ACK / KCC / ASO)

- Evaluate per cloud-tier need (composes with 081KSE6WT0008QG0R0006HKTXJ cloud/hub tier)
- Defer adoption until cloud tier ships
- Acceptance: documented evaluation + deferral rationale

### Scope item 5 — function-kro evaluation (IF Crossplane adopted)

- Conditional scope item: only relevant if Crossplane scope item 2 results in adoption
- Document the integration pattern
- Acceptance: conditional; documented when triggered

### Scope item 6 — Radius evaluation (application-centric CNAP alternative; Microsoft-backed)

Per the extension research (preserved at `docs/research/2026-05-25-radius-terraform-pulumi-controllers-crossplane-alternatives-aaron-forwarded.md`):

- Radius uses **"Recipes"** instead of CRDs — defines an application graph (e.g., "I need a Redis cache") + Recipe auto-maps to underlying infrastructure
- Application-centric; competes with Crossplane on application-developer perspective; complements kro on platform-engineer perspective
- Microsoft-backed (same vendor that contributes to kro — they have multiple horses in the race)
- Potentially composes with 081KSE6WT0008QG0R002CC6314 ontology negotiation: Recipes COULD be the per-fork ontology declaration format at the application layer

Evaluation:

- Does Radius fit any specific Zeta scope better than kro? (e.g., per-fork "needs Redis cache" abstraction over LFG-cluster-Redis vs Healthcare-fork-encrypted-Redis)
- How does Radius compose with Vault + ArgoCD + the existing reference stack?
- Adoption decision per-scope (substrate-honestly per `default-to-both`: Radius AND kro can both compose where they each fit)

Acceptance:

- [ ] Written evaluation
- [ ] Per-scope recommendation (adopt for X scope; defer for Y scope; skip if no scope fits)
- [ ] Document Recipe-as-fork-ontology-declaration if it makes sense

### Scope item 7 — Terraform Controller + Pulumi K8s Operator evaluation (IaC-inside-k8s alternatives)

Per the extension research:

- **Terraform Controller (Flux/Weaveworks)**: HCL + Terraform modules wrapped in k8s objects; GitOps semantics; substrate-honest concern is it's still a "runner" not a native k8s controller loop
- **Pulumi Kubernetes Operator**: TS/Python/Go-defined resources managed by k8s operator; TS matches Zeta's Rule 0 substrate

Evaluation per Zeta:

- Zeta is Nix + ArgoCD first; doesn't need Terraform substrate today
- IF downstream forks have Terraform investment, Terraform Controller could compose
- Pulumi K8s Operator could compose for TS-defined k8s resources alongside YAML manifests — substrate-honest concern: dual-encoding adds complexity vs single-source RGD
- Both deferred unless concrete need surfaces

Acceptance:

- [ ] Written evaluation per tool
- [ ] Deferral rationale documented
- [ ] Trigger conditions for re-evaluation (when fork brings Terraform / when TS-resources scope materializes)

### Scope item 8 — Spectrum-adoption decision matrix

- Decision matrix that future-Otto + future-Aaron + future-contributor can use to pick the right tool per substrate need
- Composes with 081KSE6WT0008QG0R003D199HE reconciler logic (the matrix becomes a queryable artifact for `ace explain`)
- Acceptance: decision matrix documented; cross-references the per-tool evaluations from Scope items 1-5

## What's NOT in scope (deferred)

- **Production implementation** of any spectrum tool — this row is EVALUATION scope; implementation is per-tool follow-up rows
- **CUE language adoption beyond KubeVela** — substrate-engineering decision separate from this row
- **Helm vs kro migration** — if kro adopted, existing Helm charts stay (compose); migration is a separate scope
- **Terraform integration** — Terraform/Pulumi sit lower-level than the k8s control plane; out of this row's spectrum scope
- **Specific cloud vendor preference** — Zeta is bare-metal first; cloud tier composes when shipped

## Composes with .claude/rules/

- `.claude/rules/honor-those-that-came-before.md` — kro/Crossplane/middleware ecosystem is substantial existing work; adopt + cross-reference; don't reinvent
- `.claude/rules/bandwidth-served-falsifier.md` — spectrum adoption serves operator-substrate-coordination bandwidth (the right tool for the right layer; not one-tool-fits-all)
- `.claude/rules/default-to-both.md` — multiple tools per layer may coexist; not either-or
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "kro" / "Crossplane" / "Koreo" / "KubeVela" / "Carvel" all have substrate-anchors (verifiable open-source projects); razor does NOT cut
- `.claude/rules/dv2-data-split-discipline-activated.md` — spectrum layer = DV2.0 hub-satellite (each tool occupies a layer hub; per-substrate adoption variants are satellites)
- `.claude/rules/no-directives.md` — operator-substrate-honest scoping; Aaron + Knights Guild retain authority over adoption decisions

## Composes with backlog substrate

- **081KSE6WT0008QG0R003D199HE** (machine-state reconciler) — sibling at machine substrate scope; this row covers k8s substrate scope
- **081KSE6WT0008QG0R000YYH3DY** (reference k8s stack as Ace PoC) — directly affected by spectrum adoption decisions
- **081KSE6WT0008QG0R002CC6314** (ontology negotiation + Ace as universal primitive) — cross-fork interop uses whatever composition layer Zeta adopts
- **081KSE6WT0008QG0R0006HKTXJ** (4-tier cluster topology) — cloud/hub tier composes with cloud-provider operators (ACK/KCC/ASO)
- **081KSE6WT0008QG0R003C9KGQE** (Reticulum throughout cluster + edge) — composes at transport layer regardless of composition tool choice
- **081KSE6WT0008QG0R0004HV6RR** (hat ontology) — hat-bindings could be encoded as kro RGD outputs

## Substrate-honest framing

This row PROPOSES evaluation scope. It does NOT:

- Make adoption decisions today (those are per-Scope-item design passes)
- Force any specific tool (per-tool evaluation includes substrate-honest defer-or-adopt recommendation)
- Replace existing reference stack substrate (Vault + SPIRE + cert-manager + ESO + ArgoCD stay; spectrum tools compose with them where they fit)
- Promise specific implementation timelines (research scope; implementation is downstream)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Max + Addison + Knights Guild retain authority.

P2 priority — substantial research scope; informs 081KSE6WT0008QG0R000YYH3DY reference stack composition decisions + 081KSE6WT0008QG0R002CC6314 fork interop layer + 081KSE6WT0008QG0R003D199HE reconciler architecture. Not P1 because the existing reference stack works without spectrum adoption; spectrum tools optimize specific scopes when chosen.

## Aaron's "composes with machine outside k8s and other things gitops like" signal

Critical: spectrum thinking extends BEYOND k8s. The same pattern-of-thought (low-level → middleware → no-code-abstraction → universal-control-plane) applies to:

- **Per-machine state** (081KSE6WT0008QG0R003D199HE; GitOps for machine substrate)
- **Per-fork state** (081KSE6WT0008QG0R002CC6314; cross-fork ontology negotiation)
- **Per-AI agent state** (composes with 081KSE6WT0008QG0R00102H071 agency stack)
- **Per-cluster network policy state** (Cilium + Reticulum composition; 081KSE6WT0008QG0R003C9KGQE)

081KSE6WT0008QG0R001RG4FXD (filed alongside this row or as follow-up) carves the "GitOps + spectrum thinking beyond k8s" generalization scope.
