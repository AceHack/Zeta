# full-ai-cluster/nixos/modules/longhorn-node-preflight.nix
#
# Boot-time REFUSAL for the Longhorn node prerequisites, so a node whose
# storage substrate is not actually there says so on the console at bring-up
# instead of handing the operator a Pending pod hours later.
#
# Imported by longhorn-prereqs.nix, which common.nix imports, so this runs on
# EVERY cluster node -- control plane and workers alike -- with no per-host
# opt-in. That import edge is the whole point: a preflight only some hosts
# instantiate is a guard that cannot fire where it matters
# (nixos/modules/nvidia-open-guard.nix:99 is the in-tree example -- its
# boot-time probe is `lib.mkIf useOpen`, and gpu.nix:57 ships `open = false`,
# so it has never run on any host in this repo).
#
# WHAT THE OPERATOR SEES WHEN A PREREQUISITE IS ABSENT
# ----------------------------------------------------
#   [FAILED] Failed to start Longhorn node preflight (storage devices + attach prerequisites).
#   zeta-longhorn-preflight: REFUSED -- iscsid.service is not active. ...
#   zeta-longhorn-preflight:   remedy: run: systemctl status iscsid.service ; ...
#   ZETA_LONGHORN_PREFLIGHT_FAILED failures=1 mounts_checked=0 longhorn_devices=0 orphan_devices=0
#
# Read the two counts together. `mounts_checked` is what the CONFIG declared;
# `longhorn_devices` is what the DISKS carry. mounts_checked=0 on its own has
# never meant "nothing to check" -- it is also exactly what a node looks like
# when its hardware-configuration capture failed at install time and the
# committed /-and-/boot placeholder got baked in. See check 1b in
# longhorn-preflight-checks.nix.
#
# on the physical console (the checks write to /dev/console, the way
# k3s-join-observer.nix puts its contract markers on serial), and in
# `systemctl --failed` and the journal thereafter.
#
# SEVERITY: THIS DOES NOT BLOCK k3s, AND THAT IS A DELIBERATE, REVISABLE CHOICE
# ----------------------------------------------------------------------------
# The obvious stronger wiring is `RequiredBy = [ "k3s.service" ]`, which turns
# a failed preflight into "this node does not join the cluster". That is the
# fail-closed shape and it is probably where this ends up. It is NOT what ships
# here, for a reason worth writing down rather than discovering later:
#
#   this preflight has never run on physical hardware. Nothing in this change
#   has. Wiring an unrun check as a hard gate on the k3s unit means a false
#   positive costs the operator the entire cluster during the one bring-up
#   where they are least able to debug it -- which is the same 2am failure this
#   file exists to prevent, merely inverted.
#
# The upgrade is one line (`requiredBy = [ "k3s.service" ]` beside `before`),
# and the evidence that licenses it is one clean metal boot showing
# ZETA_LONGHORN_PREFLIGHT_OK. Until then the honest severity is "refuses
# loudly, does not amputate".
#
# `before = [ "k3s.service" ]` IS set, so the verdict is on the console before
# kubelet starts advertising this node as a place to put storage.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.longhorn.preflight;

  checks = import ./longhorn-preflight-checks.nix {
    inherit lib;
    inherit (config) fileSystems;
  };
in
{
  options.zeta.longhorn.preflight = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = ''
        Run the boot-time Longhorn node preflight: every filesystem this host
        declares under /var/lib/longhorn is really mounted, every device
        carrying a longhorn* filesystem label is mounted there, iscsid is
        active, iscsi_tcp is loaded, and the /usr/local/bin FHS shims that
        longhorn-manager nsenters to are executable.

        Default true on every node. Turn it off only for a host that
        deliberately runs no Longhorn storage -- and note it should not be
        needed even then: the mount checks are derived from the host's own
        declarations AND from the labels on its disks, so a host with neither
        has nothing to check without needing this switch. A host that declares
        nothing but HAS longhorn-labelled disks is precisely the case check 1b
        refuses, and turning this off would hide it.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-longhorn-preflight = {
      description = "Longhorn node preflight (storage devices + attach prerequisites)";

      # local-fs.target: the declared mounts have been attempted (nofail means
      #   "attempted", not "succeeded" -- which is exactly what check 1 measures).
      # systemd-tmpfiles-setup.service: the /usr/local/bin shims and the
      #   /var/lib/longhorn directory exist by now if they are going to.
      # iscsid.service: wanted, not required -- a REQUIRED dependency that fails
      #   would take this unit down as a dependency error, replacing the
      #   diagnosis with a systemd message that names no remedy.
      after = [
        "local-fs.target"
        "systemd-tmpfiles-setup.service"
        "iscsid.service"
      ];
      wants = [ "iscsid.service" ];
      before = [ "k3s.service" ];
      wantedBy = [ "multi-user.target" ];

      # findmnt (util-linux) and systemctl (systemd). Store paths via `path`
      # rather than relying on the unit's inherited PATH, so the check does not
      # depend on environment.systemPackages.
      path = [
        pkgs.util-linux
        pkgs.systemd
      ];

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        # No Restart=. A retry loop would turn a hard refusal into a unit that
        # is perpetually "activating", which reads as in-progress rather than
        # as refused -- the failure mode this whole file is against.
      };

      script = checks.script;
    };
  };
}
