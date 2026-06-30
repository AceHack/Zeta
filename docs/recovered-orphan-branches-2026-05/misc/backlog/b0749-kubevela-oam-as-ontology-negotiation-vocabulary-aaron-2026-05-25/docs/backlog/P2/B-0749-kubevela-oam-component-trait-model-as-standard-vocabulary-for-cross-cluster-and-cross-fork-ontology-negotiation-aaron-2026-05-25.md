---
id: B-0749
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: KubeVela + OAM Component/Trait model as the STANDARD VOCABULARY for cross-cluster + cross-fork ontology negotiation (extends B-0741) AND as composition layer on the reference k8s stack (extends B-0742) — Aaron 2026-05-25 'KubeVela and OAM seem very interesting to me from an ontology negoation perspective and our reference stack'
domain: agentic-organization
ferried_by: aaron
owners: [aaron, max, addison]
composes_with:
  - B-0741
  - B-0742
  - B-0731
  - B-0747
  - B-0748
related_substrate:
  - docs/research/2026-05-25-radius-terraform-pulumi-controllers-crossplane-alternatives-aaron-forwarded.md
  - docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md
  - full-ai-cluster/k8s/applications/
tags: [kubevela, oam, open-application-model, components, traits, ontology-negotiation-vocabulary, cross-cluster-standard-format, reference-stack-composition-layer, cue-templating, alibaba-microsoft-cncf]
---

# B-0749 — KubeVela + OAM as standard vocabulary for ontology negotiation + reference-stack composition layer

## Carved blade

> Aaron 2026-05-25: *"KubeVela and OAM seem very interesting to me from an ontology negoation perspective and our reference stack."* OAM (Open Application Model — CNCF; Alibaba + Microsoft origin 2019) splits app declaration into **Components** (developer-facing: what the app IS — web service, worker, database) + **Traits** (platform-facing: operational policies — autoscaling, ingress, observability). The Component/Trait split IS a standard vocabulary that B-0741 cross-cluster + cross-fork ontology negotiation can adopt directly: forks declare their apps as OAM Components + Traits; negotiation maps cross-fork Components/Traits via their **ComponentDefinitions** + **TraitDefinitions** (the schema layer; the actual ontology surface). KubeVela sits on top of the existing reference stack (B-0742) non-disruptively — Vault + SPIRE + cert-manager + ESO + ArgoCD all remain; KubeVela adds the app-model layer ABOVE them. CUE templating (Aaron has noted CUE as a substrate-interest before) is the workflow language. Result: standard OAM vocabulary as the cross-fork ontology negotiation format + KubeVela as the runtime that consumes it.

## Origin

Aaron 2026-05-25, after the B-0748 spectrum research dump (kro / Crossplane / middleware / Radius / Terraform Controller / Pulumi Operator):

> *"KubeVela and OAM seem very interesting to me from an ontology negoation perspective and our reference stack"*

This row carves the KubeVela/OAM-specific angle out of the broader B-0748 spectrum evaluation. KubeVela was evaluated in B-0748 as a middleware abstraction-delivery tool; B-0749 zooms in on the SPECIFIC angle Aaron just named — OAM as the standard ontology vocabulary + KubeVela as the reference-stack composition runtime.

## Why OAM is the right vocabulary for ontology negotiation

### The Component/Trait split maps to B-0741's negotiation surfaces

| B-0741 negotiation surface | OAM equivalent | Why fit |
|---|---|---|
| Package ontology mapping | **Components** + **ComponentDefinitions** | Component is what-the-app-IS; ComponentDefinition is the schema; cross-fork negotiation maps Component types via their definitions |
| Hat ontology mapping | **Traits** + **TraitDefinitions** | Trait is operational-policy/capability; TraitDefinition is the schema; cross-fork hat composition maps to Trait composition |
| Skill ontology mapping | **Workflow steps** (KubeVela workflow CRD) | Skills as workflow steps; cross-fork skill composition via workflow stitching |
| Category convergence under emergence | **Component categories** + custom labels | OAM has labeling + categorization built in |
| Trust + authority calibration | **Trait policies** (e.g., RBAC trait) | Per-trait authority + signature trust |

### Why this is BETTER than inventing a custom vocabulary

Per `.claude/rules/honor-those-that-came-before.md`:

