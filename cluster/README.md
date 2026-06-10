# cluster/ — the zetacluster (k8s + ArgoCD GitOps + cert-manager/Let's Encrypt), at root

`cluster/` holds the **zetacluster** — our **Kubernetes** deployment plane, run **GitOps via ArgoCD**
(declarative desired-state in git → ArgoCD converges the cluster; the close-over-everything discipline at
the infra layer). A root-level folder. **Max owns/deploys it.**

## What's on it (deployed — Max)

- **ArgoCD** — GitOps controller (the repo is the source of truth; ArgoCD syncs the cluster to it).
- **cert-manager + Let's Encrypt (ACMEv2)** — automated TLS certificates for the domain (our own automated
  cert authority on top of LE) — part of **our own PKI**.
- **HashiCorp Vault** — *coming next* (Max): the **corporate** secret-plane. Two planes meet in the middle:
  **corporate = keys-in-Vault** (Max), **research = keys-in-git** (us, sealed by our keyring); bridged.
- (the home-crypto-mining fleet, the MyNode nodes, and Zeta services land here over time — `hats/home-crypto-miner/`,
  `updates/`, `triggers/`.)

## Network plane — Reticulum + Headscale (Aaron)

We use **Reticulum** (our sovereign ZetaId-addressed overlay; `network/`) **and Headscale** (self-hosted
Tailscale/WireGuard control — our own, not the SaaS) for the cluster + fleet mesh. Both are **self-hosted /
sovereign** (the close-over-everything stance applied to networking): Reticulum for the agent/bus overlay,
Headscale for the WireGuard equipment mesh. (Not Tailscale-the-SaaS — Headscale, self-run.)

## Discipline

- **GitOps / declarative** — cluster state is declared in the repo (manifests), ArgoCD realizes it; same as
  `install.sh` realizing declared deps. No imperative `kubectl apply` drift.
- **Security by clarity** — manifests in the open; secrets are **sealed by our keyring/PKI** and committed
  (the encrypted null), not hidden. (Our own PKI — persona keyrings + cert-manager/LE; GitHub+FIDO trust root.)

## Pointers

- `network/` (Reticulum overlay) · `dns/` (resolution) · `hats/home-crypto-miner/` + the home-crypto-mining
  skill group · `updates/` + `triggers/` · the keyring/PKI standards (`docs/research/2026-06-09-keyring-critical-infra-*`,
  `…persona-keyrings-*`).
