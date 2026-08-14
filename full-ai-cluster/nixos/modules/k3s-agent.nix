# full-ai-cluster/nixos/modules/k3s-agent.nix
#
# K3S worker. Matches the server's CNI takeover (no flannel,
# no kube-proxy, Cilium owns the network).

{ config, pkgs, lib, ... }:

{
  imports = [
    # Serial witness for the join. Imported HERE and not on the server
    # because only an agent joins anything — the `--cluster-init` founding
    # server joins nothing, and a witness on it would announce a join that
    # never happened.
    ./k3s-join-observer.nix
  ];

  # k3s's join is the join (Aaron 2026-08-13, closing PR #10493's open
  # question). Nothing below implements a join; the observer only reports
  # whether the k3s handshake configured in `services.k3s` succeeded, on the
  # console and on serial, so 081KSNY2Z0008QG0R0008PN7RQ scenario 5 has
  # something real to watch. `lib.mkDefault` so a host can switch it off.
  zeta.k3sJoinObserver.enable = lib.mkDefault true;

  services.k3s = {
    enable = true;
    role = "agent";
    serverAddr = lib.mkDefault "https://control-plane:6443";
    tokenFile = lib.mkDefault "/var/lib/rancher/k3s/agent/token";

    extraFlags = [
      "--node-label=zeta.io/role=worker"

      # NOTE: server-only flags like `--flannel-backend=none`,
      # `--disable-kube-proxy`, and `--disable-network-policy`
      # are NOT set here — they're server-side and the agent
      # inherits the network configuration from the server. K3S
      # rejects them on agents with a `flag not supported` error.
      # Cilium owns CNI on both sides; the server-side flags are
      # what disables flannel cluster-wide.
    ];
  };

  networking.firewall = {
    allowedTCPPorts = [
      10250   # kubelet
      4244    # Hubble server
      8472    # legacy VXLAN
    ];
    allowedUDPPorts = [
      8472
    ];
    trustedInterfaces = [ "cilium_host" "cilium_net" "cni0" "lxc+" ];

    # Cilium REQUIRES reverse-path filtering OFF — NixOS' default
    # `checkReversePath` rpfilter (mangle PREROUTING) drops Cilium's
    # asymmetric pod->host traffic before conntrack, black-holing every
    # pod->node packet. Same fix + rationale as k3s-server.nix.
    checkReversePath = false;
  };

  systemd.tmpfiles.rules = [
    "d /var/lib/rancher/k3s 0755 root root - -"
  ];
}
