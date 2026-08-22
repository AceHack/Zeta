# full-ai-cluster/nixos/tests/cilium-wireguard-preflight-eval-test.nix
#
# Properties of the Cilium WireGuard node preflight
# (nixos/modules/cilium-wireguard-{sources,preflight-checks,node-preflight,prereqs}.nix).
#
# NOT a VM test and NOT a boot test. Like longhorn-node-preflight-eval-test.nix,
# this is a pure evaluation test: `status` throws on failure, so forcing its
# value IS running it. flake.nix forces it inside
# `checks.<system>.cilium-wireguard-preflight`, which `nix flake check
# --no-build` evaluates on every PR touching full-ai-cluster/nixos/** -- it
# costs a PR nothing and runs on every platform, including the darwin one this
# was written on.
#
# WHAT IT CAN TELL YOU
#   - the REAL shipped manifests still request encryption.type=wireguard, in
#     both the first-boot HelmChart and the sync-wave -80 Application, so the
#     requirement this module exists for is a present fact and not a memory;
#   - the requirement is DERIVED from those manifests, and derives the right
#     answer on a tree that does NOT request WireGuard (where the unit declares
#     its own vacuity and exits 0);
#   - the module DECLARES exactly the kernel module the preflight CHECKS, from
#     one binding, so the two cannot drift;
#   - the check that would catch a real regression is present in the form that
#     catches it (a netlink link-add, and /sys/module -- not `modinfo`, which
#     is the `systemctl cat` of kernel modules and passes on a module that can
#     never load);
#   - the auto-load ordering hazard is not present (check 1 before check 2);
#   - the unit is wired into the boot path of every node, via the import edge
#     cilium-wireguard-prereqs.nix -> common.nix, and into a CI lane that boots
#     a real kernel.
#
# WHAT IT CANNOT TELL YOU
#   Nothing here boots a node or creates a network device. It proves the check
#   is present, non-vacuous and reachable; it cannot prove the check PASSES on
#   any particular kernel. The nearest thing to that evidence is the VM lane
#   (checks.x86_64-linux.k3s-control-plane-platform-fixes), which boots the
#   pinned nixos-25.11 kernel and asserts the probe really succeeds; the marker
#   to look for on metal is ZETA_CILIUM_WG_PREFLIGHT_OK.

{ lib, pkgs }:

let
  modulesDir = ../modules;
  checksFile = modulesDir + "/cilium-wireguard-preflight-checks.nix";
  moduleFile = modulesDir + "/cilium-wireguard-node-preflight.nix";
  prereqsFile = modulesDir + "/cilium-wireguard-prereqs.nix";
  sourcesFile = modulesDir + "/cilium-wireguard-sources.nix";

  callChecks = sources: import checksFile { inherit lib sources; };

  # -- The REAL roster, read through the same file the modules read ----------
  realSources = import sourcesFile;
  real = callChecks realSources;

  # -- Synthetic trees, to prove the derivation is a derivation --------------
  encryptedTree = callChecks [
    {
      name = "a.yaml";
      text = ''
        encryption:
          enabled: true
          type: wireguard      # node-to-node encryption
          nodeEncryption: true
      '';
    }
    {
      name = "b.yaml";
      text = ''
        routingMode: native
      '';
    }
  ];

  plaintextTree = callChecks [
    {
      name = "a.yaml";
      text = ''
        encryption:
          enabled: false
        routingMode: native
      '';
    }
  ];

  # IPsec is the other value `encryption.type` takes. It must NOT pull in a
  # WireGuard requirement -- a predicate that fires on any `encryption:` block
  # would be a check that cannot distinguish, which is most of the way to a
  # check that cannot fail.
  ipsecTree = callChecks [
    {
      name = "a.yaml";
      text = ''
        encryption:
          enabled: true
          type: ipsec
      '';
    }
  ];

  countOccurrences =
    needle: haystack:
    builtins.length (builtins.filter builtins.isString (builtins.split (lib.escapeRegex needle) haystack)) - 1;

  indexOf =
    needle: haystack:
    let
      parts = builtins.split (lib.escapeRegex needle) haystack;
    in
    if builtins.length parts < 2 then null else builtins.stringLength (builtins.head parts);

  # -- A STUB pkgs, not the real one -----------------------------------------
  # The substitution is load-bearing twice over:
  #
  #   1. it makes the assertion STRONGER. Comparing against a sentinel proves
  #      the module reads exactly `pkgs.iproute2` and `pkgs.wireguard-tools`;
  #      comparing against `pkgs.iproute2` would be satisfied by any expression
  #      that happens to evaluate to the same derivation.
  #   2. it makes this check RUN EVERYWHERE. `pkgs.iproute2` is linux-only, and
  #      forcing it on the darwin evaluation of `nix flake check` throws
  #      "not available on the requested hostPlatform" -- which would have
  #      meant this whole eval test could only run on one of the two platforms
  #      CI evaluates. Measured, not predicted: it threw on aarch64-darwin the
  #      first time this file was run.
  stubPkgs = {
    iproute2 = "STUB:pkgs.iproute2";
    wireguard-tools = "STUB:pkgs.wireguard-tools";
  };

  # -- The module's own wiring, read through a KNOWN wrapper shape -----------
  # `config` is a lib.mkIf, i.e. { _type = "if"; condition; content; }. Reading
  # `.content` without first proving `_type == "if"` is how a reader silently
  # returns the wrong value the day the wrapper changes; P0 below refuses that.
  moduleResult = import moduleFile {
    config = {
      zeta.cilium.wireguardPreflight.enable = true;
    };
    inherit lib;
    pkgs = stubPkgs;
  };
  moduleConfig = moduleResult.config;
  unit = moduleConfig.content.systemd.services.zeta-cilium-wg-preflight;

  # -- The DECLARATION side, read from the module that makes it -------------
  prereqsResult = import prereqsFile {
    config = { };
    inherit lib;
    pkgs = stubPkgs;
  };

  # -- Reachability: the import edges that put this on every node's boot path -
  prereqsText = builtins.readFile prereqsFile;
  commonText = builtins.readFile (modulesDir + "/common.nix");
  vmTestText = builtins.readFile ./k3s-control-plane-platform-fixes.nix;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- P0 the reader keeps its own assumptions honest ---------------------
    (check "the checks function returns a plain attrset carrying every key this test reads" (
      builtins.isAttrs real
      && !(real ? _type)
      && real ? requestedBy
      && real ? wireguardRequired
      && real ? kernelModule
      && real ? script
      && real ? okMarker
      && real ? failMarker
      && real ? skipMarker
    ))
    (check "the module's config is a lib.mkIf, the shape this test unwraps" (
      builtins.isAttrs moduleConfig && moduleConfig._type or null == "if"
    ))

    # -- P1 THE FINDING ITSELF, pinned ---------------------------------------
    # This is the assertion that makes the whole module non-hypothetical. It
    # reads the shipped manifests and asserts they still make the demand. If
    # someone turns encryption off, this goes red and the answer is to delete
    # the module, not to edit this line.
    (check "the shipped Cilium value surfaces DO request encryption.type=wireguard" (
      real.wireguardRequired
    ))
    (check "BOTH the first-boot HelmChart and the sync-wave -80 Application request it" (
      real.requestedBy == [
        "k8s/applications/cilium/Application.yaml"
        "k8s/bootstrap/cilium-install.yaml"
      ]
    ))
    (check "both also request nodeEncryption, so the requirement covers workers too" (
      real.nodeEncryptionRequestedBy == real.requestedBy
    ))

    # -- P2 the requirement is DERIVED, and derives the right answer ---------
    (check "a tree that requests wireguard yields the requirement and names the file" (
      encryptedTree.wireguardRequired && encryptedTree.requestedBy == [ "a.yaml" ]
    ))
    (check "a tree with encryption off yields NO requirement" (
      !plaintextTree.wireguardRequired && plaintextTree.requestedBy == [ ]
    ))
    (check "an IPsec tree does NOT pull in a WireGuard requirement" (
      !ipsecTree.wireguardRequired
    ))

    # -- P3 the vacuity is declared, not discovered -------------------------
    # A node whose cluster does not ask for WireGuard has nothing to check.
    # Saying so on the console is what stops "it passed" being read as "this
    # kernel can do WireGuard".
    (check "with no requirement the script emits the NOT_REQUIRED marker and exits 0" (
      countOccurrences plaintextTree.skipMarker plaintextTree.script == 1
      && countOccurrences "exit 0" plaintextTree.script == 1
    ))
    (check "with no requirement the script runs NONE of the kernel checks" (
      countOccurrences "/sys/module/" plaintextTree.script == 0
      && countOccurrences "ip link add" plaintextTree.script == 0
    ))
    (check "with no requirement the script cannot report OK either" (
      countOccurrences plaintextTree.okMarker plaintextTree.script == 0
    ))

    # -- P4 the checks that catch a real regression, in the form that catches it
    (check "the script asks /sys/module/wireguard -- the question with an answer" (
      countOccurrences "[ -d /sys/module/${real.kernelModule} ]" real.script == 1
    ))
    (check "the script does NOT settle for modinfo (passes on a module that can never load)" (
      countOccurrences "modinfo" real.script == 0
    ))
    (check "the script performs the netlink link-add cilium-agent performs" (
      countOccurrences "ip link add dev ${real.probeIface} type wireguard" real.script >= 1
    ))
    (check "the probe device is cleaned up before the add and on BOTH outcomes" (
      countOccurrences "ip link del dev ${real.probeIface}" real.script == 3
    ))
    # Not "cilium_wg0 does not appear" -- it legitimately appears in the wg-show
    # hint. The property that matters is that no ip link invocation touches any
    # device but the probe's, so count them and require the totals to agree.
    (check "every ip link add/del in the script names the probe device, never Cilium's" (
      countOccurrences "ip link add " real.script
      == countOccurrences "ip link add dev ${real.probeIface}" real.script
      && countOccurrences "ip link del " real.script
      == countOccurrences "ip link del dev ${real.probeIface}" real.script
      && countOccurrences "ip link " real.script
      == countOccurrences "ip link add " real.script + countOccurrences "ip link del " real.script
    ))

    # -- P5 the auto-load ordering hazard is absent --------------------------
    # RTM_NEWLINK on an unknown kind triggers request_module("rtnl-link-%s")
    # (net/core/rtnetlink.c) and wireguard declares MODULE_ALIAS_RTNL_LINK
    # (drivers/net/wireguard/main.c). So the probe LOADS the module as a side
    # effect. Run it before the /sys/module check and that check can no longer
    # fail -- which is the vacuity class, arrived at by ordering.
    (check "the /sys/module check runs BEFORE the netlink probe that would auto-load it" (
      let
        sysIdx = indexOf "/sys/module/${real.kernelModule}" real.script;
        probeIdx = indexOf "ip link add dev ${real.probeIface}" real.script;
      in
      sysIdx != null && probeIdx != null && sysIdx < probeIdx
    ))

    # -- P6 the declaration and the check come from ONE binding --------------
    (check "the module the preflight checks is the module the node declares" (
      prereqsResult.boot.kernelModules == [ real.kernelModule ]
      && real.kernelModule == "wireguard"
    ))
    (check "wireguard-tools is declared for the installed node, not only the ISO" (
      builtins.length prereqsResult.environment.systemPackages == 1
      && (builtins.head prereqsResult.environment.systemPackages) == stubPkgs.wireguard-tools
    ))

    # -- P7 the script refuses rather than reports --------------------------
    (check "the script exits non-zero when any check failed" (
      countOccurrences "exit 1" real.script == 1
    ))
    (check "both console markers are emitted, and only one of them per run" (
      countOccurrences real.failMarker real.script == 1
      && countOccurrences real.okMarker real.script == 1
    ))
    (check "failures are written to the physical console, not only the journal" (
      countOccurrences "> /dev/console" real.script == 1
      && countOccurrences "shout \"zeta-cilium-wg-preflight: REFUSED" real.script == 1
    ))
    (check "a missing wg tool WARNS and never colours the verdict" (
      countOccurrences "warnings=$((warnings + 1))" real.script == 1
      && countOccurrences "if [ \"$failures\" -gt 0 ]" real.script == 1
    ))

    # -- P8 REACHABILITY: this runs on every node, not only where opted in ---
    (check "cilium-wireguard-prereqs.nix imports the preflight module (edge 1 of 2)" (
      countOccurrences "./cilium-wireguard-node-preflight.nix" prereqsText == 1
    ))
    (check "common.nix imports cilium-wireguard-prereqs.nix, so every node gets it (edge 2 of 2)" (
      countOccurrences "./cilium-wireguard-prereqs.nix" commonText >= 1
    ))
    (check "the unit is pulled in by multi-user.target on every boot" (
      builtins.elem "multi-user.target" (unit.wantedBy or [ ])
    ))
    (check "the verdict lands BEFORE k3s starts the CNI that depends on it" (
      builtins.elem "k3s.service" (unit.before or [ ])
    ))
    (check "the unit does NOT gate k3s -- a loud CrashLoopBackOff beats a node that never joins" (
      !(builtins.elem "k3s.service" (unit.requiredBy or [ ]))
    ))
    (check "the unit runs after systemd-modules-load, which is what check 1 asks about" (
      builtins.elem "systemd-modules-load.service" (unit.after or [ ])
      && builtins.elem "systemd-modules-load.service" (unit.wants or [ ])
      && !(builtins.elem "systemd-modules-load.service" (unit.requires or [ ]))
    ))
    (check "the unit is a oneshot with no Restart= (a retry loop reads as in-progress, not refused)" (
      unit.serviceConfig.Type == "oneshot" && !(unit.serviceConfig ? Restart)
    ))
    (check "the probe's iproute2 comes from the unit's own path, not systemPackages" (
      (unit.path or [ ]) == [ stubPkgs.iproute2 ]
    ))
    # The stub above proves WHICH attribute the module reads; this proves that
    # attribute still EXISTS in the real nixpkgs this flake pins. `?` tests
    # presence without forcing the value, so it stays evaluable on darwin where
    # forcing pkgs.iproute2 throws.
    (check "the nixpkgs attributes those two modules read still exist" (
      pkgs ? iproute2 && pkgs ? wireguard-tools
    ))

    # -- P9 a CI lane EXECUTES this guard on a real kernel -------------------
    # Eval proves the guard is wired and non-vacuous. Only a boot proves it can
    # go green. Asserting the VM lane still references the unit and its marker
    # is what stops that lane quietly dropping the assertion later.
    (check "the platform-fixes VM lane imports the prereqs module" (
      countOccurrences "cilium-wireguard-prereqs.nix" vmTestText >= 1
    ))
    (check "the platform-fixes VM lane asserts the unit AND its OK marker" (
      countOccurrences "zeta-cilium-wg-preflight.service" vmTestText >= 1
      && countOccurrences real.okMarker vmTestText >= 1
      && countOccurrences real.failMarker vmTestText >= 1
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
      "cilium wireguard preflight: ${toString (builtins.length results)} properties held; "
      + "wireguard requested by ${toString (builtins.length real.requestedBy)} shipped value surface(s); "
      + "kernel module declared and checked as '${real.kernelModule}'"
    else
      throw (
        "cilium wireguard preflight: "
        + toString (builtins.length failures)
        + " properties FAILED:\n  - "
        + lib.concatStringsSep "\n  - " (map (f: f.name) failures)
      );
}
