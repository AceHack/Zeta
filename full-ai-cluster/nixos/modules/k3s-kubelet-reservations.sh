#!/usr/bin/env bash
# full-ai-cluster/nixos/modules/k3s-kubelet-reservations.sh
#
# Sizes the kubelet's node reservations to THIS node's memory and CPU, at boot,
# before k3s starts. Work item 081M3KC68TK087G0R002NT64S8.
#
# WHY AT BOOT AND NOT IN NIX. The kubelet refuses to start when
#   kube-reserved + system-reserved + eviction-hard  >  node memory capacity
# ("Failed to start ContainerManager ... invalid Node Allocatable
# configuration"). #17728 raised the server's static reservation to
# 2Gi + 512Mi + 500Mi = 3060Mi, which is more than a 2560 MB NixOS test VM
# has, and k3s exited 1 on every small node (build-ai-cluster-iso run
# 36379743833). The same image boots on a 2.5 GiB VM and a 62 GiB metal node,
# so no build-time constant is right for both: only the booted node knows its
# MemTotal.
#
# THE RULE (MiB / millicores, integer arithmetic):
#   * The role's targets (kube-reserved, system-reserved) are used unchanged
#     whenever they fit in 25% of the node. On every node >= ~12 GiB that is
#     exactly #17728's values, so its intent for big nodes is untouched.
#   * Otherwise both are scaled down PROPORTIONALLY until their sum is 25% of
#     the node. 25% is GKE's own reservation rate for the first 4 GiB of a
#     node -- the highest tier of its published formula -- so a small node here
#     never reserves more than GKE reserves on the same size.
#   * eviction-hard memory.available = 5% of the node, floored at the kubelet's
#     own default 100Mi, capped at the role target (500Mi).
#   * eviction-soft memory.available = 10% of the node (at least 2x hard),
#     capped at the target (1Gi). A fixed 1Gi soft threshold on a 2.5 GiB node
#     is below the node's idle free memory and would evict continuously.
#   * CPU: the same proportional clamp at 25% of the node's cores.
# So reserved + hard eviction <= 30% of MemTotal for any node >= 2000 MiB, and
# < 50% for any node >= 512 MiB -- never the whole node, which is the refusal.
#
# INPUTS (environment): ZETA_KUBE_RESERVED_CPU_MILLIS, ZETA_KUBE_RESERVED_MEMORY_MI,
# ZETA_SYSTEM_RESERVED_CPU_MILLIS, ZETA_SYSTEM_RESERVED_MEMORY_MI,
# ZETA_EVICTION_HARD_MEMORY_MI, ZETA_EVICTION_SOFT_MEMORY_MI (the role targets),
# ZETA_K3S_RESERVATION_CONFIG (the k3s config file to write),
# ZETA_APPLY_MEMORY_LOW=1 to also set systemd MemoryLow at runtime.
# ZETA_MEMTOTAL_KB / ZETA_NPROC override the probes -- that is how the test
# executes this over node sizes it does not have.
#
# NEVER FAILS THE BOOT. An unreadable probe writes a config with no
# reservations (the kubelet's defaults) and exits 0: a node that starts
# unprotected is recoverable, a kubelet that refuses to start is not.

set -u

out="${ZETA_K3S_RESERVATION_CONFIG:-/run/zeta/k3s-kubelet-reservations.yaml}"

kube_cpu_t="${ZETA_KUBE_RESERVED_CPU_MILLIS:-250}"
kube_mem_t="${ZETA_KUBE_RESERVED_MEMORY_MI:-512}"
sys_cpu_t="${ZETA_SYSTEM_RESERVED_CPU_MILLIS:-250}"
sys_mem_t="${ZETA_SYSTEM_RESERVED_MEMORY_MI:-512}"
hard_t="${ZETA_EVICTION_HARD_MEMORY_MI:-500}"
soft_t="${ZETA_EVICTION_SOFT_MEMORY_MI:-1024}"

memtotal_kb="${ZETA_MEMTOTAL_KB:-}"
if [ -z "$memtotal_kb" ] && [ -r /proc/meminfo ]; then
  while read -r key value _; do
    if [ "$key" = "MemTotal:" ]; then memtotal_kb="$value"; break; fi
  done < /proc/meminfo
