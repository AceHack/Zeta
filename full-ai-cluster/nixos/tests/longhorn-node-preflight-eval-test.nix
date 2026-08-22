# full-ai-cluster/nixos/tests/longhorn-node-preflight-eval-test.nix
#
# Properties of the Longhorn node preflight (nixos/modules/longhorn-node-preflight.nix
# + nixos/modules/longhorn-preflight-checks.nix).
#
# NOT a VM test and NOT a boot test. Like secure-boot-desired-state-eval-test.nix
# and k3s-first-boot-apply-order-eval-test.nix, this is a pure evaluation test:
# `status` throws on failure, so forcing its value IS running it. flake.nix forces
# it inside `checks.<system>.longhorn-node-preflight`, which
# `nix flake check --no-build` evaluates on every PR touching
# full-ai-cluster/nixos/** -- it costs a PR nothing and runs on every platform.
#
# WHAT IT CAN TELL YOU
#   - the mount set the preflight will check is DERIVED from the host's own
#     `fileSystems`, and derives the right answer on a multi-disk host and on a
#     host with no Longhorn filesystems at all;
#   - the check that regressed in the field is present in the exact form that
#     would have caught it (`systemctl is-active`, not `systemctl cat`);
#   - the shim roster the preflight verifies is the SAME roster
#     longhorn-prereqs.nix creates -- so a helper added to one and forgotten in
#     the other is a red check, not a silent hole;
#   - the unit is wired into the boot path of every node, via the import edge
#     longhorn-prereqs.nix -> common.nix.
#
# WHAT IT CANNOT TELL YOU
#   Nothing here boots a node, mounts a disk, or starts iscsid. It proves the
#   check is present, non-vacuous and reachable; it cannot prove the check
#   PASSES on any particular hardware. Only a boot can do that, and the marker
#   to look for on the console is ZETA_LONGHORN_PREFLIGHT_OK.

{ lib, pkgs }:

