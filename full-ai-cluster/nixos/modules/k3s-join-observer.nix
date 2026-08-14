# full-ai-cluster/nixos/modules/k3s-join-observer.nix
#
# OBSERVATION ONLY. This module implements NO join.
#
# Aaron 2026-08-13, answering the open question on PR #10493:
#
#   "k3s's join is the join, don't invent our own"
#
# So there is no Zeta join protocol to build. What was missing was not a
# protocol — it was a WITNESS. `081KSNY2Z0008QG0R0008PN7RQ` scenario 5
# (cluster-joining) asserts two serial strings
# (`B0891_CLUSTER_JOIN_SERIAL_MARKERS` in
# `src/Core.TypeScript/zflash/test-harness/serial-markers.ts`), and before this
# module the only producer of those strings anywhere in the repository was a
# mock serial log inside `multi-vm.test.ts` (measured on PR #10493: 45 guest
# files scanned, 0 sightings). A harness cannot observe a join that never
# announces itself.
#
# This unit announces it. It watches k3s's OWN agent-to-server join — the
# token handshake `services.k3s.{serverAddr,tokenFile}` already performs — and
# writes the contract markers to the console and to the serial port. It does
# not dial anything, does not hand out credentials, and does not decide
# anything. If k3s does not join, this unit emits no success marker and fails.
#
# TWO MARKERS, TWO INDEPENDENT FACTS
# ----------------------------------
# The markers are deliberately NOT two names for one observation — an
# assertion that cannot fail independently is not an assertion
# (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
#
#   marker 1  "cluster join successful"
#             The SERVER issued this node a kubelet client certificate, and
#             the API server accepts it. Evidence: the k3s-managed credential
#             at `client-kubelet.crt` exists AND an authenticated request as
#             this node succeeds. Neither is obtainable without a successful
#             token handshake against `serverAddr` — the join itself.
#
#   marker 2  "joining-node added to the cluster state"
#             The API server's node registry CONTAINS this node: `get node
#             <self>` returns an object carrying a `metadata.uid`. This is a
#             strictly later and separable fact — a node can hold a valid
#             client certificate (marker 1) and still fail to register (name
#             collision with an existing node, kubelet refusing to start,
#             API unreachable after issuance). Marker 1 without marker 2 is a
#             real and diagnosable state, which is what makes marker 2 worth
#             asserting.
#
# What is deliberately NOT asserted: `Ready=True`. Readiness requires the
# Cilium CNI image, which requires the internet, and conflating "joined" with
# "healthy" would make the marker unassertable in a hermetic test and would
# silently widen the claim. Same scope line the existing hermetic test draws
# (`nixos/tests/k3s-cluster-init.nix`). Cluster HEALTH is the online lane's
# job (`nixos/tests/k3s-cluster-online.nix`); cluster MEMBERSHIP is this one's.
#
# THE MARKER STRINGS ARE A CROSS-LANGUAGE CONTRACT
# ------------------------------------------------
# These literals must stay byte-identical to the TypeScript constants. Nix
# cannot import TypeScript, so the coupling is enforced from the other side:
# `join-implementation-probe.test.ts` scans this tree for the exact strings
# built from `B0891_CLUSTER_JOIN_SERIAL_MARKERS` and fails if they are not
# found here. Edit either side alone and that test goes red.
#
# Per `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference:
# the unit's only outputs are stdout (journal) and the serial device; it holds
# no ambient state, is idempotent (§12 — re-running observes the same facts and
# re-emits the same lines), and its polling deadline is bounded.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.k3sJoinObserver;

  # Byte-identical to serial-markers.ts B0891_CLUSTER_JOIN_SERIAL_MARKERS.
  # Note the five-space runs — they are part of the contract.
  markerJoinSuccessful = "[081KSNY2Z0008QG0R0008PN7RQ-joining]     cluster join successful";
  markerAddedToCluster = "[081KSNY2Z0008QG0R0008PN7RQ-joining]     joining-node added to the cluster state";
