# full-ai-cluster/flake.nix
#
# End-to-end declarative AI cluster flake.
#
# The USB installer (./usb-nixos-installer/) is the snippet at the
# start of this directory. After installation completes, K3S auto-
# applies the bootstrap manifests at ./k8s/bootstrap/ which install
# ArgoCD. ArgoCD then reconciles every other workload from
# ./k8s/applications/.
#
# Bootstrap flow:
#   1. Build USB:       nix build .#installer-iso
#   2. Write to USB:    sudo dd if=result/iso/*.iso of=/dev/sdX bs=4M
#   3. Boot target on USB
#   4. Clone Zeta + nixos-install --flake .#<host>
#   5. Reboot. K3S + Cilium + ArgoCD + everything come up declaratively.

{
  description = "Zeta full AI cluster — declarative from USB to running workloads";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";
    flake-utils.url = "github:numtide/flake-utils";

    # nix-darwin pinned to matching release branch so Apple Silicon
    # maintainers can build the x86_64-linux ISO via the linux-builder
    # VM (Virtualization.framework + Rosetta 2).
    nix-darwin = {
      url = "github:nix-darwin/nix-darwin/nix-darwin-24.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # disko — declarative disk partitioning + formatting + mounting.
    # Together with the disko-shapes/ modules under ./nixos/modules,
    # adding a new node is: copy a host template, change hostname/IP,
    # commit, run `nixos-install --flake .#<host> --disko`.
    # No interactive partitioning, no per-host shell scripts.
    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, nixos-hardware, flake-utils, nix-darwin, disko, ... }@inputs:
    let
      stateVersion = "24.11";

      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      isoBuildSystems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      mkSystem = { system ? "x86_64-linux", modules }: nixpkgs.lib.nixosSystem {
        inherit system;
        specialArgs = { inherit inputs stateVersion; };
        modules = modules;
      };
    in
    {
      # NixOS configurations: installer image + per-host targets.
      nixosConfigurations = {
        # USB installer ISO — identical to the standalone
        # usb-nixos-installer/ flake at the parent level.
        installer = mkSystem {
          modules = [
            ./usb-nixos-installer/nixos/installer/configuration.nix
          ];
        };

        # Control-plane: K3S server + Cilium CNI + ArgoCD bootstrap.
        control-plane = mkSystem {
          modules = [
            ./nixos/hosts/control-plane/configuration.nix
          ];
        };

        # GPU worker template. Duplicate this entry per physical worker
        # (worker-gpu-01, worker-gpu-02, ...) once hardware-configuration
        # files for each are committed.
        worker-gpu = mkSystem {
          modules = [
            ./nixos/hosts/worker-gpu/configuration.nix
          ];
        };

        # Cookie-cutter worker template — uses disko for declarative
        # disk partitioning + Longhorn multi-disk wiring. Copy
        # ./nixos/hosts/worker-template/ to ./nixos/hosts/worker-gpu-NN/,
        # change the six placeholder values documented in the file,
        # then add a `worker-gpu-NN = mkSystem { ... };` entry here
        # mirroring this one. See full-ai-cluster/PROVISIONING.md.
        worker-template = mkSystem {
          modules = [
            ./nixos/hosts/worker-template/default.nix
          ];
        };
      };

      # Shared NixOS modules — per-host configs import these via
      # relative path; this output exposes them so external flakes
      # can reuse the same modules.
      nixosModules = {
        common = ./nixos/modules/common.nix;
        k3s-server = ./nixos/modules/k3s-server.nix;
        k3s-agent = ./nixos/modules/k3s-agent.nix;
        gpu = ./nixos/modules/gpu.nix;
        gpu-passthrough = ./nixos/modules/gpu-passthrough.nix;
        gpu-device-plugin = ./nixos/modules/gpu-device-plugin.nix;
        docker = ./nixos/modules/docker.nix;
        local-storage = ./nixos/modules/local-storage.nix;
        longhorn-disks = ./nixos/modules/longhorn-disks.nix;
        disko-shape-2nvme = ./nixos/modules/disko-shapes/2nvme.nix;
      };

      # nix-darwin config for maintainer Macs (Apple Silicon). Enables
      # the linux-builder VM so `nix build .#installer-iso` works
      # locally without Parallels / Lima / remote builders.
      darwinConfigurations.zeta-mac = nix-darwin.lib.darwinSystem {
        system = "aarch64-darwin";
        specialArgs = { inherit inputs; };
        modules = [
          ({ pkgs, lib, ... }: {
            nix.settings = {
              experimental-features = [ "nix-command" "flakes" ];
              trusted-users = [ "@admin" ];
              extra-platforms = [ "x86_64-linux" ];
            };
            nix.linux-builder = {
              enable = true;
              ephemeral = false;
              maxJobs = 4;
              supportedFeatures = [ "kvm" "benchmark" "big-parallel" ];
              config = {
                virtualisation = {
                  darwin-builder = {
                    diskSize = 40 * 1024;
                    memorySize = 8 * 1024;
                  };
                  cores = 6;
                };
              };
            };
            environment.systemPackages = with pkgs; [
              git gh jq yq-go ripgrep fd htop
              kubectl kubernetes-helm k9s argocd
              age sops ssh-to-age
              nix-output-monitor nvd nh
            ];
            system.stateVersion = 5;
            nixpkgs.hostPlatform = "aarch64-darwin";
          })
        ];
      };
    } // flake-utils.lib.eachSystem supportedSystems (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages = nixpkgs.lib.optionalAttrs (builtins.elem system isoBuildSystems) {
          installer-iso =
            self.nixosConfigurations.installer.config.system.build.isoImage;
          default = self.packages.${system}.installer-iso;
        };

        devShells.default = pkgs.mkShell {
          name = "zeta-ai-cluster-admin";
          packages = with pkgs; [
            nix-output-monitor nvd nh
            kubectl kubernetes-helm k9s argocd
            cilium-cli hubble
            age sops ssh-to-age
            git gh jq yq-go ripgrep fd
          ];
          shellHook = ''
            echo "zeta-ai-cluster admin shell."
            echo "  Build USB ISO:        nix build .#installer-iso"
            echo "  Build host system:    nixos-rebuild build --flake .#<host>"
            echo "  Talk to cluster:      kubectl / k9s / argocd / cilium / hubble"
          '';
        };

        formatter = pkgs.nixpkgs-fmt;
      });
}
