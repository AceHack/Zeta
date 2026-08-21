# full-ai-cluster/nixos/modules/cluster-discovery-advertise.nix
#
# THE PUBLISHER half of bootstrap-or-join (081KSE6WT0008QG0R000CV98PV; R3 of
# the USB design document). A control plane says "a Zeta cluster lives here",
# on the segment, in a form a booting node can read.
#
# Nothing could ever have been discovered before this module, because nothing
# advertised. `common.nix` runs avahi with `publish.enable`, which publishes
# the HOST (an A record for `<hostname>.local`) and no SERVICE -- so a probe
# browsing `_zeta-k3s._tcp` would have found silence on a working cluster and
# founded a second one. This module is the missing record.
#
# WHAT IS PUBLISHED
#   service type  _zeta-k3s._tcp          (DNS-SD, RFC 6763)
#   port          6443                    (the k3s API, what --server dials)
#   txtvers=1     schema version          (RFC 6763 section 6.7)
#   cluster=<64 hex>  sha256 of the k3s server CA certificate
#   td=<trust domain> identity namespace  (matches the SPIRE trustDomain)
#   role=control-plane
#   node=<hostname>
#
# WHAT IS NOT PUBLISHED: the k3s node-token, or any other credential, in any
# form. mDNS is unauthenticated multicast; a guest laptop on the same switch
# receives every record. The backlog row for this work proposed carrying the
# token in the TXT record "since the cluster network is trusted"; that is
# refused here. The CA hash below is the PUBLIC half and is enough -- it lets a
# joiner check that the thing that answered is the cluster its token was minted
# by, and it gives an eavesdropper nothing it did not already get from the TLS
# handshake.
#
# WHY A RUNTIME-WRITTEN SERVICE FILE AND NOT `services.avahi.extraServiceFiles`
# ----------------------------------------------------------------------------
# The cluster id is the digest of a certificate that does not exist at Nix
# evaluation time -- k3s mints the server CA on first boot. An eval-time
# service file could therefore only carry a placeholder, and a placeholder
# cluster id is worse than none: it would make two unrelated clusters
# advertise the SAME identity and read as one HA cluster to every joiner.
#
# So a oneshot unit computes the digest after k3s has written its CA and
# writes `/etc/avahi/services/zeta-cluster.service`. avahi-daemon watches that
# directory and picks the file up without a restart. The unit is idempotent
# (same inputs, byte-identical file, re-run changes nothing) and it REMOVES a
# stale file rather than leaving one behind if the CA disappears.
#
# UNRUN. This module has never been evaluated by a nixos-rebuild and never
# booted. What is checked is the option names against `k3s-server.nix`, the
# CA path against k3s upstream, and the TXT keys against the TypeScript reader
# (`nixos/cluster-discovery/nix-contract.test.ts` fails if they drift).

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.clusterDiscovery.advertise;

  # k3s writes its cluster CA here on the founding server, and every server in
  # the cluster carries the same one -- which is exactly why its digest names
  # the CLUSTER rather than the node.
  serverCaPath = "/var/lib/rancher/k3s/server/tls/server-ca.crt";

  serviceFilePath = "/etc/avahi/services/zeta-cluster.service";

  # The avahi service file, as a TEMPLATE. The cluster id is a placeholder
  # because the value it names is minted at first boot, not at eval time; the
  # unit below substitutes it. Built by joining double-quoted lines rather than
  # as one block string so the port and trust domain interpolate from options
  # and cannot drift from what the module declares.
  serviceTemplate = pkgs.writeText "zeta-cluster.service.template" (lib.concatStringsSep "\n" [
    "<?xml version=\"1.0\" standalone=\"no\"?>"
    "<!DOCTYPE service-group SYSTEM \"avahi-service.dtd\">"
    "<service-group>"
    "  <name replace-wildcards=\"yes\">Zeta cluster control plane on %h</name>"
    "  <service>"
    "    <type>_zeta-k3s._tcp</type>"
    "    <port>${toString cfg.port}</port>"
    "    <txt-record>txtvers=1</txt-record>"
    "    <txt-record>cluster=@CLUSTER_ID@</txt-record>"
    "    <txt-record>td=${cfg.trustDomain}</txt-record>"
    "    <txt-record>role=control-plane</txt-record>"
    "    <txt-record>node=@NODE@</txt-record>"
    "  </service>"
    "</service-group>"
    ""
  ]);

  # The publisher, as a script rather than an eval-time file: it substitutes
  # the cluster id, and it WITHDRAWS a stale advertisement when the CA is gone
  # (a node demoted or re-imaged must stop claiming to be a control plane).
  advertiseScript = pkgs.writeShellScript "zeta-cluster-advertise" (lib.concatStringsSep "\n" [
    "set -euo pipefail"
    "serviceFile=\"${serviceFilePath}\""
    "ca=\"${serverCaPath}\""
    "if [ ! -s \"$ca\" ]; then"
    "  if [ -e \"$serviceFile\" ]; then"
    "    ${pkgs.coreutils}/bin/rm -f \"$serviceFile\""
    "    echo \"zeta-cluster-advertise: k3s server CA absent; withdrew the stale advertisement\""
    "  fi"
    "  echo \"zeta-cluster-advertise: waiting for the k3s server CA at $ca\""
    "  exit 1"
    "fi"
    "# sha256 of the CA PEM. This is now VERIFIED against k3s's own source rather"
    "# than assumed -- pkg/clientaccess/token.go hashCA(): when the bundle holds a"
    "# SINGLE certificate the hash is taken over the literal bytes of the file"
    "# (the usual PEM-encoded self-signed cluster CA), which is exactly what"
    "# sha256sum computes here. But when the bundle holds MORE THAN ONE"
    "# certificate, k3s hashes the DER of the ROOT certificate in the chain"
    "# instead, and this file digest silently diverges from the K10 prefix."
    "#"
    "# A wrong cluster id is worse than none: joiners that pin would refuse every"
    "# join while the record still looked healthy. So the multi-cert case REFUSES"
    "# TO PUBLISH rather than publishing an id we cannot compute correctly."
    "certs=\"$(${pkgs.gnugrep}/bin/grep -c '^-----BEGIN CERTIFICATE-----' \"$ca\" || true)\""
    "if [ \"$certs\" != \"1\" ]; then"
    "  if [ -e \"$serviceFile\" ]; then"
    "    ${pkgs.coreutils}/bin/rm -f \"$serviceFile\""
    "  fi"
    "  echo \"zeta-cluster-advertise: CA bundle at $ca holds $certs certificates, not 1;\""
    "  echo \"  k3s hashes the DER of the ROOT cert in that case, so the file digest is\""
    "  echo \"  NOT the K10 prefix. Refusing to advertise a cluster id we would compute\""
    "  echo \"  wrongly -- see pkg/clientaccess/token.go hashCA().\""
    "  exit 1"
    "fi"
    "digest=\"$(${pkgs.coreutils}/bin/sha256sum \"$ca\" | ${pkgs.coreutils}/bin/cut -c1-64)\""
    "node=\"$(${pkgs.coreutils}/bin/cat /proc/sys/kernel/hostname | ${pkgs.coreutils}/bin/tr A-Z a-z)\""
    "${pkgs.coreutils}/bin/mkdir -p /etc/avahi/services"
    "${pkgs.gnused}/bin/sed -e \"s|@CLUSTER_ID@|$digest|\" -e \"s|@NODE@|$node|\" ${serviceTemplate} | ${pkgs.coreutils}/bin/tee \"$serviceFile\""
    "echo \"zeta-cluster-advertise: published _zeta-k3s._tcp for cluster $digest as node $node\""
    ""
  ]);
