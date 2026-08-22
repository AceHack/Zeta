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

    # ORDERING: what the mechanism actually does.
    #
    # This block replaces a comment that was wrong on its own mechanism. It
    # claimed alphabetical order was sufficient and that "ArgoCD comes LAST".
    # ArgoCD is applied SECOND. The correction is below, and it is checked --
    # nixos/tests/k3s-first-boot-apply-order-eval-test.nix pins the order this
    # roster produces, so this comment cannot drift back without going red.
    #
    # 1. NixOS writes each attribute as ONE FLAT FILE named `<attr>.yaml` in
    #    /var/lib/rancher/k3s/server/manifests. (nixpkgs
    #    nixos/modules/services/cluster/rancher/default.nix: `mkManifestTarget`
    #    appends ".yaml" unless the attr already ends .yaml/.yml/.json, and
    #    `target` defaults to it via mkDefault.) So the attribute name IS the
    #    filename, and no directory structure is possible here.
    #
    # 2. The k3s deploy controller submits those files in LEXICAL FILENAME
    #    order -- with the ".yaml" suffix included, which is why sorting the
    #    attribute names alone would give a different answer the moment two
    #    names share a prefix. Today that order is:
    #
    #      aa-gateway-api-crds -> argocd-install -> argocd-namespace ->
    #      cert-manager-install -> cilium-install -> cilium-namespace ->
    #      external-secrets-install -> local-path-provisioner (from
    #      local-storage.nix) -> openziti-namespace -> root-application ->
    #      spire-install -> trust-manager-install
    #
    # 3. SUBMISSION ORDER IS NOT DEPENDENCY ORDER, and no renaming can make it
    #    one. The deploy controller submits all eleven files within seconds of
    #    the API server starting; helm-controller then takes MINUTES per chart
    #    Job. So every chart in this roster is in flight simultaneously
    #    regardless of where its file sorts.
    #
    # 4. What survives that, and why:
    #      - `*-install` sorting BEFORE its own `*-namespace` (argocd, cilium)
    #        is harmless: both objects are submitted in the same pass, seconds
    #        apart, and the namespace exists long before the chart Job runs.
    #        `openziti-namespace` has no `openziti-install` sibling and is the
    #        same argument read the other way: it must precede the trust-manager
    #        CHART JOB (minutes later), not merely the trust-manager file.
    #      - cert-manager sorting before cilium is harmless for the same
    #        reason plus helm-controller retry: cert-manager pods stay Pending
    #        until Cilium supplies a CNI, then schedule.
    #      - Only `bootstrap: true` (cilium) tolerates the not-ready NoSchedule
    #        taint; everything else waits for the node to go Ready, which is
    #        the intended sequencing and needs no filename to express it.
    #
    # 5. What does NOT obviously survive it -- the one open question:
    #      `root-application.yaml` is an argoproj.io/v1alpha1 Application, and
    #      the CRD for that kind is created by the ArgoCD HELM CHART. The
    #      deploy controller submits root-application seconds into boot, into
    #      an API server that has never heard of the kind. helm-controller
    #      retries its charts; whether the DEPLOY controller retries an
    #      unknown-kind apply is NOT established anywhere in this repo.
    #      If it does not, the app-of-apps root never lands and a fresh
    #      cluster halts at the bootstrap charts with no catalog and no
    #      reconciler -- with every pod that did come up perfectly healthy.
    #      Renaming it `zz-root-application` would NOT fix this (see 3).
    #      nixos/tests/k3s-first-boot-roster.nix is the VM test that decides
    #      it, with three named verdicts instead of a timeout. UNRUN as of
    #      2026-08-21: it needs a KVM host, internet, and ~45-70 min.
    #
    # The DEPENDENCY INTENT below (per Aaron 2026-05-25) is retained because
    # it is the design, but note it is expressed in ArgoCD sync waves and in
    # helm-controller retry -- NOT in this roster's filenames:
    #   1. Cilium (CNI + KPR + Hubble + BPF MASQUERADE)
    #   2. cert-manager (TLS certs)
    #   3. Vault (NOT in this roster -- see the note below; ArgoCD owns it)
    #   4. SPIRE (self-signed CA today)
    #   5. Trust Manager (distributes SPIRE + cert-manager bundles)
    #   6. External Secrets Operator
    #   7. ArgoCD (reconciles everything else from k8s/applications/)
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
      # cert-manager (issues cluster TLS).
      cert-manager-install.source = ../../k8s/bootstrap/cert-manager-install.yaml;
      # Vault is DELIBERATELY ABSENT from this roster (2026-08-20, Dejan).
      #
      # It used to be here AND owned by k8s/applications/vault/Application.yaml,
      # which carries `selfHeal: true`. Both reconcilers owned Helm release
      # `vault` in namespace `vault`, and they DISAGREED on the storage backend:
      # this roster rendered `storage "file"` (ha.enabled=false, replicas=1),
      # the ArgoCD twin renders `storage "raft"` (ha.enabled=true, replicas=3).
      # Two selfHealing owners would have converted Vault between two storage
      # backends on a loop -- data loss on the cluster's secrets backend, every
      # reconcile. Measured by rendering both value sets at chart vault-0.29.1.
      #
      # ArgoCD is the single owner because Vault has NO pre-ArgoCD consumer:
      #   - spire-install.yaml has no `upstreamAuthority` key at all (grep: 0);
      #     the SPIRE server self-signs. The ArgoCD twin has the Vault block
      #     COMMENTED OUT.
      #   - external-secrets-install.yaml installs the operator + CRDs only; its
      #     ClusterSecretStore pointing at Vault is likewise commented out, so
      #     ESO has nothing to sync from and does not need Vault to come up.
      #   - argocd-install.yaml sources no secret from Vault.
      # ...and because Vault's own PVCs pin `storageClass: longhorn`, which is
      # installed by ArgoCD at sync-wave -15. Vault CANNOT bind storage before
      # ArgoCD runs, so bootstrap ownership could never have worked.
      # The ordering intent survives in ArgoCD's sync waves: cert-manager -70,
      # vault -60, spire -50, trust-manager -45, external-secrets -40.
      # SPIRE (workload identity; self-signed CA today).
      spire-install.source = ../../k8s/bootstrap/spire-install.yaml;
      # The OpenZiti namespace — needed BEFORE trust-manager, not before `oz`.
      # trust-manager's trust namespace is `openziti` (it is the only namespace
      # from which its Bundle sources can be read, and its Secrets Role is
      # created there), so its chart cannot install into a cluster where that
      # namespace is absent. Sorts before trust-manager-install.yaml, which is
      # what the apply-order eval test pins.
      openziti-namespace.source = ../../k8s/bootstrap/openziti-namespace.yaml;
      # Trust Manager (CA bundle distribution).
      trust-manager-install.source = ../../k8s/bootstrap/trust-manager-install.yaml;
      # External Secrets Operator (operator + CRDs; no store wired yet).
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
  # MULTI-NODE: the JOIN ITSELF IS NOT MISSING — k3s's agent-to-server join
  # is the join (Aaron 2026-08-13, closing the open question on PR #10493:
  # "k3s's join is the join, don't invent our own"). `k3s-agent.nix` already
  # carries `serverAddr` + `tokenFile`, the `--tls-san=control-plane` above
  # makes the API cert valid for that name, and `k3s-join-observer.nix` now
  # witnesses the result on serial. `nixos/tests/k3s-agent-join.nix` boots a
  # server and an agent on one virtual segment and proves the join lands.
  #
  # What IS still missing is NAME RESOLUTION on real hardware: a worker
  # resolving `control-plane` to the control-plane's LAN IP. mDNS is
  # unreliable here and NetBIOS/nss-wins broadcast resolution did not work
  # in testing (winbindd path). The robust path is to inject a
  # `control-plane <cp-ip>` /etc/hosts entry on each worker at install
  # time (zeta-install.sh) once worker provisioning lands. Tracked
  # separately; single-node bring-up does not depend on it, and the VM test
  # supplies the mapping explicitly rather than pretending it is solved.
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
