# Provisioning a new node — cookie-cutter workflow

End-to-end: physical box arrives → boots into running cluster
member with replicated Longhorn capacity. A handful of values to
change per box, no hand-partitioning, no shell scripts.

## What you need

- A NixOS installer USB built from this repo (`nix build .#installer-iso`)
- The new box wired to the cluster network with internet access
- The maintainer's public SSH key
- A few minutes to read off two disk serial numbers

## Step 1: copy the template

```bash
HOST=worker-gpu-03    # pick the next free number
cp -r full-ai-cluster/nixos/hosts/worker-template \
      full-ai-cluster/nixos/hosts/$HOST
```

## Step 2: change the placeholder values

Open `full-ai-cluster/nixos/hosts/$HOST/default.nix` and edit
each clearly-marked PLACEHOLDER block:

| What | Where to get it |
|------|-----------------|
| `networking.hostName` | the name you chose above (`worker-gpu-03`) |
| `networking.hostId` | `head -c4 /dev/urandom \| od -A n -t x4 \| tr -d ' '` |
| `zeta.disko.bootDisk` | On the live system: `ls -l /dev/disk/by-id/` — pick the boot disk (ESP + max root + longhorn1 tail) |
| `zeta.disko.extraDisks` | Optional. Each additional disk becomes longhorn2..N. Use `[ ]` for single-disk nodes. |
| Network config | Static IP block if you don't use DHCP |
| `users.users.zeta.openssh.authorizedKeys` | Maintainer key |

## Step 3: wire into the flake

Open `full-ai-cluster/flake.nix`, add an entry mirroring
`worker-template`:

```nix
"worker-gpu-03" = mkSystem {
  modules = [
    ./nixos/hosts/worker-gpu-03/default.nix
  ];
};
```

Commit + push to main so the install reads from a real ref.

## Step 4: boot the box on the USB

UEFI boot order → USB first. The first-boot service auto-launches
on tty1 (per 081KSGS9H0008QG0R002T3BJ2R zero-typing scope):

1. **10-sec role prompt**: press `c` for control-plane (default
   on timeout), `w` for worker-gpu
2. **Network**: waits up to 30s for ethernet DHCP + internet; if
   no ethernet internet, auto-launches `nmtui` (one TUI form)
3. **Install**: runs `zeta-install $HOST` non-interactively
   (env vars: `ZETA_AUTO_CONFIRM=WIPE`, `BOOT_DISK=auto`)
4. **Reboot**: 10-sec countdown after install completes

Total node-side typing: **0 commands** (ethernet-DHCP) or **1
nmtui form** (wifi). Switch to `Ctrl-Alt-F2` for a normal login
shell if you need to override the auto-flow (e.g., debug, non-
2-NVMe shape, recovery).

### Interactive `zeta-install.sh` flow (when first-boot auto-flow is overridden OR `HOST` not pre-set)

When the installer runs interactively, the operator sees these
prompts in order:

1. **iter-5.3 — initial password prompt** (Step 6.55)
   Set the `zeta` user's initial console password. Press Enter to
   skip + keep the iter-4.x default `zeta-change-me` (rotate later
   via `passwd zeta`).

2. **081KSKBP80008QG0R003AX2A69.3b — cred-blob passphrase prompt** (Step 6.56;
   default-on per 081KSKBP80008QG0R003AX2A69.3c since 2026-05-27)
   Set a passphrase to encrypt your credentials onto the USB.
   Future boots restore creds via the same passphrase — no more
   re-entering `gh login` / `claude` / `gemini` / `codex` on every
   reboot. Press Enter to skip (no cred-blob persistence; keeps
   per-reboot re-entry behavior).
   Encryption: AES-256-GCM with key derived via scrypt → HKDF
   chain bound to the USB's filesystem UUID (per
   `tools/installer/zeta-creds-crypto.ts`).

3. **iter-5.2 — hostname injection** (Step 6.6)
   If `zeta-hostname.txt` was written to the USB ESP at flash time
   via `zflash --host <name>`, the hostname is auto-injected;
   otherwise the flake's per-host default applies.

4. **iter-5.1 — WiFi persistence** (Step 6.7) — non-interactive;
   persists any NetworkManager profiles to the installed system.

5. **iter-5.4.0 — homelab gh-auth** (Step 6.8)
   Triggers `gh auth login` device-flow if `gh` is available.
   Captures operator's GitHub SSH pubkeys via `gh ssh-key list`.

