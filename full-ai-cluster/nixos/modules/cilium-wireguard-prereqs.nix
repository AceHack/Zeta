# full-ai-cluster/nixos/modules/cilium-wireguard-prereqs.nix
#
# Node-level prerequisites for the encryption Cilium is configured to use.
# Imported by common.nix so EVERY cluster node (control-plane + workers) has
# them -- node-to-node encryption is a property of the PAIR, so a single node
# missing the prerequisite is a cluster-wide fact, not a local one.
#
# THE GAP THIS CLOSES
# -------------------
# k8s/bootstrap/cilium-install.yaml (a `bootstrap: true` k3s HelmChart, i.e.
# first boot) and k8s/applications/cilium/Application.yaml (ArgoCD sync-wave
# "-80") both ship:
#
#     encryption:
#       enabled: true
#       type: wireguard
#       nodeEncryption: true
#
# Before this module, NOTHING under nixos/ named WireGuard. `boot.kernelModules`
# carried `kvm-intel`, `kvm-amd` and `iscsi_tcp`; `boot.extraModulePackages` was
# empty on both hosts; `wireguard-tools` appeared exactly once in the tree, in
# usb-nixos-installer/nixos/installer/configuration.nix -- on the INSTALLER ISO,
# never on an installed node. The CNI's hardest node-level dependency was
# satisfied, if it was satisfied, by two mechanisms this repository does not
# own:
#
#   nixpkgs' autoModules (which answers "m" to CONFIG_WIREGUARD without anyone
#   asking), and the kernel's rtnl-link auto-load (which loads the module on
#   the very netlink call Cilium makes).
#
# Both are almost certainly true today. Neither is DECLARED, so neither is
# checked, and the day one stops being true the symptom is a CNI that will not
# start on a node with no CNI to report it. The reasoning, the citations, and
# the honest limits are in cilium-wireguard-preflight-checks.nix.
#
# WHAT IS DECLARED HERE
#   boot.kernelModules  -- the module, so systemd-modules-load loads it at boot
#                          and FAILS VISIBLY if it cannot, rather than leaving
#                          the load to a lazy auto-load inside a CNI pod.
#   systemPackages      -- wireguard-tools, so an operator on the console can
#                          answer "is the tunnel up" (wg show cilium_wg0).
#                          Diagnosis only; cilium-agent never execs wg.
#
# Both are gated on the DERIVED requirement, so a tree that stops asking for
# WireGuard stops carrying the module, with no edit here.

{ config, lib, pkgs, ... }:

let
  checks = import ./cilium-wireguard-preflight-checks.nix {
    inherit lib;
    sources = import ./cilium-wireguard-sources.nix;
  };
in
{
  imports = [
    # The RUNTIME half. Everything below is a DECLARATION, and a declaration is
    # not evidence that the thing is there on the node -- the lesson
    # longhorn-prereqs.nix paid 62 days of dead storage to learn, with every
    # declaration present and correct the whole time.
    #
    # Imported here rather than from common.nix so the preflight travels with
    # the prerequisite it checks: any host (or VM test) that pulls in
    # cilium-wireguard-prereqs.nix gets the check that says whether it worked.
    ./cilium-wireguard-node-preflight.nix
  ];

  # The module name comes from the SAME binding the preflight checks, so the
  # thing declared and the thing checked cannot drift apart.
  boot.kernelModules = lib.optionals checks.wireguardRequired [ checks.kernelModule ];

  # Diagnosis on the console. Not needed by cilium-agent, which drives the
  # device over netlink/wgctrl.
  environment.systemPackages = lib.optionals checks.wireguardRequired [ pkgs.wireguard-tools ];
}
