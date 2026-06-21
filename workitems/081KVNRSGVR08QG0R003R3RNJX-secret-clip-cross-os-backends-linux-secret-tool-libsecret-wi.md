---
id: 081KVNRSGVR08QG0R003R3RNJX
type: task
state: backlog
priority: P1
slug: secret-clip-cross-os-backends-linux-secret-tool-libsecret-wi
title: "secret-clip cross-OS backends (Linux secret-tool/libsecret + Windows Credential Manager/DPAPI) + biometric-gated reads + GUI secure-popup per OS (Aaron 2026-06-21)"
created: 2026-06-21T18:58:51.384Z
depends_on: []
composes_with: ["081KVNMFYS808QG0R002D0VM64"]
---

# secret-clip cross-OS backends (Linux secret-tool/libsecret + Windows Credential Manager/DPAPI) + biometric-gated reads + GUI secure-popup per OS (Aaron 2026-06-21)

<!-- Work-item body. ZetaId-keyed. -->

## Carved sentence

> `tools/setup/secret-clip.sh` is a GENERIC clipboard/secure-popup → OS-keystore secret-sharing
> primitive (Aaron 2026-06-21: "generic clipboard password/secret→keychain ... clear clipboard
> afterwards ... gate it with fingerprint ... safe for everyone ... one for each os"). macOS
> Keychain backend SHIPPED; finish the **Linux + Windows backends**, the **biometric-gated
> reads**, and the **GUI secure-popup per OS** so any secret lands encrypted-at-rest on any OS,
> never through the agent's transcript.

## Shipped (macOS, this is the reference)

`secret-clip.sh set|get|del <name> [--clipboard] [--clear-clipboard]` — captures via `pbpaste`
or an `osascript` hidden-answer dialog, stores in the login Keychain (`security`), clears the
clipboard on request. Verified: `get` round-trips the real op token. Caller example:
`op-token-setup.sh`. Interface is OS-agnostic; backends dispatch on `uname`.

## To build

1. **Linux backend** — Secret Service via `secret-tool` (libsecret): `secret-tool store/lookup
   zeta-secret <name>`. Clipboard via `wl-paste`/`xclip`/`xsel`; secure popup via
   `zenity --password` / `kdialog --password` (GUI) with the existing `stty -echo` terminal
   fallback. Clipboard-clear via `wl-copy`/`xclip`.
2. **Windows backend** — Credential Manager (`cmdkey` / PowerShell `CredentialManager`) or DPAPI
   (`[Security.Cryptography.ProtectedData]::Protect`). Clipboard via `Get-Clipboard`; secure
   popup via `Get-Credential` / `Read-Host -AsSecureString`; clipboard-clear via `Set-Clipboard`.
3. **Biometric-gated reads** (the "fingerprint" part — the hard, per-OS layer):
   - macOS: `SecAccessControl` (kSecAccessControlBiometryAny) — needs a small Swift/LAContext
     helper (the `security` CLI can't set a biometric ACL); OR gate the wrapper read via a
     LocalAuthentication prompt (note: bypassable if `security` is called directly).
   - Windows: **Windows Hello** (WinRT `KeyCredentialManager`).
   - Linux: `fprintd` / polkit (varies by distro; weakest story).
   Reuse the repo's existing biometric gate where possible (`tools/setup/persona-keys/biometric.ts`
   already does Touch ID via pam_tid + Windows Hello — the same mechanism).
4. Optionally refactor `op-token-setup.sh` to call `secret-clip set` for the keystore write
   (DRY) while keeping its op-specific `secrets-env.sh` wiring.

## Composes / anchors

Composes with 081KVNMFYS808QG0R002D0VM64 (OSS secret-manager via ArgoCD) on the
cluster-encryption-credential-substrate trajectory. Anchors: macOS Keychain Services /
`security(1)`; freedesktop Secret Service + libsecret `secret-tool`; Windows Credential Manager
/ DPAPI; LocalAuthentication (Touch ID) / WinRT KeyCredentialManager (Hello). Reference impl:
`tools/setup/secret-clip.sh` (macOS); blueprint
`.claude/skills/security/blueprints/op-service-account-token-provisioning.md`.
