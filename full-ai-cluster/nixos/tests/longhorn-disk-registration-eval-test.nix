# full-ai-cluster/nixos/tests/longhorn-disk-registration-eval-test.nix
#
# Properties of the NODE-SIDE disk set: the list of paths this host hands to
# Longhorn (`zeta.longhorn.dataDisks`, nixos/modules/longhorn-disks.nix) versus
# the list of paths it actually formats, mounts, and refuses to boot without.
#
# A pure EVALUATION test, in the shape longhorn-node-preflight-eval-test.nix
# established: `status` throws on failure, so forcing its value IS running it.
# flake.nix forces it inside `checks.<system>.longhorn-disk-registration`, which
# `nix flake check --no-build` evaluates on every PR touching
# full-ai-cluster/nixos/**. No VM, every platform, costs a PR nothing.
#
# THE HOLE THIS EXISTS TO KEEP CLOSED
# -----------------------------------
# There are FOUR sets in this pipeline, and a node only stores data if all four
# agree:
#
#   1. FORMATTED    zeta-install.sh: every non-boot internal disk -> longhorn{2..N},
#                   plus longhorn1 in the boot disk's tail; mounted at
#                   /var/lib/longhorn-disk{1..N}
#   2. DECLARED     the host's `fileSystems` (hardware-configuration.nix, or disko)
#   3. REQUIRED     zeta-longhorn-preflight's `requiredMounts` -- what the node
#                   refuses to boot quietly without
#   4. REGISTERED   `zeta.longhorn.dataDisks` -> the Longhorn Node CR
#
# 1 == 2 is already enforced from both ends: zeta-install.sh's capture check
# (PR #13263) refuses to install a hardware-configuration that omits a mount it
# just made, and preflight check 1b (PR #13252) refuses at boot when a
# longhorn-LABELLED device is not mounted under the Longhorn root. 2 == 3 holds
# by construction -- `requiredMounts` is derived from `fileSystems`.
#
# 3 == 4 was enforced by NOTHING, and was FALSE on the host the USB installs.
# `dataDisks` defaulted to the fixed literal [ "/var/lib/longhorn" ], and the
# only thing that ever set it was disko-shapes/longhorn-node.nix, reachable
# only from hosts/worker-template (which is also the sole importer of the
# module that DECLARES the option). hosts/control-plane and hosts/worker-gpu,
# menu options 1 and 2 of zeta-install.sh itself, are hardware-configuration
# hosts and never set it at all. So a 4-disk box formatted four Longhorn partitions, declared four,
# required four to be mounted, and told Longhorn about ONE path -- and that one
# path was /var/lib/longhorn, a directory on the ROOT filesystem that
# longhorn-prereqs.nix creates with tmpfiles. Every dedicated partition
# contributed ZERO schedulable capacity while every check on the node went
# green, because every check on the node measured sets 1-3.
#
# Note that preflight check 1b already names this exact outcome in its failure
# text -- "Longhorn will place replicas on the ROOT filesystem instead" -- but
# it can only fire on the UNDECLARED case. When the config declared the mounts
# correctly, which is the normal successful install, nothing looked at set 4.
#
# The fix is one line of derivation rather than a new mechanism: `dataDisks`
# now defaults to `requiredMounts`, so sets 3 and 4 are one expression. The
# properties below pin that identity, pin the delta the old literal produced so
# a revert is a red check rather than a quiet regression, and check the
# bash-side prefix zeta-install.sh mounts at against the nix-side prefix the
# derivation filters on -- the one place the two substrates have to agree and
# neither can see the other.
#
# RELATIONSHIP TO PR #12175 (fix/longhorn-multi-disk-real-mechanism)
# -----------------------------------------------------------------
# #12175 fixes the CLUSTER side of the same ask: it replaces the
# `kind: NodeDiskCatalog` file nothing read with Longhorn's real three-part
# mechanism (create-default-disk label + default-disks-config annotation +
# createDefaultDiskLabeledNodes), and adds a two-real-drive VM test. Everything
# here assumes it lands and does not duplicate any part of it. The two are
# strictly complementary and the ask needs both:
#
#   #12175 makes `dataDisks` REACH Longhorn.  This makes `dataDisks` CONTAIN
#   every disk the node has.
#
# With only #12175, a control-plane box annotates itself with the one-element
# default and Longhorn faithfully registers a single root-filesystem path.
# With only this, the correct multi-disk list is written to a file nothing
# reads. Neither half is visible in the other's tests.
#
# WHAT THIS CANNOT TELL YOU
#   Nothing here boots a node, formats a disk, or talks to a Longhorn API. It
#   proves the node COMPUTES the right disk set. Whether that set reaches the
#   Node CR is #12175's VM test (longhorn-volume-binds.nix), and whether either
#   works on metal is unmeasured by both -- the console marker on a real boot is
#   ZETA_LONGHORN_PREFLIGHT_OK, and the cluster-side reading is
#   `kubectl -n longhorn-system get nodes.longhorn.io <host> -o jsonpath='{.spec.disks}'`,
#   which must list one entry per formatted partition.
#
#   The always-on import edge (common.nix -> longhorn-disks.nix) is now
#   ASSERTED, not merely measured: this PR is the landing of that edge.
#   Whether the SHIPPING control-plane config actually resolves the default
#   single-disk list through that import is
#   tests/longhorn-common-default-disk-eval-test.nix -- this file still
#   resolves the module in isolation via stubs.

