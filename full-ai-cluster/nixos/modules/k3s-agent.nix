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

    # The module that DEFINES `zeta.k3sDatastorePreflight`, whose `enable` this
    # file sets below. Setting an option without importing its definer makes
    # this module evaluable ONLY through `common.nix` (which imports both) and
    # a hard evaluation error everywhere else — including every NixOS VM test,
    # all of which import the role module directly and by design. Imported here
    # for the same reason `k3s-join-observer.nix` is: this file owns the
    # option's value, so it owns the import.
    ./k3s-datastore-preflight.nix

    # The module that DEFINES `zeta.k3sJoinIntentPreflight`, enabled below.
    # Imported here for the same reason the two above are: this file owns the
    # option's value, so it owns the import.
    ./k3s-join-intent-preflight.nix

    # WP9 (081M33STPKN087G0R0004B5CAK): the Docker Hub pull-through mirror.
    # Imported here AND on k3s-server.nix — an agent pulls its own images
    # (kubelet, CNI, workload pods) independently of the control plane, and a
    # worker sharing the founder's home NAT is exactly the "second node
    # behind the same NAT" case that pushes first boot over Docker Hub's
    # 100-pull/6h anonymous quota. See k3s-registry-mirrors.nix's header.
    ./k3s-registry-mirrors.nix

    # WP20 (081M34R7P99087G0R000H77GX9): see that module's header. Imported
    # here AND on k3s-server.nix -- nixpkgs names the unit "k3s" on both
    # roles, so the ordering risk and the node-ip risk are identical.
    ./k3s-wait-for-address.nix

    # WP25 (081M38G8NGC087G0R001GEGEDK): see that module's header. Imported
    # here AND on k3s-server.nix -- an agent's own kubelet/agent certs live
    # under this SAME path on a server too (its embedded agent), so the
    # zero-length-file defect and the fix are identical on both roles.
    ./k3s-agent-tls-self-heal.nix
  ];

  # k3s's join is the join (Aaron 2026-08-13, closing PR #10493's open
  # question). Nothing below implements a join; the observer only reports
  # whether the k3s handshake configured in `services.k3s` succeeded, on the
  # console and on serial, so 081KSNY2Z0008QG0R0008PN7RQ scenario 5 has
  # something real to watch. `lib.mkDefault` so a host can switch it off.
  zeta.k3sJoinObserver.enable = lib.mkDefault true;

  # A worker normally has no `/var/lib/rancher/k3s/server/db/etcd` at all, so
  # this passes and changes nothing. It is enabled anyway because the case it
  # catches is precisely the one nobody expects: a box that was a control plane
  # once, re-flashed as a worker onto a disk whose server datastore survived.
  # k3s would then ignore the join arguments and resume being a server.
  zeta.k3sDatastorePreflight.enable = lib.mkDefault true;

  # A worker that was told to join and resolved to no `serverAddr` starts
  # nothing useful and reports nothing wrong. `role = "agent"` scopes the check
  # to `serverAddr` alone -- `clusterInit` is not an agent's field, and
  # convicting a worker for it would refuse every legitimate join.
  zeta.k3sJoinIntentPreflight.enable = lib.mkDefault true;
  zeta.k3sJoinIntentPreflight.role = lib.mkDefault "agent";

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

      # `--kubelet-arg` is NOT one of those server-only flags — it configures
      # THIS node's own kubelet, so it must be repeated here rather than
      # inherited. Same value and same reasoning as k3s-server.nix's copy:
      # the kubelet default `max-pods` (110) is a pod-COUNT ceiling a
      # single-node metal install's measured steady state (~124 pods, see
      # k3s-server.nix's comment) already exceeds, and 220 stays under the
      # 254-address /24 Cilium's cluster-pool IPAM hands each node.
      "--kubelet-arg=max-pods=220"

      # Node reservations — the agent's half, and DELIBERATELY SMALLER than the
      # server's. The long derivation lives on k3s-server.nix's copy and is not
      # repeated; what differs here is the only thing that should:
      #
      #   AN AGENT RUNS NO APISERVER. On k3s the apiserver, scheduler,
      #   controller-manager and kine all live inside `k3s.service` on the
      #   SERVER, so the server reserves for them. An agent's `k3s-agent.service`
      #   is kubelet plus containerd and nothing else, so 250m / 512Mi covers
      #   what is actually there rather than copying a number sized for a
      #   process this node does not run.
      #
      # Reserving the server's 500m/1Gi here would withhold half a core from
      # pods on every worker to protect a control plane that is not on it --
      # which is how a reservation becomes a tax. `system-reserved` and the
      # eviction threshold ARE the same on both: the OS and the kernel's OOM
      # behaviour do not care which k3s role the node holds.
      #
      # Same honest limit as the server copy: without `--kube-reserved-cgroup`
      # these are ACCOUNTING, not ENFORCEMENT -- they stop the scheduler
      # over-committing the node, and do not guarantee shares under contention.
      "--kubelet-arg=kube-reserved=cpu=250m,memory=512Mi"
      "--kubelet-arg=system-reserved=cpu=250m,memory=512Mi"
      "--kubelet-arg=eviction-hard=memory.available<500Mi,nodefs.available<10%,imagefs.available<15%,nodefs.inodesFree<5%"
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

  # WP20 root-cause fix: see ./k3s-wait-for-address.nix (imported above).
}
