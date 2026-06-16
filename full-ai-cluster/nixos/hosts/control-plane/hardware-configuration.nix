# full-ai-cluster/nixos/hosts/control-plane/hardware-configuration.nix
#
# PLACEHOLDER — replace during real install via:
#   nixos-generate-config --root /mnt
#   cp /mnt/etc/nixos/hardware-configuration.nix \
#      /mnt/etc/zeta/full-ai-cluster/nixos/hosts/control-plane/hardware-configuration.nix
#
# This stub exists so `nix flake check` succeeds in CI before the
# host is provisioned. Real generator output replaces all values.

{ config, lib, modulesPath, ... }:

{
  imports = [
    (modulesPath + "/installer/scan/not-detected.nix")
  ];

  boot.initrd.availableKernelModules = [ "xhci_pci" "ahci" "nvme" "usb_storage" "sd_mod" "virtio_pci" "virtio_blk" "virtio_ring" ];
  boot.initrd.kernelModules = [ "virtio_pci" "virtio_blk" ];
  boot.kernelModules = [ "kvm-intel" "kvm-amd" ];
  boot.extraModulePackages = [ ];

  fileSystems."/" = lib.mkDefault {
    device = "/dev/disk/by-label/nixos";
    fsType = "ext4";
  };

  fileSystems."/boot" = lib.mkDefault {
    device = "/dev/disk/by-label/boot";
    fsType = "vfat";
  };

  swapDevices = lib.mkDefault [ ];

  networking.useDHCP = lib.mkDefault true;
  nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";
}
