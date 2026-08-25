# full-ai-cluster/nixos/tests/longhorn-volume-binds.nix
#
# THE CLOSEST THING TO PROD without touching prod: boot the real control-plane
# node modules in QEMU, install the REAL Longhorn chart at the REAL version with
# the REAL prod values, and prove a `longhorn` PVC actually BINDS and a pod can
# write to it.
#
# WHY THIS EXISTS
# ---------------
# `k3s-control-plane-platform-fixes.nix` asserts that iscsiadm is reachable on
# the PATH longhorn-manager's nsenter uses. That is necessary and it is what the
# 2026-08-16 fix added — but it is NOT proof that Longhorn works. It proves one
# binary resolves. Between "iscsiadm resolves" and "a stateful workload has a
# disk" sit: longhorn-manager staying up, registering a Node CR, the chart
# creating the `longhorn` StorageClass, the CSI plugin attaching a volume, and a
# pod actually mounting it. Every one of those is a place the chain can die.
#
# On node-5b2dfa it died at the first link and nobody noticed for 62 days:
#
#   longhorn-manager   CrashLoopBackOff   16508 restarts
#   nodes.longhorn.io  <none>                          <- never registered
#   storageclass       "longhorn" not found            <- never created
#   20 PVCs            Pending                         <- cockroachdb, mimir...
#
# ...while every CI lane was green, because no lane ever asked "does a volume
# bind?". The workaround was to move everything that mattered onto
# zeta-local-path, which hid the outage rather than fixing it.
#
# So this test asserts the CHAIN, in the order it broke, each assertion naming
# the prod symptom it inverts. It is the highest-fidelity verification available
# short of installing on metal: same NixOS modules, same k3s flags, same chart,
# same version, same values.
#
# WHAT IT IS STILL NOT
# --------------------
# Stated rather than implied, because an over-claimed test is the thing this
# whole file exists to argue against:
#   * ONE node. Prod is one node today, but replica placement across real nodes
#     is not exercised (defaultReplicaCount=1, as in prod).
#   * A virtual disk, not the physical NVMe layout — no /var/lib/longhorn-disk1
#     or -disk2 mounts, so the multi-disk Node CR wiring is out of scope.
#   * Not the USB installer path; that is the zflash harness's job.
#   * RWX/NFS is not exercised — only the RWO iSCSI path.
#
# REQUIRES INTERNET (chart + ~1-2 GB of images), so build with the sandbox off:
#
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.longhorn-volume-binds -L --option sandbox false
#
# Budget 20-40 min on a KVM-capable machine.

{ pkgs }:

pkgs.testers.nixosTest {
  name = "longhorn-volume-binds";

  nodes.server = { config, pkgs, lib, ... }: {
    # The REAL modules. longhorn-prereqs.nix is the one under test: open-iscsi,
    # iscsi_tcp, /var/lib/longhorn, and the /usr/local/bin FHS shim.
    imports = [
      ../modules/k3s-server.nix
      ../modules/longhorn-prereqs.nix
      ../modules/longhorn-disks.nix
    ];

    # TWO data disks, so the multi-disk path is exercised rather than
    # assumed. Backed by real extra virtual drives below; a bind-mount or
    # a bare directory would let Longhorn register a "disk" that is
    # secretly the root filesystem, which is the vacuous version of this
    # test.
    zeta.longhorn.dataDisks = [ "/var/lib/longhorn-disk1" "/var/lib/longhorn-disk2" ];

    virtualisation.emptyDiskImages = [ 4096 4096 ];
    # virtualisation.fileSystems, NOT plain fileSystems. The qemu-vm module
    # owns the test VM's mount set, so plain `fileSystems` entries are dropped
    # silently -- measured: no mount unit was generated at all, not even a
    # failing one, so both paths simply did not exist and Longhorn registered
    # `disks: {}`.
    virtualisation.fileSystems = {
      "/var/lib/longhorn-disk1" = {
        device = "/dev/vdb";
        fsType = "ext4";
        autoFormat = true;
      };
      "/var/lib/longhorn-disk2" = {
        device = "/dev/vdc";
        fsType = "ext4";
        autoFormat = true;
      };
    };

    # NAT internet via the qemu user-mode NIC.
    networking.useDHCP = lib.mkForce true;

    # Cilium is required — without a CNI the node never reaches Ready and no
    # Longhorn pod can schedule. Longhorn itself is installed as a HelmChart CR
    # mirroring k8s/applications/longhorn/Application.yaml exactly.
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
          # Pinned to the version prod runs (k8s/applications/longhorn).
          version = "1.7.2";
          targetNamespace = "longhorn-system";
          createNamespace = true;
          bootstrap = true; # tolerate the not-ready:NoSchedule taint
          # valuesContent mirrors the prod Application's valuesObject. Keep the
          # two in step: a divergence here turns this into a test of a cluster
          # nobody runs.
          valuesContent = ''
            preUpgradeChecker:
              jobEnabled: false
            defaultSettings:
              defaultDataPath: /var/lib/longhorn
              # Required for Longhorn to read the per-node disks annotation at
              # all. Omitting it here is what made the first run of the
              # multi-disk assertion fail: the annotation and label were both
              # correct on the node, and Longhorn ignored them, registering only
              # defaultDataPath. Keep in step with the prod Application.
              createDefaultDiskLabeledNodes: true
              defaultReplicaCount: 1
            persistence:
              defaultClass: false
              defaultClassReplicaCount: 1
              reclaimPolicy: Retain
            ingress:
              enabled: false
          '';
        };
      };
    };

    # Longhorn is heavy: manager + instance-manager + CSI sidecars + UI, on top
    # of Cilium's agent/operator/envoy. Images alone are >1 GB.
    virtualisation.memorySize = 8192;
    virtualisation.cores = 4;
    virtualisation.diskSize = 24576;
  };

  testScript = ''
    start_all()

    server.wait_for_unit("k3s.service", timeout=300)
    server.wait_for_file("/etc/rancher/k3s/k3s.yaml", timeout=180)

    kc = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl"

    # ── LINK 0: the shim, on the PATH Longhorn actually resolves through ──
    # Not `command -v iscsiadm` — that resolves via /run/current-system/sw/bin,
    # which longhorn-manager's nsenter never sees. This is the exact lookup.
    server.succeed(
        "env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin "
        "iscsiadm --version"
    )

    # CNI up, node Ready — nothing schedules otherwise.
    server.wait_until_succeeds(
        f"{kc} -n kube-system get pods -l k8s-app=cilium "
        f"--no-headers 2>/dev/null | grep -q ' Running '",
        timeout=1800,
    )
    server.wait_until_succeeds(
        f"{kc} wait --for=condition=Ready node --all --timeout=30s",
        timeout=1800,
    )

    # ── LINK 1: longhorn-manager STAYS UP ────────────────────────────────
    # Prod symptom: CrashLoopBackOff, 16508 restarts, dying every ~40s on
    # "nsenter: failed to execute iscsiadm: No such file or directory".
    server.wait_until_succeeds(
        f"{kc} -n longhorn-system get pods -l app=longhorn-manager "
        f"--no-headers 2>/dev/null | grep -q ' Running '",
        timeout=2400,
    )
    # Running once is not enough — the prod pod reached Running between crashes.
    # Require the readiness gate, which a crash-looping manager never passes.
    server.wait_until_succeeds(
        f"{kc} -n longhorn-system wait --for=condition=Ready pod "
        f"-l app=longhorn-manager --timeout=60s",
        timeout=1200,
    )

    # ── LINK 2: the Node CR registers ────────────────────────────────────
    # Prod symptom: `kubectl get nodes.longhorn.io` returned NOTHING. Longhorn
    # cannot place a replica on a node it never registered.
    server.wait_until_succeeds(
        f"{kc} -n longhorn-system get nodes.longhorn.io "
        f"--no-headers 2>/dev/null | grep -q .",
        timeout=900,
    )

    # Diagnostics BEFORE the multi-disk assertion. A wait_until_succeeds that
    # times out prints nothing about why, and the post-mortem block at the end
    # is unreachable once it fails -- so surface the inputs here, where they are
    # still readable in the build log.
    print("=== annotator unit ===")
    print(server.succeed("systemctl status zeta-longhorn-node-disks.service --no-pager || true"))
    print(server.succeed("journalctl -u zeta-longhorn-node-disks.service --no-pager | tail -n 30 || true"))
    print("=== node labels/annotations ===")
    print(server.succeed(f"{kc} get node server -o jsonpath='{{.metadata.labels}}' || true"))
    print(server.succeed(f"{kc} get node server -o jsonpath='{{.metadata.annotations}}' || true"))
    print("=== longhorn setting + node CR ===")
    print(server.succeed(
        f"{kc} -n longhorn-system get settings.longhorn.io create-default-disk-labeled-nodes "
        f"-o jsonpath='{{.value}}' || true"))
    print(server.succeed(f"{kc} -n longhorn-system get nodes.longhorn.io -o yaml | head -n 60 || true"))
    print(server.succeed("mount | grep longhorn-disk || true"))

    # ── LINK 2b: BOTH data disks are registered on the Node CR ───────────
    # The multi-disk path used to be a file nothing read: longhorn-disks.nix
    # wrote /etc/longhorn/node-disks.yaml as kind: NodeDiskCatalog, which is
    # not a real CRD, and no consumer ever existed. Longhorn silently used
    # defaultDataPath alone, so on a 2-NVMe box the second drive sat idle.
    #
    # Assert the COUNT, not merely that a disk exists -- one disk is what the
    # broken version produced, so "has disks" would have passed against the bug.
    server.wait_until_succeeds(
        f"{kc} -n longhorn-system get nodes.longhorn.io server "
        f"-o jsonpath='{{.spec.disks}}' 2>/dev/null | grep -q longhorn-disk2",
        timeout=300,
    )
    disks = server.succeed(
        f"{kc} -n longhorn-system get nodes.longhorn.io server "
        f"-o jsonpath='{{.spec.disks}}'"
    )
    for want in ["/var/lib/longhorn-disk1", "/var/lib/longhorn-disk2"]:
        assert want in disks, f"Longhorn Node CR missing {want}; got: {disks}"

    # ...and they are genuinely separate block devices, not the root fs. A
    # bind-mount would satisfy the assertion above while giving no extra
    # capacity at all.
    server.succeed("mountpoint -q /var/lib/longhorn-disk1")
    server.succeed("mountpoint -q /var/lib/longhorn-disk2")

    # ── LINK 3: the StorageClass exists ──────────────────────────────────
    # Prod symptom, verbatim from the PVC events, 107992 times over 18 days:
    #   storageclass.storage.k8s.io "longhorn" not found
    server.wait_until_succeeds(f"{kc} get storageclass longhorn", timeout=900)

    # ── LINK 4: a PVC actually BINDS ─────────────────────────────────────
    # This is the 62-day symptom itself: 20 PVCs Pending forever.
    server.succeed(
        "cat >/tmp/pvc.yaml <<'EOF'\n"
        "apiVersion: v1\n"
        "kind: PersistentVolumeClaim\n"
        "metadata:\n"
        "  name: proof\n"
        "spec:\n"
        "  accessModes: [ReadWriteOnce]\n"
        "  storageClassName: longhorn\n"
        "  resources:\n"
        "    requests:\n"
        "      storage: 1Gi\n"
        "EOF"
    )
    server.succeed(f"{kc} apply -f /tmp/pvc.yaml")

    # ── LINK 5: a pod MOUNTS it and the data survives ────────────────────
    # Binding can succeed while attach fails, so write through the mount and
    # read it back. This is the first assertion that proves a stateful workload
    # would actually have worked.
    server.succeed(
        "cat >/tmp/pod.yaml <<'EOF'\n"
        "apiVersion: v1\n"
        "kind: Pod\n"
        "metadata:\n"
        "  name: proof\n"
        "spec:\n"
        "  restartPolicy: Never\n"
        "  containers:\n"
        "    - name: w\n"
        "      image: busybox:1.36\n"
        "      command: [sh, -c, 'echo zeta-longhorn-proof > /data/p && sync && cat /data/p']\n"
        "      volumeMounts:\n"
        "        - name: v\n"
        "          mountPath: /data\n"
        "  volumes:\n"
        "    - name: v\n"
        "      persistentVolumeClaim:\n"
        "        claimName: proof\n"
        "EOF"
    )
    server.succeed(f"{kc} apply -f /tmp/pod.yaml")

    # WaitForFirstConsumer-style binding completes once the pod is scheduled.
    server.wait_until_succeeds(
        f"{kc} get pvc proof --no-headers 2>/dev/null | grep -q ' Bound '",
        timeout=1800,
    )
    server.wait_until_succeeds(
        f"{kc} get pod proof --no-headers 2>/dev/null | grep -q ' Completed '",
        timeout=1800,
    )
    out = server.succeed(f"{kc} logs proof")
    assert "zeta-longhorn-proof" in out, (
        f"volume mounted but the write did not read back; got: {out!r}"
    )

    # Post-mortem surface into the build log.
    print(server.succeed(f"{kc} get nodes.longhorn.io -n longhorn-system -o wide || true"))
    print(server.succeed(f"{kc} get storageclass || true"))
    print(server.succeed(f"{kc} get pvc,pv || true"))
    print(server.succeed(f"{kc} -n longhorn-system get pods || true"))
  '';
}
