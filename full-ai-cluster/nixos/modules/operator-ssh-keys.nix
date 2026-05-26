# full-ai-cluster/nixos/modules/operator-ssh-keys.nix
#
# Operator SSH public keys for the `zeta` user.
#
# Per #5086 Copilot P0 + the iter-4.2 readFile redesign: this module
# reads pubkeys from a SIBLING `operator-ssh-keys.txt` file rather
# than embedding them inline as Nix string literals. Rationale:
#
# - Eliminates the Nix-string-injection class entirely. Pubkey content
#   sourced from a USB-supplied file NEVER goes through the Nix string
#   parser (no need to escape `\`, `"`, or `${...}` interpolation
#   sequences). Untrusted content is data, not code.
# - Simpler write path. zeta-install.sh just `sudo tee`s the pubkey
#   file content into operator-ssh-keys.txt; no sed-escape pipeline.
# - Same edit-and-rebuild operator workflow for the v1 fallback path:
#   operators can edit operator-ssh-keys.txt directly + `sudo nixos-
#   rebuild switch --flake /etc/zeta/full-ai-cluster#<host>`.
#
# Format of operator-ssh-keys.txt:
# - One OpenSSH pubkey per line (ssh-ed25519 / ssh-rsa / ecdsa-sha2-* /
#   sk-ssh-ed25519@openssh.com / sk-ecdsa-sha2-*)
# - Lines starting with `#` are comments + ignored
# - Blank lines are ignored
#
# iter-4.2 zero-typing path: zflash on macOS writes the operator's
# ~/.ssh/id_ed25519.pub (or --ssh-key <path>) to the boot USB's FAT
# ESP as `zeta-authorized-keys.pub`. zeta-install.sh probes for that
# file + writes its content directly to operator-ssh-keys.txt before
# `nixos-install`. Per B-0789 the per-context attribution-chain
# framing (ServiceTitan / personal / LFG-only) lives in
# maintainers/aaron/legal-entities/inventory.md.
#
# Multi-key support: operator-ssh-keys.txt is a multi-line file;
# every non-comment / non-blank line becomes a separate
# authorizedKeys.keys entry.

{ config, pkgs, lib, ... }:

let
  keysFile = ./operator-ssh-keys.txt;
  rawLines = lib.splitString "\n" (builtins.readFile keysFile);
  isValidKeyLine = line:
    let trimmed = lib.removePrefix " " (lib.removeSuffix " " line);
    in trimmed != ""
       && !(lib.hasPrefix "#" trimmed);
in {
  users.users.zeta.openssh.authorizedKeys.keys =
    if builtins.pathExists keysFile
    then builtins.filter isValidKeyLine rawLines
    else [ ];
}
