# Decision: PKI + secret/key/vault custody is HEXAGONAL — stable ports, swappable adapters

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** accepted (direction) · **Class:** security · **Trajectory:** cluster-encryption-credential-substrate

## Carved sentence (Aaron 2026-06-21)

> *"We will hexagonal it like everything else, all our other interfaces — PKI and
> password/key/vaults become swappable as long as we follow best practices."*

Ports & adapters (Cockburn's hexagonal architecture) for the credential substrate: the
**ports** are stable interfaces; the **backends** (1Password, Bitwarden/Vaultwarden, Vault,
macOS Keychain, cert-manager, local files) are **swappable adapters**. The **port contract IS
the "best practices"** — any adapter that satisfies it is safe to swap in. This is
`interfaces-free-classes-earned` applied to custody: the port is the free interface; each
adapter is an earned, contract-bound implementation.

## The ports (interfaces) + their adapters

| Port (stable interface) | Contract (the "best practices") | Adapters (swappable) |
|---|---|---|
| **SecretStore** — `set/get/del <name>` | encrypted at rest; never echo; least-privilege scope; revocable | macOS Keychain (`secret-clip.sh`) · 1Password (`op`) · Bitwarden/Vaultwarden · Vault · Win Cred Mgr · Linux secret-service |
| **KeyCustody / SshAgent** — hold a private key; **sign without exposing** | private bytes never leave the custody boundary; consent/biometric gate; revocable | local file (default, no dep) · **1Password SSH agent** · Secure Enclave / `-sk` · Vault SSH |
| **CertAuthority (PKI)** — sign a cert; hold the CA | CA private never echoed/committed; principal=user; N+M (Key ID=machine); validity window | local `ssh-keygen` CA (`ca.ts`, today) · Vault SSH secrets engine · cert-manager |
| **Consent gate** — physical-presence approval | fail-closed; one-approval-per-run | Touch ID (pam_tid) · Windows Hello · fprintd |

Generators / callers depend on the **port**, never a concrete adapter — so the substrate is
adapter-agnostic and DST-testable (inject a fake adapter).

## What this resolves (incl. the 1Password SSH questions, Aaron 2026-06-21)

- **"don't require 1Password, but take full value of it"** = the **port is mandatory**, the
  **adapter is swappable**: the **local-file adapter is the no-dependency default**; the
  **1Password adapter is the full-value opt-in** (SSH agent, git commit signing, bookmarks —
  https://www.1password.dev/ssh/agent · /git-commit-signing). Same port, richer adapter.
- **"did we import the SSH key like [the 1Password SSH-key flow]?"** — No. We used the
  **SecretStore** port's *document* capability (backup only: `op document create`). The
  1Password **SshAgent** adapter (native SSH-key item → agent-served) is a *different port*
  (sign-without-exposing). Backup ≠ agent custody; both are valid, behind different ports.
- **"value in a flow that never saves the ssh/gpg locally?"** — **Yes**, real value: it's the
  **KeyCustody port with a non-extractable adapter** (1Password agent / Secure Enclave / Vault)
  — strongest custody, zero local-disk attack surface, biometric-gated, git-signing. But it's a
  hard dependency on that adapter, so it is an **opt-in mode**, not the default. The default
  stays local-generate (no dependency) + optional upload (backup).

## Migration is an adapter swap, not a redesign

Because callers bind to ports, the planned moves are adapter swaps with NO call-site change:
local-file → 1Password agent → Vault/Secure-Enclave (KeyCustody); local `ssh-keygen` CA →
Vault SSH / cert-manager (PKI); Keychain → 1Password/Vaultwarden (SecretStore). The
event-sourced authorization layer (grant/revoke fold) sits ABOVE these ports unchanged.

## Build status (today)

Shipped adapters: SecretStore→macOS Keychain (`secret-clip.sh`) + 1Password (`op`);
CertAuthority→local `ssh-keygen` (`ca.ts`, N+M); Consent→Touch ID. The ports are currently
*implicit* (the shapes exist across `secret-clip.sh`/`op-token-setup.sh`/`ca.ts`); formalizing
them as explicit interfaces (so adapters are truly drop-in) is the build-out — see backlog
081KVNTNTDQ08QG0R0017NBBWB (vault separation) + 081KVNRSGVR08QG0R003R3RNJX (secret-clip cross-OS)

+ 081KVNMFYS808QG0R002D0VM64 (Vaultwarden via ArgoCD). KeyCustody (SSH-agent) port = new follow-up.

## Anchors

Cockburn, *Hexagonal Architecture* (ports & adapters). In-repo:
[`interfaces-free-classes-earned-under-rules.md`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md)
(port = free interface, adapter = earned class), noninterference §13 (adapters are the declared
metered channels). 1Password SSH: https://www.1password.dev/ssh/manage-keys ,
/ssh/agent , /ssh/git-commit-signing , /ssh/bookmarks. Migration targets: Vault SSH secrets
engine, cert-manager.
