# full-ai-cluster/nixos/tests/k3s-ha-longhorn-cluster.nix
#
# THREE CONTROL PLANES, ONE CLUSTER, REPLICATED STORAGE — AND LOSE ONE.
#
# WHY THIS EXISTS
# ---------------
# Every other VM test in this directory boots ONE node, or TWO with no CNI:
#
#   k3s-cluster-online      one server, Cilium, node Ready
#   longhorn-volume-binds   one server, Longhorn, defaultReplicaCount=1 — its own
#                           header: "replica placement across real nodes is not
#                           exercised"
#   k3s-agent-join          server + agent, hermetic, membership only
#   k3s-server-join         two servers, hermetic, membership + one CA only
#
# So nothing tested a CLUSTER: several nodes that are all Ready on the real CNI,
# storage whose replicas really live on different machines, and a node dying.
# The maintainer, 2026-09: "we don't have qemu testing cluster, we want to test
# clustering too." This is that test.
#
# WHAT IT ASSERTS, IN ORDER
# -------------------------
#   1. server1 FOUNDS (--cluster-init); server2 and server3 JOIN it as
#      role=server through the shipped `injected-server-join.nix`, one at a time
#      (etcd adds members serially). All three carry the etcd role label and the
#      SAME cluster CA — three members of one cluster, not three foundings.
#   2. All three nodes Ready on the real Cilium install (internet required).
#   3. Longhorn — the prod chart version and prod values, with ONE test-only
#      override: `defaultReplicaCount: 3` / `defaultClassReplicaCount: 3` — is up
#      on all three nodes, each of which registers its OWN emulated block device
#      (`emptyDiskImages`, one per node, mounted at /var/lib/longhorn-disk1).
#   4. A PVC binds; a pod PINNED TO server3 writes 32 MiB of random data and its
#      sha256; the volume is `healthy` with THREE replicas on THREE DISTINCT
#      nodes. Placement is asserted from Longhorn's own Replica CRs, not assumed
#      from the replica count setting.
#   5. server3 — which holds a replica AND is where the data was written — is
#      hard power-cut (`crash()`, not a clean shutdown).
#   6. The API survives on the two remaining members: /readyz answers on both,
#      and a WRITE (a ConfigMap) commits — etcd quorum 2/3, not merely a
#      read-only apiserver cache. server3 goes NotReady in the API's view.
#   7. A pod PINNED TO server1 mounts the same PVC and `sha256sum -c` passes:
#      the data survived losing a replica-holding node, and the volume is
#      reported `degraded` (two of three replicas), which is the evidence that
#      the read came from the surviving replicas rather than from a node that
#      never lost anything.
#
# THE ETCD FIREWALL IS THE PRODUCT'S, NOT THE HARNESS'S
# -----------------------------------------------------
# Every server sets `zeta.k3sServer.etcdPeers` — the shipped option in
# `modules/k3s-etcd-peers.nix` — to the three vlan /32s. The harness opens NO
# port of its own. That is the point of 081M10ZG61D087G0R001A70F0P: the
# two-server test used to open 2379/2380 itself, and so proved a join the
# product could not perform. A harness may not grant the system under test
# reachability the product does not grant.
#
# HARNESS-ONLY DIFFERENCES, EACH NAMED
# ------------------------------------
#   * `--node-ip=<vlan address>`. Every nixosTest guest also holds QEMU SLIRP's
#     10.0.2.15 on eth0 with the default route, so without the pin every server
#     advertises the SAME etcd peer URL (measured, run 33020639794). Real
#     hardware has no shared address; its multi-homed `--node-ip` question is
#     081M10ZG624087G0R003JW3K8E and is not decided here.
#   * `control-plane` -> server1 in /etc/hosts on the joiners. On hardware that
#     entry is `injected-cluster-address.nix`'s job; its inputs are eval-time
#     `/etc/zeta` files a nixosTest cannot supply (see k3s-server-join.nix).
#   * The joiners' k3s is held back (`wantedBy = [ ]`) so the script can join
#     them one at a time. The shipped unit starts at boot.
#   * `manifests` are narrowed to Cilium + Longhorn on the founder (the other
#     servers carry none; k3s applies a server's manifests cluster-wide).
#   * One disk per node (4 GiB) instead of the prod multi-NVMe layout;
#     `longhorn-volume-binds.nix` owns the multi-disk-per-node assertion.
#
# WHAT IT DOES NOT PROVE — stated so nobody reads it as broader
# ------------------------------------------------------------
#   * LOSING THE FOUNDER. Cilium's `k8sServiceHost: control-plane` resolves to
#     server1 on every joiner, so with server1 gone the surviving agents' API
#     endpoint is dead even though the apiservers on server2/server3 are fine.
#     That is a single point in the product's addressing, found while writing
#     this test (reasoned from config, not yet measured); it is NOT exercised
#     here (server3 is the node lost) and is recorded on 081M3812659087G0R001NP3WR6.
#   * RWX, snapshots, backups, rebuild of the third replica (only two nodes
#     remain, and Longhorn's default hard anti-affinity forbids two replicas on
#     one node — so the volume staying `degraded` is the CORRECT outcome).
#   * The USB installer path, `/etc/zeta` visibility at install time, real NICs.
#
# REQUIRES INTERNET (Cilium + Longhorn images on three nodes), so the sandbox
# must be off:
#
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-ha-longhorn-cluster -L --option sandbox false
#
# BUDGET: 3 guests x 4096 MiB = 12 GiB of guest RAM on a 16 GiB ubuntu-24.04
# hosted runner (public repo: 4 vCPU / 16 GiB). The CI step samples host memory
# while it runs and prints the peak, and every guest prints `free -m` at each
# phase, so the budget in the workflow comment is a measurement, not this guess.
#
# Per `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` this
# test asserts and fails; there is no skip path.

