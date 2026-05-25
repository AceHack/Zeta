# infra/nixos/modules/k3s-server.nix
#
# K3S control-plane node. Imported by the host(s) that should serve the
# cluster API and run the embedded etcd. Bootstraps ArgoCD via auto-
# deploy manifests so the cluster becomes self-managing immediately
# after first boot.

{ config, pkgs, lib, ... }:

{
  # ---------------------------------------------------------------------------
  # K3S control-plane
  # ---------------------------------------------------------------------------
  services.k3s = {
    enable = true;
    role = "server";

    # Cluster init token. In production, source this from sops-nix or
    # agenix; the placeholder below is intentionally invalid so a
    # plaintext token never lands in Git by accident.
    #
    #   tokenFile = config.sops.secrets.k3s-token.path;
    #
    # For initial bootstrap, generate a token once and pin it in a
    # local-only file referenced by tokenFile.
    tokenFile = lib.mkDefault "/var/lib/rancher/k3s/server/token";

    # Embedded etcd so a single control-plane node has a real datastore
    # rather than the default sqlite. Allows future multi-server HA
    # without a datastore migration.
    #
    # IMPORTANT: only the FIRST control-plane node should set
    # clusterInit = true. Additional servers joining for HA must
    # set this to false and provide serverAddr pointing at the
    # cluster-init node. Per-host override pattern:
    #
    #   # On the 2nd/3rd control-plane:
    #   services.k3s.clusterInit = lib.mkForce false;
    #   services.k3s.serverAddr = "https://control-plane-1.zeta.local:6443";
    clusterInit = lib.mkDefault true;

    extraFlags = [
      # Admin kubeconfig — group-readable so the `wheel` group can
      # use kubectl without sudo. NOT world-readable (0644 would
      # leak cluster-admin creds to any unprivileged user on the
      # control-plane node).
      "--write-kubeconfig-mode=0640"
      "--write-kubeconfig-group=wheel"

      # Disable bundled servicelb + traefik. Replacement load-balancer
      # + ingress are not yet declared as ArgoCD Applications under
      # infra/k8s/applications/; until those land (MetalLB +
      # ingress-nginx are the planned candidates), the cluster has no
      # in-cluster L4/L7 ingress and Services of type LoadBalancer
      # stay in Pending. Workloads needing external traffic should
      # use NodePort or a host-network pod for the bootstrap period.
      "--disable=servicelb"
      "--disable=traefik"

      # Disable the default network policy controller; let Cilium or
      # equivalent land as an ArgoCD Application later.
      # "--flannel-backend=none"  # uncomment when Cilium ships
    ];

    # Manifests auto-applied by K3S on first boot. We seed:
    #   - ArgoCD namespace + install (so ArgoCD comes up immediately)
    #   - Orleans skeleton (so the distributed-chron substrate has a
    #     namespace + RBAC ready before ArgoCD takes over)
    #   - root Application (so ArgoCD self-bootstraps the rest of
    #     the workloads from this Git repo)
    #
    # Everything else (GitLab, Argo Workflows, Argo Rollouts, future
    # MetalLB + ingress-nginx) is reconciled by ArgoCD itself reading
    # infra/k8s/applications/.
    manifests = {
      argocd-namespace.source = ../../k8s/bootstrap/argocd-namespace.yaml;
      argocd-install.source = ../../k8s/bootstrap/argocd-install.yaml;
      initial-orleans.source = ../../k8s/bootstrap/initial-orleans.yaml;
      root-application.source = ../../k8s/applications/root-application.yaml;
    };
  };

  # ---------------------------------------------------------------------------
  # Firewall — K3S API server + kubelet + flannel
  # ---------------------------------------------------------------------------
  networking.firewall = {
    allowedTCPPorts = [
      6443   # K3S API server (kubectl + agent kubeconfig)
      9345   # K3S supervisor/registration (server <-> server + agent join)
      10250  # kubelet
      2379   # etcd client
      2380   # etcd peer
    ];
    allowedUDPPorts = [
      8472   # flannel VXLAN
    ];
    # Trust the cluster-internal CNI network.
    trustedInterfaces = [ "flannel.1" "cni0" ];
  };

  # ---------------------------------------------------------------------------
  # Make kubectl Just Work for the admin user on the control-plane node.
  # ---------------------------------------------------------------------------
  environment.variables = {
    KUBECONFIG = "/etc/rancher/k3s/k3s.yaml";
  };

  # Persistent storage for K3S data + manifests. Per-host config should
  # mount this on a non-root disk for any serious deployment.
  systemd.tmpfiles.rules = [
    "d /var/lib/rancher/k3s 0755 root root - -"
  ];
}
