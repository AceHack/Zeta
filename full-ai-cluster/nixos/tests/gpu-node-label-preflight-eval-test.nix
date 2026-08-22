# full-ai-cluster/nixos/tests/gpu-node-label-preflight-eval-test.nix
#
# Properties of the GPU node-label preflight (nixos/modules/gpu-node-label-checks.nix
# + nixos/modules/gpu-node-label-preflight.nix + the label emission in
# nixos/modules/gpu.nix).
#
# NOT a VM test and NOT a boot test. Like nvidia-open-guard-gate.nix and
# longhorn-node-preflight-eval-test.nix, this is a pure evaluation test: forcing
# `status` runs every property. flake.nix forces it inside
# `checks.<system>.gpu-node-label-preflight`, which `nix flake check --no-build`
# evaluates on every PR -- it costs a PR nothing.
#
# It reads the REAL `nixosConfigurations.worker-gpu`, not a stub, so what it
# checks is what that host actually ships.
#
# WHAT IT CAN TELL YOU
#   - the host really does emit `--node-label=zeta.io/gpu=<vendor>` -- the fix is
#     not "delete the label", and a worker that has a GPU still advertises it;
#   - that flag is the one the checks file GENERATES, not a second copy of the
#     string, so the claim and the probe cannot drift apart -- and changing the
#     vendor moves both the label and the PCI vendor ID the probe looks for;
#   - the probe is reachable on that host and lands BEFORE k3s.service, so the
#     verdict is on the console before kubelet registers the node;
#   - the refusal is non-vacuous: the exact device count that triggers it, the
#     vfio-pci arm, the console write, and the non-zero exit are all present;
#   - the label's live consumer -- the NVIDIA device-plugin DaemonSet's
#     nodeSelector in gpu-device-plugin.nix -- still selects on the SAME string
#     this module emits, so renaming one without the other is a red check.
#
# WHAT IT CANNOT TELL YOU
#   Nothing here boots a node or touches a PCI bus. It proves the check is
#   present, derived, non-vacuous and reachable; it cannot prove the check
#   PASSES on any particular hardware, and it cannot prove any host in this repo
#   HAS a GPU -- no host config in this tree records one. Only a boot can, and
#   the console marker to look for is ZETA_GPU_NODE_LABEL_PREFLIGHT_OK with
#   devices >= 1.

{ pkgs, nixosConfig }:

