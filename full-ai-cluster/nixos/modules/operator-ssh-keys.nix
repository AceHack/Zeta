# full-ai-cluster/nixos/modules/operator-ssh-keys.nix
#
# Operator SSH public keys for the `zeta` user.
#
# This file ships as an EMPTY STUB in the repo. zeta-install.sh
# overwrites it during install with the contents of the boot USB's
# `/zeta-authorized-keys.pub` file (which zflash-setup.ts copies from
# the operator's `~/.ssh/id_ed25519.pub` by default, or whichever key
# was passed via `--ssh-key <path>`).
#
# After install, the operator can SSH-in to the cluster node as the
# `zeta` user using the matching private key on their workstation.
#
# Multi-key support: zflash-setup.ts accepts `--ssh-key <path>`
# repeatedly; the resulting `/zeta-authorized-keys.pub` is a multi-line
# file with one pubkey per line; zeta-install.sh injects each line as
# a separate entry below. Per B-0789 the per-context (ServiceTitan vs
# personal vs LFG-only) attribution-chain framing lives in
# maintainers/aaron/legal-entities/inventory.md; this module just
# carries the public-key material the operator chose.
#
# Manual edit path: operators can edit this file directly + re-run
# `sudo nixos-rebuild switch` to add/remove keys without reflashing
# the USB.

{ config, pkgs, lib, ... }:

{
  users.users.zeta.openssh.authorizedKeys.keys = [
    # Populated by zeta-install.sh from /zeta-authorized-keys.pub on
    # the boot USB. Empty by default — the operator can also paste
    # ssh-ed25519 / ssh-rsa lines here manually + nixos-rebuild.
  ];
}
