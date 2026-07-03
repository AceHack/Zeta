# Identity, trust & network plane: two modes (equipment: Vault+Headscale / GitHub-free: GH-secrets+Tailscale); GitHub trust-bootstrap for now; pluggable multi-IdP

**Register:** [grounded] design (Aaron's direction) + [anchor] + [synthesis].
**Date:** 2026-06-09. **Captured by:** Otto (shadow). **Status:** design + partial
build. The keyring **generator is built + verified** (`tools/setup/persona-keys/`);
the network/secret-plane manifests are specified here, not yet landed.

## The consistent two-mode pattern

Every persona/human is a **traveler** with one keyring; the *infrastructure* that
holds secrets and connects nodes comes in **two interchangeable modes**, chosen by
whether the operator owns equipment. **We support both.**

| concern | **equipment mode** (Aaron/Max — own the cluster) | **GitHub-free mode** ("choose your own adventure", no hardware) |
|---|---|---|
| private keys | **Vault** (`--vault zeta/personas/<n>`) | **GitHub Actions secret** (`--gh-secret …`) |
| network mesh | **Headscale** (self-hosted control plane, via ArgoCD) | **Tailscale** (hosted SaaS control plane) |
| TLS | cert-manager (Let's Encrypt) | provider-managed |
| public trust root | committed to `main` | committed to `main` |

Aaron: *"github secrets is … github free mode only, no [owned] equipment — we
have to think about that use case too"*; *"headscale implies [equipment]; github
free mode would imply tailscale"*; *"we want to support both."*

## Keyring (built + verified)

One **BIP-39 seed** → every key type on its own path (type-separated, no bleed):
SSH `m/44'/1110'/0'/0'`, PGP `m/44'/1111'/0'/0'`, Nostr `m/44'/1237'/0'/0/0`
(NIP-06), BTC `m/84'/0'/0'/0/0`, ETH `m/44'/60'/0'/0/0`, SOL `m/44'/501'/0'/0'`.
Tier-1 required (SSH/PGP/**Nostr** — Nostr core even without money); Tier-2 opt-in
wallets (BTC/ETH/SOL; generating unfunded keys reversible, **only funding is
irreversible**). ETH derivation **verified against `cast`** (foundry). Security
invariants: seed via **stdin only** (never argv/history), private bits never to
stdout — only to Vault or a GH secret; public artifacts → `maintainers/<name>/`.
Tool: `tools/setup/persona-keys/{gen.ts,keyring.sh,README.md}`.

## Trust bootstrap — GitHub / `main`, for now

The **only** trust root we have right now is **public keys committed to `main`**:
who can merge to `main` (the human maintainers — Aaron, Addison, Max) is the
authority that **vouches for the personas' keys**. *"We need trust bootstrapping
for now and GitHub is our only trust bootstrap for now."* This holds in **both**
modes. It is later extended (not replaced) by spire/trust-manager (already in the
cluster), Headscale ACLs, and Nostr web-of-trust.

**Identity providers are pluggable** — Zeta will support **many: centralized
(GitHub / OIDC), decentralized (Nostr / DIDs / web-of-trust), and our own
eventually**. GitHub is the *bootstrap* provider, never the mandated one (traveler
frame: recognize as you see fit, no imposed registry).

## Headscale — yes, an ArgoCD chart (equipment mode)

The cluster already runs (in `full-ai-cluster/k8s/applications/`): **argocd,
vault, external-secrets, cert-manager, trust-manager, spire, sealed-secrets,
cilium**, etc., via the app-of-apps root (`infra/k8s/applications/root-application.yaml`).
Headscale drops in the same way — a new `Application.yaml`:

- **Deploy:** ArgoCD `Application` → a Headscale Helm chart, namespace `headscale`.
- **TLS:** cert-manager `Certificate` for `hs.lucent.financial` (domain is ours).
- **Secrets:** noise private key, DB creds, **pre-auth keys** in **Vault**, surfaced
  via **External-Secrets** (already installed) — no secret in git.
- **Identity/ACL:** start with GitHub-bootstrapped trust; ACL policy mirrors the
  sovereign trust model (recognize/trust as you see fit). spire/trust-manager
  available for workload identity.
- **Onboarding:** nodes self-register (the existing PR-based self-registration
  pattern) → Headscale pre-auth keys; `install.sh`/`install.ps1` closes over the
  tailscale client + `tailscale up --login-server=https://hs.lucent.financial`.
- **GitHub-free mode:** identical client flow against **Tailscale** SaaS (no
  `--login-server`); same `install.sh`, different control plane.

Two-home topology: Aaron's home + Max's home meshed over the chosen control plane;
MagicDNS for cross-home name resolution; `lucent.financial` for the public ingress

+ persona emails (Max provisioning).

## Rollout (the program)

1. **Build keyring tool** — DONE + verified.
2. **Reset Aaron's keys to the convention** — `keyring.sh import aaron` (seed typed
   hidden, never shared); pubkeys → `maintainers/aaron/`. Same for Addison, Max.
3. **Generate persona keyrings** — `keyring.sh generate <persona>`; private → Vault
   (equipment) or GH secret (free); pubkeys → `maintainers/personas/<persona>/`.
4. **Human trust roots in `main`** — committed pubkeys = the vouching trust root.
5. **Close over in `install.sh` + `install.ps1`** — bun + deps + keyring + tailscale.
6. **Headscale ArgoCD app** (equipment) / **Tailscale** path (free) — both supported.

## Anchors

BIP-39/32/44, BIP-84, SLIP-0010, NIP-06; `@noble`/`@scure`/`micro-key-producer`
(Paul Miller, audited); Vault + External-Secrets (HashiCorp/ESO); cert-manager;
**Headscale** (Juan Font, self-hosted Tailscale control server) / **Tailscale**
(WireGuard mesh, Bird/DERP); spire/SPIFFE (workload identity); the traveler frame

+ sovereign recognition/trust Seed entries.
