# Cluster install-time injection points — canonical catalog

End-to-end map of every credential / identifier / configuration value
that can be injected into a fresh NixOS install at flash time or first
console boot. Each row is declaratively backed by a NixOS module that
reads its value at evaluation time via `builtins.readFile`.

## Constitutional rail (from `usb-nixos-installer/zeta-install.sh`)

> *"Secrets shouldn't transit non-operator surfaces (USB ESP, Aaron's
> Mac keychain, etc.); operator-typed at install time is the safest
> path."*

This rail partitions injection points by **content class** + **transit
surface**:

| Content class | Allowed transit surfaces |
|---|---|
| **Public identifier** (SSH pubkey, hostname) | USB ESP at flash time; cluster console at install time |
| **Secret material** (passwords, WiFi creds, GPG, age, K8s tokens, ArgoCD admin, cosign signing key, etc.) | Cluster console at install time ONLY (operator-typed; never on USB ESP) |

Secret-class material that doesn't fit the operator-typed-once
discipline (e.g., long random tokens, multi-secret bundles) goes via
post-install secrets management (out of scope for this catalog;
candidates: SOPS, age, sealed-secrets, External Secrets Operator).

## Supported injection points (live catalog)

Each injection point has: stage (when injected) + content class +
flag/prompt (how operator drives it) + ESP filename (if ESP-transit) +
NixOS module (declarative reader) + iter/backlog tag.

### 1. Operator SSH pubkey

| Property | Value |
|---|---|
| **Stage** | macOS at `zflash` time → USB ESP write |
| **Content class** | Public identifier |
| **Operator-driven via** | `zflash --ssh-key <path>` (default `~/.ssh/id_ed25519.pub`); `--no-inject` to skip |
| **ESP filename** | `zeta-authorized-keys.pub` |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` (+ `operator-authorized-keys.nix` variant) |
| **Backed by file** | `full-ai-cluster/nixos/modules/operator-ssh-keys.txt` |
| **Iter / backlog** | iter-4.2 / [081KSGS9H0008QG0R002T3BJ2R](../docs/backlog/) |
| **Reader entry point** | `builtins.readFile keysFile` → `users.users.zeta.openssh.authorizedKeys` |
| **Mechanism on Mac** | `diskutil mount` ESP + `sudo tee` write (read-only on `~/.ssh/`) |
| **Mechanism on installer** | `zeta-install.sh` probes mounted USB FAT/ESP partitions; writes file into `/mnt/etc/zeta/` (or equivalent) |

### 2. Cluster node hostname

| Property | Value |
|---|---|
| **Stage** | macOS at `zflash` time → USB ESP write |
| **Content class** | Public identifier (RFC1123-validated) |
| **Operator-driven via** | `zflash --host <name>` (default = flake's per-host config) |
| **ESP filename** | `zeta-hostname.txt` |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/injected-hostname.nix` |
| **Backed by file** | `/mnt/etc/zeta/cluster-node-id` (written by installer from ESP) |
| **Iter / backlog** | iter-5.2 / [081KSGS9H0008QG0R003V23XNZ](../docs/backlog/) |
| **Reader entry point** | `builtins.readFile idFile` → `networking.hostName` (via `lib.mkOverride 50`) |
| **Validation** | `VALID_HOSTNAME_REGEX` in `zflash-lib.ts`; mirror grep `[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$` in `zeta-install.sh` |

### 3. `zeta` user initial password

| Property | Value |
|---|---|
| **Stage** | Cluster console at install time → typed twice |
| **Content class** | **Secret material** (NEVER on USB ESP) |
| **Operator-driven via** | `read -s` prompt in `zeta-install.sh`; Enter to skip → keeps `zeta-change-me` default |
| **Hash mechanism** | `mkpasswd -m sha-512 -s` (sha512crypt; reads from stdin to avoid argv exposure) |
| **Backed by file** | `/mnt/etc/zeta/initial-hashedpassword` (chmod 0600, chown root:root) |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/initial-password.nix` |
| **Iter / backlog** | iter-5.3 (+ 081KSGS9H0008QG0R00120EEHM Bug 3b runtime-injection fix) |
| **Reader entry point** | `builtins.readFile` → `users.users.zeta.hashedPassword` |
| **Why console-only** | Per constitutional rail above; password shouldn't transit Mac keychain OR USB ESP |
| **Fallback hash** | sha512crypt of `zeta-change-me` (BACKWARD-COMPAT; rotate via `passwd zeta` after first SSH login) |

### 4. WiFi credentials

| Property | Value |
|---|---|
| **Stage** | Cluster console at first boot → `nmtui` |
| **Content class** | **Secret material** (NEVER on USB ESP) |
| **Operator-driven via** | `nmtui` TUI on `zeta-first-boot.sh` |
| **Backed by** | NetworkManager system connections (under `/etc/NetworkManager/system-connections/`) |
| **Iter / backlog** | sibling exception in `zeta-first-boot.sh` (per `zeta-install.sh` line 392 comment) |
| **Why console-only** | Same constitutional rail; WiFi PSK is secret |

## Operator-driven `zflash` flag inventory (current)

Allowlist from `zflash.ts`:

```text
--help / -h          show usage + exit
--ssh-key <path>     override SSH pubkey injected to ESP
                     (default: ~/.ssh/id_ed25519.pub)
