# flake.nix — entry point for the declarative AI-cluster bootstrap
#
# This flake is the strange attractor for the Zeta AI cluster: every
# machine, every package, every desired state is reachable through the
# outputs declared here. The flake.lock pins the entire universe.
#
# Bootstrap flow:
#   1. Clone Zeta onto a workstation:    git clone https://github.com/Lucent-Financial-Group/Zeta
#   2. Build the USB installer ISO:      cd full-ai-cluster && nix build .#installer-iso
#   3. Flash to USB (macOS):             bun full-ai-cluster/tools/zflash.ts
#      (Linux/Windows fallback:          sudo dd if=result/iso/zeta-installer-*.iso of=/dev/sdX bs=4M status=progress)
#   4. Boot a target machine on the stick.
#   5. From the live system:             nixos-install --flake /mnt/etc/zeta#<host>
#   6. Reboot.  K3S + ArgoCD + Orleans land automatically from this flake.
#
# Companion files:
#   full-ai-cluster/usb-nixos-installer/             — canonical AI-cluster installer ISO substrate
#   infra/nixos/hosts/<host>/configuration.nix       — per-machine config
#   infra/nixos/modules/*.nix                         — shared modules
#   infra/k8s/applications/*/Application.yaml         — ArgoCD App-of-Apps

