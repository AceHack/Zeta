# full-ai-cluster/nixos/modules/k3s-etcd-peers.nix
#
# EMBEDDED-ETCD PEER ADMISSION: the product half of multi-server HA.
#
# THE DEFECT THIS CLOSES (081M10ZG61D087G0R001A70F0P, P1 false green)
# ------------------------------------------------------------------
# `k3s-server.nix` keeps etcd's 2379 (client / MemberAdd) and 2380 (peer) out of
# the host firewall, and it is right to: etcd holds every Secret the cluster
# has. But `injected-server-join.nix` SHIPS a second-control-plane join (zflash
# `--role joiner` onto the `control-plane` host), and a role=server join IS etcd
# membership. With both ports closed that join cannot complete — measured, run
# 33035015161:
#
#   Adding member joiner-6aba2ae3=https://192.168.1.2:2380
#          to etcd cluster [founder-dce5ce45=https://192.168.1.1:2380]
#   refused connection: IN=eth1 SRC=192.168.1.2 DST=192.168.1.1 DPT=2379
#   Retrying etcd cluster join: MemberAdd request timed out
#
# `nixos/tests/k3s-server-join.nix` went green anyway, because the TEST opened
# 2379/2380 (`allowedTCPPorts = lib.mkAfter [ 2379 2380 ]`) — a harness posture
# the product never had. CI proved a join no shipped machine could perform.
#
# THE DECISION: server HA IS SUPPORTED, AND IT IS OPT-IN AND SOURCE-SCOPED
# ------------------------------------------------------------------------
# Two honest options existed: (a) server HA is unsupported and every test that
# claims it stops claiming it, or (b) the product can express it. (a) would mean
# deleting a shipped module (`injected-server-join.nix`) and the zflash joiner
# path for control planes, which the maintainer asked for by name ("we want to
# test clustering too"). So (b) — but in exactly the shape `k3s-server.nix`'s own
# comment has prescribed since it was written, and never implemented:
#
#   "For multi-server HA, add 2379/2380 to a host-specific override that ALSO
#    scopes them with `interfacesIn`/source-IP filtering to the other
#    control-plane nodes only."
#
# `zeta.k3sServer.etcdPeers` is that override, as an option instead of a
# copy-pasted firewall snippet:
#
#   etcdPeers = [ ]   (DEFAULT) -> nothing changes. 2379/2380 stay closed. Every
#                                 existing host is byte-identical: this is not a
#                                 firewall-default change on the hardware path.
#   etcdPeers = [ "10.88.0.2/32" … ] -> 2379/2380 are admitted FROM THOSE SOURCES
#                                 ONLY. Not `allowedTCPPorts` — that would open
#                                 them to every address that can reach the NIC,
#                                 which is the LAN-wide exposure the product
#                                 comment refuses.
#
# The VM tests now set THIS option rather than their own firewall ports, so the
# harness exercises the product's posture instead of exceeding it.
#
# THE JOINER HALF IS CHECKABLE AT EVALUATION, AND IS CHECKED
# ----------------------------------------------------------
# A role=server node with `serverAddr` set WILL join etcd; that is known here. If
# nothing on it admits etcd peer traffic, the join cannot complete (the founder
# must also reach the joiner's :2380), so evaluation refuses and names the option.
# That converts a crash-loop discovered on hardware into a build error.
#
# "Admits" deliberately reads all three ways NixOS can admit a port, because
# reading only the flat list would REFUSE a correctly-scoped override (the
# caveat recorded on the work item): this option, both ports in the global
# `allowedTCPPorts`, both ports in some `interfaces.<n>.allowedTCPPorts`, or a
# trusted interface beyond the Cilium/CNI set `k3s-server.nix` itself trusts.
#
# THE FOUNDER HALF IS NOT CHECKABLE HERE, and that is stated, not hidden: a
# founder cannot know at evaluation time that someone will join it later. A
# founder with `etcdPeers = [ ]` refuses every joiner at runtime, exactly as
# before. Closing that half needs a runtime probe on the JOINER before k3s starts
# (the `k3s-datastore-preflight.nix` pattern) — still open on the work item.
#
# WHAT IS STILL NOT DECIDED HERE (deliberately):
#   * where a real host's peer list comes from. Nothing auto-populates it — not
#     `injected-cluster-address.nix`, not the installer — because turning a flash
#     medium into an open etcd port is a firewall default on the hardware path,
#     and that is the maintainer's call. Today a host sets it explicitly.
#   * `--node-ip` on multi-homed hardware (081M10ZG624087G0R003JW3K8E): etcd
#     advertises on the default-route interface, which the peers may not share.
#
# IPv4 only: every address this cluster tree derives (segment, CIDRs) is IPv4,
# and an IPv6 entry would silently match nothing under `iptables`. Refused at
# evaluation rather than accepted and ignored.

{ config, lib, ... }:

let
  cfg = config.zeta.k3sServer;
  fw = config.networking.firewall;

  etcdPorts = [ 2379 2380 ];

  isServer = config.services.k3s.role == "server";
  joining = isServer && config.services.k3s.serverAddr != "";

  hasBoth = ports: lib.all (p: lib.elem p ports) etcdPorts;

  # The interfaces `k3s-server.nix` / `k3s-agent.nix` already trust — pod-side
  # Cilium/CNI devices — plus `lo`, which NixOS's firewall module appends to
  # every host's trustedInterfaces. Etcd peers arrive on the node's NIC, never
  # on these, so they do not count as admitting peer traffic.
  #
  # `lo` is here because its absence made the joiner assertion below VACUOUS:
  # the first draft excluded only the four CNI names, so `extraTrusted` was
  # always `[ "lo" ]` and a joining server with every etcd port closed passed.
  # Caught by evaluating that exact mutation, not by reading the code.
  cniTrusted = [ "cilium_host" "cilium_net" "cni0" "lxc+" "lo" ];
  extraTrusted = lib.filter (i: !(lib.elem i cniTrusted)) fw.trustedInterfaces;

  admitsEtcdPeers =
    cfg.etcdPeers != [ ]
    || hasBoth fw.allowedTCPPorts
    || lib.any (i: hasBoth (i.allowedTCPPorts or [ ])) (lib.attrValues fw.interfaces)
    || extraTrusted != [ ];

  ipv4OrCidr = s: builtins.match "[0-9]{1,3}(\\.[0-9]{1,3}){3}(/[0-9]{1,2})?" s != null;
  badPeers = lib.filter (s: !(ipv4OrCidr s)) cfg.etcdPeers;

  # One rule per source. `-I` (insert at the head), not `-A`: NixOS's iptables
  # start script appends the terminal `-j nixos-fw-log-refuse` BEFORE it runs
  # `extraCommands`, so an appended ACCEPT would sit after the refusal and never
  # be reached. The chain is flushed on every (re)start, so there is nothing to
  # accumulate; the stop commands exist only so a `stop` leaves no residue.
  iptablesRule = verb: src:
    "iptables -w ${verb} nixos-fw -p tcp -s ${src} -m multiport --dports "
    + "${lib.concatMapStringsSep "," toString etcdPorts} -j nixos-fw-accept";
in
{
  options.zeta.k3sServer.etcdPeers = lib.mkOption {
    type = lib.types.listOf lib.types.str;
    default = [ ];
    example = [ "10.88.0.1/32" "10.88.0.2/32" "10.88.0.3/32" ];
    description = ''
      IPv4 addresses or CIDRs of the OTHER control-plane nodes in an embedded-etcd
      HA cluster. When non-empty, this node admits TCP 2379 (etcd client /
      MemberAdd) and 2380 (etcd peer) from these sources ONLY. Empty (the
      default) leaves both ports closed, which is correct for a single server
      and for every agent.

      Required on EVERY server of a multi-server cluster — the founder included,
      since joiners dial its :2379 and every member dials every other's :2380.
      Evaluation refuses a role=server node that is joining (`serverAddr` set)
      while nothing admits etcd peer traffic.
    '';
  };

  config = lib.mkMerge [
    {
      assertions = [
        {
          assertion = badPeers == [ ];
          message =
            "zeta.k3sServer.etcdPeers must be IPv4 addresses or CIDRs; refusing "
            + "${lib.concatStringsSep ", " badPeers}. An entry iptables cannot "
            + "match would look like peer admission and admit nothing.";
        }
        {
          assertion = !joining || admitsEtcdPeers;
          message =
            "this control plane is configured to JOIN ${config.services.k3s.serverAddr} "
            + "as an embedded-etcd member, but nothing admits etcd peer traffic "
            + "(TCP 2379/2380): zeta.k3sServer.etcdPeers is empty and no firewall "
            + "rule opens both ports. The join would crash-loop on `MemberAdd request "
            + "timed out` (measured, run 33035015161). Set zeta.k3sServer.etcdPeers "
            + "to the other control planes' addresses on EVERY server — the founder "
            + "too. See nixos/modules/k3s-etcd-peers.nix.";
        }
      ];
    }

    (lib.mkIf (isServer && cfg.etcdPeers != [ ] && !config.networking.nftables.enable) {
      networking.firewall.extraCommands =
        lib.concatMapStringsSep "\n" (iptablesRule "-I") cfg.etcdPeers;
      networking.firewall.extraStopCommands =
        lib.concatMapStringsSep "\n" (s: "${iptablesRule "-D" s} || true") cfg.etcdPeers;
    })

    (lib.mkIf (isServer && cfg.etcdPeers != [ ] && config.networking.nftables.enable) {
      networking.firewall.extraInputRules =
        "ip saddr { ${lib.concatStringsSep ", " cfg.etcdPeers} } "
        + "tcp dport { ${lib.concatMapStringsSep ", " toString etcdPorts} } accept";
    })
  ];
}
