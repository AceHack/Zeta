# full-ai-cluster/nixos/modules/k3s-process-protection.nix
#
# Kernel-level protection for the k3s PROCESS, so a workload surge cannot starve
# the control plane. Imported by k3s-server.nix AND k3s-agent.nix.
# Work item 081M3K1K1SY087G0R0010A76XY.
#
# ── WHY THIS IS NEEDED IN ADDITION TO #17666's kubelet reservations ──────────
#
# On k3s the apiserver, scheduler, controller-manager, the embedded etcd
# (`--cluster-init`), the kubelet AND containerd all run inside ONE systemd
# unit, `k3s.service`, which sits under `system.slice` -- OUTSIDE
# `kubepods.slice`. #17666 added `kube-reserved` / `system-reserved` /
# `eviction-hard`, and its own comment names the limit: without
# `--kube-reserved-cgroup` they are ACCOUNTING (they shrink Allocatable), not
# ENFORCEMENT. Nothing tells the kernel that k3s.service matters more than a pod.
#
# MEASURED on node-5b2dfa (bare metal, 22 cores, 62 GiB, freshly reinstalled,
# 2026-09-27, read-only), before this module:
#
#   cgroup                          cpu.weight  memory.min  memory.low
#   /kubepods.slice                        830           0           0
#   /system.slice                          100           0           0
#   /system.slice/k3s.service              100           0           0
#
#   process in k3s.service   oom_score_adj   RSS
#   k3s-server                      -999     3.1 GiB   (the kubelet sets its own)
#   containerd                         0     0.36 GiB  (nobody sets it)
#
# So: (1) under CPU contention the pods' slice outweighs ALL system services
# 8.3:1 on this node; (2) no byte of k3s's memory is protected from reclaim, and
# the embedded etcd's bbolt database is a FILE-BACKED mmap, i.e. exactly the
# memory the kernel reclaims first -- reclaim there turns into synchronous disk
# reads on the etcd hot path, which is how an apiserver goes slow and then
# unreachable without anything being OOM-killed; (3) containerd, which every pod
# depends on and which k3s supervises in-process, is an ordinary OOM candidate.
#
# The 4-vCPU / 12 GiB WP11 guest (run 36364782876) lost its apiserver at ~157
# pods: probes timing out, ArgoCD `failed to get server version`, finally
# `connection refused` on 6443 while k3s.service stayed active. WHICH of the
# three mechanisms above fired is NOT known -- that serial log carried no
# journal/kernel lines (the WP11 verdict now captures them, 081M3K1K1XV087G0R002A6YFRS).
# This module closes all three because each is independently measured open.
#
# ── WHAT IT SETS, AND WHY EACH IS THE SAFE FORM ─────────────────────────────
#
# MemoryLow (k3s.service AND system.slice). Best-effort protection: the kernel
# reclaims unprotected memory everywhere else first, and only dips below this
# under genuine whole-system pressure. It is deliberately NOT MemoryMin (a hard
# floor that can force the OOM killer onto pods even when k3s itself is idle
# and holding cache). It must also be set on system.slice: cgroup v2 caps a
# child's effective protection at what its parent has, and this host's cgroup2
# mount carries no `memory_recursiveprot` (measured: `rw,nosuid,nodev,noexec,relatime`),
# so a k3s.service value alone would be clamped to system.slice's 0.
# The value EQUALS the role's `kube-reserved` memory, so the scheduler's
# accounting and the kernel's protection describe the same bytes. The build-time
# value is the role TARGET; at boot the reservation generator below re-sets it
# (`systemctl set-property --runtime`) to the kube-reserved actually granted on
# THIS node, so on a small node it shrinks with the reservation.
#
# CPUWeight 1000 (k3s.service AND system.slice). cpu.weight is proportional and
# WORK-CONSERVING: it changes nothing until the CPU is saturated, and then gives
# system.slice 1000:830 against pods on the node above (1000:127 on the WP11
# guest) instead of 100:830. k3s.service gets 1000 within system.slice so an
# idle-priority neighbour (e.g. a nix-daemon build) cannot dilute it either.
#
# OOMScoreAdjust -999. The value the kubelet already applies to itself, and the
# value it intends for the container runtime; here it reaches containerd too.
# Guaranteed pods sit at -997, so they still lose to nothing in k3s.service --
# and a k3s.service that is OOM-killed takes every pod's runtime with it anyway.
#
# NOT SET, deliberately:
#   IOWeight -- io.weight only acts under the BFQ scheduler or io.cost; this
#     node's disks run `none` (measured `[none] mq-deadline kyber`), so the
#     setting would be a knob that changes nothing: a check that cannot fail.
#   --kube-reserved-cgroup -- the kubelet-level enforcement #17666 rejected
#     because a misparented cgroup makes the kubelet refuse to start on first
#     boot. The systemd properties above reach the same kernel controls without
#     that failure mode.
#
# ── IMAGE-PULL THROTTLE ───────────────────────────────────────────────────────
#
# First boot pulls ~130 images, and the kubelet refused pulls with
# `pull QPS exceeded` (headlamp) at its defaults of registryPullQPS=5 /
# registryBurst=10. Raised to 20/50 so pulls queue on the network, not on a
# token bucket that returns an error and a back-off.
#
# `serializeImagePulls` is LEFT AT ITS DEFAULT (true), on purpose. The bounded
# parallel form needs `maxParallelImagePulls`, which kubelet 1.35 exposes ONLY in
# KubeletConfiguration -- there is no `--max-parallel-image-pulls` flag (checked
# in kubernetes v1.35.0 cmd/kubelet/app/options/options.go), and k3s documents no
# kubelet drop-in directory to put it in. `serialize-image-pulls=false` WITHOUT
# that bound means one concurrent pull + unpack per waiting pod: dozens at once,
# inside k3s.service, on a 4-vCPU guest -- the very contention this module exists
# to prevent. Revisit when the config form is reachable.
#
# ── SOFT EVICTION ─────────────────────────────────────────────────────────────
#
# `eviction-hard` (memory.available<500Mi, #17666) is a last line: it evicts
# immediately with no grace. A soft threshold (1Gi on a big node) held for 1m
# lets the kubelet evict in QoS order while the node still has room to do it
# cleanly, and caps a soft-evicted pod's termination grace at 60s so the relief
# is not postponed by a pod's own long terminationGracePeriodSeconds.
# (`--eviction-soft` has no kubelet defaults, so unlike `--eviction-hard` it
# cannot silently delete other signals.)
#
# ── RESERVATIONS ARE SIZED AT BOOT, TO THE NODE (081M3KC68TK087G0R002NT64S8) ──
#
# kube-reserved, system-reserved, eviction-hard and eviction-soft are NOT
# static `--kubelet-arg` flags. The kubelet REFUSES TO START ("Failed to start
# ContainerManager ... invalid Node Allocatable configuration") when
# kube-reserved + system-reserved + eviction-hard exceeds node memory. #17728's
# server values (2Gi + 512Mi + 500Mi = 3060Mi) exceeded the 2560 MB NixOS test
# VMs, and k3s.service exited 1 in every k3s VM test of build-ai-cluster-iso
# run 36379743833 -- and would on any real node under ~3 GiB. One image boots
# on nodes from 2 GiB to 256 GiB, so only the booted node can size them.
#
# `zeta-k3s-kubelet-reservations` (k3s-kubelet-reservations.sh) runs before
# k3s, reads MemTotal and the core count, and writes the four flags into a k3s
# config file that k3s.service is pointed at with K3S_CONFIG_FILE. The options
# below are the role TARGETS: used unchanged when they fit in 25% of the node
# (every node >= ~12 GiB, so #17728's big-node values stand), scaled down
# proportionally when they do not. The script header carries the full rule.
#
# WHY K3S_CONFIG_FILE, CHECKED IN SOURCE, NOT ASSUMED. k3s's
# pkg/configfilearg/parser.go reads the file named by `K3S_CONFIG_FILE` (before
# `--config` and the /etc/rancher/k3s/config.yaml default), inserts its values
# BEFORE the command-line flags so slice flags like `--kubelet-arg` APPEND
# rather than replace, and returns the arguments unchanged when the file does
# not exist. nixpkgs' k3s module (26.05, rancher/default.nix) passes no
# `--config` unless `configPath` is set, which nothing here sets.
#
# WHY `wantedBy`, NOT `requiredBy`. A failed generator must not stop k3s:
# k3s then starts without the file, i.e. with kubelet defaults -- an
# unprotected node, which is recoverable, instead of no node. The script also
# exits 0 on every path for the same reason.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.k3sProcessProtection;

  # Under /run: regenerated every boot, never a stale size from another disk.
  reservationConfig = "/run/zeta/k3s-kubelet-reservations.yaml";

  target = description: default: lib.mkOption {
    type = lib.types.ints.unsigned;
    inherit default description;
  };
