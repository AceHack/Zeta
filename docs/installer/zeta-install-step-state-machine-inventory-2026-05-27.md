# `zeta-install.sh` step-state-machine inventory — 081KSKBP80008QG0R002VRN56K.1 Phase 0 substrate

Snapshot date: 2026-05-27 (origin/main `70596a8db`)
Source file: `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (1,352 lines)
Sub-row owner: 081KSKBP80008QG0R002VRN56K.1 per 081KSKBP80008QG0R002VRN56K (Ace migration trajectory)
Composes with: 081KSKBP80008QG0R003AX2A69 + 081KSKBP80008QG0R000Y2B7HC + 081KSKBP80008QG0R000GPC0TB + 081KSKBP80008QG0R000TQC624 (sibling install-flow substrate)

## Purpose

This inventory documents the EXISTING imperative bash state-machine in `zeta-install.sh` to enable the 081KSKBP80008QG0R002VRN56K trajectory toward `ace install zeta` declarative manifest form. Per the human maintainer 2026-05-27 framing in 081KSKBP80008QG0R002VRN56K row body — the migration target is declarative; this Phase 0 doc names what each step DOES so the declarative manifest can express the same surface.

## Top-level entry

| Field | Value |
|---|---|
| Entrypoint | `zeta-install <HOST>` (positional CLI arg; defaults to `${1:-}` empty) |
| Required env | `REPO_URL` (defaults to `https://github.com/Lucent-Financial-Group/Zeta`) |
| Optional env | `BOOT_DISK` (auto-pick if empty), `ZETA_AUTO_CONFIRM=WIPE` (skip prompts; first-boot path) |
| Side effect at startup | `tee` of all output to `ZETA_INSTALL_LOG` per 081KSGS9H0008QG0R001RR3ZXQ (install-log preservation) |
| Failure mode | exits non-zero; tee log preserved at `/tmp/zeta-install-*.log` |

## Step-by-step state machine

### Step 1 — Enumerate internal disks (lines 81-111)

| Field | Value |
|---|---|
| Inputs | None (probes `lsblk -d -p -n -o NAME,TYPE,RM,RO,TRAN` then `awk`-filters to internal/non-removable; per-device size/model/serial gathered separately via `lsblk -d -n -o SIZE`/`MODEL`/`SERIAL`) |
| Outputs | `ALL_DISKS[]` array of internal block devices (USB excluded) |
| Side effects | None (read-only probe) |
| Failure modes | Empty `ALL_DISKS[]` → hard exit (no installable disks) |
| Declarative equivalent | `ace.discovery.disks.internal: true` flag; let Ace probe |

### Step 2 — Pick BOOT disk; rest become DATA (lines 113-164)

| Field | Value |
|---|---|
| Inputs | `BOOT_DISK` env (override) OR operator interactive pick |
| Outputs | `BOOT_DISK`, `DATA_DISKS[]`, `ROOT_SIZE`, `STORAGE_BACKEND` |
| Side effects | Operator-prompts when `BOOT_DISK` empty + `ZETA_AUTO_CONFIRM!=WIPE` |
| Failure modes | Operator cancel; non-existent `BOOT_DISK`; data partition fits no longhorn |
| Declarative equivalent | `ace.disks.boot: auto \| <device>`; `ace.disks.data: rest \| none` |

### Step 3 — Wipe disks in scope (lines 166-172)

| Field | Value |
|---|---|
| Inputs | `BOOT_DISK`, `DATA_DISKS[]`, `ZETA_AUTO_CONFIRM` |
| Outputs | (no return; mutates disks) |
| Side effects | **DESTRUCTIVE**: `sgdisk --zap-all` on every in-scope disk |
| Failure modes | Permission denied (not root); device busy (mounted partition) |
| Declarative equivalent | `ace.disks.wipe_strategy: full \| preserve_data`; operator-confirm gate |

### Step 4 — Partition BOOT disk (lines 173-204)

