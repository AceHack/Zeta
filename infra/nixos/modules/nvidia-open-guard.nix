# infra/nixos/modules/nvidia-open-guard.nix
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
# The preflight itself is ../../../tools/nvidia-open-preflight.ts (`bun` it) — run
# it on the candidate node, while the closed module is still loaded.
#
# NO FALSIFIER COVERS THIS COPY. Its twin at
# full-ai-cluster/nixos/modules/nvidia-open-guard.nix (byte-identical below the
# header) is exercised by full-ai-cluster/nixos/tests/nvidia-open-guard-gate.nix
# under `nix flake check --no-build`. This tree's hosts hang off the ROOT flake,
# whose `checks` is empty and whose `nix flake check` no workflow runs — both CI
# invocations are `working-directory: full-ai-cluster`. So a mutation making the
# assertions below vacuous would be caught over there and NOT here, and the two
# files staying in sync is a convention, not a check.
# 081M00QP33F087G0R001JKB5QM records this as an open gap.

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
    # IN THIS TREE IT HAS NEVER RUN, AND STILL DOES NOT. `lib.mkIf useOpen`
    # against a fleet where ./gpu.nix ships `open = lib.mkDefault false` and no
    # host overrides it means this unit is instantiated on ZERO hosts -- a check
    # that did not run, wearing the appearance of one that passed. The header's
    # "two independent gates" describes one gate here.
    #
    # The twin at full-ai-cluster/nixos/modules/nvidia-open-guard.nix dropped the
    # `mkIf` on 2026-08-21 and now installs this unit on every host importing
    # gpu.nix; full-ai-cluster/nixos/tests/nvidia-open-guard-gate.nix pins that
    # reachability in all four gate states. It is NOT copied here for the reason
    # recorded at ./gpu.nix's node-label block: this tree has no falsifier that
    # could hold the change, so the copy would be a second unrun guard rather
    # than a fix.
    systemd.services.nvidia-open-driver-bound-check = lib.mkIf useOpen {
      description = "Verify every NVIDIA display device has a driver bound (open kernel module guard)";
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

        if [ "$total" -eq 0 ]; then
          echo "PROBLEM: hardware.nvidia.open = true but no NVIDIA display device found"
          exit 1
        fi

        if [ "$unbound" -gt 0 ]; then
          echo ""
          echo "$unbound of $total NVIDIA display device(s) have no nvidia driver bound."
          echo "The open kernel modules cannot bind pre-Turing GPUs (Maxwell, Pascal,"
          echo "Volta) — if this node was flipped to open without a preflight, that is"
          echo "the first thing to check:"
          echo "    bun tools/nvidia-open-preflight.ts"
          echo "Set hardware.nvidia.open = false and rebuild to restore the closed"
          echo "module, UNLESS these are Blackwell or newer cards, which have no"
          echo "proprietary kernel module at all."
          exit 1
        fi

        echo "all $total NVIDIA display device(s) bound"
      '';
      path = [ pkgs.coreutils ];
    };
  };
}
