# full-ai-cluster/nixos/tests/install-medium-device-eval-test.nix
#
# THE HOLE THIS EXISTS TO KEEP CLOSED (081M3B7Z38Q087G0R003F9X7HM)
# -----------------------------------------------------------------
# PR #17751 pointed the installer's /iso mount at a udev symlink only the
# isohybrid LBA-0 partition claims, so the whole disk could never be the boot
# medium. Its one load-bearing line was
#
#     fileSystems."/iso".device = lib.mkForce "/dev/disk/zeta-install-medium";
#
# and it NEVER TOOK EFFECT: installation-cd-base.nix defines `fileSystems` as
# `lib.mkImageMediaOverride config.lib.isoFileSystems` -- a priority-60
# definition of the whole option -- and the module system drops a definition by
# its TOP-LEVEL priority, so a default-priority definition with a mkForce buried
# inside it is discarded wholesale. The evaluated /iso device stayed
# `/dev/disk/by-label/ZETA_INSTALL`, the symlink that races, and three of five
# WP11 USB runs afterwards mounted the boot medium from the whole disk
# (run 36870188468: `boot-medium=/dev/sda`).
#
# Every check that had "verified" the pin read SOURCE TEXT (a regex in
# install-medium-selection.ts, an exact-string `toContain` in
# qemu-full-install-test.test.ts), and a text check cannot see a merge. This file
# asks the module system what it actually decided: it reads the REAL
# nixosConfigurations.installer (and installer-aarch64) and fails when the
# evaluated /iso device is not the one the rules were written for.
#
# Forcing `status` is the test. flake.nix forces it inside
# checks.<system>.install-medium-device-eval, so `nix flake check --no-build`
# runs it. No VM, no build.
#
# WHAT IT CAN TELL YOU
#   - the evaluated x86_64 installer mounts /iso from the single-claimant symlink,
#     as iso9660, needed for boot -- the base's own attributes survived the merge;
#   - the base's other iso mounts (/, /nix/.ro-store, /nix/.rw-store) are still
#     there, i.e. our definition merged with the base's instead of replacing it;
#   - both udev stages (the initrd's and stage 2's) carry the claim rules, and the
#     partition rule keys on the kernel's own DEVTYPE, which is `partition` iff
#     /sys/class/block/<dev>/partition exists;
#   - the aarch64 installer, which is built WITHOUT the isohybrid MBR and so has no
#     iso9660 partition to claim the symlink, keeps nixpkgs' by-label /iso and
#     carries none of the rules (a symlink nothing claims would time the mount out).
#
# WHAT IT CANNOT TELL YOU
#   Whether udev populates ID_PART_TABLE_TYPE on an isohybrid whole disk, or how a
#   real systemd initrd orders the mount against the uevents. Those are measured by
#   the guest's own `boot-medium=` / `verdict=` line on every USB lane, which the
#   QEMU harness fails on a whole disk. This file proves the line is in the fstab;
#   the lanes prove the fstab does what the model says.

{ pkgs, nixosConfig, nixosConfigAarch64 }:

let
  inherit (pkgs) lib;

  link = "/dev/disk/zeta-install-medium";

  cfg = nixosConfig.config;
  arm = nixosConfigAarch64.config;

  iso = cfg.fileSystems."/iso";
  armIso = arm.fileSystems."/iso";

  stage1 = cfg.boot.initrd.services.udev.rules;
  stage2 = cfg.services.udev.extraRules;
  armStage1 = arm.boot.initrd.services.udev.rules;
  armStage2 = arm.services.udev.extraRules;

  claimsLink = rules: lib.hasInfix ''SYMLINK+="disk/zeta-install-medium"'' rules;
  partitionRule = rules: lib.hasInfix ''ENV{DEVTYPE}=="partition", ENV{ID_FS_TYPE}=="iso9660"'' rules;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- the property PR #17751 claimed and never had ------------------------
    (check "x86_64 installer: the EVALUATED /iso device is the single-claimant symlink (not by-label)" (
      iso.device == link
    ))
    (check "x86_64 installer: /iso is still iso9660 and still neededForBoot (the base's attributes survived the merge)" (
      iso.fsType == "iso9660" && iso.neededForBoot == true
    ))
    (check "x86_64 installer: the base's other iso mounts survived (ours merged with the base's, did not replace it)" (
      builtins.hasAttr "/" cfg.fileSystems
      && builtins.hasAttr "/nix/.ro-store" cfg.fileSystems
      && builtins.hasAttr "/nix/.rw-store" cfg.fileSystems
    ))
    (check "x86_64 installer: no stale by-label device is left on /iso" (
      !(lib.hasInfix "by-label" iso.device)
    ))

    # -- the symlink must actually be claimable in BOTH udev stages -----------
    (check "x86_64 installer: stage 1 (initrd) udev rules claim the symlink" (claimsLink stage1))
    (check "x86_64 installer: stage 2 udev rules claim the symlink" (claimsLink stage2))
    (check "x86_64 installer: a PARTITION carrying the iso9660 claims it (DEVTYPE=partition == sysfs `partition` attr)" (
      partitionRule stage1 && partitionRule stage2
    ))
    (check "x86_64 installer: the whole disk's by-label claim is demoted (link_priority=-100) in both stages" (
      lib.hasInfix ''OPTIONS+="link_priority=-100"'' stage1 && lib.hasInfix ''OPTIONS+="link_priority=-100"'' stage2
    ))

    # -- the gate: an ISO without the isohybrid MBR has nothing to claim ------
    (check "aarch64 installer (no isohybrid MBR): /iso stays nixpkgs' by-label device" (
      armIso.device == "/dev/disk/by-label/ZETA_INSTALL"
    ))
    (check "aarch64 installer: carries none of the claim rules (a symlink nothing claims would time the mount out)" (
      !(claimsLink armStage1) && !(claimsLink armStage2)
    ))
    (check "the gate is the isohybrid condition itself: x86 builds the MBR, aarch64 does not" (
      cfg.isoImage.makeBiosBootable && cfg.isoImage.makeUsbBootable
      && !(arm.isoImage.makeBiosBootable && arm.isoImage.makeUsbBootable)
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures;

  status =
    if failures == [ ] then
      "install medium /iso device: ${toString (builtins.length results)} properties held; "
      + "x86_64 /iso=${iso.device}; aarch64 /iso=${armIso.device}"
    else
      throw (
        "install medium /iso device: ${toString (builtins.length failures)} of "
        + "${toString (builtins.length results)} properties FAILED "
        + "(x86_64 /iso=${iso.device}, aarch64 /iso=${armIso.device}):\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
