# full-ai-cluster/nixos/tests/k3s-multinode-ha-agents.nix
#
# THE MULTI-NODE LANE FOR HA CHARTS: one k3s server, two k3s AGENTS, and lose
# an agent. Workitem 081M48Z020C087G0R001E6M83V.
#
# WHY THIS EXISTS NEXT TO k3s-ha-longhorn-cluster.nix
# ----------------------------------------------------
# That test asks a CONTROL-PLANE question (three etcd members, lose one, quorum
# survives) and has never passed on a hosted 4-vCPU / 16 GiB runner: runs
# 35920509908, 35926193063 and 35930213010 died of etcd fsync latency and then,
# with etcd on tmpfs, of CPU starvation (12 k3s exits on `leaderelection lost`).
# Three apiservers + three etcds do not fit four vCPUs, and loosening the
# election timers would hide that rather than fix it. It stays as written, for
# the runner size it needs (8+ vCPU — a budget decision, not this file's).
#
# The question THIS file asks is the WORKLOAD question, and it needs no second
# control plane: do the charts whose correctness needs more than one node
# actually get it when there is more than one node? An agent runs kubelet +
# containerd and no apiserver/etcd, so two agents cost a fraction of two
# servers and the one leader election in the cluster is not contended.
#
# "HA charts" is not a list kept here. It is DERIVED: every Application whose
# manifests claim replicas > 1 at nodeCount = 1 (the single-node readiness
# auditor's `extractReplicaClaims`) plus every entry of
# `single-node-budget.json` `acknowledgedFalseRedundancy`. `multinode-ha-coverage.json`
# beside this file assigns each of them to COVERED (asserted below, by phase
# name) or NOT COVERED (with the reason), and
# `src/Core.TypeScript/cluster/multinode-ha-lane-coverage.test.ts` fails when a
# new HA chart appears that is in neither — so the gap is stated, never silent.
#
# WHAT IT ASSERTS, IN ORDER
# -------------------------
#   1. server1 founds; agent1 and agent2 join as role=agent through the SHIPPED
#      `k3s-agent.nix` (k3s's join is the join). Three nodes Ready on the real
#      product Cilium (native routing + WireGuard node encryption).
#   2. Longhorn — DERIVED from k8s/applications/longhorn/Application.yaml at
#      build time, every prod value, NO override — runs on all three nodes and
#      each node registers its OWN data disk through the shipped
#      `longhorn-disks.nix` annotator. On an agent that annotator is the code
#      path no other test has ever run.
#   3. The product's `zeta-block-replicated` StorageClass (from
#      `local-storage.nix`, verbatim) is present and its numberOfReplicas is
#      READ BACK and printed. Its comment says "replicated as far as the node
#      count allows ... raise it as nodes join"; nothing raises it, so the
#      lane also creates `zeta-block-replicated-3` — the SAME class with ONE
#      derived change, numberOfReplicas "3" — and that is the class the
#      replication claim is made on.
#   4. postgres-shared — DERIVED from k8s/applications/postgres-shared/cluster.yaml
#      at the METAL rung (instances: 3, enablePDB, preferred anti-affinity,
#      storageClass zeta-block-replicated), operator from
#      k8s/applications/cloudnativepg/Application.yaml — comes up with its three
#      instances on THREE DISTINCT nodes, two replicas STREAMING, and a PDB.
#      This is the chart `acknowledgedFalseRedundancy` says is "pod-resilient,
#      NOT node-resilient" on one node; here it gets the nodes.
#   5. The CNPG primary is moved to agent1 (a switchover, if the operator did
#      not put it there) and a row is written through it and seen on a replica.
#      A pod pinned to agent1 writes 32 MiB + sha256 to a zeta-block-replicated-3
#      volume; the volume is `healthy` with 3 replicas on 3 DISTINCT nodes, read
#      from Longhorn's own Replica CRs.
#   6. agent1 — holding the Postgres PRIMARY, one Longhorn replica, and the
#      original write — is hard power-cut (`crash()`).
#   7. CNPG FAILS OVER to a surviving instance, the pre-crash row is there, and
#      a NEW write commits through the new primary. A pod pinned to agent2
#      reads the 32 MiB back with `sha256sum -c` passing and the volume
#      `degraded` (two of three replicas) — the read came from survivors.
#
# WHAT IT DOES NOT PROVE — stated so nobody reads it as broader
# ------------------------------------------------------------
#   * CONTROL-PLANE HA. One server; losing it is losing the cluster. That claim
#     is k3s-ha-longhorn-cluster.nix's, and it is unproven on hosted runners.
#   * The other HA charts in multinode-ha-coverage.json `notCovered` — each
#     with its reason.
#   * CNPG backup / WAL archiving: `spec.plugins` (Barman Cloud -> SeaweedFS) is
#     the one field removed from the derived Cluster, plus the size (20Gi ->
#     1Gi: the emulated data disks are 6 GiB). Both are named in the
#     derivation below.
#   * Rebuild of the lost replica (two nodes left, Longhorn's default hard
#     replica anti-affinity forbids doubling up — `degraded` is the CORRECT
#     end state), RWX, the USB installer path, real NICs, `injected-join-server.nix`
#     (the agents use k3s-agent.nix's default endpoint + an /etc/hosts entry).
#
# HARNESS-ONLY DIFFERENCES, EACH NAMED
# ------------------------------------
#   * `--node-ip=<vlan address>` on every node: each nixosTest guest also holds
#     QEMU SLIRP's 10.0.2.15 (measured on the HA sibling, run 33020639794).
#   * `control-plane` -> server1 in /etc/hosts on the agents (on hardware,
#     injected-cluster-address.nix's job; it reads eval-time /etc/zeta files a
#     nixosTest cannot supply).
#   * The join token is the PRODUCT flow: the founder generates it (no
#     tokenFile, k3s-server.nix), the script copies node-token into the agent's
#     default `/var/lib/rancher/k3s/agent/token` — what an operator does today.
#   * Agents' k3s held back (`wantedBy = [ ]`) so they join a server that exists;
#     the shipped unit starts at boot and retries.
#   * Server manifests narrowed to Cilium, Longhorn, the CNPG operator, the
#     product storage classes and the derived 3-replica class.
#   * /var/lib/rancher on its own cache=unsafe emulated disk on every node, and
#     the SERVER's etcd db on tmpfs — the two disk fixes the HA sibling measured
#     (runs 35920509908, 35926193063). The server is never crashed, so tmpfs
#     loses nothing this test reads. NO k3s/etcd timeout is changed anywhere.
#
# REQUIRES INTERNET, so the sandbox must be off:
#
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-multinode-ha-agents -L --option sandbox false
#
# BUDGET: server 3584 MiB / 2 vCPU, agents 3072 MiB / 2 vCPU each, on a
# 16 GiB / 4 vCPU ubuntu-24.04 hosted runner. The CI job samples host memory and
# prints the peak; every phase prints each live guest's `free -m` and load.
#
# MEASURED (all on hosted ubuntu-24.04, 4 vCPU / 15988 MiB, KVM):
#   run 37493039430  WITHOUT the longhorn-disks.nix agent fix: agents' disk
#                    annotator exited 1 ("connection to the server
#                    localhost:8080 was refused" -- no admin kubeconfig on an
#                    agent), no Longhorn disk on either agent, lane timed out
#                    at that wait (900 s). Host RAM peak 12130 MiB, load 4.95.
#   run 37493221268  with the fix: disks on all 3 nodes at 429 s; failed later
#                    on a harness read (streaming count read once).
#   run 37497254337  failed on a harness bug (nodeName + WaitForFirstConsumer).
#   run 37501573722  GREEN in 1161 s. API 53 s, agents joined 68/83 s, 3 Ready
#                    on Cilium 148 s, Longhorn disks on 3 nodes 341 s, Postgres
#                    3/3 nodes + primary on agent1 908 s, Longhorn 3 replicas
#                    on 3 nodes 1001 s, agent1 crashed 1019 s, CNPG failed over
#                    to server1 + both writes read 1093 s, 32 MiB read back on
#                    agent2 (degraded) 1116 s. Host RAM peak 12222 / 15988 MiB,
#                    host load peak 7.13 on 4 vCPUs; server guest load peaked
#                    ~31 (I/O wait included). One k3s PID for the whole run,
#                    zero `leaderelection lost`, worst etcd apply 1.6 s.
#
# AND WHAT THOSE RUNS SAID ABOUT THE PRODUCT, not the harness: the product
# `zeta-block-replicated` class is numberOfReplicas "1" on a 3-node cluster,
# and with dataLocality "disabled" Longhorn placed a Postgres instance's only
# replica on a DIFFERENT node in two of three runs (37493221268:
# postgres-shared-2 on server1 -> replica on agent1; 37497254337: all three
# off-node). Losing one node can therefore take a SURVIVING instance's disk too.
# The green run happened to place all three locally. Whether to raise the
# class's replica count or set dataLocality is a product decision this lane
# measures and does not make.
#
# Per `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` this
# test asserts and fails; there is no skip path.

