# full-ai-cluster/nixos/modules/local-storage.nix
#
# Local-path provisioner for K8s, AND this cluster's binding of every
# storage CAPABILITY name. Provisions hostPath PVs out of
# /var/lib/zeta-local-storage/ on whichever node a pod lands on.
#
# CHARTS NEVER NAME A STORAGE PROVIDER (2026-09-23). They name one of three
# capabilities, and THIS FILE is where metal says what each one is:
#
#   zeta-block-local       rancher.io/local-path  -- node-local, unreplicated.
#                          THE DEFAULT. Scratch, cache, and the early-wave
#                          workloads that must bind before Longhorn exists.
#                          (Was `zeta-local-path`: same binding, renamed from
#                          what implements it to what it guarantees.)
#   zeta-block-replicated  driver.longhorn.io     -- durable, replicated as far
#                          as the node count allows (1 replica on one box,
#                          matching longhorn/Application.yaml's
#                          defaultReplicaCount; raise it as nodes join).
#   zeta-shared            driver.longhorn.io     -- RWX, served by Longhorn's
#                          NFSv4 share-manager (longhorn-prereqs.nix installs
#                          nfs-utils for exactly this).
#
# The Longhorn-backed classes are declared HERE rather than by the Longhorn
# chart so that every binding lives in one per-cluster file (dev's twin is
# full-ai-cluster/dev-cluster/manifests/). A StorageClass is a core object and
# can exist before its provisioner does; a claim on it pends until Longhorn
# (ArgoCD wave -15) is running, exactly as a claim on the chart's own class did.
# The chart's own `longhorn` class still exists and nothing names it.
#
# Every capability class is WaitForFirstConsumer, on metal and dev alike -- the
# reasoning, and why the default is the LOCAL class and not the replicated one
# (disk budget + first-boot ordering), is in
# src/Core.TypeScript/cluster/storage-capabilities.ts, whose audit reads this
# file and refuses a binding that drifts from it.
#
# Installed as a K3S auto-applied manifest so it's available before
# ArgoCD comes up.

{ config, pkgs, lib, ... }:

