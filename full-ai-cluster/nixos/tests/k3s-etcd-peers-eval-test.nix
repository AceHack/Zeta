# full-ai-cluster/nixos/tests/k3s-etcd-peers-eval-test.nix
#
# Properties of nixos/modules/k3s-etcd-peers.nix — the opt-in, source-scoped
# admission of etcd 2379/2380 that multi-server HA needs, and the evaluation-time
# refusal of a JOINING control plane that nothing admits etcd traffic to
# (081M10ZG61D087G0R001A70F0P).
#
# NOT a VM test: pure evaluation of real `nixosSystem`s built from the SHIPPED
# `k3s-server.nix`, plus the real `nixosConfigurations.control-plane`. Forced by
# `checks.<system>.k3s-etcd-peers-model`, so `nix flake check --no-build` runs it.
#
# EVERY PROPERTY IS A MUTATION THAT WAS (OR WOULD BE) SILENT:
#   * the shipped control-plane host is UNCHANGED — no peers, no etcd rule. This
#     module must not be a firewall-default change on the hardware path;
#   * a founder with no peers carries no etcd rule and no refusal;
#   * a JOINING server with every etcd port closed is REFUSED. The first draft
#     of the module passed this case, because NixOS appends `lo` to every host's
#     trustedInterfaces and the "extra trusted interface" escape counted it;
#   * a joiner with ONE of the two ports open is still refused;
#   * the product option, and a correctly-scoped per-interface override, are
#     both ACCEPTED — reading only the flat port list would refuse the latter,
#     which is exactly the override `k3s-server.nix`'s comment prescribes;
#   * peers render as source-scoped iptables ACCEPTs inserted at the head of
#     nixos-fw (never as flat allowedTCPPorts), and as an nftables input rule
#     when nftables is the backend;
#   * a non-IPv4 peer is refused rather than rendered into a rule that matches
#     nothing.
#
# WHAT IT CANNOT TELL YOU: that the rule admits a packet. The VM tests
# k3s-server-join and k3s-ha-longhorn-cluster probe the ports across guests.

{ lib, nixpkgs, controlPlaneConfig }:

let
  serverModule = ../modules/k3s-server.nix;

  sys = extra: (nixpkgs.lib.nixosSystem {
    system = "x86_64-linux";
    modules = [
      serverModule
      {
        boot.loader.grub.enable = false;
        fileSystems."/" = { device = "/dev/vda"; fsType = "ext4"; };
        system.stateVersion = "25.11";
      }
      extra
    ];
  }).config;

  failed = c: map (a: a.message) (builtins.filter (a: !a.assertion) c.assertions);
  refusesJoin = c: lib.any (m: lib.hasInfix "nothing admits etcd peer traffic" m) (failed c);

  joinAddr = { services.k3s.serverAddr = "https://control-plane:6443"; };

  expect = name: cond: if cond then true else throw "k3s-etcd-peers: property FAILED: ${name}";

  shipped = controlPlaneConfig.config;
  founder = sys { };
  joinerClosed = sys joinAddr;
  joinerHalf = sys (joinAddr // { networking.firewall.allowedTCPPorts = [ 2379 ]; });
  joinerPeers = sys (joinAddr // { zeta.k3sServer.etcdPeers = [ "10.88.0.1/32" ]; });
  joinerIface = sys (joinAddr // { networking.firewall.interfaces.eth1.allowedTCPPorts = [ 2379 2380 ]; });
  withPeers = sys { zeta.k3sServer.etcdPeers = [ "10.88.0.2/32" "10.88.0.3" ]; };
  withNft = sys {
    zeta.k3sServer.etcdPeers = [ "10.88.0.2/32" ];
    networking.nftables.enable = true;
  };
  badPeer = sys { zeta.k3sServer.etcdPeers = [ "fe80::1" ]; };

  props = [
    (expect "shipped control-plane declares no etcd peers" (shipped.zeta.k3sServer.etcdPeers == [ ]))
    (expect "shipped control-plane renders no etcd rule"
      (!(lib.hasInfix "2379" shipped.networking.firewall.extraCommands)))
    (expect "shipped control-plane keeps 2379/2380 out of the flat list"
      (!(lib.elem 2379 shipped.networking.firewall.allowedTCPPorts)
        && !(lib.elem 2380 shipped.networking.firewall.allowedTCPPorts)))
    (expect "a founder with no peers is not refused" (failed founder == [ ]))
    (expect "a founder with no peers renders no etcd rule"
      (!(lib.hasInfix "2379" founder.networking.firewall.extraCommands)))
    (expect "a JOINER with every etcd port closed is refused (the lo mutation)" (refusesJoin joinerClosed))
    (expect "a joiner with only 2379 open is still refused" (refusesJoin joinerHalf))
    (expect "a joiner with the product option is accepted" (!(refusesJoin joinerPeers)))
    (expect "a joiner with a per-interface override is accepted" (!(refusesJoin joinerIface)))
    (expect "peers render as source-scoped ACCEPTs inserted at the head of nixos-fw"
      (lib.hasInfix "iptables -w -I nixos-fw -p tcp -s 10.88.0.2/32 -m multiport --dports 2379,2380 -j nixos-fw-accept"
        withPeers.networking.firewall.extraCommands
        && lib.hasInfix "-s 10.88.0.3 " withPeers.networking.firewall.extraCommands))
    (expect "peers never land in the flat allowedTCPPorts"
      (!(lib.elem 2379 withPeers.networking.firewall.allowedTCPPorts)))
    (expect "the nftables backend gets a source-scoped input rule"
      (withNft.networking.firewall.extraInputRules
        == "ip saddr { 10.88.0.2/32 } tcp dport { 2379, 2380 } accept"))
    (expect "a non-IPv4 peer is refused"
      (lib.any (m: lib.hasInfix "refusing fe80::1" m) (failed badPeer)))
  ];
in
{
  status =
    if lib.all (p: p) props
    then "k3s-etcd-peers: ${toString (builtins.length props)} properties hold (shipped host unchanged; joiner refusal non-vacuous; peers source-scoped)"
    else throw "unreachable: every failing property throws";
}
