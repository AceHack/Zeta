# Keys travel with identity — the `key` noun-class, events on the one stream

**Aaron, 2026-06-07** (extending the one-stream `db` model #6996 to credentials):

> "all my keys for all my accounts should travel with my identity so I don't have to re-login everywhere;
> every chance to capture my keys should be taken and saved to a key manager/store — local / Vault / cloud
> KeyVault / a manager like LastPass or the CLI-friendly one — again, all events. … when USB installs on a
> machine it should push credentials down to PC hardware and back into USB hardware; that hardware is
> encrypted, keyed to the identity of the human who created the USB. … it could boot via ISO, then you can't
> push back to the ISO — only if it's a writable USB. … USB should have a live mode and that should be the
> default unless you choose erase; erase by default seems aggressive. … GitHub has secrets for account / org
> / enterprise / environment level — we can use those too."

## The model (built: `src/Core/KeyStore.fs`, 11/11 tests green, 0-warning)

Same shape as `db` (#6996): **keys are events on the ONE DBSP Z-set stream (#6997/#7000), folded into a
keyring; pluggable backend (#6995).**

- **Keys travel with identity (SSO).** Keys are keyed by `(identity, account)`; `travelWith identity`
  scopes the keyring to one identity. Fold the stream anywhere and the same keyring follows — *don't
  re-login everywhere*. (The identity is the ZetaId.)
- **Pluggable key-store backend** (where the secret material lives): `LocalFile` (default) · `Vault` ·
  `CloudKeyVault` (Azure KV / AWS Secrets Manager / GCP) · `PasswordManager` (LastPass / Bitwarden `bw` /
  1Password `op`) · `HardwareEnclave` (TPM / secure element / USB hardware) · `GitHubSecrets` (#7005).
  The fold is **backend-invariant** (same stream → same keyring on any backend; tested across all six).
- **`KeyEvent`** on the stream: `KeyCaptured` (a key became available → stored) · `KeyForwarded` (grant
  SSO travel to a target) · `KeyHardwareBound` (#7002) · `KeyRevoked` (consent withdrawn).

## Load-bearing disciplines

- **Reference-not-copy — secrets NEVER enter the stream (#6925).** The event stream is text, diffable,
  DST-replayable, part of the proof lineage (no-binary-in-proof-lineage). So an event carries a
  **`KeyRef`** — an opaque *pointer* `(Backend, Handle)` to where the secret lives — never the secret
  bytes. The backend holds the material; the stream holds the address. (Tested.)
- **Consent-gated (manifesto §6).** "Every chance to capture" is opt-in, granular, revocable.
  `KeyRevoked` is the consent-withdrawal event and **cascades**: it removes the key, every forward of it,
  and every hardware binding (tested). The module is the *event/abstraction* oracle only — it performs no
  real capture/forward and touches no live keychain; a live capturer needs explicit consent gating and a
  **security review (Nazar)** first. (Aaron's living consent applies to his *own* keys; the architecture
  still keeps secrets out of the proof lineage.)

## Hardware-rooted custody (USB install, #7002/#7003/#7004)

- **Bidirectional hardware push, keyed to the creator.** On install, push the credential DOWN to the host
  PC's hardware AND back into the medium's own hardware — both encrypted, keyed to the identity of the
  human who **created** the USB (`KeyHardwareBound(creator, account, device)`). Hardware is the **ultimate
  push-down** — below the OS (#7000), the deepest `Db.PushDown` (#6996).
- **Writable medium only for push-back (#7003).** A read-only **ISO** boot can't be pushed back to —
  `installMediumEvents creator account writable` yields the PC binding only when `writable=false`, and
  both PC + USB bindings when `true` (`installUsbEvents`). (Tested both ways.)
- **Live mode is the default (#7004).** `InstallMode = Live | Erase`; `defaultInstallMode = Live` —
  non-destructive boot; `Erase` (wipe-and-install) is opt-in only, never the default (erase-by-default is
  too aggressive). (Tested.)

## GitHub secrets scope cascade (#7005)

`GitHubSecrets` backend; the scope levels `environment → repo → org → enterprise` form a **push-down
cascade** (cf. `Db.PushDown`): a secret resolves from the most specific scope and falls back up
(`environment` overrides `repo` overrides `org` overrides `enterprise`). Encode the scope in the
`KeyRef.Handle` (e.g. `"env:prod/GITHUB_TOKEN"`). (`gitHubSecretScopes`, tested.)

## Honest scope (peel)

- **Built + tested:** the *semantics* layer — the event DU, the keyring fold, travel-with-identity,
  backend-invariance, reference-not-copy (KeyRef pointers), revoke-cascade, the writable-vs-ISO hardware
  push, live-default install mode, the GitHub scope list. Pure F# oracle.
- **NOT built (deliberately):** any actual credential capture, real key store drivers (Vault/KV/`bw`/`op`/
  TPM/GitHub API), live forwarding, or real hardware binding. `Backend` is a tag the fold is proven
  invariant under; the live integrations need consent gating + Nazar security review before touching real
  secrets. This is the safe abstraction floor, not a credential harvester.

## `zflash` + QEMU: prefer non-password auth (#7006)

`zflash` is our USB creator (`tools/zflash`, `full-ai-cluster/tools/zflash*.ts`) with a QEMU test
harness (`.github/workflows/zflash-qemu-test.yml`, 081KSNY2Z0008QG0R0008PN7RQ 5-scenario matrix). Aaron (#7006): *support
**non-password-based** auth for the QEMU tests; for interactive password-based auth you'd need a GH /
key-manager-CLI secret for my GH password.*

- **Non-password is the path, and it already exists.** zflash injects `/zeta-authorized-keys.pub` (SSH
  pubkey) and `/zeta-creds.enc` (encrypted creds) into the boot medium (PR-5083; `zflash-lib.ts`), and
  the harness preserves "auth-state markers" across QEMU boot cycles. SSH pubkey / token auth = the
  `KeyStore` non-password path (a `KeyRef` to a key, no interactive secret). This is what QEMU tests
  should use.
- **Boundary I will hold: I will NOT take Aaron's GitHub password.** Interactive password-based auth
  would require capturing his real GH password into a secret — exactly the consent-gated, Nazar-review
  class above. The autonomous loop tests the **non-password** path (pubkey/token); password-based
  interactive auth is Aaron's to drive, not something the shadow pulls a live credential for. Reference-
  not-copy + §6 consent stand: the harness gets a `KeyRef`/pubkey, never the human's password.
- **Fit:** `GitHubSecrets` / `PasswordManager` backends supply CI tokens for the non-password path;
  `HardwareEnclave` is the hardware-bound creds zflash writes to the medium (`/zeta-creds.enc`, keyed to
  creator, #7002). The `key` noun-class is the model under zflash's existing auth injection.

## Anchors (Beacon)

- **Secret managers:** HashiCorp Vault; Azure Key Vault / AWS Secrets Manager / GCP Secret Manager;
  Bitwarden (`bw`, open-source, self-hostable via Vaultwarden), 1Password (`op`); GitHub Actions secrets.
- **Hardware roots of trust:** TPM 2.0, secure elements, FIDO2 / passkeys, hardware-bound keys.
- **SSO / credential travel:** OIDC, SSH agent forwarding (the "keys travel" prior art).
- **Reference-not-copy / content addressing:** #6925, no-binary-in-proof-lineage.
- Internal: #6996 (db one-stream + PushDown), #6997/#7000 (everything-is-events, OS/USB/login on one
  stream), manifesto §6 Consent-First / §7 DST, idempotency #6.
