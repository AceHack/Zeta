# full-ai-cluster/nixos/modules/gpu.nix
#
# NVIDIA driver + container toolkit for AI worker nodes.
# AMD ROCm + Intel oneAPI live in sibling modules (TODO when first
# AMD/Intel cards land).

{ config, pkgs, lib, ... }:

{
  imports = [
    ./nvidia-open-guard.nix
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

  services.k3s.extraFlags = lib.mkAfter [
    "--node-label=zeta.io/gpu=nvidia"
  ];
}
