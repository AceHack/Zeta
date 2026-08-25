# full-ai-cluster/nixos/tests/longhorn-common-default-disk-eval-test.nix
#
# THE HOLE THIS EXISTS TO KEEP CLOSED
# -----------------------------------
# PR #12175's first test (longhorn-volume-binds.nix) boots a labelled
# multi-disk QEMU VM that imports longhorn-disks.nix EXPLICITLY and sets
# two extra dataDisks. That proves the three-part Longhorn 1.7.2 mechanism
# when the module is in the graph. It says nothing about the host the USB
# actually installs.
#
# hosts/control-plane/configuration.nix imports common.nix and never
# mentions longhorn-disks.nix. After createDefaultDiskLabeledNodes=true,
# an unlabelled node gets ZERO disks -- the 62-day outage, reintroduced
# by the fix for it. 09f831f6 imported the module from common.nix so the
# default list [ "/var/lib/longhorn" ] still arms the label + annotator.
# Nothing then asserted that shipping shape.
#
# This file reads the REAL nixosConfigurations.control-plane. Forcing
# `status` is the test. flake.nix forces it inside
# checks.<system>.longhorn-common-default-disk, so
# `nix flake check --no-build` runs it.
#
# WHAT IT CAN TELL YOU
#   - control-plane reaches longhorn-disks.nix ONLY through common.nix;
#   - the resolved default is [ "/var/lib/longhorn" ] (placeholder
#     hardware-configuration declares no Longhorn filesystem);
#   - mkIf fired: create-default-disk label, disk-count label, annotator
#     oneshot whose script carries that path;
#   - the chart setting that makes the label mean anything is still on.
#
# WHAT IT CANNOT TELL YOU
#   Nothing here boots a node or talks to a Longhorn API. The labelled
#   multi-disk QEMU test still owns runtime registration of two real
#   drives. Physical 2-NVMe is unmeasured by both.

{ pkgs, nixosConfig }:

let
  inherit (pkgs) lib;

  hostConfig = nixosConfig.config;
  k3sFlags = hostConfig.services.k3s.extraFlags;
  unit = hostConfig.systemd.services.zeta-longhorn-node-disks or null;
  dataDisks = hostConfig.zeta.longhorn.dataDisks;

  flagsList =
    if builtins.isList k3sFlags then
      k3sFlags
    else
      lib.splitString " " (toString k3sFlags);

  countOccurrences =
    needle: haystack:
    builtins.length (builtins.filter builtins.isString (builtins.split (lib.escapeRegex needle) haystack)) - 1;

  commonText = builtins.readFile ../modules/common.nix;
  controlPlaneText = builtins.readFile ../hosts/control-plane/configuration.nix;
  applicationText = builtins.readFile ../../k8s/applications/longhorn/Application.yaml;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    (check "the host config exposes dataDisks, k3s flags, and the annotator unit" (
      builtins.isList dataDisks && builtins.isList flagsList && unit != null
    ))

    # -- shipping import graph ----------------------------------------------
    (check "control-plane imports common.nix and does not import longhorn-disks.nix" (
      countOccurrences "../../modules/common.nix" controlPlaneText == 1
      && countOccurrences "longhorn-disks.nix" controlPlaneText == 0
    ))
    (check "common.nix is the always-on importer of longhorn-disks.nix" (
      countOccurrences "./longhorn-disks.nix" commonText == 1
    ))

    # -- default single-disk path -------------------------------------------
    (check "control-plane dataDisks is the default single-disk list" (
      dataDisks == [ "/var/lib/longhorn" ]
    ))
    (check "mkIf fired: create-default-disk=config is on the k3s command line" (
      builtins.elem "--node-label=node.longhorn.io/create-default-disk=config" flagsList
    ))
    (check "mkIf fired: the disk-count label is 1, matching the default list" (
      builtins.elem "--node-label=zeta.io/longhorn-disks=1" flagsList
    ))
    (check "mkIf fired: the annotator oneshot exists and names /var/lib/longhorn" (
      unit != null
      && builtins.isString (unit.script or null)
      && lib.hasInfix "/var/lib/longhorn" unit.script
      && lib.hasInfix "node.longhorn.io/default-disks-config" unit.script
    ))

    # -- chart side, the third of the three required parts ------------------
    (check "the prod Application still sets createDefaultDiskLabeledNodes" (
      countOccurrences "createDefaultDiskLabeledNodes: true" applicationText == 1
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures;

  status =
    if failures == [ ] then
      "longhorn common.nix default disk: ${toString (builtins.length results)} properties held; "
      + "control-plane dataDisks=${toString dataDisks}; "
      + "annotator unit present; create-default-disk label present"
    else
      throw (
        "longhorn common.nix default disk: ${toString (builtins.length failures)} of "
        + "${toString (builtins.length results)} properties FAILED:\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