--no-inject          skip SSH pubkey injection entirely
--host <name>        inject RFC1123 hostname to ESP as zeta-hostname.txt
--skip-freshness-check
                     bypass main-vs-local divergence check
                     (NOT recommended — surfaces silent flash-without-inject hazard)
--skip-iso-pull      use the existing newest ~/Downloads/zeta-installer-*.iso
                     instead of pulling latest CI artifact
--agent              authorized-agent mode (auto-types `yes <nonce>` challenge;
                     operator's Touch ID still gates the dd)
```

## In-flight injection points (substrate-engineering targets — not yet shipped)

### 5. Encrypted cred-blob on USB ESP (081KSKBP80008QG0R003AX2A69 Phase 1, in-flight)

| Property | Value |
|---|---|
| **Stage** | Cluster console at install time → encrypted blob persisted to USB ESP after successful auth (post-install service trigger) |
| **Content class** | **Secret material** (encrypted-at-rest; key never hits disk) |
| **Operator-driven via** | Boot-sequence auth-method picker (4 options: restore-from-blob / fresh-device-flow / operator-PAT / skip) + operator passphrase |
| **Encryption** | AES-256-GCM; key derived via 2-layer scrypt → HKDF chain (full mechanism + parameters below) |
| **ESP filenames** | `/esp/zeta-creds.enc` (encrypted) + `/esp/zeta-creds-manifest.yaml` (declarative + operator-readable) |
| **Backlog** | [081KSKBP80008QG0R003AX2A69](../docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) (P1, open, M-effort) |
| **Covers credentials** | per declarative manifest: `gh-cli` (`~/.config/gh/hosts.yml`), `claude` (per-persona), `gemini` (per-persona), `codex` (per-persona), `ssh-host-keys`, `ssh-operator-pubkey` |
| **Constitutional-rail compliance** | Secret material; encrypted-at-rest on ESP IS allowed because the operator-passphrase + USB-UUID binding means the ESP-stored blob is useless without operator presence — the consent floor stays at operator-typed passphrase, not at USB-physical possession alone |

#### KDF chain detail (mechanism + parameters)

The 32-byte AES-256-GCM key is derived in two layers; full implementation in `tools/installer/zeta-creds-crypto.ts` (the `deriveKey` function + the `SCRYPT_*` + `KEY_LEN` + `SALT_LEN` + `HKDF_INFO` constants declared near the top of the file).

**Layer 1 — scrypt** (memory-hard work-factor KDF):

```text
stretched = scrypt(passphrase, salt, length=32, N=2^17, r=8, p=1, maxmem=256MB)
```

scrypt does NOT increase the underlying entropy of the operator passphrase (a weak passphrase remains weak in information-theoretic terms). What scrypt provides is a tunable **work-factor cost** per guess: with the parameters below, each candidate passphrase requires ~128MB of memory and (empirically per `zeta-creds-crypto.ts` Layer 1 source comments, on the maintainer's modern CPU at parameter-selection time) ~1-2 seconds of CPU per derivation. This makes brute-force attacks memory-prohibitively expensive on GPU/ASIC (per the 2026-05-27 security-review HIGH finding documented in the source: HKDF alone assumes high-entropy IKM, which user-typed passphrases violate; scrypt is the layer that makes the IKM cryptographically suitable for HKDF input).

Parameter selection: `N=2^17`, `r=8`, `p=1` — per [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) recommended scrypt parameters (current at parameter-selection time 2026-05-27; bump procedure: visit the cheat sheet at next security-review cadence, update both the cheat-sheet-citation date here AND the `SCRYPT_N`/`SCRYPT_R`/`SCRYPT_P` constants in `zeta-creds-crypto.ts`). Per-machine operational cost will vary with CPU + memory bandwidth; the ~1-2s figure is anchored to the source-code comment's empirical timing context.

**Layer 2 — HKDF-SHA256** (binds key to USB UUID):

```text
ikm  = concat(usbUuid_utf8, "|", stretched)
key  = HKDF-SHA256(ikm, salt, info="zeta-b0852-cred-persistence-v1", length=32)
```

HKDF binds the stretched secret to the USB UUID via IKM concatenation. Wrong USB → different IKM → different HKDF output → AES-GCM auth tag verification fails → structured error returned (not garbled plaintext). Defends against copy-blob-to-different-USB attack (operator-named threat 2026-05-27: *"we can put a key on the usb too if wnated tied to the uuid so it can't be copied to uuid"*).

Both layers must reproduce identically at decrypt time for the AES-GCM auth tag to verify; salt is per-blob (generated at encrypt time; stored in envelope; required at decrypt).

### 6. GitHub-creds-at-flash-time variants (081KSKBP80008QG0R003AX2A69 picker options 1 + 3)

Per operator 2026-05-27 verbatim: *"the current ones on my machine OR a token i generate on the website."*

Maps directly to 081KSKBP80008QG0R003AX2A69 Sub-target 2 (boot-sequence auth-method picker):

| Picker option | Operator-driven via | Credential source | Constitutional-rail compliance |
|---|---|---|---|
| **Option 1: Restore from encrypted USB blob** | Operator passphrase at boot picker prompt; default when blob present | Previously-persisted operator Mac `~/.config/gh/hosts.yml` (encrypted into the blob on prior boot's successful auth) | Encrypted-at-rest; operator-passphrase-derived key |
| **Option 2: Fresh device-flow login** | Operator visits github.com on phone/browser to enter device code | gh CLI device-flow (current behavior; uses gh-CLI quota) | Operator-driven directly; no transit issue |
| **Option 3: Operator-provided PAT** | Operator pastes fine-grained PAT at prompt (created at github.com/settings/tokens) | Operator-typed at cluster console | Typed once; same rail as initial-password |
| **Option 4: Skip** | Operator presses Enter at picker | (no GitHub-side substrate) | Cluster operates degraded; no inject |

## Architectural-principle layer — USB self-healing direction on reformat (operator 2026-05-27)

Operator 2026-05-27 verbatim:

> *"this makes the usb move in the self healing instead of full wipe direction on reformat"*

Substrate-engineering principle: when 081KSKBP80008QG0R003AX2A69 lands, **the DEFAULT behavior on USB reformat = preserve previous keys + choices** (081KSKBP80008QG0R00146WEX1's reformat-with-current-keys mode). Full-wipe (new-keys + new-decisions) becomes the OPT-IN path, not the default.

Three-mode reformat substrate (per [081KSKBP80008QG0R00146WEX1](../docs/backlog/P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md)):

| Mode | What it does | Default? |
|---|---|---|
| **1. Boot off USB again (fix mode)** | Substrate diagnoses + repairs broken state on cluster machines | Always available |
| **2. Reformat with current keys + decisions** | Wipe cluster machine; reflash from USB; restore previously-persisted creds + architectural decisions | **DEFAULT post-081KSKBP80008QG0R003AX2A69** |
| **3. Full reflash with new decisions + keys** | Wipe cluster machine; reflash from USB; generate new creds + start fresh architectural state | Opt-in (fresh-identity case) |

This direction-of-default matters because:

- **AI worry-about-mistakes dissolves** when reformat preserves identity (per 081KSKBP80008QG0R00146WEX1 operational-freedom mechanism)
- **Operator re-flash workflow becomes lower-friction** (the common case = preserve; the rare case = wipe)
- **Cred-leak / identity-corruption recovery stays available** via mode 3 opt-in (not default)
- **Self-healing direction composes with operator's persistent-recovery vision**: 3-machine quorum + remote-KVM + remote-power-button-press (per 081KSKBP80008QG0R00146WEX1) means substrate survives as long as ONE of {any cluster machine, the USB, operator's re-flash ability} survives

Operator's substrate-honest acknowledgment 2026-05-27: *"i know you can't preserve what i have now but for the next time would be cool"* — current ISO (`fd0ca0c8b` 25.11 Xantusia) doesn't yet ship 081KSKBP80008QG0R003AX2A69; this catalog tracks the direction for when it does. Today's flash IS full-wipe-default (because mode 2 doesn't exist yet); next flash post-081KSKBP80008QG0R003AX2A69 IS preserve-default.

## Related in-flight backlog (composes with this catalog)

- [081KSGS9H0008QG0R003JNSVR5](../docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension-resolve-without-shipping-credentials-aaron-2026-05-26.md) — installer interactive-login vs baked-in keys tension
- [081KSGS9H0008QG0R00120EEHM](../docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md) — installer-config-bugs RCA (gh-auth not respected, banner password disclosure, etc.)
- [081KSGS9H0008QG0R001EZKNCB](../docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-implementation-gap-aaron-2026-05-26.md) — zflash `--agent` flag native implementation
- [081KSGS9H0008QG0R002T0XQ50](../docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-each-ai-gets-own-github-identity-with-email-once-cluster-operational-substrate-honest-attribution-end-to-end-closes-enabledby-token-owner-not-actor-algo-wink-aaron-2026-05-26.md) — each AI gets own GitHub identity (per-persona attribution)
- [081KSGS9H0008QG0R001JNKBFD](../docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-node-local-claude-agent-stewards-own-registration-pr-then-reports-k8s-cluster-status-operator-interactive-login-pattern-aaron-2026-05-26.md) — node-local Claude agent stewards own registration PR
- [081KSKBP80008QG0R003AX2A69](../docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) — credential persistence on USB ESP + boot-sequence auth-method picker (the active substrate this catalog cross-references for in-flight rows 5 + 6 above)
- [081KSKBP80008QG0R00146WEX1](../docs/backlog/P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md) — post-boot AI as home-owner; 3-mode USB-boot recovery substrate (fix / reformat-with-current-keys / full-reflash); operational-freedom mechanism; AI-worry-about-mistakes dissolves

## Remaining gaps (no backlog row yet — candidates per constitutional rail)

Substrate-engineering targets NOT covered by 081KSKBP80008QG0R003AX2A69 or sibling rows.
Each new credential-type filing should walk the constitutional-rail
decision before authoring: **public identifier → ESP allowed; secret
material → console or post-install secrets management only**.

When 081KSKBP80008QG0R003AX2A69 ships, secret-class additions become MANIFEST EDITS
(declarative; new entry in `/esp/zeta-creds-manifest.yaml`) rather than
new code. Per Aaron 2026-05-27 in 081KSKBP80008QG0R003AX2A69: *"the keep credentials options
we should declare each credential we need and save and restore so it's
not so imparative too."* Adding a new cred type post-081KSKBP80008QG0R003AX2A69 = one YAML
entry; the persist/restore code reads the manifest + iterates.

| Candidate | Content class | Likely transit (post-081KSKBP80008QG0R003AX2A69) | Notes |
|---|---|---|---|
| GPG signing key (operator) | Secret | 081KSKBP80008QG0R003AX2A69 manifest extension | Per constitutional rail |
| age key (operator) | Secret | 081KSKBP80008QG0R003AX2A69 manifest extension | For SOPS / age-encrypted state |
| K8s join token | Secret | Cluster console at install time OR auto-generated on bootstrap | Per constitutional rail |
| ArgoCD admin initial password | Secret | Cluster console at install time | Per constitutional rail |
| Cosign signing key (cluster-issued) | Secret | Post-install secrets mgmt | For artifact signing |
| Cluster TLS root CA | Secret | Post-install secrets mgmt | For internal-CA bootstrap |
| Tailscale / WireGuard auth key | Secret | 081KSKBP80008QG0R003AX2A69 manifest extension | For overlay-network bootstrap |
| Time-server NTP override | Public config | USB ESP at flash time (candidate) | Cheap; non-secret |
| Locale / timezone | Public config | USB ESP at flash time (candidate) | Cheap; non-secret |
| Per-node disk role hints | Public config | USB ESP at flash time (candidate) | Currently in flake per-host config |

## Source-of-truth pointers

- `src/Core.TypeScript/zflash/cli.ts` — flash-time orchestrator + USB ESP injection
- `src/Core.TypeScript/zflash/lib.ts` — pure logic (hostname regex; ESP partition detection)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — installer-side injection probes + console prompts
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` — first-boot console prompts (WiFi)
- `full-ai-cluster/nixos/modules/injected-hostname.nix` — hostname reader
- `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` — SSH pubkey reader
- `full-ai-cluster/nixos/modules/operator-authorized-keys.nix` — sibling SSH authorized_keys reader
- `full-ai-cluster/nixos/modules/initial-password.nix` — password hash reader

## Substrate-engineering composition

- 081KSGS9H0008QG0R002T3BJ2R (iter-4.2 SSH pubkey injection)
- 081KSGS9H0008QG0R003V23XNZ (iter-5.2 hostname injection)
- 081KSGS9H0008QG0R00120EEHM (initial-password runtime activation fix)
- 081KSKBP80008QG0R0039RW25E (streams-are-relationships substrate — each injection-point pipeline is a tiny typed function per the distribute-across-tiny-functions architectural principle)

## Composes with rules

- `.claude/rules/non-coercion-invariant.md` HC-8 — secret-class material requires operator-typed consent at the cluster console; ESP-transit for non-public secrets would violate HC-8 floor
- `.claude/rules/glass-halo-bidirectional.md` — each injection mechanism is type-visible; operator can inspect every path
- `.claude/rules/honor-those-that-came-before.md` — iter-4.2 / 5.2 / 5.3 substrate preserved + named in catalog
- `.claude/rules/verify-existing-substrate-before-authoring.md` — this catalog is the substrate-inventory pass for future credential-type additions
