# full-ai-cluster/nixos/modules/injected-public-hosts.nix
#
# docs/ops/INSTALL-TIME-CONFIG.md row 30 -- the node's OWN resolver answers the two public names
# the kubelet pulls images through, from the public domain this install already carries.
#
# THE DEFECT (MEASURED 2026-10-02, node-5b2dfa). The kubelet and containerd resolve through the HOST
# resolver. `registry.<domain>` / `gitlab.<domain>` are public names, so the node got the PUBLIC IP,
# reachable only by hairpinning through the home router, and the router did not hairpin: every pull
# from the in-cluster registry failed `dial tcp <public-ip>:443: i/o timeout`. NixOS's /etc/hosts is a
# read-only symlink into /etc/static, so the only runtime fix was a privileged DaemonSet bind-mounting
# a replacement over it -- a workaround for something the OS layer owns. This module is that entry,
# declared where /etc/hosts is declared.
#
# THE MECHANISM -- the one the public domain already uses (injected-public-tls.nix, INJECTION-POINTS.md
# §10), not a second one: zeta-install.sh writes /etc/zeta/public-domain; this module reads the SAME
# file. Absent -> contributes nothing (a LAN-only install has no public name to answer).
#
# WHAT IT MAPS TO, AND WHY -- the whole decision is in nixos/lib/public-hosts.nix's header: loopback,
# reaching the `node-lan-hosts` relay, because the Gateway's LoadBalancer address is cluster state a
# static line cannot know and cannot correct. Read that header before changing the address.
#
# PURE-EVAL NOTE (see injected-hostname.nix): `builtins.pathExists` on an absolute path is false in pure
# evaluation, so a rebuild without `--impure` silently drops these lines. The failure direction is the
# pre-existing behaviour (the node resolves the public IP again), not a new one; every nixos-rebuild in
# this repo carries `--impure` and lint-nixos-rebuild-needs-impure.ts keeps it that way.
#
# NOT VERIFIED (no nix on the authoring machine, nothing booted): that NixOS renders these lines into
# /etc/hosts, and that containerd then dials the relay. nixos/tests/injected-public-hosts-eval-test.nix
# pins the pure function in CI; only a node shows the pull.

{ config, lib, ... }:

let
  publicHosts = import ../lib/public-hosts.nix { inherit lib; };

  domainFile = "/etc/zeta/public-domain";
  readTrimmed = f:
    if builtins.pathExists f
    then
      let m = builtins.match "[[:space:]]*([^[:space:]]*)[[:space:]]*" (builtins.readFile f);
      in if m == null then "" else builtins.head m
    else "";
  domain = lib.toLower (readTrimmed domainFile);
in
{
  # `networking.hosts` is attrsOf (listOf str): this MERGES with `127.0.0.1 = [ "localhost" ]` and
  # k3s-server.nix's `control-plane`, it does not replace them. An empty fragment merges as nothing.
  networking.hosts = lib.mkIf config.services.k3s.enable (publicHosts.hostsFor domain);
}
