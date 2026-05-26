# full-ai-cluster/nixos/modules/initial-password.nix
#
# Initial password substrate for the `zeta` user on fresh installs.
#
# iter-5.3 (B-0792 follow-on; the maintainer 2026-05-26 "also on
# startup can it ask for me to type a password instead of having a
# default"): the operator-chosen password set at install-time via
# zeta-install.sh's prompt-password step (read -s + mkpasswd → hash
# → /mnt/etc/zeta/initial-hashedpassword). This module reads that
# file via builtins.readFile at NixOS evaluation time + uses it
# for users.users.zeta.hashedPassword.
#
# Operator UX (one TYPED prompt at install time; can't avoid for
# password since secrets shouldn't transit non-operator surfaces):
#
#   zeta-install.sh:
#     [iter-5.3] Set initial password for the `zeta` user:
#                (will be required for console login; not for SSH
#                if iter-4.2 pubkey was injected)
#     Password: ********
#     Confirm:  ********
#     [iter-5.3]   wrote hash to /mnt/etc/zeta/initial-hashedpassword
#
# Operator can still rotate later via `passwd zeta` if they want
# to change it again.
#
# BACKWARD-COMPAT FALLBACK: if /etc/zeta/initial-hashedpassword
# does NOT exist (e.g., during nixos-rebuild on an already-installed
# system where the file was never written, OR during `nix flake
# check` in CI where the file path is meaningless), fall back to
# the documented iter-4.x default hash of `zeta-change-me` so the
# module still evaluates + the system still has a known-default
# credential. Operator should rotate immediately in that case.
#
# Hash format: sha512crypt ($6$...). zeta-install.sh generates via
# mkpasswd from the nixpkgs `mkpasswd` package.

{ config, pkgs, lib, ... }:

let
  hashFile = "/etc/zeta/initial-hashedpassword";
  injectedHash =
    if builtins.pathExists hashFile
    then
      let
        raw = builtins.readFile hashFile;
        trimmed = lib.removeSuffix "\n" raw;
      in
      if lib.hasPrefix "$6$" trimmed then trimmed else null
    else null;
  # iter-4 v1 backward-compat fallback hash (= sha512crypt of
  # "zeta-change-me"). Used when the operator-chosen hash isn't
  # present (e.g., CI eval, nixos-rebuild without prior install).
  fallbackHash =
    "$6$wMTsqITU4II043Y8$DBR58Hhh.d975YkA40kwYNxQAunevJ9Cu9rYYigi9YjBYVEjlNrs.rk4hu.332sh6GkQuCb7yyLYr7lPTxySD1";
in
{
  users.users.zeta.hashedPassword =
    if injectedHash != null then injectedHash else fallbackHash;
}
