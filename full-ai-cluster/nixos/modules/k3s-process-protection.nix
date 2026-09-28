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
# accounting and the kernel's protection describe the same bytes.
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
# immediately with no grace. A soft threshold at 1Gi held for 1m lets the
# kubelet evict in QoS order while the node still has room to do it cleanly,
# and caps a soft-evicted pod's termination grace at 60s so the relief is not
# postponed by a pod's own long terminationGracePeriodSeconds.
# (`--eviction-soft` has no kubelet defaults, so unlike `--eviction-hard` it
# cannot silently delete other signals.)

{ config, lib, ... }:

let
  cfg = config.zeta.k3sProcessProtection;
in
{
  options.zeta.k3sProcessProtection = {
    memoryLow = lib.mkOption {
      type = lib.types.strMatching "^[0-9]+[KMG]$";
      description = ''
        systemd MemoryLow for k3s.service (and system.slice, which must carry at
        least as much for the child's protection to be effective). Set by the
        role module to its `kube-reserved` memory so accounting and enforcement
        agree.
      '';
    };
  };

  config = {
    systemd.services.k3s.serviceConfig = {
      MemoryLow = cfg.memoryLow;
      CPUWeight = 1000;
      OOMScoreAdjust = -999;
    };

    systemd.slices.system.sliceConfig = {
      MemoryLow = cfg.memoryLow;
      CPUWeight = 1000;
    };

    services.k3s.extraFlags = [
      "--kubelet-arg=registry-qps=20"
      "--kubelet-arg=registry-burst=50"
      "--kubelet-arg=eviction-soft=memory.available<1Gi"
      "--kubelet-arg=eviction-soft-grace-period=memory.available=1m"
      "--kubelet-arg=eviction-max-pod-grace-period=60"
    ];
  };
}
