# full-ai-cluster/nixos/modules/gpu-node-label-checks.nix
#
# The PURE half of the GPU node-label preflight: given the vendor this host
# claims, produce (a) the k3s `--node-label` flag that advertises the claim and
# (b) the shell text that checks the claim against the PCI bus at boot.
#
# ONE SOURCE FOR THE CLAIM AND FOR THE CHECK
# ------------------------------------------
# `nodeLabelFlag` and `script` are both derived from the same `vendor`, and
# gpu.nix takes the flag from HERE rather than restating the string. That is the
# whole reason this file exists as a separate, argument-taking function: a label
# advertised from one place and checked from another drifts, and a drifted check
# passes. It is the same discipline longhorn-preflight-checks.nix applies to the
# mount set, for the same reason.
#
# It is also separate from gpu-node-label-preflight.nix because a `lib.mkIf`-
# wrapped module config cannot be read by an evaluation test without reaching
# through `.content` -- and a test that reaches through a wrapper silently reads
# the WRONG value the day the wrapper changes shape.
#
# WHAT THE CHECK REFUSES, AND WHY EACH IS FATAL RATHER THAN UNTIDY
# ----------------------------------------------------------------
#
#   1. The node advertises zeta.io/gpu=<vendor> and NO such display device is on
#      the PCI bus.
#
#      A node label is a scheduling PROMISE. Before this file, gpu.nix:77
#      emitted `--node-label=zeta.io/gpu=nvidia` unconditionally -- every host
#      importing that module advertised an NVIDIA GPU to the scheduler whether
#      or not one was present, and every GPU host in this repo carries a
#      PLACEHOLDER hardware-configuration.nix, so nothing in the tree has ever
#      established that any of them has a card. A pod that lands on that node
#      because of the label fails at runtime instead of staying honestly
#      Pending, which is strictly worse: Pending is visible and says why.
#
#      The label is not decorative -- three consumers select on it today:
#        - nixos/modules/gpu-device-plugin.nix:85-86 (`nodeSelector:
#          zeta.io/gpu: nvidia`) -- a DaemonSet, and the only LIVE consumer;
#          hosts/worker-gpu/configuration.nix:32-35 sets
#          `zeta.gpu-device-plugin.enable = true`, so k3s applies that manifest.
#        - k8s/applications/vllm/deployment.yaml:23-24 -- masked by
#          `replicas: 0` (line 16).
#        - k8s/applications/ollama/Application.yaml:54-55 -- masked by
#          `replicaCount: 0` (line 34) and manual sync.
#      The two workloads ALSO request `nvidia.com/gpu: 1`, which a GPU-less node
#      cannot satisfy, so the extended resource is a second and honest gate
#      behind the label. The label alone is what the DaemonSet uses.
#
#   2. Every such display device is bound to vfio-pci.
#
#      nixos/modules/gpu-passthrough.nix binds listed PCI IDs to vfio-pci at
#      boot so a VM can own them. A card owned by a VM is not available to pods,
#      so a node whose every GPU is passed through is advertising capacity it
#      has already given away. Counted separately and refused separately,
#      because the remedy is different.
#
# WHAT IT DELIBERATELY DOES NOT DO
# --------------------------------
# It does not ask whether the DRIVER bound. That is a different question with a
# different owner: nvidia-open-guard.nix's boot-time unit. This file asks only
# "is the silicon the label claims physically here and not handed to a VM",
# which is answerable from sysfs alone with no driver loaded -- so it can run
# early, before k3s.service, where the verdict is still useful.
#
# It does not count devices into a `zeta.io/gpu-count` label. Deriving a count
# label from this probe is the obvious next step and is NOT done here; see the
# severity note in gpu-node-label-preflight.nix.
#
# HONEST LIMITS, STATED RATHER THAN HIDDEN
# ----------------------------------------
#   - `zeta.io/gpu` is a SINGLE-valued label while gpu-device-plugin.nix accepts
#     `vendors = [ "nvidia" "amd" ]`, so a genuinely mixed-vendor node cannot be
#     described by this label at all and only one vendor's DaemonSet will match
#     it. That inconsistency predates this file and is not fixed by it; the
#     preflight checks the ONE vendor the label actually claims.
#   - The `intel` row of the vendor table is WEAK: PCI vendor 0x8086 with a
#     display class matches the integrated graphics in essentially any Intel
#     box, so an `intel` claim passes on hardware that has no discrete GPU. The
#     row is present so the table is complete and the check does not silently
#     skip a vendor; it is not evidence of a discrete Intel accelerator. Only
#     `nvidia` is emitted by gpu.nix today.

{ lib, vendor }:

let
  # PCI vendor IDs as sysfs reports them in /sys/bus/pci/devices/*/vendor:
  # lowercase hex with an 0x prefix. Same encoding nvidia-open-guard.nix:114
  # already compares against, kept identical so the two probes agree on what an
  # NVIDIA device is.
  pciVendorIds = {
    nvidia = "0x10de";
    amd = "0x1002";
    intel = "0x8086";
  };

  pciVendorId = pciVendorIds.${vendor};

  labelKey = "zeta.io/gpu";
  nodeLabel = "${labelKey}=${vendor}";
  nodeLabelFlag = "--node-label=${nodeLabel}";

  # Markers on the serial console, in the shape k3s-join-observer.nix and
  # longhorn-preflight-checks.nix already established for this cluster: a fixed
  # token a harness can grep for without parsing prose.
  okMarker = "ZETA_GPU_NODE_LABEL_PREFLIGHT_OK";
  failMarker = "ZETA_GPU_NODE_LABEL_PREFLIGHT_FAILED";

  # POSIX sh. No backticks anywhere below: this is a Nix indented string, where
  # a backslash is NOT an escape, so a "quoted" backtick would survive into the
  # shell and open a command substitution. Shell braces are avoided entirely
  # ($dev, not the braced form) so that every ''${...}'' below is a Nix
  # interpolation and there is no second syntax to keep straight.
  script = ''
    set -u

    failures=0

    # note()  -> journal only. shout() -> journal AND the physical console.
    # systemd already prints a red "[FAILED] Failed to start ..." for a failing
    # oneshot; shout() is what turns that into an actionable message on the
    # screen an operator is looking at during bring-up.
    note() { printf '%s\n' "$*" >&2; }
    shout() {
      printf '%s\n' "$*" >&2
      printf '%s\n' "$*" > /dev/console 2>/dev/null || true
    }

    fail() {
      failures=$((failures + 1))
      shout "zeta-gpu-node-label-preflight: REFUSED -- $1"
      shout "zeta-gpu-node-label-preflight:   remedy: $2"
    }

    # ---- walk the PCI bus for the vendor this node CLAIMS -------------------
    total=0
    available=0
    passthrough=0

    for dev in /sys/bus/pci/devices/*; do
      [ -r "$dev/vendor" ] || continue
      [ -r "$dev/class" ] || continue
      [ "$(cat "$dev/vendor")" = "${pciVendorId}" ] || continue

      # Display controllers only (PCI class 0x03xxxx). The audio function on
      # the same board, and everything else the vendor ships, are not a GPU.
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

      if [ "$drv" = "vfio-pci" ]; then
        passthrough=$((passthrough + 1))
        note "zeta-gpu-node-label-preflight: $slot is bound to vfio-pci (VM passthrough) -- not available to pods"
      else
        available=$((available + 1))
        note "zeta-gpu-node-label-preflight: ok   $slot ${vendor} display device, driver '$drv'"
      fi
    done

    # ---- the claim on the label vs what the bus says -----------------------
    if [ "$total" -eq 0 ]; then
      fail "this node advertises ${nodeLabel} to the Kubernetes scheduler, but NO ${vendor} display device (PCI vendor ${pciVendorId}, class 0x03) is present on the PCI bus. A node label is a scheduling promise: pods selecting ${nodeLabel} will be placed here and fail at runtime instead of staying Pending with a reason." \
           "the label is emitted by nixos/modules/gpu.nix for every host that imports it. Run: lspci -nn ; grep -l ${pciVendorId} /sys/bus/pci/devices/*/vendor. If this box genuinely has no ${vendor} GPU, drop ../../modules/gpu.nix and ../../modules/gpu-device-plugin.nix from this host's imports and rebuild. If a card is seated, it is not being enumerated at all -- check seating, riser, and auxiliary power before blaming the driver."
    elif [ "$available" -eq 0 ]; then
      fail "this node advertises ${nodeLabel}, and all $total ${vendor} display device(s) are bound to vfio-pci -- every one of them belongs to a VM, so no GPU is available to Kubernetes pods scheduled here." \
           "the bind is nixos/modules/gpu-passthrough.nix, driven by zeta.gpu-passthrough.pciIds on this host. Run: lspci -nnk. Either shrink that list so at least one card keeps the host driver, or stop advertising ${nodeLabel} on this host by dropping ../../modules/gpu.nix from its imports."
    fi

    # ---- verdict -----------------------------------------------------------
    if [ "$failures" -gt 0 ]; then
      shout "${failMarker} failures=$failures vendor=${vendor} devices=$total available=$available passthrough=$passthrough"
      shout "zeta-gpu-node-label-preflight: GPU workloads placed here by ${nodeLabel} will NOT run until the above is fixed."
      exit 1
    fi

    note "${okMarker} vendor=${vendor} devices=$total available=$available passthrough=$passthrough"
  '';
in
{
  inherit
    pciVendorIds
    pciVendorId
    vendor
    labelKey
    nodeLabel
    nodeLabelFlag
    okMarker
    failMarker
    script
    ;
}