{ pkgs }:

let
  lib = pkgs.lib;
  yq = "${pkgs.yq-go}/bin/yq";

  # ── DERIVED, NOT TRANSCRIBED ───────────────────────────────────────────────
  # The HA sibling hand-copies Longhorn's values, and the copy has already
  # drifted (prod has `guaranteedInstanceManagerCPU`; the copy does not). Here
  # every chart and the Cluster are produced FROM the shipped files at build
  # time, so a prod values change reaches this lane with no edit to it.
  appToHelmChart = { name, app, bootstrap }: pkgs.runCommand "${name}-helmchart.yaml" { } ''
    ${yq} eval '
      select(.kind == "Application") | {
        "apiVersion": "helm.cattle.io/v1",
        "kind": "HelmChart",
        "metadata": {"name": .spec.source.helm.releaseName, "namespace": "kube-system"},
        "spec": {
          "chart": .spec.source.chart,
          "repo": .spec.source.repoURL,
          "version": .spec.source.targetRevision,
          "targetNamespace": .spec.destination.namespace,
          "createNamespace": true,
          "bootstrap": ${lib.boolToString bootstrap},
          "valuesContent": (.spec.source.helm.valuesObject | to_yaml)
        }
      }' ${app} > $out
    # A derivation that silently emitted an empty chart would install nothing.
    ${yq} -e '.spec.chart != null and .spec.version != null and .spec.valuesContent != null' $out >/dev/null
  '';

  longhornHelmChart = appToHelmChart {
    name = "longhorn";
    app = ../../k8s/applications/longhorn/Application.yaml;
    bootstrap = true; # tolerate the not-ready taint, as the HA sibling does
  };
  cnpgHelmChart = appToHelmChart {
    name = "cloudnativepg";
    app = ../../k8s/applications/cloudnativepg/Application.yaml;
    bootstrap = false;
  };

  # The product's storage manifest, VERBATIM: the exact text local-storage.nix
  # hands k3s on a real node (zeta-block-local, zeta-block-replicated,
  # zeta-shared, local-path-provisioner). The module uses neither `config` nor
  # anything host-specific to build it.
  productStorageManifest =
    (import ../modules/local-storage.nix { inherit pkgs lib; config = { }; })
    .services.k3s.manifests.local-path-provisioner.source;

  # ONE derived change: numberOfReplicas "3". Everything else (provisioner,
  # binding mode, staleReplicaTimeout, dataLocality) is the product class's.
  replicated3Class = pkgs.runCommand "zeta-block-replicated-3.yaml" { } ''
    ${yq} eval '
      select(.kind == "StorageClass" and .metadata.name == "zeta-block-replicated")
      | .metadata.name = "zeta-block-replicated-3"
      | .metadata.annotations."zeta.io/test-derived-from" = "zeta-block-replicated"
      | .parameters.numberOfReplicas = "3"' ${productStorageManifest} > $out
    ${yq} -e '.provisioner == "driver.longhorn.io" and .parameters.numberOfReplicas == "3"' $out >/dev/null
  '';

  # postgres-shared at the METAL rung, from the shipped file. Two named
  # removals: the Barman plugin (needs cnpg-barman-cloud + SeaweedFS, out of
  # scope) and 20Gi -> 1Gi (6 GiB emulated disks). The `-e` guard FAILS THE
  # BUILD if the HA shape this lane exists to test is no longer what ships.
  postgresSharedCluster = pkgs.runCommand "postgres-shared-cluster.yaml" { } ''
    ${yq} eval 'del(.spec.plugins) | .spec.storage.size = "1Gi"' \
      ${../../k8s/applications/postgres-shared/cluster.yaml} > $out
    ${yq} -e '
      .kind == "Cluster" and .spec.instances == 3 and .spec.enablePDB == true
      and .spec.affinity.podAntiAffinityType == "preferred"
      and .spec.storage.storageClass == "zeta-block-replicated"' $out >/dev/null || {
      echo "postgres-shared/cluster.yaml no longer ships the 3-instance HA shape this lane tests" >&2
      exit 1
    }
  '';

  # ── common to all three nodes ──────────────────────────────────────────────
  mkNode = { memory }: { lib, config, ... }: {
    imports = [
      ../modules/longhorn-prereqs.nix
      ../modules/longhorn-disks.nix
    ];

    # NAT internet via QEMU user-mode eth0; eth1 keeps its static vlan address.
    networking.useDHCP = lib.mkForce true;

    services.k3s.extraFlags = lib.mkAfter [
      "--node-ip=${config.networking.primaryIPAddress}"
    ];

    zeta.longhorn.dataDisks = [ "/var/lib/longhorn-disk1" ];

    # vdb: Longhorn's data disk. vdc: /var/lib/rancher (containerd images,
    # and etcd on the server). Both cache=unsafe — the host page cache still
    # holds every write, so a GUEST crash() loses nothing.
    virtualisation.emptyDiskImages = [
      { size = 6144; driveConfig.driveExtraOpts.cache = "unsafe"; }
      { size = 10240; driveConfig.driveExtraOpts.cache = "unsafe"; }
    ];
    virtualisation.fileSystems."/var/lib/longhorn-disk1" = {
      device = "/dev/vdb";
      fsType = "ext4";
      autoFormat = true;
    };
    virtualisation.fileSystems."/var/lib/rancher" = {
      device = "/dev/vdc";
      fsType = "ext4";
      autoFormat = true;
    };

    virtualisation.memorySize = memory; # MiB
    virtualisation.cores = 2;
    virtualisation.diskSize = 4096; # MiB
  };

  server = { lib, config, ... }: {
    imports = [ (mkNode { memory = 3584; }) ../modules/k3s-server.nix ];

    # See "HARNESS-ONLY DIFFERENCES": the founder is never crashed.
    virtualisation.fileSystems."/var/lib/rancher/k3s/server/db" = {
      device = "tmpfs";
      fsType = "tmpfs";
      options = [ "size=1g" "mode=0700" ];
    };

    services.k3s.manifests = lib.mkForce {
      cilium-namespace.source = ../../k8s/bootstrap/cilium-namespace.yaml;
      cilium-install.source = ../../k8s/bootstrap/cilium-install.yaml;
      longhorn-install.source = longhornHelmChart;
      cloudnativepg-install.source = cnpgHelmChart;
      local-path-provisioner.source = productStorageManifest;
      zeta-block-replicated-3.source = replicated3Class;
    };

    environment.etc."zeta-test/postgres-shared-cluster.yaml".source = postgresSharedCluster;
  };

  agent = { lib, nodes, ... }: {
    imports = [ (mkNode { memory = 3072; }) ../modules/k3s-agent.nix ];

    networking.hosts."${nodes.server1.networking.primaryIPAddress}" = [ "control-plane" ];

    # Held back until the server exists (see header). The annotator `wants`
    # k3s.service, so it is held too or it would pull k3s up at boot; the
    # observer is not under test here (k3s-agent-join.nix owns it).
    systemd.services.k3s.wantedBy = lib.mkForce [ ];
    systemd.services.zeta-longhorn-node-disks.wantedBy = lib.mkForce [ ];
    systemd.services.zeta-k3s-join-observer.wantedBy = lib.mkForce [ ];
  };