fi
ncpu="${ZETA_NPROC:-}"
if [ -z "$ncpu" ]; then ncpu="$(nproc 2>/dev/null || echo 0)"; fi

case "$memtotal_kb" in ''|*[!0-9]*) memtotal_kb=0 ;; esac
case "$ncpu" in ''|*[!0-9]*) ncpu=0 ;; esac

mkdir -p "$(dirname "$out")"
tmp="$out.tmp.$$"

if [ "$memtotal_kb" -le 0 ] || [ "$ncpu" -le 0 ]; then
  echo "ZETA_KUBELET_RESERVATIONS_UNKNOWN memtotal_kb=$memtotal_kb cpus=$ncpu -- writing no reservations (kubelet defaults)"
  printf '# written by k3s-kubelet-reservations.sh: node size unreadable, kubelet defaults\n' > "$tmp"
  mv -f "$tmp" "$out"
  exit 0
fi

mem=$(( memtotal_kb / 1024 ))
cpu=$(( ncpu * 1000 ))

# Proportional clamp: echo "a b" scaled so a + b <= cap, preserving a:b.
clamp_pair() {
  local a="$1" b="$2" cap="$3"
  if [ $(( a + b )) -le "$cap" ]; then echo "$a $b"; return; fi
  local sa=$(( a * cap / (a + b) ))
  echo "$sa $(( cap - sa ))"
}

read -r kube_mem sys_mem <<EOF
$(clamp_pair "$kube_mem_t" "$sys_mem_t" $(( mem * 25 / 100 )))
EOF
read -r kube_cpu sys_cpu <<EOF
$(clamp_pair "$kube_cpu_t" "$sys_cpu_t" $(( cpu * 25 / 100 )))
EOF

hard=$(( mem * 5 / 100 ))
[ "$hard" -lt 100 ] && hard=100
[ "$hard" -gt "$hard_t" ] && hard="$hard_t"

soft=$(( mem * 10 / 100 ))
[ "$soft" -lt $(( 2 * hard )) ] && soft=$(( 2 * hard ))
[ "$soft" -gt "$soft_t" ] && soft="$soft_t"
[ "$soft" -le "$hard" ] && soft=$(( hard + 1 ))

{
  printf '# written at boot by k3s-kubelet-reservations.sh for MemTotal=%sMi cpus=%s\n' "$mem" "$ncpu"
  printf 'kubelet-arg:\n'
  printf '  - "kube-reserved=cpu=%sm,memory=%sMi"\n' "$kube_cpu" "$kube_mem"
  printf '  - "system-reserved=cpu=%sm,memory=%sMi"\n' "$sys_cpu" "$sys_mem"
  printf '  - "eviction-hard=memory.available<%sMi,nodefs.available<10%%,imagefs.available<15%%,nodefs.inodesFree<5%%"\n' "$hard"
  printf '  - "eviction-soft=memory.available<%sMi"\n' "$soft"
  printf '  - "eviction-soft-grace-period=memory.available=1m"\n'
} > "$tmp"
mv -f "$tmp" "$out"

echo "ZETA_KUBELET_RESERVATIONS memtotal=${mem}Mi cpus=$ncpu kube=${kube_cpu}m/${kube_mem}Mi system=${sys_cpu}m/${sys_mem}Mi eviction_hard=${hard}Mi eviction_soft=${soft}Mi total_memory=$(( kube_mem + sys_mem + hard ))Mi"

# MemoryLow names the same bytes kube-reserved does (#17728's invariant), so it
# must shrink with it: a 2G MemoryLow on a 2.5 GiB node would protect k3s's
# cache at the expense of every pod. system.slice carries it too -- cgroup v2
# caps a child's protection at its parent's (no memory_recursiveprot here).
# Best-effort: a failure leaves the build-time value, which is never a refusal.
if [ "${ZETA_APPLY_MEMORY_LOW:-0}" = "1" ]; then
  for unit in system.slice k3s.service; do
    systemctl set-property --runtime "$unit" "MemoryLow=${kube_mem}M" \
      || echo "ZETA_KUBELET_RESERVATIONS_MEMORYLOW_NOT_SET unit=$unit (build-time value kept)"
  done
fi
exit 0
