# full-ai-cluster/nixos/modules/operator-sudo.nix
#
# docs/ops/INSTALL-TIME-CONFIG.md row 32 -- how the operator gets root on the node, and the OPT-IN
# key-based alternative to a password. The default is unchanged.
#
# THE DEFECT (MEASURED 2026-10-02, node-5b2dfa). SSH key login worked (operator-ssh-keys.nix /
# operator-authorized-keys.nix) and `sudo` did not: `zeta` is in `wheel`, `wheelNeedsPassword` is true,
# and the console password was the one the v1 installer MINTED and showed once. It scrolled off; nobody
# held it. The operator had a shell and no root. Two layers already answer it, and this module is the
# third, not a replacement:
#
#   1. The install-time console-password POLICY (initial-password.nix; docs/DECISIONS/
#      2026-10-01-console-password-policy-default-is-the-public-password.md). The repo default
#      `default` gives a password that cannot be lost; `mint` is the explicit opt-in and the one that
#      can strand an operator. A node installed from the v3 stick is not in this state.
#   2. The BREAK-GLASS runbook (docs/ops/OPERATOR-SUDO-BREAK-GLASS.md): recover a stranded node from
#      the installer USB with `nixos-enter` and `passwd zeta`, no reinstall, no wipe.
#
# THIS MODULE adds the option that makes the stranded state impossible without making root cheaper: with
# `zeta.operatorSudo.sshAgentAuth = true`, `sudo` accepts a signature from the operator's FORWARDED
# ssh-agent over the SAME keys that already grant SSH login (pam_ssh_agent_auth, NixOS
# `security.pam.sshAgentAuth.enable`), and the password prompt remains as the fallback. Nothing is granted
# without a key the operator already held; nothing needs a secret to be remembered.
#
# WHY IT IS OFF BY DEFAULT -- the judgment call, stated rather than made silently. Enabling it turns
# "holds the SSH key" into "can become root" on a node whose password is NOT public (a typed or minted
# one). That is a real change in blast radius: a stolen key plus a forwarded agent is root. Under the
# repo-default `default` policy the password is public, so a key holder can already sudo and this adds
# nothing; under `mint` or a typed password it removes a second factor. That trade belongs to the node's
# owner, so the module offers it and does not make it. NOPASSWD for `wheel` was rejected outright: it
# grants root to ANY wheel session, key or not, with no signature at all.
#
# REQUIREMENTS the operator must meet for it to work (`ssh -A <node>`; an agent holding a key listed in
# /etc/ssh/authorized_keys.d/zeta). NixOS adds `Defaults env_keep+=SSH_AUTH_SOCK` to sudo itself when
# `security.pam.sshAgentAuth.enable` is set (nixos/modules/security/pam.nix, optionalSudoConfigForSSHAgentAuth).
#
# NOT VERIFIED (no nix on the authoring machine, nothing booted): that the PAM stack accepts the key on a
# real node. nixos/tests/installer-parity-eval-test.nix pins that the option exists, defaults OFF, and when
# forced on reaches `security.pam.sshAgentAuth.enable`; only a login shows the sudo.
#
# ONE SWITCH, NOT TWO -- CAUGHT BY THE FIRST CI EVAL, NOT BY READING. nixos/modules/security/sudo.nix sets
# `security.pam.services.sudo.sshAgentAuth = true` UNCONDITIONALLY; the rule only takes effect when the
# GLOBAL `security.pam.sshAgentAuth.enable` is also true (pam.nix: `enable = config.security.pam.sshAgentAuth.enable
# && cfg.sshAgentAuth`). So the global flag is the whole switch, and an earlier draft of this module (and its
# test) that treated the per-service flag as a second, default-off switch was wrong about stock NixOS.

{ config, lib, ... }:

let
  cfg = config.zeta.operatorSudo;
  authorizedKeys = config.users.users.zeta.openssh.authorizedKeys.keys;
in
{
  options.zeta.operatorSudo.sshAgentAuth = lib.mkOption {
    type = lib.types.bool;
    default = false;
    description = ''
      Let `sudo` accept a signature from the operator's forwarded ssh-agent, over the keys that
      already grant SSH login for `zeta`, with the password prompt kept as the fallback. OFF by
      default: it makes "holds the SSH key" sufficient for root on a node whose password is not
      public. See docs/ops/OPERATOR-SUDO-BREAK-GLASS.md.
    '';
  };

  config = lib.mkMerge [
    (lib.mkIf cfg.sshAgentAuth {
      security.pam.sshAgentAuth.enable = true;

      # Enabled with no key to authenticate against it does nothing but look configured.
      warnings = lib.optional (authorizedKeys == [ ])
        "zeta.operatorSudo.sshAgentAuth is on but users.users.zeta has no authorized SSH keys, so no agent signature can ever be accepted; sudo will still ask for the password.";
    })
  ];
}
