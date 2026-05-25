# infra/nixos/modules/k3s-agent.nix
#
# K3S worker node. Joins an existing cluster's control-plane via the
# server URL + shared token. Imported by every host that should run
# pods but NOT the API server.

{ config, pkgs, lib, ... }:

{
  services.k3s = {
    enable = true;
    role = "agent";

    # Control-plane API endpoint. Override per-host or in a
    # site-specific module:
    #   services.k3s.serverAddr = "https://control-plane.zeta.local:6443";
    serverAddr = lib.mkDefault "https://control-plane.zeta.local:6443";

    # Cluster join token — same as the server's, sourced from sops-nix
    # or agenix in production. Placeholder path keeps Git clean.
    tokenFile = lib.mkDefault "/var/lib/rancher/k3s/agent/token";

    extraFlags = [
      # Label every agent with its node role so Orleans (and other
      # workloads) can target placement via nodeSelector / affinity.
      "--node-label=zeta.io/role=worker"
    ];
  };

  # ---------------------------------------------------------------------------
  # Firewall — kubelet + flannel; no API server here
  # ---------------------------------------------------------------------------
  networking.firewall = {
    allowedTCPPorts = [
      10250  # kubelet
    ];
    allowedUDPPorts = [
      8472   # flannel VXLAN
    ];
    trustedInterfaces = [ "flannel.1" "cni0" ];
  };

  systemd.tmpfiles.rules = [
    "d /var/lib/rancher/k3s 0755 root root - -"
  ];
}
