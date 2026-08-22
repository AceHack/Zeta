# full-ai-cluster/nixos/modules/cilium-wireguard-node-preflight.nix
#
# Boot-time REFUSAL for the one node-level prerequisite Cilium's encryption
# settings create: a kernel that can make a WireGuard device.
#
# Imported by cilium-wireguard-prereqs.nix, which common.nix imports, so this
# runs on EVERY cluster node -- control plane and workers alike -- with no
# per-host opt-in. That import edge is the whole point, and the in-tree
# counter-example is still nixos/modules/nvidia-open-guard.nix:99, whose
# boot-time probe is `lib.mkIf useOpen` while gpu.nix ships `open = false`, so
# it has never run on any host in this repo.
#
# WHAT THE OPERATOR SEES WHEN THE KERNEL CANNOT DO WIREGUARD
# ----------------------------------------------------------
#   [FAILED] Failed to start Cilium WireGuard node preflight (kernel can create a WireGuard device).
#   zeta-cilium-wg-preflight: REFUSED -- the wireguard kernel module is not loaded. ...
#   zeta-cilium-wg-preflight:   remedy: it is requested via boot.kernelModules in ...
#   ZETA_CILIUM_WG_PREFLIGHT_FAILED failures=2 warnings=0
#
# on the physical console, and in `systemctl --failed` and the journal after.
#
# SEVERITY: THIS DOES NOT BLOCK k3s, AND THAT IS A DELIBERATE CHOICE -- HERE
# WITH A SECOND REASON THE LONGHORN PRECEDENT DID NOT HAVE
# --------------------------------------------------------------------------
# longhorn-node-preflight.nix declines `RequiredBy = [ "k3s.service" ]` because
# an unrun check wired as a hard gate makes a false positive cost the whole
# cluster during the one bring-up where the operator can least debug it. That
# reasoning applies here unchanged: nothing in this file has run on physical
# hardware.
#
# This preflight has a SECOND, independent reason not to amputate, and it is
# the stronger of the two:
#
#   the failure this guards against is ALREADY loud. cilium-agent does not
#   silently run unencrypted when WireGuard is unavailable -- it returns an
#   error from newDaemon, names the remedy in the message, and
#   CrashLoopBackOffs (see cilium-wireguard-preflight-checks.nix for the
#   quoted source). So the marginal value of this unit is EARLIER and
#   BETTER-PLACED diagnosis -- on the console, before k3s, naming the two
#   manifests that made the demand -- not the prevention of a silent failure.
#
# Gating k3s on it would trade a diagnosable CrashLoopBackOff, where `kubectl
# logs -n kube-system ds/cilium` tells you the answer, for a node that never
# joins at all and tells you nothing over the network. That is a strictly worse
# trade, and it does not become a better one after a clean metal boot -- so
# unlike the Longhorn note, this is not an upgrade waiting on evidence. If it
# is ever revisited, the argument to beat is this paragraph, not the
# never-run-on-metal one.
#
# `before = [ "k3s.service" ]` IS set, so the verdict is on the console before
# k3s starts the CNI that depends on it.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.cilium.wireguardPreflight;

  checks = import ./cilium-wireguard-preflight-checks.nix {
    inherit lib;
    sources = import ./cilium-wireguard-sources.nix;
  };
in
{
  options.zeta.cilium.wireguardPreflight = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = ''
        Run the boot-time Cilium WireGuard preflight: the wireguard kernel
        module is loaded, the kernel accepts an RTM_NEWLINK for a WireGuard
        device (the call cilium-agent makes), and wg is available for
        diagnosis.

        Default true on every node. The checks are DERIVED from the shipped
        Cilium value surfaces, so on a tree whose manifests do not request
        encryption.type=wireguard the unit already reports
        ZETA_CILIUM_WG_PREFLIGHT_NOT_REQUIRED and exits 0 -- turning this off
        is for a host that deliberately runs a different CNI, not for silencing
        a red check.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-cilium-wg-preflight = {
      description = "Cilium WireGuard node preflight (kernel can create a WireGuard device)";

      # systemd-modules-load.service: check 1 asks whether the module this node
      #   DECLARED actually loaded, which is only a question once that unit has
      #   had its turn. Ordinary services are already after sysinit.target, but
      #   the dependency is what the check means, so it is written down.
      #   Wanted, not required: a required dependency that fails would take this
      #   unit down as a dependency error, replacing a diagnosis that names a
      #   remedy with a systemd message that names none.
      after = [ "systemd-modules-load.service" ];
      wants = [ "systemd-modules-load.service" ];
      before = [ "k3s.service" ];
      wantedBy = [ "multi-user.target" ];

      # iproute2 for the netlink probe. Store paths via `path` rather than the
      # inherited PATH, so the CHECK does not depend on environment.systemPackages
      # -- which is itself one of the things being checked.
      path = [ pkgs.iproute2 ];

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        # No Restart=. A retry loop turns a hard refusal into a unit that is
        # perpetually "activating", which reads as in-progress rather than as
        # refused.
      };

      script = checks.script;
    };
  };
}