{
  description = "Zeta — declarative desired state for the AI cluster (NixOS + K3S + ArgoCD + Orleans)";

  inputs = {
    # Pin nixpkgs to the CURRENT SUPPORTED stable release.
    #
    # Was `nixos-24.11`, which went end-of-life 2025-06-30 — over a year
    # before this bump. Worth naming the irony: 24.11 and nix-darwin-24.11
    # were the only two inputs of the six here that resolved to a STABLE
    # value across `nix flake update`, and they were stable BECAUSE THE
    # RELEASE IS DEAD, not because anyone pinned them deliberately. A dead
    # branch stops moving; that is not the same property as a pinned one.
    #
    # Per WebSearch 2026-08-26:
    #   https://nixos.org/blog/announcements/2026/nixos-2605/ — NixOS 26.05
    #   "Yarara" released 2026-05-30; current stable, supported through
    #   2026-12-31.
    #   https://endoflife.date/nixos — 25.11 "Xantusia" EOL 2026-06-30;
    #   24.11 EOL 2025-06-30.
    # So 26.05 is the ONLY release under support as of this commit, which
    # is why this goes to 26.05 rather than to the intermediate 25.11 that
    # full-ai-cluster/flake.nix still carries (that one is itself now two
    # months past EOL and is a separate landing — see the PR body).
    #
    # Aaron's standing direction: "anything that's EOL we need to replace
    # and not depend on."
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    # Hardware-specific NixOS modules (e.g. common-cpu-amd, common-gpu-nvidia)
    # for the per-host configs.
    #
    # NOT TOUCHED BY THIS COMMIT, and the reason is worth writing down so
    # nobody folds it in later by reflex. `@master` is a DIFFERENT defect
    # from an EOL pin: it is not dead, it is UNPINNED BY DECLARATION. The
    # lock committed in #15573 pins it to a rev today, but the next
    # `nix flake update` jumps it arbitrarily again — and the same is true
    # of the `nixos-unstable` CHANNEL URL it drags in transitively as the
    # lock's `nixpkgs` node. Changing a declared ref is a decision about
    # what this flake tracks; replacing an EOL dependency is not. They get
    # separate commits so each can be reviewed on its own terms.
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";

    # flake-utils so the devShell + packages outputs are auto-generated
    # across systems without duplicate `forAllSystems` plumbing.
    flake-utils.url = "github:numtide/flake-utils";

    # nix-darwin — module system for maintainer macOS workstations.
    # MUST be pinned to a release branch matching the nixpkgs release
    # we use (nixos-26.05 above → nix-darwin-26.05). nix-darwin
    # asserts the branches match at eval time:
    #   "nix-darwin and Nixpkgs branches in use must match"
    # Bump this branch in lockstep with the nixpkgs.url release above —
    # this is not a style preference, it is an eval-time assertion, which
    # is why the two move in ONE commit and never separately.
    #
    # Powers `darwinConfigurations.zeta-mac` which activates the
    # linux-builder VM for local x86_64-linux ISO builds.
    nix-darwin = {
      url = "github:nix-darwin/nix-darwin/nix-darwin-26.05";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, nixos-hardware, flake-utils, nix-darwin, ... }@inputs:
    let
      # NixOS release this flake targets. Single source of truth so the
      # installer ISO, devShell, and per-host configs all agree.
      stateVersion = "24.11";

      # System architectures the flake supports.
      #   x86_64-linux  — primary cluster target (control-plane, workers)
      #   aarch64-linux — ARM cluster hosts (future); devShell only
      #   aarch64-darwin — Apple Silicon maintainer Macs; build the
      #     installer ISO via nix-darwin's linux-builder
      #     (Apple Virtualization.framework + Rosetta 2 for Linux
      #     x86_64 emulation inside the VM).
      #
      # x86_64-darwin (Intel Macs) intentionally excluded: Rosetta 2 is
      # Apple-Silicon-only, and we don't ship a darwinConfiguration for
      # Intel Macs. Maintainers on Intel Macs use the CI workflow
      # (.github/workflows/build-ai-cluster-iso.yml) to build the ISO.
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

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
      # Installer ISO retired from root flake 2026-05-26 (USB cleanup PR 2):
      # canonical AI-cluster installer now lives at
      # full-ai-cluster/usb-nixos-installer/ and is built via the dedicated
      # build-ai-cluster-iso.yml workflow. Per the human maintainer's
      # "get rid of the old" cleanup direction.
      nixosConfigurations = {
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
      # darwinConfigurations — maintainer macOS workstations
      # -----------------------------------------------------------------------
      #
      # Activates the nix-darwin linux-builder VM so maintainers can build
      # the x86_64-linux installer ISO locally on Apple Silicon without
      # Parallels / Lima / remote builders.
      #
      # Apply with:
      #   nix run nix-darwin/nix-darwin-26.05#darwin-rebuild -- switch --flake .#zeta-mac
      darwinConfigurations.zeta-mac = nix-darwin.lib.darwinSystem {
        system = "aarch64-darwin";
        specialArgs = { inherit inputs; };
        modules = [
          ./infra/nix-darwin/configuration.nix
        ];
      };

      # -----------------------------------------------------------------------
      # packages — built outputs, one set per supported system
      # -----------------------------------------------------------------------
    } // flake-utils.lib.eachSystem supportedSystems (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        # installer-iso package retired from root flake 2026-05-26
        # (USB cleanup PR 2). Canonical AI-cluster ISO now lives at
        # full-ai-cluster/usb-nixos-installer/ and is built via:
        #   cd full-ai-cluster && nix build .#installer-iso
        # CI workflow: .github/workflows/build-ai-cluster-iso.yml
        packages = { };

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

            # ── Byte-lock toolchain (Oracles 10-16 / DLA 9-substrate byte-lock) ────
            # Mirrors common.nix systemPackages. Available in `nix develop` so
            # contributors can rebuild all 9 substrates locally and run the
            # byte-lock drift check (src/wasm-dla/bytelock/) on any host.
            # Substrates: WAT, LLVM/C, Emscripten, Rust, ASC, Zig (WASM)
            #             + JS/V8, Lua 5.4, Go (bytecode/script)
            wabt        # wat2wasm, wasm2wat, wasm-validate (WAT bare-metal substrate)
            binaryen    # wasm-opt, wasm-as (AssemblyScript optimizer + WASM IR tools)
            emscripten  # emcc (C/C++ -> WASM, C compiler substrate)
            nodejs      # AssemblyScript (asc) runtime host + JS/V8 byte-lock runner
            zig         # wasm32-freestanding substrate (two-step: build-lib + wasm-ld)
            llvm        # llc, llvm-as, opt -- LLVM IR to WASM pipeline
            rustup      # Rust toolchain; run: rustup target add wasm32-unknown-unknown
            go          # Go WASM substrate (GOOS=js GOARCH=wasm); needs wasm_exec.js
            lua5        # Lua 5.4 bytecode substrate (luac5.4 -o)
          ];

          shellHook = ''
            echo "zeta-admin devShell ready."
            echo "  Build installer ISO:    cd full-ai-cluster && nix build .#installer-iso"
            echo "  Build host system:      nixos-rebuild build --flake .#<host>"
            echo "  Talk to cluster:        kubectl / k9s / argocd / helm"
            # 081KWN0JKJV — tracked commit-msg hook (Manus wrapper leak guard).
            if [ -f "$PWD/scripts/hooks/install-git-hooks.sh" ]; then
              bash "$PWD/scripts/hooks/install-git-hooks.sh" || true
            fi
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
