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
    # iter-6.0 (B-0800; the maintainer 2026-05-26 "24.11 is a 2 year old
    # version you found a 25.11 when you searched latest we need to make
    # sure we are on latest too"): bumped from nixos-24.11 (EOL'd
    # 2025-06-30) to nixos-25.11 "Xantusia" (current stable; EOL
    # 2026-06-30). Per WebSearch
    # https://nixos.org/blog/announcements/2025/nixos-2511/
    # validated per `.claude/rules/dep-pin-search-first-authority.md`.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";
    flake-utils.url = "github:numtide/flake-utils";

    # nix-darwin pinned to matching release branch so Apple Silicon
    # maintainers can build the x86_64-linux ISO via the linux-builder
    # VM (Virtualization.framework + Rosetta 2). Same bump as nixpkgs.
    nix-darwin = {
      url = "github:nix-darwin/nix-darwin/nix-darwin-25.11";
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
      # iter-6.0 stateVersion bump (B-0800; PC1 + future cluster nodes
      # are fresh-install scope per the maintainer 2026-05-26; no
      # persistent K8s workloads yet → safe to bump for new hosts.
      # Already-installed hosts should NOT bump stateVersion in their
      # per-host nixos/hosts/<name>/configuration.nix without explicit
      # migration handling per the NixOS upgrade guidance).
      stateVersion = "25.11";

      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      isoBuildSystems = [
        "x86_64-linux"
        "aarch64-darwin"
        # B-1024 slice 1 (2026-06-11): aarch64-linux builds the aarch64
        # installer ISO natively (GitHub ubuntu-24.04-arm runners; Pi
        # bring-up path). Selects nixosConfigurations.installer-aarch64.
        "aarch64-linux"
      ];

      mkSystem = { system ? "x86_64-linux", modules }: nixpkgs.lib.nixosSystem {
        inherit system;
        specialArgs = { inherit inputs stateVersion; };
        modules = [
          ({ nixpkgs.overlays = [ (import ./nixos/overlays/mise-pin.nix) ]; })
        ] ++ modules;
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

        # The SAME installer configuration built for aarch64 (B-1024
        # slice 1: QEMU aarch64 boot in CI; the Raspberry Pi rung). One
        # source of truth — only `system` differs.
        installer-aarch64 = mkSystem {
          system = "aarch64-linux";
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
        # change the placeholder values documented in the file,
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
        zeta-self-register = ./nixos/modules/zeta-self-register.nix;
        disko-shape-longhorn-node = ./nixos/modules/disko-shapes/longhorn-node.nix;
        disko-shape-2nvme = ./nixos/modules/disko-shapes/2nvme.nix; # imports longhorn-node
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
          # aarch64-linux hosts build the aarch64 installer natively; all
          # other ISO-building systems target the x86_64 installer (the
          # aarch64-darwin case cross-builds it via linux-builder).
          installer-iso =
            (if system == "aarch64-linux"
             then self.nixosConfigurations.installer-aarch64
             else self.nixosConfigurations.installer).config.system.build.isoImage;
          default = self.packages.${system}.installer-iso;
        };

        # QEMU-backed NixOS VM tests. Gated to x86_64-linux because the
        # nixosTest driver boots an x86_64 VM (and our cluster nodes are
        # x86_64). Run one with:
        #   nix build .#checks.x86_64-linux.k3s-control-plane-cluster-init -L
        checks = nixpkgs.lib.optionalAttrs (system == "x86_64-linux") {
          # Regression test for the k3s --cluster-init token deadlock:
          # boots the control-plane k3s module in QEMU and asserts the API
          # comes all the way up (see nixos/tests/k3s-cluster-init.nix).
          k3s-control-plane-cluster-init =
            import ./nixos/tests/k3s-cluster-init.nix { inherit pkgs; };

          # Boots the control-plane node modules and asserts every node-level
          # platform fix is live: rpfilter OFF (the pod->host black-hole),
          # open-iscsi present (Longhorn can attach), k3s --disable=local-storage
          # (single default StorageClass). Hermetic. See
          # nixos/tests/k3s-control-plane-platform-fixes.nix.
          k3s-control-plane-platform-fixes =
            import ./nixos/tests/k3s-control-plane-platform-fixes.nix { inherit pkgs; };

          # ONLINE end-to-end: boots the control-plane WITH internet, installs
          # Cilium for real, asserts the node reaches Ready + CoreDNS Running.
          # REQUIRES internet -> build with `--option sandbox false`.
          # See nixos/tests/k3s-cluster-online.nix.
          k3s-cluster-online =
            import ./nixos/tests/k3s-cluster-online.nix { inherit pkgs; };
        };

        devShells.default = pkgs.mkShell {
          name = "zeta-ai-cluster-admin";
          # Nix-managed admin tooling (k8s + age/sops + nix observability).
          # Host-level dev-laptop tooling (bun, p7zip, etc.) is managed
          # SEPARATELY via tools/setup/install.sh manifests at
          # tools/setup/manifests/{brew,apt} — that's the canonical
          # consumer-of-record per GOVERNANCE.md §24 (dev laptops, CI
          # runners, devcontainer images). The nix devShell does NOT
          # auto-run install.sh on entry: Copilot P0 on post-merge of
          # #5120 flagged that auto-run has large host-side side effects
          # (apt/brew installs, network fetches, possible sudo prompts)
          # and breaks devShell expectations + reliably fails on NixOS
          # hosts which don't have apt at all. Operators run install.sh
          # manually when needed (rare; usually after pulling main).
          packages = with pkgs; [
            nix-output-monitor nvd nh
            kubectl kubernetes-helm k9s argocd
            cilium-cli hubble
            qemu mtools
            age sops ssh-to-age
            git gh jq yq-go ripgrep fd
          ];
          shellHook = ''
            echo "zeta-ai-cluster admin shell."
            # install.sh hint: only show on hosts where it actually works
            # (macOS = brew path, Debian/Ubuntu = apt path). On NixOS it
            # would error on apt-get, so we say nothing rather than point
            # the operator at a broken path (Copilot post-merge on #5121).
            if [ "$(uname -s)" = "Darwin" ]; then
              echo "  Host setup (rare):    bash tools/setup/install.sh"
            elif [ -r /etc/os-release ] && grep -qE '^ID(_LIKE)?=.*(debian|ubuntu)' /etc/os-release; then
              echo "  Host setup (rare):    bash tools/setup/install.sh"
            fi
            # NixOS users: tooling comes via this devShell's nix-managed
            # packages above; no install.sh equivalent needed.
            echo "  Build USB ISO:        nix build .#installer-iso"
            echo "  Build host system:    nixos-rebuild build --flake .#<host>"
            echo "  Talk to cluster:      kubectl / k9s / argocd / cilium / hubble"
          '';
        };

        formatter = pkgs.nixpkgs-fmt;
      });
}
