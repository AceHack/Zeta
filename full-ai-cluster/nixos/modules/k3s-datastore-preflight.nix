# full-ai-cluster/nixos/modules/k3s-datastore-preflight.nix
#
# THE DIRTY-DISK CASE, MADE LOUD.
#
# k3s, verbatim from its own documentation:
#
#   "If an etcd datastore is found on disk ... the datastore arguments
#    (--cluster-init, --server, --datastore-endpoint, etc) are IGNORED."
#
# Read that against `injected-server-join.nix`. Every option that module sets —
# `clusterInit = false`, `serverAddr`, `tokenFile` — is a datastore argument.
# So on a node that already holds a k3s server datastore, a DECLARATIVE JOIN IS
# A NO-OP. The unit starts, the flags are parsed, the datastore on disk wins,
# and the node quietly continues being the cluster it already was. Nothing
# fails. Nothing is logged as wrong. `systemctl status k3s` is green.
#
# On a genuinely from-scratch flash that is fine — there is no datastore, so
# nothing is ignored. This module exists for the case the from-scratch
# assumption does not hold: a re-flash onto a disk whose k3s state survived, an
# install that reused a partition, a `nixos-rebuild` onto a node that founded
# once. In every one of those the operator asked for a join and got a founding
# node, and found out later by counting CAs.
#
# WHAT IT DOES
# ------------
# A oneshot ordered BEFORE k3s.service and `requiredBy` it. When the node is
# PROVISIONED TO JOIN (`/etc/zeta/cluster-join-server-url` is present) and a
# k3s server datastore already exists on disk, it refuses: prints the reason to
# the console and to the serial port, and exits non-zero. `requiredBy` makes
# k3s.service fail with it — FAIL CLOSED. A node that cannot join the cluster
# it was flashed for does not silently become a second one.
#
# WHAT IT REFUSES TO DO
# ---------------------
# IT NEVER DELETES ANYTHING. Not the datastore, not the token, not the
# certificates. A boot-path `rm -rf /var/lib/rancher/k3s/server` would "fix"
# this in one line and would be confiscation we introduced — an irreversible
# destruction of the one thing on the machine that cannot be regenerated
# (manifesto §5 memory preservation). k3s already fails closed here; the only
# thing missing was somebody saying so out loud. The remediation is printed and
# is the operator's to run.
#
# WHY A RUNTIME UNIT AND NOT A NIX ASSERTION. The datastore's existence is a
# property of the DISK AT BOOT, not of the configuration. A `nixos-install`
# from the USB evaluates against a freshly formatted target where the datastore
# legitimately does not exist yet; the same closure boots later on a disk where
# it does. Only a runtime check sees the state that matters.
#
# NOT A HEALTH CHECK. It says nothing about whether the join succeeds — that is
# `k3s-join-observer.nix`'s job, and it observes a different fact at a later
# time. This one only rules out the single failure mode that produces no
# symptom at all.
#
# UNVERIFIED ON HARDWARE: no node has booted this unit. What IS checked, and
# where:
#   - the refusal LOGIC, by EXECUTING `k3s-datastore-preflight.sh` over fixture
#     directories in `src/Core.TypeScript/hygiene/lint-k3s-datastore-preflight.test.ts`
#     — every branch, every exit status, plus the property that no fixture file
#     is ever removed. That test runs in CI (`bun test src/Core.TypeScript/hygiene/`).
#   - the UNIT WIRING (`before` + `requiredBy` = fail closed, and the
#     environment the script reads), by the same test reading this file. A unit
#     wired `wantedBy` instead of `requiredBy` would let k3s start anyway, which
#     is the vacuity class in unit-file form, and nothing else in the tree would
#     notice.
# What is NOT checked anywhere: that systemd honours the ordering on a real
# boot. That needs a booted guest.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.k3sDatastorePreflight;

  # The refusal logic lives in `k3s-datastore-preflight.sh` — a standalone
  # script rather than a Nix string, so that a test can EXECUTE it instead of
  # reading it. `src/Core.TypeScript/hygiene/lint-k3s-datastore-preflight.test.ts`
  # runs it over fixture directories and asserts each exit status; that matters
  # because no workflow in this repository runs `nix flake check` on
  # `full-ai-cluster/flake.nix`, so a Nix-only check here would be one nothing
  # executes.
  preflightScript = ./k3s-datastore-preflight.sh;
in
{
  options.zeta.k3sDatastorePreflight = {
    enable = lib.mkEnableOption "fail-closed refusal when a join-provisioned node already holds a k3s datastore";

    joinServerUrlFile = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/cluster-join-server-url";
      description = ''
        Presence of this file is what "provisioned to join" means. Staged by
        `zeta-install.sh` and read at evaluation time by
        `injected-join-server.nix` (agents) and `injected-server-join.nix`
        (servers). Absent, this unit passes and changes nothing.
      '';
    };

    datastoreDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/rancher/k3s/server/db/etcd";
      description = ''
        The embedded-etcd datastore whose EXISTENCE makes k3s ignore every
        datastore argument. Named specifically rather than checking
        `/var/lib/rancher/k3s/server`, which k3s' own tmpfiles rule and a
        partial install both create without any cluster state in them — a
        check on the parent would refuse boots that are perfectly fine.
      '';
    };

    serialDevice = lib.mkOption {
      type = lib.types.str;
      default = "/dev/ttyS0";
      description = "Where the refusal is echoed in addition to the console.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-k3s-datastore-preflight = {
      description = "Refuse to start k3s when a join-provisioned node already holds a datastore";
      # `before` + `requiredBy` together are what make this FAIL CLOSED: k3s
      # cannot start ahead of it, and k3s fails when it fails. `wantedBy` would
      # let k3s start anyway, which is the vacuity class in unit-file form.
      before = [ "k3s.service" ];
      requiredBy = [ "k3s.service" ];
      environment = {
        ZETA_JOIN_URL_FILE = cfg.joinServerUrlFile;
        ZETA_DATASTORE_DIR = cfg.datastoreDir;
        ZETA_SERIAL_DEVICE = cfg.serialDevice;
      };
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        ExecStart = "${pkgs.bash}/bin/bash ${preflightScript}";
        StandardOutput = "journal+console";
        StandardError = "journal+console";
      };
    };
  };
}
