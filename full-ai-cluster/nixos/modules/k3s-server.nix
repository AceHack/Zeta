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

    # Do NOT set `tokenFile` on the --cluster-init founding node.
    #
    # k3s treats `--token-file` as "READ the cluster token from this path",
    # NOT "write it here". On a fresh single-node `--cluster-init` the file
    # does not exist yet, so k3s sits in
    #   "Waiting for /var/lib/rancher/k3s/server/token to be available"
    # and after ~4 min exits with
    #   fatal "Error: Timeout while trying to read the file"
    # systemd then restarts it into the same wait — a permanent crash-loop
    # in which the API server never comes up and /etc/rancher/k3s/k3s.yaml
    # is never written.
    #
    # With no `tokenFile`, `--cluster-init` GENERATES the cluster token and
    # persists it to /var/lib/rancher/k3s/server/{token,node-token} at that
    # same default path — which is exactly what workers copy into
    # /var/lib/rancher/k3s/agent/token to join (see hosts/worker-gpu/README).
    # So removing this line fixes first-boot without changing the join flow.
    #
    # Empirically caught on node-115f93 first-boot install (2026-06-05):
    # k3s-server crash-looped on the token-read timeout; removing the
    # explicit tokenFile is the fix.
    clusterInit = lib.mkDefault true;

    extraFlags = [
      "--write-kubeconfig-mode=0640"
      "--write-kubeconfig-group=wheel"

      # Make the API-server cert valid for the stable name `control-plane`.
      # Cilium (kubeProxyReplacement) and workers connect to
      # https://control-plane:6443; without this SAN the TLS handshake
      # would fail cert verification when the endpoint is addressed by
      # that name. (127.0.0.1 / the node IP are SAN'd by k3s already.)
      "--tls-san=control-plane"

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

      # Disable the bundled local-path-provisioner. local-storage.nix
      # re-declares it as `zeta-local-path` (the single default class) with
      # a fixed path; leaving k3s' built-in enabled creates a SECOND
      # StorageClass *also* marked default (`local-path (default)` AND
      # `zeta-local-path (default)`), which is an invalid/ambiguous config —
      # a class-less PVC then binds non-deterministically. Observed on
      # node-09485d (2026-06-07). Keep exactly one default.
      "--disable=local-storage"

      # Cluster CIDR — give Cilium a /16 to work with.
      "--cluster-cidr=10.42.0.0/16"
      "--service-cidr=10.43.0.0/16"
    ];

    # K3S applies these manifests on first boot in dependency order.
    # Each layer depends on the one(s) above it; ArgoCD comes LAST
    # so its own pods can use cert-manager TLS + Vault secrets +
    # SPIRE identities on bring-up.
    #
    # Order (per Aaron 2026-05-25):
    #   1. Cilium  (CNI + KPR + Hubble + Cilium Service Mesh + BPF MASQUERADE)
    #   2. cert-manager  (TLS certs; Vault depends on these)
    #   3. Vault   (most other tools depend on it)
    #   4. SPIRE   (chains to Vault as upstream CA)
    #   5. Trust Manager  (distributes SPIRE + cert-manager bundles)
    #   6. External Secrets Operator  (syncs Vault secrets into K8s)
    #   7. ArgoCD  (reconciles everything else from k8s/applications/)
    #
    # K3S applies manifests in alphabetical filename order, so
    # `00-`/`10-`/`20-`/.../`70-` prefixes are NOT needed —
    # `cert-manager-install.yaml` < `cilium-install.yaml` <
    # `external-secrets-install.yaml` ... etc. is fine because the
    # Helm Controller waits for each chart's pods to be Ready before
    # the next chart's pods start contending. But Helm Controller
    # runs the install jobs in parallel by default — the dependency
    # ordering above is enforced by setting `spec.timeout` +
    # `spec.repo` in a way that lets later charts retry while their
    # dependencies finish. For deterministic ordering during
    # bootstrap, the `bootstrapAfter` annotation pattern (TBD) would
    # be added in a follow-up.
    manifests = {
      # Gateway API CRDs — MUST exist before Cilium (gatewayAPI.enabled) and
      # cert-manager (ExperimentalGatewayAPISupport) start, else cert-manager
      # crash-loops "Gateway API CRDs do not seem to be present" (observed on
      # node-09485d: 869 restarts/3d). Cilium does NOT ship them. The `aa-`
      # prefix forces it first in k3s's alphabetical apply order.
      aa-gateway-api-crds.source = ../../k8s/bootstrap/gateway-api-crds.yaml;
      # Cilium (CNI must exist before any pod can schedule).
      cilium-namespace.source = ../../k8s/bootstrap/cilium-namespace.yaml;
      cilium-install.source = ../../k8s/bootstrap/cilium-install.yaml;
      # cert-manager (Vault TLS source).
      cert-manager-install.source = ../../k8s/bootstrap/cert-manager-install.yaml;
      # Vault (secrets backend).
      vault-install.source = ../../k8s/bootstrap/vault-install.yaml;
      # SPIRE (workload identity, chains to Vault).
      spire-install.source = ../../k8s/bootstrap/spire-install.yaml;
      # Trust Manager (CA bundle distribution).
      trust-manager-install.source = ../../k8s/bootstrap/trust-manager-install.yaml;
      # External Secrets Operator (Vault → K8s Secret sync).
      external-secrets-install.source = ../../k8s/bootstrap/external-secrets-install.yaml;
      # ArgoCD (reconciler for everything else).
      argocd-namespace.source = ../../k8s/bootstrap/argocd-namespace.yaml;
      argocd-install.source = ../../k8s/bootstrap/argocd-install.yaml;
      # Root App-of-Apps — hands off to ArgoCD.
      root-application.source = ../../k8s/bootstrap/root-application.yaml;
    };
  };

  # Stable name for the control-plane (`control-plane`), independent of
  # this node's per-install hostname (node-<6hex>).
  #
  # WHY a fixed name: Cilium runs with kubeProxyReplacement (kube-proxy is
  # disabled above), so the Cilium agent must reach the API server
  # directly at `k8sServiceHost: control-plane`
  # (see k8s/bootstrap/cilium-install.yaml). On the control-plane node
  # itself the API is local, so we map `control-plane` -> 127.0.0.1 in
  # /etc/hosts. This is all a single-node cluster needs, and is the
  # endpoint the control-plane's own Cilium agent uses. Deterministic;
  # no name-resolution protocol required.
  #
  # mDNS is NOT used — `control-plane.zeta.local` was a dangling name that
  # never resolved (mDNS is single-label `.local`; nothing defined it).
  #
  # MULTI-NODE TODO: workers (k3s-agent serverAddr = https://control-plane)
  # need `control-plane` to resolve to the control-plane's LAN IP. mDNS is
  # unreliable here and NetBIOS/nss-wins broadcast resolution did not work
  # in testing (winbindd path). The robust path is to inject a
  # `control-plane <cp-ip>` /etc/hosts entry on each worker at install
  # time (zeta-install.sh) once worker provisioning lands. Tracked
  # separately; single-node bring-up does not depend on it.
  networking.hosts."127.0.0.1" = [ "control-plane" ];

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

    # Cilium REQUIRES reverse-path filtering OFF. NixOS' default
    # `checkReversePath` installs an iptables `-m rpfilter` DROP in the
    # mangle PREROUTING chain (`nixos-fw-rpfilter`). Cilium's eBPF datapath
    # delivers pod->host traffic on an asymmetric path that this rpfilter
    # marks as failing and DROPS *before conntrack* — so every pod->node
    # packet (pod->apiserver via the kubernetes ClusterIP, kubelet, etc.)
    # vanishes with no conntrack entry and no counter. Symptom: node goes
    # Ready, Cilium is healthy, pod->internet and pod->pod work, but CoreDNS
    # can't reach 10.43.0.1 -> in-cluster DNS dies -> every helm/app chart
    # CrashLoops on DNS. The sysctl `net.ipv4.conf.*.rp_filter` being loose
    # is NOT enough; the iptables rpfilter module is separate and must be
    # disabled. Confirmed on node-09485d (2026-06-07): inserting a RETURN for
    # the pod/service CIDR ahead of the rpfilter DROP immediately restored
    # pod->apiserver and the whole cluster recovered.
    # See Cilium docs: "rp_filter must be disabled".
    checkReversePath = false;
  };

  environment.variables = {
    KUBECONFIG = "/etc/rancher/k3s/k3s.yaml";
  };

  systemd.tmpfiles.rules = [
    "d /var/lib/rancher/k3s 0755 root root - -"
  ];
}
