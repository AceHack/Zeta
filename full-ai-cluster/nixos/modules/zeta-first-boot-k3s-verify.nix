# full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix
#
# WP11 -- closes the literal "plug in the USB and run it" gap on the
# INSTALLED disk's own first boot.
#
# WHAT WAS MISSING
# -----------------
# Three lanes already exist near this question and none of them answers it:
#   - qemu-full-install-test.ts phase 1/2 boots the INSTALLER, waits for
#     "ZETA CLUSTER NODE INSTALL COMPLETE", then reboots the installed disk
#     ONLY far enough to see a login prompt -- no network, no k3s, no
#     Kubernetes/ArgoCD health (scenarios.ts says so explicitly: out of scope).
#   - nixos/tests/k3s-first-boot-roster.nix boots the k3s-server.nix MODULE
#     directly in a nixosTest sandbox and proves the roster converges -- but
#     it never goes through disko partitioning, hardware-configuration.nix,
#     zeta-install.sh's host selection, tokens, or the installed
#     configuration.nix's actual import graph. It proves the MODULES work;
#     it does not prove the INSTALLER produces a disk that boots them.
#   - The UEFI-keyfile restore lane (zeta-creds-restore.nix) IS precedent for
#     rebooting the installed disk with a test-only hypervisor-transport
#     override (fw_cfg) and asserting on serial -- this module follows that
#     same shape for k3s instead of credentials.
#
# This module is the missing piece: it runs ON THE ACTUAL INSTALLED DISK, on
# its own first multi-user boot, with real network (QEMU user-mode NIC for
# image pulls), and reports what the roster lane already knows how to ask.
#
# TEST-ONLY. OFF BY DEFAULT ON EVERY REAL INSTALL
# -------------------------------------------------
# Gated by `unitConfig.ConditionPathExists` on the marker file below -- the
# same mechanism `zeta-first-session.nix`'s `zeta-first-session-ci` unit
# already uses for its own QEMU-only demo (see that file). A
# ConditionPathExists miss makes systemd SKIP the unit cleanly (not fail),
# so importing this module into every host (common.nix) costs nothing on
# metal: nothing but the QEMU test harness's `zeta-install.sh` probe for
# `/zeta-qemu-k3s-first-boot-verify` on the boot USB ESP ever writes the
# marker (see lib.ts `qemuK3sFirstBootVerifyMarker` / the zeta-install.sh
# probe next to `zeta-qemu-bake-test-cred`).
#
# SIX NAMED VERDICTS, ONE JSON BLOB, BRACKETED ON SERIAL
# ---------------------------------------------------------
#   1. bootedMultiUser  -- this unit running at all IS the evidence (multi-user.target reached)
#   2. k3sServiceActive -- `systemctl is-active k3s.service`
#   3. nodeReady        -- Cilium pod Running + `kubectl wait --for=condition=Ready node`
#   4. helmJobs          -- per-chart helm-install Job status (complete + failedAttempts),
#                            for every HelmChart CR k3s-server.nix's roster declares
#   5. rootLanded        -- applications.argoproj.io CRD exists AND
#                            argocd/Application zeta-root exists (deploy-controller
#                            retry verdict k3s-first-boot-roster.nix names A/B/C)
#   6. noBadPods         -- no pod ErrImagePull/ImagePullBackOff/CrashLoopBackOff at
#                            the end of the bounded window; every bad pod + its
#                            restart count is reported, never just a boolean
#
# Never blocks real boot: RemainAfterExit + TimeoutStartSec=0 so the oneshot
# is never killed mid-poll by systemd's 90s default (a killed oneshot reads
# identically to a hung cluster on serial, which is exactly the ambiguity
# k3s-first-boot-roster.nix's own header warns against for its bare
# `wait_until_succeeds`).
#
# Per .claude/rules/dv2-data-split-discipline-activated.md #7 noninterference:
# this unit's only outputs are the journal and the serial device; it holds no
# state and never writes cluster state, so re-running it (§12 idempotency)
# observes the same facts and re-emits the same verdict shape.

{ config, lib, pkgs, ... }:

let
  markerFile = "/etc/zeta/qemu-k3s-first-boot-verify";
  kubeconfig = "/etc/rancher/k3s/k3s.yaml";

  # Byte-identical to the serial-markers.ts contract added alongside this
  # module (ZETA_K3S_FIRST_BOOT_VERIFY_JSON_BEGIN/_END) -- see
  # src/Core.TypeScript/ci/qemu-full-install-test.ts for the parser.
  jsonBeginMarker = "ZETA_K3S_FIRST_BOOT_VERIFY_JSON_BEGIN";
  jsonEndMarker = "ZETA_K3S_FIRST_BOOT_VERIFY_JSON_END";

  # The roster's HelmChart CR names, as k3s-server.nix's `manifests` +
  # local-storage.nix actually declare them (k8s/bootstrap/*.yaml `kind:
  # HelmChart` `metadata.name`, all namespace kube-system) -- kept as a
  # literal for the same reason nixos/tests/k3s-first-boot-roster.nix keeps
  # its own ROSTER literal: this unit states what it believes it is
  # exercising, and drift from the modules is a manual re-check (the
  # eval-only k3s-first-boot-apply-order test is what keeps THAT roster in
  # step; this one is intentionally independent so a change to one cannot
  # silently blind the other).
  helmCharts = [
    "cilium"
    "cert-manager"
    "spire-crds"
    "spire"
    "trust-manager"
    "external-secrets"
    "argocd"
  ];