| Field | Value |
|---|---|
| Inputs | `BOOT_DISK`, `ROOT_SIZE`, `DATA_DISKS[]` |
| Outputs | `ESP_PART`, `ROOT_PART`, `LH1_PART` (partition device paths); plus whole-disk longhorn partitions on each `DATA_DISKS[i]` |
| Side effects | **`sgdisk`** GPT layout on BOOT_DISK: 1GiB ESP (type ef00) + `$ROOT_SIZE` ext4 root (type 8300) + rest longhorn1 (type 8300). On each DATA disk: single whole-disk partition `longhorn<i+2>` (type 8300). `partprobe` after to refresh kernel partition table. |
| Failure modes | Insufficient disk size; sgdisk error; partprobe failure (with manual-recovery suggestion in bail message) |
| Declarative equivalent | `ace.partitions.boot: { esp: 1G, root: $ROOT_SIZE, longhorn1: rest }; ace.partitions.data: longhornN` |

### Step 5 — Format + mount (lines 205-237)

| Field | Value |
|---|---|
| Inputs | `ESP_PART`, `ROOT_PART`, `LH1_PART` |
| Outputs | mount points at `/mnt`, `/mnt/boot`, `/mnt/var/lib/longhorn-disk1` |
| Side effects | `mkfs.fat -F 32 -n boot`; `mkfs.ext4 -L nixos`; `mkfs.ext4 -L longhorn1`; `mount` to `/mnt` |
| Failure modes | mkfs failure; mount failure |
| Declarative equivalent | `ace.filesystems: { esp: fat32, root: ext4, longhorn1: ext4 }` |

### Step 6 — Clone Zeta + generate hardware config (lines 238-249)

| Field | Value |
|---|---|
| Inputs | `HOST` (must be non-empty by this step), `REPO_URL` |
| Outputs | Zeta repo at `/mnt/etc/zeta`; hardware-configuration.nix generated |
| Side effects | `git clone $REPO_URL /mnt/etc/zeta`; `nixos-generate-config --root /mnt --force` (NixOS HW probe; `--force` overwrites existing config if present) |
| Failure modes | Network (clone fails); empty `HOST` (hard exit with usage message) |
| Declarative equivalent | `ace.source: github:Lucent-Financial-Group/Zeta@main`; auto-clone via Ace |

### Step 6.5 — iter-4.2 probe boot USB for operator SSH pubkey (lines 250-371)

