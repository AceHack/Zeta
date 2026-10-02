# Operator access: who can become root on a node, and the break-glass when nobody can

Work item `081M3YY6TWX087G0R003HZTVWQ`. Code: `full-ai-cluster/nixos/modules/operator-sudo.nix`,
`initial-password.nix`, `common.nix`. Pinned by `src/Core.TypeScript/cluster/installer-parity.test.ts`.

## What happened (measured on `node-5b2dfa`, 2026-10-02)

SSH key login worked. `sudo` did not. `zeta` is in `wheel`, `security.sudo.wheelNeedsPassword` is true, and the console
password was the one the **v1** installer minted and displayed once; it scrolled off and nobody held it. The operator had
a shell and no root, so no privileged fix (a firewall rule, an `/etc/hosts` line, a `nixos-rebuild`) could be applied.

## What the installer provisions today

| piece | where | default |
| --- | --- | --- |
| login keys for `zeta` | `operator-ssh-keys.nix` (baked fallback), `operator-authorized-keys.nix` (captured at install), `zflash --ssh-key` | required for any remote login; `PasswordAuthentication = false` |
| group | `common.nix` `extraGroups = [ "wheel" ... ]` | `wheel` |
| sudo policy | `common.nix` `security.sudo.wheelNeedsPassword = lib.mkDefault true` | password required |
| the password | install-time policy `--console-password default\|mint` (`initial-password.nix`, `docs/DECISIONS/2026-10-01-console-password-policy-default-is-the-public-password.md`) | **`default`**: the public `zeta-change-me`, applied once, with a login reminder until changed. `mint` is the opt-in that can strand you. A password typed at the installer always wins. |

So **a node installed from the v3 stick (policy `default`) is not in the stranded state**: the console password exists and
is known. The state arises only under `mint`, or after a typed password is forgotten, or on a node installed from the v1
stick (which is what `node-5b2dfa` is).

## The security trade, stated rather than settled

Under policy `default` the password is public, so **anyone with console or `ssh`+`sudo` access to a wheel session is root**; the
threat model is physical access (the ADR above). Anything that makes root cheaper than that on a node whose password is
*not* public is a real change in blast radius, which is why nothing below is on by default.

## Option 1 (implemented, OFF by default): sudo by SSH-agent signature

```nix
# in the host's configuration.nix (e.g. full-ai-cluster/nixos/hosts/control-plane/configuration.nix)
zeta.operatorSudo.sshAgentAuth = true;
```

then `sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#<host>` and connect with `ssh -A zeta@<node>`.
`sudo` then accepts a signature from the forwarded agent over the keys listed in `/etc/ssh/authorized_keys.d/zeta` (the same
keys that grant SSH login), and **the password prompt stays as the fallback**. NixOS adds `env_keep+=SSH_AUTH_SOCK` to sudo
itself when `security.pam.sshAgentAuth.enable` is set.

What you give up: with it on, **holding the SSH key (with a forwarded agent) is sufficient for root**. A stolen key is root. On
a node under policy `default` that costs nothing (the key holder could already `sudo` with the public password); on a node with a
typed or minted password it removes a second factor. That is the owner's call, hence opt-in.

**Not verified:** nothing was booted and nix was not available where this was written; the PAM acceptance of an agent signature is
unproven until a login shows it. The eval check `installer-parity-model` pins only that the option exists, defaults off and reaches
`security.pam.sshAgentAuth.enable` when forced on (the sudo service's own flag is already true on stock NixOS, so the global flag is the whole switch).

## Rejected: `NOPASSWD` for `wheel` (or for `nixos-rebuild`)

`security.sudo.wheelNeedsPassword = false` grants root to **any** wheel session with no secret and no signature at all. A narrower
`NOPASSWD: /run/current-system/sw/bin/nixos-rebuild` is root by another name: a rebuild installs whatever flake it is pointed at. Neither
is offered.

## Break-glass: recover a node nobody can `sudo` on, WITHOUT reinstalling

Prerequisite: physical (or KVM) access and a way to boot a USB. **No wipe is involved.**

1. Boot a **stock NixOS minimal installer image** (nixos.org), *not* the Zeta installer USB. The Zeta USB's first boot is an
   auto-install flow whose purpose is to wipe and install; it has an abort-to-shell key, but a break-glass should not depend
   on racing it. (The Zeta installer's own *repair mode*, `usb-nixos-installer/README.md`, re-installs preserving identity; it is a
   re-install, not a password recovery.)
2. Find the root filesystem. The installer labels it `nixos` (`zeta-install.sh`: `mkfs.ext4 -L nixos`) and the ESP `boot`:
   ```bash
   sudo mount /dev/disk/by-label/nixos /mnt
   sudo mount /dev/disk/by-label/boot  /mnt/boot
   ```
3. Set the password inside the installed system and leave:
   ```bash
   sudo nixos-enter --root /mnt -c 'passwd zeta'
   sudo umount -R /mnt && sudo reboot
   ```
   A password set this way persists: `initial-password.nix` applies the install-time password **once** (state file
   `/var/lib/zeta/console-password-applied`) and never reverts a later `passwd`.
4. After boot, `ssh zeta@<node>` and `sudo` with the new password. Consider Option 1 above before the next rebuild.

If the node has **two** disks with a `nixos`-labelled filesystem, stop and identify the right one by size and `lsblk` before mounting.
This runbook was written from the installer's labelling and from NixOS's documented `nixos-enter`; it has **not** been exercised on a
real node.

## Unchanged, on purpose

- SSH `PasswordAuthentication` stays `false`; this adds no network password surface.
- The console-password policy and its default are the owner's recorded decision and are untouched.
- No installer prompt or `zflash` flag was added for `sshAgentAuth`: a key-based sudo that an installer could enable without the owner
  reading the trade above is exactly the silent weakening to avoid. If the owner wants it as an install-time choice, it follows the
  existing `ZETA_CONSOLE_PASSWORD_POLICY` plumbing (zflash flag -> ESP conf -> installer -> `/etc/zeta/...` -> a Nix read).
