---
id: 081KSGS9H0008QG0R002T3BJ2R
priority: P1
status: open
title: Iter-4 cluster credential substrate — hashedPassword (zeta-change-me default) + operator-ssh-keys.nix module + manual edit workflow (v1) with zflash auto-inject as iter-4.2 follow-up
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R0029S1D5Z
  - 081KSE6WT0008QG0R002275NDE
  - 081KSE6WT0008QG0R000C18G5D
  - 081KSE6WT0008QG0R000RH1526
  - 081KSE6WT0008QG0R0004AP0ZA
tags: [cluster-install, ssh-key, password, iter-4, nixos, credentials, b-0754-follow-on]
---

## Problem

Iter-3 (the maintainer's PC 1 test, 2026-05-25) shipped end-to-end zero-typing NixOS install via the iter-3 USB. Result: PC 1 booted to `control-plane login:` tty1 prompt — but **inaccessible**. Root cause surfaced by the maintainer asking *"what's the password?"*:

- `nixos-install --no-root-password` was used → root account locked
- `users.users.zeta` defined in `common.nix` with no `initialPassword` / `hashedPassword` → zeta account also locked for tty1 login
- `users.users.zeta.openssh.authorizedKeys.keys = [ ]` empty in per-host `configuration.nix` (the example key was commented out)
- `services.openssh.PasswordAuthentication = false` → no SSH-by-password fallback

PC 1 was unreachable both via local console AND via SSH. The IP-KVM substrate (081KSE6WT0008QG0R0029S1D5Z Comet Pro) + "remote fingers" substrate (081KSE6WT0008QG0R0004AP0ZA commodity hardware reference) becomes theatrical without local-console reachability.

## Target

Cluster nodes installed via iter-4 USB are reachable via BOTH paths after first boot:

1. **Local tty1 console** with the initial password `zeta-change-me` (operator MUST rotate via `passwd zeta` on first login)
2. **SSH from the operator's workstation** as the `zeta` user after the operator adds their public key to `operator-ssh-keys.nix` + `nixos-rebuild switch`

Per the maintainer 2026-05-26 *"we can do what's going to make cluster setup eaiser for me and not users if that's ssh lets do that first cause we want to get ai running the cluster asap"* — ship the simplest substrate that unblocks cluster-side AI workloads NOW. Account-login + credential-survey skill substrate (for end-user onboarding) deferred per the same message.

## Substrate shape (iter-4 v1)

### Password substrate

`full-ai-cluster/nixos/modules/initial-password.nix`:

- Sets `users.users.zeta.hashedPassword = "$6$..."` via sha512crypt hash for `zeta-change-me` (generated via `openssl passwd -6 'zeta-change-me'`)
- sha512crypt picked per simplest-first (per 081KSE6WT0008QG0R000C18G5D memory): universally portable; promote to yescrypt or agenix / sops-nix when (a) repo goes public OR (b) multi-operator key isolation becomes load-bearing
- Imported by per-host `configuration.nix`
- Operator rotates immediately on first tty1 login

### SSH-key substrate

`full-ai-cluster/nixos/modules/operator-ssh-keys.nix`:

- Empty stub in the repo: `users.users.zeta.openssh.authorizedKeys.keys = [ ]`
- Imported by per-host `configuration.nix`
- Operator manually edits this file post-install + `nixos-rebuild switch` to add their pubkey (iter-4 v1 path)
- iter-4.2 follow-up: `zflash.ts` writes operator's pubkey to a writable area of the boot USB; `zeta-install.sh` probes + injects into this module at install time (full zero-typing); see "iter-4.2 / iter-4.3 / iter-5 paths" below

### Install-script substrate

`full-ai-cluster/usb-nixos-installer/zeta-install.sh`:

- Post-install (before reboot countdown), prints initial credentials in big letters:

  ```
  user:     zeta
  password: zeta-change-me

  AFTER FIRST LOGIN:
    1. passwd zeta
    2. Edit /etc/zeta/full-ai-cluster/nixos/modules/operator-ssh-keys.nix
    3. sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#<host>
    4. ssh zeta@<hostname> from workstation
  ```

- iter-4 v1 doesn't read pubkey from USB; stub stays empty until operator edit. Iter-4.2 adds USB read.

## Acceptance — iter-4 v1 is SCAFFOLDING (not maintainer-usable); iter-4.2 is the actually-usable end-to-end target

The maintainer 2026-05-26: *"i can wait for 4.2 or whatever version before we try again."* This downgrades iter-4 v1 from a "usable + tested via re-flash" goal to a "substrate lands so iter-4.2 has scaffolding to build on" goal. The maintainer will NOT re-flash PC 1 for v1; the actually-usable test target is iter-4.2 (or whichever iteration first ships zero-typing end-to-end SSH).

### iter-4 v1 acceptance (substrate-scaffolding-only)

- [x] `nixos/modules/initial-password.nix` ships with sha512crypt hash for `zeta-change-me`
- [x] `nixos/modules/operator-ssh-keys.nix` ships as empty stub — scaffolding that iter-4.2 overwrites at install time
- [x] `nixos/hosts/control-plane/configuration.nix` imports both new modules + removes the prior inline empty `authorizedKeys` declaration
- [x] `usb-nixos-installer/zeta-install.sh` prints initial credentials + post-install workflow before exit (workflow text useful in iter-4.2 too; v1 ships it because the cost is one echo block)
- [ ] Worker-template + worker-gpu configurations also import the two new modules — v1.1 follow-on within this row when zfollowed up

### iter-4.2 acceptance (target the maintainer will actually test against)

Note: the maintainer 2026-05-26 *"--no-creds is basically useless right?"* signal removed the opt-out flag from the original design. The default behavior IS the new behavior; opt-out (renamed `--no-inject`) exists only as an escape hatch for the operator who explicitly wants the old flash-only flow without the pubkey-write step.

- [x] `full-ai-cluster/tools/flash-usb.ts` extended with `--no-eject` flag so zflash can do the ESP-mount-and-write before the USB ejects (4-line change; allowlist + skip-eject branch)
- [x] `full-ai-cluster/tools/zflash.ts` extended with post-flash macOS-side ESP-mount-and-write step:
  - Default reads `~/.ssh/id_ed25519.pub`
  - `--ssh-key <path>` overrides
  - `--no-inject` opt-out (escape hatch only; not the recommended path)
  - Re-scans external disks post-flash; finds the (single) freshly-flashed USB
  - Identifies the FAT / EFI partition via `diskutil list` regex match (DOS_FAT / EFI / MS-DOS / FAT16 / FAT32 / Windows_FAT)
  - Mounts via `diskutil mount <part>`; gets mount point from `diskutil info`
  - Writes `<mount>/zeta-authorized-keys.pub` via `sudo tee` (stdin avoids shell-quoting hazards)
  - Unmounts via `diskutil unmount`; ejects whole disk via `diskutil eject`
  - Diagnostics auto-fire on any failure (photo-friendly: external-disk list, mounted USB volumes, "what to do next" suggestions)
- [x] `usb-nixos-installer/zeta-install.sh` extended with pre-install pubkey-inject step:
  - Step 6.5 probe: scans `/iso /run /mnt /boot` for `zeta-authorized-keys.pub`; if not found, probes USB partitions (`/dev/sd? /dev/nvme?n? /dev/vd? /dev/mmcblk?` minus install targets) via vfat-readonly mount + file existence check
  - If found: writes `operator-ssh-keys.nix` with valid `ssh-*` lines from the file BEFORE `nixos-install`
  - If not found: diagnostics auto-fire (external block devices, install targets, full lsblk, "what to do next") + falls back to v1 stub
  - Post-install credentials echo branches on `INJECT_OK`: success path says "SSH works immediately"; fallback path keeps the v1 manual-edit + nixos-rebuild instructions
- [ ] Maintainer flashes iter-4.2 USB once (single `zflash` invocation; no extra flags needed for default-key case)
  - Plugs into PC 1 (or PC 2 / PC 3)
  - Install runs zero-typing
  - PC X reboots; tty1 login as `zeta` / `zeta-change-me` works (initial-password substrate from v1)
  - `ssh zeta@<hostname>` from the maintainer's Mac works immediately — this is the iter-4.2 end-to-end success criterion
- [ ] If failure: the auto-diagnostics output gets photographed + sent back; AI fixes-forward against the actual substrate the photo reveals (this is the photo-driven-diagnostics workflow the maintainer explicitly chose per 2026-05-26 *"i'm going to avoid it like the plague and try to get like pictures and auto run and short commands pre built in"*)

### Why ship v1 separately if 4.2 is the maintainer-usable target

The v1 PR is small (5 files), substrate-only, no operator-facing behavioral change beyond the initial-password substrate. iter-4.2 PR builds on v1's modules + adds the tooling around them. Shipping v1 first:

- Lets the Nix modules + per-host imports land + get reviewed independently of the macOS-side ESP-mount complexity
- Surfaces any issues with the hashedPassword choice / module-import structure before they're entangled with the tooling change
- Makes iter-4.2 a tightly-scoped tooling PR (zflash.ts changes + zeta-install.sh probe), not a substrate-shape PR
- Composes with the simplest-first discipline (per the maintainer-Mika 2026-05-25 feedback memory) at PR-decomposition scope

The maintainer's "wait for 4.2" signal is exactly the right shape for this decomposition: iter-4 v1 is substrate-engineering housekeeping; iter-4.2 is the workflow-affecting change worth waiting for.

## iter-4.2 / iter-4.3 / iter-5 paths (NOT in v1 — future substrate landings)

### iter-4.2 — zflash auto-inject SSH key from boot USB

- `zflash.ts` extended to mount the boot USB's writable partition (EFI ESP) post-flash + write `/zeta-authorized-keys.pub` containing the operator's `~/.ssh/id_ed25519.pub` (default) or `--ssh-key <path>` (override)
- `zeta-install.sh` probes the boot USB for `/zeta-authorized-keys.pub` + rewrites `operator-ssh-keys.nix` with the keys before `nixos-install`
- Result: full zero-typing flow restored. Operator's pubkey on cluster nodes without manual edit step.

### iter-4.3 — multi-key support (per-context attribution)

- `zflash.ts --ssh-key <path>` accepts the flag REPEATEDLY for multiple keys
- USB file becomes multi-line (one pubkey per line)
- `zeta-install.sh` injects each line as a separate `authorizedKeys.keys` entry
- Composes with `maintainers/aaron/legal-entities/inventory.md` for the per-context attribution chain (ServiceTitan-scoped key vs personal-LFG-only key)

### iter-5 — per-node SSH keypair generated on install + GitHub deploy-key registration

- Each cluster node generates its own SSH keypair during install
- Auto-registered with GitHub as a per-repo deploy key (read-only by default; promote when push needed)
- Tighter blast-radius than reusing maintainer's key for node-to-GitHub access
- Composes with the credential-survey skill substrate (deferred per the maintainer 2026-05-26)

### iter-5+ — secret-management substrate promotion

- Promote from sha512crypt-in-repo to `agenix` or `sops-nix` when:
  - Repo goes public OR
  - Multi-operator key isolation becomes load-bearing OR
  - Audit-trail requirements demand per-secret attribution
- Self-contained later swap; doesn't require rearchitecting v1

### iter-5+ — credential-setup skill substrate (end-user-side)

- Account-login (`gh auth login`, `claude /login`, etc.) as default path for first-time CLI users
- `.claude/skills/credential-setup/SKILL.md` documents the full lifecycle per surface
- `tools/setup/credentials/{survey,setup}.ts` + `tools/setup/manifests/oauth-flows/` declarative manifests
- Bannable-patterns matrix at `docs/credentials/bannable-patterns.md`
- Composes with Max's tier-2 onboarding work (PR #5076's onboarding-doc deliverable)

