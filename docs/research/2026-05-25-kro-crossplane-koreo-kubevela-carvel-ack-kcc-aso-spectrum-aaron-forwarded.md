---
date: 2026-05-25
forwarded_by: aaron
verbatim: true
sources: chatgpt/external-research (per Aaron's forwarding)
discipline: research substrate; preserves verbatim per substrate-or-it-didnt-happen
substrate_landings:
  - 081KSE6WT0008QG0R003D199HE (the row this research informs at machine-substrate GitOps scope)
  - 081KSE6WT0008QG0R002E6P098 (kro + Crossplane + middleware spectrum evaluation — the row this research seeds)
  - 081KSE6WT0008QG0R000YYH3DY (reference k8s stack — affected by spectrum choice)
tags: [kro, crossplane, koreo, kubevela, carvel, ack, kcc, aso, gitops-spectrum, k8s-control-plane, declarative-operators, function-kro]
---

# kro + Crossplane + Koreo + KubeVela + Carvel + ACK/KCC/ASO spectrum — Aaron-forwarded research 2026-05-25

Substrate-honest preservation per `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation discipline. Aaron forwarded this research alongside his explicit "kro yes and we need lots of research in this area and backlog" + "composes with machine outside k8s and other things gitops like" framing 2026-05-25.

Material below is verbatim Aaron-forwarded text. Notes below the `---` separator are added at preservation time.

---

## You said: what is the cross plane alternative where they made generic declarative over operators in k8s over any definitions

You are thinking of **kro (Kube Resource Orchestrator)**.

It is a specialized open-source Kubernetes orchestration framework built specifically to solve the complexities of Crossplane Compositions. It allows platform teams to build generic, purely declarative APIs and controllers over any Kubernetes resource definitions without writing any Go code.

### Why kro Fits Your Description Exactly

- **Generic Over Any Definition**: kro doesn't care what the underlying Custom Resource Definitions (CRDs) are. It can dynamically group, manipulate, and orchestrate native Kubernetes resources (like Pods, Deployments) alongside external cloud infrastructures (like AWS ACK, Google Cloud KCC, or Azure ASO CRDs).
- **Purely Declarative (No-Code Operators)**: Instead of writing a controller in Go using controller-runtime or building rigid abstractions in Crossplane, you write a single blueprint using a custom resource called a `ResourceGraphDefinition` (RGD). kro takes this text definition and automatically exposes a new API schema to your users.
- **CEL For Logic**: To handle variable passing, dependencies, transformations, and conditional sequencing between resources without writing code, kro relies heavily on integrated Common Expression Language (CEL) expressions directly inside the YAML.
- **Simple Schema Integration**: It introduced `SimpleSchema`, which significantly strips away the verbose boilerplate of traditional OpenAPI v3 schemas used in standard Kubernetes CRDs.

### A Collaborative Cross-Cloud Effort

Originally developed out of AWS Labs, kro became a community project under the Kubernetes SIG Cloud Provider governance. It has seen widespread backing and collaboration from major cloud competitors including Amazon AWS, Google Cloud, and Microsoft Azure to simplify the native resource-composition layers in Kubernetes.

### Quick Comparison: Crossplane vs. kro

| Feature | Crossplane | kro (Kube Resource Orchestrator) |
|---|---|---|
| Primary Goal | Turn K8s into a Universal Infrastructure Control Plane. | Package, compose, and string together any existing K8s definitions seamlessly. |
| Abstraction Engine | Composite Resource Definitions (XRDs) & Compositions. | ResourceGraphDefinition (RGD). |
| Data Manipulation | Functions (Go, Python, gRPC) or rigid patches. | Native CEL Expressions executed safely in-cluster. |
| Target Infrastructure | Relies heavily on managed Upbound/Crossplane Providers. | Works completely natively with cloud-specific operators (ACK, ASO, KCC). |

For more details on the architecture and syntax, check out the official kro.run documentation or review the open-source repository on the kubernetes-sigs/kro GitHub page.

### Sources cited (15 sites)

- kubernetes-sigs/kro: kro | Kube Resource Orchestrator - GitHub
- Crossplane vs Terraform (Mar 2, 2021) — The Crossplane equivalent of a Terraform module is a Composite Resource - an XR. Each XR is exposed as an API endpoint.
- Crossplane as an abstraction platform to manage and deploy ... (Mar 31, 2021)
- ...

## You said: how does this relate to cross plane and i think there is something in between too

### The Relationship Between Crossplane and kro

kro was specifically designed to fix what many platform engineers consider the most frustrating part of Crossplane: its Composition Engine.

#### The Crossplane Architecture

To build a custom API in Crossplane, you must configure two heavily coupled objects:

- **Composite Resource Definition (XRD)**: Defines the "schema" (the input form developers fill out).
- **Composition**: Defines the "logic" (how those inputs map to actual cloud infrastructure).

The Crossplane community quickly realized that writing raw YAML for Compositions was incredibly rigid and complex. To fix this, Crossplane introduced **Composition Functions** — allowing you to write the composition logic using programming languages (like Go or Python) instead of standard YAML. However, this forced teams to switch from being declarative infrastructure writers to software developers, adding heavy operational overhead.

#### How kro Intersects

kro completely cuts out this dual XRD/Composition architecture.

Instead of maintaining separate input schemas and mapping files, kro uses a single `ResourceGraphDefinition` (RGD). It dynamically reads standard Kubernetes templates, figures out the dependencies itself (building a Directed Acyclic Graph, or DAG), and handles variables natively using Common Expression Language (CEL).

The relation is so tight that there is an official CNCF project called **function-kro**. This tool embeds kro directly inside a Crossplane environment, allowing you to use kro's simplified syntax inside a standard Crossplane pipeline.

### The Spectrum: What is "In the Middle"?

The evolution from low-level cloud tools to higher-level orchestrators follows a clear continuum. Depending on whether you look at cloud provider integrations or declarative framework engines, several prominent tools fit directly between Crossplane and kro.

```
[ Lower-Level/Imperative ] ──> ──> ──> [ Higher-Level/Declarative Control Planes ]
Terraform/Pulumi ──> Provider Operators ──> Hybrid Tooling ──> KRO / Crossplane Functions
```

#### 1. The Direct Providers (The Building Blocks)

Before Crossplane or kro can group anything, you need controllers that can actually talk to the cloud APIs. The official, cloud-native alternatives to Crossplane's individual infrastructure providers are:

- **AWS ACK** (AWS Controllers for Kubernetes)
- **Google Cloud KCC** (Config Connector)
- **Azure ASO** (Azure Service Operator)

**Where they sit**: They are lower-level than Crossplane. They don't do resource composition natively. They only turn raw cloud resources (like an S3 bucket or an RDS database) into a basic Kubernetes CRD.

#### 2. The Intermediaries (The "In-Between" Tools)

If you want to stitch those basic cloud provider CRDs together without dealing with Crossplane's massive control plane or kro's bleeding-edge engine, you use the tools sitting directly in the middle:

- **Koreo**: This is a prominent middleware engine specifically engineered to bridge the gap. It acts as a workflow orchestrator for Kubernetes. It allows platform teams to map the outputs of one operator (like Google's KCC) directly into the inputs of another (like AWS ACK) using control-flow primitives without building a rigid Crossplane abstraction.
- **KubeVela**: An established CNCF project that acts as an abstraction delivery engine. It sits on top of existing Kubernetes objects (including Crossplane or ACK providers) and uses the CUE configuration language instead of CEL to declaratively model, stitch together, and deploy multi-resource applications.
- **Carvel kbld & ytt**: Part of the VMware-backed Carvel suite, these tools act as advanced, programmatic YAML injectors. They let you build structural, template-free overlays and dependency logic across any custom resources before they ever hit the cluster API.

### Summary Comparison

| Metric | Cloud Operators (ACK/KCC/ASO) | Koreo / KubeVela / CUE | kro (Kube Resource Orchestrator) | Crossplane |
|---|---|---|---|---|
| Architectural Layer | Low-Level Provider | Mid-Tier Orchestration / Workflow | No-Code High-Level Abstraction | Universal Control Plane Framework |
| Logic Language | None (Raw YAML) | Imperative Workflows or CUE Templates | CEL Expressions inline | Go / Python via Composition Functions |
| Complexity | Low (One YAML per resource) | Medium | Low (Single RGD file) | High (XRD + Composition + Pipelines) |

If you are exploring these architectures for a project, let me know which cloud providers you are targeting or if you prefer writing pure YAML/CEL over writing programming code.

---

## Notes on this preservation (added at preservation time)

### Why Aaron forwarded this

Aaron 2026-05-25 framing immediately following the paste: *"kro yes and we need lots of research in this area and backlog. composes with machine outside k8s and other things gitops like."* — explicit endorsement of kro + ask for research substrate + signal that the spectrum extends to machine-state (081KSE6WT0008QG0R003D199HE) and other GitOps-like surfaces.

### Composition with Zeta substrate

| Spectrum tool | How it composes with Zeta substrate |
|---|---|
| **kro** | Strong candidate for 081KSE6WT0008QG0R000YYH3DY reference stack composition layer. Aaron's endorsement ("kro yes") signals adoption direction. RGD + CEL pattern feels native to the declarative-everything posture. Composes with 081KSE6WT0008QG0R0004HV6RR hat-ontology (RGDs could declare hat-bindings as part of cluster resource graphs). |
| **Crossplane** | Heavy-weight; existing investment in Vault + SPIRE + cert-manager + ESO substrate (per Addison's STARTING-POINT bootstrap order) may not need Crossplane's universal-control-plane scope. Substrate-honest: evaluate per use case. |
| **Koreo** | Middle-tier orchestrator; could be useful if cross-provider (AWS+GCP+Azure) cluster composition becomes load-bearing for federated forks (per 081KSE6WT0008QG0R002CC6314). Today's single-cluster scope doesn't need it; future federation might. |
| **KubeVela** | CUE-based; CUE is a substrate Aaron has noted before (per memory). KubeVela could sit between ArgoCD apps + the underlying k8s resources to provide higher-level app modeling. Evaluate. |
| **Carvel (kbld + ytt)** | Template-free YAML injection. Could compose with 081KSE6WT0008QG0R003D199HE reconciler logic at the "render the desired-state files" step. Substrate-honest evaluation needed. |
| **ACK / KCC / ASO** | Cloud-provider operators; useful when Zeta cluster needs to provision cloud resources (per 081KSE6WT0008QG0R0006HKTXJ 4-tier topology — cloud/hub tier composes with these). Today's bare-metal-first focus deprioritizes; production cloud tier composes. |
| **function-kro** | kro inside Crossplane; if we adopt Crossplane AND kro both, function-kro is the canonical integration path. |

### What this research enables

The research informs 081KSE6WT0008QG0R002E6P098 (kro + Crossplane + middleware spectrum evaluation — the umbrella for evaluating spectrum adoption for Zeta reference stack + downstream forks). The research is also reusable: any fork (per 081KSE6WT0008QG0R002CC6314) evaluating its own composition layer adoption gets the spectrum analysis for free.

### What this research does NOT decide

This research is descriptive (spectrum exists; tools have these properties). It does NOT decide for Zeta which tools to adopt. That's 081KSE6WT0008QG0R002E6P098's design pass. Substrate-honest expectation: the design pass weighs against Zeta's existing investments (Vault + SPIRE + cert-manager + ESO + ArgoCD), the upcoming 081KSE6WT0008QG0R003D199HE machine-state-reconciler scope, the cross-fork interop story per 081KSE6WT0008QG0R002CC6314, and operator (Aaron + Max + Addison) preferences.

### Aaron's "composes with machine outside k8s and other things gitops like" framing

Critical signal: the spectrum research is NOT only for k8s scope. Aaron is naming that the SAME pattern-of-thought applies to:
- Per-machine state (081KSE6WT0008QG0R003D199HE; GitOps for machine substrate state)
- Other GitOps-like things (likely fork state per 081KSE6WT0008QG0R002CC6314; ontology state per 081KSE6WT0008QG0R002CC6314; agent state; etc.)

081KSE6WT0008QG0R001RG4FXD (filed alongside this research preservation if scope warrants) carves the "GitOps-beyond-k8s" generalization scope.
