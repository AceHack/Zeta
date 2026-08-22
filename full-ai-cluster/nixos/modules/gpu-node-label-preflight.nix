# full-ai-cluster/nixos/modules/gpu-node-label-preflight.nix
#
# Boot-time REFUSAL for the GPU node label, so a node that advertises
# `zeta.io/gpu=<vendor>` to the Kubernetes scheduler and has no such card says
# so on the console at bring-up instead of accepting GPU pods that then fail at
# runtime.
#
# Imported by gpu.nix -- the SAME module that emits the label -- so the check is
# instantiated by exactly the hosts that make the claim, and cannot be present
# on some of them and absent on others. That import edge is the whole point: a
# preflight only some hosts instantiate is a guard that cannot fire where it
# matters (nvidia-open-guard.nix's boot probe was the in-tree example, gated
# `lib.mkIf useOpen` against a `open = false` fleet default -- shipped, tested,
# and never executed on any host in this repo until it was made reachable in the
# same change as this file).
#
# WHY THIS IS A BOOT PROBE AND NOT A BUILD-TIME CONDITIONAL
# --------------------------------------------------------
# The obvious fix to an unconditional label is a conditional one. It is not
# available: NixOS evaluates this configuration on a BUILD machine, and whether
# a GPU is seated in the target box is a RUNTIME fact about that box. Nothing at
# eval time can see the PCI bus -- and the hardware-configuration.nix files for
# every GPU host in this tree are placeholders, so the config does not even
# carry a second-hand claim to condition on. A build-time `if` would be a guess
# wearing a conditional's clothes. The only honest reader of "is there a GPU in
# this machine" is code running ON that machine, after the bus is enumerated.
#
# WHAT THE OPERATOR SEES WHEN THE CLAIM IS FALSE
# ----------------------------------------------
#   [FAILED] Failed to start GPU node-label preflight (the node advertises a GPU it must actually have).
#   zeta-gpu-node-label-preflight: REFUSED -- this node advertises zeta.io/gpu=nvidia ...
#   zeta-gpu-node-label-preflight:   remedy: the label is emitted by nixos/modules/gpu.nix ...
#   ZETA_GPU_NODE_LABEL_PREFLIGHT_FAILED failures=1 vendor=nvidia devices=0 available=0 passthrough=0
#
# on the physical console (the checks write to /dev/console, the way
# k3s-join-observer.nix puts its contract markers on serial), and in
# `systemctl --failed` and the journal thereafter.
#
# SEVERITY: THIS DOES NOT BLOCK k3s, AND THAT IS A DELIBERATE, REVISABLE CHOICE
# ----------------------------------------------------------------------------
# Two stronger wirings exist and neither ships here:
#
#   1. `requiredBy = [ "k3s.service" ]` -- a failed preflight means the node
#      does not join at all. That is the fail-closed shape, and it is the same
#      call longhorn-node-preflight.nix:26-42 made and declined for the same
#      reason: this preflight has never run on physical hardware, and wiring an
#      unrun check as a hard gate means a false positive costs the operator the
#      cluster during the one bring-up where they can least debug it.
#
#   2. Emitting the LABEL ITSELF from the probe rather than from
#      `services.k3s.extraFlags` -- writing `node-label:` into a
#      /etc/rancher/k3s/config.yaml.d drop-in only when the card is found, so a
#      GPU-less node carries no label at all rather than a loud complaint and a
#      false label. That is the stronger fix and the one to reach for next. It
#      is not taken here because its failure direction is the regression this
#      change must not cause: if k3s does not read the drop-in on this pinned
#      version -- which cannot be established without booting a node -- a worker
#      that DOES have a GPU silently stops advertising it. Refusing loudly while
#      still labelling is strictly worse than that fix and strictly better than
#      the unconditional label it replaces.
#
# The evidence that licenses either upgrade is the same: one clean metal boot on
# a GPU worker showing ZETA_GPU_NODE_LABEL_PREFLIGHT_OK with devices >= 1, plus
# (for #2) `k3s agent` on that host picking up a node-label from
# /etc/rancher/k3s/config.yaml.d/. Until then the honest severity is "refuses
# loudly, does not amputate".
#
# `before = [ "k3s.service" ]` IS set, so the verdict is on the console before
# kubelet registers this node and starts advertising it as a place to put GPU
# work.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.gpu.nodeLabelPreflight;

  checks = import ./gpu-node-label-checks.nix {
    inherit lib;
    inherit (cfg) vendor;
  };
in
{
  options.zeta.gpu.nodeLabelPreflight = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = ''
        Run the boot-time GPU node-label preflight: this host really has at
        least one display device from the vendor its `zeta.io/gpu` label claims,
        and at least one of them is not bound to vfio-pci for a VM.

        Default true on every host that imports gpu.nix, which is exactly the
        set of hosts that emit the label -- and gpu.nix gates the LABEL on this
        same option, so switching it off withdraws the claim along with the
        check. There is deliberately no state in which the node advertises a GPU
        that nothing verifies: that state is the defect this module removes, and
        an `enable` that silenced only the check would put it straight back.
      '';
    };

    vendor = lib.mkOption {
      type = lib.types.enum [
        "nvidia"
        "amd"
        "intel"
      ];
      default = "nvidia";
      description = ''
        The GPU vendor this node claims. Emitted as `zeta.io/gpu=<vendor>` by
        gpu.nix AND checked against the PCI bus by this preflight -- one value,
        both uses, so the claim and the check cannot drift apart.

        Note the `intel` case is a weak check: integrated graphics carry PCI
        vendor 0x8086 with a display class, so an Intel claim passes on hardware
        with no discrete accelerator. See gpu-node-label-checks.nix.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-gpu-node-label-preflight = {
      description = "GPU node-label preflight (the node advertises a GPU it must actually have)";

      # systemd-modules-load.service: the PCI bus is enumerated long before this
      #   by the kernel itself, but ordering after module load means a device
      #   whose driver binds at modules-load time reports its real driver rather
      #   than 'none', which makes the vfio-pci arm of the check meaningful.
      after = [ "systemd-modules-load.service" ];
      before = [ "k3s.service" ];
      wantedBy = [ "multi-user.target" ];

      # coreutils for cat/basename/readlink. Store paths via `path` rather than
      # relying on the unit's inherited PATH, so the check does not depend on
      # environment.systemPackages.
      path = [ pkgs.coreutils ];

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        # No Restart=. A retry loop would turn a hard refusal into a unit that
        # is perpetually "activating", which reads as in-progress rather than as
        # refused -- the failure mode this whole file is against.
      };

      script = checks.script;
    };
  };
}
