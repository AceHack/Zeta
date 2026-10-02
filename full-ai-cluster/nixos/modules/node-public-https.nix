# full-ai-cluster/nixos/modules/node-public-https.nix
#
# docs/ops/INSTALL-TIME-CONFIG.md row 31 -- inbound TCP 443 on the NODE.
#
# THE DEFECT (MEASURED 2026-10-02, node-5b2dfa). Public HTTPS never reached the node: the NixOS firewall
# (`nixos-fw`) had no rule for TCP 443. A home router can port-forward only to a DEVICE, never to a
# Cilium LoadBalancer address (docs/ops/ROUTER-PORT-FORWARD-AMBIGUITY.md), so the forward lands on the
# node's own address, and the node's own :443 is served by the `node-lan-hosts` relay
# (k8s/applications/cluster-hygiene/node-lan-hosts.yaml: a hostNetwork relay on :443 -> the public
# Gateway). The relay listened and the LAN still got no answer, because the firewall dropped the SYN.
# At runtime the DaemonSet worked around it with `iptables -I nixos-fw 1 -p tcp --dport 443 -j
# nixos-fw-accept`. This is that rule, declared: `-A nixos-fw -p tcp --dport 443 -j nixos-fw-accept`
# matches the DaemonSet's `-C` probe exactly, so the two never stack a duplicate.
#
# WHY 443 ONLY, AND NOT 80. Port 80 is deliberately NOT opened: nothing on the host listens on it (the
# relay is :443 only), and a firewall hole with no listener is attack surface that buys nothing. HTTP-01's
# :80 reaches the public Gateway through Cilium's eBPF datapath on its LoadBalancer address, which never
# consulted `nixos-fw` -- measured: a :80 forward reached the Gateway at .250 with no 80 rule in the
# firewall (ROUTER-PORT-FORWARD-AMBIGUITY.md). If a :80 relay is ever added, open 80 HERE in the same change.
#
# WHY UNCONDITIONAL, NOT GATED ON THE PUBLIC DOMAIN. Gating would read /etc/zeta/public-domain, and under
# a pure `nixos-rebuild` (`builtins.pathExists` on an absolute path is false) the hole would close
# silently on a node that serves public HTTPS -- the failure this file exists to remove, delivered by a
# routine update. An open port nothing listens on is refused by the kernel exactly like a closed one; the
# exposure is precisely the relay, which only binds once a Gateway exists.
#
# EVERY NODE, NOT ONLY THE SERVER. The relay is a DaemonSet (tolerates everything), so a worker runs it
# too, and a router can be pointed at any node. Imported by BOTH k3s-server.nix and k3s-agent.nix.
#
# NOT VERIFIED: that NixOS renders the rule, and that the router then delivers. The eval test
# nixos/tests/installer-parity-eval-test.nix pins the option on both real hosts in CI.

{ ... }:

{
  networking.firewall.allowedTCPPorts = [
    443   # public HTTPS: the node-lan-hosts relay (TLS passthrough to the public Gateway)
  ];
}