in
{
  options.zeta.k3sJoinObserver = {
    enable = lib.mkEnableOption "serial witness for k3s's agent-to-server join";

    kubeconfig = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/rancher/k3s/agent/kubelet.kubeconfig";
      description = ''
        Kubeconfig used to ask the API server about this node. k3s writes it
        on the agent once the join succeeds. The kubelet identity may read its
        OWN Node object under the Node authorizer, which is exactly the
        privilege this observation needs and no more (least privilege — the
        witness never gets cluster-admin).
      '';
    };

    clientCertificate = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/rancher/k3s/agent/client-kubelet.crt";
      description = ''
        Server-issued kubelet client certificate. Its existence is local
        evidence that the token handshake against `services.k3s.serverAddr`
        completed — the node cannot mint this for itself.
      '';
    };

    timeoutSec = lib.mkOption {
      type = lib.types.ints.positive;
      default = 600;
      description = ''
        Per-attempt deadline for each of the two observations. On expiry the
        unit emits a clearly-distinct `join-not-observed` line (never a
        success marker) and exits non-zero, so an absent join reads as an
        absent join rather than as a silent pass.
      '';
    };

    pollIntervalSec = lib.mkOption {
      type = lib.types.ints.positive;
      default = 5;
      description = "Seconds between polls while waiting for each fact.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-k3s-join-observer = {
      description = "Zeta witness for k3s agent-to-server join (081KSNY2Z0008QG0R0008PN7RQ scenario 5)";
      wantedBy = [ "multi-user.target" ];
      wants = [ "k3s.service" ];
      after = [ "k3s.service" ];

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        User = "root";

        # Retry rather than give up: on real hardware the agent's k3s can be
        # slower than this unit's first attempt (DHCP, disk, image unpack).
        # Bounded per attempt by timeoutSec, so a node that never joins never
        # emits a marker — it just keeps saying so.
        Restart = "on-failure";
        RestartSec = "15s";

        ExecStart = pkgs.writeShellScript "zeta-k3s-join-observer" ''
          set -euo pipefail

          # Mirror to serial so the zflash QEMU harness can observe the join
          # without a login (same channel + same guard as
          # zeta-creds-restore.nix). No serial device present (bare metal with
          # no UART) is not an error — the journal still carries every line.
          _serial=""
          for _dev in /dev/ttyS0 /dev/ttyAMA0; do
            if [ -e "$_dev" ]; then
              _serial="$_dev"
              break
            fi
          done
          log_join() {
            echo "$1"
            if [ -n "$_serial" ]; then
              echo "$1" >> "$_serial" || true
            fi
          }

          # The node's OWN k3s package, not a second copy pulled from pkgs —
          # the witness must speak to the same binary the node is running.
          kubectl_self() {
            ${config.services.k3s.package}/bin/k3s kubectl \
              --kubeconfig "${cfg.kubeconfig}" "$@"
          }

          # /proc, not `hostname(1)`: NixOS does not put a hostname binary on
          # a service's PATH by default, and k3s lower-cases the node name it
          # registers.
          NODE_NAME="$(${pkgs.coreutils}/bin/tr '[:upper:]' '[:lower:]' < /proc/sys/kernel/hostname)"

          log_join "[081KSNY2Z0008QG0R0008PN7RQ-joining] observing k3s agent join for node '$NODE_NAME' (k3s's join is the join; this unit only watches)"

          # --- Fact 1: the server issued us a client certificate AND the API
          # ---         server accepts it. Cannot be faked locally.
          deadline=$(( $(${pkgs.coreutils}/bin/date +%s) + ${toString cfg.timeoutSec} ))
          joined="no"
          while [ "$(${pkgs.coreutils}/bin/date +%s)" -lt "$deadline" ]; do
            if [ -s "${cfg.clientCertificate}" ] && [ -s "${cfg.kubeconfig}" ] \
              && kubectl_self get node "$NODE_NAME" -o name >/dev/null 2>&1; then
              joined="yes"
              break
            fi
            ${pkgs.coreutils}/bin/sleep ${toString cfg.pollIntervalSec}
          done
          if [ "$joined" != "yes" ]; then
            log_join "[081KSNY2Z0008QG0R0008PN7RQ-joining] join-not-observed: no server-issued kubelet credential accepted by the API within ${toString cfg.timeoutSec}s"
            exit 1
          fi
          log_join "${markerJoinSuccessful}"

          # --- Fact 2: the API server's node registry contains us. Separable
          # ---         from fact 1 (see the header): a valid certificate does
          # ---         not imply a registered Node object.
          deadline=$(( $(${pkgs.coreutils}/bin/date +%s) + ${toString cfg.timeoutSec} ))
          registered="no"
          while [ "$(${pkgs.coreutils}/bin/date +%s)" -lt "$deadline" ]; do
            node_uid="$(kubectl_self get node "$NODE_NAME" \
              -o 'jsonpath={.metadata.uid}' 2>/dev/null || true)"
            if [ -n "$node_uid" ]; then
              registered="yes"
              break
            fi
            ${pkgs.coreutils}/bin/sleep ${toString cfg.pollIntervalSec}
          done
          if [ "$registered" != "yes" ]; then
            log_join "[081KSNY2Z0008QG0R0008PN7RQ-joining] join-not-observed: node '$NODE_NAME' absent from the cluster node registry within ${toString cfg.timeoutSec}s"
            exit 1
          fi
          log_join "${markerAddedToCluster}"

          # Readiness is NOT claimed here — it needs the CNI image and is the
          # online lane's assertion. Say so out loud so nobody reads
          # membership as health.
          log_join "[081KSNY2Z0008QG0R0008PN7RQ-joining] membership observed; readiness (CNI) intentionally NOT asserted by this unit"
        '';
      };
    };
  };
}
