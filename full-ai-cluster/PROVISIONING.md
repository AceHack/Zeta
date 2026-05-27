# Provisioning a new node — cookie-cutter workflow

End-to-end: physical box arrives → boots into running cluster
member with replicated Longhorn capacity. Six values to change
per box, no hand-partitioning, no shell scripts.

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

## Step 2: change the six placeholder values

Open `full-ai-cluster/nixos/hosts/$HOST/default.nix` and edit
each of the six clearly-marked PLACEHOLDER blocks:

| What | Where to get it |
|------|-----------------|
| `networking.hostName` | the name you chose above (`worker-gpu-03`) |
| `networking.hostId` | `head -c4 /dev/urandom \| od -A n -t x4 \| tr -d ' '` |
| `zeta.disko.nvme0` | On the live system: `ls -l /dev/disk/by-id/ \| grep nvme \| awk '{print $9, $11}'` — pick the disk you want to BE the boot disk (gets OS + first Longhorn data path) |
| `zeta.disko.nvme1` | Same listing, the other NVMe (becomes pure Longhorn data) |
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
on tty1 (per B-0754 zero-typing scope):

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

2. **B-0852.3b — cred-blob passphrase prompt** (Step 6.56;
   default-on per B-0852.3c since 2026-05-27)
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

6. **Cluster-type menu** (Step 6 host-attribute selection; B-0857.2
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

7. **Step 6.95-picker — cred-blob picker** (B-0852.3c default-on
   since 2026-05-27)
   Auto-fires when all 3 preconditions are met:
   - `ZETA_CREDS_PICKER` is unset OR set to `1` (default-on; opt out
     via `ZETA_CREDS_PICKER=0` OR `touch /etc/zeta/no-picker`)
   - `ZETA_CREDS_PASSPHRASE` is set (auto-populated by Step 6.56)
   - `/etc/zeta/usb-uuid` is present (auto-captured by B-0852.3a-prep
     during iter-4.2 ESP probe)
   On opt-out, the SPECIFIC reason is echoed (no generic
   `set ZETA_CREDS_*=1 to enable` message anymore).

### Subsequent-boot credential restore (B-0852.4 since 2026-05-27)

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

## Disk failure recovery

NVMe dies → Longhorn marks the data path Unavailable → the cluster's
other replicas (default replica count 3 means 2 healthy copies
remain) keep serving the volumes → no app-visible interruption.

Replace the dead drive, then either:

- **Hot path** (drive replaced with identical model + position):
  reboot, disko recreates the partition table on the fresh drive,
  Longhorn re-registers the data path, replicas rebuild from peers.
- **Slow path** (drive serial changed): update the `zeta.disko.nvme0`
  or `nvme1` by-id symlink in `nixos/hosts/<host>/default.nix`,
  `nixos-rebuild switch --flake .#<host> --target-host <host>` from
  any admin machine, then rebuild as above.

OS itself: the `/` partition lives on `nvme0` only, so a `nvme1`
failure leaves the node fully bootable + Longhorn capacity
degrades by half until repair. An `nvme0` failure takes the OS
down — reinstall via Step 5 onto the replacement disk; Longhorn
data on `nvme1` is re-imported when the rebuilt node rejoins.

## Multi-shape support

`disko-shapes/2nvme.nix` is the shape for the current hardware.
Adding a new hardware class (e.g. 4 NVMes, or NVMe + SATA SSD mix)
means:

1. Author `disko-shapes/<new-shape>.nix` matching the
   `zeta.disko` options pattern
2. Author a new host template under `hosts/<new-class>-template/`
   that imports it
3. Cookie-cutter from THAT template for boxes of the new class

The Longhorn module (`modules/longhorn-disks.nix`) is shape-
agnostic — it takes a list of mount paths and wires them, no
matter how many disks contributed those mounts.
