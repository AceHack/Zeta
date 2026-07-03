---
id: 081KVNMFYS808QG0R002D0VM64
type: task
state: backlog
priority: P1
slug: self-host-open-source-secret-manager-vaultwarden-bitwarden-s
title: "Self-host open-source secret manager (Vaultwarden/Bitwarden Secrets Manager or Infisical) via ArgoCD as the open-source complement to 1Password on the private-key-custody path → Vault/cert-manager (Aaron 2026-06-21)"
created: 2026-06-21T17:43:43.656Z
depends_on: []
composes_with: ["081KSGS9H0008QG0R003A37Z65", "081KSXN940008QG0R000SCP2H1"]
---

# Self-host open-source secret manager (Vaultwarden/Bitwarden Secrets Manager or Infisical) via ArgoCD as the open-source complement to 1Password on the private-key-custody path → Vault/cert-manager (Aaron 2026-06-21)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KVNMFYS808QG0R002D0VM64-*.md` glob. -->

## Carved sentence

> The private-key custody path has two lanes: **1Password** (proprietary, Aaron is
> adopting it now — `op` CLI + service accounts + the SSH agent that signs without
> exposing private bytes) AND a **self-hosted open-source** secret manager
> (Vaultwarden / Bitwarden Secrets Manager / Infisical) deployed **via ArgoCD**, so
> custody isn't single-vendor and the cluster owns its own secret store. Both are the
> *bootstrap* of the same model that **HashiCorp Vault + cert-manager** become later
> (same trust shape, upgraded custody) — per the decision doc.

## Problem / Why

Private-key custody (CA private key + machine keys) is the open thread from the
key-onboarding work (Aaron 2026-06-21). Today the CA private key is a local mode-600
file. Decision (`docs/DECISIONS/2026-06-21-multi-owner-machines-identity-vs-authorization-ssh-ca-bootstrap.md`):
**don't hand-roll custody/rotation — that's Vault/cert-manager's job.** Interim, a
secret manager holds the keys and (ideally) serves them via an **SSH agent** that signs
on demand so the private bytes never leave the vault.

Two lanes, both wanted:

- **1Password** (proprietary) — adopted now for Aaron↔Otto password/secret sharing via a
  **scoped service account** (least-privilege, specific items — NOT the whole vault) and
  for SSH-agent-backed key custody. (Tracked separately; Aaron is setting it up.)
- **Open-source + self-hosted (THIS item)** — so the cluster isn't dependent on a SaaS
  vendor for its trust root. **Vaultwarden** (lightweight Bitwarden-compatible server),
  **Bitwarden Secrets Manager** (`bws` machine accounts), or **Infisical** — pick one,
  deploy via **ArgoCD** (maximize-ArgoCD-scope principle [[081KSGS9H0008QG0R003A37Z65]]),
  on any K8s (portable, not NixOS-locked).

**Anti-pattern explicitly rejected (Aaron+Otto 2026-06-21):** storing the CA private key
as a GitHub secret recovered via `base64` print in a workflow. base64 is encoding not
encryption; printing defeats secret-masking and lands the key in logs in recoverable
form — a trust-root leak. A GitHub Actions secret *consumed in-step, never printed* is
acceptable for CI; `base64 print` is not.

## Scope (this item)

1. Pick the OSS secret manager (Vaultwarden / Bitwarden SM / Infisical) — decision note.
2. ArgoCD app (Helm/Kustomize) to deploy + manage it (GitOps, portable K8s).
3. Hosting / persistence / backup plan (the store itself needs durable, encrypted state).
4. SSH-agent or signing integration so private keys sign-without-exposing.
5. Migration note: this OSS store + 1Password → **Vault custody + cert-manager issuance/
   rotation** later (same trust model, no redesign).

## Trajectory + composes-with

- Trajectory: **cluster-encryption-credential-substrate**
  (`docs/trajectories/cluster-encryption-credential-substrate/RESUME.md`) — this is the
  concrete secret-store lane of that workstream.
- Composes: maximize-ArgoCD-scope principle (081KSGS9H0008QG0R003A37Z65); ArgoCD/k8s
  integration (081KSXN940008QG0R000SCP2H1).
- Anchors: HashiCorp Vault SSH secrets engine; Jetstack cert-manager; 1Password SSH agent
  / service accounts; Bitwarden/Vaultwarden; Infisical. Decision doc
  `docs/DECISIONS/2026-06-21-multi-owner-machines-identity-vs-authorization-ssh-ca-bootstrap.md`.
