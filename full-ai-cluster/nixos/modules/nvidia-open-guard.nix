# full-ai-cluster/nixos/modules/nvidia-open-guard.nix
#
# Guard rails for `hardware.nvidia.open`. Imported by gpu.nix; it adds no
# behaviour unless someone sets `open = true`.
#
# The open kernel modules depend on the GPU System Processor, first shipped in
# Turing — so on Maxwell/Pascal/Volta they cannot bind at all, and a node that
# is flipped without checking comes back with no working driver. The generation
# of the card in a given box is not knowable from this repo (every GPU host
# here carries a PLACEHOLDER hardware-configuration.nix), so the flag is gated
# on an explicit, evidenced, per-host attestation instead of on a comment.
#
# Two independent gates, deliberately at different times:
#
#   1. EVAL TIME  — `open = true` without a recorded preflight result fails the
#      build. This catches the flip in review, before any node is touched.
#   2. BOOT TIME  — a oneshot unit checks that every NVIDIA display device on
#      the machine actually has a driver bound. This catches a wrong-generation
#      node even if the attestation was wrong or the card was swapped later.
#
# The boot-time check observes the CONSEQUENCE (no driver bound), not the
# generation itself; a pre-Turing card under the open module is the case it is
# built to surface, but a failed unit means "the driver did not bind", which
# has other causes too. Read it as a symptom, not a diagnosis.
#
# GATE 2 WAS UNREACHABLE UNTIL 2026-08-21, AND THAT IS WHY IT NOW RUNS ALWAYS
# --------------------------------------------------------------------------
# The boot unit below was `lib.mkIf useOpen` while gpu.nix ships
# `open = lib.mkDefault false` and no host in this tree overrides it. So gate 2
# was instantiated on zero hosts and had executed exactly zero times, while this
# header advertised "two independent gates" — a check that did not run reading
# as a check that passed. longhorn-node-preflight.nix:9-13 cites this file as
# the in-tree example of that failure class, and
# tests/longhorn-node-preflight-eval-test.nix:217-221 cites it again.
#
# It is now instantiated on every host that imports gpu.nix, because the
# question it asks — did the nvidia driver bind to the cards in this box — is
# worth an answer under the CLOSED module too, where nothing else asks it. The
# remedy text branches on `open`, since only the open half has the pre-Turing
# explanation.
#
# One case moved OUT of this unit rather than being answered twice: "there is no
# NVIDIA display device at all" now belongs to gpu-node-label-preflight.nix,
# which refuses on it because the node's `zeta.io/gpu` label claims otherwise.
# Here it is declared vacuity — reported, and passed, because a driver-bound
# check on zero devices has nothing to say.
#
# The preflight itself is ../../../tools/nvidia-open-preflight.ts (`bun` it) — run
# it on the candidate node, while the closed module is still loaded.
#
# The EVAL-TIME gate has a falsifier: ../tests/nvidia-open-guard-gate.nix, wired as
# `checks.x86_64-linux.nvidia-open-guard-gate` and evaluated by the
# `nix flake check --no-build` step in .github/workflows/build-ai-cluster-iso.yml.
# Making either assertion below vacuous turns that check red. That test also
# pins the REACHABILITY of the boot unit (present in both the shipped and the
# attested state), which is what stops gate 2 regressing to `mkIf`. What it
# still cannot do is run the unit: its VERDICT needs real NVIDIA silicon, which
# CI does not have.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.gpu.openModulePreflight;
  useOpen = config.hardware.nvidia.open == true;
