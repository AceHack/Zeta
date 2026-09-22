# full-ai-cluster/nixos/modules/k8s-node-tunables.nix
#
# Host kernel tunables the ~150-pod Argo CD catalog needs
# (full-ai-cluster/k8s/applications/) that grep found NOTHING for anywhere in
# this tree before this module: no fs.inotify.*, no vm.max_map_count, no
# fs.file-max override on either k3s-server.nix or k3s-agent.nix. Classic
# single-node crash-loop causes on a stock kernel default.
#
# SINGLE SOURCE OF TRUTH IS ../../k8s/node-tunables.json, not this file.
# Read here via builtins.fromJSON, and read AGAIN by
# src/Core.TypeScript/cluster/node-tunables.ts so the Docker CI lanes in
# .github/workflows/k8s-argocd-health-test.yml (kind/k3d, which inherit the
# GitHub runner's OWN kernel sysctls — a stock Ubuntu image, not NixOS) can
# set the SAME values on the runner before cluster creation instead of
# silently testing under a different kernel than production ships.
#
# WHY EACH KEY IS HERE — values, measured host defaults, and citations live in
# the JSON; this is the map from key to WHAT BREAKS WITHOUT IT, so a reader
# does not have to open two files to find out why a line exists:
#
#   vm.max_map_count              — OpenSearch (k8s/applications/opensearch/
#                                    Application.yaml) mmaps one region per
#                                    Lucene segment and refuses to start below
#                                    this. Its chart's own sysctlInit
#                                    initContainer is OFF (both by our values
#                                    and by the chart's own default), so the
#                                    host is the only place this can come
#                                    from. Host default measured at this
#                                    repo's pinned nixpkgs rev: 65530 — a
#                                    kernel compile-time constant
#                                    (DEFAULT_MAX_MAP_COUNT, include/linux/mm.h),
#                                    not something NixOS or systemd raises.
#
#   fs.inotify.max_user_instances — kubelet + every config-reloader sidecar +
#                                    every log-tailing agent (alloy /
#                                    promtail-shaped) opens its own inotify
#                                    instance, and the ucount pool is
#                                    HOST-WIDE PER USER (no user-namespace
#                                    isolation here) — so ~150 pods on one
#                                    node share one budget. Kernel default is
#                                    a flat 128. Symptom: "too many open
#                                    files" / "failed to create fsnotify
#                                    watcher".
#
#   fs.inotify.max_user_watches   — companion per-instance watched-path
#                                    ceiling. NixOS computes a per-host
#                                    default from RAM (8192..1,048,576), so
#                                    leaving it unset makes behaviour depend
#                                    on which box gets flashed. Pinned
#                                    explicitly instead.
#
# NOT HERE: LimitNOFILE. nixpkgs' own k3s systemd module already sets
# LimitNOFILE=1048576 on the k3s unit (mkRancherModule in nixpkgs'
# nixos/modules/services/cluster/rancher/default.nix, citing upstream k3s's
# own install.sh) — verified by reading the pinned module source at this
# repo's nixpkgs rev, not assumed. containerd and every pod's container
# process forks from that same process tree and inherits it, so
# cockroachdb/nats/opensearch's high-nofile requirements are already met.
# A second LimitNOFILE declared here would be redundant at best and a
# regression if it were ever lower than what upstream already ships.
#
# 081M33PQ4MG087G0R002ZKDAVR.

{ lib, ... }:

let
  tunablesFile = ../../k8s/node-tunables.json;
  tunables = builtins.fromJSON (builtins.readFile tunablesFile);

  # Fail closed at eval time rather than silently applying an empty sysctl
  # set — the same "a check that did not run looks like one that passed"
  # class this repo guards against everywhere else. A JSON edit that drops
  # the "sysctls" key, or empties it, is a bug here, not a green host.
  entries =
    if !(tunables ? sysctls) then
      throw "${toString tunablesFile}: no top-level \"sysctls\" key"
    else if tunables.sysctls == [ ] then
      throw "${toString tunablesFile}: \"sysctls\" is empty — this module would apply nothing"
    else
      tunables.sysctls;
in
{
  boot.kernel.sysctl = lib.listToAttrs (
    map (t: lib.nameValuePair t.key t.value) entries
  );
}