{ pkgs }:

let
  # Same eval-time fixtures `k3s-server-join.nix` drives the shipped join module
  # with, and for the same reason: context-free strings, because
  # `injected-server-join.nix` calls `builtins.pathExists` on them and
  # `nix flake check --no-build` realises no string context. See that file's
  # let-block for the two CI runs that measured it.
  joinServerUrlFile = toString ./fixtures/server-join/cluster-join-server-url;
  tokenPresenceMarker = toString ./fixtures/server-join/token-present-marker;

  # A fixed, public, TEST-ONLY k3s token. Not a credential: its blast radius is
  # three QEMU guests destroyed with the derivation.
  sharedClusterToken = "zeta-vm-test-ha-cluster-token-not-a-credential\n";
  runtimeTokenPath = "/etc/zeta/k3s-join-token";

  # The one place this test's Longhorn diverges from
  # k8s/applications/longhorn/Application.yaml, and why: prod is ONE node, so
  # prod replicates once. A replica count of 1 cannot exercise placement at all,
  # which is exactly the gap this test exists to close. Everything else — chart,
  # version, every other value — mirrors the prod Application; keep them in step.
  longhornReplicaCount = 3;

  serverNames = [ "server1" "server2" "server3" ];

  # Every server admits etcd 2379/2380 from all three vlan addresses — through
  # the PRODUCT option. Including a node's own address is harmless and keeps the
  # list one expression instead of three.
  etcdPeersOf = nodes: map (n: "${nodes.${n}.networking.primaryIPAddress}/32") serverNames;

  mkServer = { founder }: { lib, nodes, config, ... }: {
    imports =
      [
        ../modules/k3s-server.nix
        ../modules/longhorn-prereqs.nix
        ../modules/longhorn-disks.nix
      ]
      # The module under test for the join path, imported EXPLICITLY (same
      # reasoning as k3s-server-join.nix: the subject is a named file, not
      # whatever an aggregate happens to pull in).
      ++ lib.optional (!founder) ../modules/injected-server-join.nix;

    # `mkMerge`, not `//`: both halves set attributes under `services.k3s`, and a
    # shallow `//` would silently drop the first half's `extraFlags`/`tokenFile`.
    config = lib.mkMerge [ {
    # NAT internet via the QEMU user-mode NIC (eth0). The vlan (eth1) keeps its
    # static test-driver address: NixOS ignores DHCP on statically configured
    # interfaces.
    networking.useDHCP = lib.mkForce true;

    # See "HARNESS-ONLY DIFFERENCES". List-merge, not replace.
    services.k3s.extraFlags = lib.mkAfter [
      "--node-ip=${config.networking.primaryIPAddress}"
    ];

    # THE PRODUCT'S etcd peer admission. No `allowedTCPPorts` anywhere in this file.
    zeta.k3sServer.etcdPeers = etcdPeersOf nodes;

    # The shared cluster secret at the real production path. On the founder this
    # is a plain addition (k3s-server.nix sets no tokenFile); on a joiner
    # `mkOverride 10` beats injected-server-join.nix's `mkOverride 50` on this ONE
    # attribute, leaving its `clusterInit`/`serverAddr` decision untouched.
    environment.etc."zeta/k3s-join-token".text = sharedClusterToken;
    services.k3s.tokenFile =
      if founder then runtimeTokenPath else lib.mkOverride 10 runtimeTokenPath;

    # ONE emulated block device per node, formatted and mounted where Longhorn's
    # disk annotator (longhorn-disks.nix) registers it. `virtualisation.fileSystems`,
    # NOT `fileSystems` — the qemu-vm module drops the latter silently (measured in
    # longhorn-volume-binds.nix: Longhorn registered `disks: {}`).
    zeta.longhorn.dataDisks = [ "/var/lib/longhorn-disk1" ];
    virtualisation.emptyDiskImages = [ 4096 ];
    virtualisation.fileSystems."/var/lib/longhorn-disk1" = {
      device = "/dev/vdb";
      fsType = "ext4";
      autoFormat = true;
    };

    virtualisation.memorySize = 4096; # MiB — see BUDGET in the header
    virtualisation.cores = 2;
    virtualisation.diskSize = 12288; # MiB — images for Cilium + Longhorn per node
  } (if founder then {
    # Cilium (the CNI; nothing is Ready without it) + Longhorn as a HelmChart CR
    # mirroring k8s/applications/longhorn/Application.yaml. Only the founder
    # carries manifests; k3s applies them cluster-wide.
    services.k3s.manifests = lib.mkForce {
      cilium-namespace.source = ../../k8s/bootstrap/cilium-namespace.yaml;
      cilium-install.source = ../../k8s/bootstrap/cilium-install.yaml;

      longhorn-install.content = {
        apiVersion = "helm.cattle.io/v1";
        kind = "HelmChart";
        metadata = {
          name = "longhorn";
          namespace = "kube-system";
        };
        spec = {
          chart = "longhorn";
          repo = "https://charts.longhorn.io";
          # The version prod runs (k8s/applications/longhorn/Application.yaml).
          version = "1.12.1";
          targetNamespace = "longhorn-system";
          createNamespace = true;
          bootstrap = true; # tolerate the not-ready:NoSchedule taint
          valuesContent = ''
            preUpgradeChecker:
              jobEnabled: false
            defaultSettings:
              defaultDataPath: /var/lib/longhorn
              createDefaultDiskLabeledNodes: true
              defaultReplicaCount: ${toString longhornReplicaCount}
            persistence:
              defaultClass: false
              defaultClassReplicaCount: ${toString longhornReplicaCount}
              reclaimPolicy: Retain
            ingress:
              enabled: false
          '';
        };
      };
    };
  } else {
    services.k3s.manifests = lib.mkForce { };

    # Drive the shipped join module over the committed fixtures (see let-block).
    zeta.k3sServerJoin.joinServerUrlFile = joinServerUrlFile;
    zeta.k3sServerJoin.tokenFile = tokenPresenceMarker;

    # The fixture endpoint is `https://control-plane:6443`; resolve it to the
    # founder. k3s-server.nix emits no loopback alias on a joining server.
    networking.hosts."${nodes.server1.networking.primaryIPAddress}" = [ "control-plane" ];

    # Held back so the script joins members one at a time.
    systemd.services.k3s.wantedBy = lib.mkForce [ ];
  }) ];
  };
