---
id: 081M0H19QD3087G0R003GV76ZY
type: bug
state: backlog
priority: P2
slug: vault-is-argocd-sole-owned-but-three-preconditions-are-unmet
title: "Vault is ArgoCD-sole-owned but three preconditions are unmet: node count for raft quorum, longhorn storageClass ordering, unpassable readiness probe"
created: 2026-08-21T02:09:47.939Z
depends_on: []
composes_with: []
---

# Vault is ArgoCD-sole-owned but three preconditions are unmet: node count for raft quorum, longhorn storageClass ordering, unpassable readiness probe

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0H19QD3087G0R003GV76ZY-*.md` glob. -->

## Context

Dual ownership of Helm release `vault` (namespace `vault`) was resolved on
2026-08-20 by making `full-ai-cluster/k8s/applications/vault/Application.yaml`
the sole owner and deleting the former `vault-install.yaml` bootstrap manifest
plus its `vault-install.source` entry in
`full-ai-cluster/nixos/modules/k3s-server.nix`.

That fix stopped the active harm — two `selfHeal: true` reconcilers rewriting
Vault's storage stanza between `storage "file"` and `storage "raft"` on every
pass. It did NOT make Vault come up. Three preconditions remain unmet, all
measured by local `helm template` at chart `vault-0.29.1`, nothing applied to
any cluster.

## The three

1. **Raft quorum needs >= 3 nodes.** `server.ha.replicas: 3` renders a
   StatefulSet with podAntiAffinity
   `requiredDuringSchedulingIgnoredDuringExecution`, topologyKey
   `kubernetes.io/hostname` (chart default). On a single-node control plane
   exactly one of three pods schedules; the other two are Pending forever and a
   3-member raft never reaches 2/3 quorum, so Vault never unseals.
   `replicas` is deliberately left at 3 — it is the intended end state, and
   lowering it to 1 would discard the raft design without a decision. Either
   join >= 3 nodes (`full-ai-cluster/nixos/modules/k3s-agent.nix`) or make the replica count an
   explicit, recorded single-node decision.

2. **`storageClass: longhorn` does not exist until sync-wave -15.** Vault sits
   at sync-wave -60 and its `dataStorage`/`auditStorage` pin `longhorn`, which
   the longhorn Application installs 45 waves later. ArgoCD retries, so this
   converges rather than deadlocks, but the PVCs are Pending in the interim.
   Options: move Vault later, move longhorn earlier, or pin Vault to
   `zeta-local-path` (provided by `full-ai-cluster/nixos/modules/local-storage.nix`, so it
   exists at boot) and accept node-local storage.

3. **The readiness probe cannot pass.** The render sets `tls_disable = 1` — a
   plaintext listener — while `VAULT_ADDR` is `https://127.0.0.1:8200` and the
   probe runs `vault status -tls-skip-verify`. That flag skips certificate
   VERIFICATION, not the TLS handshake, so an https client against a plaintext
   listener fails regardless. Either set `global.tlsDisable: true` and an http
   `VAULT_ADDR`, or terminate real TLS (there are zero `kind: Certificate`
   resources in the tree today, so the "Vault TLS certs come from cert-manager"
   claim that used to sit in the bootstrap header was also false).

## Falsifier

The live kind/k3s lane (`.github/workflows/k8s-argocd-health-test.yml`) going
green on a Vault that reaches Ready. `src/Core.TypeScript/cluster/argocd-health-test.ts`
already registers "Vault upstream CA ... not ready" as a known shadow.

## Not in scope here

The other six dual-owned charts (cilium, spire, argo-cd, trust-manager,
external-secrets, cert-manager). Vault was fixed alone because it is the only
one with ACTIVE data loss.
