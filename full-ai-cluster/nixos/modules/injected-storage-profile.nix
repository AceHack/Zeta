# full-ai-cluster/nixos/modules/injected-storage-profile.nix
#
# docs/ops/INSTALL-TIME-CONFIG.md row 29 -- the storage profile as INSTALL-TIME configuration.
#
# THE DEFECT: the Longhorn PVC sizes were whatever the committed tree said (the `measured` rung,
# 943 GiB declared). A box whose pool could not hold that rung was REFUSED at install -- a hard stop
# on an ordinary single-1-TB-disk machine -- although the catalogue already prices the same claims at
# smaller rungs (k8s/storage-profiles.json). zeta-install.sh now measures the pool it provisions and
# picks the largest rung that fits; this module is how that choice reaches the cluster.
#
# THE MECHANISM -- the one the public domain / LoadBalancer range already use
# (injected-public-tls.nix, injected-lb-pool.nix), not a second one:
#   zeta-install.sh writes /mnt/etc/zeta/storage-profile (a bare rung name) and symlinks it to
#   /etc/zeta/ for `nixos-install --impure` evaluation. This module reads it at evaluation time and,
#   on a k3s SERVER, adds one entry to the k3s auto-deploy roster: the `zeta-storage-profile` ArgoCD
#   Application, rendered from k8s/storage-profile/argocd-application.yaml.in by substituting ONE
#   token. That Application's kustomize base carries no profile; its Jobs merge-patch the git-owned
#   Applications' size leaves, and the root ignores exactly those leaves (root-application.yaml).
#
# ABSENT -> this module contributes nothing: the cluster runs the committed rung, which is also what
# the installer writes NOTHING for (a pool that fits the committed rung needs no install-time config).
# PRESENT BUT NOT A RUNG -> refused at evaluation, loudly, naming the file.
#
# NEVER SHRINKS. Kubernetes can grow a PVC and cannot shrink one, so a profile lower than one already
# applied cannot be honoured on a live cluster -- the API server refuses it and the Application sticks
# OutOfSync. Every activation records the rung it rendered in /var/lib/zeta/storage-profile-high-water,
# and the NEXT evaluation takes the HIGHER of that and /etc/zeta/storage-profile. To shrink on purpose
# (destroying the volumes) delete the high-water file as well; nothing else lowers it.
#
# PURE-EVAL NOTE (see injected-hostname.nix): `builtins.pathExists` on an absolute path is false in
# pure evaluation, so a rebuild without `--impure` would silently drop the Application. Every
# nixos-rebuild in this repo carries `--impure`; lint-nixos-rebuild-needs-impure.ts keeps it that way.

{ config, lib, pkgs, ... }:

let
  profileFile = "/etc/zeta/storage-profile";
  highWaterFile = "/var/lib/zeta/storage-profile-high-water";

  # The rungs an install may choose, SMALLEST FIRST. GENERATED from storage-profiles.json by
  # src/Core.TypeScript/cluster/storage-profile-install.ts; a test fails when it drifts.
  ladder = builtins.fromJSON (builtins.readFile ../../k8s/storage-profile/ladder.json);
  profiles = ladder.profiles;

  readTrimmed = f:
    if builtins.pathExists f
    then
      let m = builtins.match "[[:space:]]*([^[:space:]]*)[[:space:]]*" (builtins.readFile f);
      in if m == null then "" else builtins.head m
    else "";

  # 1-based position on the ladder; 0 when `name` is not a rung.
  rank = name:
    let hits = lib.filter (i: builtins.elemAt profiles i == name) (lib.range 0 (builtins.length profiles - 1));
    in if hits == [ ] then 0 else builtins.head hits + 1;

  requested = readTrimmed profileFile;
  recorded = readTrimmed highWaterFile;
  present = requested != "";
  valid = present && rank requested > 0;

  # A high-water mark only counts when it names a rung; a garbled one must not lower or break anything.
  highWater = if rank recorded > 0 then recorded else "";
  effective =
    if !valid then ""
    else if rank highWater > rank requested then highWater
    else requested;

  template = builtins.readFile ../../k8s/storage-profile/argocd-application.yaml.in;
  rendered = builtins.replaceStrings [ "@ZETA_STORAGE_PROFILE@" ] [ effective ] template;
  isServer = config.services.k3s.enable && config.services.k3s.role == "server";
in
{
  config = lib.mkMerge [
    {
      assertions = [
        {
          assertion = !present || valid;
          message = "injected-storage-profile: ${profileFile} contains ${builtins.toJSON requested}, which is not a storage profile (one of: ${lib.concatStringsSep ", " profiles}). Refusing to render it into a manifest. Fix it or remove it to run the committed profile.";
        }
        {
          # Fail closed on a template that grew a token this module does not fill: an un-rendered
          # `@ZETA_...@` must never reach the cluster as a literal.
          assertion = !valid || !(lib.hasInfix "@ZETA_" rendered);
          message = "injected-storage-profile: the rendered Application still contains an unsubstituted @ZETA_*@ token. k8s/storage-profile/argocd-application.yaml.in and this module disagree about the tokens.";
        }
      ];
    }
    (lib.mkIf (valid && isServer) {
      services.k3s.manifests.zeta-storage-profile.source = pkgs.writeText "zeta-storage-profile.yaml" rendered;

      # The ratchet: record the rung this system rendered, so a later evaluation can never go below it.
      system.activationScripts.zetaStorageProfileHighWater = {
        text = ''
          mkdir -p /var/lib/zeta
          printf '%s\n' ${lib.escapeShellArg effective} > ${highWaterFile}
          chmod 0644 ${highWaterFile}
        '';
      };
    })
  ];
}
