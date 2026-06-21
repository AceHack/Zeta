---
id: 081KSGS9H0008QG0R001Y9FB62
priority: P2
status: open
title: Ansible+GitOps + Crossplane composition — cross-OS declarative management for Windows + Macs + non-NixOS Linux; extends GitOps reach beyond K8s manifests + NixOS flake.nix to the heterogeneous OS substrate the maintainer actually runs
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KR2E4K0008QG0R002YE3MMD
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R00280HHA7
  - 081KSGS9H0008QG0R002BC2ZR7
tags: [ansible, gitops, crossplane, cross-os, windows, macos, declarative-management, full-stack-orchestration, ansible-pull, agentless, idempotent, multi-host, single-source-of-truth, iter-7]
---

## North star

The maintainer 2026-05-26: *"nixos is our north star for declarative gitops ease"*

NixOS sets the gold-standard target for ALL declarative GitOps substrate in Zeta. Everything in this row exists to get non-Nix OSes (Windows, macOS, non-NixOS Linux) AS CLOSE AS POSSIBLE to the NixOS-native experience (one git commit → reconciler picks up → host state converges declaratively; idempotent; replayable; auto-rollback on failure). Ansible+Crossplane+Ace are the substrate that approximates the NixOS shape on platforms that don't have it natively. They're never going to be as clean as `nixos-rebuild switch --flake .#<host>` — they're how we get within shouting distance on the rest of the OS substrate.

This framing affects every sub-target design decision: "does this make the non-Nix experience MORE like NixOS, or does it add a parallel imperative-shape layer?" The former is the north-star direction; the latter is the failure mode.

## Problem

The maintainer 2026-05-26: *"This is good for declarative oses other than nix like id love to have it setup my windows machines and macs. ansible gitops"* + *"it's like cross plane too kinda"*

Today's substrate covers:

- **NixOS** (cluster nodes): declarative via `full-ai-cluster/flake.nix` + `nixos-rebuild switch`; iter-6.x cluster-update arc (081KSGS9H0008QG0R001EKTS5A–081KSGS9H0008QG0R002BC2ZR7) automates within-channel + cross-channel updates
- **macOS** (dev laptops, maintainer's primary Mac): imperative via `tools/setup/macos.sh` → Homebrew + mise; idempotent + auto-updating per [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) discipline but NOT declaratively-driven from git
- **Debian/Ubuntu Linux** (CI runners, contributor laptops): imperative via `tools/setup/linux.sh` → apt + mise; same shape as macOS
- **Windows**: no substrate today

Gaps:

- **macOS state isn't declaratively defined**: install.sh sets up TOOLS but not OS config (e.g., dock layout, login items, system preferences, file associations, ssh config, security settings). Manual operator work re-traces this on every new Mac
- **Windows entirely absent**: the maintainer runs Windows machines; today they're outside Zeta's declarative reach. Game-changing UX gap for the "everything in git, AI-managed" framework story
- **External infrastructure outside K8s**: ArgoCD only reconciles K8s manifests. Anything not K8s-shaped (DNS records, certificate authorities, external Postgres, IoT devices, network switches, USB-flashing operations) is operator-imperative today

Three substrate-engineering directions converge here:

| Tool | Scope | Mechanism | Maps onto our substrate |
|---|---|---|---|
| **Ansible** | Cross-OS host config + app deploy | SSH/WinRM/REST API agentless push OR `ansible-pull` cron pull | Cross-OS declarative state |
| **Crossplane** | External infra via K8s CRDs | K8s controller reconciles CRDs against cloud/external APIs | External-infra GitOps via existing ArgoCD |
| **ArgoCD** (existing) | K8s manifests only | Pulls git → applies to K8s | Workload state |

The end-state composition: **git = source of truth for ALL state** (K8s workloads via ArgoCD, NixOS via flake, cluster external infra via Crossplane, heterogeneous OS config via Ansible). One reconciler per substrate class; all pull from the same git.

## Ansible+GitOps reference architecture (per the maintainer's 2026-05-26 source paste)

Three operational patterns:

### Pattern 1 — Operator Model (Kubernetes-native)

For environments already running K8s where you want non-K8s resources managed via the same ArgoCD reconciliation loop.

```yaml
apiVersion: automation.ansible.com/v1alpha1
kind: AnsibleJob
metadata:
  name: configure-maintainer-mac
spec:
  playbook: "playbooks/macos_dev_workstation.yml"
  extra_vars:
    user: "aaron"
    workstation_tier: "primary"
```

ArgoCD watches a Git folder of these CRs; an Ansible Operator (Red Hat AAP or community) spins up pods to execute the playbook against the named external host.

**Fit for Zeta**: HIGH (the maintainer 2026-05-26 clarification: *"we are alwasy going to have k8s i don't mind the coupling but we can support both"*). K8s is always present in Zeta's substrate (the `full-ai-cluster/` is the cluster substrate; not optional). Operator-pattern coupling is therefore not a rejection criterion. Remaining concern is SSH/WinRM access from cluster pods to the operator's heterogeneous machines — iter-5.4 [081KSGS9H0008QG0R0027HJZYH](../P1/081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md) homelab gh-auth + tailscale-equivalent unlock this. Pattern 1 + Pattern 3 can BOTH ship; pick per use case (Operator for cluster-orchestrated workstation config; ansible-pull for fully-disconnected/edge hosts).

### Pattern 2 — Webhook Model (Agentless Push from Ansible Automation Platform)

Git provider fires a webhook to AAP on commit; AAP pulls + executes playbooks against targets.

**Fit for Zeta**: low — requires Red Hat AAP (commercial; per [`refresh-world-model-poll-pr-gate.md`](../../.claude/rules/refresh-world-model-poll-pr-gate.md) cost-awareness, adding a commercial dependency at the orchestration layer is high cost). Open-source equivalents (Semaphore, AWX) exist but the operational burden is non-trivial.

### Pattern 3 — `ansible-pull` Model (Agentless Pull)

Each target host runs `ansible-pull` from cron / systemd timer / launchd / Windows Scheduled Task. Pulls latest playbook from git, executes against itself, applies state.

```bash
# macOS / Linux cron entry
*/30 * * * * ansible-pull -U https://github.com/Lucent-Financial-Group/Zeta.git \
  -d /var/zeta/ansible -i hostname,localhost \
  playbooks/hosts/$(hostname).yml
```

**Fit for Zeta**: HIGH — composes perfectly with our existing patterns:

- Same shape as NixOS `system.autoUpgrade` (081KSGS9H0008QG0R002T6J6FS): host pulls from git + reconciles to declared state
- Same shape as the proposed iter-5.4 (`081KSGS9H0008QG0R0027HJZYH`) homelab-first gh-auth device-flow: nodes self-register + self-pull
- No commercial dependency
- No central orchestrator needed
- Works on macOS, Windows (via WSL or native), and any Linux distro out of the box
- Composes with our agent-discipline rules per [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) (idempotent playbooks; declarative state; same git-as-source-of-truth)

**Recommendation: support BOTH Pattern 1 (Operator) AND Pattern 3 (`ansible-pull`)** per the maintainer 2026-05-26: *"we are alwasy going to have k8s i don't mind the coupling but we can support both"*. Operator-pattern for cluster-orchestrated workstation reconciliation (the maintainer's workstations reachable from cluster); ansible-pull for fully-disconnected / edge hosts where the cluster can't reach in. Pattern 2 (commercial AAP) stays rejected on cost.

## Composition with Ace package manager — substrate already exists; this row is INSIDE the Ace agenda, not parallel to it

**Substrate-honest correction** (the maintainer 2026-05-26: *"that is what ace has been since we first talked about it you just keep forgetting we have substantial backlog around this"*): the Ace package-manager-of-package-managers framing is NOT a new architectural insight surfaced by this row; it is the **canonical Ace vision** existing in substantial substrate I should have read before authoring 081KSGS9H0008QG0R001Y9FB62. The Ace agenda is an operator-self-claimed agenda with backlog cluster + trajectory + cross-AI substrate triangulation already in place. This row sits INSIDE that agenda as one instance of Ace's stage-8 (distribute), not as a parallel architecture.

The maintainer's 2026-05-26 follow-ups in this conversation:

1. *"it would be ansible combined with ace package manager ../scratch install.sh like setup for those oses and our declarative package management"*
2. *"once ace gets a foothold it can do most everything else from there becasue it's a package manager of package manager including argo cd even"*

…are RESTATEMENTS of canonical Ace substrate that already encodes:

| Substrate surface | What's already there |
|---|---|
| **[Ace agenda](../../agendas/ace-package-manager/AGENDA.md)** | OPERATOR-SELF-CLAIMED 2026-05-22; 13-stage Ace lifecycle (riff → sieve → map → refine → build → generate → encapsulate → distribute → discover → verify → grow → revoke/quarantine → negotiate changes); polyglot package contents (F#/C#/TS/Rust + English + Rx meta-frame + hat controls + self-bindings + verification + revocation metadata); proto-governance via skill-bound hats with multi-oracle BFT; symmetric/decentralized (anyone deploys; operator's instance = one of many) |
| **[Ace trajectory](../../trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md)** | Active trajectory state + RESUME context |
| **Canonical project memory** ([`project_ace_package_manager_unrestricted_local_models_guardian_oversight_aaron_2026_05_07.md`](../../../memory/project_ace_package_manager_unrestricted_local_models_guardian_oversight_aaron_2026_05_07.md)) | Distributes UNRESTRICTED LOCAL MODELS (researchers + lawyers needing dangerous/sensitive content); Guardian/KSK gates EXTERNALIZED effects (not topics); Bond Curve pricing on actions; receipts stay local; composes with Itron runtime for the capability/effect boundary |
| **[Homebrew-shape distribution memory](../../../memory/feedback_aaron_ace_package_manager_homebrew_shape_bootstrap_website_chat_interface_full_distribution_stack_no_setup_needed_2026_05_13.md)** | Full distribution stack = website + chat interface + Homebrew-shape one-liner + Ace + local AI + Guardian/KSK; no setup needed beyond website visit |
| **[081KQZVQW0008QG0R000ZHEN62](../P1/081KQZVQW0008QG0R000ZHEN62-ace-dlc-content-packs-kernel-extensions-package-manager-2026-05-07.md)** (parent) | ace-dlc-content-packs-kernel-extensions-package-manager |
| **[081KR2E4K0008QG0R0033WVCXE](../P1/081KR2E4K0008QG0R0033WVCXE-ace-dlc-package-format-spec-2026-05-08.md)** (closed) | Package format spec — manifest, content hash, signature, versioning |
| **[081KR2E4K0008QG0R002YE3MMD](../P1/081KR2E4K0008QG0R002YE3MMD-ace-dlc-package-manager-cli-2026-05-08.md)** (in-progress) | CLI at `tools/ace/` with install/verify/list |
| **[081KRFA460008QG0R001H98EXJ](../P1/081KRFA460008QG0R001H98EXJ-three-repo-split-stage1-create-forge-ace-with-scaffolding-aaron-2026-05-13.md)** | Repo-split scaffolding for Ace |
| **[081KSE6WT0008QG0R000YYH3DY](../P2/081KSE6WT0008QG0R000YYH3DY-reference-k8s-local-stack-as-aces-distributable-poc-hats-as-negotiated-fork-structure-on-top-deterministic-declarative-gitops-ai-native-human-native-aaron-2026-05-25.md)** | K8s-local-stack as Ace's distributable POC; hats as negotiated fork structure on top of deterministic-declarative-gitops |
| **[081KSE6WT0008QG0R000JSJ3SR](../P1/081KSE6WT0008QG0R000JSJ3SR-industry-sharp-categories-plus-per-persona-ontology-maps-plus-ace-package-manager-negotiation-aaron-2026-05-25.md)** | Ace package-manager negotiation + per-persona ontology maps |
| **081KSE6WT0008QG0R002CC6314** (CLOSED 2026-05-26 prematurely during this session's stale-triage — see "## Sub-row to re-file" below) | "ontology+category negotiation as cross-cluster + cross-fork AI-skills+hats federation point — Ace becomes git-native AI-native fork-negotiation primitive for ANY AI-native project supporting forking + skills" |
| **[Package format spec v2](../../research/2026-05-22-ace-package-format-spec-v2-substrate-engineering-pipeline-extension.md)** | DeepSeek 2026-05-22 substrate-engineering pipeline extension (substrate-generation → sieve → cartographer → deliberate-writing-pass → houses) |
| **Research substrate** | [`docs/research/2026-05-08-ace-dlc-package-format-spec.md`](../../research/2026-05-08-ace-dlc-package-format-spec.md), [`docs/research/2026-05-07-ace-itron-patent-provenance-hole-puncher-bft-ten-year-plan-verbatim-aaron-claudeai.md`](../../research/2026-05-07-ace-itron-patent-provenance-hole-puncher-bft-ten-year-plan-verbatim-aaron-claudeai.md), [`docs/research/2026-05-02-aaron-ace-identity-dissolution-for-transfer-wwjd-rejection-arc-children-religious-freedom-first-class.md`](../../research/2026-05-02-aaron-ace-identity-dissolution-for-transfer-wwjd-rejection-arc-children-religious-freedom-first-class.md) |

**My agent-discipline failure** (now 3 instances today; same root cause class): I authored 081KSGS9H0008QG0R001Y9FB62's Ace section as if Ace were just "a package manager CLI in-progress at 081KR2E4K0008QG0R002YE3MMD" without reading the agenda / trajectory / project memory / canonical Aaron-disclosed direction. This is the same shape as the cascade #4 ISO audit failure landed earlier today (PR #5125): authoring substrate from incomplete view of what already exists. The `.claude/rules/dep-pin-search-first-authority.md` rule landed in PR #5126 today extends conceptually to "verify-existing-substrate-before-authoring-new-substrate" — this row's Ace section is a second empirical anchor for that discipline-gap.

**Third instance same session**: the maintainer 2026-05-26 *"i'm assuming you have the hat / fork negoation for ace too"* surfaced that I had ALSO missed integrating hat / fork-negotiation substrate into 081KSGS9H0008QG0R001Y9FB62's architectural flow (only added to the citation table after the second catch). Hats + fork-negotiation are CANONICAL existing Ace substrate, NOT add-ons to bolt on later:

- Ace agenda already specifies: *"Hats = controls + self-bindings over time crystals (PAIR is load-bearing primitive)"* + *"proto-governance via skill-bound hats with multi-oracle BFT (authority + bindings tied to skills)"*
- [081KSE6WT0008QG0R000YYH3DY](../P2/081KSE6WT0008QG0R000YYH3DY-reference-k8s-local-stack-as-aces-distributable-poc-hats-as-negotiated-fork-structure-on-top-deterministic-declarative-gitops-ai-native-human-native-aaron-2026-05-25.md): hats as negotiated fork structure on top of deterministic-declarative-gitops
- [081KSE6WT0008QG0R000JSJ3SR](../P1/081KSE6WT0008QG0R000JSJ3SR-industry-sharp-categories-plus-per-persona-ontology-maps-plus-ace-package-manager-negotiation-aaron-2026-05-25.md): Ace package-manager negotiation + per-persona ontology maps
- **081KSE6WT0008QG0R002CC6314** (CLOSED prematurely earlier this session — `backlog(081KSE6WT0008QG0R002CC6314): ontology+category negotiation as cross-cluster + cross-fork AI-skills+hats federation point — Ace becomes git-native AI-native fork-negotiation primitive for ANY AI-native project supporting forking + skills`). Closed via PR #5003 close-comment as part of the stale-PR triage; the close was justified mechanically (DIRTY conflict) but the substrate is genuinely load-bearing for this row — should be cherry-picked + re-landed (see "## Sub-row to re-file" below)

### Architectural integration of hats + fork-negotiation

The 4-reconciler shape isn't just "ansible+ace+ArgoCD+Crossplane" — each `ace install <pkg>` action goes THROUGH hat-bound authority + multi-oracle BFT proto-governance + (when crossing fork-boundaries) ontology negotiation:

```text
git (single source of truth) — per fork; each fork has its own git
│
│ Stage 0 — bootstrap Ace
│
│ Stage 1 — Ace runs every install through:
│   1a. Hat resolution: which hat's authority does this install action carry?
│       (skill-bound hats per Ace agenda; PAIR primitive; controls + self-bindings)
│   1b. Multi-oracle BFT proto-governance: does the hat have N-of-M consent
│       from the cluster's oracles for this specific action class?
│   1c. (Cross-fork operations) Ontology negotiation per 081KSE6WT0008QG0R002CC6314/081KSE6WT0008QG0R000JSJ3SR:
│       does the source fork's ontology map to the target fork's ontology
│       at the action's category? (per-persona ontology maps mediate)
│   1d. Guardian/KSK gate (per canonical Ace project memory):
│       does this action cross from "read" into "externalized effect"?
│       Bond Curve prices; receipts stay local; multi-N-of-M for high-risk
│   1e. ONLY then: ace install proceeds; receipt written; reconciler updates state
│
│ Stage 2 — orchestration / reconciliation:
│   ansible/playbooks/  → ansible-pull invokes `ace install <pkg>` (which goes
│                          through 1a-1e per invocation)
│   k8s/applications/   → ArgoCD invokes `ace install <chart>` for helm charts
│                          (same 1a-1e flow)
│   nixos/flake.nix     → nixos-rebuild already does its own equivalent
│                          (NixOS modules + signed-channel + impurity rules)
│   crossplane/         → Crossplane invokes ace-deployed providers
```

This means the iter-7 implementation arc has **substantially more substrate to compose with than my initial draft**: 081KSE6WT0008QG0R002CC6314 (re-land needed) + 081KSE6WT0008QG0R000YYH3DY + 081KSE6WT0008QG0R000JSJ3SR + the Guardian/KSK substrate from the canonical Ace project memory + the multi-oracle BFT pattern from the agenda. Sub-targets 1–5 each must respect the hat-authority + BFT-proto-governance + (where applicable) ontology-negotiation flow; they're not "thin platform playbooks delegating to `ace install`" but rather "playbooks that invoke `ace install` knowing each invocation goes through the full Ace authority flow."

## Sub-row to re-file

[081KSE6WT0008QG0R002CC6314](https://github.com/Lucent-Financial-Group/Zeta/pull/5003) (close-comment via PR #5003 stale-triage earlier this session) — the substrate is load-bearing for 081KSGS9H0008QG0R001Y9FB62's architectural integration above and needs re-landing via cherry-pick (per [`pr-triage-tiers.md`](../../.claude/rules/pr-triage-tiers.md) Tier 3). Sibling B-NNNN row should re-file with whatever ID-renumbering is needed. The close-comment named this as the substrate-honest re-land path; this row tracks it as a known dependency for iter-7 implementation.

### Correct layering (architecture-shape revision)

```text
Stage 0 — bootstrap-the-bootstrap (minimal install.sh / Powershell / curl one-liner)
└── installs Ace package manager (081KR2E4K0008QG0R002YE3MMD)            [foothold; ONE-time per host]

Stage 1 — Ace as meta-package-manager
└── ace install ansible                              [orchestration tool]
└── ace install argocd                               [K8s reconciler]
└── ace install crossplane                           [external-infra reconciler]
└── ace install k3s | kubeadm | microk8s             [K8s itself]
└── ace install <any OS-level packages>              [via Ace's per-platform back-ends OR DLC packages]

Stage 2 — orchestration / reconciliation (driven by tools Ace installed)
├── ansible/playbooks/*.yml  → ansible-pull          [host-side declarative state]
│   └── ace install <pkg> in playbook tasks         [unified package layer per host]
├── k8s/applications/*.yaml  → ArgoCD                [K8s workload reconciliation]
└── crossplane/*.yaml        → Crossplane            [external API reconciliation]
```

The KEY architectural insight: **Stage 0 + Stage 1 reduce "cross-OS setup" to a single concern — get Ace on the host.** Everything else flows from `ace install`. This dramatically simplifies the iter-7 implementation arc compared to my initial three-peer-layer draft.

### Implications

| Concern | Before (3-peer-layer draft) | After (Ace-as-foothold) |
|---|---|---|
| Bootstrap | install.sh per OS (macos.sh/linux.sh/win.ps1) — each with full manifest of tools | Minimal install.sh per OS that installs ONLY Ace |
| Ongoing package state | ansible playbooks invoke OS-native package manager (brew/apt/choco) per platform | ansible playbooks invoke `ace install <pkg>` uniformly across OSes |
| ArgoCD installation | Manual / per-platform helm install | `ace install argocd` (same on every OS) |
| K8s installation | Manual / per-platform kubeadm-or-k3s | `ace install k3s` (same on every OS) |
| Crossplane installation | helm chart per cluster | `ace install crossplane` (same on every cluster) |
| Implementation order | iter-7 needs ansible + ace + manifests + ArgoCD + Crossplane simultaneously | iter-7 critical path = land Ace (081KR2E4K0008QG0R002YE3MMD), then everything else delegates |

### Composes with 081KR2E4K0008QG0R002YE3MMD (in-progress)

081KR2E4K0008QG0R002YE3MMD is the load-bearing dependency. The iter-7 architectural arc fundamentally waits on Ace being mature enough to install:

- OS-level packages (Ace as front-end to brew/apt/choco OR Ace-DLC packages directly)
- Helm charts (Ace front-end to helm)
- Standalone binaries (curl + verify + install — the existing Ace DLC shape)
- K8s manifests / kustomize / argocd-app-of-apps

This expands 081KR2E4K0008QG0R002YE3MMD's scope substantially. Today's 081KR2E4K0008QG0R002YE3MMD in-progress definition (`tools/ace/` with install/verify/list, content-addressed signed packages) is the FOUNDATION; the "package manager of package managers" expansion is iter-7 substrate-engineering work that builds on top.

Sub-target 1 (macOS) + sub-target 2 (Windows) re-shape:

- macOS playbook → tasks all delegate to `ace install <pkg>`; Ace's macOS backend uses brew under the hood OR Ace-native packages OR mise OR direct binary install per package's declared distribution mode
- Windows playbook → same shape; Ace's Windows backend uses Chocolatey/Scoop/Winget under the hood OR Ace-native OR direct binary install
- Sub-target 3 (Crossplane bootstrap) → `ace install crossplane` instead of ArgoCD app + helm chart — same architectural shape
- Sub-target 4 (non-NixOS Linux) → `ace install <pkg>` with apt/dnf/pacman backends

The architectural simplification means iter-7 sub-targets become THIN — each platform's substrate is "install Ace + write the host-specific playbook that delegates everything to Ace." Heavy lifting consolidates into 081KR2E4K0008QG0R002YE3MMD's expansion.

### Substrate-honest open question

Does iter-5.x USB substrate (`zeta-install.sh`) install Ace? Today: probably not (need to verify). If iter-7 critical path is "Ace on every host," then iter-5.x USB substrate should install Ace as part of node bootstrap. This is a substrate gap worth filing as a sibling row when iter-7 work begins — possibly via a NEW iter-5.5 (`B-NNNN`): "install Ace as part of USB-installer node bootstrap so cluster nodes have the foothold from day-one."

## Crossplane composition (the maintainer's "it's like cross plane too kinda" catch)

Crossplane is K8s-native infrastructure management: define external resources as K8s CRDs; a Crossplane controller reconciles them against cloud / on-prem APIs.

```yaml
apiVersion: storage.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: zeta-cluster-state-backup
spec:
  forProvider:
    region: us-east-1
    objectLockConfiguration:
      objectLockEnabled: Enabled
```

ArgoCD reconciles this CR; Crossplane provisions the bucket; state in git = state in cloud.

**Fit for Zeta**: HIGH — extends our existing ArgoCD substrate to cover external infrastructure without adding a second control plane:

- Same git-as-source-of-truth pattern
- Same K8s CRD reconciliation pattern ArgoCD already operates
- Covers cloud + on-prem APIs (AWS, GCP, Azure, BIND DNS, Vault, etc.) declaratively
- Composes with cluster-update arc (081KSGS9H0008QG0R001EKTS5A–081KSGS9H0008QG0R002BC2ZR7) for the cluster substrate
- Composes with Ansible+ansible-pull for OS-config substrate

**Recommendation: Crossplane is the right answer for cluster-external infrastructure** (DNS, cloud resources, certificate authorities, etc.) — wherever an API-driven external system needs to mirror git state.

## Combined architectural shape

```text
git (single source of truth)
│
│ Stage 0 — minimal bootstrap-the-bootstrap (one-liner per OS):
│   installs Ace package manager (081KR2E4K0008QG0R002YE3MMD)  [foothold; one-time per host]
│
│ Stage 1 — Ace as "package manager of packages managers" (canonical per
│   Ace agenda; the maintainer 2026-05-26 restated: "once ace gets a
│   foothold it can do most everything else from there"):
│   ace install ansible | argocd | crossplane | k3s | nixos-rebuild | <any>
│
│ Stage 2 — orchestration / reconciliation (driven by tools Ace installed):
├── ansible/playbooks/  → ansible-pull (or AnsibleJob via Operator)
│       └── delegates package state to `ace install <pkg>` uniformly per host
├── k8s/applications/   → ArgoCD             → K8s workloads
├── nixos/flake.nix     → system.autoUpgrade → nixos-rebuild switch (NixOS cluster nodes)
└── crossplane/         → Crossplane         → external APIs
```

The KEY architectural insight (the maintainer 2026-05-26 surfaced after my initial 3-peer-layer draft): **Ace is the meta-package-manager**. Stage 0 + Stage 1 reduce the cross-OS setup problem to "get Ace on the host"; everything else flows from `ace install`. ArgoCD + Crossplane + ansible + K8s itself are all installable via Ace once it has the foothold. Composes with [`m-acc-multi-oracle-end-user-moral-invariants.md`](../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) multi-oracle pattern at the substrate-class scope (each reconciler oracles one substrate domain, BUT they were ALL installed by Ace).

## Target

This is **iter-7 scope** (post-iter-6 cluster-update arc). Sub-targets are large enough each warrants its own sibling row when ready:

### Sub-target 1 — `ansible-pull` substrate for macOS (081KSGS9H0008QG0R001K8P0FJ, future)

`tools/ansible/playbooks/macos.yml` declares state for macOS dev workstations. Bootstrap via one-liner in `tools/setup/macos.sh` that installs the ansible-pull cron entry. Covers: dotfiles, dock layout, login items, system preferences, default applications, ssh config, security settings, mise config.

Composes with existing `tools/setup/macos.sh` rather than replacing it — install.sh handles bootstrap (brew + ansible itself); ansible-pull handles ongoing declarative state.

### Sub-target 2 — `ansible-pull` substrate for Windows (081KSGS9H0008QG0R00287K8FR, future)

`tools/ansible/playbooks/windows.yml` declares state for Windows hosts. Bootstrap via PowerShell script that installs ansible-pull via WSL OR uses native Windows ansible (via OpenSSH-Server). Covers: Chocolatey/Scoop packages, registry settings, scheduled tasks, services, file associations.

NEW substrate — no Windows path exists today. Opens Zeta to Windows-running maintainers (the maintainer 2026-05-26 explicit ask).

### Sub-target 3 — Crossplane bootstrap as ArgoCD app (081KSGS9H0008QG0R001HC663P, future)

`full-ai-cluster/k8s/applications/crossplane.yaml` declares the Crossplane control plane as an ArgoCD-managed app. Adds CRDs for the providers we use (AWS, GCP, etc.). Composes with iter-6 cluster substrate.

### Sub-target 4 — non-NixOS Linux `ansible-pull` substrate (081KSGS9H0008QG0R002CY8Q24, future)

Same shape as macOS sub-target. Covers Debian/Ubuntu/Fedora/Arch dev laptops + bare-metal Linux that's not a cluster node.

### Sub-target 5 — Idempotency + dep-pin discipline encoding

Per [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md): ansible playbooks AND Crossplane provider versions need the same WebSearch-current-version-pin discipline. Add ansible-galaxy collection versions + Crossplane provider versions to the audit tool's scope when sub-target 1+3 implement.

## Acceptance (at the iter-7 capstone scope)

- [ ] Sub-target 1 (macOS ansible-pull) shipped via sibling B-NNNN
- [ ] Sub-target 2 (Windows ansible-pull) shipped via sibling B-NNNN
- [ ] Sub-target 3 (Crossplane bootstrap) shipped via sibling B-NNNN
- [ ] Sub-target 4 (non-NixOS Linux) shipped via sibling B-NNNN
- [ ] Combined architectural shape diagram (`docs/architecture/cross-os-declarative.md`) documents the 4-reconciler composition
- [ ] One worked-example showing end-to-end "commit → ansible-pull picks it up → host state changes" demonstrated empirically

## Out of scope

- Replacing existing NixOS substrate with Ansible (NixOS is strictly more declarative; keep it for cluster nodes)
- Replacing existing ArgoCD with anything (it's the K8s reconciler; Ansible/Crossplane are complementary)
- Replacing existing install.sh (it remains the bootstrap layer; ansible-pull is the ONGOING-state layer)
- Centralized AAP (per Pattern 2 rejection above — commercial dependency)
- Centralized Ansible Tower (same shape; rejected)

## Design questions for the maintainer

Before sub-target 1 begins:

1. **Pull cadence**: cron every 15min? Hourly? On-demand? (NixOS autoUpgrade is weekly; ansible may want faster for dotfiles iteration)
2. **Branch model**: which git branch does each host pull from? `main` always, OR per-host branches for canary testing?
3. **Secret handling**: Ansible playbooks for OS config often reference secrets (ssh keys, API tokens). How are those injected? (ansible-vault + key in CI? sops? per-host secret-fetch from secret-manager?)
4. **Bootstrapping the bootstrap**: install.sh needs to install ansible. Do we add ansible to the brew/apt manifests, or use a vendored ansible binary, or a separate one-time installer?
5. **State observability**: how does the operator see which hosts are in-sync vs drifting? (Prometheus exporter? ansible-pull --check + report to git? dashboard?)
6. **Conflict handling**: what happens if a host can't reach the declared state (network down, hardware fault)? Retry forever, OR alert + halt?

These are sub-target-blocking design decisions; the iter-7 implementation arc starts after the maintainer's picks land.

## Composes with

- **[081KR2E4K0008QG0R002YE3MMD](../P1/081KR2E4K0008QG0R002YE3MMD-ace-dlc-package-manager-cli-2026-05-08.md)** (in-progress) — Ace DLC package manager; the cross-OS package layer that ansible-pull/Operator invokes per the maintainer 2026-05-26 architectural clarification. Ansible orchestrates, Ace installs.
- [081KSGS9H0008QG0R0027HJZYH](../P1/081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md) — homelab gh-auth device-flow enables hosts to authenticate to git for the pull side
- [081KSGS9H0008QG0R001EKTS5A](081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — nixpkgs bump precedes any ansible-on-NixOS work (rare; cluster nodes stay NixOS-native)
- [081KSGS9H0008QG0R002T6J6FS](../P2/081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — `system.autoUpgrade` is the analog pattern at NixOS-cluster scope; ansible-pull is the analog at heterogeneous-OS scope
- [081KSGS9H0008QG0R00280HHA7](../P2/081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — deploy-rs is the K8s-deploy-style; this row is the OS-deploy-style; both compose
- [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) — ansible collection version + Crossplane provider version pins need the same WebSearch discipline
- [`.claude/rules/dep-pin-search-first-authority.md`](../../.claude/rules/dep-pin-search-first-authority.md) — implementation-time discipline for ansible-galaxy / Crossplane provider version pinning
- [`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`](../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) — multi-oracle pattern applied at substrate-class scope (ArgoCD + NixOS + Ansible + Crossplane each oracle one substrate domain)

## Sources

- The maintainer 2026-05-26 source paste — three Ansible+GitOps patterns table
- [Crossplane Documentation](https://www.crossplane.io/) — current latest stable (verify per [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) at implementation time)
- [Ansible Documentation](https://docs.ansible.com/) — `ansible-pull` reference
- [Red Hat Ansible Automation Platform](https://www.redhat.com/en/technologies/management/ansible) — commercial Pattern-2 reference (rejected for cost)
- [AWX (open-source AAP)](https://github.com/ansible/awx) — Pattern-2 OSS alternative if needed later

## Substrate-honest framing

This is iter-7 scope; landing the row now captures the architectural direction + the maintainer's pull while iter-6 cluster-update arc is still queued. Sub-targets file as separate rows when work begins.

The combined 4-reconciler shape (ArgoCD + NixOS + Ansible + Crossplane) is the right end-state for "everything in git, AI-managed declaratively"; this row is the iter-7 capstone that captures that shape + decomposes into implementation sub-targets.

NOT a directive per [`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md) — the maintainer's pick on Pattern 1/2/3 (recommendation: Pattern 3 `ansible-pull`) AND the cadence/branch/secret design questions all stay with the operator. This row articulates options + recommendation; the operator integrates.