in
{
  options.zeta.k3sProcessProtection = {
    kubeReservedCpuMillis = target "kube-reserved CPU target (millicores); scaled down on small nodes." 250;
    kubeReservedMemoryMi = target ''
      kube-reserved memory target (MiB); scaled down on small nodes. Also the
      build-time MemoryLow of k3s.service and system.slice, re-set at boot to
      the value actually granted.
    '' 512;
    systemReservedCpuMillis = target "system-reserved CPU target (millicores); scaled down on small nodes." 250;
    systemReservedMemoryMi = target "system-reserved memory target (MiB); scaled down on small nodes." 512;
    evictionHardMemoryMi = target "eviction-hard memory.available ceiling (MiB); 5% of the node below it." 500;
    evictionSoftMemoryMi = target "eviction-soft memory.available ceiling (MiB); 10% of the node below it." 1024;
  };

  config = {
    systemd.services.k3s.serviceConfig = {
      MemoryLow = "${toString cfg.kubeReservedMemoryMi}M";
      CPUWeight = 1000;
      OOMScoreAdjust = -999;
    };

    systemd.slices.system.sliceConfig = {
      MemoryLow = "${toString cfg.kubeReservedMemoryMi}M";
      CPUWeight = 1000;
    };

    systemd.services.zeta-k3s-kubelet-reservations = {
      description = "Size the kubelet's node reservations to this node's memory and CPU";
      before = [ "k3s.service" ];
      wantedBy = [ "k3s.service" ];
      environment = {
        ZETA_KUBE_RESERVED_CPU_MILLIS = toString cfg.kubeReservedCpuMillis;
        ZETA_KUBE_RESERVED_MEMORY_MI = toString cfg.kubeReservedMemoryMi;
        ZETA_SYSTEM_RESERVED_CPU_MILLIS = toString cfg.systemReservedCpuMillis;
        ZETA_SYSTEM_RESERVED_MEMORY_MI = toString cfg.systemReservedMemoryMi;
        ZETA_EVICTION_HARD_MEMORY_MI = toString cfg.evictionHardMemoryMi;
        ZETA_EVICTION_SOFT_MEMORY_MI = toString cfg.evictionSoftMemoryMi;
        ZETA_K3S_RESERVATION_CONFIG = reservationConfig;
        ZETA_APPLY_MEMORY_LOW = "1";
      };
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        ExecStart = "${pkgs.bash}/bin/bash ${./k3s-kubelet-reservations.sh}";
        StandardOutput = "journal+console";
        StandardError = "journal+console";
      };
    };

    systemd.services.k3s.environment.K3S_CONFIG_FILE = reservationConfig;

    services.k3s.extraFlags = [
      "--kubelet-arg=registry-qps=20"
      "--kubelet-arg=registry-burst=50"
      "--kubelet-arg=eviction-max-pod-grace-period=60"
    ];
  };
}