{ lib, pkgs }:

let
  modulesDir = ../modules;
  checksFile = modulesDir + "/longhorn-preflight-checks.nix";
  disksFile = modulesDir + "/longhorn-disks.nix";
  shapeFile = modulesDir + "/disko-shapes/longhorn-node.nix";
  installerFile = ../../usb-nixos-installer/zeta-install.sh;

  # ---------------------------------------------------------------------------
  # The two derivations under test, each reached the way NixOS reaches it.
  # ---------------------------------------------------------------------------

  # Set 3: what zeta-longhorn-preflight requires to be mounted.
  requiredMountsFor =
    fileSystems:
    (import checksFile {
      inherit lib fileSystems;
    }).requiredMounts;

  # Set 4: what this host tells Longhorn about. Read through the module's own
  # option declaration rather than restated, so a change to the default that
  # this test does not follow is a red check and not a silent divergence.
  # `pkgs` is passed because the module's signature takes it, even though the
  # option default does not use it.
  dataDisksDefaultFor =
    fileSystems:
    let
      module = import disksFile {
        config = {
          inherit fileSystems;
          zeta.longhorn.dataDisks = [ ];
          networking.hostName = "eval-test";
        };
        inherit lib pkgs;
      };
    in
    module.options.zeta.longhorn.dataDisks.default;

  # Set 4 again, but resolved by the REAL module system rather than read off
  # the option declaration. `dataDisksDefaultFor` above proves the EXPRESSION;
  # this proves the RESOLUTION, and they are different claims:
  #
  #   - the default now reads `config.fileSystems`, and the module it sits in
  #     writes systemd.tmpfiles.rules and services.k3s.extraFlags from the very
  #     option that default feeds. That is the shape an infinite recursion
  #     takes in NixOS, and reading `.default` directly cannot see it -- the
  #     expression evaluates fine in isolation and the host still fails to
  #     build.
  #   - option `default` is priority 1500 and `lib.mkDefault` is 1000, so a
  #     disko-shaped host must keep computing its list from
  #     zeta.disko.extraDisks and an explicit host setting (100) must beat
  #     both. Priority is a module-system fact; it is invisible from here
  #     without evaluating one.
  #
  # Stub option declarations rather than the full NixOS module set: this needs
  # the module system's merge/priority/laziness semantics, not a bootable
  # system, and pulling in nixpkgs' nixos modules would make an eval check that
  # is supposed to cost a PR nothing cost it a full system evaluation.
  stubOptions =
    { lib, ... }:
    {
      options = {
        fileSystems = lib.mkOption {
          type = lib.types.attrsOf (lib.types.attrsOf lib.types.anything);
          default = { };
        };
        networking.hostName = lib.mkOption {
          type = lib.types.str;
          default = "eval-test";
        };
        systemd.tmpfiles.rules = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
        };
        services.k3s.extraFlags = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
        };
        # PR #12175's annotator oneshot. Without this stub, `resolve` throws
        # "undefined option systemd.services" the moment longhorn-disks.nix
        # writes the unit -- which is exactly the mkIf path the default
        # single-disk host must take. Attrset-of-anything: we read `.script`
        # and presence, not the full NixOS systemd submodule.
        systemd.services = lib.mkOption {
          type = lib.types.attrsOf lib.types.anything;
          default = { };
        };
        environment.etc = lib.mkOption {
          type = lib.types.attrsOf (
            lib.types.submodule {
              options.text = lib.mkOption {
                type = lib.types.str;
                default = "";
              };
            }
          );
          default = { };
        };
      };
    };

  resolve =
    hostModule:
    (lib.evalModules {
      modules = [
        stubOptions
        disksFile
        hostModule
        { _module.args.pkgs = pkgs; }
      ];
    }).config;

  # ---------------------------------------------------------------------------
  # Hosts, in the shapes that actually exist in this tree.
  # ---------------------------------------------------------------------------

  # A 4-disk box: one NVMe boot disk carrying the longhorn1 tail, plus three
  # data disks. This is the case Aaron's ask is about ("all ssd/hdd in the
  # machine formatted and used") and the case the old literal got wrong.
  # The decoys must NOT be swept in: root, ESP, nix store, and the local-path
  # provisioner's directory, which is storage but is not Longhorn's.
  fourDisk = {
    "/" = { };
    "/boot" = { };
    "/nix/store" = { };
    "/var/lib/zeta-local-storage" = { };
    "/var/lib/longhorn-disk1" = { };
    "/var/lib/longhorn-disk2" = { };
    "/var/lib/longhorn-disk3" = { };
    "/var/lib/longhorn-disk4" = { };
  };

  # A single-disk install: zeta-install.sh still carves the longhorn1 tail, so
  # even here there is a dedicated partition that the old literal ignored in
  # favour of a directory on root.
  singleDisk = {
    "/" = { };
    "/boot" = { };
    "/var/lib/longhorn-disk1" = { };
  };

  # hosts/control-plane as its COMMITTED placeholder stands: / and /boot only.
  # A host with genuinely no Longhorn filesystem must keep working, and must
  # not end up with an empty list -- the module's own
  # `lib.mkIf (cfg.dataDisks != [ ])` would switch itself off, taking the node
  # label with it.
  noLonghorn = {
    "/" = { };
    "/boot" = { };
  };

  # A host that gives Longhorn's own defaultDataPath a real device.
  rootPathMounted = {
    "/" = { };
    "/var/lib/longhorn" = { };
  };

  # The literal that shipped before this change, kept so the delta it produced
  # is pinned rather than remembered.
  oldFixedDefault = [ "/var/lib/longhorn" ];

  # ---------------------------------------------------------------------------
  # The bash side. zeta-install.sh is the only thing that decides which disks
  # get formatted, and it is 160 KB of shell that no Nix evaluation can see
  # into -- so read the two strings the two substrates have to agree on.
  # ---------------------------------------------------------------------------
  installerText = builtins.readFile installerFile;

  countOccurrences =
    needle: haystack:
    builtins.length (builtins.filter builtins.isString (builtins.split (lib.escapeRegex needle) haystack)) - 1;

  # The mountpoint prefix the installer uses on the INSTALLED system (it mounts
  # under /mnt during install and records "${mp#/mnt}").
  installerMountPrefix = "/var/lib/longhorn-disk";

  # The filesystem LABEL prefix it writes with `mkfs.ext4 -L longhornN`, which
  # is what preflight check 1b globs for under /dev/disk/by-label/.
  installerLabelPrefix = "longhorn";

  # DATA_DISKS is the installer's own name for "every internal disk that is not
  # the boot disk". Read the assignment back rather than trusting the prose.
  installerTakesEveryNonBootDisk =
    countOccurrences ''[[ "$d" != "$BOOT_DISK" ]] && DATA_DISKS+=("$d")'' installerText == 1;

  # ---------------------------------------------------------------------------
  # Reachability, MEASURED. See the header: the always-on edge is #12175's.
  # ---------------------------------------------------------------------------
  shapeText = builtins.readFile shapeFile;
  commonText = builtins.readFile (modulesDir + "/common.nix");
  workerTemplateText = builtins.readFile ../hosts/worker-template/default.nix;

  # The shape SETS the option (mkDefault, which beats the option default), but
  # it does not DECLARE it -- hosts/worker-template/default.nix is what imports
  # the module. Getting this backwards is what the first run of this test did,
  # and it is exactly the "reachable?" question the property exists to ask, so
  # both halves are read separately rather than conflated.
  shapeSetsDataDisks = countOccurrences "zeta.longhorn.dataDisks" shapeText >= 1;
  workerTemplateImportsDisks =
    countOccurrences "../../modules/longhorn-disks.nix" workerTemplateText == 1;
  alwaysOnEdges = countOccurrences "./longhorn-disks.nix" commonText;

  # ---------------------------------------------------------------------------

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- P0 the reader keeps its own assumptions honest ----------------------
    # Reading `.options.<path>.default` only means something if that is really
    # where the value lives. A reader that silently returns null the day the
    # module is restructured is the failure this whole file is against.
    (check "the disks module exposes zeta.longhorn.dataDisks as a declared option" (
      let
        module = import disksFile {
          config = {
            fileSystems = { };
            zeta.longhorn.dataDisks = [ ];
            networking.hostName = "eval-test";
          };
          inherit lib pkgs;
        };
      in
      builtins.isAttrs module
      && module ? options
      && module.options ? zeta
      && module.options.zeta.longhorn ? dataDisks
      && module.options.zeta.longhorn.dataDisks ? default
    ))
    (check "the derived default is a list of strings, on every host shape" (
      lib.all (fs: builtins.isList (dataDisksDefaultFor fs) && lib.all builtins.isString (dataDisksDefaultFor fs)) [
        fourDisk
        singleDisk
        noLonghorn
        rootPathMounted
      ]
    ))

    # -- P1 THE FINDING: pin the delta the old fixed literal produced --------
    # If someone reverts the default to a literal, this goes red. Asserting
    # merely "the default is non-empty" would have passed against the bug --
    # the bug WAS a non-empty one-element list.
    (check "a 4-disk host no longer registers a single path (the old literal did)" (
      builtins.length (dataDisksDefaultFor fourDisk) == 4
      && dataDisksDefaultFor fourDisk != oldFixedDefault
    ))
    (check "a 4-disk host registers every one of its Longhorn partitions by name" (
      dataDisksDefaultFor fourDisk == [
        "/var/lib/longhorn-disk1"
        "/var/lib/longhorn-disk2"
        "/var/lib/longhorn-disk3"
        "/var/lib/longhorn-disk4"
      ]
    ))
    (check "the old literal is NOT what a multi-disk host would have registered" (
      # States the bug as a falsifiable proposition rather than as prose: had
      # the fixed default been correct, this test would be unwritable.
      oldFixedDefault != requiredMountsFor fourDisk
      && builtins.length (requiredMountsFor fourDisk) == 4
    ))
    (check "even a SINGLE-disk host gains its dedicated longhorn1 tail partition" (
      # The old default sent a single-disk node's replicas to a directory on
      # the root filesystem while the longhorn1 partition sat empty.
      dataDisksDefaultFor singleDisk == [ "/var/lib/longhorn-disk1" ]
    ))

    # -- P2 IDENTITY with the set the node refuses to boot without -----------
    # This is the property that makes drift impossible rather than merely
    # unlikely: one expression, read through both consumers.
    (check "REGISTERED == REQUIRED on every host that declares a Longhorn filesystem" (
      lib.all (fs: dataDisksDefaultFor fs == requiredMountsFor fs) [
        fourDisk
        singleDisk
        rootPathMounted
      ]
    ))
    (check "the registered set is sorted and duplicate-free, so the Node CR is deterministic" (
      let
        d = dataDisksDefaultFor fourDisk;
      in
      d == lib.sort (a: b: a < b) d && d == lib.unique d
    ))

    # -- P3 the decoys stay out ---------------------------------------------
    # Registering / or /nix/store as a Longhorn disk would hand replica
    # placement the root filesystem -- a worse outcome than the bug.
    (check "root, ESP, nix store and the local-path directory are never registered" (
      let
        d = dataDisksDefaultFor fourDisk;
      in
      !(builtins.elem "/" d)
      && !(builtins.elem "/boot" d)
      && !(builtins.elem "/nix/store" d)
      && !(builtins.elem "/var/lib/zeta-local-storage" d)
    ))

    # -- P4 the no-Longhorn host keeps working, and keeps the module ON ------
    (check "a host declaring no Longhorn filesystem falls back to the default data path" (
      dataDisksDefaultFor noLonghorn == oldFixedDefault
    ))
    (check "the fallback is non-empty, so the module's own mkIf cannot switch it off" (
      # `config = lib.mkIf (cfg.dataDisks != [ ])`. An empty default here would
      # silently drop the node label and (post-#12175) the disks annotation.
      dataDisksDefaultFor noLonghorn != [ ]
    ))
    (check "a host that gives defaultDataPath a real device registers that device" (
      dataDisksDefaultFor rootPathMounted == [ "/var/lib/longhorn" ]
    ))

    # -- P5 the bash/nix seam: the installer and the derivation agree --------
    # zeta-install.sh chooses the mountpoints; this module filters on a prefix.
    # Neither can see the other, and a rename on either side is silent -- the
    # node would format four disks and register none, with every check green.
    (check "zeta-install.sh mounts Longhorn partitions at the prefix the filter matches" (
      countOccurrences installerMountPrefix installerText >= 1
      && lib.hasPrefix "/var/lib/longhorn" installerMountPrefix
      && requiredMountsFor { "${installerMountPrefix}7" = { }; } == [ "${installerMountPrefix}7" ]
    ))
    (check "zeta-install.sh writes the filesystem label preflight check 1b globs for" (
      countOccurrences ''mkfs.ext4 -F -L "${installerLabelPrefix}''${i}"'' installerText == 1
      && countOccurrences "/dev/disk/by-label/${installerLabelPrefix}" (
        builtins.readFile checksFile
      ) == 1
    ))
    (check "zeta-install.sh takes EVERY internal disk that is not the boot disk" (
      # The node side can only use what the installer prepared. This is the
      # sentence that makes "use every disk" true at the format step; it is
      # read back from the script rather than believed.
      installerTakesEveryNonBootDisk
    ))

    # -- P5b the module system RESOLVES it -- recursion and priority ---------
    (check "a 4-disk hardware-configuration host resolves to all four paths, no recursion" (
      let
        c = resolve {
          fileSystems = fourDisk;
          networking.hostName = "control-plane";
        };
      in
      c.zeta.longhorn.dataDisks == [
        "/var/lib/longhorn-disk1"
        "/var/lib/longhorn-disk2"
        "/var/lib/longhorn-disk3"
        "/var/lib/longhorn-disk4"
      ]
    ))
    (check "the downstream writes that read dataDisks resolve too (the recursion trap)" (
      # tmpfiles.rules and the k3s node label are written FROM dataDisks inside
      # the same module whose default now reads fileSystems. If that closed a
      # cycle, forcing these is where it would show.
      let
        c = resolve { fileSystems = fourDisk; };
      in
      builtins.length c.systemd.tmpfiles.rules == 4
      && builtins.elem "--node-label=zeta.io/longhorn-disks=4" c.services.k3s.extraFlags
    ))
    (check "a disko-shaped host keeps its own list: mkDefault (1000) beats the option default (1500)" (
      # The shape computes from zeta.disko.extraDisks. This change must be a
      # no-op on hosts/worker-template, not a second opinion about its disks.
      let
        c = resolve {
          fileSystems = fourDisk;
          zeta.longhorn.dataDisks = lib.mkDefault [ "/var/lib/longhorn-disk1" ];
        };
      in
      c.zeta.longhorn.dataDisks == [ "/var/lib/longhorn-disk1" ]
    ))
    (check "an explicit host setting still wins, so using FEWER disks stays possible" (
      let
        c = resolve {
          fileSystems = fourDisk;
          zeta.longhorn.dataDisks = [ "/var/lib/longhorn-disk2" ];
        };
      in
      c.zeta.longhorn.dataDisks == [ "/var/lib/longhorn-disk2" ]
    ))
    (check "a no-Longhorn host resolves to the fallback with the module still ENABLED" (
      let
        c = resolve { fileSystems = noLonghorn; };
      in
      c.zeta.longhorn.dataDisks == oldFixedDefault
      && builtins.elem "--node-label=zeta.io/longhorn-disks=1" c.services.k3s.extraFlags
    ))
    (check "the default single-disk list fires mkIf: create-default-disk label + annotator" (
      # This is the control-plane placeholder path: no Longhorn filesystem,
      # dataDisks falls back to [ "/var/lib/longhorn" ], and the three-part
      # mechanism must still arm. An empty default would drop the label and
      # silently starve the node once createDefaultDiskLabeledNodes=true.
      let
        c = resolve { fileSystems = noLonghorn; };
        unit = c.systemd.services.zeta-longhorn-node-disks or null;
      in
      builtins.elem "--node-label=node.longhorn.io/create-default-disk=config" c.services.k3s.extraFlags
      && unit != null
      && builtins.isString (unit.script or "")
      && lib.hasInfix "/var/lib/longhorn" (unit.script or "")
      && lib.hasInfix "default-disks-config" (unit.script or "")
    ))

    # -- P6 reachability, measured rather than assumed -----------------------
    (check "hosts/worker-template imports the disks module (the edge that exists today)" (
      workerTemplateImportsDisks
    ))
    (check "the disko shape SETS dataDisks with mkDefault, which the derived default yields to" (
      # mkDefault is priority 1000, an option `default` is 1500, so a
      # disko-shaped host keeps computing its list from zeta.disko.extraDisks
      # and this change is a no-op there. That is intended: the derivation is
      # for the hardware-configuration hosts that had nothing at all.
      shapeSetsDataDisks
    ))
    (check "common.nix imports longhorn-disks.nix (the always-on edge #12175 owns)" (
      # Was measured as 0-or-1 so this file stayed green on either side of
      # the merge. This PR is that merge: the edge is now required. Dropping
      # it re-starves every host that only imports common.nix -- including
      # control-plane, the host the USB installs.
      alwaysOnEdges == 1
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures;

  # Forcing `status` runs every property. A string on success, a throw naming
  # every broken property on failure -- so flake.nix, which merely evaluates
  # it, cannot pass while a property is red.
  status =
    if failures == [ ] then
      "longhorn disk registration: ${toString (builtins.length results)} properties held; "
      + "4-disk host registers ${toString (builtins.length (dataDisksDefaultFor fourDisk))} paths "
      + "(the fixed literal registered ${toString (builtins.length oldFixedDefault)}), "
      + "single-disk registers ${toString (builtins.length (dataDisksDefaultFor singleDisk))}, "
      + "no-Longhorn host falls back to ${toString (builtins.length (dataDisksDefaultFor noLonghorn))}; "
      + "always-on import edges to longhorn-disks.nix = ${toString alwaysOnEdges}"
    else
      throw (
        "longhorn disk registration: ${toString (builtins.length failures)} of "
        + "${toString (builtins.length results)} properties FAILED:\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