in
{
  options.zeta.clusterDiscovery.advertise = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = config.services.k3s.enable == true;
      defaultText = lib.literalExpression "config.services.k3s.enable";
      description = "Publish this node as a Zeta control plane over mDNS. Guarded to k3s SERVERS in the config below: an agent that advertised would invite joins to a node with no API server, and the record exists to name something dialable.";
    };

    trustDomain = lib.mkOption {
      type = lib.types.str;
      default = "zeta.local";
      description = "Identity namespace this cluster serves, advertised as the td TXT key. The default matches the SPIRE trustDomain in k8s/bootstrap/spire-install.yaml, so the value a joiner checks is the value the cluster issues identities under. Two clusters that must never merge MUST differ here.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 6443;
      description = "Advertised SRV port: the k3s API port a joiner dials.";
    };
  };

  config = lib.mkIf cfg.enable (lib.mkMerge [
    (lib.mkIf (config.services.k3s.role == "server") {
      # avahi is already on for every host via common.nix; publishing a SERVICE
      # additionally requires publish.userServices, which common.nix sets.
      # Asserted rather than assumed: without it this unit writes a file avahi
      # reads and then declines to announce, which looks exactly like success.
      assertions = [
        {
          assertion = config.services.avahi.enable;
          message = "zeta.clusterDiscovery.advertise needs services.avahi.enable (common.nix normally provides it)";
        }
        {
          assertion = config.services.avahi.publish.enable;
          message = "zeta.clusterDiscovery.advertise needs services.avahi.publish.enable, or the record is written and never announced";
        }
      ];

      systemd.services.zeta-cluster-advertise = {
        description = "Publish this control plane as _zeta-k3s._tcp for bootstrap-or-join discovery";
        wantedBy = [ "multi-user.target" ];
        wants = [ "k3s.service" "avahi-daemon.service" ];
        after = [ "k3s.service" "avahi-daemon.service" ];
        serviceConfig = {
          Type = "oneshot";
          RemainAfterExit = true;
          User = "root";
          # The k3s server CA does not exist until k3s has come up, and on a
          # first boot that is minutes away. Retrying is the mechanism that
          # makes this unit ordering-insensitive; each attempt is idempotent.
          Restart = "on-failure";
          RestartSec = "15s";
          ExecStart = advertiseScript;
        };
      };
    })
  ]);
}
