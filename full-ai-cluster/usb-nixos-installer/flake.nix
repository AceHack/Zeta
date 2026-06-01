# usb-nixos-installer/flake.nix
#
# USB-only flake. Produces a bootable NixOS installer ISO.
# Builds on Linux x86_64 natively; on Apple Silicon Macs use the
# nix-darwin linux-builder pattern (see the cluster flake at
# https://github.com/Lucent-Financial-Group/Zeta/tree/main/full-ai-cluster).

{
  description = "Zeta USB installer — NixOS bootable image for AI-cluster bootstrap";

  inputs = {
    # iter-6.0 (B-0800): nixos-25.11 "Xantusia" current stable (bumped
    # 2026-05-26 from EOL'd 24.11; matches sibling full-ai-cluster/
    # flake.nix).
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }@inputs:
    let
      stateVersion = "25.11";
    in
    {
      nixosConfigurations.installer = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = { inherit inputs stateVersion; };
        modules = [
          ./nixos/installer/configuration.nix
        ];
      };
    } // flake-utils.lib.eachSystem [ "x86_64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages = {
          installer-iso =
            self.nixosConfigurations.installer.config.system.build.isoImage;
          default = self.packages.${system}.installer-iso;
        };

        devShells.default = pkgs.mkShell {
          name = "zeta-usb-installer";
          packages = with pkgs; [
            git
            mtools
            nix-output-monitor
            nh
          ];
        };

        formatter = pkgs.nixpkgs-fmt;
      });
}
