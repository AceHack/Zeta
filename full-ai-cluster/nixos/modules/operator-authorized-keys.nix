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
# "no harm" HAS A THIRD CASE, and it is not harmless. MEASURED 2026-08-21
# (Determinate Nix 3.21.0 / Nix 2.34.6):
#
#     builtins.pathExists "<absolute path>"  in pure eval -> false, no error
#     builtins.readFile   "<absolute path>"  in pure eval -> error, loud
#
# A flake ref evaluates PURE by default. So the fallback fires not only when
# the file is missing, but whenever the rebuild is pure — the file can be
# sitting right there and `pathExists` still answers false, silently. Under
# `nixos-rebuild switch --flake ...` without `--impure`, this module therefore
# contributes `[ ]` on a machine whose operator keys ARE present, and the
# operator's captured pubkeys are REMOVED from the installed system's
# authorized_keys. On a node reachable only over SSH that is a lockout,
# produced by a routine update. Every `nixos-rebuild` string in this repo now
# carries `--impure`; `src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts`
# is the check that keeps it that way.
#
# Format: standard authorized_keys file. One pubkey per line. Comments
# starting with `#` allowed; blank lines allowed. Filtered to lines
# starting with any supported pubkey-algorithm prefix:
#   - `ssh-`     — ssh-rsa, ssh-ed25519, ssh-dss
#   - `ecdsa-`   — ecdsa-sha2-nistp256/384/521
#   - `sk-ssh-`  — FIDO/U2F security-key-backed Ed25519 (RFC8709)
#   - `sk-ecdsa-` — FIDO/U2F security-key-backed ECDSA
# GitHub stores all of the above when operators register them; the
# existing operator-ssh-keys.nix substrate documents sk-* support so
# this module keeps parity (Copilot P1 finding on PR #5210 fix-fwd).

{ config, pkgs, lib, ... }:

let
  keyFile = "/etc/zeta/operator-authorized-keys";

  rawContents =
    if builtins.pathExists keyFile
    then builtins.readFile keyFile
    else "";

  # Split on newlines + filter out comments + blank lines + only keep
  # lines that look like SSH pubkeys. Supported prefixes per the
  # comment block above include FIDO/U2F sk-* types so operators with
  # security-key-only GitHub setups aren't silently dropped.
  splitLines = lib.strings.splitString "\n" rawContents;
  validPrefixes = [ "ssh-" "ecdsa-" "sk-ssh-" "sk-ecdsa-" ];
  hasValidPrefix = s: lib.lists.any (p: lib.hasPrefix p s) validPrefixes;
  isKeyLine = line:
    let trimmed = lib.strings.trim line;
    in trimmed != ""
       && !(lib.hasPrefix "#" trimmed)
       && hasValidPrefix trimmed;
  operatorKeys = lib.lists.filter isKeyLine splitLines;
in
{
  users.users.zeta.openssh.authorizedKeys.keys = operatorKeys;
}
