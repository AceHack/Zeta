# full-ai-cluster/nixos/modules/gpu-passthrough.nix
#
# VFIO GPU passthrough setup. Lets a host bind one or more GPUs to
# vfio-pci at boot so they can be assigned to virtual machines
# (libvirt/QEMU/Cloud-Hypervisor) running on the same host alongside
# K3S workloads.
#
# Per-host override required: set the PCI vendor:device IDs for the
# GPUs you want VFIO-bound. Find them with `lspci -nn | grep VGA`.
# Example:  10de:2204  (NVIDIA RTX 3090)

{ config, pkgs, lib, ... }:

let
  cfg = config.zeta.gpu-passthrough;
in
{
  options.zeta.gpu-passthrough = {
    enable = lib.mkEnableOption "VFIO GPU passthrough";

    pciIds = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = ''
        PCI vendor:device IDs to bind to vfio-pci at boot. Find via
        `lspci -nn | grep VGA`. Example: [ "10de:2204" "10de:1aef" ]
        for a 3090 + its audio function.
      '';
      example = [ "10de:2204" "10de:1aef" ];
    };
  };

  config = lib.mkIf cfg.enable {
    # IOMMU on. AMD: amd_iommu=on. Intel: intel_iommu=on.
    boot.kernelParams = [
      "intel_iommu=on"        # safe on AMD too — ignored if no Intel iommu
      "amd_iommu=on"
      "iommu=pt"
    ] ++ lib.optional (cfg.pciIds != [ ]) "vfio-pci.ids=${lib.concatStringsSep "," cfg.pciIds}";

    boot.kernelModules = [
      "vfio_pci"
      "vfio"
      "vfio_iommu_type1"
    ];

    # Bind early so the NVIDIA driver doesn't grab the device first.
    boot.initrd.kernelModules = [
      "vfio_pci"
      "vfio"
      "vfio_iommu_type1"
    ];

    # Libvirt + QEMU stack for hosting passthrough VMs.
    virtualisation.libvirtd = {
      enable = true;
      qemu = {
        package = pkgs.qemu_kvm;
        runAsRoot = true;
        ovmf = {
          enable = true;
          packages = [ pkgs.OVMFFull.fd ];
        };
      };
    };
    users.users.zeta.extraGroups = [ "libvirtd" "kvm" ];

    environment.systemPackages = with pkgs; [
      virt-manager
      virt-viewer
      OVMFFull
      qemu_kvm
    ];
  };
}
