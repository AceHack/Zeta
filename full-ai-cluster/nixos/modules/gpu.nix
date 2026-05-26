# full-ai-cluster/nixos/modules/gpu.nix
#
# NVIDIA driver + container toolkit for AI worker nodes.
# AMD ROCm + Intel oneAPI live in sibling modules (TODO when first
# AMD/Intel cards land).

{ config, pkgs, lib, ... }:

{
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
