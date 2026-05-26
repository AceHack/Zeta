# full-ai-cluster/nixos/modules/operator-authorized-keys.nix
#
# iter-5.4.0 (B-0794 sub-target homelab-mode; the maintainer 2026-05-26
# "i'll wait till we have the install.sh and git native device
# registration into github is ready before i run again" + Mika
# substrate "USB ships with NO embedded credentials; first boot prompts
# gh auth login + operator authenticates + auto-copy operator's pubkey
# to authorized_keys").
#
# This module reads operator SSH pubkeys captured at install time by
# zeta-install.sh's gh-auth-login step (Step 6.8). The shell does the
# interactive `gh auth login` + `gh ssh-key list --json key,id,title`
# extraction, writes to /mnt/etc/zeta/operator-authorized-keys (one key
# per line; standard authorized_keys format). This module reads that
# file at NixOS evaluation time + adds the keys to
# users.users.zeta.openssh.authorizedKeys.keys.
#
# Composes with the existing iter-4.2 operator-ssh-keys.nix substrate
# — those are statically-baked maintainer keys; this module is
# dynamically-captured operator keys (whoever flashed + booted the
# USB). Both compose at users.users.zeta.openssh.authorizedKeys.keys
# (additive).
#
# BACKWARD-COMPAT FALLBACK: if /etc/zeta/operator-authorized-keys does
# NOT exist (e.g., during nixos-rebuild on an already-installed system
# where the file was never written, OR during `nix flake check` in CI
# where the file path is meaningless), this module contributes the
# empty list — no harm; the existing iter-4.2 keys (if any) still
# apply.
#
# Format: standard authorized_keys file. One pubkey per line. Comments
# starting with `#` allowed; blank lines allowed. Filtered to only
# lines starting with `ssh-` (ssh-rsa/ssh-ed25519/ssh-dss/etc.) +
# `ecdsa-sha2-...` (for ECDSA pubkeys).

{ config, pkgs, lib, ... }:

let
  keyFile = "/etc/zeta/operator-authorized-keys";

  rawContents =
    if builtins.pathExists keyFile
    then builtins.readFile keyFile
    else "";

  # Split on newlines + filter out comments + blank lines + only keep
  # lines that look like SSH pubkeys (start with ssh- or ecdsa-).
  splitLines = lib.strings.splitString "\n" rawContents;
  isKeyLine = line:
    let trimmed = lib.strings.trim line;
    in trimmed != ""
       && !(lib.hasPrefix "#" trimmed)
       && (lib.hasPrefix "ssh-" trimmed || lib.hasPrefix "ecdsa-" trimmed);
  operatorKeys = lib.lists.filter isKeyLine splitLines;
in
{
  users.users.zeta.openssh.authorizedKeys.keys = operatorKeys;
}