6. **Cluster-type menu** (Step 6 host-attribute selection; 081KSKBP80008QG0R002J03WGA.2
   menu per PR #5635 since 2026-05-27)
   Numbered menu with `lspci`-based hardware detection suggesting
   the default:
   ```
   1) control-plane    K3S server + Cilium + ArgoCD bootstrap
   2) worker-gpu       NVIDIA passthrough + device-plugin + Longhorn
   3) worker-template  Cookie-cutter worker; per PROVISIONING.md
   4) other            Custom flake host attribute (advanced)
   ```
   Hardware detection (NVIDIA / AMD VGA / AMD 3D / Intel Arc GPU
   present → suggests `worker-gpu`; default → `control-plane`).
   Operator hits Enter to accept the suggestion or types a different
   number.

7. **Step 6.95-picker — cred-blob picker** (081KSKBP80008QG0R003AX2A69.3c default-on
   since 2026-05-27)
   Auto-fires when all 3 preconditions are met:
   - `ZETA_CREDS_PICKER` is unset OR set to `1` (default-on; opt out
     via `ZETA_CREDS_PICKER=0` OR `touch /etc/zeta/no-picker`)
   - `ZETA_CREDS_PASSPHRASE` is set (auto-populated by Step 6.56)
   - `/etc/zeta/usb-uuid` is present (auto-captured by 081KSKBP80008QG0R003AX2A69.3a-prep
     during iter-4.2 ESP probe)
   On opt-out, the SPECIFIC reason is echoed (no generic
   `set ZETA_CREDS_*=1 to enable` message anymore).

### Subsequent-boot credential restore (081KSKBP80008QG0R002XBRGN8 since 2026-05-27)

Every boot of the installed system AFTER the first install
(assuming the operator entered a passphrase at Step 6.56) fires
the `zeta-creds-restore.service`:

1. `ConditionPathExists` check: blob + uuid + script + bun shim
   all present → unit fires (otherwise clean no-op)
2. `systemd-ask-password` prompts on tty1: operator types the
   SAME passphrase they used at Step 6.56
3. `tools/installer/zeta-creds-restore.ts` decrypts the blob +
   writes `/home/zeta/.config/{gh,claude,gemini,codex}` per the
   declarative manifest at `tools/installer/zeta-creds-manifest.ts`
4. Subsequent services (`zeta-self-register.service` etc.) see
   the restored creds + don't re-prompt for device-flow login

Per-host opt-out: `zeta.credsRestore.enable = false;` in that
host's `configuration.nix`. Per-host passphrase mode override:
`zeta.credsRestore.passphraseMode = "file";` for headless cluster
scenarios where tty1 prompting is inappropriate (operator pre-
stages passphrase at `/run/zeta-creds-passphrase` via separate
mechanism).

## Step 5 (manual override only — first-boot service handles this automatically)

These commands run automatically in the zero-typing flow. Use
this section only if you switched to tty2 to override:

```bash
zeta-install control-plane   # or worker-gpu
# Equivalent to:
#   sudo disko --mode disko --flake .#control-plane
#   sudo nixos-install --flake .#control-plane --no-root-password
#   sudo reboot
```

That's it. Subsequent boxes: repeat steps 1-4 with new placeholder
values (only needed for `worker-gpu-NN` per-node host configs).
Each provision is ~10 minutes wall-clock, **~0 lines of human edits
on the node side**, zero hand-partitioning.

## What happens after first boot

1. systemd-boot → kernel → NixOS userland (~30s)
2. K3S agent service starts → contacts `control-plane.zeta.local:6443`
3. Cluster admits the node → kubelet reports both `/var/lib/longhorn-disk1`
   and `/var/lib/longhorn-disk2` as filesystem entries
4. Longhorn DaemonSet pod schedules → reads `/etc/longhorn/node-disks.yaml`
   → patches the Longhorn Node CR to add both data paths
5. Longhorn rebalancer notices the new capacity → starts placing
   replicas of existing volumes onto this node
6. ArgoCD reconciles any node-affinity workloads that target this
   node's labels

Check it landed:

```bash
kubectl get nodes -o wide
kubectl -n longhorn-system get nodes.longhorn.io worker-gpu-03 -o yaml | grep -A20 disks:
```

## Cred-restore smoke test (081KSKBP80008QG0R003AX2A69 end-to-end verification)

The 081KSKBP80008QG0R003AX2A69 cred-persistence substrate replaces N per-tool login
flows per boot (`gh auth login`, `claude login`, `gemini login`,
`codex login`, etc.) with ONE cred-blob passphrase per boot. The
operator still types the cred-blob passphrase at every boot in the
default `passphraseMode = "interactive"` configuration; what changes
is that the passphrase unlocks all wrapped credentials atomically
instead of re-running each tool's individual login flow.

Default credential manifest (per `tools/installer/zeta-creds-manifest.ts`):

| Cred id | Captured paths |
|---|---|
| `gh-cli` | `~/.config/gh/hosts.yml` |
| `claude` | `~/.config/claude/credentials.json`, `~/.claude/.credentials.json` |
| `gemini` | `~/.gemini/oauth_creds.json` |
| `codex` | `~/.codex/auth.json` |
| `ssh-host-keys` | `/etc/ssh/ssh_host_ed25519_key{,.pub}`, `/etc/ssh/ssh_host_rsa_key{,.pub}` |
| `ssh-operator-pubkey` | `/etc/zeta/operator-authorized-keys`, `/etc/ssh/authorized_keys.d/zeta-operator` |

To verify the cascade works end-to-end after a fresh USB install:

### First-boot verification (during install)

Look for these install log lines on tty1 (exact strings; if you
see something different, check the current `zeta-install.sh` Step
6.56 + Step 6.95-picker output):

```text
[081KSKBP80008QG0R003AX2A69.3b] ── cred-blob passphrase prompt (081KSKBP80008QG0R003AX2A69 Phase 1) ──
[081KSKBP80008QG0R003AX2A69.3b]   passphrase captured + held in non-exported shell variable
[iter-5.5.0] ── 6.95-picker: 081KSKBP80008QG0R003AX2A69.3a cred-picker (DEFAULT-ON per 081KSKBP80008QG0R003AX2A69.3c) ──
[iter-5.5.0]   passphrase from Step 6.56; usb-uuid from 081KSKBP80008QG0R003AX2A69.3a-prep
[iter-5.5.0]   ZETA_CREDS_PASSPHRASE_VAL unset from installer shell (post-picker block; fires in both branches)
```

If you see `SKIP 6.95-picker: <reason>` instead, the picker opted
out — check the reason (env var / marker file / missing UUID /
empty passphrase). Cred-restore won't activate.

### Post-reboot verification (after install reboots into installed system)

The restore service runs at every boot in
`passphraseMode = "interactive"` (the common.nix default). On tty1
during boot, expect a `systemd-ask-password` prompt:
`Zeta cred-blob passphrase:`. Type the same passphrase entered at
Step 6.56 during install. After it unlocks, SSH in and verify:

```bash
# 1. Restore service ran AND its ConditionPathExists passed
#    (i.e., /boot/zeta-creds.enc exists)
systemctl status zeta-creds-restore.service

# Expected: "Active: active (exited)" with status=0/SUCCESS
# Wrong passphrase = service fails with non-zero exit; restart
# from the systemd-ask-password prompt on next boot.

# 2. The encrypted blob is on the ESP (post-reboot mount = /boot)
ls -la /boot/zeta-creds.enc

# Expected: ~few-KB binary file (size depends on captured creds)

# 3. The cred files are restored to their expected paths
ls -la /home/zeta/.config/{gh,claude}/ 2>/dev/null
ls -la /home/zeta/.gemini/ /home/zeta/.codex/ 2>/dev/null
ls -la /home/zeta/.claude/ 2>/dev/null

# Expected: populated cred files; ownership zeta:users for $HOME
# paths and root:root for /etc/ssh paths
```

### Second-reboot verification (what changes vs first-time install)

On the second reboot (and every subsequent reboot in interactive
mode): the cred-blob passphrase prompt fires again on tty1 — this
is by design, not a regression. The pain-point improvement is that
ONE passphrase unlocks ALL the captured creds atomically; the
operator does NOT need to re-run `gh auth login`, `claude login`,
`gemini login`, `codex login` individually.

To swap to no-prompt-at-boot behavior, set `passphraseMode = "file"`
in the host config; the restore service then reads
`/run/zeta-creds-passphrase` (operator pre-stages this file before
the unit runs). This trades the per-boot prompt for an
operator-staged plaintext file at `/run/...` — less secure;
appropriate for fully-automated boot environments only.

After the cred-blob is decrypted, verify the individual creds work:

```bash
sudo -u zeta gh auth status       # gh CLI: expect token loaded
sudo -u zeta claude --version     # Claude Code: expect no login flow
sudo -u zeta gemini --version     # Gemini CLI: expect no login flow
sudo -u zeta codex --version      # Codex CLI: expect no login flow

# Expected: each tool reports its identity without prompting for
# login. Any tool that prompts → its cred id either wasn't in the
# manifest, wasn't present at install time (so nothing to capture),
# or the cred path lookup is wrong for that tool's current version.
```

### Troubleshooting

Common symptoms and likely causes:

| Symptom | Likely cause |
|---|---|
| `systemctl status zeta-creds-restore` reports "condition failed" | `/boot/zeta-creds.enc` doesn't exist on the installed system; check the install log for `[iter-5.5.0] ── 6.95-picker:` line + any `WARN: picker exited non-zero` output |
| `/boot/zeta-creds.enc` exists but restore-service fails on next boot | Wrong passphrase entered at the systemd-ask-password prompt; the scrypt → HKDF chain fails AEAD verification; retry next boot |
| Cred restored but `gh` (or another tool) still prompts for login | Either (a) the cred wasn't present at install time so the picker had nothing to capture, OR (b) the tool's cred-storage path changed between versions; cross-check against `tools/installer/zeta-creds-manifest.ts` defaultManifest |
| Install warns `picker exited non-zero` | USB UUID changed (e.g., reflashed onto a different USB stick); cred-blob is bound to USB UUID via scrypt → HKDF; reflash + re-enter passphrase to rebuild blob bound to new UUID |
| `systemd-ask-password` prompt doesn't fire on boot | Either `passphraseMode = "file"` is set, OR the restore service's `ConditionPathExists` is unmet (so the unit skipped); check `systemctl status zeta-creds-restore` |

## Disk failure recovery

NVMe dies → Longhorn marks the data path Unavailable → the cluster's
other replicas (default replica count 3 means 2 healthy copies
remain) keep serving the volumes → no app-visible interruption.

Replace the dead drive, then either:

- **Hot path** (drive replaced with identical model + position):
  reboot, disko recreates the partition table on the fresh drive,
  Longhorn re-registers the data path, replicas rebuild from peers.
- **Slow path** (drive serial changed): update the `zeta.disko.bootDisk`
  or an entry in `extraDisks` in `nixos/hosts/<host>/default.nix`,
  `nixos-rebuild switch --impure --flake .#<host> --target-host <host>` from
  any admin machine, then rebuild as above.

  > `--impure` is not optional. A flake ref evaluates PURE by default, and in
  > pure eval `builtins.pathExists` on an absolute path returns **false**
  > rather than erroring (measured 2026-08-21, Nix 2.34.6 — the measurement is
  > recorded in `src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts`).
  > Every module that reads `/etc/zeta/*` guards its `readFile` behind that
  > `pathExists`, so a pure rebuild silently reverts the node's hostname, its
  > k3s join endpoint and segment address, and drops the operator's authorized
  > SSH keys.
  >
  > **Caveat specific to `--target-host`:** evaluation happens on the ADMIN
  > machine, so the impure reads see the *admin's* `/etc/zeta/*`, not the
  > target's. On a remote rebuild the injected values are whatever the admin
  > box carries — usually nothing. Run the rebuild ON the node whenever an
  > injected value matters.

OS itself: the `/` partition lives on the boot disk only, so an extra
data-disk failure leaves the node fully bootable + Longhorn capacity
degrades until repair. A boot-disk failure takes the OS down —
reinstall via Step 5 onto the replacement disk; Longhorn data on
extra disks is re-imported when the rebuilt node rejoins.

## Disk shapes

`disko-shapes/longhorn-node.nix` is the single cookie-cutter shape:
1-disk (`extraDisks = [ ]`) through N-disk (`extraDisks = [ ... ]`).
Root max-fills the boot disk; no per-hardware-class shape file needed
for the common NVMe count cases. `2nvme.nix` remains as a backward-
compat import of the same module.

Hardware that needs a genuinely different topology (e.g. Jetson eMMC +
SD + NVMe) can still add a sibling under `disko-shapes/` later.
