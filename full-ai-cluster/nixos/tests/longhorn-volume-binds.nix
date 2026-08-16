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
    ];

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
