---
id: B-0806
priority: P2
status: open
title: Ansible+GitOps + Crossplane composition — cross-OS declarative management for Windows + Macs + non-NixOS Linux; extends GitOps reach beyond K8s manifests + NixOS flake.nix to the heterogeneous OS substrate the maintainer actually runs
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - B-0288
  - B-0794
  - B-0800
  - B-0801
  - B-0803
  - B-0805
tags: [ansible, gitops, crossplane, cross-os, windows, macos, declarative-management, full-stack-orchestration, ansible-pull, agentless, idempotent, multi-host, single-source-of-truth, iter-7]
---

## Problem

The maintainer 2026-05-26: *"This is good for declarative oses other than nix like id love to have it setup my windows machines and macs. ansible gitops"* + *"it's like cross plane too kinda"*

Today's substrate covers:

- **NixOS** (cluster nodes): declarative via `full-ai-cluster/flake.nix` + `nixos-rebuild switch`; iter-6.x cluster-update arc (B-0800–B-0805) automates within-channel + cross-channel updates
- **macOS** (dev laptops, maintainer's primary Mac): imperative via `tools/setup/macos.sh` → Homebrew + mise; idempotent + auto-updating per [B-0805](B-0805-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) discipline but NOT declaratively-driven from git
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

**Fit for Zeta**: HIGH (the maintainer 2026-05-26 clarification: *"we are alwasy going to have k8s i don't mind the coupling but we can support both"*). K8s is always present in Zeta's substrate (the `full-ai-cluster/` is the cluster substrate; not optional). Operator-pattern coupling is therefore not a rejection criterion. Remaining concern is SSH/WinRM access from cluster pods to the operator's heterogeneous machines — iter-5.4 [B-0794](B-0794-iter-5-4-homelab-gh-auth-login-device-flow-zeta-cluster-node-registration-into-github-no-shipped-keys-aaron-mika-2026-05-26.md) homelab gh-auth + tailscale-equivalent unlock this. Pattern 1 + Pattern 3 can BOTH ship; pick per use case (Operator for cluster-orchestrated workstation config; ansible-pull for fully-disconnected/edge hosts).

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

- Same shape as NixOS `system.autoUpgrade` (B-0801): host pulls from git + reconciles to declared state
- Same shape as the proposed iter-5.4 (`B-0794`) homelab-first gh-auth device-flow: nodes self-register + self-pull
- No commercial dependency
- No central orchestrator needed
- Works on macOS, Windows (via WSL or native), and any Linux distro out of the box
- Composes with our agent-discipline rules per [B-0805](B-0805-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) (idempotent playbooks; declarative state; same git-as-source-of-truth)

**Recommendation: support BOTH Pattern 1 (Operator) AND Pattern 3 (`ansible-pull`)** per the maintainer 2026-05-26: *"we are alwasy going to have k8s i don't mind the coupling but we can support both"*. Operator-pattern for cluster-orchestrated workstation reconciliation (the maintainer's workstations reachable from cluster); ansible-pull for fully-disconnected / edge hosts where the cluster can't reach in. Pattern 2 (commercial AAP) stays rejected on cost.

## Composition with Ace package manager (B-0288)

The maintainer 2026-05-26 additional clarification: *"it would be ansible combined with ace package manager ../scratch install.sh like setup for those oses and our declarative package management"*.

Ansible+GitOps is the **orchestration / reconciliation layer**; it doesn't replace the **package layer** Zeta is building separately:

- **[B-0288](../P1/B-0288-ace-dlc-package-manager-cli-2026-05-08.md)** (in-progress) — Ace DLC package manager CLI (`tools/ace/`) with install/verify/list, content-addressed signed packages, guardian AI oversight. The cross-OS package layer Zeta uses INSTEAD of (or composing with) Homebrew/apt/Chocolatey/Scoop per-platform package managers.
- **[`tools/setup/install.sh` + manifests](../../tools/setup/manifests/)** — the existing install.sh-style declarative manifest pattern (brew + apt today; extends to ace + nix + win-equivalent).

The combined layering:

```
git (single source of truth)
└── ansible/playbooks/*.yml                  [orchestration / reconciliation]
    invokes →
    Ace package manager (B-0288)             [cross-OS package layer]
    reads →
    install.sh-style manifests               [declarative source]
    (tools/setup/manifests/{brew,apt,ace,…})
```

ansible-pull (or AnsibleJob-via-Operator) on each host runs `ace install <package>` per the manifest declaration. install.sh stays as the bootstrap-the-bootstrap layer (it installs ansible + ace itself); ansible+ace handle the ongoing-state layer.

This composition means: **the cross-OS substrate isn't ansible-only — it's ansible+ace+manifests**. Ansible reconciles; Ace installs; manifests declare. Each layer has one job.

The Ace DLC packaging substrate composes onward into the Windows + macOS sub-targets (sub-targets 1 + 2 below): each platform's ansible playbook delegates `package: { name: X, state: present }` to Ace rather than to platform-specific package managers, unifying the package-layer story.

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
- Composes with cluster-update arc (B-0800–B-0805) for the cluster substrate
- Composes with Ansible+ansible-pull for OS-config substrate

**Recommendation: Crossplane is the right answer for cluster-external infrastructure** (DNS, cloud resources, certificate authorities, etc.) — wherever an API-driven external system needs to mirror git state.

## Combined architectural shape

```
git (single source of truth)
├── k8s/applications/                   → ArgoCD                  → K8s workloads
├── nixos/flake.nix                     → system.autoUpgrade      → nixos-rebuild switch
├── ansible/playbooks/                  → ansible-pull (or Operator)
│   └── invokes Ace package manager (B-0288) [cross-OS package layer]
│       └── reads tools/setup/manifests/*    [install.sh-style declarative source]
└── crossplane/                         → Crossplane (via ArgoCD) → external APIs
```

Four reconcilers, each idempotent + agentless from-git's-perspective, all sharing the same source-of-truth. The ansible-pull branch has an internal three-layer composition (orchestration → package-layer → manifest-source) per the maintainer 2026-05-26: "ansible combined with ace package manager + install.sh-like setup + declarative package management". Composes with [`m-acc-multi-oracle-end-user-moral-invariants.md`](../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) multi-oracle pattern at the substrate-class scope.

## Target

This is **iter-7 scope** (post-iter-6 cluster-update arc). Sub-targets are large enough each warrants its own sibling row when ready:

### Sub-target 1 — `ansible-pull` substrate for macOS (B-0807, future)

`tools/ansible/playbooks/macos.yml` declares state for macOS dev workstations. Bootstrap via one-liner in `tools/setup/macos.sh` that installs the ansible-pull cron entry. Covers: dotfiles, dock layout, login items, system preferences, default applications, ssh config, security settings, mise config.

Composes with existing `tools/setup/macos.sh` rather than replacing it — install.sh handles bootstrap (brew + ansible itself); ansible-pull handles ongoing declarative state.

### Sub-target 2 — `ansible-pull` substrate for Windows (B-0808, future)

`tools/ansible/playbooks/windows.yml` declares state for Windows hosts. Bootstrap via PowerShell script that installs ansible-pull via WSL OR uses native Windows ansible (via OpenSSH-Server). Covers: Chocolatey/Scoop packages, registry settings, scheduled tasks, services, file associations.

NEW substrate — no Windows path exists today. Opens Zeta to Windows-running maintainers (the maintainer 2026-05-26 explicit ask).

### Sub-target 3 — Crossplane bootstrap as ArgoCD app (B-0809, future)

`full-ai-cluster/k8s/applications/crossplane.yaml` declares the Crossplane control plane as an ArgoCD-managed app. Adds CRDs for the providers we use (AWS, GCP, etc.). Composes with iter-6 cluster substrate.

### Sub-target 4 — non-NixOS Linux `ansible-pull` substrate (B-0810, future)

Same shape as macOS sub-target. Covers Debian/Ubuntu/Fedora/Arch dev laptops + bare-metal Linux that's not a cluster node.

### Sub-target 5 — Idempotency + dep-pin discipline encoding

Per [B-0805](B-0805-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md): ansible playbooks AND Crossplane provider versions need the same WebSearch-current-version-pin discipline. Add ansible-galaxy collection versions + Crossplane provider versions to the audit tool's scope when sub-target 1+3 implement.

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

- **[B-0288](../P1/B-0288-ace-dlc-package-manager-cli-2026-05-08.md)** (in-progress) — Ace DLC package manager; the cross-OS package layer that ansible-pull/Operator invokes per the maintainer 2026-05-26 architectural clarification. Ansible orchestrates, Ace installs.
- [B-0794](B-0794-iter-5-4-homelab-gh-auth-login-device-flow-zeta-cluster-node-registration-into-github-no-shipped-keys-aaron-mika-2026-05-26.md) — homelab gh-auth device-flow enables hosts to authenticate to git for the pull side
- [B-0800](B-0800-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — nixpkgs bump precedes any ansible-on-NixOS work (rare; cluster nodes stay NixOS-native)
- [B-0801](../P2/B-0801-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — `system.autoUpgrade` is the analog pattern at NixOS-cluster scope; ansible-pull is the analog at heterogeneous-OS scope
- [B-0803](../P2/B-0803-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — deploy-rs is the K8s-deploy-style; this row is the OS-deploy-style; both compose
- [B-0805](B-0805-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) — ansible collection version + Crossplane provider version pins need the same WebSearch discipline
- [`.claude/rules/dep-pin-search-first-authority.md`](../../.claude/rules/dep-pin-search-first-authority.md) — implementation-time discipline for ansible-galaxy / Crossplane provider version pinning
- [`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`](../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) — multi-oracle pattern applied at substrate-class scope (ArgoCD + NixOS + Ansible + Crossplane each oracle one substrate domain)

## Sources

- The maintainer 2026-05-26 source paste — three Ansible+GitOps patterns table
- [Crossplane Documentation](https://www.crossplane.io/) — current latest stable (verify per [B-0805](B-0805-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) at implementation time)
- [Ansible Documentation](https://docs.ansible.com/) — `ansible-pull` reference
- [Red Hat Ansible Automation Platform](https://www.redhat.com/en/technologies/management/ansible) — commercial Pattern-2 reference (rejected for cost)
- [AWX (open-source AAP)](https://github.com/ansible/awx) — Pattern-2 OSS alternative if needed later

## Substrate-honest framing

This is iter-7 scope; landing the row now captures the architectural direction + the maintainer's pull while iter-6 cluster-update arc is still queued. Sub-targets file as separate rows when work begins.

The combined 4-reconciler shape (ArgoCD + NixOS + Ansible + Crossplane) is the right end-state for "everything in git, AI-managed declaratively"; this row is the iter-7 capstone that captures that shape + decomposes into implementation sub-targets.

NOT a directive per [`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md) — the maintainer's pick on Pattern 1/2/3 (recommendation: Pattern 3 `ansible-pull`) AND the cadence/branch/secret design questions all stay with the operator. This row articulates options + recommendation; the operator integrates.
