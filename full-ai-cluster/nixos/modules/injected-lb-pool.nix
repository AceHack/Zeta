# full-ai-cluster/nixos/modules/injected-lb-pool.nix
#
# docs/ops/INSTALL-TIME-CONFIG.md row 3 -- the Cilium LoadBalancer address range as
# INSTALL-TIME configuration.
#
# THE DEFECT: `k8s/applications/cilium-lb-ipam/ip-pool.yaml` shipped
# `192.168.1.240 - 192.168.1.250`. That block is free addresses on ONE home subnet.
# A generic installer never edits a file, so on any other network Cilium handed every
# `type: LoadBalancer` Service (the portal gateway, GitLab) an address no router knew,
# announced ARP for it on an interface whose subnet it is not in, and reported the
# Service healthy. Nothing said so.
#
# THE MECHANISM -- the one the public domain / ACME email already use
# (injected-public-tls.nix, INJECTION-POINTS.md §10), not a second one:
#   zeta-install.sh resolves the range (ESP ZETA_LB_POOL -> start-of-install prompt ->
#   unset), validates it against the LAN it measured, and writes
#   /mnt/etc/zeta/lb-pool as `<first-ip>-<last-ip>`; it symlinks it to /etc/zeta/ for
#   `nixos-install --impure` evaluation. This module reads it at evaluation time and,
#   on a k3s SERVER, adds one entry to the k3s auto-deploy roster: the
#   `cilium-lb-ipam-pool` ArgoCD Application, rendered from
#   k8s/lb-ipam/argocd-application.yaml.in by substituting two tokens.
#
# ABSENT -> this module contributes nothing: no pool exists, Services of type
# LoadBalancer stay <pending>, and zeta-install.sh printed exactly that. That is a
# supported, VISIBLE state -- the alternative (a placeholder range) was the defect.
# PRESENT BUT MALFORMED -> refused at evaluation, loudly, naming the file.
#
# PURE-EVAL NOTE (see injected-hostname.nix): `builtins.pathExists` on an absolute path
# is false in pure evaluation, so a rebuild without `--impure` would silently drop the
# Application. Every nixos-rebuild in this repo carries `--impure`;
# lint-nixos-rebuild-needs-impure.ts keeps it that way.

{ config, lib, pkgs, ... }:

let
  poolFile = "/etc/zeta/lb-pool";
  readTrimmed = f:
    if builtins.pathExists f
    then
      let m = builtins.match "[[:space:]]*([^[:space:]]*)[[:space:]]*" (builtins.readFile f);
      in if m == null then "" else builtins.head m
    else "";
  raw = readTrimmed poolFile;
  present = raw != "";

  # `a.b.c.d-e.f.g.h`. The two inner groups are POSIX ERE's, not ours; elements 0 and 2
  # are the addresses.
  shape = builtins.match "([0-9]{1,3}(\\.[0-9]{1,3}){3})-([0-9]{1,3}(\\.[0-9]{1,3}){3})" raw;
  start = if shape == null then "" else builtins.elemAt shape 0;
  stop = if shape == null then "" else builtins.elemAt shape 2;

  # Strict octets: no leading zero (`010` is octal to some parsers), <= 255.
  octetOk = o: (o == "0" || !(lib.hasPrefix "0" o)) && lib.toInt o <= 255;
  ipOk = ip:
    let parts = lib.splitString "." ip;
    in builtins.length parts == 4 && lib.all octetOk parts;
  ipToInt = ip: lib.foldl' (acc: o: acc * 256 + lib.toInt o) 0 (lib.splitString "." ip);

  addressesOk = shape != null && ipOk start && ipOk stop;
  ordered = addressesOk && ipToInt start <= ipToInt stop;
  valid = present && addressesOk && ordered;

  # The derived pod / service CIDRs (cluster-network.nix), when this host has them. A
  # LoadBalancer range inside either is an address Cilium would hand to both a Service
  # and a pod. Looked up by path so a host that does not import the module is a no-op.
  cidrBounds = cidr:
    let
      parts = lib.splitString "/" cidr;
      base = ipToInt (builtins.elemAt parts 0);
      prefix = lib.toInt (builtins.elemAt parts 1);
      size = lib.foldl' (acc: _: acc * 2) 1 (lib.range 1 (32 - prefix));
      first = base - lib.mod base size;
    in { inherit first; last = first + size - 1; };
  overlapsCidr = cidr:
    let b = cidrBounds cidr;
    in ipToInt start <= b.last && b.first <= ipToInt stop;
  derivedCidrs = lib.filter (c: c != null) [
    (lib.attrByPath [ "zeta" "cluster" "podCidr" ] null config)
    (lib.attrByPath [ "zeta" "cluster" "serviceCidr" ] null config)
  ];

  template = builtins.readFile ../../k8s/lb-ipam/argocd-application.yaml.in;
  rendered = builtins.replaceStrings
    [ "@ZETA_LB_POOL_START@" "@ZETA_LB_POOL_STOP@" ]
    [ start stop ]
    template;
  isServer = config.services.k3s.enable && config.services.k3s.role == "server";
in
{
  config = lib.mkMerge [
    {
      assertions = [
        {
          assertion = !present || valid;
          message = "injected-lb-pool: ${poolFile} contains ${builtins.toJSON raw}, which is not `<first-ip>-<last-ip>` (strict dotted-quad IPv4, first <= last). Refusing to render it into a manifest. Fix it or remove it for a node with no LoadBalancer pool.";
        }
        {
          assertion = !valid || !(lib.any overlapsCidr derivedCidrs);
          message = "injected-lb-pool: ${raw} overlaps this cluster's derived pod/service CIDR (${lib.concatStringsSep ", " derivedCidrs}). Cilium would hand the same address to a Service and to a pod. Choose a range on the LAN subnet.";
        }
        {
          # Fail closed on a template that grew a token this module does not fill: an
          # un-rendered `@ZETA_...@` must never reach the cluster as a literal.
          assertion = !valid || !(lib.hasInfix "@ZETA_" rendered);
          message = "injected-lb-pool: the rendered Application still contains an unsubstituted @ZETA_*@ token. k8s/lb-ipam/argocd-application.yaml.in and this module disagree about the tokens.";
        }
      ];
    }
    (lib.mkIf (valid && isServer) {
      services.k3s.manifests.zeta-lb-pool.source = pkgs.writeText "zeta-lb-pool.yaml" rendered;
    })
  ];
}
