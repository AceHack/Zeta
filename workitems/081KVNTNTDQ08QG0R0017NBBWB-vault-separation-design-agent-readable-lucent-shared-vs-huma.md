---
id: 081KVNTNTDQ08QG0R0017NBBWB
type: task
state: backlog
priority: P1
slug: vault-separation-design-agent-readable-lucent-shared-vs-huma
title: "Vault-separation design: agent-readable (lucent/shared) vs human-only (aaron/personal — GPG/SSH/derivation seed) across 1Password + Bitwarden; least-privilege per secret class (Aaron 2026-06-21)"
created: 2026-06-21T19:31:47.255Z
depends_on: []
composes_with: ["081KVNMFYS808QG0R002D0VM64", "081KVNRSGVR08QG0R003R3RNJX"]
---

# Vault-separation design: agent-readable (lucent/shared) vs human-only (aaron/personal — GPG/SSH/derivation seed) across 1Password + Bitwarden; least-privilege per secret class (Aaron 2026-06-21)

<!-- Work-item body. ZetaId-keyed. -->

## Carved sentence

> Secrets are partitioned into vaults by **trust class**, and the agent gets a token ONLY to
> the vaults its role needs (least-privilege). Two vaults minimum (Aaron 2026-06-21): **lucent**
> = shared/work + agent-readable; **aaron** = the human's PERSONAL identity keys (GPG, SSH,
> main derivation seed) — human-only, the agent never needs a token to it. Machine keys never
> go in 1Password at all (per-machine, regenerable).

## Decision so far (Aaron 2026-06-21)

- **Two vaults now (the minimum worth getting right):**
  - `lucent` — shared/work secrets, **agent-readable** (the agent has a scoped service-account
    token; verified read/write).
  - `aaron` — the human's personal keys: **GPG, SSH, the main key used for derivation** — all the
    identity-tied secrets. Human custody ("seed custody is the human's").
- **Full-trust bootstrap (interim, Aaron's authorization):** while we get the setup right we
  ASSUME FULL TRUST — the CA private key MAY be saved in `lucent` for now. This is a deliberate,
  temporary relaxation; the end-state below removes it.
- **Machine keys: never in 1Password** (regenerable; no custody value).
- Aaron is provisioning the `aaron` vault + a second service-account token; the agent will hold
  the **lucent** token and (per his current full-trust call) potentially the second token, stored
  via `secret-clip` as distinct named Keychain items.

## End-state to design (the "get it right later" this backlogs)

1. **Trust-root NOT in an agent-readable vault.** The CA private key (forges any cert) and the
   human's derivation seed (forges the human's identity) are the two crown jewels. End-state:
   they live in a vault the agent has NO token for (human-only), OR in Vault/Secure-Enclave/the
   1Password SSH-agent (sign-without-exposing). The agent SIGNS via the operator-approved-
   biometric path; it never HOLDS the trust root. (Today's full-trust-in-lucent is the interim.)
2. **Per-secret-class scoping.** Map each secret class → vault → who-can-read:
   - work/CI tokens, app secrets → `lucent` (agent + CI).
   - CA private key → human-only vault (or Vault) END-STATE; `lucent` interim.
   - GPG / SSH / derivation seed → `aaron` (human-only), never an agent token.
   - machine keys → nowhere (regenerate).
3. **Cross-tool**: the same partition on **1Password** AND the self-hosted **Bitwarden/Vaultwarden**
   (the OSS lane, 081KVNMFYS8…) — vault names + ACLs mirrored so custody isn't single-vendor.
4. **Revocation drill**: deleting a service account / rotating a vault token cleanly cuts the
   agent's access to exactly that class.

## Composes / anchors

Composes: OSS-secret-manager-via-ArgoCD (081KVNMFYS808QG0R002D0VM64), secret-clip cross-OS
(081KVNRSGVR08QG0R003R3RNJX). Trajectory: cluster-encryption-credential-substrate. Principle:
[[feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21]] (agent
runs, human approves — agent never holds the trust root) + "seed custody is the human's". Migration
target: HashiCorp Vault + cert-manager + the 1Password SSH agent (sign-without-exposing).
