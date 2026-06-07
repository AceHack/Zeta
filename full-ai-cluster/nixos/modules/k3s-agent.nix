# full-ai-cluster/nixos/modules/k3s-agent.nix
#
# K3S worker. Matches the server's CNI takeover (no flannel,
# no kube-proxy, Cilium owns the network).

{ config, pkgs, lib, ... }:

{
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
  };

  systemd.tmpfiles.rules = [
    "d /var/lib/rancher/k3s 0755 root root - -"
  ];
}
