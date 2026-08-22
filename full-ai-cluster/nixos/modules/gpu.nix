# full-ai-cluster/nixos/modules/gpu.nix
#
# NVIDIA driver + container toolkit for AI worker nodes.
# AMD ROCm + Intel oneAPI live in sibling modules (TODO when first
# AMD/Intel cards land).

{ config, pkgs, lib, ... }:

let
  # The label this host advertises AND the PCI probe that checks it, from one
  # `vendor` value. gpu.nix takes the flag string from here rather than writing
  # it out, so the claim and the check cannot drift apart -- see
  # ./gpu-node-label-checks.nix.
  gpuNodeLabel = import ./gpu-node-label-checks.nix {
    inherit lib;
    inherit (config.zeta.gpu.nodeLabelPreflight) vendor;
  };
in
{
  imports = [
    ./nvidia-open-guard.nix
    ./gpu-node-label-preflight.nix
  ];

  nixpkgs.config.allowUnfreePredicate = pkg:
    let name = lib.getName pkg; in
    builtins.elem name [
      "nvidia-x11"
      "nvidia-settings"
      "nvidia-persistenced"
      "nvidia-docker"
      "nvidia-container-toolkit"
    ]
    || lib.hasPrefix "cuda" name
    || lib.hasPrefix "libcu" name
    || lib.hasPrefix "libnv" name
    || lib.hasPrefix "libnp" name
    || name == "cuda-merged";

  services.xserver.videoDrivers = [ "nvidia" ];

  hardware.nvidia = {
    package = config.boot.kernelPackages.nvidiaPackages.production;
    modesetting.enable = true;
    nvidiaPersistenced = true;
    powerManagement.enable = false;
    powerManagement.finegrained = false;

    # Open-source kernel modules. Turing (RTX 20-series / GTX 16xx) or newer
    # only: they depend on the GSP, which Maxwell/Pascal/Volta do not have.
    #
    # Left at false because NO host in this repo has a known GPU — every GPU
    # host's hardware-configuration.nix is a placeholder, and the audited
    # inventory register holds one card. Flipping the fleet default on that
    # basis would be guessing, and a GPU node that cannot load its driver is
    # worse than an unfree closure.
    #
    # The default is NOT "the safe one" in both directions. Blackwell
    # (RTX 50-series) has no proprietary kernel module at all — on such a node
    # `false` is the broken setting, not the cautious one.
    #
    # Per-host, after running bun tools/nvidia-open-preflight.ts ON that node:
    #   zeta.gpu.openModulePreflight.passed   = true;
    #   zeta.gpu.openModulePreflight.evidence = "2026-.., <host>: <cards/cc>";
    #   hardware.nvidia.open = lib.mkForce true;
    # The attestation is enforced by ./nvidia-open-guard.nix, not by this
    # comment — `open = true` without it fails the build.
    open = lib.mkDefault false;
  };

  hardware.graphics = {
    enable = true;
    enable32Bit = true;
  };

  hardware.nvidia-container-toolkit.enable = true;

  environment.systemPackages = with pkgs; [
    nvtopPackages.nvidia
    cudaPackages.cuda_cudart
    cudaPackages.cuda_nvcc
    mesa-demos
    vulkan-tools
    clinfo
  ];

  # A node label is a scheduling PROMISE, so it is CHECKED at boot rather than
  # merely asserted at build time. This line used to read
  # `"--node-label=zeta.io/gpu=nvidia"`, spelled out here, applied by every host
  # that imports this module whether or not a card was present -- and every GPU
  # host in this tree carries a placeholder hardware-configuration.nix, so
  # nothing had ever established that any of them has one. The string now comes
  # from the same file that generates the boot-time PCI probe
  # (./gpu-node-label-preflight.nix, imported above and enabled by default), so
  # a node making this claim is a node that refuses on the console when the
  # claim is false. NixOS cannot condition this at eval time -- GPU presence is
  # a runtime fact about the target box; see that module's header.
  #
  # The claim and the check share ONE switch. `lib.optional` on the preflight's
  # own `enable` means there is no reachable state in which this node advertises
  # a GPU that nothing verifies -- turning the guard off turns the claim off
  # with it. An `enable` that silenced only the check would be exactly the knob
  # this change exists to remove.
  services.k3s.extraFlags = lib.mkAfter (
    lib.optional config.zeta.gpu.nodeLabelPreflight.enable gpuNodeLabel.nodeLabelFlag
  );
}
