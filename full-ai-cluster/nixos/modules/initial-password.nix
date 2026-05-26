# full-ai-cluster/nixos/modules/initial-password.nix
#
# Initial password substrate for the `zeta` user on fresh installs.
#
# iter-5.3 (B-0792 follow-on; the operator 2026-05-26 "also on
# startup can it ask for me to type a password instead of having a
# default"): the operator-chosen password set at install-time via
# zeta-install.sh's prompt-password step (read -s + mkpasswd → hash
# → /mnt/etc/zeta/initial-hashedpassword).
#
# B-0835 Bug 3b FIX (2026-05-26): the prior implementation read the
# file via `builtins.readFile` at NixOS EVALUATION TIME (build-time).
# That fails operationally because:
#
#   1. During `nixos-install` from live ISO: the build evaluation
#      happens BEFORE the chroot pivot; the path `/etc/zeta/initial-
#      hashedpassword` refers to the LIVE ISO (file not there), NOT
#      the install target's `/mnt/etc/zeta/initial-hashedpassword`
#   2. Flake pure-mode (default for `nixos-install --flake`) refuses
#      to read non-store absolute paths via `builtins.readFile`
#
# Result: build silently fell back to the default-hash, custom
# password was IGNORED on the installed system. Operator's empirical
# anchor 2026-05-26: "the password i set it still says password:
# zeta-change-me" + "the password error is not just display issue
# it's operational bug the password i set earlier in install is
# ignored".
#
# FIX: use a NixOS activation script that reads the file at
# ACTIVATION TIME (runtime on the installed system, when /etc/zeta/
# IS the actual path with the operator's hash). The build-time
# config uses the default-hash; the activation script overrides it
# via `usermod -p $hash zeta` if the operator-chosen hash file
# exists. This works for:
#
#   - Fresh installs from live ISO (activation runs on installed
#     system after pivot; /etc/zeta/initial-hashedpassword present)
#   - Subsequent nixos-rebuilds (file persists; activation re-applies)
#   - CI eval (file absent; activation skips; default-hash stays)
#
# BACKWARD-COMPAT: same fallback hash applies when the file is
# absent. Operator can rotate via `passwd zeta` post-install.
#
# Hash format: sha512crypt ($6$...). zeta-install.sh generates via
# mkpasswd from the nixpkgs `mkpasswd` package.

{ config, pkgs, lib, ... }:

let
  # iter-4 v1 backward-compat fallback hash (= sha512crypt of
  # "zeta-change-me"). Build-time default; activation overrides
  # if /etc/zeta/initial-hashedpassword exists at activation time.
  fallbackHash =
    "$6$wMTsqITU4II043Y8$DBR58Hhh.d975YkA40kwYNxQAunevJ9Cu9rYYigi9YjBYVEjlNrs.rk4hu.332sh6GkQuCb7yyLYr7lPTxySD1";

  hashFile = "/etc/zeta/initial-hashedpassword";
in
{
  # Build-time default; will be overridden at activation if the
  # operator-chosen hash file is present on the installed system.
  users.users.zeta.hashedPassword = fallbackHash;

  # B-0835 Bug 3b fix — runtime password injection via activation
  # script. Runs after users.users.* but before login services; the
  # `usermod -p` call directly updates /etc/shadow.
  system.activationScripts.zetaInitialPassword = {
    deps = [ "users" ];
    text = ''
      if [ -f "${hashFile}" ]; then
        hash=$(${pkgs.coreutils}/bin/cat "${hashFile}" | ${pkgs.coreutils}/bin/tr -d '\n')
        if [ -n "$hash" ] && [ "''${hash:0:3}" = '$6$' ]; then
          ${pkgs.shadow}/bin/usermod -p "$hash" zeta
          echo "[iter-5.3 / B-0835 Bug 3b fix] applied operator-chosen password hash from ${hashFile}"
        else
          echo "[iter-5.3 / B-0835 Bug 3b fix] WARN: ${hashFile} present but content is not a sha512crypt hash; default stays"
        fi
      else
        echo "[iter-5.3 / B-0835 Bug 3b fix] ${hashFile} absent; default fallback hash stays in effect (rotate via 'passwd zeta')"
      fi
    '';
  };
}
