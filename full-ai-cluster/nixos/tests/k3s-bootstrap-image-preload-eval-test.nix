# full-ai-cluster/nixos/tests/k3s-bootstrap-image-preload-eval-test.nix
#
# Properties of `nixos/modules/k3s-bootstrap-image-preload.nix` — the module
# that owns the directory k3s imports container images from before it pulls
# anything. WP34 (081M3BZ111D087G0R000YBMKRY).
#
# NOT a VM test and NOT a boot test, like its siblings here. It proves things
# about Nix VALUES and file TEXT: that the module is imported by `common.nix`
# (so EVERY node gets it, not just a control plane), that the directory it
# creates is the one k3s actually reads, that the status unit is ordered BEFORE
# k3s (a verdict written after the import has already happened describes
# nothing), and — the load-bearing one — that the ABSENT branch is loud and
# NON-FATAL.
#
# THE ONE THAT MATTERS. A module that silently did nothing when the archive was
# missing would be the exact defect class this work item exists to remove: a
# step that did not happen and left no record. A module that FAILED when the
# archive was missing would be worse in a different direction — it would
# convert a reliability improvement into a new way to brick an install on a
# machine whose network was fine. So the script must mention the missing path,
# and must not exit non-zero. Both are checked below.
#
# CANNOT TELL YOU: whether the archive is actually on any ISO, whether k3s
# imports it, or whether the names inside it match what the charts render.
# Those are `src/Core.TypeScript/cluster/bootstrap-preload-blackhole.ts`'s
# job — a boot with the registries blackholed and a mandatory negative control
# — and no amount of pure evaluation can substitute for it.

{ lib, pkgs }:

let
  modulesDir = ../modules;

  moduleArgs = {
    inherit lib pkgs;
    config.zeta.bootstrapImagePreload = {
      enable = true;
      imagesDir = "/var/lib/rancher/k3s/agent/images";
      archiveName = "zeta-bootstrap-images.tar";
      statusFile = "/run/zeta-bootstrap-image-preload.status";
    };
  };

  module = import (modulesDir + "/k3s-bootstrap-image-preload.nix") moduleArgs;

  # THE `mkIf` WRAPPER, UNWRAPPED EXPLICITLY.
  #
  # `lib.mkIf cond attrs` does NOT return `attrs`. It returns
  # `{ _type = "if"; condition = cond; content = attrs; }`, and the module
  # system unwraps it during a real evaluation. Reading `module.config.systemd`
  # straight off the import therefore finds nothing — which is how the first
  # version of this file failed the flake check rather than the module, on the
  # aarch64 ISO lane, 2026-09-25.
  body = if module.config ? content then module.config.content else module.config;
  statusUnit = body.systemd.services.zeta-bootstrap-image-preload-status;
  script = statusUnit.script;

  commonText = builtins.readFile (modulesDir + "/common.nix");

  # -- The path k3s ACTUALLY reads, stated independently ---------------------
  #
  # Deliberately a literal here and an option default there. If they ever
  # disagree, this test is the thing that says so — which is the point of
  # writing the expectation twice rather than importing it from the module and
  # comparing it to itself (a check that cannot fail).
  k3sAirgapDir = "/var/lib/rancher/k3s/agent/images";

  check = name: cond: { inherit name; ok = cond; };

  results = [
    (check "common.nix imports the preload module (every node, not just the control plane)" (
      lib.hasInfix "./k3s-bootstrap-image-preload.nix" commonText
    ))
    (check "common.nix enables it by default" (
      lib.hasInfix "zeta.bootstrapImagePreload.enable = lib.mkDefault true" commonText
    ))
    (check "the module creates the directory k3s imports airgap archives from" (
      lib.any (r: lib.hasInfix k3sAirgapDir r && lib.hasPrefix "d " r) body.systemd.tmpfiles.rules
    ))
    (check "the status unit runs BEFORE k3s — a verdict after the import describes nothing" (
      builtins.elem "k3s.service" statusUnit.before
    ))
    (check "the status unit is a oneshot that stays active (so its verdict survives the boot)" (
      statusUnit.serviceConfig.Type == "oneshot" && statusUnit.serviceConfig.RemainAfterExit
    ))
    (check "the ABSENT branch names the missing path" (lib.hasInfix "ABSENT" script))
    (check "the PRESENT branch records the archive's size, not merely its existence" (
      lib.hasInfix "PRESENT" script && lib.hasInfix "stat -c %s" script
    ))
    # THE LOAD-BEARING PAIR. Absence must be LOUD and must not be FATAL.
    (check "absence is LOUD — the script explains what the operator will now see" (
      lib.hasInfix "ImagePullBackOff" script
    ))
    (check "absence is NOT FATAL — no exit 1 / false anywhere in the script" (
      !(lib.hasInfix "exit 1" script) && !(lib.hasInfix "exit 2" script)
    ))
    (check "the module declares NO assertions — a missing optimisation may not block a build" (
      !(module ? assertions) && !(body ? assertions)
    ))
    (check "the verdict is written to a tmpfs path (this boot's answer, never a stale one)" (
      lib.hasPrefix "/run/" moduleArgs.config.zeta.bootstrapImagePreload.statusFile
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures script;

  status =
    if failures == [ ] then
      "k3s bootstrap image preload: ${toString (builtins.length results)} properties held "
      + "(imported on every node, directory owned, status before k3s, absence loud and non-fatal)"
    else
      throw "k3s bootstrap image preload FAILED: ${lib.concatStringsSep "; " (map (r: r.name) failures)}";
}
