# infra/nixos/hosts/control-plane/hardware-configuration.nix
#
# PLACEHOLDER — replace during install on the actual target machine.
#
#   ssh into the live installer:
#     nixos-generate-config --root /mnt
#     cp /mnt/etc/nixos/hardware-configuration.nix \
#        /mnt/etc/zeta/infra/nixos/hosts/control-plane/hardware-configuration.nix
#
# The generator writes real kernel modules, fileSystems, swap, and
# boot loader entries. This stub exists so `nix flake check` and
# `nix build .#nixosConfigurations.control-plane` succeed in CI
# before the real machine is provisioned.

{ config, lib, modulesPath, ... }:

{
  imports = [
    (modulesPath + "/installer/scan/not-detected.nix")
  ];

  # Minimal valid stub. nixos-generate-config overrides all of this.
  boot.initrd.availableKernelModules = [ "xhci_pci" "ahci" "nvme" "usb_storage" "sd_mod" ];
  boot.initrd.kernelModules = [ ];
  boot.kernelModules = [ ];
  boot.extraModulePackages = [ ];

  # PLACEHOLDER UUIDs — generator replaces with real ones for the target disk.
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
