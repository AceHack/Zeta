# full-ai-cluster/nixos/modules/k3s-server.nix
#
# K3S control-plane configured for Cilium CNI takeover.
#
# K3S ships with flannel (CNI), kube-proxy, network-policy, servicelb,
# and traefik. Cilium replaces flannel + kube-proxy + network-policy.
# We disable all five so Cilium owns the network layer end-to-end.

{ config, pkgs, lib, ... }:

{
  imports = [
    # The module that DEFINES `zeta.k3sDatastorePreflight`, whose `enable` this
    # file sets near the bottom. Setting an option without importing its
    # definer makes this module evaluable ONLY through `common.nix` (which
    # imports both) and a hard evaluation error everywhere else — including
    # every NixOS VM test, all of which import the role module directly and by
    # design. Same discipline `k3s-agent.nix` already applies to
    # `k3s-join-observer.nix`: the file that owns an option's value owns its
    # import.
    ./k3s-datastore-preflight.nix

    # The module that DEFINES `zeta.k3sJoinIntentPreflight`, enabled below. Same
    # import discipline as its sibling: the file that owns an option's value owns
    # its import, so every VM test that imports this role module directly still
    # evaluates.
    ./k3s-join-intent-preflight.nix

    # The module that DEFINES `zeta.cluster.{podCidr,serviceCidr,…}`, which the
    # `--cluster-cidr` / `--service-cidr` flags below READ. Same rule as above,
    # in its other direction: a module that consumes an option must import the
    # module that defines it, or it can only be evaluated inside an aggregate
    # that happens to supply it.
    ./cluster-network.nix

    # WP9 (081M33STPKN087G0R0004B5CAK): the Docker Hub pull-through mirror.
    # Writes /etc/rancher/k3s/registries.yaml so this node's containerd tries
    # mirror.gcr.io before burning Docker Hub's 100-pull/6h anonymous quota on
    # the ~50 docker.io images the bootstrap roster + catalog pull at first
    # boot. Imported here AND on k3s-agent.nix — every node needs the mirror,
    # not just the control plane. See the module's own header for the
    # fallback-safety argument (a mirror miss/outage can never make a pull
    # fail that would otherwise succeed).
    ./k3s-registry-mirrors.nix

    # WP20 (081M34R7P99087G0R000H77GX9): drops k3s.service's After=/Wants=
    # network-online.target (root-cause work for run 35717757526: k3s.service
    # never reached active in 4201s on the real installed disk) and adds a
    # bounded ExecStartPre wait for an address in its place. See that
    # module's header for the full citation, the honest limit on what a VM
    # negative control could and could not validate, and why the drop and the
    # bounded wait are both needed. Imported here AND on k3s-agent.nix --
    # nixpkgs names the unit "k3s" on both roles.
    ./k3s-wait-for-address.nix

    # WP25 (081M38G8NGC087G0R001GEGEDK): root-cause work for run 35927439681
    # -- k3s.service stuck `activating` for 70+ minutes on the real installed
    # disk, retrying forever on zero-length agent cert/kubeconfig files left
    # by an unclean stop. Adds a bounded ExecStartPre that removes only
    # zero-length files under /var/lib/rancher/k3s/agent before k3s starts.
    # See that module's header for the full citation (rancher/dynamiclistener
    # LoadOrGenerateKeyFile) and for why server/tls and server/cred are
    # deliberately out of scope. Imported here AND on k3s-agent.nix -- a
    # server also runs its own embedded agent under this same path.
    ./k3s-agent-tls-self-heal.nix

    # Defines `zeta.k3sServer.etcdPeers` — the OPT-IN, source-scoped admission
    # of etcd 2379/2380 that multi-server HA needs and that the firewall comment
    # below has prescribed since it was written. Default empty: this host's
    # firewall is unchanged unless a host names its peers. Also refuses, at
    # evaluation, a JOINING server that nothing admits etcd traffic to
    # (081M10ZG61D087G0R001A70F0P). See the module header for the decision.
    ./k3s-etcd-peers.nix

    # 081M39CR74D087G0R002BEG2G4: a has-ever-bootstrapped sentinel + recovery
    # pair, server role only (a worker has no server/db). Recovers a
    # STILLBORN datastore -- one truncated by a power cut in the first ~20s
    # of first boot, before k3s ever wrote bootstrap data into it -- while
    # NEVER touching a datastore that has genuinely served, under any
    # circumstance. See that module's header for the full citation and the
    # one-way property this pair guarantees.
    ./k3s-datastore-bootstrap-recovery.nix
  ];

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
    #
    # SOVEREIGN BY DEFAULT, JOINING BY DECLARATION. `mkDefault true` stays: a
    # machine flashed with no join endpoint founds its own cluster, which is
    # right for the first node and for any standalone one. What used to be
    # missing is that a control plane could not be told to JOIN at all --
    # `injected-join-server.nix` guards itself to agents, so every machine built
    # from the `control-plane` config founded a second cluster whatever the
    # medium said. `modules/injected-server-join.nix` supplies the other branch
    # and overrides this to `false` when, and only when, the medium carried both
    # a join endpoint and a token.

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
      # re-declares it as `zeta-block-local` (the single default class; was
      # `zeta-local-path` until 2026-09-23) with
      # a fixed path; leaving k3s' built-in enabled creates a SECOND
      # StorageClass *also* marked default (`local-path (default)` AND
      # `zeta-local-path (default)`), which is an invalid/ambiguous config —
      # a class-less PVC then binds non-deterministically. Observed on
      # node-09485d (2026-06-07). Keep exactly one default.
      "--disable=local-storage"

      # Pod-count ceiling — kubelet's `--max-pods` default is 110, and it is a
      # COUNT limit independent of the CPU/memory budget work in
      # `full-ai-cluster/k8s/storage-profiles.json`: shrinking every request in
      # the tree would not schedule one more pod once the count ceiling is hit.
      #
      # MEASURED, NOT GUESSED. `src/Core.TypeScript/cluster/rendered-resource-requests.snapshot.json`
      # renders 147 pods across the 49 Applications the metal root
      # (`bootstrap/root-application.yaml`) applies. The steady-state floor —
      # what a fresh single-node sync actually leaves Running/Pending, not the
      # render's raw total — is measured in
      # `src/Core.TypeScript/cluster/single-node-readiness.ts`'s `findPodBudget`:
      # subtract the four manual-sync Applications (cdi, kubevirt, ollama, vllm —
      # `manual-sync-policy.ts`; never auto-applied) and every Job/CronJob pod
      # (terminal — the kubelet's max-pods admission counts only non-terminal
      # pods), add the k3s-bundled coredns + metrics-server + this file's own
      # local-path-provisioner (none of which any Application renders). That
      # floor is ~124 today, already inside the default 110 ceiling's failure
      # zone, and it only grows as Applications are added.
      #
      # 220 clears the default 110 by 2x and the measured ~124 by ~77%, while
      # staying under the 254 usable addresses Cilium's cluster-pool IPAM hands
      # this single node at the chart's default `clusterPoolIPv4MaskSize: 24`
      # (`k8s/applications/cilium/Application.yaml` / `k8s/bootstrap/cilium-install.yaml`,
      # both now set that key explicitly since this budget relies on it) — a
      # pod ceiling above the node's own address block would be a limit the
      # network could never actually let a pod reach. Not 250: that would leave
      # only 4 addresses of slack against the /24, which the node's own
      # cilium_host router IP and any hostNetwork pod already eats into.
      #
      # SET ON BOTH SERVER AND AGENT (`k3s-agent.nix` carries the identical
      # flag) — `--kubelet-arg` configures the LOCAL kubelet, so a control
      # plane that also schedules pods and a worker both need it; it is not one
      # of the networking flags k3s-agent.nix's own comment says are
      # server-only.
      "--kubelet-arg=max-pods=220"

      # ── NODE RESERVATIONS — Allocatable was Capacity, so nothing was held
      # ── back for the process that IS the control plane ────────────────────
      #
      # THE DEFECT. Until 2026-09-25 this file raised `max-pods` to 220 and set
      # no `kube-reserved`, no `system-reserved` and no eviction threshold. Both
      # default to empty, so Allocatable == Capacity: the scheduler was free to
      # hand out every millicore and every byte of the node to pods, reserving
      # nothing for the k3s server process — which on k3s is not a set of pods.
      # apiserver, scheduler, controller-manager and the kine/etcd datastore all
      # run INSIDE the `k3s.service` systemd unit, outside every pod cgroup, and
      # therefore outside everything the scheduler is accounting for.
      #
      # MEASURED, same dispatch as the ArgoCD requests fix (36097310492, WP11,
      # real installed disk). This is a SECOND and INDEPENDENT starvation, not
      # the pod-QoS one, and fixing only the pod side would have left it:
      #   - 7 of 100 unconverged ArgoCD rows read `failed to get server version`
      #   - the verdict's own apiserver probe failed on 17 of 59 samples
      # Both are the apiserver being intermittently unreachable on a node that
      # had promised its entire capacity to something else.
      #
      # `single-node-readiness.ts` has been printing the same sentence on every
      # run without anything acting on it: "That bound is the node's WHOLE
      # capacity: nothing is held back for the kubelet, the control plane,
      # kube-system or the OS."
      #
      # WHY ONE ABSOLUTE NUMBER IS DEFENSIBLE ON BOTH HARDWARE PROFILES, which
      # is the part that has to be argued rather than asserted. `kube-reserved`
      # takes an absolute quantity, not a fraction, so a number tuned for one
      # box normally mis-serves the other — too small to protect the big node,
      # or large enough to cripple the small one. It works here because of what
      # the reserved process actually scales with:
      #
      #   the k3s server's load tracks the CLUSTER (object count, watch streams,
      #   reconcile rate), NOT the NODE it runs on.
      #
      # The roster is the same roster on both: 49 Applications, ~145 rendered
      # pods, one node. So the apiserver has the same work to do on the 4-vCPU
      # WP11 guest as on a 16-core registered ClusterNode, and one absolute
      # reservation is the right shape for it. What differs is only what the
      # reservation COSTS, and that is stated below rather than left implied.
      #
      # WHAT EACH PROFILE PAYS
      #                                    4-vCPU/12288Mi guest    16-core/62942Mi node
      #   kube-reserved    500m / 1Gi            12.5% / 8.3%           3.1% / 1.6%
      #   system-reserved  250m / 512Mi           6.3% / 4.2%           1.6% / 0.8%
      #   eviction-hard            500Mi                / 4.1%                 / 0.8%
      #   total                                 18.8% / 16.6%           4.7% / 3.2%
      #
      # On the big node this is rounding error. On the guest it is real, and it
      # is the correct trade: 18.8% of the CPU withheld from pods is how the
      # apiserver stops being unreachable, and an apiserver that answers is
      # worth more than three more pods that cannot be scheduled through it.
      #
      # HONEST LIMIT, AND IT IS THE IMPORTANT LINE HERE. Without
      # `--kube-reserved-cgroup` these flags are ACCOUNTING, not ENFORCEMENT.
      # They shrink Allocatable so the scheduler stops over-committing the node;
      # they do NOT create a cgroup that guarantees the k3s process those shares
      # under contention. So this is a fix for OVER-SCHEDULING, and it reaches
      # CPU contention only indirectly, by admitting fewer competitors. The
      # enforcement form is deliberately not taken: it requires the cgroup to
      # exist and be correctly parented before the kubelet starts, and a
      # misconfigured `--kube-reserved-cgroup` makes the kubelet refuse to start
      # at all — which on a first-boot installer is an unrecoverable node rather
      # than a slow one.
      #
      # EVICTION THRESHOLD. k3s inherits the kubelet default
      # `memory.available<100Mi`, which on a node this size is below the noise
      # floor of a burst of image pulls: the kernel OOM killer fires before the
      # kubelet ever notices, and it picks its victim by oom_score rather than
      # by QoS or by what the cluster needs. 500Mi gives the kubelet room to
      # make that choice deliberately and in QoS order. The roster's declared
      # memory exceeds this guest's RAM at every rung, so eviction on a small
      # box is not a hypothetical, and which pod dies is the whole question.
      #
      # ALL FOUR SIGNALS ARE RESTATED, AND THAT IS NOT VERBOSITY — IT IS THE BUG
      # THIS FLAG INVITES. `--eviction-hard` REPLACES the kubelet's entire
      # default map rather than merging into it, so passing `memory.available`
      # alone would silently DELETE `imagefs.available<15%` and
      # `nodefs.inodesFree<5%`. On a node that pulls ~135 images on first boot,
      # dropping the imagefs threshold removes the trigger for image garbage
      # collection under disk pressure — a disk-exhaustion regression shipped as
      # a memory fix, invisible in the diff. The three non-memory values below
      # are the kubelet's own defaults, written out so they survive; only
      # `memory.available` is changed, 100Mi -> 500Mi.
      #
      # SET ON BOTH SERVER AND AGENT for the same reason `max-pods` is, with one
      # difference recorded in k3s-agent.nix: an agent runs no apiserver, so its
      # `kube-reserved` covers kubelet and containerd alone and is smaller.
      "--kubelet-arg=kube-reserved=cpu=500m,memory=1Gi"
      "--kubelet-arg=system-reserved=cpu=250m,memory=512Mi"
      "--kubelet-arg=eviction-hard=memory.available<500Mi,nodefs.available<10%,imagefs.available<15%,nodefs.inodesFree<5%"

      # Cluster CIDRs — DERIVED from the cluster's identity, not hardcoded.
      #
      # These used to read `10.42.0.0/16` / `10.43.0.0/16` as literals, which
      # meant every machine ever flashed from this tree claimed the same pod and
      # service space. That is harmless WITHIN one cluster (members share the
      # CIDRs by design) and fatal ACROSS clusters: Cilium ClusterMesh requires
      # disjoint pod/service CIDRs and distinct cluster ids, so two Zeta
      # clusters could never federate.
      #
      # `zeta.cluster.{podCidr,serviceCidr}` are a pure function of
      # `clusterName` in `full-ai-cluster/cluster-identity.json` — no allocator,
      # no registry, nothing to appoint (manifesto §1). The same derivation
      # exists in TypeScript and the two are byte-locked through
      # `nixos/tests/cluster-cidr-golden-vectors.json`. See
      # `modules/cluster-network.nix`, which also carries the assertions that
      # refuse to build a node whose Cilium manifests disagree with these values.
      "--cluster-cidr=${config.zeta.cluster.podCidr}"
      "--service-cidr=${config.zeta.cluster.serviceCidr}"
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
    #      external-secrets-install -> internal-secret-seeding ->
    #      local-path-provisioner (from local-storage.nix) ->
    #      openziti-namespace -> root-application -> spire-install ->
    #      trust-manager-install
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
    #      CORROBORATING MEASUREMENT (2026-09-22, WP1,
    #      src/Core.TypeScript/cluster/first-boot-replica.ts): a Docker
    #      container configured to match this file's extraFlags + roster
    #      (not the NixOS VM test above, which is still unrun) measured
    #      VERDICT A -- ROOT_LANDED. applications.argoproj.io/zeta-root
    #      appeared once the ArgoCD chart's Job completed and the CRD existed;
    #      the deploy controller retried the earlier unknown-kind apply and
    #      self-healed. Recorded as corroborating evidence, not a replacement
    #      for the VM test this comment names -- see workitem
    #      081M33QTNVD087G0R002632YDV.
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
      # INTERNAL secret seeding (WP14, 081M343EEP8087G0R000BAF6QF) -- mints
      # grafana-admin-credentials / ziti-admin-credentials /
      # opensearch-admin-credentials / forgejo-initial-admin / zeta-blob-store /
      # redis-auth ONLY IF ABSENT, so the catalog Applications that name these
      # Secrets by reference never hit CreateContainerConfigError on a fresh
      # metal/USB install. Self-contained (creates its own namespaces, including
      # a redundant `openziti` -- this file sorts BEFORE openziti-namespace.yaml
      # lexically, see internal-secret-seeding.yaml's own header). Sorts before
      # ArgoCD exists, which is the point: every consuming Application finds its
      # Secret already in place at sync time.
      internal-secret-seeding.source = ../../k8s/bootstrap/internal-secret-seeding.yaml;
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
  #
  # CONDITIONAL ON NOT JOINING, and the condition is load-bearing rather than
  # defensive. `control-plane -> 127.0.0.1` is true exactly when the API server
  # that name REFERS TO is this node — that is, when this node founds. On a node
  # `injected-server-join.nix` has pointed at somebody else's cluster, the same
  # entry makes the JOIN ENDPOINT resolve to the joiner itself, and a k3s server
  # that dials its own supervisor joins nothing and founds a second cluster.
  # That is precisely the defect `injected-server-join.nix` was written to
  # prevent, reintroduced one layer down in /etc/hosts.
  #
  # Not a theoretical ordering hazard — `nixos/tests/k3s-server-join.nix`
  # measured it on CI (run 33020639794): both entries land, `networking.hosts`
  # is emitted in attribute order of the ADDRESS, `"127.0.0.1"` sorts before
  # `"192.168.1.1"`, and glibc answers with the first match. The joiner resolved
  # `control-plane` to `127.0.0.1`. Repairing that by relying on entry order
  # would be a guess about glibc and about attrset iteration; deleting the entry
  # that is FALSE on this node is a statement about what the name means.
  #
  # `serverAddr == ""` is the whole predicate. It is nixpkgs' default, pinned as
  # such by the stub in `nixos/tests/k3s-server-join-eval-test.nix` (whose
  # founding scenario asserts exactly `""`), and on a role=server node it is
  # written by `injected-server-join.nix` and by nothing else.
  #
  # A JOINING control plane therefore gets no alias from this file, and that is
  # deliberate: whoever supplied the endpoint owns resolving it. The VM test
  # maps it to the founder explicitly; on hardware it is the same
  # `control-plane <cp-ip>` /etc/hosts injection the paragraph above already
  # names for workers. A joiner that cannot resolve its endpoint now fails
  # loudly against an unreachable name instead of silently founding a rival
  # cluster — the failure this tree would rather have.
  networking.hosts = lib.mkIf (config.services.k3s.serverAddr == "") {
    "127.0.0.1" = [ "control-plane" ];
  };

  networking.firewall = {
    allowedTCPPorts = [
      6443    # K3S API
      9345    # K3S supervisor/join
      10250   # kubelet
      4244    # Hubble server
      4245    # Hubble Relay
      8472    # legacy flannel/VXLAN (kept for safety)
      # etcd ports 2379/2380 intentionally NOT in this list: a flat
      # allowedTCPPorts entry would admit them from every address that
      # can reach the NIC. (Correction: embedded etcd does NOT bind only
      # 127.0.0.1 — once it has a node IP it listens on <node-ip>:2379
      # and :2380 too, which is how run 33035015161 saw the refusal
      # land in THIS firewall. The firewall is the guard, not the bind.)
      # For multi-server HA set `zeta.k3sServer.etcdPeers` (see
      # ./k3s-etcd-peers.nix): it admits both ports from the named
      # control-plane peers ONLY. Default empty = closed, as before.
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

  # k3s IGNORES --cluster-init / --server / --token-file when a datastore
  # already exists on disk (k3s docs, verbatim), so a declarative join is a
  # SILENT no-op on any re-flash that did not wipe. On a from-scratch flash
  # this unit finds nothing and passes; on a dirty disk it refuses, says why on
  # console and serial, and deletes nothing. `lib.mkDefault` so a host can
  # switch it off.
  zeta.k3sDatastorePreflight.enable = lib.mkDefault true;

  # THE SIBLING'S UNCOVERED CASE. `k3sDatastorePreflight` states its own
  # boundary -- "On a genuinely from-scratch flash that is fine" -- and a
  # from-scratch flash is exactly what an operator does to add a second machine.
  # This one compares the join intent on DISK against what evaluation actually
  # RESOLVED, so a rebuild that lost `/etc/zeta` (pure eval, a staging symlink
  # that did not land) cannot come up as a silent second sovereign cluster.
  # `role` is what makes the `clusterInit` half apply here and not to a worker.
  # `lib.mkDefault` so a host can switch it off.
  zeta.k3sJoinIntentPreflight.enable = lib.mkDefault true;
  zeta.k3sJoinIntentPreflight.role = lib.mkDefault "server";

  # WP20 root-cause fix: see ./k3s-wait-for-address.nix (imported above) for
  # the systemd.services.k3s.after/wants override, the ExecStartPre bounded
  # address wait, and the full citation + honest limits on validation.

  # WP25 root-cause fix: see ./k3s-agent-tls-self-heal.nix (imported above)
  # for the zero-length-file ExecStartPre, the dynamiclistener citation, and
  # why server/tls + server/cred are deliberately out of scope.
}