- CNCF project; substantial governance + maintenance
- Alibaba + Microsoft origin; cross-vendor neutral
- OAM spec is a published standard (open spec; documented at <https://oam.dev>)
- Existing implementations in Java, Go, TS; not Zeta-specific lock-in
- Cross-platform: OAM doesn't care about underlying k8s implementation
- Recipes are designed for the operator-vs-developer split that maps to our hat-system + agency-stack split

Per `.claude/rules/bandwidth-served-falsifier.md`:

- Standard vocabulary serves cross-fork interop bandwidth (no protocol invention; existing OAM tooling works)
- Forks adopting Zeta + KubeVela get OAM negotiation surface for free
- Industry-standards-grounded throughout — same posture as B-0744 (FIDO2/WebAuthn/OIDC) at the AUTH layer; B-0749 is the same posture at the APPLICATION layer

### Composition with reference stack (B-0742) is non-disruptive

KubeVela sits ABOVE the existing reference stack layers:

```
                Operator-facing
                ───────────────
                OAM Components + Traits     ← what operators declare
                ↓
                KubeVela runtime             ← B-0749 substrate
                ↓
                Reference stack (B-0742):
                  - ArgoCD (GitOps)         ← unchanged
                  - Helm charts             ← unchanged
                  - Cilium                  ← unchanged
                  - cert-manager            ← unchanged
                  - Vault                   ← unchanged
                  - SPIRE                   ← unchanged
                  - Trust Manager           ← unchanged
                  - ESO                     ← unchanged
                  - Hat-system operator     ← unchanged
                ↓
                k8s primitives
```

No disruption to the substantial Bootstrap order substrate Addison documented. KubeVela becomes a composition LAYER above; everything below stays. Operators can adopt OAM Components + Traits for new apps without migrating existing Helm charts.

## What this row PROPOSES

### Scope item 1 — OAM vocabulary adoption design pass

- Document how Zeta's existing app-substrate maps to OAM Components + Traits
- Per-Component: type signature, ComponentDefinition schema
- Per-Trait: operational policies, TraitDefinition schema
- Worked example: hat-system operator (B-0731) modeled as OAM Components + Traits
- Acceptance: design pass document; at least 3 existing reference-stack apps mapped to OAM format

### Scope item 2 — KubeVela installation in reference stack

- Add KubeVela ArgoCD Application to `full-ai-cluster/k8s/applications/kubevela/`
- ApplicationSet pattern for per-fork variation
- Sync wave: after ArgoCD itself + cert-manager + Vault + SPIRE (KubeVela may depend on cert-manager for webhook TLS)
- Acceptance: KubeVela installable via standard ArgoCD app-of-apps; survives reference stack bring-up

### Scope item 3 — OAM as B-0741 ontology negotiation vocabulary

- Document the mapping: B-0741's 5 negotiation surfaces → OAM Components/Traits/Workflow/Definitions
- Per-fork OAM declarations become the negotiation payload (composes with B-0741 Eve Protocol message schema)
- Cross-fork negotiation resolves Component/Trait/Definition mappings via diplomatic exchange per B-0638 Eve Protocol
- Acceptance: documented in B-0741's row body; worked example: cluster A + cluster B negotiate OAM Component overlap

### Scope item 4 — Hat-system + Trait composition (extends B-0731)

- Hats from B-0731 hat-ontology compose with OAM Traits at the operational-policy layer
- Specific cases: which hats map to existing OAM Traits (autoscaling, ingress, observability) vs which need custom TraitDefinitions
- Per-fork hat-as-Trait variation negotiated per Scope item 3
- Acceptance: documented in B-0731's row body; at least 3 hats mapped to OAM Traits

### Scope item 5 — CUE templating in OAM (composes with prior CUE substrate notes)

- KubeVela uses CUE for templating; Aaron has noted CUE before
- Document CUE substrate adoption (separately or as part of KubeVela landing)
- Compose with TS-first Rule 0 (CUE is the OAM templating language; TS is the operator-side substrate language; they coexist at different layers)
- Acceptance: CUE substrate evaluated + documented; KubeVela CUE templates work alongside Zeta's TS tooling

### Scope item 6 — Per-fork OAM declaration files

- Each fork has `forks/<fork-name>/oam/components/` + `forks/<fork-name>/oam/traits/`
- Cross-fork interop uses these declarations as the negotiation payload (per Scope item 3)
- Composes with B-0747 per-machine state (machine-state COULD include OAM Component instances)
- Acceptance: at least one fork (LFG-cluster reference fork) has documented OAM declarations

## What this row does NOT do

- Replace existing reference stack substrate (KubeVela is ADDITIVE)
- Force OAM adoption for all apps (existing Helm/Kustomize stays; OAM is for NEW apps or migrated-when-valuable apps)
- Replace B-0741's overall scope (B-0749 is the specific KubeVela/OAM angle; B-0741 covers the broader negotiation primitive)
- Replace kro substrate from B-0748 (kro + OAM compose at different layers — kro for resource-graph composition; OAM for app-model abstraction; can coexist)
- Replace Crossplane evaluation (B-0748 Scope item 2; Crossplane can compose under OAM if both adopted)
- Promise specific implementation timelines

## Composes with .claude/rules/

- `.claude/rules/honor-those-that-came-before.md` — OAM is substantial CNCF substrate; adopt + cross-reference; don't reinvent
- `.claude/rules/bandwidth-served-falsifier.md` — standard vocabulary serves cross-fork interop bandwidth
- `.claude/rules/default-to-both.md` — OAM AND existing Helm AND kro all first-class at their respective layers
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 hub-satellite: Component = hub (stable identity); per-fork Trait variation = satellites
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "OAM Component/Trait" / "standard vocabulary for ontology negotiation" are compressed naming with substrate-anchors (OAM spec + KubeVela project + B-0741); razor does NOT cut
- `.claude/rules/non-coercion-invariant.md` HC-8 — cross-fork OAM negotiation must operate within NCI floor; neither fork coerced to accept other's TraitDefinitions

## Composes with backlog substrate

### Direct foundation

- **B-0741** (ontology negotiation + Ace as universal primitive) — THIS row provides the standard vocabulary B-0741's negotiation surface uses
- **B-0742** (reference k8s stack as Ace PoC) — KubeVela installs ABOVE the reference stack
- **B-0731** (hat ontology) — Hats compose with OAM Traits at operational-policy layer
- **B-0747** (machine-state reconciler) — machine-state COULD include OAM Component instances
- **B-0748** (kro/Crossplane spectrum evaluation) — KubeVela was evaluated in B-0748 as middleware; B-0749 is the focused adoption-direction row for the ontology-negotiation-vocabulary angle Aaron just named

### Related

- **B-0628** (Knights Guild + Constitution-Class) — TraitDefinition changes are constitutional-class for cross-fork interop; ratification path applies
- **B-0726** (Reticulum throughout) — OAM declaration transport at cross-cluster scope uses Reticulum
- **B-0727** (4-tier cluster topology) — per-tier OAM Component variation
- **B-0638** (Eve Protocol) — diplomatic-language layer carries OAM declarations across forks
- **B-0664** (NCI HC-8) — cross-fork OAM negotiation operates within NCI
- **B-0688 / B-0694 / B-0547 / B-0706** (Roslyn-touching rows) — KubeVela does NOT replace these; they sit at different layer

## OAM resources for reference

- **Spec**: <https://oam.dev>
- **KubeVela**: <https://kubevela.io> (CNCF project)
- **GitHub**: <https://github.com/kubevela/kubevela>
- **CUE templating** (used by KubeVela): <https://cuelang.org>
- **Open Application Model whitepaper** (2019; Alibaba + Microsoft): foundational ontology paper

## What this enables for Zeta's substrate-engineering trajectory

If KubeVela + OAM adopted as outlined:

- **B-0741 negotiation primitive** gets a standard vocabulary (not custom protocol; not bespoke schema)
- **B-0742 reference stack** gains an app-model abstraction layer for future ops
- **B-0731 hat-ontology** gains a standard operational-policy format (Traits)
- **B-0747 machine-state** gains app-level declaration format
- **Cross-fork interop** gets a CNCF-backed standard
- **Future operators** (Max, Addison, fork operators) inherit OAM-fluency from the ecosystem
- **Industry-standards-grounded** posture (same as B-0744 at auth layer; B-0749 at app-model layer)

The substrate-engineering arc gets stronger industry-standards-grounding throughout. Per Aaron's preference (signaled across multiple rows today): adopt-existing-standards over invent-protocol whenever the standards compose cleanly.

## Substrate-honest framing

This row PROPOSES the KubeVela/OAM-as-negotiation-vocabulary direction. It does NOT:

- Make adoption decisions today (Scope item 1 design pass needed)
- Force any specific OAM Component/Trait taxonomy (per-fork variation allowed)
- Replace existing reference stack substrate
- Promise specific implementation timelines (research scope; implementation per-Scope-item)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Max + Addison + Knights Guild retain authority over adoption decisions.

P2 priority — substantial substrate-engineering target; composes with multiple in-flight rows (B-0741 + B-0742 + B-0731 + B-0747 + B-0748). Not P1 because existing reference stack works without OAM; OAM optimizes the cross-fork interop + app-model scopes when adopted.

## Today's substrate cascade extension

| Row | What |
|---|---|
| ... (B-0728 through B-0748) ... | ... |
| B-0744 | FIDO2/WebAuthn/OIDC bridge (industry-standards-grounded AUTH layer) |
| B-0748 | k8s composition spectrum evaluation |
| **B-0749 (this)** | **OAM as industry-standards-grounded APP-MODEL layer for ontology negotiation + reference stack** |

Today's industry-standards-grounding cascade now covers: biometric consent (PAM Touch ID / Windows Hello / fprintd) + cross-cutting auth (FIDO2/WebAuthn/OIDC) + app-model abstraction (OAM/KubeVela) + GitOps semantics (ArgoCD pattern extended via B-0742 + B-0747). Substrate-engineering posture: adopt-standards-everywhere where they compose; invent-protocol only where genuinely new substrate emerges.