## Composes with

- **081KSGS9H0008QG0R002T3BJ2R** — iter-3 zero-typing USB install (iter-4 is the credential-substrate follow-on)
- **081KSE6WT0008QG0R003G0Y62D** — first-time-CLI-user persona (iter-4 v1 is operator-friction-cost; iter-4.2+ closes the zero-typing gap)
- **081KSE6WT0008QG0R0029S1D5Z** — IP-KVM Comet Pro substrate (iter-4 makes local-console access load-bearing — KVM-via-IP becomes operationally valuable when tty1 has a password to type into)
- **081KSE6WT0008QG0R002275NDE** — simplest-first plugin sequence (sha512crypt = simplest first; promote to stronger later)
- **081KSE6WT0008QG0R000RH1526** — Local Loop deterministic simulation testing (iter-4 cluster nodes are tier-3 substrate; need to be reachable for AI workloads to land)
- **081KSE6WT0008QG0R000C18G5D** — "simplest first; add complexity only when simple shape demonstrably doesn't fit" discipline (every choice in iter-4 design applied this)
- **081KSE6WT0008QG0R0004AP0ZA** — commodity hardware reference (iter-4 v1 closes the "you have a screen so you can log in locally" hardware-substrate gap)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — Shape A `hashedPassword` in per-host Nix module (per the discipline named in the maintainer-as-top-level liability framing in PR #5076)
- `maintainers/aaron/legal-entities/inventory.md` (PR #5077) — iter-4.3 multi-key extension composes with the per-context attribution chain (Lucent / Freeborn / ServiceTitan contexts)
- `memory/max/PERSONA.md` — Max's tier-2 dev-experience work needs reachable clusters; iter-4 v1 unblocks this even with the manual SSH-key edit step

## Out of scope (deferred — see iter-4.2 / iter-5 paths above)

- zflash auto-inject of SSH key to boot USB
- Multi-key per-context support
- Per-node SSH keypair + GitHub deploy-key registration
- agenix / sops-nix secret-management substrate
- Account-login credential-setup skill (end-user onboarding side)
- Worker-template + worker-gpu module imports (v1 ships control-plane; v1.1 brings others)

## Origin

The maintainer 2026-05-26, after iter-3 USB install on PC 1 succeeded but left the node unreachable. Sequence:

1. *"what's the password?"* — surfaced the iter-3 gap (no password, no SSH keys, locked accounts)
2. Substrate-design conversation across multiple ticks reached the iter-4 shape (Shape A `hashedPassword` + SSH-key-from-USB + 081KSGS9H0008QG0R002T3BJ2R row)
3. *"okay i'll wait for that to get into main then send it just let me know"* — gated Max-side text-message rollout on iter-4 substrate landing (decoupled when Max's persona substrate landed first via PR #5078)
4. *"we can do what's going to make cluster setup eaiser for me and not users if that's ssh lets do that first cause we want to get ai running the cluster asap"* — explicit authorization to ship iter-4 v1 with simplest-first design; credential-setup skill deferred to iter-5+

iter-4 v1 ships the manual SSH-key edit workflow because (a) Nix modules + per-host imports are the smallest substrate that unblocks SSH access end-to-end; (b) zflash-auto-inject requires post-flash partition-mount logic that's bounded but adds iteration cycles; (c) the maintainer's stated priority is "get AI running the cluster ASAP" which the v1 path serves immediately. iter-4.2 USB auto-inject ships as a follow-on when the manual-edit friction becomes operational.