in
{
  options.zeta.gpu.openModulePreflight = {
    passed = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Set true ONLY after tools/nvidia-open-preflight.ts has exited 0 on this
        physical node. Required before `hardware.nvidia.open = true` will build.
      '';
    };

    evidence = lib.mkOption {
      type = lib.types.str;
      default = "";
      example = "2026-08-16, worker-gpu-01: 2x RTX 3090 cc 8.6 — preflight exit 0";
      description = ''
        Who ran the preflight, when, and what it saw. A bare `passed = true`
        with nothing behind it is an assertion, not evidence, and is refused.
      '';
    };
  };

  config = {
    assertions = [
      {
        assertion = useOpen -> cfg.passed;
        message = ''
          hardware.nvidia.open = true on host "${config.networking.hostName}", but
          zeta.gpu.openModulePreflight.passed is false.

          The open kernel modules require Turing or newer (they depend on the GSP,
          which pre-Turing silicon does not have). This repo cannot tell which card
          is in this node — the hardware-configuration.nix files are placeholders —
          so the generation has to be established on the machine:

              bun tools/nvidia-open-preflight.ts

          On exit 0, set both `zeta.gpu.openModulePreflight.passed = true` and
          `.evidence`. Do not set them from a datasheet, a purchase order, or the
          hardware inventory draft; run it on the node.
        '';
      }
      {
        assertion = cfg.passed -> (cfg.evidence != "");
        message = ''
          zeta.gpu.openModulePreflight.passed = true on host
          "${config.networking.hostName}" with empty `.evidence`.

          Record what the preflight actually saw (date, host, cards, compute
          capabilities). An attestation nobody can check later is the thing this
          gate exists to prevent.
        '';
      }
    ];

    # Boot-time symptom check. Oneshot and depended on by nothing, so a failure
    # is loud (`systemctl --failed`) without taking the node down harder than the
    # missing driver already has.
    #
    # NOT `lib.mkIf useOpen`. See the header: gating it on the open module made
    # it a guard that had never once executed. It runs on every host importing
    # gpu.nix; what `useOpen` still decides is the remedy text, below.
    #
    # The unit NAME keeps its `-open-` for continuity with any node that already
    # has it, and is now historical rather than descriptive: the check applies
    # under either kernel module. The description below says what it does.
    systemd.services.nvidia-open-driver-bound-check = {
      description = "Verify every NVIDIA display device has a driver bound (kernel module guard)";
      wantedBy = [ "multi-user.target" ];
      after = [ "systemd-modules-load.service" ];
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
      };
      script = ''
        set -u
        total=0
        unbound=0

        for dev in /sys/bus/pci/devices/*; do
          [ -r "$dev/vendor" ] || continue
          [ "$(cat "$dev/vendor")" = "0x10de" ] || continue

          # Display controllers only (class 0x03xxxx). Audio functions on the
          # same card, and anything else NVIDIA ships, are not our business.
          case "$(cat "$dev/class")" in
            0x03*) ;;
            *) continue ;;
          esac

          total=$((total + 1))
          slot=$(basename "$dev")

          if [ -e "$dev/driver" ]; then
            drv=$(basename "$(readlink -f "$dev/driver")")
          else
            drv="none"
          fi

          case "$drv" in
            nvidia)
              echo "ok: $slot bound to nvidia"
              ;;
            vfio-pci)
              # Deliberate: zeta.gpu-passthrough hands this card to a VM.
              echo "ok: $slot bound to vfio-pci (passthrough)"
              ;;
            *)
              unbound=$((unbound + 1))
              echo "PROBLEM: $slot has driver '$drv', not nvidia"
              ;;
          esac
        done

        # DECLARED VACUITY. Zero devices is not this unit's question — it is
        # gpu-node-label-preflight.nix's, which refuses on it because the node's
        # zeta.io/gpu label claims a card. Saying so out loud is what stops
        # "the driver-bound check passed" being read as "there are GPUs here".
        if [ "$total" -eq 0 ]; then
          echo "nothing to check: no NVIDIA display device on the PCI bus."
          echo "Whether this node should HAVE one is checked by"
          echo "zeta-gpu-node-label-preflight.service, not here."
          exit 0
        fi

        if [ "$unbound" -gt 0 ]; then
          echo ""
          echo "$unbound of $total NVIDIA display device(s) have no nvidia driver bound."
          ${
            if useOpen then
              ''
                echo "This node runs the OPEN kernel modules. They cannot bind pre-Turing"
                echo "GPUs (Maxwell, Pascal, Volta) — if this node was flipped to open"
                echo "without a preflight, that is the first thing to check:"
                echo "    bun tools/nvidia-open-preflight.ts"
                echo "Set hardware.nvidia.open = false and rebuild to restore the closed"
                echo "module, UNLESS these are Blackwell or newer cards, which have no"
                echo "proprietary kernel module at all."
              ''
            else
              ''
                echo "This node runs the CLOSED kernel module (hardware.nvidia.open = false),"
                echo "so the pre-Turing GSP explanation does not apply. Check that the module"
                echo "loaded at all and what stopped it:"
                echo "    lspci -nnk ; modprobe nvidia ; journalctl -b -k | grep -i nvidia"
                echo "If these are Blackwell or newer cards there is NO proprietary kernel"
                echo "module for them; that node needs hardware.nvidia.open = true, gated on"
                echo "the preflight attestation this file enforces."
              ''
          }
          exit 1
        fi

        echo "all $total NVIDIA display device(s) bound"
      '';
      path = [ pkgs.coreutils ];
    };
  };
}
