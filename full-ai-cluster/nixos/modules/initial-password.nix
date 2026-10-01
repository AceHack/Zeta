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

  # docs/ops/INSTALL-TIME-CONFIG.md row 19. When no password was typed the installer MINTS a random
  # one-time password for this install (hash in `hashFile`, plus this marker) instead of leaving the
  # shared `zeta-change-me` default in effect, or -- when it could not be shown to anyone -- LOCKS the
  # account (the second marker). Both are applied ONCE (state file), so a later `passwd zeta` is never
  # reverted by the next `nixos-rebuild switch`.
  mintedMarker = "/etc/zeta/initial-password-minted";
  lockedMarker = "/etc/zeta/console-password-locked";
  stateFile = "/var/lib/zeta/console-password-applied";
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
      if [ -f "${lockedMarker}" ] && [ ! -f "${stateFile}" ]; then
        # The installer could neither mint nor show a one-time password: nobody holds a password for
        # this account, so it is LOCKED rather than left on the shared default.
        ${pkgs.shadow}/bin/usermod -L zeta
        ${pkgs.coreutils}/bin/mkdir -p "$(${pkgs.coreutils}/bin/dirname "${stateFile}")"
        ${pkgs.coreutils}/bin/touch "${stateFile}"
        echo "[console-password] zeta console password LOCKED (${lockedMarker}); use the SSH key, then 'sudo passwd zeta'"
      elif [ -f "${lockedMarker}" ]; then
        echo "[console-password] locked marker already applied once; leaving the account as the operator last set it"
      elif [ -f "${hashFile}" ] && [ -f "${mintedMarker}" ]; then
        # MINTED for this install, applied ONCE: after the operator rotates it, a rebuild must not
        # put the one-time password back.
        if [ -f "${stateFile}" ]; then
          echo "[console-password] minted one-time password already applied once; not re-applying"
        else
          hash=$(${pkgs.coreutils}/bin/cat "${hashFile}" | ${pkgs.coreutils}/bin/tr -d '\n')
          if [ -n "$hash" ] && [ "''${hash:0:3}" = '$6$' ]; then
            ${pkgs.shadow}/bin/usermod -p "$hash" zeta
            ${pkgs.coreutils}/bin/mkdir -p "$(${pkgs.coreutils}/bin/dirname "${stateFile}")"
            ${pkgs.coreutils}/bin/touch "${stateFile}"
            echo "[console-password] applied the install's one-time minted password hash (once)"
          else
            ${pkgs.shadow}/bin/usermod -L zeta
            echo "[console-password] WARN: ${hashFile} is not a sha512crypt hash; zeta console password LOCKED, not defaulted"
          fi
        fi
      elif [ -f "${hashFile}" ]; then
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
