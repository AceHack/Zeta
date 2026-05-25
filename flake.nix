# flake.nix — entry point for the declarative AI-cluster bootstrap
#
# This flake is the strange attractor for the Zeta AI cluster: every
# machine, every package, every desired state is reachable through the
# outputs declared here. The flake.lock pins the entire universe.
#
# Bootstrap flow:
#   1. Clone Zeta onto a workstation:    git clone https://github.com/Lucent-Financial-Group/Zeta
#   2. Build the USB installer ISO:      nix build .#installer-iso
#   3. dd the ISO to a USB stick:        sudo dd if=result/iso/zeta-installer-*.iso of=/dev/sdX bs=4M status=progress
#   4. Boot a target machine on the stick.
#   5. From the live system:             nixos-install --flake /mnt/etc/zeta#<host>
#   6. Reboot.  K3S + ArgoCD + Orleans land automatically from this flake.
#
# Companion files:
#   infra/nixos/hosts/installer/configuration.nix  — packages on the USB
#   infra/nixos/hosts/<host>/configuration.nix     — per-machine config
#   infra/nixos/modules/*.nix                       — shared modules
#   infra/k8s/applications/*/Application.yaml       — ArgoCD App-of-Apps

{
  description = "Zeta — declarative desired state for the AI cluster (NixOS + K3S + ArgoCD + Orleans)";

  inputs = {
    # Pin nixpkgs to the stable channel that the installer's
    # system.stateVersion targets (24.11). Bump in lockstep with
    # infra/nixos/hosts/installer/configuration.nix `system.stateVersion`.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

    # Hardware-specific NixOS modules (e.g. common-cpu-amd, common-gpu-nvidia)
    # for the per-host configs.
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";

    # flake-utils so the devShell + packages outputs are auto-generated
    # across systems without duplicate `forAllSystems` plumbing.
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, nixos-hardware, flake-utils, ... }@inputs:
    let
      # NixOS release this flake targets. Single source of truth so the
      # installer ISO, devShell, and per-host configs all agree.
      stateVersion = "24.11";

      # System architectures the cluster will run on.
      supportedSystems = [ "x86_64-linux" "aarch64-linux" ];

      # Helper that wires up a NixOS system with shared specialArgs so
      # every host module can reference `inputs`, `stateVersion`, and
      # the `nixos-hardware` collection.
      mkSystem = { system ? "x86_64-linux", modules }: nixpkgs.lib.nixosSystem {
        inherit system;
        specialArgs = { inherit inputs stateVersion; };
        modules = modules;
      };
    in
    {
      # -----------------------------------------------------------------------
      # nixosConfigurations — every machine declared here
      # -----------------------------------------------------------------------
      #
      # Build any host's system closure:    nixos-rebuild build --flake .#<host>
      # Install on a fresh machine:         nixos-install --flake /mnt/etc/zeta#<host>
      # Switch a running machine:           sudo nixos-rebuild switch --flake .#<host>
      #
      # The `installer` config builds a bootable ISO image rather than a
      # target-machine system. Use the `.#installer-iso` packages alias
      # declared in flake-utils.eachSystem below.
      nixosConfigurations = {
        installer = mkSystem {
          modules = [
            ./infra/nixos/hosts/installer/configuration.nix
          ];
        };

        control-plane = mkSystem {
          modules = [
            ./infra/nixos/hosts/control-plane/configuration.nix
          ];
        };

        worker-gpu-01 = mkSystem {
          modules = [
            ./infra/nixos/hosts/worker-gpu-01/configuration.nix
          ];
        };

        worker-gpu-02 = mkSystem {
          modules = [
            ./infra/nixos/hosts/worker-gpu-02/configuration.nix
          ];
        };
      };

      # Shared modules exposed as flake outputs so per-host configs can
      # import them via `imports = [ inputs.self.nixosModules.k3s-server ]`
      # or via direct relative path inside this repo.
      nixosModules = {
        common = ./infra/nixos/modules/common.nix;
        k3s-server = ./infra/nixos/modules/k3s-server.nix;
        k3s-agent = ./infra/nixos/modules/k3s-agent.nix;
        gpu = ./infra/nixos/modules/gpu.nix;
      };

      # -----------------------------------------------------------------------
      # packages — built outputs, one set per supported system
      # -----------------------------------------------------------------------
    } // flake-utils.lib.eachSystem supportedSystems (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        # The installer ISO is built from an x86_64-linux NixOS config
        # (see nixosConfigurations.installer above), so the `installer-iso`
        # package is only published on x86_64-linux. Other systems get an
        # empty packages set rather than a cross-build attempt that would
        # fail at evaluation time.
        packages = nixpkgs.lib.optionalAttrs (system == "x86_64-linux") {
          # Convenience alias for the installer ISO.
          # Build with:  nix build .#installer-iso
          # Result at:   ./result/iso/zeta-installer-*.iso
          installer-iso =
            self.nixosConfigurations.installer.config.system.build.isoImage;

          default = self.packages.${system}.installer-iso;
        };

        # ---------------------------------------------------------------------
        # devShells — `nix develop` to get a shell with cluster admin tools
        # ---------------------------------------------------------------------
        # Mirrors the on-stick toolkit so contributors can administer the
        # cluster from their workstation without installing global packages.
        devShells.default = pkgs.mkShell {
          name = "zeta-admin";
          packages = with pkgs; [
            # Nix tooling
            nix-output-monitor   # nicer `nix build` output
            nvd                  # diff two system closures
            nh                   # ergonomic nixos-rebuild wrapper

            # Cluster clients
            kubectl
            kubernetes-helm
            k9s
            argocd

            # Secrets
            age
            sops
            ssh-to-age

            # Git + shell QoL
            git
            gh                   # GitHub CLI
            jq
            yq-go
            ripgrep
            fd
          ];

          shellHook = ''
            echo "zeta-admin devShell ready."
            echo "  Build installer ISO:    nix build .#installer-iso"
            echo "  Build host system:      nixos-rebuild build --flake .#<host>"
            echo "  Talk to cluster:        kubectl / k9s / argocd / helm"
          '';
        };

        # ---------------------------------------------------------------------
        # checks — `nix flake check` runs these
        # ---------------------------------------------------------------------
        # Empty for now; will hold per-host system closures + module unit
        # tests once those modules land.
        checks = { };

        # ---------------------------------------------------------------------
        # formatter — `nix fmt` formats every .nix in the tree
        # ---------------------------------------------------------------------
        formatter = pkgs.nixpkgs-fmt;
      });
}
