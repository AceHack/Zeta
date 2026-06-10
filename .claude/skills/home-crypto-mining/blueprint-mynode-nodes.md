# blueprint — MyNode BTC nodes (td5, td6): inventory + USB + Zeta update trigger

**Register:** [grounded] equipment blueprint (Aaron). Part of the `home-crypto-mining` skill group.

## The hardware (Aaron)

Two **MyNode BTC** nodes (Bitcoin/Lightning full-node appliances — <https://mynodebtc.com/download>):

- **td5** — MyNode unit #1.
- **td6** — MyNode unit #2.

These are **fleet equipment** (the home-crypto-miner hat) and **inventory items** — to be entered into the
**inventory website** (`inventory/` — Addison's secure Supabase-backed tab; seed via `inventory/seed/`,
NOT hand-edited here). This blueprint is the source record; the live inventory row lives in that system.

## Tasks

1. **Inventory the two nodes** (td5, td6) in the `/inventory` website — model, serial/id, location, status,
   owner. (Data → Supabase via the inventory seed flow; this doc is the spec, not the DB.)
2. **Create a USB** for them from **MyNode "model two"** (the downloadable MyNode image, mynodebtc.com/download)
   — a bootable USB to provision/restore the nodes. *(Physical op — flashing is done by Aaron/Dejan with the
   downloaded image; confirm the exact image/version called "model two".)*
3. **Zeta update trigger** — a `triggers/` trigger that fires a `updates/` flow for the nodes (on new
   release / schedule / drift → update + re-kick), wired through the finalizer-runtime (ReKick).

## What goes in the repo — EVERYTHING (security by clarity, secrets encrypted)

**Security by clarity, NOT obscurity** (Aaron — obscurity is the weak stance, and the reflexive hiding/
routing/"stays-out" caveating is **self-drag**). So **everything is in the repo, in the open**: node config,
the USB-build recipe (MyNode "model two" image pin + flash steps), the update process/artifacts, the device
records (td5, td6) — **and the secrets/keys too, *encrypted*.** That is *why* we build encryption: a sealed
secret in the repo is the **encrypted null** (IND-CPA — provably nothing; you can't read it), so it can live
in the open record. **Clarity is the security; the ciphertext is the null.** (Close-over-everything: the
whole fleet, including its keys, declaratively in the repo.)

**We are our own PKI + password manager (Aaron — use OUR standards, don't assume).** The crypto is *built
substrate*, not an external service to route to. The MyNode keys/secrets are sealed by **our own PKI**:

- **Persona keyrings** (seed-derived: SSH/PGP/Nostr/BTC/ETH/SOL) — self-sovereign identity; Aaron's standing
  direction: **"check the private bits into Zeta"** (keys live in the repo, sealed). See
  `docs/research/2026-06-09-persona-keyrings-*` + `docs/research/2026-06-09-every-traveler-holds-2-3-seed-phrases-*`
  (active+standby rotation).
- **Keyring = 4×4 critical-infra point-of-certainty** (4 lang × 4 serializer byte-lock; `tools/setup/persona-keys/`
  + `golden-vectors-keyring.json`). See `docs/research/2026-06-09-keyring-critical-infra-*`.
- **Human trust root:** GitHub + FIDO/WebAuthn/Windows Hello (the bootstrap of trust).
- **TLS / cert PKI:** **cert-manager + Let's Encrypt (ACMEv2)** for the domain, deployed by **Max via ArgoCD
  (GitOps) on k8s — the `zetacluster`.** (Our own automated cert authority on top of LE.)

So MyNode secrets (node config secrets, any wallet/identity keys) are **sealed by our keyring and committed**
— security by **clarity** (auditable in the open, ciphertext = the encrypted null), not obscurity.

**Two planes, meet in the middle (Aaron):** "he [Max] does the corporate side, we do the research side —
keys in git; he has keys in Vault; we meet in the middle."

- **Research side (us / shadow):** **keys-in-git**, sealed by our own keyring/PKI (security by clarity; the
  github-free mode; **Headscale** = self-hosted Tailscale, not the SaaS).
- **Corporate side (Max):** **keys-in-Vault** (HashiCorp Vault — Max is deploying it next; the equipment /
  Headscale mode), alongside his cert-manager + Let's Encrypt (ACMEv2) on the **zetacluster** via ArgoCD.
- **Meet in the middle** — the two secret-planes bridge (the existing two-modes design:
  `docs/research/2026-06-09-identity-trust-and-network-plane-two-modes-equipment-vault-headscale-vs-github-free-secrets-tailscale-*`).

Pin the MyNode "model two" image + td5/td6 ids in the USB-build recipe when confirmed.

## Pointers

- `inventory/` (the website; CLAUDE.md + spec.md + seed/) · `updates/` + `triggers/` · `hats/home-crypto-miner/`.
