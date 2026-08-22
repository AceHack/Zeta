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
        # USB installer ISO — THE only definition. 081KZKS9A6B08QG0R0008EG72M
        # retired the standalone usb-nixos-installer/flake.nix, which built
        # this same configuration.nix but applied no overlays, so it shipped
        # nixpkgs' mise (2025.11.7 at the locked rev) instead of the pinned
        # 2026.6.12 — below .mise.toml's min_version, fatal at first boot.
        # Enforced by src/Core.TypeScript/hygiene/mise-pin-parity.test.ts.
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
        checks = {
          # 081M00KTH58087G0R00120WT6F — properties of the Secure Boot
          # desired-state model (nixos/modules/secure-boot-phase-model.nix).
          #
          # NOT a VM test and NOT a boot test: it proves things about Nix
          # values only — that `enforce` refuses unsigned images, that a
          # non-"off" phase fails closed on the missing key-custody decision,
          # and that no derived plan can carry a custody decision at all.
          # Nothing in this repo signs or enrols anything, so nothing here
          # can speak to whether a node boots.
          #
          # Unlike the VM checks below it costs no VM and runs on every
          # system, and the assertions fire during EVALUATION — so
          # `nix flake check --no-build` (the cheap CI step) already runs it.
          secure-boot-desired-state-model =
            let
              report = import ./nixos/tests/secure-boot-desired-state-eval-test.nix {
                inherit (nixpkgs) lib;
              };
            in
            pkgs.runCommand "secure-boot-desired-state-model" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';

          # Properties of the TPM-SEAL desired-state model — the module that
          # answers "what can the nix installer pre-stage for a hardware-backed
          # auto-unseal", and the gate that stops it from deciding seal-key
          # custody on the maintainer's behalf.
          #
          # NOT a VM test and NOT a hardware test. No TPM has ever been
          # contacted by anything in this repo, so nothing here can say whether
          # a node HAS a TPM 2.0 — it can only say that no plan claims one it
          # has not measured, and that `absent` stays distinguishable from
          # "the check did not run".
          #
          # Costs no VM, runs on every system, and its assertions fire during
          # EVALUATION — so `nix flake check --no-build` already runs it.
          tpm2-seal-prereqs-model =
            let
              report = import ./nixos/tests/tpm2-seal-prereqs-eval-test.nix {
                inherit (nixpkgs) lib;
              };
            in
            pkgs.runCommand "tpm2-seal-prereqs-model" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';

          # Properties of the FIRST-BOOT MANIFEST ROSTER -- the manifests
          # every other test in nixos/tests/ overrides away with mkForce, so
          # the declared boot sequence had no check of any kind.
          #
          # NOT a VM test and NOT a boot test. It reads the roster the two
          # contributing modules declare, reconstructs the filename-sorted
          # order k3s submits them in, and pins it. It CANNOT say whether an
          # apply succeeds -- k3s-first-boot-roster (x86_64-linux, below) is
          # the test that measures that.
          #
          # Costs no VM, runs on every system, and its assertions fire during
          # EVALUATION -- so `nix flake check --no-build` already runs it.
          k3s-first-boot-apply-order =
            let
              report = import ./nixos/tests/k3s-first-boot-apply-order-eval-test.nix {
                inherit pkgs;
                inherit (nixpkgs) lib;
              };
            in
            pkgs.runCommand "k3s-first-boot-apply-order" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';

          # Properties of the LONGHORN NODE PREFLIGHT -- the boot-time refusal
          # that says whether this node's storage substrate is actually there.
          #
          # NOT a VM test and NOT a boot test. It proves the mount set is
          # DERIVED from the host's own fileSystems (never a hand-written
          # roster), that the check which regressed in the field is present in
          # the form that catches it (`systemctl is-active`, not `systemctl
          # cat`), that the shim roster cannot drift from the module that
          # creates the symlinks, and that the unit is reachable on every
          # node's boot path. It CANNOT say whether the check PASSES on any
          # hardware -- only a boot can, and the console marker to look for is
          # ZETA_LONGHORN_PREFLIGHT_OK.
          #
          # Costs no VM, runs on every system, and its assertions fire during
          # EVALUATION -- so `nix flake check --no-build` already runs it.
          longhorn-node-preflight =
            let
              report = import ./nixos/tests/longhorn-node-preflight-eval-test.nix {
                inherit pkgs;
                inherit (nixpkgs) lib;
              };
            in
            pkgs.runCommand "longhorn-node-preflight" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';

          # Properties of the NODE-SIDE LONGHORN DISK SET -- which of the disks
          # zeta-install.sh formatted this node actually hands to Longhorn.
          #
          # The preflight check above proves the declared Longhorn mounts are
          # really mounted. It cannot say whether Longhorn is ever TOLD about
          # them, and it was not: `zeta.longhorn.dataDisks` defaulted to the
          # fixed literal [ "/var/lib/longhorn" ] -- a directory on the root
          # filesystem -- and only hosts/worker-template ever set it. On
          # control-plane, the host the USB installs, every dedicated Longhorn
          # partition contributed ZERO schedulable capacity while the capture
          # check and the boot preflight both went green, because both of them
          # measure `fileSystems` and `fileSystems` was correct.
          #
          # The default is now DERIVED from the preflight's own `requiredMounts`,
          # so the set the node must have mounted and the set Longhorn is told
          # about are one expression. These properties pin that identity, pin the
          # one-path delta the old literal produced so a revert is a red check,
          # and check the mountpoint prefix zeta-install.sh writes against the
          # prefix the derivation filters on -- the bash/nix seam neither side
          # can see across.
          #
          # Complementary to PR #12175, which fixes the other half (making the
          # list REACH Longhorn at all). Neither half is visible in the other's
          # tests. Costs no VM; fires during EVALUATION, so
          # `nix flake check --no-build` already runs it.
          longhorn-disk-registration =
            let
              report = import ./nixos/tests/longhorn-disk-registration-eval-test.nix {
                inherit pkgs;
                inherit (nixpkgs) lib;
              };
            in
            pkgs.runCommand "longhorn-disk-registration" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';

          # Properties of the CILIUM WIREGUARD NODE PREFLIGHT -- the boot-time
          # refusal that says whether this kernel can make the WireGuard device
          # Cilium's own values demand.
          #
          # It reads the SHIPPED manifests, so its first assertion is the
          # finding itself: k8s/bootstrap/cilium-install.yaml (first boot) and
          # k8s/applications/cilium/Application.yaml (sync-wave -80) both set
          # encryption.type=wireguard, while before this change nothing under
          # nixos/ named WireGuard at all. It also proves the requirement is
          # DERIVED from those files (an IPsec tree does not pull it in), that
          # the module DECLARED is the module CHECKED, and that the /sys/module
          # check runs before the netlink probe that would auto-load it --
          # ordering those two the other way makes the first one unable to fail.
          #
          # It CANNOT say the check passes on any kernel. The x86_64 VM lane
          # k3s-control-plane-platform-fixes does that; the console marker to
          # look for on metal is ZETA_CILIUM_WG_PREFLIGHT_OK.
          cilium-wireguard-preflight =
            let
              report = import ./nixos/tests/cilium-wireguard-preflight-eval-test.nix {
                inherit pkgs;
                inherit (nixpkgs) lib;
              };
            in
            pkgs.runCommand "cilium-wireguard-preflight" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';
        } // nixpkgs.lib.optionalAttrs (system == "x86_64-linux") {
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

          # TWO-NODE: an agent configured by nixos/modules/k3s-agent.nix joins
          # a server configured by nixos/modules/k3s-server.nix on one shared
          # virtual segment, and k3s-join-observer.nix announces it on serial
          # in the exact strings 081KSNY2Z0008QG0R0008PN7RQ scenario 5
          # asserts. Hermetic (membership, not readiness — no CNI image in
          # the sandbox). See nixos/tests/k3s-agent-join.nix.
          k3s-agent-join =
            import ./nixos/tests/k3s-agent-join.nix { inherit pkgs; };

          # ONLINE end-to-end: boots the control-plane WITH internet, installs
          # Cilium for real, asserts the node reaches Ready + CoreDNS Running.
          # REQUIRES internet -> build with `--option sandbox false`.
          # See nixos/tests/k3s-cluster-online.nix.
          k3s-cluster-online =
            import ./nixos/tests/k3s-cluster-online.nix { inherit pkgs; };

          # THE CLOSEST THING TO PROD without touching prod: installs the REAL
          # Longhorn chart at the REAL version with the REAL prod values, then
          # proves a `longhorn` PVC BINDS and a pod writes through the mount.
          # The platform-fixes check proves iscsiadm resolves; this one proves
          # the rest of the chain that was dead for 62 days on node-5b2dfa
          # (manager Ready -> Node CR -> StorageClass -> PVC Bound -> data).
          # REQUIRES internet -> build with `--option sandbox false`.
          # See nixos/tests/longhorn-volume-binds.nix.
          longhorn-volume-binds =
            import ./nixos/tests/longhorn-volume-binds.nix { inherit pkgs; };

          # THE ONLY CHECK THAT APPLIES THE REAL FIRST-BOOT ROSTER. Every
          # other VM test above overrides `services.k3s.manifests` away, so
          # the declared boot sequence had never run anywhere. This one boots
          # it whole and answers the open question: does root-application --
          # an argoproj.io Application submitted before the ArgoCD chart has
          # created that CRD -- apply, or stick? Three named verdicts, never
          # a bare timeout. See nixos/tests/k3s-first-boot-roster.nix.
          #
          # REQUIRES internet -> build with `--option sandbox false`.
          # THE MOST EXPENSIVE CHECK HERE: 45-70 min, ~10 GB of pulls, 10 GB
          # RAM. Manual / nightly lane -- do NOT wire it per-PR. The per-PR
          # half of the same question is `k3s-first-boot-apply-order`, which
          # is eval-only and costs nothing.
          k3s-first-boot-roster =
            import ./nixos/tests/k3s-first-boot-roster.nix { inherit pkgs; };

          # EVAL-ONLY (no VM, no boot): asserts that the preflight-attestation
          # gate in nixos/modules/nvidia-open-guard.nix still REFUSES an
          # unattested `hardware.nvidia.open = true`. Runs under the existing
          # `nix flake check --no-build` step, so it costs a PR nothing.
          # 081M00QP33F087G0R001JKB5QM shipped that gate and nothing re-checked
          # it. See nixos/tests/nvidia-open-guard-gate.nix.
          nvidia-open-guard-gate =
            import ./nixos/tests/nvidia-open-guard-gate.nix {
              inherit pkgs;
              nixosConfig = self.nixosConfigurations.worker-gpu;
            };

          # EVAL-ONLY (no VM, no boot): properties of the GPU NODE-LABEL
          # PREFLIGHT -- the boot-time refusal that keeps `zeta.io/gpu=nvidia`
          # a checked claim rather than an unconditional assertion.
          #
          # It reads the REAL nixosConfigurations.worker-gpu, so it proves the
          # label is still EMITTED (deleting it would be its own regression),
          # that the emitted flag is the one the checks file GENERATES rather
          # than a second copy of the string, that the probe looks for the PCI
          # vendor ID of the vendor the label names, that the unit is reachable
          # and lands before k3s.service, and that the label's one live consumer
          # -- the NVIDIA device-plugin DaemonSet's nodeSelector -- still selects
          # the same string.
          #
          # It CANNOT say whether the check PASSES on any hardware: no host in
          # this repo records having a GPU at all. Only a boot can, and the
          # console marker to look for is ZETA_GPU_NODE_LABEL_PREFLIGHT_OK with
          # devices >= 1. See nixos/tests/gpu-node-label-preflight-eval-test.nix.
          gpu-node-label-preflight =
            let
              report = import ./nixos/tests/gpu-node-label-preflight-eval-test.nix {
                inherit pkgs;
                nixosConfig = self.nixosConfigurations.worker-gpu;
              };
            in
            pkgs.runCommand "gpu-node-label-preflight" { inherit (report) status; } ''
              echo "$status" | tee "$out"
            '';
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
            echo "  Build host system:    nixos-rebuild build --impure --flake .#<host>"
            echo "  Talk to cluster:      kubectl / k9s / argocd / cilium / hubble"
          '';
        };

        formatter = pkgs.nixpkgs-fmt;
      });
}
