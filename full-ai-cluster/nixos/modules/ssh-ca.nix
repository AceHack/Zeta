# full-ai-cluster/nixos/modules/ssh-ca.nix
#
# SSH Certificate Authority trust anchor for the `zeta` user (workitem
# 081KVM1TK3Z08QG0R0002959G6 §"Trust distribution" — Option B, the
# forward-compatible pre-cluster CA).
#
# WHY (the N×M trap this replaces):
#   operator-ssh-keys.nix gives sshd a LIST of trusted pubkeys
#   (authorizedKeys.keys) — every node must list every dev machine
#   independently. This module instead points sshd at ONE CA public key
#   via `TrustedUserCAKeys`: a node then trusts ANY device key that the CA
#   has SIGNED into a cert (`principal=zeta` + machine id + validity
#   window). N-trust-1, not N×M; per-machine certs give per-machine
#   revocation + the rolling-keys validity discipline.
#
#   git is the DISTRIBUTION channel for the CA *public* key, never the
#   secret store: the CA private key is operator-held (umask 077) and
#   never lands in git. Migration (no model change): this git-distributed
#   CA pubkey -> Vault SSH secrets engine custody + cert-manager issuance
#   later (same trust model, upgraded custody).
#
# STATUS — ADDITIVE + INERT (this PR ships the module; it does NOT flip the switch):
#   * operator-ssh-keys.nix is UNCHANGED and remains the active trust path.
#   * This module is NOT imported into any node config by this PR.
#   * It references the committed CA pubkey at the path below, which LANDS
#     only when the operator runs `tools/setup/persona-keys/ca-cli.ts ca
#     --ca <name> --commit-pub` and commits the resulting ssh-ca.pub.
#   * Until both (the pubkey exists AND an operator imports this module),
#     it does nothing — `programs.ssh` / sshd config is set ONLY when the
#     CA pubkey file is present (a `pathExists` guard makes it inert
#     pre-CA so importing it early cannot break a build).
#
# ACTIVATION (operator step, NOT this PR):
#   1. Run the CA generator + commit the CA public key:
#        bun tools/setup/persona-keys/ca-cli.ts ca --ca aaron --commit-pub
#        git add maintainers/aaron/ssh-ca.pub && git commit
#   2. Point `caPubFile` below at that committed pubkey (or copy it to a
#      path under this module's dir) and IMPORT this module in the node's
#      configuration, then `nixos-rebuild switch`.
#
# Anchors: OpenSSH `sshd_config(5)` TrustedUserCAKeys / `ssh-keygen(1)` -s;
# OpenSSH PROTOCOL.certkeys; Vault SSH secrets engine + cert-manager
# (the in-cluster migration target).

{ config, lib, pkgs, ... }:

let
  # The committed CA PUBLIC key (the git-distributed trust root). This lands
  # when the operator runs `ca-cli.ts ca --commit-pub` (see ACTIVATION).
  # Default points at the operator's maintainer dir; override per deployment.
  caPubFile = ../../../maintainers/aaron/ssh-ca.pub;

  # INERT until the CA pubkey actually exists: importing this module before the
  # operator has generated + committed the CA must not break the build.
  caPresent = builtins.pathExists caPubFile;
in
{
  # When the CA public key is present, anchor sshd's user-cert trust at it:
  # any device key the CA signed into a cert (principal = a node-authorized
  # user) is accepted, with NO per-machine authorizedKeys entry.
  config = lib.mkIf caPresent {
    services.openssh.extraConfig = lib.mkAfter ''
      TrustedUserCAKeys ${caPubFile}
    '';
  };
}