in

pkgs.testers.nixosTest {
  name = "k3s-ha-longhorn-cluster";

  nodes = {
    server1 = mkServer { founder = true; };
    server2 = mkServer { founder = false; };
    server3 = mkServer { founder = false; };
  };

  testScript = { nodes, ... }: ''
    import re
    import time

    T0 = time.monotonic()

    def phase(name):
        # Wall-clock per phase plus each LIVE guest's memory, into the build log.
        # This is what turns the header's RAM/time budget into a measurement.
        print(f"=== [{time.monotonic() - T0:7.0f}s] {name} ===")
        for m in live:
            print(m.name, m.succeed("free -m | awk '/Mem:/{print \"used=\"$3\"MiB total=\"$2\"MiB\"}'").strip())

    kc = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl"
    IPS = {
        "server1": "${nodes.server1.networking.primaryIPAddress}",
        "server2": "${nodes.server2.networking.primaryIPAddress}",
        "server3": "${nodes.server3.networking.primaryIPAddress}",
    }
    assert len(set(IPS.values())) == 3 and "10.0.2.15" not in IPS.values(), (
        f"the three servers do not have three distinct vlan addresses: {IPS!r}; "
        "--node-ip could not tell the etcd peers apart"
    )

    live = [server1, server2, server3]
    start_all()

    # ── 1. FOUND, then JOIN one member at a time ────────────────────────────
    server1.wait_for_unit("k3s.service", timeout=300)
    server1.wait_until_succeeds(f"{kc} get --raw='/readyz'", timeout=300)
    phase("founder API up")

    # The product firewall rule, read back: source-scoped, never flat.
    fw = server1.succeed("iptables -w -S nixos-fw")
    for peer in ("server2", "server3"):
        assert any(
            f"-s {IPS[peer]}/32" in l and "2379,2380" in l and "nixos-fw-accept" in l
            for l in fw.splitlines()
        ), f"server1 has no source-scoped etcd ACCEPT for {peer}:\n{fw}"
    assert "--dport 2379 " not in fw and "--dport 2380 " not in fw, (
        f"etcd ports are open as FLAT ports (any source) on server1:\n{fw}"
    )

    for joiner in (server2, server3):
        name = joiner.name
        resolved = joiner.succeed(
            "getent hosts control-plane | head -n1 | awk '{print $1}'"
        ).strip()
        assert resolved == IPS["server1"], (
            f"{name}: control-plane resolves to {resolved!r}, not the founder "
            f"{IPS['server1']!r}; a joiner dialling itself founds a second cluster"
        )
        joiner.succeed(f"timeout 5 bash -c 'echo >/dev/tcp/{IPS['server1']}/2379'")
        joiner.succeed(f"timeout 5 bash -c 'echo >/dev/tcp/{IPS['server1']}/2380'")
        joiner.systemctl("start k3s.service")
        joiner.wait_for_unit("k3s.service", timeout=600)
        server1.wait_until_succeeds(
            f"{kc} get node {name} -o jsonpath='{{.metadata.labels}}' "
            "| grep -q 'node-role.kubernetes.io/etcd'",
            timeout=600,
        )
        phase(f"{name} joined etcd")

    # Three etcd members, asked of the founder's API.
    etcd_members = server1.succeed(
        f"{kc} get nodes -l node-role.kubernetes.io/etcd=true "
        "-o jsonpath='{.items[*].metadata.name}'"
    ).split()
    assert sorted(etcd_members) == ["server1", "server2", "server3"], (
        f"expected three etcd members, got {etcd_members!r}"
    )

    # ONE cluster CA, not three: the discriminator node count cannot supply.
    cas = {
        m.name: m.succeed(
            "sha256sum /var/lib/rancher/k3s/server/tls/server-ca.crt | cut -d' ' -f1"
        ).strip()
        for m in live
    }
    assert all(len(v) == 64 for v in cas.values()), f"CA digests malformed: {cas!r}"
    assert len(set(cas.values())) == 1, f"SPLIT-BRAIN: servers hold different CAs {cas!r}"

    # ── 2. All three Ready on the real CNI ───────────────────────────────────
    server1.wait_until_succeeds(
        f"test $({kc} -n kube-system get pods -l k8s-app=cilium --no-headers 2>/dev/null "
        "| grep -c ' Running ') -eq 3",
        timeout=2400,
    )
    server1.wait_until_succeeds(
        f"{kc} wait --for=condition=Ready node --all --timeout=30s", timeout=1800
    )
    ready = server1.succeed(
        f"{kc} get nodes -o jsonpath='{{range .items[*]}}{{.metadata.name}}="
        "{.status.conditions[?(@.type==\"Ready\")].status} {end}'"
    ).split()
    assert sorted(ready) == ["server1=True", "server2=True", "server3=True"], (
        f"not all three nodes Ready: {ready!r}"
    )
    phase("three nodes Ready")

    # ── 3. Longhorn on all three, each with its own disk ─────────────────────
    server1.wait_until_succeeds(
        f"test \"$({kc} -n longhorn-system get ds longhorn-manager "
        "-o jsonpath='{.status.numberReady}' 2>/dev/null)\" = 3",
        timeout=2400,
    )
    for name in ("server1", "server2", "server3"):
        server1.wait_until_succeeds(
            f"{kc} -n longhorn-system get nodes.longhorn.io {name} "
            "-o jsonpath='{.spec.disks}' 2>/dev/null | grep -q longhorn-disk1",
            timeout=900,
        )
    for m in live:
        m.succeed("mountpoint -q /var/lib/longhorn-disk1")
    server1.wait_until_succeeds(f"{kc} get storageclass longhorn", timeout=900)
    sc_replicas = server1.succeed(
        f"{kc} get storageclass longhorn -o jsonpath='{{.parameters.numberOfReplicas}}'"
    ).strip()
    assert sc_replicas == "${toString longhornReplicaCount}", (
        f"StorageClass longhorn has numberOfReplicas={sc_replicas!r}; the test "
        "override did not reach the chart, so placement would not be exercised"
    )
    phase("longhorn up on three nodes")

    # ── 4. PVC binds; data written on server3; three replicas, three nodes ───
    server1.succeed(
        "cat >/tmp/pvc.yaml <<'EOF'\n"
        "apiVersion: v1\n"
        "kind: PersistentVolumeClaim\n"
        "metadata:\n"
        "  name: ha-proof\n"
        "spec:\n"
        "  accessModes: [ReadWriteOnce]\n"
        "  storageClassName: longhorn\n"
        "  resources:\n"
        "    requests:\n"
        "      storage: 1Gi\n"
        "EOF"
    )
    server1.succeed(f"{kc} apply -f /tmp/pvc.yaml")

    def pod_yaml(name, node, script):
        return (
            f"cat >/tmp/{name}.yaml <<'EOF'\n"
            "apiVersion: v1\n"
            "kind: Pod\n"
            "metadata:\n"
            f"  name: {name}\n"
            "spec:\n"
            f"  nodeName: {node}\n"
            "  restartPolicy: Never\n"
            "  terminationGracePeriodSeconds: 0\n"
            "  containers:\n"
            "    - name: c\n"
            "      image: busybox:1.36\n"
            f"      command: [sh, -c, '{script}']\n"
            "      volumeMounts:\n"
            "        - name: v\n"
            "          mountPath: /data\n"
            "  volumes:\n"
            "    - name: v\n"
            "      persistentVolumeClaim:\n"
            "        claimName: ha-proof\n"
            "EOF"
        )

    # The writer stays Running so the volume stays ATTACHED while replica
    # placement is read; it is deleted before the node is cut.
    server1.succeed(pod_yaml(
        "writer", "server3",
        "dd if=/dev/urandom of=/data/blob bs=1M count=32 2>/dev/null && "
        "cd /data && sha256sum blob > blob.sha256 && sync && "
        "echo WRITTEN $(cat blob.sha256) && sleep 3600",
    ))
    server1.succeed(f"{kc} apply -f /tmp/writer.yaml")
    server1.wait_until_succeeds(
        f"{kc} get pvc ha-proof --no-headers 2>/dev/null | grep -q ' Bound '", timeout=900
    )
    server1.wait_until_succeeds(f"{kc} logs writer 2>/dev/null | grep -q WRITTEN", timeout=900)
    written = server1.succeed(f"{kc} logs writer").strip()
    m = re.search(r"WRITTEN ([0-9a-f]{64})", written)
    assert m, f"writer did not report a sha256: {written!r}"
    digest = m.group(1)

    pv = server1.succeed(f"{kc} get pvc ha-proof -o jsonpath='{{.spec.volumeName}}'").strip()
    assert pv, "PVC ha-proof is Bound to no volume name"
    lhv = f"{kc} -n longhorn-system get volumes.longhorn.io {pv}"

    server1.wait_until_succeeds(
        f"test \"$({lhv} -o jsonpath='{{.status.robustness}}')\" = healthy", timeout=600
    )
    attached_to = server1.succeed(f"{lhv} -o jsonpath='{{.status.currentNodeID}}'").strip()
    assert attached_to == "server3", (
        f"volume {pv} is attached to {attached_to!r}, not server3 where the writer runs"
    )

    replicas = server1.succeed(
        f"{kc} -n longhorn-system get replicas.longhorn.io -l longhornvolume={pv} "
        "-o jsonpath='{range .items[*]}{.spec.nodeID}={.status.currentState} {end}'"
    ).split()
    placement = dict(r.split("=", 1) for r in replicas)
    assert len(replicas) == 3 and sorted(placement) == ["server1", "server2", "server3"], (
        f"expected 3 replicas on 3 DISTINCT nodes, got {replicas!r}"
    )
    assert set(placement.values()) == {"running"}, f"replicas not all running: {replicas!r}"
    print(f"replica placement: {replicas!r}; data sha256 {digest}")
    phase("volume healthy, 3 replicas on 3 nodes")

    # Detach before the cut, so the read below is not waiting on a
    # VolumeAttachment to a dead node (that is Kubernetes' non-graceful
    # shutdown path, a different test).
    server1.succeed(f"{kc} delete pod writer --wait=true --timeout=300s")
    server1.wait_until_succeeds(
        f"test \"$({lhv} -o jsonpath='{{.status.state}}')\" = detached", timeout=600
    )

    # ── 5. Hard power-cut the node holding a replica and the original write ──
    server3.crash()
    live = [server1, server2]
    phase("server3 crashed")

    # ── 6. The API survives on the remaining quorum — reads AND writes ───────
    for m in live:
        m.wait_until_succeeds(f"{kc} get --raw='/readyz'", timeout=300)
    # A write must COMMIT through etcd (2 of 3), not just be served from cache.
    server2.wait_until_succeeds(
        f"{kc} create configmap ha-quorum-write --from-literal=after=server3-loss",
        timeout=300,
    )
    got = server1.succeed(
        f"{kc} get configmap ha-quorum-write -o jsonpath='{{.data.after}}'"
    ).strip()
    assert got == "server3-loss", f"write via server2 not visible via server1: {got!r}"
    server1.wait_until_succeeds(
        f"test \"$({kc} get node server3 "
        "-o jsonpath='{.status.conditions[?(@.type==\"Ready\")].status}')\" != True",
        timeout=600,
    )
    phase("API + quorum writes survive the loss")

    # ── 7. The data is readable on a surviving node ──────────────────────────
    # The reader stays Running after the check so the volume is still ATTACHED
    # when its robustness is read: a detached Longhorn volume reports `unknown`,
    # which would make the `degraded` assertion unanswerable.
    server1.succeed(pod_yaml(
        "reader", "server1",
        "cd /data && sha256sum -c blob.sha256; echo RC=$? READ $(cat blob.sha256); sleep 3600",
    ))
    server1.succeed(f"{kc} apply -f /tmp/reader.yaml")
    server1.wait_until_succeeds(f"{kc} logs reader 2>/dev/null | grep -q 'RC='", timeout=1500)
    out = server1.succeed(f"{kc} logs reader").strip()
    assert "blob: OK" in out and "RC=0" in out and f"READ {digest}" in out, (
        f"data written on server3 did not read back intact on server1 after "
        f"server3 was lost; expected sha256 {digest}, got: {out!r}"
    )
    reader_node = server1.succeed(f"{lhv} -o jsonpath='{{.status.currentNodeID}}'").strip()
    assert reader_node == "server1", f"volume attached to {reader_node!r}, not server1"
    # `degraded` = attached with fewer healthy replicas than requested. It is
    # the evidence that the read came from a volume that really lost a replica.
    server1.wait_until_succeeds(
        f"test \"$({lhv} -o jsonpath='{{.status.robustness}}')\" = degraded", timeout=300
    )
    phase("data intact on survivor, volume degraded")

    # Post-mortem surface into the build log.
    print(server1.succeed(f"{kc} get nodes -o wide || true"))
    print(server1.succeed(f"{kc} -n longhorn-system get replicas.longhorn.io -o wide || true"))
    print(server1.succeed(f"{kc} get pvc,pv || true"))
  '';
}