let
  inherit (pkgs) lib;

  nixosDir = ../.;
  modulesDir = ../modules;
  checksFile = modulesDir + "/gpu-node-label-checks.nix";

  callChecks = vendor: import checksFile { inherit lib vendor; };

  nvidia = callChecks "nvidia";

  # A second vendor, used only to prove the derivation is a DERIVATION. If the
  # label or the probed PCI ID were constants, these two would collide.
  amd = callChecks "amd";

  hostConfig = nixosConfig.config;
  k3sFlags = hostConfig.services.k3s.extraFlags;
  unit = hostConfig.systemd.services.zeta-gpu-node-label-preflight or null;

  # The same host with the preflight switched off. Used for one property only:
  # that the CLAIM and the CHECK share a switch, so no reachable configuration
  # advertises a GPU with nothing verifying it.
  disabledConfig =
    (nixosConfig.extendModules {
      modules = [ { zeta.gpu.nodeLabelPreflight.enable = false; } ];
    }).config;

  countOccurrences =
    needle: haystack:
    builtins.length (builtins.filter builtins.isString (builtins.split (lib.escapeRegex needle) haystack)) - 1;

  gpuText = builtins.readFile (modulesDir + "/gpu.nix");
  pluginText = builtins.readFile (modulesDir + "/gpu-device-plugin.nix");

  # Every `--node-label=zeta.io/gpu=...` the host ends up emitting. More than
  # one is a bug on its own: a Kubernetes label key holds a single value, so two
  # would mean the node's own config disagrees about what it is.
  gpuLabelFlagsOf = flags: builtins.filter (f: lib.hasPrefix "--node-label=${nvidia.labelKey}=" f) flags;
  gpuLabelFlags = gpuLabelFlagsOf k3sFlags;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- P0 the reader keeps its own assumptions honest ----------------------
    (check "the checks function returns a plain attrset carrying every key this test reads" (
      builtins.isAttrs nvidia
      && !(nvidia ? _type)
      && nvidia ? nodeLabel
      && nvidia ? nodeLabelFlag
      && nvidia ? pciVendorId
      && nvidia ? labelKey
      && nvidia ? okMarker
      && nvidia ? failMarker
      && nvidia ? script
    ))
    (check "the host config exposes the k3s flag list and the preflight unit this test reads" (
      builtins.isList k3sFlags && unit != null
    ))

    # -- P1 the label is still EMITTED (the fix is not "delete the label") ---
    # A worker-gpu that stops advertising a GPU it HAS is its own regression.
    (check "worker-gpu still advertises exactly one zeta.io/gpu label" (
      builtins.length gpuLabelFlags == 1
    ))
    (check "and it is the flag the checks file generates, not a second copy of the string" (
      gpuLabelFlags == [ nvidia.nodeLabelFlag ]
    ))
    (check "the emitted label is the documented one, zeta.io/gpu=nvidia" (
      nvidia.nodeLabel == "zeta.io/gpu=nvidia" && nvidia.nodeLabelFlag == "--node-label=zeta.io/gpu=nvidia"
    ))
    # Secondary drift guard. The load-bearing checks that the flag is DERIVED
    # are the two above (the real host's flag list equals the generated flag)
    # and P4 below (the shipped unit runs the generated script); these two count
    # >= 1 rather than == 1 because both names are also written in gpu.nix's
    # prose, and a comment that explains the wiring is not a second copy of it.
    (check "gpu.nix takes the flag from the checks file rather than writing it out" (
      countOccurrences "./gpu-node-label-checks.nix" gpuText >= 1
      && countOccurrences "gpuNodeLabel.nodeLabelFlag" gpuText >= 1
    ))

    # -- P2 ONE source: the label and the probe come from the same vendor ----
    (check "the probe greps for the PCI vendor ID of the vendor the label names" (
      nvidia.pciVendorId == "0x10de"
      && countOccurrences nvidia.pciVendorId nvidia.script >= 1
    ))
    (check "the vendor appears in the refusal text, so the message names the claim" (
      countOccurrences nvidia.nodeLabel nvidia.script >= 1
    ))
    (check "the derivation is a DERIVATION: another vendor moves BOTH the label and the ID" (
      amd.nodeLabel != nvidia.nodeLabel
      && amd.pciVendorId != nvidia.pciVendorId
      && amd.nodeLabel == "zeta.io/gpu=amd"
      && countOccurrences amd.pciVendorId amd.script >= 1
      && countOccurrences nvidia.pciVendorId amd.script == 0
    ))

    # -- P3 the refusal has teeth -------------------------------------------
    (check "the probe counts only DISPLAY-class devices, not the board's audio function" (
      countOccurrences "0x03*" nvidia.script == 1
    ))
    (check "zero devices of the claimed vendor is a REFUSAL" (
      countOccurrences ''[ "$total" -eq 0 ]'' nvidia.script == 1
    ))
    (check "all-passthrough is a SEPARATE refusal (a card owned by a VM is not available to pods)" (
      countOccurrences ''[ "$available" -eq 0 ]'' nvidia.script == 1
      && countOccurrences "vfio-pci" nvidia.script >= 1
    ))
    (check "the script exits non-zero when any check failed" (
      countOccurrences "exit 1" nvidia.script == 1
    ))
    (check "both console markers are emitted, and only one of them per run" (
      countOccurrences nvidia.okMarker nvidia.script == 1
      && countOccurrences nvidia.failMarker nvidia.script == 1
    ))
    (check "failures are written to the physical console, not only the journal" (
      countOccurrences "> /dev/console" nvidia.script == 1
      && countOccurrences ''shout "zeta-gpu-node-label-preflight: REFUSED'' nvidia.script == 1
    ))
    (check "each refusal names a remedy, so the console message is actionable" (
      countOccurrences "remedy:" nvidia.script == 1
      && countOccurrences "fail \"" nvidia.script == 2
    ))

    # -- P4 what SHIPS is what the checks file generated ---------------------
    # Reading the unit's script off the real host config, not the module source,
    # is what stops the module being wired to some other text.
    (check "the unit on worker-gpu runs exactly the script the checks file produced" (
      unit.script == nvidia.script
    ))

    # -- P5 REACHABILITY: the module that CLAIMS also instantiates the CHECK --
    # The in-tree counter-example this rule comes from is nvidia-open-guard.nix,
    # whose boot probe was `lib.mkIf useOpen` against an `open = false` fleet --
    # present, tested, and never once executed. Its unit is now unconditional;
    # nvidia-open-guard-gate.nix pins that.
    (check "gpu.nix -- the module that emits the label -- imports the preflight" (
      countOccurrences "./gpu-node-label-preflight.nix" gpuText >= 1
    ))
    (check "the preflight is enabled by DEFAULT, not opt-in per host" (
      hostConfig.zeta.gpu.nodeLabelPreflight.enable
      && countOccurrences "zeta.gpu.nodeLabelPreflight" (
        builtins.readFile (nixosDir + "/hosts/worker-gpu/configuration.nix")
      ) == 0
    ))
    (check "the unit is pulled in by multi-user.target on every boot" (
      builtins.elem "multi-user.target" (unit.wantedBy or [ ])
    ))
    (check "the verdict lands BEFORE k3s registers this node as a place for GPU work" (
      builtins.elem "k3s.service" (unit.before or [ ])
    ))
    (check "the unit runs after module load, so a bound driver reads as bound" (
      builtins.elem "systemd-modules-load.service" (unit.after or [ ])
    ))
    (check "the unit is a oneshot with no Restart= (a retry loop reads as in-progress, not refused)" (
      unit.serviceConfig.Type == "oneshot" && !(unit.serviceConfig ? Restart)
    ))

    # The claim and the check share ONE switch. This is what stops the `enable`
    # option from being a new way to reintroduce the very defect: with the
    # preflight off, the label is gone too. It doubles as the non-vacuity proof
    # for every reachability property above -- both readings can change, so none
    # of them is asserting a constant.
    (check "switching the preflight OFF withdraws the label as well as the check" (
      gpuLabelFlagsOf disabledConfig.services.k3s.extraFlags == [ ]
      && !(disabledConfig.systemd.services ? zeta-gpu-node-label-preflight)
    ))

    # -- P6 the label's LIVE consumer cannot drift from the label ------------
    # gpu-device-plugin.nix:85-86 is the only consumer that is not masked by a
    # zero replica count today (k8s/applications/vllm/deployment.yaml:16 and
    # k8s/applications/ollama/Application.yaml:34 both ship zero), and
    # hosts/worker-gpu/configuration.nix enables it, so k3s really applies that
    # DaemonSet. Renaming the label without it is a red check here.
    #
    # The needle carries its terminating newline. Without it the match is a
    # PREFIX test, and a selector renamed to `zeta.io/gpu: nvidia-renamed` still
    # contains `zeta.io/gpu: nvidia` -- which is how this property survived its
    # own mutation test the first time it was written.
    (check "the NVIDIA device-plugin DaemonSet still selects on the label this module emits" (
      countOccurrences "${nvidia.labelKey}: ${nvidia.vendor}\n" pluginText == 1
    ))
    (check "and the device plugin is actually enabled on worker-gpu, so that selector is live" (
      hostConfig.zeta.gpu-device-plugin.enable
      && builtins.elem "nvidia" hostConfig.zeta.gpu-device-plugin.vendors
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
      "gpu node-label preflight: ${toString (builtins.length results)} properties held; "
      + "worker-gpu emits ${toString gpuLabelFlags} and probes PCI vendor ${nvidia.pciVendorId} at boot"
    else
      throw (
        "gpu node-label preflight: ${toString (builtins.length failures)} of "
        + "${toString (builtins.length results)} properties FAILED:\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