| Field | Value |
|---|---|
| Inputs | Mounted USB ESP (scanned for `*.pub` matching SSH pubkey format) |
| Outputs | `PUBKEY_FILE` path (operator's pubkey); `INJECT_OK=1` flag if injection succeeded |
| Side effects | Copies pubkey to `/mnt/etc/zeta/operator-authorized-keys` if found; on failure logs `lsblk` topology for diagnostic |
| Failure modes | None (graceful degrade if no pubkey found — `INJECT_OK=0`; iter-4 v1 manual config-edit fallback path documented in Step 7 banner) |
| Declarative equivalent | `ace.ssh.operator_pubkey: { source: esp \| inject_at_flash \| manual_post_install, paths: [...] }` |

### Step 6.55 — iter-5.3 prompt for initial password (081KSGS9H0008QG0R003V23XNZ) (lines 372-440)

| Field | Value |
|---|---|
| Inputs | Operator interactive prompt (`read -rs`); default if skipped |
| Outputs | `/mnt/etc/zeta/initial-hashedpassword` (mkpasswd-yescrypt) |
| Side effects | Writes hashed password file; `chmod 600` |
| Failure modes | Operator cancel; mkpasswd not available (falls back to plain prompt + warning) |
| Declarative equivalent | `ace.initial_password: { source: prompt \| env:VAR \| generate, hash_algo: yescrypt }` |

### Step 6.6 — iter-5.2 hostname injection (081KSGS9H0008QG0R003V23XNZ) (lines 440-526)

| Field | Value |
|---|---|
| Inputs | Operator interactive prompt (default `node-<6-hex>`); `HOSTNAME_DST=/etc/zeta/cluster-node-id` |
| Outputs | `/mnt/etc/zeta/cluster-node-id` (chosen hostname); symlink at `/etc/zeta/cluster-node-id` |
| Side effects | Per 081KSGS9H0008QG0R00120EEHM Bug 1: symlinks operator-authorized-keys + cluster-node-id into `/etc/zeta/` for flake-eval visibility |
| Failure modes | Invalid hostname (operator re-prompt) |
| Declarative equivalent | `ace.hostname: { source: prompt \| env:VAR \| generate_prefix, validate: rfc1123 }` |

### Step 6.7 — iter-5.1 wifi persistence (081KSGS9H0008QG0R003V23XNZ) (lines 527-587)

| Field | Value |
|---|---|
| Inputs | Live USB's NM-config (probes `/etc/NetworkManager/system-connections/` on live-USB rootfs) |
| Outputs | Persisted NM connection files at `/mnt/etc/NetworkManager/system-connections/` |
| Side effects | Copies wifi credentials; preserves PSK/EAP/etc. |
| Failure modes | None (no wifi → skip; ethernet-only install still works) |
| Declarative equivalent | `ace.network.wifi.persist_from_live_usb: true` |

### Step 6.8 — iter-5.4.0 homelab gh-auth + operator pubkey copy (lines 588-717)

| Field | Value |
|---|---|
| Inputs | Operator interactive `gh auth login` device-flow; **`gh ssh-key list --json`** (081KSGS9H0008QG0R00120EEHM Bug 2b: currently fails on older gh; non-blocking warn) |
| Outputs | `GH_AUTH_OK` flag; `GH_KEY_COUNT`; SSH pubkeys appended to `/etc/zeta/operator-authorized-keys`; git credential helper configured |
| Side effects | Heaviest interactive step; opens browser to `github.com/login/device`; consumes gh device-flow quota |
| Failure modes | gh login refused; throttled (per Aaron 2026-05-27 empirical anchor — 3rd boot hit throttle); `gh ssh-key list --json` flag unknown on older gh |
| Declarative equivalent (per 081KSKBP80008QG0R003AX2A69) | `ace.auth.github: { method: blob_restore \| device_flow \| pat \| skip, blob_path: /esp/zeta-creds.enc, passphrase_source: prompt }` — picker GATES this step (per 081KSKBP80008QG0R003AX2A69 Sub-target 2) |

### Step 6.9 — iter-5.4.1 self-registration commit+push (081KSGS9H0008QG0R0037H3W4T) (lines 718-985)

| Field | Value |
|---|---|
| Inputs | `GH_AUTH_OK`, `HOST` (chosen hostname); composed YAML for `maintainers/<op>/cluster-nodes/<host>/node.yaml` |
| Outputs | new git branch `register-node-<host>-<timestamp>`; commit; push; PR opened via `gh pr create`; `SELF_REG_OK=1` flag on success |
| Side effects | **Composes registration BEFORE reboot** (per 081KSKBP80008QG0R000GPC0TB architectural critique — should fire LAST after install completes; currently fires here) |
| Failure modes | `GH_AUTH_OK != 1` triggers documented graceful-skip path (lines 731+); PR creation refused; (per 081KSKBP80008QG0R000GPC0TB catch) — registration orphaned if downstream install fails |
| Declarative equivalent (per 081KSKBP80008QG0R000GPC0TB) | `ace.cluster.self_register: { trigger: post_install_first_boot, idempotent: true, dedup: existing_pr_check }` — MOVED to systemd oneshot service per 081KSKBP80008QG0R000GPC0TB |

### Step 6.95 — iter-5.5.0 claude-code install + credential persistence (081KSGS9H0008QG0R001JNKBFD Phase 2) (lines 986-1095)

| Field | Value |
|---|---|
| Inputs | Mise-managed runtimes (bun/node/python/dotnet/java/uv); `~/Zeta` clone target |
| Outputs | claude-code CLI on PATH; `~/.config/{gh,claude}` populated; `~/Zeta` pre-cloned |
| Side effects | mise installs bun + invokes `bun --global` for claude CLI; claude interactive login |
| Failure modes | mise install network failure; claude login refused; tools/setup/install.sh invocation failure |
| Declarative equivalent | `ace.runtimes: mise@.mise.toml`; `ace.cli_install: [claude, gemini, codex]`; `ace.user_repos: [Zeta]` |

### nixos-install (the actual build; ~line 1004)

| Field | Value |
|---|---|
| Inputs | `HOST`, `/mnt/etc/zeta/full-ai-cluster#<host>` flake target |
| Outputs | NixOS installed to `/mnt`; bootloader configured |
| Side effects | `sudo nixos-install --impure --option fallback true --option connect-timeout 10 --option stalled-download-timeout 60 --option download-attempts 3 --flake "/mnt/etc/zeta/full-ai-cluster#$HOST" --no-root-password` |
| Failure modes | nixos-install failure (per 2026-05-27 USB boot test empirical anchor; previously `--fallback` flag was wrong — fixed via `--option fallback true` in PR #5410); cache.nixos.org timeouts (fallback handles) |
| Declarative equivalent | `ace.nixos_install: { flake: ".#$HOST", flags: { fallback: true, connect-timeout: 10, ... } }` |

### Step 7 — Print initial credentials (iter-4 per 081KSGS9H0008QG0R002T3BJ2R) (~lines 1261-1336)

| Field | Value |
|---|---|
| Inputs | `GH_AUTH_OK`, `GH_KEY_COUNT`, `INJECT_OK`, `SELF_REG_OK`, presence of `/mnt/etc/zeta/initial-hashedpassword` |
| Outputs | Operator-facing console banner listing: user/password/SSH-from-Mac instructions; iter-4 v1 manual-config-edit fallback path (when `INJECT_OK=0`); registration PR URL (when `SELF_REG_OK=1`) |
| Side effects | None (just `echo` + log preservation via `tee` per 081KSGS9H0008QG0R001RR3ZXQ) |
| Failure modes | None |
| Declarative equivalent | `ace.post_install.banner: { template: zeta_login_banner, conditional_sections: [gh_auth, ssh_inject, self_register] }` |

## Cross-cutting concerns

### Operator-prompt accumulation

7 interactive prompts during install (before 081KSKBP80008QG0R003AX2A69 phase-split lands):

1. Step 2: BOOT_DISK pick (if `BOOT_DISK` env empty + `ZETA_AUTO_CONFIRM!=WIPE`)
2. Step 6.55: initial password (iter-5.3)
3. Step 6.6: hostname (iter-5.2)
4. Step 6.8: `gh auth login` device-flow (iter-5.4.0)
5. Step 6.95: claude login (iter-5.5.0)
6. Step 6.95: gemini auth login (iter-5.5.0)
7. Step 6.95: codex login (iter-5.5.0)

081KSKBP80008QG0R003AX2A69 phase-split + cred-persistence reduces this to **zero prompts on re-install** (operator types passphrase once at boot to decrypt blob).

### Idempotency surface (per 081KSKBP80008QG0R000GPC0TB architectural fix)

| Step | Currently idempotent? | Notes |
|---|---|---|
| Steps 1-5 | NO (wipe is destructive) | Operator must intend wipe via `ZETA_AUTO_CONFIRM=WIPE` |
| Step 6 (clone) | YES (re-clones if dir exists) | Composes with 081KSKBP80008QG0R002VRN56K declarative source |
| Steps 6.5-6.7 | YES (re-read pubkey, re-prompt password, re-persist wifi) | |
| Step 6.8 (gh auth) | PARTIAL (re-auth on each boot — root of Aaron's throttle anchor) | 081KSKBP80008QG0R003AX2A69 cred-persistence fixes |
| Step 6.9 (self-register) | NO (creates new PR per boot) | 081KSKBP80008QG0R000GPC0TB architectural fix: marker file + in-flight PR check |
| Step 6.95 (vendor CLI install) | PARTIAL (re-install via mise) | |

### State-machine inputs the declarative manifest must capture

For 081KSKBP80008QG0R002VRN56K Phase 2 (Ace manifest design), the declarative target needs to express all of:

- Hardware discovery (Step 1) + operator override (Step 2)
- Destructive consent (Step 3) — must NOT default to wipe
- Partition layout (Step 4) — operator-tunable
- Filesystem choice (Step 5) — operator-tunable (ext4/btrfs/zfs)
- Source-of-truth repo (Step 6) — git URL or local path
- Authentication source (Step 6.5 + 6.8) — per 081KSKBP80008QG0R003AX2A69 phase-split
- Operator-identity sourcing (Step 6.55 + 6.6) — prompt vs env vs generate
- Network persistence (Step 6.7) — copy-from-live vs declarative-config
- Self-registration trigger (Step 6.9) — per 081KSKBP80008QG0R000GPC0TB post-install-service
- Runtime/CLI install (Step 6.95) — mise + bun
- NixOS-install invocation (Step 6.95+) — flake target + Nix options
- Post-install banner (Step 7)

12 distinct declarative-input categories. The Ace manifest schema (081KSKBP80008QG0R002VRN56K Phase 2 sub-row) needs to cover them.

## Files generated during install

Tracked here so 081KSKBP80008QG0R003AX2A69 cred-persistence + 081KSKBP80008QG0R002VRN56K Ace manifest know what survives across re-installs:

| File | Owner step | Persist target | Manifest cred id |
|---|---|---|---|
| `/mnt/etc/zeta/operator-authorized-keys` | 6.5 + 6.8 | ESP blob (081KSKBP80008QG0R003AX2A69) | `ssh-operator-pubkey` |
| `/mnt/etc/zeta/cluster-node-id` | 6.6 | ESP blob OR regen each boot | (TBD) |
| `/mnt/etc/zeta/initial-hashedpassword` | 6.55 | ESP blob OR prompt each boot | (TBD) |
| `/mnt/etc/NetworkManager/system-connections/*` | 6.7 | Live-USB copy (already persisted) | (n/a) |
| `~/.config/gh/hosts.yml` | 6.8 | ESP blob (081KSKBP80008QG0R003AX2A69) | `gh-cli` |
| `maintainers/<op>/cluster-nodes/<host>/node.yaml` | 6.9 | git (not local) | (n/a) |
| `~/.config/claude/credentials.json` | 6.95 | ESP blob (081KSKBP80008QG0R003AX2A69) | `claude` |
| `~/.gemini/oauth_creds.json` | 6.95 | ESP blob (081KSKBP80008QG0R003AX2A69) | `gemini` |
| `~/.codex/auth.json` | 6.95 | ESP blob (081KSKBP80008QG0R003AX2A69) | `codex` |

Matches the 6 entries in 081KSKBP80008QG0R003AX2A69.5 DEFAULT_MANIFEST. The 3 currently-missing-from-manifest items (`cluster-node-id`, `initial-hashedpassword`, NetworkManager configs) are candidates for manifest expansion — operator can choose.

## What this inventory enables

Phase 0 (this sub-row) outputs:

1. Step-by-step state machine documented above
2. Cross-cutting operator-prompt accumulation count (7 prompts; phase-split target = 1 passphrase prompt)
3. Idempotency surface table — informs 081KSKBP80008QG0R000GPC0TB architectural fix scope
4. 12 declarative-input categories — informs 081KSKBP80008QG0R002VRN56K Phase 2 manifest schema design
5. Files-generated-during-install table — informs 081KSKBP80008QG0R003AX2A69 manifest expansion + persist/restore CLI scope

Phase 1+ (future sub-rows) will:

- 081KSKBP80008QG0R002VRN56K.2: ship `package.json` + `bunfig.toml` + `bun.lock` stub at Zeta repo root (mirrors `../scratch` + `../SQLSharp` shape)
- 081KSKBP80008QG0R002VRN56K.3: design Ace manifest schema covering the 12 categories
- 081KSKBP80008QG0R002VRN56K.4: author `ace.yaml` (or equivalent) for Zeta at repo root
- 081KSKBP80008QG0R002VRN56K.5: live-USB Ace bootstrap (Ace CLI present in live ISO before zeta install runs)
- 081KSKBP80008QG0R002VRN56K.6: `ace install zeta` smoke test against fresh USB
- 081KSKBP80008QG0R002VRN56K.7-8: zeta-install.sh thin-bootstrap reduction → retirement (Rule 0 carve-out shrinks)

## Empirical anchor

Snapshot at origin/main `70596a8db` (PR #5417 cosign keyless OIDC ISO signing merge). Composes with the substrate-engineering arc this session:

- 081KSKBP80008QG0R003AX2A69 + sub-rows (cred persistence) — landed PR #5403 + PR #5411 + PR #5414
- 081KSKBP80008QG0R000Y2B7HC.1 (cosign signing) — landed PR #5417 + fix-fwd #5419
- 081KSKBP80008QG0R000GPC0TB (self-register architectural fix) — landed PR #5412
- 081KSKBP80008QG0R000TQC624 Path A (deferred /tmp coordination) — landed PR #5413
- 081KSKBP80008QG0R002VRN56K (this row's parent — Ace migration trajectory) — landed PR #5405

Future inventory refreshes should re-snapshot when `zeta-install.sh` changes substantially (this doc names origin/main commit explicitly for diff-tracking).