in
{
  systemd.services.zeta-k3s-first-boot-verify = {
    description = "WP11 QEMU-only: verify k3s + first-boot roster on the INSTALLED disk";
    wantedBy = [ "multi-user.target" ];
    # 081M33XMWME087G0R000825CCB run 35697298781 (2026-09-22): this unit
    # ORIGINALLY carried `after = [ "multi-user.target" "network-online.target"
    # ]; wants = [ "network-online.target" ];` and never printed a single
    # line on a real run -- not even its own unconditional first `log` call.
    # Sibling units sharing the identical serial-mirroring pattern
    # (zeta-first-session-ci, zeta-creds-restore) DID print on that same
    # boot, which rules out "serial device not found" and rules out
    # "multi-user.target never reached". The only thing unique to this unit
    # was the `After=network-online.target` ordering dependency: systemd
    # defers ExecStart until every `After=` target has SETTLED, and on this
    # image's first boot (QEMU user-mode NIC + NetworkManager) that
    # apparently never happens within the observed 75+ minute window --
    # ExecStart is simply never invoked, which is indistinguishable from a
    # hang on serial because nothing runs to report it.
    #
    # Fix: do not order on network state at all. This unit already polls
    # internally, with its own bounded deadline, for everything that
    # actually needs the network (k3s, kubectl, Helm charts) -- exactly the
    # pattern k3s-join-observer.nix already uses (`after = [ "k3s.service" ]`
    # only, no network-online.target). Ordering after local-fs.target alone
    # (same as zeta-first-session-ci / zeta-creds-restore) is sufficient: the
    # marker file and repo checkout just need the root filesystem mounted.
    after = [ "local-fs.target" ];
    unitConfig = {
      ConditionPathExists = [ markerFile ];
    };
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      User = "root";
      # k3s-first-boot-roster.nix's own header budgets 45-70 min for this
      # exact bring-up on a comparable VM. systemd's 90s default
      # TimeoutStartSec would kill this unit long before that and a killed
      # oneshot is indistinguishable from a hung one on serial -- so the
      # unit itself carries the real bound (DEADLINE_SECONDS below) and
      # systemd's own timeout is disabled.
      TimeoutStartSec = 0;
      # Belt-and-suspenders on top of the explicit /dev/ttyS0 mirroring
      # below: send the unit's own stdout/stderr to the console too (wired
      # to ttyS0 by this image's `console=ttyS0,115200n8` kernel param), so
      # a defect in the explicit mirroring would still surface on serial
      # instead of silently vanishing into the journal only.
      StandardOutput = "journal+console";
      StandardError = "journal+console";
      ExecStart = pkgs.writeShellScript "zeta-k3s-first-boot-verify-start" ''
        set -uo pipefail

        # Mirror to serial so the QEMU harness observes the verdict without a
        # login (same channel/guard as zeta-creds-restore.nix and
        # k3s-join-observer.nix).
        _serial=""
        for _dev in /dev/ttyS0 /dev/ttyAMA0; do
          if [ -e "$_dev" ]; then
            _serial="$_dev"
            break
          fi
        done
        log() {
          echo "$1"
          if [ -n "$_serial" ]; then
            echo "$1" >> "$_serial" || true
          fi
        }

        JQ=${pkgs.jq}/bin/jq
        DATE=${pkgs.coreutils}/bin/date
        SLEEP=${pkgs.coreutils}/bin/sleep

        kc() {
          ${config.services.k3s.package}/bin/k3s kubectl --kubeconfig "${kubeconfig}" "$@"
        }

        START_TS=$("$DATE" +%s)
        elapsed() { echo $(( $("$DATE" +%s) - START_TS )); }

        # Overall bound across steps 2-6. Step 1 (bootedMultiUser) is true by
        # construction -- this unit only runs once multi-user.target fires.
        DEADLINE_SECONDS=4200
        deadline_ts=$(( START_TS + DEADLINE_SECONDS ))
        now_ts() { "$DATE" +%s; }

        log "[wp11-k3s-verify] begin (bounded ''${DEADLINE_SECONDS}s; node $(${pkgs.coreutils}/bin/tr '[:upper:]' '[:lower:]' < /proc/sys/kernel/hostname))"

        BOOTED_MULTI_USER=true
        BOOTED_ELAPSED=$(elapsed)
        log "[wp11-k3s-verify] verdict 1/6 bootedMultiUser=true elapsed=''${BOOTED_ELAPSED}s"

        # Why k3s is NOT active, mirrored line by line to serial. MEASURED run
        # 35717757526: k3sServiceActive=false after 4201s with nothing on serial
        # to say why -- a verdict that cannot name its cause. This names it:
        # the unit's state, the job queue (an ordering dependency that never
        # completes shows up here as a waiting job), the network-online chain
        # k3s is ordered after, and the unit's own journal.
        k3s_diag() {
          log "[wp11-k3s-verify] --- k3s diagnostics ($1, elapsed=$(elapsed)s) ---"
          {
            ${pkgs.systemd}/bin/systemctl show k3s.service -p ActiveState -p SubState -p Result -p ExecMainStatus -p NRestarts -p After --no-pager
            ${pkgs.systemd}/bin/systemctl list-jobs --no-pager
            ${pkgs.systemd}/bin/systemctl status network-online.target NetworkManager-wait-online.service systemd-networkd-wait-online.service --no-pager -n 5
            ${pkgs.systemd}/bin/systemctl --failed --no-pager
            # MEASURED run 35780287818: the tail alone was 60 identical agent
            # retries ("server is not ready: ... serving-kubelet.key: <nil>"),
            # which says the SERVER never finished starting and says nothing
            # about why. The server's own startup lines are at the HEAD of this
            # unit's journal, and its failures are level=fatal/error lines
            # anywhere in it -- so capture both, not just the last screenful.
            echo "--- k3s journal HEAD (server startup) ---"
            ${pkgs.systemd}/bin/journalctl -u k3s.service -b --no-pager -n 400 | ${pkgs.coreutils}/bin/head -n 120
            echo "--- k3s journal: fatal/error lines ---"
            ${pkgs.systemd}/bin/journalctl -u k3s.service -b --no-pager \
              | ${pkgs.gnugrep}/bin/grep -iE "level=(fatal|error)|panic|cannot|refused|timeout|no such file" \
              | ${pkgs.coreutils}/bin/head -n 60
            echo "--- k3s journal TAIL ---"
            ${pkgs.systemd}/bin/journalctl -u k3s.service -b --no-pager -n 20
            # The agent waits on files the server writes; whether they exist,
            # and whether any is EMPTY, separates "server still working" from
            # "server wrote a truncated key and the agent will retry forever".
            echo "--- k3s agent/server TLS material ---"
            ${pkgs.coreutils}/bin/ls -l /var/lib/rancher/k3s/agent /var/lib/rancher/k3s/server/tls 2>&1 | ${pkgs.coreutils}/bin/head -n 40
            echo "--- disk + memory ---"
            ${pkgs.coreutils}/bin/df -h /var/lib/rancher /var 2>&1
            ${pkgs.procps}/bin/free -m 2>&1
            # systemd breaks an ordering cycle by DELETING a start job, which
            # leaves the unit inactive forever with nothing in its own journal.
            ${pkgs.systemd}/bin/journalctl -b --no-pager | ${pkgs.gnugrep}/bin/grep -iE "ordering cycle|deleted to break|Job .* failed|dependency failed" | ${pkgs.coreutils}/bin/tail -n 40
          } 2>&1 | while IFS= read -r _l; do log "[wp11-k3s-diag] $_l"; done
        }

        # --- verdict 2: k3s.service active -----------------------------------
        K3S_ACTIVE=false
        DIAG_EARLY_DONE=false
        while [ "$(now_ts)" -lt "$deadline_ts" ]; do
          if ${pkgs.systemd}/bin/systemctl is-active --quiet k3s.service; then
            K3S_ACTIVE=true
            break
          fi
          if [ "$DIAG_EARLY_DONE" = false ] && [ "$(elapsed)" -ge 300 ]; then
            k3s_diag "not active after 300s"
            DIAG_EARLY_DONE=true
          fi
          # FAIL FAST on a unit that never even tried. Upstream k3s carries
          # Restart=always/RestartSec=5s, so a k3s that is going to come up is
          # active, activating, or visibly cycling within a couple of minutes.
          # `inactive` with ZERO start attempts at 10 minutes means its start
          # job never ran: an ordering dependency that never settles, or a job
          # systemd deleted. The remaining 60 minutes of the 4200s budget add
          # no information -- MEASURED run 35717757526 spent 4201s to print one
          # `false` -- and an hour of wall clock is the scarce thing here.
          if [ "$(elapsed)" -ge 600 ]; then
            _state=$(${pkgs.systemd}/bin/systemctl show k3s.service -p ActiveState --value 2>/dev/null || echo unknown)
            _tries=$(${pkgs.systemd}/bin/systemctl show k3s.service -p NRestarts --value 2>/dev/null || echo 0)
            if [ "$_state" = "inactive" ] && [ "$_tries" = "0" ]; then
              log "[wp11-k3s-verify] giving up early: k3s.service inactive with 0 start attempts after $(elapsed)s -- its start job never ran"
              break
            fi
          fi
          "$SLEEP" 5
        done
        K3S_ACTIVE_ELAPSED=$(elapsed)
        log "[wp11-k3s-verify] verdict 2/6 k3sServiceActive=''${K3S_ACTIVE} elapsed=''${K3S_ACTIVE_ELAPSED}s"
        if [ "$K3S_ACTIVE" = false ]; then k3s_diag "deadline"; fi

        # --- verdict 3: node Ready (Cilium up) --------------------------------
        NODE_READY=false
        if [ "$K3S_ACTIVE" = "true" ]; then
          while [ "$(now_ts)" -lt "$deadline_ts" ]; do
            if kc -n kube-system get pods -l k8s-app=cilium --no-headers 2>/dev/null | grep -q ' Running ' \
              && kc wait --for=condition=Ready node --all --timeout=5s >/dev/null 2>&1; then
              NODE_READY=true
              break
            fi
            "$SLEEP" 10
          done
        fi
        NODE_READY_ELAPSED=$(elapsed)
        log "[wp11-k3s-verify] verdict 3/6 nodeReady=''${NODE_READY} elapsed=''${NODE_READY_ELAPSED}s"

        # --- verdict 4: rostered HelmChart helm-install Jobs -------------------
        HELM_JOBS_JSON="[]"
        for chart in ${lib.concatStringsSep " " helmCharts}; do
          job_name="helm-install-$chart"
          complete=false
          failed=0
          exists=false
          job_deadline=$(( $(now_ts) + 1800 ))
          if [ "$job_deadline" -gt "$deadline_ts" ]; then
            job_deadline=$deadline_ts
          fi
          while [ "$(now_ts)" -lt "$job_deadline" ]; do
            status_json="$(kc -n kube-system get job "$job_name" -o json 2>/dev/null || true)"
            if [ -n "$status_json" ]; then
              exists=true
              succeeded="$(echo "$status_json" | "$JQ" -r '.status.succeeded // 0')"
              failed="$(echo "$status_json" | "$JQ" -r '.status.failed // 0')"
              if [ "$succeeded" -ge 1 ] 2>/dev/null; then
                complete=true
                break
              fi
            fi
            "$SLEEP" 10
          done
          log "[wp11-k3s-verify]   helmChart=$chart exists=$exists complete=$complete failedAttempts=$failed"
          HELM_JOBS_JSON="$(echo "$HELM_JOBS_JSON" | "$JQ" \
            --arg chart "$chart" --argjson exists "$exists" --argjson complete "$complete" --argjson failed "$failed" \
            '. + [{chart: $chart, exists: $exists, complete: $complete, failedAttempts: $failed}]')"
        done
        HELM_JOBS_ELAPSED=$(elapsed)
        log "[wp11-k3s-verify] verdict 4/6 helmJobs elapsed=''${HELM_JOBS_ELAPSED}s"

        # --- verdict 5: root-application lands (ROOT_LANDED) -------------------
        # Same three-outcome discriminator k3s-first-boot-roster.nix uses:
        # applied / crd-absent (inconclusive) / stuck (crd exists, object does not).
        ROOT_CRD_SEEN=false
        ROOT_APPLIED=false
        while [ "$(now_ts)" -lt "$deadline_ts" ]; do
          if [ "$ROOT_CRD_SEEN" != "true" ]; then
            if kc get crd applications.argoproj.io >/dev/null 2>&1; then
              ROOT_CRD_SEEN=true
            fi
          fi
          if kc -n argocd get application zeta-root >/dev/null 2>&1; then
            ROOT_APPLIED=true
            break
          fi
          "$SLEEP" 15
        done
        ROOT_LANDED_ELAPSED=$(elapsed)
        ROOT_VERDICT="stuck"
        if [ "$ROOT_APPLIED" = "true" ]; then
          ROOT_VERDICT="landed"
        elif [ "$ROOT_CRD_SEEN" != "true" ]; then
          ROOT_VERDICT="inconclusive-crd-absent"
        fi
        log "[wp11-k3s-verify] verdict 5/6 rootLanded=''${ROOT_APPLIED} crdSeen=''${ROOT_CRD_SEEN} verdict=''${ROOT_VERDICT} elapsed=''${ROOT_LANDED_ELAPSED}s"

        # --- verdict 6: no bad pods at the end of the window --------------------
        BAD_PODS_JSON="[]"
        if [ "$K3S_ACTIVE" = "true" ]; then
          BAD_LINES="$(kc get pods -A --no-headers 2>/dev/null | \
            ${pkgs.gnugrep}/bin/grep -E 'ErrImagePull|ImagePullBackOff|CrashLoopBackOff' || true)"
          if [ -n "$BAD_LINES" ]; then
            while IFS= read -r line; do
              [ -z "$line" ] && continue
              ns="$(echo "$line" | ${pkgs.gawk}/bin/awk '{print $1}')"
              name="$(echo "$line" | ${pkgs.gawk}/bin/awk '{print $2}')"
              restarts="$(echo "$line" | ${pkgs.gawk}/bin/awk '{print $5}')"
              status="$(echo "$line" | ${pkgs.gawk}/bin/awk '{print $4}')"
              BAD_PODS_JSON="$(echo "$BAD_PODS_JSON" | "$JQ" \
                --arg ns "$ns" --arg name "$name" --arg status "$status" --arg restarts "$restarts" \
                '. + [{namespace: $ns, name: $name, status: $status, restarts: $restarts}]')"
            done <<EOF
$BAD_LINES
EOF
          fi
        fi
        NO_BAD_PODS=true
        if [ "$(echo "$BAD_PODS_JSON" | "$JQ" 'length')" -gt 0 ]; then
          NO_BAD_PODS=false
        fi
        BAD_PODS_ELAPSED=$(elapsed)
        log "[wp11-k3s-verify] verdict 6/6 noBadPods=''${NO_BAD_PODS} elapsed=''${BAD_PODS_ELAPSED}s"

        VERDICT_JSON="$("$JQ" -n \
          --argjson bootedMultiUser "$BOOTED_MULTI_USER" \
          --argjson bootedMultiUserElapsedSeconds "$BOOTED_ELAPSED" \
          --argjson k3sServiceActive "$K3S_ACTIVE" \
          --argjson k3sServiceActiveElapsedSeconds "$K3S_ACTIVE_ELAPSED" \
          --argjson nodeReady "$NODE_READY" \
          --argjson nodeReadyElapsedSeconds "$NODE_READY_ELAPSED" \
          --argjson helmJobs "$HELM_JOBS_JSON" \
          --argjson helmJobsElapsedSeconds "$HELM_JOBS_ELAPSED" \
          --argjson rootLanded "$ROOT_APPLIED" \
          --arg rootLandedVerdict "$ROOT_VERDICT" \
          --argjson rootLandedElapsedSeconds "$ROOT_LANDED_ELAPSED" \
          --argjson noBadPods "$NO_BAD_PODS" \
          --argjson badPods "$BAD_PODS_JSON" \
          --argjson badPodsElapsedSeconds "$BAD_PODS_ELAPSED" \
          '{
            bootedMultiUser: {ok: $bootedMultiUser, elapsedSeconds: $bootedMultiUserElapsedSeconds},
            k3sServiceActive: {ok: $k3sServiceActive, elapsedSeconds: $k3sServiceActiveElapsedSeconds},
            nodeReady: {ok: $nodeReady, elapsedSeconds: $nodeReadyElapsedSeconds},
            helmJobs: {jobs: $helmJobs, elapsedSeconds: $helmJobsElapsedSeconds},
            rootLanded: {ok: $rootLanded, verdict: $rootLandedVerdict, elapsedSeconds: $rootLandedElapsedSeconds},
            noBadPods: {ok: $noBadPods, pods: $badPods, elapsedSeconds: $badPodsElapsedSeconds}
          }')"

        log "${jsonBeginMarker}"
        log "$VERDICT_JSON"
        log "${jsonEndMarker}"
        log "[wp11-k3s-verify] done"
      '';
    };
  };
}
