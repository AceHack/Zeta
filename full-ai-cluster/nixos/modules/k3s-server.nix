# full-ai-cluster/nixos/modules/k3s-server.nix
#
# K3S control-plane configured for Cilium CNI takeover.
#
# K3S ships with flannel (CNI), kube-proxy, network-policy, servicelb,
# and traefik. Cilium replaces flannel + kube-proxy + network-policy.
# We disable all five so Cilium owns the network layer end-to-end.

{ config, pkgs, lib, ... }:

{
  services.k3s = {
    enable = true;
    role = "server";
    tokenFile = lib.mkDefault "/var/lib/rancher/k3s/server/token";
    clusterInit = lib.mkDefault true;

    extraFlags = [
      "--write-kubeconfig-mode=0640"
      "--write-kubeconfig-group=wheel"

      # CNI takeover by Cilium — disable flannel + kube-proxy + the
      # built-in network-policy controller. Cilium handles all three.
      "--flannel-backend=none"
      "--disable-network-policy"
      "--disable-kube-proxy"

      # Disable bundled servicelb + traefik. No replacement L4
      # load-balancer or ingress is declared in this PR — Services
      # of type LoadBalancer will stay Pending until a maintainer
      # commits a MetalLB + ingress-nginx Application under
      # k8s/applications/. Bootstrap-period workloads needing
      # external traffic should use NodePort or `kubectl port-forward`.
      "--disable=servicelb"
      "--disable=traefik"

      # Cluster CIDR — give Cilium a /16 to work with.
      "--cluster-cidr=10.42.0.0/16"
      "--service-cidr=10.43.0.0/16"
    ];

    # K3S applies these manifests on first boot. We seed only what's
    # required to get Cilium + ArgoCD running. ArgoCD takes over and
    # reconciles every other workload from k8s/applications/.
    manifests = {
      # CNI MUST come first — without it no pods can schedule,
      # including ArgoCD's own pods. Cilium installs here; ArgoCD's
      # cilium Application (k8s/applications/cilium/) takes over
      # reconciliation once it's healthy.
      cilium-namespace.source = ../../k8s/bootstrap/cilium-namespace.yaml;
      cilium-install.source = ../../k8s/bootstrap/cilium-install.yaml;
      # Then ArgoCD itself.
      argocd-namespace.source = ../../k8s/bootstrap/argocd-namespace.yaml;
      argocd-install.source = ../../k8s/bootstrap/argocd-install.yaml;
      # Finally the App-of-Apps that hands off to ArgoCD.
      root-application.source = ../../k8s/bootstrap/root-application.yaml;
    };
  };

  networking.firewall = {
    allowedTCPPorts = [
      6443    # K3S API
      9345    # K3S supervisor/join
      10250   # kubelet
      4244    # Hubble server
      4245    # Hubble Relay
      8472    # legacy flannel/VXLAN (kept for safety)
      # etcd ports 2379/2380 intentionally NOT in this list.
      # K3S embedded etcd binds 127.0.0.1 by default. Opening
      # those ports at the host firewall would risk exposing etcd
      # to the LAN if the bind address ever drifts. For multi-
      # server HA, add 2379/2380 to a host-specific override that
      # ALSO scopes them with `interfacesIn`/source-IP filtering to
      # the other control-plane nodes only.
    ];
    allowedUDPPorts = [
      8472    # VXLAN (Cilium can also run native-routing)
    ];
    trustedInterfaces = [ "cilium_host" "cilium_net" "cni0" "lxc+" ];
  };

  environment.variables = {
    KUBECONFIG = "/etc/rancher/k3s/k3s.yaml";
  };

  systemd.tmpfiles.rules = [
    "d /var/lib/rancher/k3s 0755 root root - -"
  ];
}
