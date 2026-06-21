---
date: 2026-05-25
forwarded_by: aaron
verbatim: true
sources: chatgpt/external-research (per Aaron's forwarding)
discipline: research substrate; preserves verbatim per substrate-or-it-didnt-happen; extends the kro/Crossplane spectrum research same-day
substrate_landings:
  - 081KSE6WT0008QG0R002E6P098 (kro/Crossplane spectrum evaluation — this research extends the spectrum surface)
prior_research: docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md
tags: [radius, terraform-controller, pulumi-kubernetes-operator, kubevela-oam, crossplane-alternatives, application-centric-cnap, iac-inside-k8s, recipes, microsoft-radius, flux-terraform-controller]
---

# Radius + Terraform Controller + Pulumi K8s Operator + KubeVela OAM — Crossplane alternatives (Aaron-forwarded research 2026-05-25)

Substrate-honest preservation per `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation discipline. Aaron forwarded this research as an EXTENSION to the same-day kro/Crossplane/middleware spectrum research (preserved at `docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md`).

Material below the first `---` separator is verbatim Aaron-forwarded text. Notes below the second `---` are added at preservation time.

---

## more. we are alternatives to crd like clound native resource management to cross plane maybe it was one of thier competitors toolings

Based on your description of "alternatives to CRDs" and "cloud native resource management," you are likely thinking of **Radius (project-radius)** or one of the **Terraform/Pulumi Controllers for Kubernetes**.

Here are the main "competitor toolings" that offer cloud-native resource management as an alternative to Crossplane's CRD-heavy approach.

### 1. Radius (The "Application-Centric" Alternative)

This is a strong candidate for what you are remembering. It is an open-source Cloud Native Application Platform (CNAP) backed by Microsoft.

- **How it differs from Crossplane**: Instead of creating thousands of CRDs for every cloud resource (S3 bucket, RDS, queue), Radius uses **"Recipes"**. You define an application graph (e.g., "I need a Redis cache") and the Recipe automatically maps it to the underlying infrastructure.
- **Why it fits your description**: It is often positioned as a "Universal Control Plane" competitor to Crossplane but focuses on the **application developer's perspective** rather than the platform engineer's infrastructure graph.

### 2. Terraform & Pulumi Operators (The "Industry Standard" Alternatives)

If you prefer the traditional Infrastructure-as-Code (IaC) leaders but want them to run "cloud natively" inside Kubernetes:

- **Terraform Controller (by Flux/Weaveworks)**: Allows you to run Terraform modules inside Kubernetes. Instead of converting everything to Crossplane CRDs, you just wrap your existing Terraform code in a simple Kubernetes object.
  - **Pros**: You keep your existing Terraform ecosystem.
  - **Cons**: It is still running a "runner" under the hood, not a true native Kubernetes controller loop per resource.
- **Pulumi Kubernetes Operator**: Similar to the Terraform controller but for Pulumi. It lets you use general-purpose languages (TypeScript, Python, Go) to define resources, managed by a Kubernetes operator.

### 3. KubeVela (The "Modern Software Delivery" Alternative)

KubeVela is a CNCF project based on the Open Application Model (OAM).

- **How it works**: It sits on top of tools like Crossplane, Terraform, or native Kubernetes resources. It abstracts the complexity into "Components" and "Traits," effectively hiding the underlying CRD management from the end user.

### Summary of Competitors

| Tool | Approach to Resource Management | Best For... |
|---|---|---|
| **Radius** | Recipes (Application-centric abstraction). | Teams who want developers to self-serve "app dependencies" without managing infrastructure CRDs. |
| **Terraform Controller** | HCL / Modules running inside K8s. | Teams with a massive existing investment in Terraform who want GitOps. |
| **Google KCC / AWS ACK** | Native CRDs (1:1 mapping to cloud API). | Teams who want raw access to cloud resources in K8s without Crossplane's abstraction layer. |
| **KubeVela** | OAM (Model-driven delivery). | Platform engineers building a "Heroku-like" experience on top of K8s. |

If you were thinking of a tool specifically designed to avoid writing Go controllers while keeping the Kubernetes feel, it might have been **kro** (from the previous discussion) or **Radius** if the focus was on the application layer.

---

## Notes on this preservation (added at preservation time)

### Why this extends the spectrum research

The earlier same-day research (preserved at `docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md`) covered the per-LAYER spectrum (low-level operators → middleware → kro → Crossplane). This extension adds:

- **Pulumi K8s Operator** (TS/Python/Go via Pulumi inside k8s)
- **Radius** (application-centric CNAP alternative to Crossplane; Microsoft-backed; "Recipes" instead of CRDs)
- **Terraform Controller** (HCL inside k8s via Flux/Weaveworks)
- **KubeVela reframed** as Crossplane alternative (in prior research it was middle-tier; here it's positioned as competitor)

The spectrum becomes more like a **competitive landscape** at the high-abstraction layer, not a linear progression. Multiple tools occupy similar layers with different philosophies:

- **Infrastructure-as-Code inside k8s**: Terraform Controller / Pulumi K8s Operator (existing IaC tools + GitOps semantics)
- **No-code declarative**: kro (RGD + CEL; AWS-backed)
- **Application-centric**: Radius (Recipes; Microsoft-backed) / KubeVela (OAM; CNCF)
- **Universal control plane**: Crossplane (XRDs + Compositions + Functions)

### Composition with Zeta substrate

| Tool | Composition vector with Zeta |
|---|---|
| **Radius** | Microsoft-backed; recipes-as-abstraction matches Zeta's substrate-engineering posture (declarative + ontology-aware). Composes with 081KSE6WT0008QG0R002CC6314 (Recipes COULD be the per-fork ontology declaration format). |
| **Terraform Controller** | Useful IF Zeta needs to wrap existing Terraform substrate (probably won't; Zeta is Nix + ArgoCD first; if forks bring Terraform investment, this composes). |
| **Pulumi K8s Operator** | TS support is a Zeta substrate match (Rule 0; bun + TS first). Could compose if Zeta wants TS-defined k8s resources alongside YAML manifests. Substrate-honest concern: dual-encoding YAML + TS may add complexity vs single-source RGD. |
| **KubeVela (OAM)** | Already evaluated in prior spectrum research; reframed here as Crossplane alternative. Substrate-honest stance unchanged: CUE adds another language; evaluate per scope. |

### 081KSE6WT0008QG0R002E6P098 scope extension

081KSE6WT0008QG0R002E6P098 (kro + Crossplane + middleware spectrum evaluation) extends to include:

- **Scope item 7** (NEW): Radius evaluation — application-centric CNAP candidate
- **Scope item 8** (NEW): Terraform Controller + Pulumi K8s Operator evaluation — IaC-inside-k8s candidates
- Updated scope item 3 (middleware/alternative evaluation): now includes Pulumi K8s Operator alongside Koreo + KubeVela + Carvel

### Aaron's substrate-engineering posture (preserved at preservation time)

Aaron's previous-message framing: *"kro yes"* signals he leans toward kro for the no-code declarative layer. This research dump suggests he wants the FULL evaluation surface — including alternatives that might fit specific scopes better. Substrate-honest stance: kro is the primary evaluation target (per Aaron's "kro yes"); alternatives evaluated for specific scopes where they outperform kro.

For Radius specifically: Microsoft-backed + application-centric Recipes-based approach could fit some Zeta scopes (e.g., per-fork application-level deployments where the FORK declares "needs Redis cache" + Recipe maps to LFG-cluster's Redis vs Healthcare-fork's encrypted-PHI Redis variant). Worth evaluation per Scope item 7.

### Industry-positioning signals

- **AWS / Google / Microsoft** all collaborate on kro (per prior research) — kro has cross-cloud-vendor buy-in
- **Microsoft** also backs Radius — Microsoft has multiple horses in the race (kro contribution + Radius standalone)
- **Flux + Weaveworks** back Terraform Controller — established GitOps community alignment
- **CNCF** governance for KubeVela + Crossplane — neutral foundation backing for both
- **Determinate Systems** (separately, per 081KSE6WT0008QG0R001BS3K7Y) is the Nix substrate; not k8s composition layer

The competitive landscape is healthy — substrate-honest evaluation can pick per-scope without vendor lock-in concerns.
