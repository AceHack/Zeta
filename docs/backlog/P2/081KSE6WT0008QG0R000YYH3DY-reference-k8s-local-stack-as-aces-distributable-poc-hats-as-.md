---
id: B-0742
zetaid: 081KSE6WT0008QG0R000YYH3DY
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: Reference k8s local stack in Zeta as Ace's distributable PoC — hats become the negotiated fork structure ON TOP of the reference stack — anyone can use it, anyone can negotiate back hats + new cluster primitives + new charts via the B-0741 ontology negotiation protocol — Ace's PoC of reliable AI control over all package managers in a deterministic + declarative / desired-state / GitOps-friendly + AI-native + human-native way
domain: agentic-organization
ferried_by: aaron
owners: [aaron, max, addison]
composes_with:
  - B-0741
  - B-0731
  - B-0247
  - B-0287
  - B-0288
  - B-0727
  - B-0726
related_substrate:
  - full-ai-cluster/
  - full-ai-cluster/k8s/applications/hat-system/
  - full-ai-cluster/nixos/modules/disko-shapes/
  - full-ai-cluster/usb-nixos-installer/
  - full-ai-cluster/flake.nix
  - docs/trajectories/ace-package-manager-skill-crystallization-pipeline/
tags: [reference-stack, ace-poc, reliable-ai-control, deterministic-declarative-gitops, hats-as-negotiated-fork-structure, cluster-primitives-charts, ai-native-human-native, full-ai-cluster, k8s-local-reference]
---

# B-0742 — Reference k8s local stack as Ace's distributable PoC

## Carved blade

