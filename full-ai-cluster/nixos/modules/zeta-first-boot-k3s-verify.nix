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
# SEVEN NAMED VERDICTS, ONE JSON BLOB, BRACKETED ON SERIAL
# ---------------------------------------------------------
#   1. bootedMultiUser  -- this unit running at all IS the evidence (multi-user.target reached)
#   2. k3sServiceActive -- `systemctl is-active k3s.service`
#   3. nodeReady        -- Cilium pod Running + `kubectl wait --for=condition=Ready node`
#   4. helmJobs          -- per-chart helm-install Job status (complete + failedAttempts),
#                            for every HelmChart CR k3s-server.nix's roster declares
#   5. rootLanded        -- applications.argoproj.io CRD exists AND
#                            argocd/Application zeta-root exists (deploy-controller
#                            retry verdict k3s-first-boot-roster.nix names A/B/C)
#   6. noBadPods         -- polls (never a single snapshot) for up to a 180s soak,
#                            measured from the clean-VM-oracle settle baseline
#                            (081M343EM0R087G0R003C8ZHJ7), after rootLanded --
#                            a pod counts as settled only once TWO consecutive
#                            samples agree it is neither in the bad-phase set
#                            nor still accumulating restarts. Every still-bad
#                            pod + its restart count + a describe/logs dump is
#                            reported, never just a boolean (081M39T5661087G0R001FTJ78W).
#   7. rosterConverged   -- 081M3BEGSQR087G0R003610CGB (WP31). Every ArgoCD
#                            Application that CAN converge on this node reaches
#                            Synced+Healthy inside a bound; every one that
#                            cannot is NAMED with its reason and excluded.
#                            See "VERDICT 7" below -- it is the one that
#                            answers the maintainer's actual question, WITHIN
#                            THE SUBSTRATE LIMIT stated immediately below.
#
# WHAT VERDICT 7 ACTUALLY MEASURES -- READ THIS BEFORE QUOTING IT
# ----------------------------------------------------------------
# NOT "the roster converges". "THE ROSTER CONVERGES ON A 4-vCPU / 12 GiB NODE."
# The two hardware figures, side by side and both MEASURED:
#
#                   this lane's guest        registered ClusterNodes     ratio
#   vCPU / cores    4                        16, 16, 22, 22             18-25%
#   memory          12 GiB                   66 G (all four)             ~18%
#
# Sources: `K3S_VERIFY_CPU_COUNT` / `K3S_VERIFY_MEMORY_MB` in
# src/Core.TypeScript/ci/qemu-full-install-test.ts, and
# maintainers/*/cluster-nodes/*/node.yaml.
#
# THE GUEST CANNOT BE GIVEN MORE. The GitHub-hosted ubuntu-24.04 runner is
# itself 4 vCPU / 16 GiB, so the guest already takes ALL FOUR vCPUs and 12 of
# the host's 16 GiB. That is a hard ceiling on what this lane can ever measure,
# not a setting someone forgot to raise. And those 4 vCPUs are simultaneously
# running k3s + kubelet, containerd pulling against a 134-entry image roster,
# and ArgoCD rendering 49 Applications.
#
# So a GREEN verdict 7 says the roster converges on roughly a QUARTER of the
# CPU and a FIFTH of the memory of the box it is meant to represent -- which is
# a strong result, and a narrower claim than the verdict's name suggests. A RED
# one does NOT automatically transfer to the target hardware either. The first
# live run (36097310492) went red for exactly this reason: the ArgoCD control
# plane was starved, convergence PEAKED at 25/35 and regressed to 13/35, and
# `zeta-root` itself never completed a comparison. Filed, with the substrate
# measurement, as 081M3BPJNRS087G0R0008WFXBZ -- which is a REAL finding about
# modest hardware (an operator installing on a small box gets exactly that),
# not a CI artifact to wave away.
#
# VERDICT 7 -- WHY IT EXISTS AND WHY IT IS NOT "ALL APPLICATIONS HEALTHY"
# -----------------------------------------------------------------------
# Verdicts 1-6 stop short of the question that prompted this whole lane:
# "will the applications on the helm chart start up correctly when I plug the
# USB in". `helmJobs` covers SEVEN bootstrap charts (cilium ... argocd) and
# nothing else; `rootLanded` means the app-of-apps root OBJECT exists, never
# that its ~48 children converged. So the roster question was answered only by
# the Docker replica (first-boot-replica.ts) and the kind lanes, and never once
# on a real installed disk.
#
# A naive "every Application Healthy" verdict would be UNPASSABLE, and an
# unpassable verdict is worse than an absent one -- it trains a reader to
# ignore a red. Two classes legitimately cannot converge here:
#
#   * DECLARED MANUAL-SYNC. `cdi`, `kubevirt`, `ollama`, `vllm` omit
#     `spec.syncPolicy.automated` ON PURPOSE and say so in a machine-readable
#     annotation (`zeta.io/sync-policy: manual` + a non-empty
#     `zeta.io/sync-policy-reason`). Nothing on this boot runs
#     `argocd app sync`, so they can never reach Synced.
#   * UNSCHEDULABLE ON THIS FLEET. A workload whose `nodeSelector` demands a
#     label no Node carries (`zeta.io/gpu: nvidia` against a box with an Intel
#     Arc) stays Pending forever BY DESIGN.
#
# DERIVED, NEVER A HARDCODED LIST -- and derived from the SAME definitions the
# rest of the tree already uses, not a second opinion:
#
#   * the manual-sync convention is `manual-sync-policy.ts`'s, read off the
#     LIVE Application object (ArgoCD applies those annotations verbatim, so
#     the declaration travels with the object and needs no repo checkout on
#     the installed disk). The three refusals that file names are reproduced
#     exactly: annotation without a reason, annotation WITH an `automated:`
#     block, and an omitted block with no annotation are all MALFORMED and
#     earn the FULL Synced+Healthy contract -- a malformed declaration must
#     never be cheaper to satisfy than a correct one.
#   * an excluded manual-sync app is still ASSERTED, by
#     `manual-sync-policy.ts`'s own weaker contract: ArgoCD must have COMPLETED
#     a comparison (sync in {Synced, OutOfSync}, never Unknown -- that would be
#     a ComparisonError) and health must be Missing (never synced here) or
#     Healthy (synced by hand). An exclusion that asserts nothing is a
#     decoration.
#   * schedulability is decided the way KUBERNETES decides it: a Pending pod's
#     `spec.nodeSelector` pair against the union of every Node's labels. In
#     cluster this is EXACT, which is the half `schedulable-demand.ts` (WP28,
#     PR #17620) could only call `undecidable` from a checked-in `ClusterNode`
#     registration -- there, `lspci ... | head -1` cannot prove a second card
#     is ABSENT; here, the scheduler's own input (Node labels) is readable
#     directly and proves it.
#
# THREE OUTCOMES, NEVER TWO, AND THE THIRD IS SAID OUT LOUD. `undecidable` is
# the WP28 disposition carried over: this check evaluates `spec.nodeSelector`
# and NOT `affinity.nodeAffinity` (a full match-expression language; a second
# evaluator for it would be exactly the second reasoning this reuses
# `schedulable-demand.ts` to avoid). A Pending pod carrying required
# nodeAffinity therefore makes its Application `undecidable` -- reported by
# name, counted separately, and FAILING the verdict, because "I could not
# tell" is not "it worked".
#
# THE EMPTY-ROSTER FALSE GREEN, CLOSED. "0 unconverged out of 0 Applications"
# is the exact shape this effort has now found NINE times: a check whose
# failure and whose absence look identical. Three guards: (a) the verdict
# carries `k3sActive` and `appCount` into its own JSON, the way verdict 6
# already does for `podCount`; (b) it requires `zeta-root` ITSELF to report
# `sync=Synced` -- that is what establishes the roster is COMPLETE, since an
# Application the root never created is invisible to a loop over live
# Applications; (c) a provably-unschedulable Pending pod that cannot be
# attributed to exactly one Application is reported as `unattributed-pod`
# rather than dropped, and fails the verdict.
#
# THE BOUND, AND WHERE THE NUMBER CAME FROM. `k3s-first-boot-roster.nix`'s own
# header budgets 45-70 min for k3s plus ~2-3 GB of Helm image pulls converging
# on a comparable VM. The app-of-apps roster is a strict SUPERSET of that
# bring-up (~48 more Applications), so the bound is that range's UPPER end --
# 70 min = 4200s -- never a mid value and never a number chosen to make one
# run pass. It is then CLAMPED by this unit's existing overall
# `DEADLINE_SECONDS` (also 4200s), which is what actually bites: verdicts 1-6
# resolve at ~150s on a green run, leaving ~4050s for verdict 7. That clamp is
# what keeps the unit emitting before the harness's own
# `K3S_VERIFY_TIMEOUT_SECONDS` (4500s) and inside the workflow step's
# `timeout-minutes: 100` -- MEASURED run 36073981145: the ENTIRE step
# (ISO boot + install + reboot + all six verdicts) took 19m48s, so ~80 min of
# that budget was unused. No workflow or harness timeout changes with this.
#
# WHAT THIS DELIBERATELY DOES *NOT* EXCLUDE, CROSS-CHECKED AGAINST THE REPLICA.
# The Docker-replica lane (first-boot-replica.ts stage 6) measured the same
# roster on 2026-09-25: 42 Applications, 35 Healthy, 5 DIVERGENCE, 2 FAIL. The
# two derivations agree on four and differ on three, and every difference runs
# in the same direction -- THIS verdict excludes LESS:
#
#   cdi, kubevirt    -> both call it manual-sync. AGREE.
#   cilium, weaviate -> both red (Synced+Progressing; cilium names its own
#                       cause, an ExcludedResourceWarning on EndpointSlice
#                       cilium-ingress). AGREE, and WP26 owns that fix.
#   spire            -> the replica classifies its crash loop as confirmed
#                       NON-METAL (nested-container DNS). This lane IS metal,
#                       so spire must converge here, and excluding it would
#                       import a Docker artifact into a metal verdict.
#                       DIFFERING IS THE CORRECT BEHAVIOUR -- and spire reading
#                       unconverged here would be a finding about that
#                       classification, not about this check.
#   openbao          -> sealed by design on a fresh cluster.
#   hindsight        -> needs an external API key no fresh cluster can hold.
#
# openbao and hindsight are a REAL gap, left open on purpose. Both are
# defensible non-convergences that hold on metal too, and neither carries a
# machine-readable declaration this unit could read off the live object.
# `zeta.io/sync-policy: manual` is the wrong annotation for them -- neither is
# manual-SYNC; both are converges-only-after-an-operator-action, which the
# convention has no word for yet. `full-ai-cluster/INJECTION-POINTS.md`'s
# `**EXTERNAL**` table is the maintained source for hindsight's half and
# first-boot-replica.ts already parses it, but that table lives in the REPO and
# this unit runs on an installed disk with no checkout; baking a snapshot in at
# Nix eval time would create a second, separately-drifting copy of a roster.
# So they stay `unconverged`, named on serial with their last Sync+Health
# state. The vocabulary gap is filed as 081M3BKQFNC087G0R003MDGSAX: the
# convention needs a SECOND VALUE (converges-only-after-an-operator-action),
# not a wider `manual`. Widening a bucket until a red goes green is the one
# move that would make this verdict stop meaning anything.
#
# WHO OWNS THE RED -- READ THIS BEFORE SKIPPING A RED LANE.
# A permanently-red lane stops being read, and a lane nobody reads is worth
# less than no lane. So the known non-convergences are OWNED, by name, here:
#
#   cilium, weaviate   WP26. Synced+Progressing; cilium names its own cause,
#                      an ExcludedResourceWarning on EndpointSlice
#                      cilium-ingress. Being worked.
#   openbao, hindsight 081M3BKQFNC087G0R003MDGSAX (above). Awaiting the second
#                      sync-policy value; until then they are correctly red.
#
# FOUR KNOWN, ALL OWNED. **A FIFTH NAME IN THE `unconverged` LIST IS THE
# SIGNAL THIS VERDICT EXISTS TO PRODUCE** -- it is something new, on a real
# installed disk, that no other lane caught. Do not read past it. And when
# the four above are closed, this list must shrink with them, or it becomes
# the standing excuse it was written to prevent.
#
# AND IT REPORTS WHILE IT WAITS. Sixty-seven minutes of silence on a serial log
# is indistinguishable from a hang, so every poll prints a counts line
# (`N Synced+Healthy, M progressing, K excluded, U undecidable`) and every
# fifth poll names what is still outstanding.
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
        AWK=${pkgs.gawk}/bin/awk
        WC=${pkgs.coreutils}/bin/wc
        TR=${pkgs.coreutils}/bin/tr
        MKTEMP=${pkgs.coreutils}/bin/mktemp
        MV=${pkgs.coreutils}/bin/mv

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
        log "[wp11-k3s-verify] verdict 1/7 bootedMultiUser=true elapsed=''${BOOTED_ELAPSED}s"

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
        log "[wp11-k3s-verify] verdict 2/7 k3sServiceActive=''${K3S_ACTIVE} elapsed=''${K3S_ACTIVE_ELAPSED}s"
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
        log "[wp11-k3s-verify] verdict 3/7 nodeReady=''${NODE_READY} elapsed=''${NODE_READY_ELAPSED}s"

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
        log "[wp11-k3s-verify] verdict 4/7 helmJobs elapsed=''${HELM_JOBS_ELAPSED}s"

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
        log "[wp11-k3s-verify] verdict 5/7 rootLanded=''${ROOT_APPLIED} crdSeen=''${ROOT_CRD_SEEN} verdict=''${ROOT_VERDICT} elapsed=''${ROOT_LANDED_ELAPSED}s"

        # --- verdict 6: no bad pods, once the roster has had time to settle -----
        #
        # 081M39T5661087G0R001FTJ78W. This was the ONLY one of six verdicts
        # with no poll -- a bare snapshot fired the instant verdict 5
        # resolved (MEASURED run 35996447262: rootLanded at elapsed=140s,
        # this block ran at elapsed=141s -- one second later, the earliest
        # possible instant ANY pod could show transient startup-ordering
        # churn). spire-agent (a DaemonSet) has no readiness dependency on
        # spire-server (a StatefulSet); each is independently scheduled and
        # pulls its own image, so spire-agent racing spire-server at first
        # boot is expected, not a defect -- see the workitem for the full
        # trace. Give this verdict the same poll-to-a-bound shape its five
        # siblings above already have.
        #
        # SOAK_SECONDS is NOT tuned to pass any specific run -- it is the
        # settle time this repo already MEASURED for the identical class of
        # churn on a clean VM oracle: 081M343EM0R087G0R003C8ZHJ7 (run
        # 35706939767) held spire-agent's restartCount flat at 3, "settled
        # during ordinary startup churn, then stable," across a 180s
        # sampling window (first-boot-replica.ts, the
        # isKnownSpireAgentDnsCrashLoop docstring). A pod that has not
        # settled inside that same 180s here is failing for a different
        # reason than the one that number was measured against.
        #
        # SETTLED requires TWO CONSECUTIVE samples to agree a pod is both
        # out of the bad-phase set AND not still accumulating restarts --
        # never a single all-clear snapshot, because a genuinely
        # crash-looping container can read "Running" for one sample between
        # crashes (first-boot-replica.ts's own classifyPod fallback exists
        # for exactly this ambiguity). A pod that never stops climbing, or
        # is still bad at the deadline, still FAILS -- this soak widens
        # WHEN the check looks, never WHAT it tolerates.
        SOAK_SECONDS=180
        POLL_SECONDS=15

        # ZETA-WP11-NOBADPODS-BEGIN -- pure text processing: no kubectl, no
        # jq, no globals but its own arguments and "$AWK" (a plain shell
        # variable, set once near the top of this script from the gawk
        # package, so this block is bash-sourceable outside Nix once $AWK is
        # set to any awk on PATH). Shell-parity tested against a real
        # bash+awk in
        # src/Core.TypeScript/ci/wp11-nobadpods-shell-parity.test.ts, same
        # discipline as longhorn-capacity-preflight-shell-parity.test.ts.
        zeta_wp11_snapshot_restarts() {
          # $1 = raw `kubectl get pods -A --no-headers` text (a file)
          # $2 = output file: "namespace name restarts", one pod per line
          "$AWK" '{print $1, $2, $5+0}' "$1" > "$2"
        }

        zeta_wp11_unsettled_pods() {
          # $1 = raw `kubectl get pods -A --no-headers` text (a file), THIS sample
          # $2 = restarts-snapshot file from the PREVIOUS sample (per
          #      zeta_wp11_snapshot_restarts above); may not exist, or be
          #      empty, on the first sample
          # stdout: "namespace name status restarts", one line per pod that
          #      is UNSETTLED -- its status matches the bad-phase set, OR
          #      its restart count is higher than the previous sample
          #      recorded for it, OR the previous sample never saw it at
          #      all (so the FIRST sample alone can never conclude anything
          #      has settled -- there is nothing yet to compare against).
          "$AWK" -v prevfile="$2" '
            BEGIN {
              while ((getline pline < prevfile) > 0) {
                split(pline, f, " ")
                key = f[1] SUBSEP f[2]
                prevr[key] = f[3]
                seen[key] = 1
              }
            }
            {
              ns = $1; name = $2; status = $4; restarts = $5 + 0
              key = ns SUBSEP name
              bad = (status == "ErrImagePull" || status == "ImagePullBackOff" || status == "CrashLoopBackOff")
              climbing = 1
              if (key in seen) {
                if (restarts <= prevr[key]) climbing = 0
              }
              if (bad || climbing) print ns, name, status, restarts
            }
          ' "$1"
        }
        # ZETA-WP11-NOBADPODS-END

        # 081M38GCTFX087G0R003MMTXJE built `collectAppFailureDiagnostics` for
        # the Docker-replica lane because a bad pod with no describe/logs
        # evidence cannot be diagnosed from the verdict alone; this is that
        # same discipline's sibling here, same reason
        # (081M39T5661087G0R001FTJ78W: grepping this lane's own serial-log
        # artifact for run 35996447262 found ZERO pod diagnostics beyond the
        # bare verdict line -- the instrument this lane needs was absent
        # exactly where the failure was).
        bad_pod_diag() {
          # $1 = file of "namespace name status restarts", one line per
          #      still-unsettled pod at the end of the soak.
          while IFS=' ' read -r _ns _name _status _restarts; do
            [ -z "$_ns" ] && continue
            log "[wp11-k3s-verify] --- bad pod diagnostics: ''${_ns}/''${_name} (status=''${_status} restarts=''${_restarts}) ---"
            {
              kc -n "$_ns" describe pod "$_name"
              echo "--- logs --previous (falls back to current if no previous terminated container) ---"
              kc -n "$_ns" logs "$_name" --all-containers --previous --tail=100 2>/dev/null \
                || kc -n "$_ns" logs "$_name" --all-containers --tail=100
            } 2>&1 | while IFS= read -r _l; do log "[wp11-bad-pod-diag] $_l"; done
          done < "$1"
        }

        RESTARTS_SNAPSHOT="$($MKTEMP)"
        : > "$RESTARTS_SNAPSHOT"
        CUR_PODS_FILE="$($MKTEMP)"
        : > "$CUR_PODS_FILE"
        UNSETTLED_FILE="$($MKTEMP)"
        : > "$UNSETTLED_FILE"
        SAMPLES=0
        if [ "$K3S_ACTIVE" = "true" ]; then
          soak_deadline=$(( $(now_ts) + SOAK_SECONDS ))
          if [ "$soak_deadline" -gt "$deadline_ts" ]; then
            soak_deadline=$deadline_ts
          fi
          while true; do
            SAMPLES=$(( SAMPLES + 1 ))
            kc get pods -A --no-headers > "$CUR_PODS_FILE" 2>/dev/null || : > "$CUR_PODS_FILE"
            zeta_wp11_unsettled_pods "$CUR_PODS_FILE" "$RESTARTS_SNAPSHOT" > "$UNSETTLED_FILE"
            NEXT_SNAPSHOT="$($MKTEMP)"
            zeta_wp11_snapshot_restarts "$CUR_PODS_FILE" "$NEXT_SNAPSHOT"
            "$MV" -f "$NEXT_SNAPSHOT" "$RESTARTS_SNAPSHOT"
            # settled only once TWO samples agree (SAMPLES>=2) there is
            # nothing left unsettled -- see the header comment above.
            if [ "$SAMPLES" -ge 2 ] && [ ! -s "$UNSETTLED_FILE" ]; then
              break
            fi
            if [ "$(now_ts)" -ge "$soak_deadline" ]; then
              break
            fi
            "$SLEEP" "$POLL_SECONDS"
          done
        fi

        # 081M39T5661087G0R001FTJ78W item 4: distinguish "no bad pods among N"
        # from "no pods at all" (k3s never active, so this block never even
        # ran) -- both used to read noBadPods=true with nothing to tell them
        # apart, which is a SIXTH verdict reading green as confirmation that
        # nothing was wrong while measuring nothing (MEASURED: this is what
        # main printed all night on runs where k3s never became active).
        # $K3S_ACTIVE is carried into the verdict directly rather than left
        # to be inferred from podCount=0, which a genuinely-empty-but-active
        # cluster could also produce.
        TOTAL_POD_COUNT=$("$WC" -l < "$CUR_PODS_FILE" | "$TR" -d ' ')

        BAD_PODS_JSON="[]"
        NO_BAD_PODS=true
        if [ -s "$UNSETTLED_FILE" ]; then
          NO_BAD_PODS=false
          while IFS=' ' read -r _ns _name _status _restarts; do
            [ -z "$_ns" ] && continue
            BAD_PODS_JSON="$(echo "$BAD_PODS_JSON" | "$JQ" \
              --arg ns "$_ns" --arg name "$_name" --arg status "$_status" --arg restarts "$_restarts" \
              '. + [{namespace: $ns, name: $name, status: $status, restarts: $restarts}]')"
          done < "$UNSETTLED_FILE"
        fi
        BAD_PODS_ELAPSED=$(elapsed)

        # 081M39T5661087G0R001FTJ78W item 3: a soak that prints only its
        # final boolean joins the class of check-whose-failure-and-absence-
        # look-identical this repo has been bitten by all night. Say what
        # was waited for, for how long, and how it resolved -- pass and fail
        # are different sentences, not just a different word.
        if [ "$K3S_ACTIVE" != "true" ]; then
          log "[wp11-k3s-verify] verdict 6/7 noBadPods=true after ''${BAD_PODS_ELAPSED}s -- k3s.service NEVER BECAME ACTIVE, 0 pods were ever checked; this is NOT a confirmation that nothing was wrong (see verdict 2/7 above)"
        elif [ "$NO_BAD_PODS" = "true" ]; then
          log "[wp11-k3s-verify] verdict 6/7 noBadPods=true after ''${BAD_PODS_ELAPSED}s (''${SAMPLES} sample(s), ''${TOTAL_POD_COUNT} pod(s) total, all settled)"
        else
          BAD_SUMMARY="$("$AWK" 'BEGIN{sep=""} {printf "%s%s/%s restartCount=%s", sep, $1, $2, $4; sep=", "} END{print ""}' "$UNSETTLED_FILE")"
          log "[wp11-k3s-verify] verdict 6/7 noBadPods=false after ''${BAD_PODS_ELAPSED}s (''${SAMPLES} sample(s), ''${TOTAL_POD_COUNT} pod(s) total, deadline reached): ''${BAD_SUMMARY} still unsettled"
          bad_pod_diag "$UNSETTLED_FILE"
        fi

        # --- verdict 7: the app-of-apps ROSTER converges -----------------------
        #
        # 081M3BEGSQR087G0R003610CGB (WP31). See the "VERDICT 7" section of this
        # file's header for why this is not "every Application Healthy", where
        # the exclusion set is derived from, and where the bound's number came
        # from. What follows is the mechanism.

        # ZETA-WP11-ROSTER-BEGIN -- pure text processing: no kubectl, no jq, no
        # globals but its own arguments and "$AWK" (a plain shell variable, set
        # once near the top of this script from the gawk package, so this block
        # is bash-sourceable outside Nix once $AWK is set to any awk on PATH).
        # Shell-parity tested against a real bash+awk in
        # src/Core.TypeScript/ci/wp11-roster-shell-parity.test.ts, same
        # discipline as wp11-nobadpods-shell-parity.test.ts.
        zeta_wp11_classify_roster() {
          # $1 = the collected-facts file. One TAB-separated record per line,
          #      typed by column 1. "-" is the empty sentinel in EVERY field,
          #      so a missing value is never an empty column that shifts the
          #      others.
          #
          #   A <app> <syncStatus> <healthStatus> <policyAnnotation> <hasAutomated> <policyReason> <message>
          #   N <app> <namespace>                  -- a namespace this app claims
          #   L <labelKey=labelValue>              -- carried by at least one Node
          #   P <podNs> <podName> <instanceLabel> <hasRequiredNodeAffinity> <schedulerSaysUnschedulable> <selKey> <selValue>
          #                                        -- one row per Pending pod per
          #                                           nodeSelector pair; a pod with
          #                                           no nodeSelector emits one row
          #                                           with "-" "-".
          #                                           `schedulerSaysUnschedulable`
          #                                           is the pod's own
          #                                           PodScheduled=False
          #                                           condition -- the SCHEDULER's
          #                                           verdict, not an inference.
          #
          # $2 = the root Application's name. Excluded from the roster -- verdict
          #      5 owns it, and its own sync status is the SHELL's completeness
          #      gate, not this function's business.
          #
          # stdout, one TAB-separated line per Application (plus any
          # unattributed pod), in the order the A records arrived:
          #
          #   <bucket> <name> <detail>
          #
          #   converged              Synced + Healthy.
          #   unconverged            did not reach it and nothing excuses that.
          #   excluded-manual-sync   declares zeta.io/sync-policy: manual WITH a
          #                          reason and no automated block, AND still
          #                          satisfies the weaker contract
          #                          (manual-sync-policy.ts's
          #                          COMPARISON_COMPLETED_SYNC_STATUS x
          #                          MANUAL_SYNC_ACCEPTABLE_HEALTH). A declared
          #                          manual-sync app that FAILS that weaker
          #                          contract is `unconverged`, not excluded.
          #   excluded-unschedulable a Pending pod of this app demands a
          #                          nodeSelector label NO Node carries.
          #   undecidable            the SCHEDULER says a pod of this app cannot
          #                          be placed (PodScheduled=False) AND the pod
          #                          carries required nodeAffinity, which this
          #                          check does not evaluate. Counted, named,
          #                          and it FAILS the verdict.
          #
          #                          BOTH halves are required, and the first
          #                          half was added after the first live run.
          #                          081M3BP768B087G0R0010C6GPR: bare
          #                          "Pending + has nodeAffinity" is far too
          #                          broad, because almost every chart's
          #                          DaemonSet carries a
          #                          `kubernetes.io/os: linux` nodeAffinity and
          #                          every pod is Pending for a moment while its
          #                          image pulls. MEASURED run 36097310492: it
          #                          fired on `longhorn` and
          #                          `node-feature-discovery` -- two ordinary,
          #                          perfectly schedulable workloads -- which
          #                          would have made the verdict permanently red
          #                          for a reason about this CHECK rather than
          #                          about the cluster. A pod that is Pending
          #                          while pulling an image is not a scheduling
          #                          question at all, and the scheduler's own
          #                          condition is what separates the two.
          #   unattributed-pod       a provably unschedulable Pending pod that
          #                          belongs to no single Application. Reported
          #                          rather than dropped, and it FAILS the
          #                          verdict -- an exclusion nobody can see is
          #                          how a verdict becomes decorative.
          "$AWK" -F '\t' -v rootapp="$2" '
            $1 == "A" {
              a = $2
              if (a == rootapp) next
              if (!(a in seenApp)) { seenApp[a] = 1; order[++n] = a }
              sync[a] = $3; health[a] = $4; ann[a] = $5; auto[a] = $6; reason[a] = $7; msg[a] = $8
              next
            }
            $1 == "N" {
              if ($2 == rootapp) next
              pair = $3 SUBSEP $2
              if (!(pair in nsPairSeen)) { nsPairSeen[pair] = 1; nsCount[$3]++; nsOwner[$3] = $2 }
              next
            }
            $1 == "L" { nodeLabel[$2] = 1; next }
            $1 == "P" {
              pk = $2 SUBSEP $3
              if (!(pk in podSeen)) { podSeen[pk] = 1; podOrder[++pn] = pk }
              podNs[pk] = $2; podName[pk] = $3; podInst[pk] = $4; podAff[pk] = $5; podSchedFalse[pk] = $6
              if ($7 != "-") {
                want = $7 "=" $8
                if (!(want in nodeLabel) && !(pk in podUnsched)) podUnsched[pk] = want
              }
              next
            }
            END {
              # Attribute every Pending pod to at most one Application. Namespace
              # ownership first (the unambiguous case), then ArgoCD own
              # app.kubernetes.io/instance tracking label as the tiebreak -- the
              # same order first-boot-replica.ts attributePodToApp uses, minus
              # the ownerReference pass, which needs the API server.
              for (i = 1; i <= pn; i++) {
                pk = podOrder[i]
                ns = podNs[pk]
                owner = ""
                if (nsCount[ns] == 1) owner = nsOwner[ns]
                else if (podInst[pk] != "-" && (podInst[pk] in seenApp)) owner = podInst[pk]
                if (owner == "") {
                  if (pk in podUnsched) {
                    if (nsCount[ns] == 0) why = "no Application claims namespace " ns
                    else why = "namespace " ns " is claimed by " nsCount[ns] " Applications and the pod carries no usable app.kubernetes.io/instance label"
                    printf "unattributed-pod\t%s/%s\tPending and provably unschedulable (no Node carries %s), but it cannot be attributed: %s\n", podNs[pk], podName[pk], podUnsched[pk], why
                  }
                  continue
                }
                if (pk in podUnsched) {
                  if (!(owner in unschedWhy)) unschedWhy[owner] = podUnsched[pk] " (pod " podNs[pk] "/" podName[pk] ")"
                } else if (podAff[pk] == "true" && podSchedFalse[pk] == "true") {
                  # BOTH halves. The scheduler has to have actually refused to
                  # place it (PodScheduled=False), not merely "it is Pending" --
                  # see the `undecidable` entry in this function header for the
                  # measurement that added this conjunct.
                  if (!(owner in affWhy)) affWhy[owner] = podNs[pk] "/" podName[pk]
                }
              }

              for (i = 1; i <= n; i++) {
                a = order[i]
                # manual-sync-policy.ts classifySyncPolicy, the "manual" arm:
                # annotation exactly "manual", NO automated block, non-empty
                # reason. Anything else carrying the annotation is `invalid`
                # there and earns the FULL contract here -- fail-closed, so a
                # malformed declaration is never cheaper than a correct one.
                manual = (ann[a] == "manual" && auto[a] == "false" && reason[a] != "-")
                note = ""
                if (ann[a] != "-" && !manual) {
                  note = " [sync-policy declaration MALFORMED: annotation=" ann[a] " automated=" auto[a] " reason=" (reason[a] == "-" ? "absent" : "present") "; the full Synced+Healthy contract applies]"
                } else if (ann[a] == "-" && auto[a] == "false") {
                  note = " [omits spec.syncPolicy.automated and claims no zeta.io/sync-policy: manual -- an absent block is indistinguishable from a forgotten one, so the full Synced+Healthy contract applies]"
                }

                if (manual) {
                  comparisonDone = (sync[a] == "Synced" || sync[a] == "OutOfSync")
                  healthOk = (health[a] == "Missing" || health[a] == "Healthy")
                  if (comparisonDone && healthOk) {
                    printf "excluded-manual-sync\t%s\tnothing on this boot runs `argocd app sync` and the Application declares zeta.io/sync-policy: manual; it still passed the weaker contract (sync=%s health=%s). Stated reason: %s\n", a, sync[a], health[a], reason[a]
                  } else if (!comparisonDone) {
                    printf "unconverged\t%s\tdeclared manual-sync, but ArgoCD never COMPLETED a comparison (sync=%s), so its source did not render; health=%s msg=%s\n", a, sync[a], health[a], msg[a]
                  } else {
                    printf "unconverged\t%s\tdeclared manual-sync, but health=%s; a never-synced app must read Missing and a hand-synced one Healthy (sync=%s msg=%s)\n", a, health[a], sync[a], msg[a]
                  }
                  continue
                }

                if (sync[a] == "Synced" && health[a] == "Healthy") {
                  printf "converged\t%s\tsync=Synced health=Healthy%s\n", a, note
                  continue
                }
                if (a in unschedWhy) {
                  printf "excluded-unschedulable\t%s\tno Node carries the nodeSelector label %s, so this Application cannot schedule on this fleet; sync=%s health=%s%s\n", a, unschedWhy[a], sync[a], health[a], note
                  continue
                }
                if (a in affWhy) {
                  printf "undecidable\t%s\tthe scheduler REFUSED to place pod %s (PodScheduled=False) and it carries requiredDuringSchedulingIgnoredDuringExecution nodeAffinity, which this check does not evaluate (it decides spec.nodeSelector only); sync=%s health=%s%s\n", a, affWhy[a], sync[a], health[a], note
                  continue
                }
                printf "unconverged\t%s\tsync=%s health=%s msg=%s%s\n", a, sync[a], health[a], msg[a], note
              }
            }
          ' "$1"
        }

        zeta_wp11_roster_counts() {
          # $1 = a classification file as zeta_wp11_classify_roster emits.
          # stdout: ONE line, six space-separated integers --
          #   converged unconverged excluded undecidable unattributed applications
          # `applications` deliberately EXCLUDES unattributed-pod rows, which
          # name pods and not Applications; counting them as apps would inflate
          # the denominator the progress line prints.
          "$AWK" -F '\t' '
            { c[$1]++ }
            END {
              conv = c["converged"] + 0
              unconv = c["unconverged"] + 0
              excl = c["excluded-manual-sync"] + 0 + c["excluded-unschedulable"] + 0
              undec = c["undecidable"] + 0
              unattr = c["unattributed-pod"] + 0
              printf "%d %d %d %d %d %d\n", conv, unconv, excl, undec, unattr, conv + unconv + excl + undec
            }
          ' "$1"
        }
        # ZETA-WP11-ROSTER-END

        collect_roster_facts() {
          # Flattening ONLY -- every decision lives in the awk above, which is
          # the half a parity test can execute. jq here extracts fields and
          # nothing more.
          #
          # RETURNS 1 WHEN THE APPLICATIONS PROBE ITSELF FAILED, and the caller
          # must treat that sample as UNKNOWN rather than as a measurement.
          # 081M3BP768B087G0R0010C6GPR: the first live run of this verdict
          # (36097310492) piped that probe straight into jq under `|| true`, so
          # a kubectl that could not reach the API server produced an EMPTY
          # facts file, which classified as a perfectly clean `0/0` roster.
          # MEASURED: 17 of 59 samples read `0/0 ... zeta-root sync=-` on a
          # cluster that at its peak had 25 of 35 Applications Synced+Healthy.
          # A failed probe reported as a negative result is the exact defect
          # class this verdict was built to catch, reproduced one layer down in
          # the verdict's own collection -- and had the final sample been one of
          # those 17, the verdict would have reported `appCount=0` about a
          # cluster it simply failed to ask.
          : > "$1"
          _apps_json="$($MKTEMP)"
          if ! kc -n argocd get applications -o json > "$_apps_json" 2>/dev/null; then
            ${pkgs.coreutils}/bin/rm -f "$_apps_json"
            return 1
          fi
          # An empty body is the same failure wearing exit code 0 (a truncated
          # response, a connection closed mid-stream). `.items` absent is NOT
          # the same as `.items == []`: a real cluster with no Applications
          # still returns a List with an empty items array.
          if ! "$JQ" -e 'has("items")' < "$_apps_json" >/dev/null 2>&1; then
            ${pkgs.coreutils}/bin/rm -f "$_apps_json"
            return 1
          fi
          "$JQ" -r '
            def dash(n): (. // "") | tostring | gsub("[\t\n\r]"; " ") | .[0:n] | (if . == "" then "-" else . end);
            .items[]? | . as $app
            | ( [ "A",
                  ($app.metadata.name | dash(120)),
                  ($app.status.sync.status | dash(40)),
                  ($app.status.health.status | dash(40)),
                  ($app.metadata.annotations["zeta.io/sync-policy"] | dash(40)),
                  (if ($app.spec.syncPolicy.automated // null) == null then "false" else "true" end),
                  ($app.metadata.annotations["zeta.io/sync-policy-reason"] | dash(180)),
                  (($app.status.health.message // ($app.status.conditions[0].message? // "")) | dash(160))
                ] | @tsv ),
              ( [ "N", ($app.metadata.name | dash(120)), ($app.spec.destination.namespace | dash(120)) ] | @tsv ),
              ( (($app.status.resources // [])[] | select((.namespace // "") != "")
                 | [ "N", ($app.metadata.name | dash(120)), (.namespace | dash(120)) ] | @tsv) )
          ' < "$_apps_json" >> "$1" || true
          ${pkgs.coreutils}/bin/rm -f "$_apps_json"
          # Nodes and pods are NOT fatal to a sample: they only ever make the
          # exclusion buckets SMALLER (no labels -> nothing is provably
          # unschedulable; no pods -> nothing is undecidable), which is the
          # conservative direction. The Applications probe is the one that
          # decides whether there is a measurement at all.
          kc get nodes -o json 2>/dev/null | "$JQ" -r '
            .items[]? | (.metadata.labels // {}) | to_entries[] | [ "L", "\(.key)=\(.value)" ] | @tsv
          ' >> "$1" || true
          kc get pods -A -o json 2>/dev/null | "$JQ" -r '
            .items[]? | select((.status.phase // "") == "Pending") | . as $p
            | ((($p.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution) // null) != null) as $aff
            | ((($p.status.conditions // []) | map(select(.type == "PodScheduled" and .status == "False")) | length) > 0) as $unsched
            | (($p.metadata.labels // {})["app.kubernetes.io/instance"] // "-") as $inst
            | (($p.spec.nodeSelector // {}) | to_entries) as $sel
            | if ($sel | length) == 0
              then ([ "P", $p.metadata.namespace, $p.metadata.name, $inst, ($aff | tostring), ($unsched | tostring), "-", "-" ] | @tsv)
              else ($sel[] | [ "P", $p.metadata.namespace, $p.metadata.name, $inst, ($aff | tostring), ($unsched | tostring), .key, (.value | tostring) ] | @tsv)
              end
          ' >> "$1" || true
          return 0
        }

        roster_app_diag() {
          # $1 = classification file. Dumps ArgoCD own account of why, for up to
          # ten unconverged Applications. Same discipline as bad_pod_diag: a
          # verdict that names an app and cannot say why leaves the reader with
          # the failure and none of the evidence.
          "$AWK" -F '\t' '$1 == "unconverged" { print $2 }' "$1" | ${pkgs.coreutils}/bin/head -n 10 \
          | while IFS= read -r _app; do
              [ -z "$_app" ] && continue
              log "[wp11-k3s-verify] --- unconverged Application diagnostics: ''${_app} ---"
              {
                kc -n argocd get application "$_app" -o json \
                  | "$JQ" -r '{sync: .status.sync.status, health: .status.health, conditions: .status.conditions, operation: .status.operationState.message}'
              } 2>&1 | while IFS= read -r _l; do log "[wp11-roster-diag] $_l"; done
            done
        }

        # 3000s, and the number was CORRECTED DOWNWARD after the first live run
        # (081M3BP768B087G0R0010C6GPR). This is not relaxing a bound to make a
        # run pass -- it is the opposite, and the distinction is the whole
        # reason for the paragraph:
        #
        #   A BOUND THAT OUTLIVES ITS READER IS NOT A BOUND. THE VERDICT SIMPLY
        #   NEVER EXISTS.
        #
        # The first version used 4200s (the upper end of k3s-first-boot-
        # roster.nix's measured 45-70 min) and clamped it to this unit's overall
        # `deadline_ts`, on the assumption that the harness's own
        # `K3S_VERIFY_TIMEOUT_SECONDS` (4500s) left ~300s of slack. IT DOES NOT.
        # The harness counts from the PHASE-3 LOGIN and this unit counts from
        # its own ExecStart, and MEASURED on run 36097310492 the two clocks are
        # ~770s apart: the harness stopped reading serial while the unit was
        # still polling at its own t=3730s, so NO verdict-7 JSON was ever
        # emitted and the whole block was ABSENT. (The `ABSENT is a FAILURE`
        # guard in summarizeK3sFirstBootVerifyVerdict is what turned that into
        # a red instead of a silent pass -- it earned its keep on the first
        # run.)
        #
        # 3000s + the measured ~770s offset + a reporting budget for ~50 rows
        # and up to ten per-app diagnostics lands the emit around the harness's
        # t=4000s, ~500s inside its 4500s.
        #
        # AND THE SHORTER BOUND COSTS NOTHING MEASURABLE. Same run: convergence
        # PEAKED at 25/35 Synced+Healthy at t=1214s and then went BACKWARDS
        # (13/35 from t=3007s onward, unchanged across the last four samples
        # 723s apart) as ArgoCD's repo-server began failing manifest generation
        # with `DeadlineExceeded`. More wall clock was not producing more
        # convergence; it was producing more silence.
        ROSTER_DEADLINE_SECONDS=3000
        ROSTER_POLL_SECONDS=30

        ROSTER_OK=false
        ROSTER_ROWS_JSON="[]"
        ROOT_SYNC_STATUS="-"
        ROSTER_APP_COUNT=0
        ROSTER_CONVERGED=0
        ROSTER_UNCONVERGED=0
        ROSTER_EXCLUDED=0
        ROSTER_UNDECIDABLE=0
        ROSTER_UNATTRIBUTED=0
        ROSTER_SAMPLES=0
        ROSTER_PROBE_FAILURES=0
        FACTS_FILE="$($MKTEMP)"
        : > "$FACTS_FILE"
        CLASS_FILE="$($MKTEMP)"
        : > "$CLASS_FILE"

        if [ "$K3S_ACTIVE" = "true" ]; then
          roster_deadline=$(( $(now_ts) + ROSTER_DEADLINE_SECONDS ))
          if [ "$roster_deadline" -gt "$deadline_ts" ]; then
            roster_deadline=$deadline_ts
          fi
          log "[wp11-k3s-verify] roster: waiting up to $(( roster_deadline - $(now_ts) ))s for every Application that CAN converge to reach Synced+Healthy"
          while true; do
            ROSTER_SAMPLES=$(( ROSTER_SAMPLES + 1 ))
            # A FAILED PROBE IS `unknown`, NEVER A NEGATIVE RESULT
            # (081M3BP768B087G0R0010C6GPR). The previous counts are left
            # STANDING rather than overwritten with zeros, because a kubectl
            # that could not reach the API server has measured nothing at all --
            # and a sample that measured nothing must not be able to report a
            # clean roster. Loud on serial, and carried into the verdict JSON as
            # `probeFailures` so a reader can tell a quiet cluster from an
            # unreachable one.
            if ! collect_roster_facts "$FACTS_FILE"; then
              ROSTER_PROBE_FAILURES=$(( ROSTER_PROBE_FAILURES + 1 ))
              log "[wp11-k3s-verify] roster probe FAILED at t=$(elapsed)s sample=''${ROSTER_SAMPLES} -- kubectl could not list Applications in namespace argocd. This sample is UNKNOWN: the previous counts stand and are NOT overwritten with zeros (''${ROSTER_PROBE_FAILURES} failure(s) so far)"
              if [ "$(now_ts)" -ge "$roster_deadline" ]; then
                break
              fi
              "$SLEEP" "$ROSTER_POLL_SECONDS"
              continue
            fi
            zeta_wp11_classify_roster "$FACTS_FILE" "zeta-root" > "$CLASS_FILE"
            ROOT_SYNC_STATUS="$(kc -n argocd get application zeta-root -o jsonpath='{.status.sync.status}' 2>/dev/null || true)"
            if [ -z "$ROOT_SYNC_STATUS" ]; then ROOT_SYNC_STATUS="-"; fi

            set -- $(zeta_wp11_roster_counts "$CLASS_FILE")
            ROSTER_CONVERGED="''${1:-0}"
            ROSTER_UNCONVERGED="''${2:-0}"
            ROSTER_EXCLUDED="''${3:-0}"
            ROSTER_UNDECIDABLE="''${4:-0}"
            ROSTER_UNATTRIBUTED="''${5:-0}"
            ROSTER_APP_COUNT="''${6:-0}"

            # Requirement: report progress WHILE waiting. Sixty-seven minutes of
            # silence on a serial log is indistinguishable from a hang.
            log "[wp11-k3s-verify] roster progress t=$(elapsed)s sample=''${ROSTER_SAMPLES}: ''${ROSTER_CONVERGED}/''${ROSTER_APP_COUNT} Synced+Healthy, ''${ROSTER_UNCONVERGED} progressing, ''${ROSTER_EXCLUDED} excluded, ''${ROSTER_UNDECIDABLE} undecidable, ''${ROSTER_UNATTRIBUTED} unattributed pod(s) (zeta-root sync=''${ROOT_SYNC_STATUS})"
            if [ $(( ROSTER_SAMPLES % 5 )) -eq 1 ]; then
              "$AWK" -F '\t' '$1 == "unconverged" || $1 == "undecidable" { printf "  %s %s -- %s\n", $1, $2, $3 }' "$CLASS_FILE" \
                | ${pkgs.coreutils}/bin/head -n 15 \
                | while IFS= read -r _l; do log "[wp11-roster] $_l"; done
            fi

            if [ "$ROOT_SYNC_STATUS" = "Synced" ] \
              && [ "$ROSTER_APP_COUNT" -gt 0 ] \
              && [ "$ROSTER_UNCONVERGED" -eq 0 ] \
              && [ "$ROSTER_UNDECIDABLE" -eq 0 ] \
              && [ "$ROSTER_UNATTRIBUTED" -eq 0 ]; then
              ROSTER_OK=true
              break
            fi
            if [ "$(now_ts)" -ge "$roster_deadline" ]; then
              break
            fi
            "$SLEEP" "$ROSTER_POLL_SECONDS"
          done
        fi
        ROSTER_ELAPSED=$(elapsed)

        ROSTER_ROWS_JSON="$("$JQ" -R -s -c '
          split("\n") | map(select(length > 0) | split("\t")) | map({bucket: .[0], name: .[1], detail: .[2]})
        ' < "$CLASS_FILE" 2>/dev/null || echo "[]")"

        # THREE DISTINGUISHABLE SENTENCES, on the serial, on every boot --
        # converged / did-not-converge-within-bound / excluded-and-why. A
        # verdict whose pass and whose "nothing was measured" read the same is
        # the class this effort has now found NINE instances of; this is the
        # same guard verdict 6 carries, applied to the roster.
        if [ "$K3S_ACTIVE" != "true" ]; then
          log "[wp11-k3s-verify] verdict 7/7 rosterConverged=false after ''${ROSTER_ELAPSED}s -- k3s.service NEVER BECAME ACTIVE, so ZERO Applications were ever examined; this is a failure, not a clean roster (see verdict 2/7 above)"
        elif [ "$ROSTER_APP_COUNT" -eq 0 ]; then
          log "[wp11-k3s-verify] verdict 7/7 rosterConverged=false after ''${ROSTER_ELAPSED}s (''${ROSTER_SAMPLES} sample(s)) -- ZERO Applications were observed in namespace argocd (zeta-root sync=''${ROOT_SYNC_STATUS}); an empty roster is an absent measurement, never a clean one [''${ROSTER_PROBE_FAILURES} of ''${ROSTER_SAMPLES} sample(s) could not reach the API server at all and were counted as UNKNOWN, never as an empty roster]"
        elif [ "$ROSTER_OK" = "true" ]; then
          log "[wp11-k3s-verify] verdict 7/7 rosterConverged=true after ''${ROSTER_ELAPSED}s (''${ROSTER_SAMPLES} sample(s)): ''${ROSTER_CONVERGED}/''${ROSTER_APP_COUNT} Applications Synced+Healthy, ''${ROSTER_EXCLUDED} excluded and named below, 0 undecidable (zeta-root sync=''${ROOT_SYNC_STATUS}, so the roster is COMPLETE) [''${ROSTER_PROBE_FAILURES} of ''${ROSTER_SAMPLES} sample(s) could not reach the API server at all and were counted as UNKNOWN, never as an empty roster]"
        elif [ "$ROOT_SYNC_STATUS" != "Synced" ]; then
          log "[wp11-k3s-verify] verdict 7/7 rosterConverged=false after ''${ROSTER_ELAPSED}s (''${ROSTER_SAMPLES} sample(s)): zeta-root itself reports sync=''${ROOT_SYNC_STATUS}, not Synced -- the roster is INCOMPLETE, so the ''${ROSTER_APP_COUNT} Applications seen are not known to be all of them (''${ROSTER_CONVERGED} of them Synced+Healthy, ''${ROSTER_UNCONVERGED} progressing) [''${ROSTER_PROBE_FAILURES} of ''${ROSTER_SAMPLES} sample(s) could not reach the API server at all and were counted as UNKNOWN, never as an empty roster]"
        else
          log "[wp11-k3s-verify] verdict 7/7 rosterConverged=false after ''${ROSTER_ELAPSED}s (''${ROSTER_SAMPLES} sample(s), bound reached): ''${ROSTER_CONVERGED}/''${ROSTER_APP_COUNT} Synced+Healthy, ''${ROSTER_UNCONVERGED} did NOT converge within the bound, ''${ROSTER_UNDECIDABLE} undecidable, ''${ROSTER_UNATTRIBUTED} unattributed pod(s) [''${ROSTER_PROBE_FAILURES} of ''${ROSTER_SAMPLES} sample(s) could not reach the API server at all and were counted as UNKNOWN, never as an empty roster]"
        fi
        # Every row, every boot -- including the excluded ones. An exclusion
        # nobody can see is how a verdict becomes decorative.
        while IFS="$(printf '\t')" read -r _bucket _name _detail; do
          [ -z "$_bucket" ] && continue
          log "[wp11-k3s-verify]   roster ''${_bucket}: ''${_name} -- ''${_detail}"
        done < "$CLASS_FILE"
        if [ "$ROSTER_OK" != "true" ] && [ "$K3S_ACTIVE" = "true" ] && [ "$ROSTER_UNCONVERGED" -gt 0 ]; then
          roster_app_diag "$CLASS_FILE"
        fi

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
          --argjson podCount "$TOTAL_POD_COUNT" \
          --argjson samples "$SAMPLES" \
          --argjson k3sActiveForPods "$K3S_ACTIVE" \
          --argjson rosterConverged "$ROSTER_OK" \
          --argjson rosterApps "$ROSTER_ROWS_JSON" \
          --argjson rosterElapsedSeconds "$ROSTER_ELAPSED" \
          --argjson rosterAppCount "$ROSTER_APP_COUNT" \
          --argjson rosterConvergedCount "$ROSTER_CONVERGED" \
          --argjson rosterUnconvergedCount "$ROSTER_UNCONVERGED" \
          --argjson rosterExcludedCount "$ROSTER_EXCLUDED" \
          --argjson rosterUndecidableCount "$ROSTER_UNDECIDABLE" \
          --argjson rosterUnattributedCount "$ROSTER_UNATTRIBUTED" \
          --argjson rosterSamples "$ROSTER_SAMPLES" \
          --argjson rosterProbeFailures "$ROSTER_PROBE_FAILURES" \
          --arg rootSyncStatus "$ROOT_SYNC_STATUS" \
          --argjson k3sActiveForRoster "$K3S_ACTIVE" \
          '{
            bootedMultiUser: {ok: $bootedMultiUser, elapsedSeconds: $bootedMultiUserElapsedSeconds},
            k3sServiceActive: {ok: $k3sServiceActive, elapsedSeconds: $k3sServiceActiveElapsedSeconds},
            nodeReady: {ok: $nodeReady, elapsedSeconds: $nodeReadyElapsedSeconds},
            helmJobs: {jobs: $helmJobs, elapsedSeconds: $helmJobsElapsedSeconds},
            rootLanded: {ok: $rootLanded, verdict: $rootLandedVerdict, elapsedSeconds: $rootLandedElapsedSeconds},
            noBadPods: {ok: $noBadPods, pods: $badPods, elapsedSeconds: $badPodsElapsedSeconds, podCount: $podCount, samples: $samples, k3sActive: $k3sActiveForPods},
            rosterConverged: {
              ok: $rosterConverged,
              apps: $rosterApps,
              elapsedSeconds: $rosterElapsedSeconds,
              appCount: $rosterAppCount,
              convergedCount: $rosterConvergedCount,
              unconvergedCount: $rosterUnconvergedCount,
              excludedCount: $rosterExcludedCount,
              undecidableCount: $rosterUndecidableCount,
              unattributedPodCount: $rosterUnattributedCount,
              samples: $rosterSamples,
              probeFailures: $rosterProbeFailures,
              rootSyncStatus: $rootSyncStatus,
              k3sActive: $k3sActiveForRoster
            }
          }')"

        log "${jsonBeginMarker}"
        log "$VERDICT_JSON"
        log "${jsonEndMarker}"
        log "[wp11-k3s-verify] done"
      '';
    };
  };
}
