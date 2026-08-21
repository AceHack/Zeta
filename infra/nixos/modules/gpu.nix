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
  imports = [
    ./nvidia-open-guard.nix
  ];

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
  #
  # THIS LABEL IS STILL UNCONDITIONAL IN THIS TREE, AND THAT IS RECORDED RATHER
  # THAN FIXED. Stated precisely so it is not mistaken for a checked claim:
  #
  #   - Every host importing this module advertises an NVIDIA GPU to the
  #     Kubernetes scheduler whether or not one is present. Nothing in this tree
  #     establishes that hosts/worker-gpu-01 or -02 has a card: both carry a
  #     placeholder hardware-configuration.nix.
  #   - The twin of this module in the LIVE tree,
  #     full-ai-cluster/nixos/modules/gpu.nix, no longer does this. There the
  #     flag is generated by gpu-node-label-checks.nix and the same file
  #     generates a boot-time PCI probe (gpu-node-label-preflight.nix) that
  #     refuses on the console when the claim is false, pinned by
  #     full-ai-cluster/nixos/tests/gpu-node-label-preflight-eval-test.nix under
  #     `nix flake check --no-build`.
  #   - The fix is NOT copied here because this tree has no falsifier that could
  #     hold it: the ROOT flake's `checks` is empty (flake.nix:232) and no
  #     workflow runs `nix flake check` at the repo root -- the same gap
  #     ./nvidia-open-guard.nix already records about itself, and the reason
  #     .github/workflows/build-ai-cluster-iso.yml:10 calls this substrate the
  #     "older" one. An unrun copy of a guard in a tree with no CI is the defect
  #     class the fix exists to remove, reintroduced one directory over.
  #   - What settles it: porting these hosts onto full-ai-cluster/, or giving
  #     the root flake a `checks` set that CI actually evaluates. Either makes
  #     copying the fix here worth doing; neither is done by this change.
  # ---------------------------------------------------------------------------
  services.k3s.extraFlags = lib.mkAfter [
    "--node-label=zeta.io/gpu=nvidia"
  ];
}
