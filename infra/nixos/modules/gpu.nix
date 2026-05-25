# infra/nixos/modules/gpu.nix
#
# NVIDIA GPU enablement for AI worker nodes. Imported by any host that
# has NVIDIA hardware and should run GPU-accelerated workloads (Orleans
# AI pods, model-serving, training).
#
# AMD GPUs use a separate path (ROCm); add a parallel module + per-host
# selector when the first AMD card lands in the cluster.

{ config, pkgs, lib, ... }:

{
  # ---------------------------------------------------------------------------
  # Permit unfree packages (NVIDIA driver, cuda)
  # ---------------------------------------------------------------------------
  nixpkgs.config.allowUnfreePredicate = pkg:
    let
      name = lib.getName pkg;
    in
    # Explicit nvidia driver components
    builtins.elem name [
      "nvidia-x11"
      "nvidia-settings"
      "nvidia-persistenced"
      "nvidia-docker"
      "nvidia-container-toolkit"
    ]
    # CUDA toolchain — `cuda`-prefixed packages: covers cuda_cudart,
    # cuda_nvcc, cuda_cuobjdump, cuda_nvprune, cuda_cccl, cuda_nvtx,
    # cuda_profiler_api, AND the underscore-less variants like
    # cudatoolkit + cudaPackages.* aliases. The predicate is
    # intentionally broader than the underscore-only set because
    # nixpkgs uses both spellings depending on the package generation.
    || lib.hasPrefix "cuda" name
    # CUDA support libraries — libcublas, libcurand, libcusolver, libcusparse,
    # libcufft, libcudnn, libnpp, libnvjpeg, libnvjitlink, ...
    || lib.hasPrefix "libcu" name
    || lib.hasPrefix "libnv" name
    || lib.hasPrefix "libnp" name
    # The umbrella package that pulls everything together
    || name == "cuda-merged";

  # ---------------------------------------------------------------------------
  # Kernel modules + driver
  # ---------------------------------------------------------------------------
  services.xserver.videoDrivers = [ "nvidia" ];

  hardware.nvidia = {
    # Use the production driver branch (stable). Override per-host for
    # `beta` or `latest` when a newer driver is needed.
    package = config.boot.kernelPackages.nvidiaPackages.production;

    # Modesetting for Wayland-era kernel paths even on headless workers.
    modesetting.enable = true;

    # nvidia-persistenced keeps the driver loaded so first-pod-after-boot
    # doesn't pay an initialization tax (~3s) on every cold start.
    nvidiaPersistenced = true;

    # Power management — keep GPUs awake when pods aren't running so
    # ECC stays initialized; matters for AI training stability.
    powerManagement.enable = false;
    powerManagement.finegrained = false;

    # Open-source kernel modules — works on RTX 20-series and newer.
    # Default is false (proprietary modules) for broadest hardware
    # compatibility, including any cards in the cluster older than
    # Turing. Per-host override for newer-only nodes:
    #   hardware.nvidia.open = lib.mkForce true;
    open = lib.mkDefault false;
  };

  hardware.graphics = {
    enable = true;
    enable32Bit = true;
  };

  # ---------------------------------------------------------------------------
  # Container runtime — NVIDIA container toolkit so K3S pods can request
  # GPUs via `resources.limits."nvidia.com/gpu" = 1`.
  # ---------------------------------------------------------------------------
  hardware.nvidia-container-toolkit.enable = true;

  # K3S uses containerd; the toolkit hooks register automatically.

  # ---------------------------------------------------------------------------
  # CUDA tooling on the host for diagnostics + debugging.
  # ---------------------------------------------------------------------------
  environment.systemPackages = with pkgs; [
    nvtopPackages.nvidia    # interactive GPU monitor
    cudaPackages.cuda_cudart
    cudaPackages.cuda_nvcc

    # Standard GPU probe tools (already in common.nix-adjacent profile;
    # listed here for discoverability when this module is imported alone)
    glxinfo
    vulkan-tools
    clinfo
  ];

  # ---------------------------------------------------------------------------
  # Node label so K3S workloads can target GPU nodes via nodeSelector:
  #   nodeSelector:
  #     zeta.io/gpu: "nvidia"
  # ---------------------------------------------------------------------------
  services.k3s.extraFlags = lib.mkAfter [
    "--node-label=zeta.io/gpu=nvidia"
  ];
}
