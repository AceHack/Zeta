# full-ai-cluster/nixos/modules/zeta-virt-first-sync.nix
#
# SERVER ROLE ONLY (imported by k3s-server.nix). One-time sync of the
# manual-sync `kubevirt` and `cdi` ArgoCD Applications on a FRESH cluster, so a
# freshly flashed node comes up with the virtualisation layer (KubeVirt + CDI)
# the Windows-VM and VM-hosting capability needs -- instead of two Applications
# that sit `Missing` forever.
#
# WHY A SERVICE AND NOT `automated:` ON THE APPLICATIONS. Both Applications are
# DECLARED manual-sync because they adopt operators hand-installed on
# node-5b2dfa under production guests (manual-sync-policy.ts, and the pinned
# list in manual-sync-policy.test.ts). That is a property of THAT cluster, but it
# is written in the one tree every cluster syncs. Flipping it to `automated:`
# would delete the protection from the cluster that needs it; leaving it means a
# fresh install never gets the layer. This unit is the third path (see
# .claude/rules/gated-action-find-the-third-path.md): keep the declaration, do the
# one manual sync a human would -- and only where the operator's CRD shows none
# exists.
#
# The decision logic is the standalone script beside this file so a test can
# EXECUTE it (zeta-virt-first-sync.test.ts, every branch over a fake kubectl),
# not merely read Nix source. Same discipline as
# k3s-datastore-bootstrap-recovery.nix.
#
# Failure does not take k3s down: nothing requires this unit, it exits 1
# (systemd retries every 30s) until zeta-root has created the two Applications
# and the API answers, and it prints a named VERDICT line to the serial console
# for each of synced / skipped / waiting.

{ config, pkgs, ... }:

{
  systemd.services.zeta-virt-first-sync = {
    description = "One-time sync of the kubevirt + cdi Applications on a cluster with no KubeVirt/CDI operator";
    after = [ "k3s.service" ];
    wantedBy = [ "multi-user.target" ];
    # NOT `requires`/`bindsTo` k3s: it must keep retrying while k3s restarts.
    path = [ pkgs.coreutils config.services.k3s.package ];
    serviceConfig = {
      Type = "simple";
      ExecStart = "${pkgs.bash}/bin/bash ${./zeta-virt-first-sync.sh}";
      # Exit 0 means done (sentinel written or already present); exit 1 means
      # "not answerable yet". on-failure retries only the second.
      Restart = "on-failure";
      RestartSec = "30s";
      StandardOutput = "journal+console";
      StandardError = "journal+console";
    };
  };
}