let
  modulesDir = ../modules;
  checksFile = modulesDir + "/longhorn-preflight-checks.nix";
  moduleFile = modulesDir + "/longhorn-node-preflight.nix";

  callChecks =
    fileSystems:
    import checksFile {
      inherit lib fileSystems;
    };

  # A two-NVMe node, as disko-shapes/longhorn-node.nix lays one out, plus the
  # decoys that must NOT be swept in: root, ESP, and the local-path directory
  # (which is storage, but not Longhorn's).
  multiDisk = callChecks {
    "/" = { };
    "/boot" = { };
    "/nix/store" = { };
    "/var/lib/zeta-local-storage" = { };
    "/var/lib/longhorn-disk2" = { };
    "/var/lib/longhorn-disk1" = { };
  };

  # hosts/control-plane as it stands today: hardware-configuration.nix declares
  # only / and /boot, so NO Longhorn filesystem is declared and the mount check
  # has nothing to check. That is the correct answer, and pinning it here is what
  # keeps the vacuity DECLARED rather than discovered.
  noDataDisks = callChecks {
    "/" = { };
    "/boot" = { };
  };

  # The chart's defaultDataPath itself, when a host does give it its own device.
  rootPathMounted = callChecks {
    "/" = { };
    "/var/lib/longhorn" = { };
  };

  countOccurrences =
    needle: haystack:
    builtins.length (builtins.filter builtins.isString (builtins.split (lib.escapeRegex needle) haystack)) - 1;

  # -- The shim roster, read back out of the module that CREATES the symlinks --
  #
  # Derived by parsing longhorn-prereqs.nix rather than restated here, for the
  # same reason audit-proof-lineage-binaries.ts derives its exemption roster from
  # the runner: a second hand-written list drifts from the first, and a drifted
  # list passes.
  prereqsText = builtins.readFile (modulesDir + "/longhorn-prereqs.nix");
  prereqsLines = lib.splitString "\n" prereqsText;
  tmpfilesShimLinks = builtins.filter (p: p != null) (
    map (
      line:
      let
        m = builtins.match ''.*"L\+ (/usr/local/bin/[^ ]+) .*'' line;
      in
      if m == null then null else builtins.head m
    ) prereqsLines
  );

  sortStrings = builtins.sort (a: b: a < b);

  # -- The module's own wiring, read through a KNOWN wrapper shape -------------
  #
  # `config` is a lib.mkIf, i.e. { _type = "if"; condition; content; }. Reading
  # `.content` without first proving `_type == "if"` is how a reader silently
  # returns the wrong value the day the wrapper changes; P0 below refuses that.
  moduleResult = import moduleFile {
    config = {
      fileSystems = {
        "/" = { };
        "/var/lib/longhorn-disk1" = { };
      };
      zeta.longhorn.preflight.enable = true;
    };
    inherit lib pkgs;
  };
  moduleConfig = moduleResult.config;
  unit = moduleConfig.content.systemd.services.zeta-longhorn-preflight;

  # -- Reachability: the import edge that puts this on every node's boot path --
  prereqsImportsPreflight =
    countOccurrences "./longhorn-node-preflight.nix" prereqsText == 1;
  commonText = builtins.readFile (modulesDir + "/common.nix");
  commonImportsPrereqs = countOccurrences "./longhorn-prereqs.nix" commonText >= 1;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- P0 the reader keeps its own assumptions honest ---------------------
    (check "the checks function returns a plain attrset carrying every key this test reads" (
      builtins.isAttrs multiDisk
      && !(multiDisk ? _type)
      && multiDisk ? requiredMounts
      && multiDisk ? script
      && multiDisk ? shimBinaries
      && multiDisk ? okMarker
      && multiDisk ? failMarker
    ))
    (check "the module's config is a lib.mkIf, the shape this test unwraps" (
      builtins.isAttrs moduleConfig && moduleConfig._type or null == "if"
    ))

    # -- P1 the mount set is DERIVED, and derives the right answer -----------
    (check "a two-NVMe host yields exactly its two Longhorn mounts, sorted" (
      multiDisk.requiredMounts == [
        "/var/lib/longhorn-disk1"
        "/var/lib/longhorn-disk2"
      ]
    ))
    (check "root, /boot, /nix/store and /var/lib/zeta-local-storage are NOT swept in" (
      !(builtins.elem "/" multiDisk.requiredMounts)
      && !(builtins.elem "/boot" multiDisk.requiredMounts)
      && !(builtins.elem "/nix/store" multiDisk.requiredMounts)
      && !(builtins.elem "/var/lib/zeta-local-storage" multiDisk.requiredMounts)
    ))
    (check "the defaultDataPath itself is covered when a host gives it a device" (
      rootPathMounted.requiredMounts == [ "/var/lib/longhorn" ]
    ))

    # -- P2 the vacuity is declared, not discovered -------------------------
    # A host declaring no Longhorn filesystem has nothing to check. Saying so
    # here is what stops "it passed" being read as "the disks are there".
    (check "a host declaring no Longhorn filesystem yields an EMPTY mount set" (
      noDataDisks.requiredMounts == [ ]
    ))
    (check "with an empty mount set the script still runs the other four checks" (
      countOccurrences "is-active --quiet iscsid.service" noDataDisks.script == 1
      && countOccurrences "/sys/module/iscsi_tcp" noDataDisks.script == 1
      && countOccurrences "/usr/local/bin/iscsiadm" noDataDisks.script >= 1
    ))

    # -- P2b the empty-required-set case is no longer VACUOUS ---------------
    #
    # P2 pins the empty set as correct-given-the-declarations. It is not
    # correct-given-the-NODE, because a node reaches the declares-nothing state
    # by accident: zeta-install.sh formats longhorn{1..N} and then copies the
    # probe-generated hardware-configuration over the committed placeholder, and
    # until 081M0JK4R26087G0R002SVJ5VW a FAILED copy was a stderr WARN and the
    # install continued. So an empty required set is ALSO the signature of the
    # bug, and check 1 alone cannot tell the two apart.
    #
    # Check 1b asks the disks. These properties are what stop a future edit
    # from deleting it and leaving P2 reading like a clearance.
    (check "check 1b probes the disks by label, and does so even with an EMPTY required set" (
      countOccurrences "/dev/disk/by-label/longhorn*" noDataDisks.script == 1
      && countOccurrences "/dev/disk/by-label/longhorn*" multiDisk.script == 1
    ))
    (check "an unmounted longhorn-labelled device is counted as an orphan and REFUSED" (
      countOccurrences "lh_orphans=$((lh_orphans + 1))" noDataDisks.script == 1
      && countOccurrences "fail \"$lh_dev carries the Longhorn label" noDataDisks.script == 1
    ))
    (check "1b routes through fail(), so it cannot add a second exit path" (
      countOccurrences "exit 1" noDataDisks.script == 1
      && countOccurrences "exit 1" multiDisk.script == 1
    ))
    (check "1b accepts only a mount UNDER the Longhorn root, not merely any mount" (
      countOccurrences "${noDataDisks.longhornRoot}*)" noDataDisks.script == 1
    ))
    (check "the verdict reports the DEVICE count beside the declared-mount count" (
      # mounts_checked=0 alone is what the bug looks like; the pair is what
      # makes "there was nothing to check" a claim an operator can read.
      countOccurrences "longhorn_devices=$lh_devices" noDataDisks.script == 2
      && countOccurrences "mounts_checked=$checked_mounts" noDataDisks.script == 2
    ))

    # -- P3 every derived mount reaches the emitted script -------------------
    # The derivation being right is worth nothing if the script drops a path.
    (check "every required mount appears in a findmnt invocation in the script" (
      builtins.all (
        p: countOccurrences "--mountpoint ${lib.escapeShellArg p}" multiDisk.script == 1
      ) multiDisk.requiredMounts
    ))
    (check "the script counts exactly as many mounts as were derived" (
      countOccurrences "checked_mounts=$((checked_mounts + 1))" multiDisk.script
      == builtins.length multiDisk.requiredMounts
    ))

    # -- P4 the field regression, pinned in the exact form that catches it ---
    # `systemctl cat iscsid.service` (what k3s-control-plane-platform-fixes.nix
    # asserted while longhorn-manager crash-looped 16495 times over 62 days)
    # proves a unit FILE exists and passes on a dead daemon. `is-active` is the
    # question that has an answer. Asserting the ABSENCE of the weak form is
    # what stops a future edit "simplifying" back to it.
    (check "the preflight asks systemctl is-active, the question with an answer" (
      countOccurrences "systemctl is-active --quiet iscsid.service" multiDisk.script == 1
    ))
    (check "the preflight does NOT settle for systemctl cat / is-enabled" (
      countOccurrences "systemctl cat" multiDisk.script == 0
      && countOccurrences "is-enabled" multiDisk.script == 0
    ))

    # -- P5 the shim roster cannot drift from the module that creates it -----
    (check "longhorn-prereqs.nix declares at least the five known FHS shims" (
      builtins.length tmpfilesShimLinks == 5
    ))
    (check "the preflight verifies EXACTLY the shims longhorn-prereqs.nix creates" (
      sortStrings multiDisk.shimBinaries == sortStrings tmpfilesShimLinks
    ))
    (check "every shim is actually tested for executability in the script" (
      builtins.all (
        b: countOccurrences "[ -x ${lib.escapeShellArg b} ]" multiDisk.script == 1
      ) multiDisk.shimBinaries
    ))

    # -- P6 the script refuses rather than reports --------------------------
    (check "the script exits non-zero when any check failed" (
      countOccurrences "exit 1" multiDisk.script == 1
    ))
    (check "both console markers are emitted, and only one of them per run" (
      countOccurrences multiDisk.failMarker multiDisk.script == 1
      && countOccurrences multiDisk.okMarker multiDisk.script == 1
    ))
    (check "failures are written to the physical console, not only the journal" (
      countOccurrences "> /dev/console" multiDisk.script == 1
      && countOccurrences "shout \"zeta-longhorn-preflight: REFUSED" multiDisk.script == 1
    ))

    # -- P7 REACHABILITY: this runs on every node, not only where opted in ---
    # A guard only some hosts instantiate cannot fire where it matters. The
    # in-tree counter-example is nvidia-open-guard.nix:99, whose boot probe is
    # `lib.mkIf useOpen` while gpu.nix:57 ships `open = false` -- present,
    # tested, and never once executed on any host in this repo.
    (check "longhorn-prereqs.nix imports the preflight module (edge 1 of 2)" (
      prereqsImportsPreflight
    ))
    (check "common.nix imports longhorn-prereqs.nix, so every node gets it (edge 2 of 2)" (
      commonImportsPrereqs
    ))
    (check "the unit is pulled in by multi-user.target on every boot" (
      builtins.elem "multi-user.target" (unit.wantedBy or [ ])
    ))
    (check "the verdict lands BEFORE k3s advertises this node as a place for storage" (
      builtins.elem "k3s.service" (unit.before or [ ])
    ))
    (check "the unit runs after the mounts were attempted and tmpfiles was applied" (
      builtins.elem "local-fs.target" (unit.after or [ ])
      && builtins.elem "systemd-tmpfiles-setup.service" (unit.after or [ ])
    ))
    (check "the unit is a oneshot with no Restart= (a retry loop reads as in-progress, not refused)" (
      unit.serviceConfig.Type == "oneshot" && !(unit.serviceConfig ? Restart)
    ))
    (check "iscsid is WANTED, not REQUIRED (a required dep failing would replace the diagnosis)" (
      builtins.elem "iscsid.service" (unit.wants or [ ]) && !(builtins.elem "iscsid.service" (unit.requires or [ ]))
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures;

  # Forcing `status` runs every property. It is a string on success and a throw
  # naming every broken property on failure -- so a consumer that merely
  # evaluates it (flake.nix) cannot pass while a property is red.
  status =
    if failures == [ ] then
      "longhorn node preflight: ${toString (builtins.length results)} properties held; "
      + "multi-disk host derives ${toString (builtins.length multiDisk.requiredMounts)} required mounts, "
      + "no-data-disk host derives ${toString (builtins.length noDataDisks.requiredMounts)}, "
      + "${toString (builtins.length multiDisk.shimBinaries)} FHS shims verified"
    else
      throw (
        "longhorn node preflight: ${toString (builtins.length failures)} of "
        + "${toString (builtins.length results)} properties FAILED:\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
