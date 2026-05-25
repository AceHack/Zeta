# full-ai-cluster/nixos/modules/gpu-device-plugin.nix
#
# Exposes GPUs to Kubernetes pods via the appropriate device plugin
# DaemonSet. The plugins themselves run as K8s DaemonSets (deployed
# by NixOS into the K3S manifests directory so they come up at first
# boot, before ArgoCD takes over).
#
# Each vendor's plugin advertises a different K8s resource name:
#   NVIDIA → `nvidia.com/gpu`
#   AMD    → `amd.com/gpu`
#   Intel  → `gpu.intel.com/i915`  (Xe) or  `gpu.intel.com/xe`
#
# Per-host config sets `zeta.gpu-device-plugin.vendors = [ "nvidia" "amd" ];`
# Plugins only get installed for the vendors enabled.

{ config, pkgs, lib, ... }:

let
  cfg = config.zeta.gpu-device-plugin;
in
{
  options.zeta.gpu-device-plugin = {
    enable = lib.mkEnableOption "K8s GPU device plugins";

    vendors = lib.mkOption {
      type = lib.types.listOf (lib.types.enum [ "nvidia" "amd" "intel" ]);
      default = [ ];
      description = ''
        Which vendor device plugins to install on this host.
        Multiple can coexist on the same node if it has mixed GPUs.
      '';
      example = [ "nvidia" "amd" ];
    };

    nvidiaVersion = lib.mkOption {
      type = lib.types.str;
      default = "v0.17.4";
      description = "NVIDIA k8s-device-plugin chart version.";
    };

    amdVersion = lib.mkOption {
      type = lib.types.str;
      default = "v1.31.0";
      description = "AMD k8s-device-plugin chart version.";
    };

    intelVersion = lib.mkOption {
      type = lib.types.str;
      default = "v0.32.1";
      description = "Intel device-plugins-for-kubernetes version.";
    };
  };

  config = lib.mkIf cfg.enable {
    # Drop K3S manifests for each enabled vendor. K3S applies them on
    # first boot so GPU resources are advertised to the scheduler
    # before ArgoCD comes up. These manifests are static (no upgrade
    # via ArgoCD today) — bumping the device-plugin version means
    # editing the `*Version` options below and re-applying the host's
    # nixos-rebuild. A future `k8s/applications/gpu-device-plugin/`
    # Application could take over reconciliation, but it doesn't
    # exist yet — the K3S-manifest path is the only one.
    services.k3s.manifests = lib.mkMerge [
      (lib.mkIf (lib.elem "nvidia" cfg.vendors) {
        nvidia-device-plugin.source = pkgs.writeText "nvidia-device-plugin.yaml" ''
          apiVersion: apps/v1
          kind: DaemonSet
          metadata:
            name: nvidia-device-plugin-daemonset
            namespace: kube-system
          spec:
            selector:
              matchLabels:
                name: nvidia-device-plugin-ds
            updateStrategy:
              type: RollingUpdate
            template:
              metadata:
                labels:
                  name: nvidia-device-plugin-ds
              spec:
                tolerations:
                  - { key: CriticalAddonsOnly, operator: Exists }
                  - { key: nvidia.com/gpu, operator: Exists, effect: NoSchedule }
                nodeSelector:
                  zeta.io/gpu: nvidia
                priorityClassName: system-node-critical
                containers:
                  - image: nvcr.io/nvidia/k8s-device-plugin:${cfg.nvidiaVersion}
                    name: nvidia-device-plugin-ctr
                    env:
                      - { name: FAIL_ON_INIT_ERROR, value: "false" }
                    securityContext:
                      allowPrivilegeEscalation: false
                      capabilities: { drop: ["ALL"] }
                    volumeMounts:
                      - { name: device-plugin, mountPath: /var/lib/kubelet/device-plugins }
                volumes:
                  - { name: device-plugin, hostPath: { path: /var/lib/kubelet/device-plugins } }
        '';
      })

      (lib.mkIf (lib.elem "amd" cfg.vendors) {
        amd-device-plugin.source = pkgs.writeText "amd-device-plugin.yaml" ''
          apiVersion: apps/v1
          kind: DaemonSet
          metadata:
            name: amdgpu-device-plugin-daemonset
            namespace: kube-system
          spec:
            selector:
              matchLabels:
                name: amdgpu-dp-ds
            template:
              metadata:
                labels:
                  name: amdgpu-dp-ds
              spec:
                nodeSelector:
                  zeta.io/gpu: amd
                priorityClassName: system-node-critical
                containers:
                  - image: rocm/k8s-device-plugin:${cfg.amdVersion}
                    name: amdgpu-dp-cntr
                    securityContext:
                      allowPrivilegeEscalation: false
                      capabilities: { drop: ["ALL"] }
                    volumeMounts:
                      - { name: dp, mountPath: /var/lib/kubelet/device-plugins }
                      - { name: sys, mountPath: /sys }
                volumes:
                  - { name: dp, hostPath: { path: /var/lib/kubelet/device-plugins } }
                  - { name: sys, hostPath: { path: /sys } }
        '';
      })

      (lib.mkIf (lib.elem "intel" cfg.vendors) {
        intel-device-plugin.source = pkgs.writeText "intel-device-plugin.yaml" ''
          apiVersion: apps/v1
          kind: DaemonSet
          metadata:
            name: intel-gpu-plugin
            namespace: kube-system
          spec:
            selector:
              matchLabels:
                app: intel-gpu-plugin
            template:
              metadata:
                labels:
                  app: intel-gpu-plugin
              spec:
                nodeSelector:
                  zeta.io/gpu: intel
                priorityClassName: system-node-critical
                containers:
                  - name: intel-gpu-plugin
                    image: intel/intel-gpu-plugin:${cfg.intelVersion}
                    securityContext:
                      allowPrivilegeEscalation: false
                      capabilities: { drop: ["ALL"] }
                    volumeMounts:
                      - { name: devfs, mountPath: /dev/dri, readOnly: true }
                      - { name: sysfs, mountPath: /sys/class/drm, readOnly: true }
                      - { name: kubeletsockets, mountPath: /var/lib/kubelet/device-plugins }
                volumes:
                  - { name: devfs, hostPath: { path: /dev/dri } }
                  - { name: sysfs, hostPath: { path: /sys/class/drm } }
                  - { name: kubeletsockets, hostPath: { path: /var/lib/kubelet/device-plugins } }
        '';
      })
    ];
  };
}