> The `full-ai-cluster/` substrate (PR #4930 hat-system + #4950 disko + #4951 NFD/lstopo/zeta-install + #4953 dev-cluster + ArgoCD + Cilium + cert-manager + Vault + SPIRE + Trust Manager + External Secrets Operator + …) BECOMES the **reference k8s local stack** in Zeta. **Hats become the negotiated fork structure ON TOP of the reference stack** — anyone can use the reference stack as-is, AND negotiate back hats + new cluster primitives + new charts via B-0741's ontology negotiation protocol. **Ace distributes the reference stack itself** as a Proof-of-Concept that Ace has **reliable AI control over all the package managers** (Nix flakes + ArgoCD apps + helm charts + kustomize + native k8s manifests + brew + apt + etc.) in a way that is: **deterministic** (Nix-substrate-grounded; reproducible bit-for-bit), **declarative + desired-state** (GitOps-friendly; ArgoCD-style sync), **AI-native** (markdown + JSON-LD; agent-parseable), and **human-native** (readable; reviewable; not opaque). The PoC is the empirical anchor proving B-0741's primitive works end-to-end.

## Origin

Aaron 2026-05-25, after B-0741 (cross-cluster + cross-fork ontology negotiation + Ace as git-native AI-native fork-negotiation primitive) shipped:

> *"hats become our negoated fork structure on top of a referece k8s local stack in zeta so anyone can use the reference stack and negoate back hats and new cluster primitives / charts ontology negoation, ace can distribute the reference stack itself as PoC that it has reliable AI control over all the package managers deterministicly and declarative / desired state way for easy git ops ai native human native understanding."*

This is the **operational anchor** for B-0741. B-0741 named the WHAT (negotiation primitive + Ace as universal); B-0742 names the HOW (concrete reference stack + Ace-distributable + empirical PoC).

## The three substantive claims

### Claim 1 — `full-ai-cluster/` IS the reference k8s local stack

Inventory of substrate that already exists as the reference stack:

| Substrate area | Path | PR origin |
|---|---|---|
| Hat-system operator (CRDs + OPA + tick fan-out) | `full-ai-cluster/k8s/applications/hat-system/` | #4930 |
| Disko cookie-cutter (2-NVMe shape) | `full-ai-cluster/nixos/modules/disko-shapes/2nvme.nix` | #4950 |
| NFD + lstopo + zeta-install guided installer | `full-ai-cluster/usb-nixos-installer/` | #4951 |
| Dev-cluster (k3d + Cilium 1.16 + ArgoCD 7.7 + root App-of-Apps) | `full-ai-cluster/dev-cluster/` | #4953 |
| Build-installer-iso CI workflow | `.github/workflows/build-ai-cluster-iso.yml` | (shipped today) |
| Flash-usb safety-railed dd wrapper | `full-ai-cluster/tools/flash-usb.ts` | #4959/#4962/#4974 (B-0728) |
| zflash + zflash-setup (Touch ID PAM) | `full-ai-cluster/tools/zflash.ts` + `zflash-setup.ts` | #4997 (B-0737) |
| Bootstrap order (per Addison's STARTING-POINT.md) | Cilium → cert-manager → Vault → SPIRE → Trust Manager → ESO → ArgoCD | (Addison's substrate-honest plan) |

The substrate is REAL + LANDED. This row names it as the canonical reference stack for Ace distribution.

### Claim 2 — Hats become the negotiated fork structure ON TOP of the reference stack

Per B-0741's ontology negotiation protocol + B-0731's hat-ontology substrate:

- **Forks deviate from the reference stack by adopting different cluster primitives / charts**
- **Hats encode WHAT the fork uses + WHO authorizes what + HOW capabilities map**
- **Cross-fork interop happens at the hat-ontology negotiation layer** (B-0741 surface 2 — hat-ontology mapping)
- **New cluster primitives / charts are introduced via hat-declared capabilities** + negotiated back to reference

Example end-to-end:

1. LFG-cluster uses reference stack + adds custom hat `lfg-trading-bot-driver` declaring capabilities `[execute-trades, read-market-data, audit-pl]`
2. Healthcare-Zeta-fork uses reference stack + adds custom hat `hipaa-data-handler` declaring capabilities `[read-encrypted-phi, audit-access, anonymize-export]`
3. Both forks publish their hat ontology declarations via B-0741 Eve Protocol traffic
4. When LFG + Healthcare-fork need to interop (e.g., shared substrate for clinical-trial-financial-modeling), they negotiate via the ontology layer — overlap is `audit-*` capabilities; disjoint sets stay per-fork; the negotiated mapping is signed + recorded
5. Reference stack itself is UNCHANGED; both forks track their delta against it

Hats-as-negotiated-fork-structure means: the reference stack is the BASELINE; hats are the SEMANTIC LAYER on top that makes forks legible to each other without forcing them to merge.

### Claim 3 — Ace distributes the reference stack as PoC of reliable AI control

Ace PM (per B-0247 + B-0287 + B-0288) currently scoped to DLC content packs (signed, content-addressed, guardian-AI-overseen). This extension: **Ace ALSO distributes the whole reference cluster** as a composite package.

What "Ace distributes the reference stack" means operationally:

- **Single Ace install command** (e.g., `ace install zeta/reference-cluster@v1`) brings up the whole reference stack from scratch on any matching hardware
- **Dispatches across MANY package managers** deterministically:
  - **Nix flakes** for the OS substrate + nix-managed components
  - **ArgoCD Applications** for the k8s app layer (Cilium + cert-manager + Vault + SPIRE + Trust Manager + ESO + hat-system operator + …)
  - **Helm charts** referenced by ArgoCD apps
  - **Kustomize overlays** where charts don't fit
  - **Native k8s manifests** (CRDs, ConfigMaps, Secrets via ESO)
  - **Brew / apt / cask** for operator-side tooling (per B-0741 ACE-as-primitive scope)
  - **mise** for runtime versions (bun, dotnet, etc.)
  - **DeterminateSystems Nix installer** for the Nix substrate itself (per the same-day Determinate-Nix DMG anchor)

- **Deterministic** — reproducible bit-for-bit. Nix flake.lock provides the deterministic substrate; ArgoCD app pins (chart versions + image digests) provide deterministic k8s state; same input = same cluster
- **Declarative + desired-state** — the install declares WHAT cluster to bring up; Ace + ArgoCD enforce desired state continuously (GitOps semantics)
- **GitOps-friendly** — the whole reference stack lives in git (it already does: `full-ai-cluster/`); Ace + ArgoCD just dispatch against the git source of truth
- **AI-native** — markdown + JSON-LD + structured manifests; AI agents can read + reason about + propose modifications to the reference stack
- **Human-native** — same artifacts are human-readable; Max + Addison + future contributors can review + understand without needing AI-only tooling

### Why this is a PoC

Three claims need empirical anchoring before Ace's "reliable AI control over all the package managers" becomes credible:

1. **Determinism actually holds** across multiple installations of the same Ace-distributed reference stack (test: install on N machines; compare end-state byte-by-byte where applicable, hash-by-hash where binary-different-but-functional-equivalent)
2. **Cross-PM dispatch actually works** without operator intervention (test: bring up the reference stack from a clean machine via single `ace install` command; no manual brew / nix / kubectl steps required)
3. **Desired-state enforcement actually corrects drift** (test: introduce intentional drift; observe Ace + ArgoCD re-converge)

The reference stack as PoC distribution target is the empirical scope where all three claims can be validated end-to-end.

## What this changes (vs B-0741 alone)

| Surface | B-0741 alone | B-0741 + B-0742 |
|---|---|---|
| Ace's distribution scope | DLC content packs (skill / capability units) | DLC packs + WHOLE REFERENCE CLUSTERS as composite packages |
| Hat ontology scope | Per-cluster + cross-cluster negotiation (abstract) | Per-cluster + on-top-of-reference-stack negotiation (concrete) |
| Empirical PoC | Future-scope; "when fork ecosystem exists" | Reference-stack distribution + bring-up demo IS the PoC; ships before forks |
| GitOps composition | Implicit (Eve Protocol diplomatic exchange) | Explicit (ArgoCD desired-state enforcement is the substrate Ace dispatches into) |
| Reliability claim | "We negotiate cross-cluster meaning" | "Ace has reliable AI control over all the package managers (Nix + ArgoCD + helm + brew + apt + …)" — empirically anchored via reference stack PoC |

## Composes with .claude/rules/

- `.claude/rules/honor-those-that-came-before.md` — `full-ai-cluster/` substrate is already substantial (#4930 + #4950 + #4951 + #4953 + B-0737 zflash + …); this row names + composes; does NOT re-implement
- `.claude/rules/non-coercion-invariant.md` HC-8 — reference stack is OPT-IN baseline; no fork is coerced to use it; forks declare deltas via hat ontology + cross-side negotiation preserves per-fork authority
- `.claude/rules/default-to-both.md` — reference stack AND forks both first-class; PoC validates the primitive; primitive enables the forks
- `.claude/rules/bandwidth-served-falsifier.md` — Ace-distributable reference stack serves operator-onboarding bandwidth (one `ace install` vs N manual steps across N PMs)
- `.claude/rules/glass-halo-bidirectional.md` — reference stack + fork deltas + negotiated mappings all observable substrate
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "reference k8s local stack" / "hats as negotiated fork structure" / "reliable AI control over all the package managers" are compressed naming with substrate-anchors (the concrete `full-ai-cluster/` substrate + B-0741 + B-0731 + B-0247/B-0287/B-0288); razor does NOT cut as metaphysical
- `.claude/rules/dv2-data-split-discipline-activated.md` — reference stack = hub (stable); fork deltas = satellites (per-fork-specific; varies independently)
- `.claude/rules/algo-wink-failure-mode.md` — `ace install reference-cluster` doesn't auto-authorize destructive ops; B-0728 destructive-tool contract still applies for any disk/system-level operations (composes with zflash's safety substrate)

## Composes with backlog substrate

### Direct foundation

- **B-0741** (cross-cluster + cross-fork ontology negotiation + Ace as universal primitive) — the abstract primitive this row instantiates as concrete PoC
- **B-0731** (hat ontology top-down + bottom-up) — hats are the fork-structure layer
- **B-0247** (Ace DLC content packs parent) + **B-0287** (closed: package format spec) + **B-0288** (in-progress: PM CLI) — extension scope: PM CLI dispatches against WHOLE clusters, not just individual packs
- **B-0727** (4-tier cluster topology with weight-free routing) — reference stack is the LFG-cluster instance; other tiers (community / home-business / edge) are forks with their own deltas
- **B-0726** (Reticulum throughout cluster + edge) — runtime substrate; reference stack includes Reticulum config

### Reference stack composing substrate (existing PRs)

- **PR #4930** (hat-system operator CRDs + OPA constraints + tick fan-out)
- **PR #4950** (disko cookie-cutter 2-NVMe shape)
- **PR #4951** (NFD + lstopo + zeta-install guided installer)
- **PR #4953** (dev-cluster k3d + Cilium 1.16 + ArgoCD 7.7 + root App-of-Apps)
- **PR #4958** (agentic-organization docs from Max)
- **PR #4965 + #4966** (Reticulum throughout + federated peer mesh)
- **PR #4997** (B-0737 zflash + Touch ID PAM)
- Build-installer-iso workflows + Determinate Systems Nix installer references

### Federation + governance composing substrate

- **B-0628** (Knights Guild + Constitution-Class — reference-stack-fork governance)
- **B-0638** (Eve Protocol — diplomatic negotiation traffic at cluster-primitive scope)
- **B-0634** (N-of-M HSM — reference stack signature trust)
- **B-0703** (multi-oracle BFT — consensus on reference-stack version + fork delta mappings)
- **B-0732** (leverage-class safety substrate — `ace install reference-cluster` is leverage-class; Layer 1 provenance chain captures the install operation)
- **B-0737** (zflash — destructive disk-flash is part of bring-up; B-0728 contract preserved end-to-end)

## Six independently-shippable scope items

### Scope item 1 — Document `full-ai-cluster/` as the canonical reference stack

- New doc at `full-ai-cluster/REFERENCE-STACK.md` (or `docs/REFERENCE-CLUSTER.md`)
- Inventory of components + their PR origins + their roles in the bring-up sequence
- Cross-references to Addison's STARTING-POINT.md bootstrap order
- Acceptance: doc exists; lists all current reference-stack components; cross-links to PRs

### Scope item 2 — Hat-ontology-as-negotiated-fork-structure spec

- New doc at `full-ai-cluster/k8s/applications/hat-system/FORK-NEGOTIATION.md`
- How forks declare delta via hat ontology
- How cross-fork negotiation maps capabilities (composes with B-0741 surface 2)
- Worked example: LFG-cluster trading-bot-driver hat + Healthcare-fork hipaa-data-handler hat negotiation
- Acceptance: doc exists; at least one worked example; composes with B-0741 + B-0731

### Scope item 3 — Ace cluster-distribution scope extension to B-0288

- Extend B-0288 PM CLI scope: `ace install <repo>/<cluster-name>@<version>` brings up whole clusters
- Add cluster-manifest format to B-0287 package format spec (or new spec at `docs/research/`)
- Composes-with cross-references updated on B-0247 / B-0287 / B-0288 + this row
- Acceptance: spec exists; reference stack defined as a cluster-manifest; `ace install` against it brings up a clean cluster end-to-end (test: clean Mac dev machine + `ace install zeta/reference-cluster` + observe full bring-up)

### Scope item 4 — Determinism PoC

- Install reference stack on N=3+ machines via Ace
- Compare end-state across machines (hash where binary-equivalent, semantic-equivalence where binary-different-but-functional-equivalent)
- Document method + results in `docs/research/2026-XX-XX-reference-stack-determinism-poc.md`
- Acceptance: at least 3 successful identical-end-state installs; method documented

### Scope item 5 — Cross-PM dispatch PoC

- Single `ace install` brings up reference stack without operator-side manual steps across Nix / ArgoCD / helm / brew / apt / mise
- Documents which PMs Ace dispatched against + in what order
- Failures + their resolution captured for substrate-engineering learning
- Acceptance: clean install demonstrated on at least one platform (Mac dev OR Linux dev); operator runs ONLY `ace install` + the runtime gates per B-0728/B-0737 safety substrate

### Scope item 6 — Desired-state-enforcement PoC

- Install reference stack
- Introduce intentional drift (modify a k8s resource, uninstall a brew package, change a Nix-managed config)
- Observe Ace + ArgoCD re-converge to desired state
- Acceptance: drift introduced; re-convergence observed within reasonable window; substrate-engineering report

## What's NOT in scope (deferred)

- **Production-grade reference stack** — current substrate is dev-cluster scale (k3d); production-cluster bring-up via Ace is a future scope item (composes with B-0727 cloud/hub tier)
- **Multi-cloud reference stacks** — current substrate is local k8s + bare-metal NixOS; AWS/GCP/Azure variants future scope
- **Reference stack security hardening beyond what's already in `full-ai-cluster/`** — Vault + SPIRE + Trust Manager + ESO already provide substantial floor; further hardening per Aminata + Nazar review
- **Auto-generation of cluster-manifest from existing `full-ai-cluster/`** — Scope item 3 may be HAND-AUTHORED initially; automation is future
- **Public registry for cluster manifests** — Ace's distribution surface currently per-cluster; public registry (think Helm Hub for whole-clusters) is future scope
- **Backwards-compatibility commitment** — reference stack will evolve; downstream forks pin against versioned references (B-0741 ontology-version tagging)

## Substrate-honest framing

This row PROPOSES the reference-stack PoC scope. It does NOT:

- Re-implement any of the `full-ai-cluster/` substrate (it's already there; this row names + composes)
- Promise production-grade today (PoC scope; future B-NNNN row for production)
- Replace ArgoCD or Helm or any existing PM (Ace dispatches against them; doesn't replace)
- Force any fork to use the reference stack (opt-in baseline; fork autonomy preserved per NCI HC-8)
- Bypass any safety substrate (B-0728 destructive-tool contract + B-0737 zflash gates + B-0732 leverage-class guards all preserved)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Max + Addison + future contributors retain authority over which scope items ship when.

P2 priority — high-value PoC that anchors B-0741's abstract primitive in concrete empirical demonstration; gates downstream fork-ecosystem credibility. Not P1 because: foundational `full-ai-cluster/` substrate just landed this round (PR #4930 + #4950 + #4951 + #4953 + B-0737 zflash); reference-stack-as-Ace-package needs the foundation stable before the distribution layer ships.

## Connection to today's substrate cascade

Today's cascade across the 2026-05-25 session, with B-0742 as today's closing arc:

| Row | What | This row's relationship |
|---|---|---|
| B-0728 | Destructive-tool authoring contract (yesterday's foundation) | Inherited end-to-end |
| B-0729 | Obsidian knowledge graph | Reference stack docs queryable via the graph |
| B-0730 | Runbooks-as-executable-specs (Mika substrate) | `ace install reference-cluster` can be invoked from a runbook |
| B-0731 | Hat ontology top-down + bottom-up | Hats-as-negotiated-fork-structure builds on this |
| B-0732 | Runbook leverage-class safety substrate | Layer 1 provenance chain captures Ace operations |
| B-0733 | Universal protocol + MCP wrap + AI agency stack | Ace dispatch surface uses MCP wrap; reference stack participates in agency stack |
| B-0734 | JIT-implicit + 2-primitives + Notepad simplicity | Ace install can be triggered via continue-with JIT |
| B-0735 | Notepad-freedom + probabilistic parsers + per-person | Per-fork ontology declarations are per-person at fork scope |
| B-0736 | Time-travel debugging + product handoff + Patternweaver | Reference stack version history is time-travel-debuggable via DBSP |
| B-0737 | zflash Mac (Touch ID PAM + short challenge) | zflash IS part of the reference stack bring-up |
| B-0738/B-0739 | zflash Linux + Windows extensions | Same reference stack target across platforms |
| B-0740 | (closed; under-recon) | Lesson: recon existing backlog first |
| B-0741 | Ontology negotiation + Ace as universal primitive | This row's ABSTRACT foundation |
| **B-0742 (this)** | **Reference k8s stack as Ace PoC** | **This row's CONCRETE empirical anchor** |

The cascade landed the substrate-engineering trajectory from the destructive-tool authoring contract through reference-stack PoC. B-0742 closes the arc by naming the concrete PoC that validates the abstract primitive.