in

pkgs.testers.nixosTest {
  name = "k3s-multinode-ha-agents";

  nodes = {
    server1 = server;
    agent1 = agent;
    agent2 = agent;
  };

  testScript = { nodes, ... }: ''
    import re
    import time

    T0 = time.monotonic()
    kc = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl"
    pg = f"{kc} -n postgres-shared"

    def phase(name):
        # Wall-clock per phase plus each LIVE guest's memory and load, so the
        # budget in the header is a measurement in every build log.
        print(f"=== [{time.monotonic() - T0:7.0f}s] {name} ===")
        for m in live:
            print(m.name, m.succeed(
                "free -m | awk '/Mem:/{printf \"used=%sMiB total=%sMiB \", $3, $2}'; "
                "cut -d' ' -f1-3 /proc/loadavg"
            ).strip())

    def dump():
        for d in (
            f"{kc} get nodes -o wide",
            f"{kc} get pods -A -o wide",
            f"{kc} get pvc,pv,volumeattachments -A",
            f"{kc} get events -A --sort-by=.lastTimestamp | tail -n 80",
            f"{kc} -n longhorn-system get nodes.longhorn.io,volumes.longhorn.io,replicas.longhorn.io -o wide",
            f"{pg} get clusters.postgresql.cnpg.io -o yaml",
            f"{kc} -n cnpg-system logs -l app.kubernetes.io/name=cloudnative-pg --tail=60",
            "journalctl -u k3s --no-pager | grep -iE 'leaderelection|took too long|slow fdatasync' | tail -n 20",
        ):
            print(server1.succeed(f"{d} 2>&1 || true"))

    def wait(cmd, timeout, machine=None):
        # A bare timeout says nothing about WHY; dump the cluster first.
        try:
            (machine or server1).wait_until_succeeds(cmd, timeout=timeout)
        except Exception:
            dump()
            raise

    def psql(pod, sql):
        return server1.succeed(
            f"{pg} exec {pod} -c postgres -- psql -d app -tAc \"{sql}\""
        ).strip()

    IPS = {
        "server1": "${nodes.server1.networking.primaryIPAddress}",
        "agent1": "${nodes.agent1.networking.primaryIPAddress}",
        "agent2": "${nodes.agent2.networking.primaryIPAddress}",
    }
    assert len(set(IPS.values())) == 3 and "10.0.2.15" not in IPS.values(), IPS

    live = [server1, agent1, agent2]
    start_all()

    # ── 1. Found, then join two AGENTS ──────────────────────────────────────
    server1.wait_for_unit("k3s.service", timeout=300)
    wait(f"{kc} get --raw='/readyz'", 300)
    phase("server API up")

    server1.wait_for_file("/var/lib/rancher/k3s/server/node-token", timeout=180)
    node_token = server1.succeed("cat /var/lib/rancher/k3s/server/node-token").strip()
    assert node_token, "server generated no node-token"

    for a in (agent1, agent2):
        a.succeed(
            "install -d -m 0700 /var/lib/rancher/k3s/agent && "
            "install -m 0600 /dev/null /var/lib/rancher/k3s/agent/token && "
            f"printf '%s' '{node_token}' > /var/lib/rancher/k3s/agent/token"
        )
        resolved = a.succeed("getent hosts control-plane | head -n1 | awk '{print $1}'").strip()
        assert resolved == IPS["server1"], f"{a.name}: control-plane -> {resolved!r}"
        a.fail("systemctl is-active --quiet k3s.service")
        a.systemctl("start k3s.service")
        a.wait_for_unit("k3s.service", timeout=600)
        a.systemctl("start zeta-longhorn-node-disks.service")
        wait(f"{kc} get node {a.name} -o name", 600)
        phase(f"{a.name} joined")

    roles = server1.succeed(
        f"{kc} get nodes -o jsonpath='{{range .items[*]}}{{.metadata.name}}="
        "{.metadata.labels.zeta\\.io/role} {end}'"
    ).split()
    print(f"node roles: {roles!r}")
    assert "agent1=worker" in roles and "agent2=worker" in roles, (
        f"agents did not join as k3s-agent.nix workers: {roles!r}"
    )
    etcd = server1.succeed(
        f"{kc} get nodes -l node-role.kubernetes.io/etcd=true -o jsonpath='{{.items[*].metadata.name}}'"
    ).split()
    assert etcd == ["server1"], f"expected ONE etcd member (server1), got {etcd!r}"

    wait(
        f"test $({kc} -n kube-system get pods -l k8s-app=cilium --no-headers 2>/dev/null "
        "| grep -c ' Running ') -eq 3",
        2400,
    )
    wait(f"{kc} wait --for=condition=Ready node --all --timeout=30s", 1800)
    phase("three nodes Ready on Cilium")

    # ── 2. Longhorn on all three, each with its OWN disk ─────────────────────
    wait(
        f"test \"$({kc} -n longhorn-system get ds longhorn-manager "
        "-o jsonpath='{.status.numberReady}' 2>/dev/null)\" = 3",
        2400,
    )
    for name in ("server1", "agent1", "agent2"):
        # On an agent this is the annotator's agent code path, first run here.
        wait(
            f"{kc} -n longhorn-system get nodes.longhorn.io {name} "
            "-o jsonpath='{.spec.disks}' 2>/dev/null | grep -q longhorn-disk1",
            900,
        )
    phase("longhorn up, three disks registered")

    # ── 3. The product class, read back; the 3-replica derivation present ────
    wait(f"{kc} get storageclass zeta-block-replicated zeta-block-replicated-3", 300)
    product_replicas = server1.succeed(
        f"{kc} get storageclass zeta-block-replicated -o jsonpath='{{.parameters.numberOfReplicas}}'"
    ).strip()
    print(f"MEASURED: product zeta-block-replicated numberOfReplicas={product_replicas!r} on a 3-node cluster")
    assert server1.succeed(
        f"{kc} get storageclass zeta-block-replicated-3 -o jsonpath='{{.parameters.numberOfReplicas}}'"
    ).strip() == "3"

    # ── 4. postgres-shared, metal rung: 3 instances, 3 nodes, 2 streaming ────
    wait(
        f"{kc} -n cnpg-system get deploy -l app.kubernetes.io/name=cloudnative-pg "
        "-o jsonpath='{.items[0].status.availableReplicas}' | grep -qx 1",
        1500,
    )
    server1.succeed(f"{kc} create namespace postgres-shared")
    # Retried: the CNPG admission webhook answers a little after the Deployment
    # reports Available.
    wait(f"{kc} apply -f /etc/zeta-test/postgres-shared-cluster.yaml", 600)
    wait(
        f"test \"$({pg} get clusters.postgresql.cnpg.io postgres-shared "
        "-o jsonpath='{.status.readyInstances}')\" = 3",
        2400,
    )
    placement = dict(
        kv.split("=", 1)
        for kv in server1.succeed(
            f"{pg} get pods -l cnpg.io/cluster=postgres-shared,cnpg.io/podRole=instance "
            "-o jsonpath='{range .items[*]}{.metadata.name}={.spec.nodeName} {end}'"
        ).split()
    )
    print(f"postgres-shared instance placement: {placement!r}")
    assert len(placement) == 3 and sorted(placement.values()) == ["agent1", "agent2", "server1"], (
        f"expected 3 instances on 3 DISTINCT nodes (preferred anti-affinity with "
        f"room to spread), got {placement!r}"
    )
    wait(f"{pg} get pdb -o name | grep -q postgres-shared", 300)

    # Each instance volume's Longhorn replica, by node: the product class is
    # numberOfReplicas=1 with dataLocality disabled, so WHERE it lands decides
    # whether losing a node also takes a SURVIVING instance's disk. Measured,
    # printed, not assumed.
    pvc_nodes = {}
    for pod in sorted(placement):
        pv = server1.succeed(f"{pg} get pvc {pod} -o jsonpath='{{.spec.volumeName}}'").strip()
        pvc_nodes[pod] = server1.succeed(
            f"{kc} -n longhorn-system get replicas.longhorn.io -l longhornvolume={pv} "
            "-o jsonpath='{.items[*].spec.nodeID}'"
        ).split()
    print(f"MEASURED: postgres-shared volume replicas by node: {pvc_nodes!r} (pod -> nodes)")

    # Put the PRIMARY on agent1, so losing agent1 is losing the primary.
    victim_pod = next(p for p, n in placement.items() if n == "agent1")
    primary = server1.succeed(
        f"{pg} get clusters.postgresql.cnpg.io postgres-shared -o jsonpath='{{.status.currentPrimary}}'"
    ).strip()
    if primary != victim_pod:
        # What `kubectl cnpg promote` does: set targetPrimary + the Switchover
        # phase on the status subresource; the operator performs the switchover.
        server1.succeed(
            f"{pg} patch clusters.postgresql.cnpg.io postgres-shared --subresource=status "
            f"--type=merge -p '{{\"status\":{{\"targetPrimary\":\"{victim_pod}\","
            "\"phase\":\"Switchover in progress\",\"phaseReason\":\"multinode lane\"}}'"
        )
        wait(
            f"test \"$({pg} get clusters.postgresql.cnpg.io postgres-shared "
            f"-o jsonpath='{{.status.currentPrimary}}')\" = {victim_pod}",
            900,
        )
        wait(
            f"test \"$({pg} get clusters.postgresql.cnpg.io postgres-shared "
            "-o jsonpath='{.status.readyInstances}')\" = 3",
            900,
        )
    phase(f"postgres primary on agent1 ({victim_pod})")

    wait(f"{pg} exec {victim_pod} -c postgres -- psql -d app -tAc 'select 1'", 300)
    # WAITED, not read once: after a switchover the demoted primary rejoins as
    # a replica a little after readyInstances reports 3 (run 37493221268 read
    # 1 streaming replica at that instant and failed here).
    wait(
        f"{pg} exec {victim_pod} -c postgres -- psql -d app -tAc "
        "\"select count(*) from pg_stat_replication where state = 'streaming'\" | grep -qx 2",
        600,
    )
    streaming = psql(victim_pod, "select count(*) from pg_stat_replication where state = 'streaming'")
    assert streaming == "2", f"primary {victim_pod} has {streaming!r} streaming replicas, expected 2"
    token = f"before-crash-{int(time.time())}"
    psql(victim_pod, f"create table ha_proof (v text); insert into ha_proof values ('{token}')")
    other_pods = [p for p in placement if p != victim_pod]
    for p in other_pods:
        wait(f"{pg} exec {p} -c postgres -- psql -d app -tAc 'select v from ha_proof' | grep -qx {token}", 300)
    phase("postgres: 3 instances / 3 nodes, 2 streaming, row replicated")

    # ── 5. Longhorn 3-replica volume, written on agent1 ──────────────────────
    # PINNED BY nodeSelector, NEVER nodeName. Every product storage class is
    # WaitForFirstConsumer, and a PVC on such a class binds only when the
    # SCHEDULER places its consumer (it writes the selected-node annotation the
    # provisioner waits for). `nodeName` skips the scheduler, so the PVC stays
    # Pending forever: run 37497254337 sat 900 s on "PVC is not bound". The HA
    # sibling gets away with nodeName only because it uses the chart's own
    # Immediate-binding `longhorn` class, which nothing in the product names.
    def pod_yaml(name, node, script):
        return (
            f"cat >/tmp/{name}.yaml <<'EOF'\n"
            "apiVersion: v1\n"
            "kind: Pod\n"
            "metadata:\n"
            f"  name: {name}\n"
            "spec:\n"
            "  nodeSelector:\n"
            f"    kubernetes.io/hostname: {node}\n"
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

    server1.succeed(
        "cat >/tmp/pvc.yaml <<'EOF'\n"
        "apiVersion: v1\n"
        "kind: PersistentVolumeClaim\n"
        "metadata:\n"
        "  name: ha-proof\n"
        "spec:\n"
        "  accessModes: [ReadWriteOnce]\n"
        "  storageClassName: zeta-block-replicated-3\n"
        "  resources:\n"
        "    requests:\n"
        "      storage: 1Gi\n"
        "EOF"
    )
    server1.succeed(f"{kc} apply -f /tmp/pvc.yaml")
    server1.succeed(pod_yaml(
        "writer", "agent1",
        "dd if=/dev/urandom of=/data/blob bs=1M count=32 2>/dev/null && "
        "cd /data && sha256sum blob > blob.sha256 && sync && "
        "echo WRITTEN $(cat blob.sha256) && sleep 3600",
    ))
    server1.succeed(f"{kc} apply -f /tmp/writer.yaml")
    wait(f"{kc} logs writer 2>/dev/null | grep -q WRITTEN", 900)
    m = re.search(r"WRITTEN ([0-9a-f]{64})", server1.succeed(f"{kc} logs writer"))
    assert m, "writer reported no sha256"
    digest = m.group(1)

    pv = server1.succeed(f"{kc} get pvc ha-proof -o jsonpath='{{.spec.volumeName}}'").strip()
    lhv = f"{kc} -n longhorn-system get volumes.longhorn.io {pv}"
    wait(f"test \"$({lhv} -o jsonpath='{{.status.robustness}}')\" = healthy", 600)
    replicas = server1.succeed(
        f"{kc} -n longhorn-system get replicas.longhorn.io -l longhornvolume={pv} "
        "-o jsonpath='{range .items[*]}{.spec.nodeID}={.status.currentState} {end}'"
    ).split()
    lh_placement = dict(r.split("=", 1) for r in replicas)
    assert len(replicas) == 3 and sorted(lh_placement) == ["agent1", "agent2", "server1"], (
        f"expected 3 Longhorn replicas on 3 DISTINCT nodes, got {replicas!r}"
    )
    assert set(lh_placement.values()) == {"running"}, replicas
    phase("longhorn volume healthy, 3 replicas on 3 nodes")

    # Detach before the cut, so the read is not waiting on a VolumeAttachment
    # to a dead node (Kubernetes' non-graceful-shutdown path, another test).
    server1.succeed(f"{kc} delete pod writer --wait=true --timeout=300s")
    wait(f"test \"$({lhv} -o jsonpath='{{.status.state}}')\" = detached", 600)

    # ── 6. Hard power-cut agent1: Postgres primary + a replica + the write ──
    agent1.crash()
    live = [server1, agent2]
    phase("agent1 crashed")
    wait(
        f"test \"$({kc} get node agent1 "
        "-o jsonpath='{.status.conditions[?(@.type==\"Ready\")].status}')\" != True",
        600,
    )

    # ── 7. Failover + both kinds of data survive ─────────────────────────────
    wait(
        f"p=$({pg} get clusters.postgresql.cnpg.io postgres-shared -o jsonpath='{{.status.currentPrimary}}'); "
        f"test -n \"$p\" && test \"$p\" != {victim_pod} && "
        f"{pg} exec \"$p\" -c postgres -- psql -d app -tAc 'select pg_is_in_recovery()' | grep -qx f",
        1500,
    )
    new_primary = server1.succeed(
        f"{pg} get clusters.postgresql.cnpg.io postgres-shared -o jsonpath='{{.status.currentPrimary}}'"
    ).strip()
    print(f"CNPG failed over {victim_pod} (agent1) -> {new_primary} ({placement[new_primary]})")
    assert psql(new_primary, "select v from ha_proof") == token, "pre-crash row lost in failover"
    psql(new_primary, "insert into ha_proof values ('after-crash')")
    assert psql(new_primary, "select count(*) from ha_proof") == "2"
    phase("postgres failed over; pre-crash row present, new write committed")

    server1.succeed(pod_yaml(
        "reader", "agent2",
        "cd /data && sha256sum -c blob.sha256; echo RC=$? READ $(cat blob.sha256); sleep 3600",
    ))
    server1.succeed(f"{kc} apply -f /tmp/reader.yaml")
    wait(f"{kc} logs reader 2>/dev/null | grep -q 'RC='", 1500)
    out = server1.succeed(f"{kc} logs reader").strip()
    assert "blob: OK" in out and "RC=0" in out and f"READ {digest}" in out, (
        f"data written on agent1 did not read back on agent2; expected {digest}, got {out!r}"
    )
    wait(f"test \"$({lhv} -o jsonpath='{{.status.robustness}}')\" = degraded", 300)
    phase("longhorn data intact on agent2, volume degraded")

    print(server1.succeed(f"{kc} get nodes -o wide || true"))
    print(server1.succeed(f"{pg} get pods -o wide || true"))
    print(server1.succeed(f"{kc} -n longhorn-system get replicas.longhorn.io -o wide || true"))
  '';
}
