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
# AUTHORIZATION (the identity<->authorization split, decision doc 2026-06-21):
#   TrustedUserCAKeys says "trust certs the CA signed"; it does NOT by itself
#   say WHICH users may use THIS machine. That is the per-machine
#   AuthorizedPrincipalsFile: a list of usernames allowed on this host. The
#   list is plain DATA (machines/principals.json -> host -> [usernames]); the
#   (user x machine) pairing lives in that list, NEVER a composite id (the
#   #8926 / Key-ID NxM lesson). This module reads THIS host's slice of that
#   data and renders it into a static principals file sshd points at.
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
#   * AuthorizedPrincipalsFile is set ONLY when machines/principals.json
#     EXISTS and lists THIS host with >=1 username (a SECOND pathExists +
#     non-empty guard, the SAME discipline) — absent/empty data -> no
#     principals line -> no behavior change.
#
# ACTIVATION (operator step, NOT this PR):
#   1. Run the CA generator + commit the CA public key:
#        bun tools/setup/persona-keys/ca-cli.ts ca --ca aaron --commit-pub
#        git add maintainers/aaron/ssh-ca.pub && git commit
#   2. Point `caPubFile` below at that committed pubkey (or copy it to a
#      path under this module's dir) and IMPORT this module in the node's
#      configuration, then `nixos-rebuild switch`.
#   3. (Authorization) Add this host to machines/principals.json with the
#      usernames allowed on it, e.g. { "<host>": ["aaron", "addison"] }, and
#      commit. The principal names must match the user certs' `-n` principals.
#
# Anchors: OpenSSH `sshd_config(5)` TrustedUserCAKeys + AuthorizedPrincipalsFile
# / `ssh-keygen(1)` -s; OpenSSH PROTOCOL.certkeys; Vault SSH secrets engine +
# cert-manager (the in-cluster migration target; principals source -> IdP later).

{ config, lib, pkgs, ... }:

let
  # The committed CA PUBLIC key (the git-distributed trust root). This lands
  # when the operator runs `ca-cli.ts ca --commit-pub` (see ACTIVATION).
  # Default points at the operator's maintainer dir; override per deployment.
  caPubFile = ../../../maintainers/aaron/ssh-ca.pub;

  # INERT until the CA pubkey actually exists: importing this module before the
  # operator has generated + committed the CA must not break the build.
  caPresent = builtins.pathExists caPubFile;

  # ── AUTHORIZATION: per-machine authorized-principals (the ownership LIST) ──
  # The single source of the ownership matrix: host -> [usernames]. Same dir +
  # change-rate as the machines/<host>.pub registry (a DV2.0 satellite). It is
  # plain text data (usernames only — NO key material, NO secrets).
  principalsFile = ../../../machines/principals.json;
  principalsPresent = builtins.pathExists principalsFile;

  # This node's hostname is the lookup key — a machine knows its OWN host at
  # eval time, so we render exactly THIS host's list (no Match blocks, no
  # per-user tokens; one static AuthorizedPrincipalsFile is enough).
  thisHost = config.networking.hostName;

  principalsData = if principalsPresent then builtins.fromJSON (builtins.readFile principalsFile) else { };

  # The usernames authorized on THIS host (empty if the host is absent / data
  # absent). Defensive: only string entries; sorted for a byte-stable file.
  rawPrincipals = principalsData.${thisHost} or [ ];
  hostPrincipals = lib.sort (a: b: a < b) (lib.filter builtins.isString rawPrincipals);
  hasPrincipals = principalsPresent && (builtins.length hostPrincipals) > 0;

  # The rendered AuthorizedPrincipalsFile body: one username per line. sshd
  # ignores blank lines + `#` comments; we emit a header comment + the names.
  principalsRendered = pkgs.writeText "zeta-authorized-principals-${thisHost}" (''
    # Zeta per-machine AuthorizedPrincipalsFile for ${thisHost}
    # Source: machines/principals.json (host -> authorized usernames).
    # The (user x machine) pairing lives in THIS list, never a composite id.
  '' + lib.concatStringsSep "\n" hostPrincipals + "\n");
in
{
  # When the CA public key is present, anchor sshd's user-cert trust at it:
  # any device key the CA signed into a cert (principal = a node-authorized
  # user) is accepted, with NO per-machine authorizedKeys entry.
  config = lib.mkIf caPresent {
    services.openssh.extraConfig = lib.mkAfter (''
      TrustedUserCAKeys ${caPubFile}
    '' + lib.optionalString hasPrincipals ''
      AuthorizedPrincipalsFile ${principalsRendered}
    '');
  };
}