{
  # Ensure the host directory exists with correct ownership.
  systemd.tmpfiles.rules = [
    "d /var/lib/zeta-local-storage 0755 root root - -"
  ];

  # Install rancher/local-path-provisioner via K3S manifest. K3S
  # actually ships this by default but we re-declare it explicitly
  # so the path + storage class name match across the cluster.
  services.k3s.manifests = {
    local-path-provisioner.source = pkgs.writeText "local-path-provisioner.yaml" ''
      apiVersion: v1
      kind: Namespace
      metadata:
        name: local-path-storage
      ---
      apiVersion: storage.k8s.io/v1
      kind: StorageClass
      metadata:
        name: zeta-block-local
        annotations:
          storageclass.kubernetes.io/is-default-class: "true"
          zeta.io/storage-capability: block-local
      provisioner: rancher.io/local-path
      reclaimPolicy: Delete
      volumeBindingMode: WaitForFirstConsumer
      ---
      apiVersion: storage.k8s.io/v1
      kind: StorageClass
      metadata:
        name: zeta-block-replicated
        annotations:
          zeta.io/storage-capability: block-replicated
      provisioner: driver.longhorn.io
      allowVolumeExpansion: true
      reclaimPolicy: Delete
      volumeBindingMode: WaitForFirstConsumer
      parameters:
        numberOfReplicas: "1"
        staleReplicaTimeout: "30"
        dataLocality: "disabled"
      ---
      apiVersion: storage.k8s.io/v1
      kind: StorageClass
      metadata:
        name: zeta-shared
        annotations:
          zeta.io/storage-capability: shared
      provisioner: driver.longhorn.io
      allowVolumeExpansion: true
      reclaimPolicy: Delete
      volumeBindingMode: WaitForFirstConsumer
      parameters:
        numberOfReplicas: "1"
        staleReplicaTimeout: "30"
      ---
      apiVersion: v1
      kind: ConfigMap
      metadata:
        name: local-path-config
        namespace: local-path-storage
      data:
        config.json: |
          {
            "nodePathMap": [
              {
                "node": "DEFAULT_PATH_FOR_NON_LISTED_NODES",
                "paths": ["/var/lib/zeta-local-storage"]
              }
            ]
          }
        setup: |-
          #!/bin/sh
          set -eu
          path="$VOL_DIR"
          [ -n "$path" ] || { echo "VOL_DIR empty; refusing to mkdir"; exit 1; }
          case "$path" in /var/lib/zeta-local-storage/*) ;; *) echo "VOL_DIR outside allowed root: $path"; exit 1 ;; esac
          mkdir -m 0777 -p "$path"
        teardown: |-
          #!/bin/sh
          set -eu
          path="$VOL_DIR"
          [ -n "$path" ] || { echo "VOL_DIR empty; refusing to rm"; exit 1; }
          case "$path" in /var/lib/zeta-local-storage/*) ;; *) echo "VOL_DIR outside allowed root: $path"; exit 1 ;; esac
          rm -rf "$path"
        helperPod.yaml: |-
          apiVersion: v1
          kind: Pod
          metadata:
            name: helper-pod
          spec:
            containers:
              - name: helper-pod
                image: busybox
                imagePullPolicy: IfNotPresent
      ---
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: local-path-provisioner
        namespace: local-path-storage
      spec:
        replicas: 1
        selector:
          matchLabels: { app: local-path-provisioner }
        template:
          metadata:
            labels: { app: local-path-provisioner }
          spec:
            serviceAccountName: local-path-provisioner-service-account
            containers:
              - name: local-path-provisioner
                image: rancher/local-path-provisioner:v0.0.30
                imagePullPolicy: IfNotPresent
                command:
                  - local-path-provisioner
                  - start
                  - --config
                  - /etc/config/config.json
                volumeMounts:
                  - { name: config-volume, mountPath: /etc/config/ }
                env:
                  - { name: POD_NAMESPACE, valueFrom: { fieldRef: { fieldPath: metadata.namespace } } }
            volumes:
              - { name: config-volume, configMap: { name: local-path-config } }
      ---
      apiVersion: v1
      kind: ServiceAccount
      metadata:
        name: local-path-provisioner-service-account
        namespace: local-path-storage
      ---
      apiVersion: rbac.authorization.k8s.io/v1
      kind: ClusterRole
      metadata:
        name: local-path-provisioner-role
      rules:
        - apiGroups: [""]
          resources: ["nodes", "persistentvolumeclaims", "configmaps", "pods", "pods/log"]
          verbs: ["get", "list", "watch"]
        - apiGroups: [""]
          resources: ["persistentvolumes"]
          verbs: ["get", "list", "watch", "create", "patch", "update", "delete"]
        - apiGroups: [""]
          # The v0.0.30 helper-pod model spawns a short-lived pod in
          # local-path-storage to mkdir/rm each volume's host dir; the SA must be
          # able to create + delete it. Without this, EVERY PVC on this class
          # fails to provision ("cannot create resource pods") and every stateful
          # pod hangs Pending (observed: mssql/spire-server/vault on node-5b2dfa).
          resources: ["pods"]
          verbs: ["create", "delete"]
        - apiGroups: [""]
          resources: ["events"]
          verbs: ["create", "patch"]
        - apiGroups: ["storage.k8s.io"]
          resources: ["storageclasses"]
          verbs: ["get", "list", "watch"]
      ---
      apiVersion: rbac.authorization.k8s.io/v1
      kind: ClusterRoleBinding
      metadata:
        name: local-path-provisioner-bind
      roleRef:
        apiGroup: rbac.authorization.k8s.io
        kind: ClusterRole
        name: local-path-provisioner-role
      subjects:
        - kind: ServiceAccount
          name: local-path-provisioner-service-account
          namespace: local-path-storage
    '';
  };
}
