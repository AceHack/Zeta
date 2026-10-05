# full-ai-cluster/nixos/tests/containerd-on-data-disk-eval-test.nix
#
# EVAL-ONLY properties of nixos/modules/containerd-on-data-disk.nix, resolved by the REAL module system on
# the SHIPPING control-plane host (the one the USB installs), not read off the module's text.
#
# WHY RESOLVED, NOT READ: the ordering of this module is expressed on its OWN units because
# k3s-wait-for-address.nix sets `systemd.services.k3s.after = lib.mkForce [...]`, which silently discards an
# `after` anyone else adds to k3s. Reading the module's text would show an `after` that never reaches the unit;
# only evaluating the host shows what k3s.service actually depends on. This is the same class of finding as
# install-medium-device-eval-test.nix (a pin that read as correct in source and was discarded by the module system).
#
# THE PROPERTIES, in the order the failure would hurt:
#   OFF  1. with no /etc/zeta/containerd-data-disk and no option, the module contributes NOTHING: no mount, no
#           prepare unit, no k3s dependency, no ExecStartPre. A single-disk install or a QEMU lane is untouched.
#   ON   2. a data disk produces a BIND mount <disk>/containerd -> /var/lib/rancher/k3s/agent/containerd.
#        3. k3s.service REQUIRES that mount unit and RequiresMountsFor the path: the two edges that make a
#           missing mount a start FAILURE rather than a silent root-disk store.
#        4. the mount is ordered before k3s and required BY it, and is NOT pulled in by local-fs.target (a
#           missing disk must stop k3s, not drop a headless box into emergency mode).
#        5. k3s's FIRST ExecStartPre is the assert wrapper.
#        6. the prepare unit is ordered before the mount, requires the data disk's own mount, and has no
#           default dependencies (default dependencies would cycle through sysinit.target / local-fs.target).
#   REFUSAL 7. a data disk the host does not declare, a relative path, "/" and a trailing slash each fail an
#           assertion at EVALUATION, naming the problem -- never a boot-time surprise.
#
# WHAT THIS CANNOT TELL YOU: that systemd orders the units as written on a booted guest, or that the first
# boot's mount of a fresh <disk>/containerd works. Nothing here boots anything. containerd-store.sh's own
# branches are EXECUTED by src/Core.TypeScript/hygiene/lint-containerd-store.test.ts.

{ pkgs, nixosConfig }:

let
  inherit (pkgs) lib;

  mountUnit = "var-lib-rancher-k3s-agent-containerd.mount";
  containerdDir = "/var/lib/rancher/k3s/agent/containerd";
  disk = "/var/lib/longhorn-disk2";

  base = nixosConfig.config;

  withDisk = nixosConfig.extendModules {
    modules = [
      {
        fileSystems.${disk} = {
          device = "/dev/disk/by-uuid/00000000-eval-test";
          fsType = "ext4";
        };
        zeta.containerdStore.dataDisk = disk;
      }
    ];
  };
  on = withDisk.config;

  failedAssertions =
    modules:
    let
      cfg = (nixosConfig.extendModules { inherit modules; }).config;
    in
    map (a: a.message) (builtins.filter (a: !a.assertion) cfg.assertions);

  mountsFor = cfg: builtins.filter (m: (m.where or "") == containerdDir) cfg.systemd.mounts;
  onMount = builtins.head (mountsFor on);

  asList = x: if builtins.isList x then x else [ x ];
  k3sPre = asList (on.systemd.services.k3s.serviceConfig.ExecStartPre or [ ]);
  k3sRequiresMountsFor = asList (on.systemd.services.k3s.unitConfig.RequiresMountsFor or [ ]);
  prepare = on.systemd.services.zeta-containerd-store-prepare or null;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- OFF -----------------------------------------------------------------
    (check "OFF: no injected file and no option -> dataDisk is null" (base.zeta.containerdStore.dataDisk == null))
    (check "OFF: no containerd mount unit is declared" (mountsFor base == [ ]))
    (check "OFF: no prepare unit" (!(base.systemd.services ? zeta-containerd-store-prepare)))
    (check "OFF: k3s does not require the mount and carries no assert" (
      !(builtins.elem mountUnit (asList (base.systemd.services.k3s.requires or [ ])))
      && !(lib.any (p: lib.hasInfix "zeta-containerd-store" (toString p)) (asList (base.systemd.services.k3s.serviceConfig.ExecStartPre or [ ])))
    ))

    # -- ON: the mount ---------------------------------------------------------
    (check "ON: exactly one bind mount of the containerd path" (builtins.length (mountsFor on) == 1))
    (check "ON: it binds <disk>/containerd" (onMount.what == "${disk}/containerd"))
    (check "ON: type none, options bind" (onMount.type == "none" && onMount.options == "bind"))
    (check "ON: no fileSystems entry for the containerd path (an fstab bind would be wanted by local-fs.target)" (
      !(on.fileSystems ? ${containerdDir})
    ))

    # -- ON: k3s refuses without it ------------------------------------------------
    (check "ON: k3s.service REQUIRES the mount unit" (builtins.elem mountUnit (asList on.systemd.services.k3s.requires)))
    (check "ON: k3s.service has RequiresMountsFor=<containerd path>" (builtins.elem containerdDir k3sRequiresMountsFor))
    (check "ON: the mount is ordered Before=k3s.service" (builtins.elem "k3s.service" onMount.before))
    (check "ON: the mount is RequiredBy=k3s.service" (builtins.elem "k3s.service" onMount.requiredBy))
    (check "ON: nothing but k3s requires it -- not local-fs.target (no emergency mode on a missing disk)" (
      !(builtins.elem "local-fs.target" (onMount.wantedBy or [ ]))
      && !(builtins.elem "local-fs.target" (onMount.requiredBy or [ ]))
    ))
    (check "ON: k3s's FIRST ExecStartPre is the assert wrapper" (
      k3sPre != [ ] && lib.hasInfix "zeta-containerd-store-assert" (toString (builtins.head k3sPre))
    ))
    (check "ON: the mount waits for the data disk's own mount" (builtins.elem disk (asList onMount.unitConfig.RequiresMountsFor)))

    # -- ON: the prepare unit ---------------------------------------------------------
    (check "ON: the prepare unit exists, is a oneshot, and runs BEFORE the mount" (
      prepare != null && prepare.serviceConfig.Type == "oneshot" && builtins.elem mountUnit prepare.before
    ))
    (check "ON: the mount REQUIRES and is After the prepare unit" (
      builtins.elem "zeta-containerd-store-prepare.service" onMount.requires
      && builtins.elem "zeta-containerd-store-prepare.service" onMount.after
    ))
    (check "ON: the prepare unit requires the data disk's mount" (
      builtins.elem disk (asList prepare.unitConfig.RequiresMountsFor)
    ))
    (check "ON: neither unit has default dependencies (they would cycle through sysinit.target)" (
      prepare.unitConfig.DefaultDependencies == false && onMount.unitConfig.DefaultDependencies == false
    ))
    (check "ON: the data disk's own fileSystems entry is not nofail (a missing disk must be a failure)" (
      !(builtins.elem "nofail" (on.fileSystems.${disk}.options or [ ]))
    ))
    (check "ON: no assertion fails" (failedAssertions [
      {
        fileSystems.${disk} = { device = "/dev/disk/by-uuid/00000000-eval-test"; fsType = "ext4"; };
        zeta.containerdStore.dataDisk = disk;
      }
    ] == [ ]))

    # -- REFUSAL at evaluation ------------------------------------------------------------
    (check "REFUSED: a data disk the host does not declare" (
      lib.any (m: lib.hasInfix "is not a filesystem this host declares" m) (failedAssertions [
        { zeta.containerdStore.dataDisk = "/var/lib/longhorn-disk9"; }
      ])
    ))
    (check "REFUSED: a relative path" (
      lib.any (m: lib.hasInfix "normalised absolute mount point" m) (failedAssertions [
        { zeta.containerdStore.dataDisk = "var/lib/longhorn-disk2"; }
      ])
    ))
    (check "REFUSED: the root filesystem itself" (
      lib.any (m: lib.hasInfix "normalised absolute mount point" m) (failedAssertions [
        { zeta.containerdStore.dataDisk = "/"; }
      ])
    ))
    (check "REFUSED: a trailing slash" (
      lib.any (m: lib.hasInfix "normalised absolute mount point" m) (failedAssertions [
        { zeta.containerdStore.dataDisk = "${disk}/"; }
      ])
    ))
    (check "REFUSED: a subdir with a slash" (
      lib.any (m: lib.hasInfix "one plain directory name" m) (failedAssertions [
        {
          fileSystems.${disk} = { device = "/dev/disk/by-uuid/00000000-eval-test"; fsType = "ext4"; };
          zeta.containerdStore = { dataDisk = disk; subdir = "a/b"; };
        }
      ])
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures;

  status =
    if failures == [ ] then
      "containerd-on-data-disk: ${toString (builtins.length results)} properties held; off by default, "
      + "and with a data disk k3s requires the bind mount of ${disk}/containerd"
    else
      throw (
        "containerd-on-data-disk: ${toString (builtins.length failures)} of ${toString (builtins.length results)} properties FAILED:\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
