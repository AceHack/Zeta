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
# openbao and hindsight WERE a real gap, closed by a second convention value
# rather than a wider bucket (081M3BKQFNC087G0R003MDGSAX). Both are defensible
# non-convergences that hold on metal too, and neither is manual-SYNC: both
# are synced automatically and then wait on a HUMAN action (the OpenBao init
# ceremony; an external LLM API key). They now declare
# `zeta.io/sync-policy: converges-only-after-an-operator-action` with a reason
# naming the action and its doc, read off the LIVE object like `manual` -- no
# repo checkout, no second roster baked in at Nix eval time. They land in
# `excluded-operator-action`, and are asserted MORE strongly than manual-sync:
# sync must be exactly Synced, health must have been evaluated; only health may
# lag. A sync failure on either stays `unconverged`. Widening a bucket until a
# red goes green is the one move that would make this verdict stop meaning
# anything, which is why this is a second word and not a wider one.
#
# WHO OWNS THE RED -- READ THIS BEFORE SKIPPING A RED LANE.
# A permanently-red lane stops being read, and a lane nobody reads is worth
# less than no lane. So the known non-convergences are OWNED, by name, here:
#
#   cilium, weaviate   WP26. Synced+Progressing; cilium names its own cause,
#                      an ExcludedResourceWarning on EndpointSlice
#                      cilium-ingress. Being worked.
#   openbao, hindsight no longer red on their own account: they report as
#                      `excluded-operator-action`, naming the human action.
#                      If either shows up `unconverged`, its SYNC failed --
#                      that is a real finding, not the pending action.
#
# TWO KNOWN, BOTH OWNED. **A THIRD NAME IN THE `unconverged` LIST IS THE
# SIGNAL THIS VERDICT EXISTS TO PRODUCE** -- it is something new, on a real
# installed disk, that no other lane caught. Do not read past it. And when
# the two above are closed, this list must shrink with them, or it becomes
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
  # The WP11 guest's resource envelope (081M3K1K1XV087G0R002A6YFRS): on a guest
  # carrying this module's marker ONLY, the root Application is swapped for one
  # that excludes the dirs in k8s/wp11-ci-envelope.json. Verdict 7 below prints
  # what it excluded. That module, not this one, writes cluster state -- this
  # unit still only observes.
  imports = [ ./zeta-wp11-ci-envelope.nix ];

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

        # --- control-plane PRESSURE diagnostics (081M3K1K1XV087G0R002A6YFRS) --
        #
        # MEASURED run 36364782876: the API server stopped answering at ~157
        # pods (14 of 62 roster probes failed, then `connection refused` on
        # 6443 while k3s.service stayed active), and this serial log carried
        # NO journal or kernel lines -- so whether k3s restarted, etcd stalled,
        # the OOM killer fired or the node thrashed on reclaim could not be
        # told apart. This captures the evidence that separates them, the first
        # time the API stops answering and again at the end.
        #
        # THREE STATES, never two: `captured` (every section's command
        # succeeded), `failed` (at least one did not -- named, with its exit
        # status), `did-not-run` (the trigger never happened). A capture that
        # failed must not read as one that found nothing.
        SYSTEMCTL=${pkgs.systemd}/bin/systemctl
        JOURNALCTL=${pkgs.systemd}/bin/journalctl
        FREE=${pkgs.procps}/bin/free
        CAT=${pkgs.coreutils}/bin/cat
        GREP=${pkgs.gnugrep}/bin/grep
        TAIL=${pkgs.coreutils}/bin/tail
        RM=${pkgs.coreutils}/bin/rm
        PSI_DIR=/proc/pressure
        CGROUP_ROOT=/sys/fs/cgroup
        # ZETA-WP11-PRESSURE-BEGIN
        PRESSURE_UNREACHABLE_STATE=did-not-run
        PRESSURE_UNREACHABLE_DETAIL=""
        PRESSURE_END_STATE=did-not-run
        PRESSURE_END_DETAIL=""
        PRESSURE_LAST_STATE=did-not-run
        PRESSURE_LAST_DETAIL=""
        zeta_wp11_pressure_section() {
          # $1 = section name; the rest = the command. Streams its output to
          # the log, then records the section as captured or failed(exit N).
          _ps_name="$1"
          shift
          _ps_out="$("$MKTEMP")"
          "$@" > "$_ps_out" 2>&1
          _ps_rc=$?
          while IFS= read -r _ps_line; do
            log "[wp11-pressure] $_ps_name | $_ps_line"
          done < "$_ps_out"
          "$RM" -f "$_ps_out"
          if [ "$_ps_rc" -eq 0 ]; then
            log "[wp11-pressure] $_ps_name: captured"
          else
            log "[wp11-pressure] $_ps_name: FAILED (exit $_ps_rc) -- this section measured nothing"
            PRESSURE_LAST_DETAIL="$PRESSURE_LAST_DETAIL $_ps_name(exit $_ps_rc)"
          fi
        }
        zeta_wp11_oom_lines() {
          # The kernel log is read FIRST and its failure is a failure. Only
          # then is "no OOM line" a finding: grep exiting 1 on a log that WAS
          # read means zero OOM kills, which is evidence, not an error.
          _oom_log="$("$MKTEMP")"
          if ! "$JOURNALCTL" -k -b --no-pager > "$_oom_log"; then
            "$RM" -f "$_oom_log"
            return 1
          fi
          _oom_n="$("$GREP" -ciE 'out of memory|oom-kill|oom_reaper|killed process' "$_oom_log")"
          "$GREP" -iE 'out of memory|oom-kill|oom_reaper|killed process' "$_oom_log" | "$TAIL" -n 40
          echo "kernel OOM line(s) this boot: $_oom_n"
          "$RM" -f "$_oom_log"
          return 0
        }
        zeta_wp11_cgroup_protection() {
          # Whether k3s-process-protection.nix reached the kernel: the live
          # weights and memory protection, k3s.service vs the pods' slice.
          _cg_rc=0
          for _cg in system.slice system.slice/k3s.service kubepods.slice; do
            for _f in cpu.weight memory.low memory.min memory.current; do
              if [ -r "$CGROUP_ROOT/$_cg/$_f" ]; then
                echo "$_cg $_f=$("$CAT" "$CGROUP_ROOT/$_cg/$_f")"
              else
                echo "$_cg $_f=UNREADABLE"
                _cg_rc=1
              fi
            done
          done
          return "$_cg_rc"
        }
        zeta_wp11_k3s_journal_tail() {
          # MEASURED run 36832486494: the final 200 lines of this journal were
          # ~190 `Found left-over process N (containerd-shim)` / `Unit process N
          # remains running after unit stopped` lines -- systemd narrating every
          # surviving shim of a restart -- and not one line of why k3s died. The
          # same journal read at the restart that mattered was full of the cause
          # (etcd `apply request took too long`, then `leaderelection lost`,
          # then `Main process exited, status=1`). Filter the narration out.
          # The journal is read FIRST and its failure is a failure; only then is
          # an empty filtered tail just "nothing but narration".
          _kj_log="$("$MKTEMP")"
          if ! "$JOURNALCTL" -u k3s.service -b --no-pager -n 1500 > "$_kj_log"; then
            "$RM" -f "$_kj_log"
            return 1
          fi
          "$GREP" -vE 'left-over process|usually indicates unclean termination|remains running after unit stopped' "$_kj_log" | "$TAIL" -n 200
          "$RM" -f "$_kj_log"
          return 0
        }
        zeta_wp11_k3s_exits() {
          # WHEN k3s died, and the lines that say why, across the whole boot --
          # a run that restarted 14 times needs the timeline, not the last screen.
          _ke_log="$("$MKTEMP")"
          if ! "$JOURNALCTL" -u k3s.service -b --no-pager > "$_ke_log"; then
            "$RM" -f "$_ke_log"
            return 1
          fi
          "$GREP" -E 'Main process exited|Failed with result|Scheduled restart job|leaderelection lost|Consumed |level=fatal|panic:' "$_ke_log" | "$TAIL" -n 60
          "$RM" -f "$_ke_log"
          return 0
        }
        zeta_wp11_pressure_diag() {
          # $1 = why it ran. Sets PRESSURE_LAST_STATE / PRESSURE_LAST_DETAIL.
          PRESSURE_LAST_DETAIL=""
          log "[wp11-pressure] --- control-plane pressure diagnostics ($1, t=$(elapsed)s) ---"
          zeta_wp11_pressure_section "k3s-restarts" "$SYSTEMCTL" show k3s.service -p NRestarts -p ActiveState -p SubState -p ExecMainStartTimestamp -p ExecMainStatus --no-pager
          zeta_wp11_pressure_section "free-m" "$FREE" -m
          zeta_wp11_pressure_section "psi-cpu" "$CAT" "$PSI_DIR/cpu"
          zeta_wp11_pressure_section "psi-memory" "$CAT" "$PSI_DIR/memory"
          zeta_wp11_pressure_section "psi-io" "$CAT" "$PSI_DIR/io"
          zeta_wp11_pressure_section "kernel-oom" zeta_wp11_oom_lines
          zeta_wp11_pressure_section "cgroup-protection" zeta_wp11_cgroup_protection
          zeta_wp11_pressure_section "k3s-exits" zeta_wp11_k3s_exits
          zeta_wp11_pressure_section "k3s-journal" zeta_wp11_k3s_journal_tail
          if [ -z "$PRESSURE_LAST_DETAIL" ]; then
            PRESSURE_LAST_STATE=captured
          else
            PRESSURE_LAST_STATE=failed
          fi
          log "[wp11-pressure] result ($1): $PRESSURE_LAST_STATE$PRESSURE_LAST_DETAIL"
        }
        # ZETA-WP11-PRESSURE-END
        HEAD=${pkgs.coreutils}/bin/head
        SED=${pkgs.gnused}/bin/sed

        # --- CLUSTER diagnostics (WHY an Application did not converge) ---------
        #
        # MEASURED run 36832486494: verdict 7 failed 26/48 and named the 17
        # Applications that did not converge, but the log carried NOTHING that
        # says WHY. Three gaps, each visible in that serial log:
        #
        #   1. `roster_app_diag` runs at the very END, and by then k3s was in
        #      its 14th restart: four of its ten per-app dumps are the single
        #      line `The connection to the server 127.0.0.1:6443 was refused`.
        #      The evidence was requested after the witness had left. So this
        #      captures ONCE MID-RUN (while the API still answers) and once at
        #      the end, and at the end it WAITS (bounded) for the API to come
        #      back instead of firing into a restart.
        #   2. Nothing was ever printed about PODS: no describe, no Events, no
        #      `logs --previous`, no Pending reason. The "pods 85/141" line
        #      counts them and cannot say whether the 56 others were waiting
        #      for capacity, an unbound claim, an image pull or a crash loop.
        #   3. Nothing compared what the pods REQUEST with what the node HAS,
        #      which is the question a 4 vCPU / 12 GiB guest running 141 pods
        #      turns on.
        #
        # SAME THREE STATES AS THE PRESSURE BLOCK, and for the same reason: a
        # capture that FAILED must not read as one that found nothing.
        #   captured    every hard section ran and produced its output
        #   failed      at least one did not -- named, with why (exit status,
        #               line budget, deadline, or API never answering)
        #   did-not-run the trigger never happened (a passing run, or k3s
        #               never active)
        # A SOFT section (`kubectl top` without metrics-server, `logs` for a
        # pod that never started a container) is EXPECTED to fail on some
        # guests; it says so and does not make the capture `failed`.
        #
        # BOUNDED THREE WAYS, because this runs inside a verdict that has its
        # own deadline: a total line budget (CLUSTER_DIAG_MAX_LINES), a per
        # section cap, and a wall-clock deadline after which every remaining
        # section is skipped AND NAMED as skipped -- a skipped section is a
        # failed capture, never a quiet one. It only OBSERVES: read-only
        # kubectl, and every call carries --request-timeout.
        #
        # FAIL-SAFE: nothing in here can change the verdict. The caller treats
        # the function as best-effort (`|| true`), no section aborts the unit
        # (the script runs without `set -e`), and every variable is
        # initialised first because the unit runs under `set -u`.
        # ZETA-WP11-CLUSTERDIAG-BEGIN
        CLUSTER_DIAG_MID_STATE=did-not-run
        CLUSTER_DIAG_MID_DETAIL=""
        CLUSTER_DIAG_END_STATE=did-not-run
        CLUSTER_DIAG_END_DETAIL=""
        CLUSTER_DIAG_LAST_STATE=did-not-run
        CLUSTER_DIAG_LAST_DETAIL=""
        CLUSTER_DIAG_MID_DONE=false
        CLUSTER_DIAG_MID_AT_SECONDS=900
        CLUSTER_DIAG_LINES=0
        CLUSTER_DIAG_MAX_LINES=1000
        CLUSTER_DIAG_SECTION_LINES=120
        CLUSTER_DIAG_LINE_WIDTH=300
        CLUSTER_DIAG_POD_CAP=20
        CLUSTER_DIAG_APP_CAP=24
        CLUSTER_DIAG_API_WAIT_SECONDS=90
        CLUSTER_DIAG_DEADLINE_SECONDS=240
        CLUSTER_DIAG_DEADLINE_TS=0
        CLUSTER_DIAG_KUBECTL_TIMEOUT=20s
        zeta_wp11_kcd() {
          kc --request-timeout="$CLUSTER_DIAG_KUBECTL_TIMEOUT" "$@"
        }
        zeta_wp11_cdiag_emit() {
          # $1 = label, $2 = file, $3 = cap for this section. Returns 3 when the
          # total line budget ran out before the file was fully written.
          _ce_label="$1"
          _ce_file="$2"
          _ce_cap="$3"
          _ce_n=0
          while IFS= read -r _ce_line; do
            if [ "$CLUSTER_DIAG_LINES" -ge "$CLUSTER_DIAG_MAX_LINES" ]; then
              return 3
            fi
            if [ "$_ce_n" -ge "$_ce_cap" ]; then
              log "[wp11-cluster-diag] $_ce_label | ... truncated at $_ce_cap line(s) for this section"
              return 0
            fi
            _ce_n=$(( _ce_n + 1 ))
            CLUSTER_DIAG_LINES=$(( CLUSTER_DIAG_LINES + 1 ))
            log "[wp11-cluster-diag] $_ce_label | ''${_ce_line:0:$CLUSTER_DIAG_LINE_WIDTH}"
          done < "$_ce_file"
          return 0
        }
        zeta_wp11_cdiag_section() {
          # $1 = hard|soft, $2 = per-section line cap, $3 = name, rest = command.
          # Never returns non-zero: a diagnostic must not be able to fail the unit.
          _cs_kind="$1"
          _cs_cap="$2"
          _cs_name="$3"
          shift 3
          if [ "$(now_ts)" -ge "$CLUSTER_DIAG_DEADLINE_TS" ]; then
            log "[wp11-cluster-diag] $_cs_name: SKIPPED (diagnostic deadline reached) -- this section measured nothing"
            CLUSTER_DIAG_LAST_DETAIL="$CLUSTER_DIAG_LAST_DETAIL $_cs_name(deadline)"
            return 0
          fi
          _cs_out="$("$MKTEMP")"
          "$@" > "$_cs_out" 2>&1 < /dev/null
          _cs_rc=$?
          zeta_wp11_cdiag_emit "$_cs_name" "$_cs_out" "$_cs_cap"
          _cs_er=$?
          "$RM" -f "$_cs_out"
          if [ "$_cs_er" -eq 3 ]; then
            log "[wp11-cluster-diag] $_cs_name: SKIPPED (line budget of $CLUSTER_DIAG_MAX_LINES exhausted) -- output past this point was dropped"
            CLUSTER_DIAG_LAST_DETAIL="$CLUSTER_DIAG_LAST_DETAIL $_cs_name(budget)"
          elif [ "$_cs_rc" -eq 0 ]; then
            log "[wp11-cluster-diag] $_cs_name: captured"
          elif [ "$_cs_kind" = "soft" ]; then
            log "[wp11-cluster-diag] $_cs_name: unavailable (exit $_cs_rc) -- expected on some guests; not counted as a failed capture"
          else
            log "[wp11-cluster-diag] $_cs_name: FAILED (exit $_cs_rc) -- this section measured nothing"
            CLUSTER_DIAG_LAST_DETAIL="$CLUSTER_DIAG_LAST_DETAIL $_cs_name(exit $_cs_rc)"
          fi
          return 0
        }
        zeta_wp11_cdiag_wait_api() {
          # The end-of-run capture used to fire into a k3s restart. Poll a read
          # that needs etcd (not /version, which answers without it).
          _cw_end=$(( $(now_ts) + CLUSTER_DIAG_API_WAIT_SECONDS ))
          while true; do
            if zeta_wp11_kcd get namespace kube-system -o name > /dev/null 2>&1; then
              return 0
            fi
            if [ "$(now_ts)" -ge "$_cw_end" ]; then
              return 1
            fi
            "$SLEEP" 5
          done
        }
        zeta_wp11_cdiag_capacity() {
          # $1 = pods json, $2 = nodes json. What the node HAS vs what pods ASK
          # for. Container requests only (initContainers are transient and
          # DaemonSet overhead is already inside the pod list), so this is a
          # lower bound on what the scheduler counted -- stated, not hidden.
          "$JQ" -n -r --slurpfile p "$1" --slurpfile n "$2" '
            def cpu: if . == null then 0 elif type == "number" then . * 1000 elif endswith("m") then (.[:-1] | tonumber) else (tonumber * 1000) end;
            def mem: if . == null then 0 elif type == "number" then . else (capture("^(?<n>[0-9.]+)(?<u>[A-Za-z]*)$") | (.n | tonumber) * ({"": 1, "Ki": 1024, "Mi": 1048576, "Gi": 1073741824, "Ti": 1099511627776, "k": 1000, "K": 1000, "M": 1000000, "G": 1000000000}[.u] // 1)) end;
            def mib: ((. / 1048576) | floor);
            def pct($a; $b): if $b > 0 then (($a * 100 / $b) | floor) else -1 end;
            ($p[0].items // []) as $pods
            | ($n[0].items // []) as $nodes
            | [$pods[] | select((.status.phase // "") != "Succeeded" and (.status.phase // "") != "Failed")] as $live
            | ([$live[] | .spec.containers[] | (.resources.requests.cpu | cpu)] | add // 0) as $rcpu
            | ([$live[] | .spec.containers[] | (.resources.requests.memory | mem)] | add // 0) as $rmem
            | ([$live[] | .spec.containers[] | (.resources.limits.memory | mem)] | add // 0) as $lmem
            | ([$nodes[] | (.status.allocatable.cpu | cpu)] | add // 0) as $acpu
            | ([$nodes[] | (.status.allocatable.memory | mem)] | add // 0) as $amem
            | ([$live[] | select(([.spec.containers[] | .resources.requests.cpu] | all(. == null)))] | length) as $nocpu
            | ([$live[] | select(([.spec.containers[] | .resources.requests.memory] | all(. == null)))] | length) as $nomem
            | ( ($nodes[] | "node \(.metadata.name): allocatable cpu=\(.status.allocatable.cpu) memory=\(.status.allocatable.memory) pods=\(.status.allocatable.pods)"),
                "sum of container requests over \($live | length) live pod(s): cpu=\($rcpu)m of \($acpu)m allocatable (\(pct($rcpu; $acpu))%), memory=\($rmem | mib)Mi of \($amem | mib)Mi (\(pct($rmem; $amem))%)",
                "sum of container memory LIMITS: \($lmem | mib)Mi = \(pct($lmem; $amem))% of allocatable memory (above 100% is overcommit: eviction becomes possible)",
                "live pods with NO cpu request: \($nocpu); with NO memory request: \($nomem) (those schedule anywhere and are evicted first)",
                "top 15 memory requesters:",
                ( [$live[] | {n: "\(.metadata.namespace)/\(.metadata.name)", m: ([.spec.containers[] | (.resources.requests.memory | mem)] | add // 0), c: ([.spec.containers[] | (.resources.requests.cpu | cpu)] | add // 0)}] | sort_by(-.m) | .[:15][] | "  \(.n) memory=\(.m | mib)Mi cpu=\(.c)m" )
              )
          ' || return 1
        }
        zeta_wp11_cdiag_census() {
          # $1 = pods json. The Pending-reason census: WHY each not-ready pod is
          # not ready, grouped. Capacity (Insufficient cpu/memory), an unbound
          # claim, an untolerated taint, an image pull and a crash loop are five
          # different diseases that all read `0/1 Running` in `get pods`.
          "$JQ" -r '
            def notready: (.status.phase // "") != "Succeeded" and (((.status.phase // "") != "Running") or ([(.status.containerStatuses // [])[] | .ready] | all | not));
            def cats:
              ((.status.conditions // []) | map(select(.type == "PodScheduled" and .status == "False")) | .[0].message // null) as $sm
              | ([((.status.initContainerStatuses // []) + (.status.containerStatuses // []))[] | (.state.waiting.reason // empty), ((.lastState.terminated.reason // empty) | "last-terminated: " + .)] | unique) as $r
              | if $sm != null then
                  [ (if ($sm | test("Insufficient cpu")) then "Pending: Insufficient cpu" else empty end),
                    (if ($sm | test("Insufficient memory")) then "Pending: Insufficient memory" else empty end),
                    (if ($sm | test("Insufficient ephemeral")) then "Pending: Insufficient ephemeral-storage" else empty end),
                    (if ($sm | test("unbound")) then "Pending: unbound PersistentVolumeClaim" else empty end),
                    (if ($sm | test("untolerated taint")) then "Pending: untolerated taint" else empty end),
                    (if ($sm | test("affinity|selector")) then "Pending: node affinity or selector mismatch" else empty end),
                    (if ($sm | test("[Tt]oo many pods")) then "Pending: too many pods" else empty end) ]
                  | if length == 0 then ["Pending: unschedulable (" + ($sm | .[0:120]) + ")"] else . end
                elif (.status.phase // "") == "Failed" then ["Failed: " + (.status.reason // "unknown")]
                elif ($r | length) > 0 then $r
                elif (.status.phase // "") == "Pending" then ["Pending: scheduled, no container status yet"]
                else ["Running but not Ready"] end;
            ([.items[] | select(notready)]) as $bad
            | "\($bad | length) not-ready pod(s) of \(.items | length) total",
              ( [$bad[] | {pod: "\(.metadata.namespace)/\(.metadata.name)", cats: cats} | . as $r | $r.cats[] | {cat: ., pod: $r.pod}]
                | group_by(.cat) | sort_by(-length) | .[]
                | "\(length)\t\(.[0].cat)\t\([.[:8][].pod] | join(", "))" )
          ' "$1" || return 1
        }
        zeta_wp11_cdiag_unready_list() {
          # $1 = pods json. "namespace name restarts", worst first, capped.
          "$JQ" -r '
            [.items[]
              | select((.status.phase // "") != "Succeeded")
              | select(((.status.phase // "") != "Running") or ([(.status.containerStatuses // [])[] | .ready] | all | not))
              | {ns: .metadata.namespace, n: .metadata.name, r: ([(.status.containerStatuses // [])[] | .restartCount] | add // 0)}]
            | sort_by([-.r, .ns, .n]) | .[] | "\(.ns) \(.n) \(.r)"
          ' "$1" || return 1
        }
        zeta_wp11_cdiag_pod_describe() {
          # Container states, requests and the Events tail -- the lines that
          # name the cause -- not the whole 120-line describe.
          _pd_f="$("$MKTEMP")"
          zeta_wp11_kcd -n "$1" describe pod "$2" > "$_pd_f" 2>&1
          _pd_rc=$?
          "$GREP" -E '^(Name|Node|Status|Reason|Message|QoS Class):|^ *(State|Last State|Reason|Message|Exit Code|Restart Count|Requests|Limits|cpu|memory):' "$_pd_f" | "$HEAD" -n 50
          echo "--- events ---"
          "$SED" -n '/^Events:/,$p' "$_pd_f" | "$TAIL" -n 20
          "$RM" -f "$_pd_f"
          return "$_pd_rc"
        }
        zeta_wp11_cdiag_pod_logs() {
          # Per container, previous instance first (that is the one that died),
          # the current one as the fallback. At most four containers.
          _pl_n=0
          for _pl_c in $(zeta_wp11_kcd -n "$1" get pod "$2" -o jsonpath='{.status.initContainerStatuses[*].name} {.status.containerStatuses[*].name}' 2>/dev/null); do
            _pl_n=$(( _pl_n + 1 ))
            if [ "$_pl_n" -gt 4 ]; then
              echo "... further containers omitted"
              break
            fi
            echo "--- container $_pl_c: logs --previous --tail=60 ---"
            if ! zeta_wp11_kcd -n "$1" logs "$2" -c "$_pl_c" --previous --tail=60 2>&1; then
              echo "--- container $_pl_c: no previous instance; current logs --tail=30 ---"
              zeta_wp11_kcd -n "$1" logs "$2" -c "$_pl_c" --tail=30 2>&1 || true
            fi
          done
          if [ "$_pl_n" -eq 0 ]; then
            echo "no container statuses: the pod never started a container"
          fi
          return 0
        }
        zeta_wp11_cdiag_app() {
          # ArgoCD's own account of one Application: sync/health, the failing
          # operation, conditions, and every resource that is not Synced+Healthy
          # -- what `argocd app get` prints, read from the CR so no CLI is needed.
          zeta_wp11_kcd -n argocd get application "$1" -o json | "$JQ" -r '
            "sync=\(.status.sync.status // "-") health=\(.status.health.status // "-")",
            "operation: \(.status.operationState.phase // "-") \((.status.operationState.message // "") | .[0:300])",
            ((.status.conditions // [])[] | "condition \(.type): \((.message // "") | .[0:300])"),
            ((.status.operationState.syncResult.resources // []) | map(select(((.status // "") != "Synced") or ((.hookPhase // "") | test("Failed|Error")))) | .[:6][] | "failed task \(.kind) \(.namespace // "-")/\(.name) status=\(.status // "-") hook=\(.hookPhase // "-"): \((.message // "") | .[0:200])"),
            ((.status.resources // []) | map(select(((.health.status // "Healthy") != "Healthy") or ((.status // "Synced") != "Synced"))) | .[:15][] | "resource \(.kind) \(.namespace // "-")/\(.name) sync=\(.status // "-") health=\(.health.status // "-") \((.health.message // "") | .[0:160])")
          ' || return 1
        }
        zeta_wp11_cdiag_events() {
          zeta_wp11_kcd get events -A --field-selector type=Warning --sort-by=.lastTimestamp --no-headers > "$1" || return $?
          "$TAIL" -n 60 "$1"
        }
        zeta_wp11_cdiag_top_pods() {
          zeta_wp11_kcd top pods -A --sort-by=memory --no-headers | "$HEAD" -n 30
        }
        zeta_wp11_cluster_diag() {
          # $1 = why it ran (mid|end), $2 = roster classification file (optional).
          # Sets CLUSTER_DIAG_LAST_STATE / CLUSTER_DIAG_LAST_DETAIL.
          _cd_why="$1"
          _cd_class="''${2:-}"
          CLUSTER_DIAG_LAST_DETAIL=""
          CLUSTER_DIAG_LAST_STATE=did-not-run
          CLUSTER_DIAG_LINES=0
          CLUSTER_DIAG_DEADLINE_TS=$(( $(now_ts) + CLUSTER_DIAG_DEADLINE_SECONDS ))
          log "[wp11-cluster-diag] --- cluster diagnostics ($_cd_why, t=$(elapsed)s) ---"
          if ! zeta_wp11_cdiag_wait_api; then
            log "[wp11-cluster-diag] api-wait: the API server did not answer within ''${CLUSTER_DIAG_API_WAIT_SECONDS}s -- every kubectl section was SKIPPED. This is a FAILED capture, not an empty cluster (see the pressure diagnostics and k3s journal for why)"
            CLUSTER_DIAG_LAST_STATE=failed
            CLUSTER_DIAG_LAST_DETAIL=" api-unreachable(''${CLUSTER_DIAG_API_WAIT_SECONDS}s)"
            log "[wp11-cluster-diag] result ($_cd_why): $CLUSTER_DIAG_LAST_STATE$CLUSTER_DIAG_LAST_DETAIL"
            return 0
          fi
          _cd_pods="$("$MKTEMP")"
          _cd_nodes="$("$MKTEMP")"
          _cd_list="$("$MKTEMP")"
          _cd_events="$("$MKTEMP")"
          # The pod list is read ONCE and every derived section reuses the file:
          # four separate `get pods` against an API under pressure is how the
          # capture itself becomes part of the load.
          _cd_pods_ok=true
          _cd_nodes_ok=true
          zeta_wp11_kcd get pods -A -o json > "$_cd_pods" 2>/dev/null || _cd_pods_ok=false
          zeta_wp11_kcd get nodes -o json > "$_cd_nodes" 2>/dev/null || _cd_nodes_ok=false
          zeta_wp11_cdiag_section hard 20 "nodes" zeta_wp11_kcd get nodes -o wide
          if [ "$_cd_pods_ok" = "true" ] && [ "$_cd_nodes_ok" = "true" ]; then
            zeta_wp11_cdiag_section hard 40 "capacity-vs-requests" zeta_wp11_cdiag_capacity "$_cd_pods" "$_cd_nodes"
          else
            log "[wp11-cluster-diag] capacity-vs-requests: FAILED -- the pod or node list could not be read -- this section measured nothing"
            CLUSTER_DIAG_LAST_DETAIL="$CLUSTER_DIAG_LAST_DETAIL capacity-vs-requests(list)"
          fi
          zeta_wp11_cdiag_section hard 400 "pods-wide" zeta_wp11_kcd get pods -A -o wide
          if [ "$_cd_pods_ok" = "true" ]; then
            zeta_wp11_cdiag_section hard 60 "pending-reason-census" zeta_wp11_cdiag_census "$_cd_pods"
            if zeta_wp11_cdiag_unready_list "$_cd_pods" > "$_cd_events" 2>/dev/null; then
              "$HEAD" -n "$CLUSTER_DIAG_POD_CAP" "$_cd_events" > "$_cd_list"
            else
              log "[wp11-cluster-diag] unready-pod-list: FAILED -- no per-pod describe or logs follow -- this section measured nothing"
              CLUSTER_DIAG_LAST_DETAIL="$CLUSTER_DIAG_LAST_DETAIL unready-pod-list(jq)"
            fi
          else
            log "[wp11-cluster-diag] pending-reason-census: FAILED -- the pod list could not be read -- this section measured nothing"
            CLUSTER_DIAG_LAST_DETAIL="$CLUSTER_DIAG_LAST_DETAIL pending-reason-census(list)"
          fi
          zeta_wp11_cdiag_section soft 30 "top-nodes" zeta_wp11_kcd top nodes
          zeta_wp11_cdiag_section soft 35 "top-pods-by-memory" zeta_wp11_cdiag_top_pods
          zeta_wp11_cdiag_section hard 60 "warning-events" zeta_wp11_cdiag_events "$_cd_events"
          while IFS=' ' read -r _cd_ns _cd_name _cd_restarts; do
            [ -z "$_cd_ns" ] && continue
            zeta_wp11_cdiag_section hard 75 "describe:$_cd_ns/$_cd_name(restarts=$_cd_restarts)" zeta_wp11_cdiag_pod_describe "$_cd_ns" "$_cd_name"
            zeta_wp11_cdiag_section soft 70 "logs:$_cd_ns/$_cd_name" zeta_wp11_cdiag_pod_logs "$_cd_ns" "$_cd_name"
          done < "$_cd_list"
          if [ -n "$_cd_class" ] && [ -r "$_cd_class" ]; then
            # Not-Progressing rows first: an OutOfSync / Degraded / Missing row is
            # where a defect rather than a small box shows up.
            "$AWK" -F '\t' '
              ($1 == "unconverged" || $1 == "undecidable") { if ($3 ~ /^sync=Synced health=Progressing/) later[++m] = $2; else print $2 }
              END { for (i = 1; i <= m; i++) print later[i] }
            ' "$_cd_class" | "$HEAD" -n "$CLUSTER_DIAG_APP_CAP" > "$_cd_list"
            while IFS= read -r _cd_app; do
              [ -z "$_cd_app" ] && continue
              zeta_wp11_cdiag_section hard 40 "app:$_cd_app" zeta_wp11_cdiag_app "$_cd_app"
            done < "$_cd_list"
          fi
          "$RM" -f "$_cd_pods" "$_cd_nodes" "$_cd_list" "$_cd_events"
          if [ -z "$CLUSTER_DIAG_LAST_DETAIL" ]; then
            CLUSTER_DIAG_LAST_STATE=captured
          else
            CLUSTER_DIAG_LAST_STATE=failed
          fi
          log "[wp11-cluster-diag] result ($_cd_why): $CLUSTER_DIAG_LAST_STATE$CLUSTER_DIAG_LAST_DETAIL ($CLUSTER_DIAG_LINES line(s) of a $CLUSTER_DIAG_MAX_LINES budget)"
          return 0
        }
        # ZETA-WP11-CLUSTERDIAG-END

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
          #   excluded-operator-action declares zeta.io/sync-policy:
          #                          converges-only-after-an-operator-action
          #                          WITH a reason and WITH an automated block,
          #                          reads sync=Synced, and has an EVALUATED
          #                          health that is not yet Healthy
          #                          (manual-sync-policy.ts's
          #                          operatorActionAssertion). The reason -- the
          #                          human action -- is on the line.
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
                # The "operator-action" arm (081M3BKQFNC087G0R003MDGSAX): the
                # annotation exactly converges-only-after-an-operator-action,
                # an automated block PRESENT (the app IS synced), non-empty
                # reason. Anything else is malformed -> full contract.
                opAction = (ann[a] == "converges-only-after-an-operator-action" && auto[a] == "true" && reason[a] != "-")
                note = ""
                if (ann[a] != "-" && !manual && !opAction) {
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

                # manual-sync-policy.ts operatorActionAssertion. STRONGER than
                # the manual arm on what can be observed: it IS synced, so sync
                # must be exactly Synced; only health may lag, and it must have
                # been EVALUATED. Synced+Healthy falls through to `converged`
                # (the operator already acted). An exclusion that asserts
                # nothing is a decoration, so a sync failure stays unconverged.
                if (opAction && !(sync[a] == "Synced" && health[a] == "Healthy")) {
                  evaluated = (health[a] == "Progressing" || health[a] == "Degraded" || health[a] == "Suspended" || health[a] == "Missing")
                  if (sync[a] != "Synced") {
                    printf "unconverged\t%s\tdeclared converges-only-after-an-operator-action, which means it IS synced -- but sync=%s; a pending human action cannot explain a sync failure (health=%s msg=%s)\n", a, sync[a], health[a], msg[a]
                  } else if (!evaluated) {
                    printf "unconverged\t%s\tdeclared converges-only-after-an-operator-action, but health=%s -- ArgoCD never evaluated it (sync=%s msg=%s)\n", a, health[a], sync[a], msg[a]
                  } else {
                    printf "excluded-operator-action\t%s\tSynced, and waiting on a HUMAN action before it can become Healthy (health=%s). OPERATOR ACTION: %s\n", a, health[a], reason[a]
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
              excl = c["excluded-manual-sync"] + 0 + c["excluded-unschedulable"] + 0 + c["excluded-operator-action"] + 0
              undec = c["undecidable"] + 0
              unattr = c["unattributed-pod"] + 0
              printf "%d %d %d %d %d %d\n", conv, unconv, excl, undec, unattr, conv + unconv + excl + undec
            }
          ' "$1"
        }
        zeta_wp11_count_or_unknown() {
          # $1 = the probe's EXIT STATUS. $2 = the probe's stdout.
          # stdout: the number of non-blank lines, or "-" when the probe failed.
          #
          # THE EXIT STATUS IS THE ONLY THING THAT DISTINGUISHES THEM, and the
          # first version of this guard did not use it. It wrote
          #
          #     t="$(probe | wc -l | tr -d ' ')"; [ -z "$t" ] && t="-"
          #
          # and that emptiness test CAN NEVER BE TRUE: a probe that fails
          # prints nothing, `wc -l` counts nothing and prints `0`, and `0` is
          # not empty. So the guard written to stop a failed probe reading as
          # zero reported zero on every failed probe -- a check that cannot
          # fail, guarding against checks that cannot fail. MEASURED run
          # 36114004943: two samples printed `pods 0/0` and NOT ONE ever
          # printed `pods -/-`, on a cluster carrying ~148 pods.
          #
          # awk rather than `wc -l` because command substitution strips the
          # trailing newline, and `wc -l` would undercount the last row by one.
          if [ "$1" -ne 0 ]; then
            echo "-"
            return 0
          fi
          printf '%s
' "$2" | "$AWK" 'NF { n++ } END { print n + 0 }'
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
                  ($app.metadata.annotations["zeta.io/sync-policy-reason"] | dash(400)),
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
          #
          # ORDER, NOT JUST A CAP. The cap of ten stays (every call here delays
          # the verdict JSON, see ROSTER_DEADLINE_SECONDS), but it used to take
          # the FIRST ten alphabetically -- and on run 36221053730 that spent all
          # ten on a-k and left `platform`, the one row carrying a FAILED SYNC,
          # with no diagnostics at all. Rows that are not the capacity signature
          # (`sync=Synced health=Progressing`) go first now: an OutOfSync, Degraded
          # or Missing row is where a defect rather than a small box shows up.
          #
          # `failedTasks` names WHICH resource a failed sync could not apply --
          # "one or more synchronization tasks completed unsuccessfully" on its
          # own names none -- and it costs no extra call: it is in the same JSON.
          # `outOfSyncResources` does the same for an app that reads OutOfSync
          # right after "successfully synced" (agent-memory and gmod on that run):
          # which object keeps drifting is the whole question, and it was never
          # printed.
          "$AWK" -F '\t' '
            $1 == "unconverged" { if ($3 ~ /^sync=Synced health=Progressing/) later[++m] = $2; else print $2 }
            END { for (i = 1; i <= m; i++) print later[i] }
          ' "$1" | ${pkgs.coreutils}/bin/head -n 10 \
          | while IFS= read -r _app; do
              [ -z "$_app" ] && continue
              log "[wp11-k3s-verify] --- unconverged Application diagnostics: ''${_app} ---"
              {
                kc -n argocd get application "$_app" -o json \
                  | "$JQ" -r '{sync: .status.sync.status, health: .status.health, conditions: .status.conditions, operation: .status.operationState.message, failedTasks: ([(.status.operationState.syncResult.resources // [])[] | select(((.status // "") != "Synced") or ((.hookPhase // "") | test("Failed|Error"))) | {kind, namespace, name, status, hookPhase, message}] | .[0:8]), outOfSyncResources: ([(.status.resources // [])[] | select((.status // "") != "Synced") | {kind, namespace, name, status}] | .[0:8])}'
              } 2>&1 | while IFS= read -r _l; do log "[wp11-roster-diag] $_l"; done
            done
          # An `undecidable` row names a pod the scheduler refused, and the
          # refusal's own REASON is on the pod's PodScheduled condition. Without
          # it the row reads as a nodeAffinity question even when it is not: every
          # DaemonSet pod carries required nodeAffinity (the controller pins it to
          # its node with matchFields metadata.name), so `alloy` on run 36221053730
          # was reported as an affinity puzzle while the actual reason -- whatever
          # the scheduler said -- was never printed. At most three extra calls.
          "$AWK" -F '\t' '$1 == "undecidable" && match($3, /place pod [^ ]+/) { print substr($3, RSTART + 10, RLENGTH - 10) }' "$1" \
          | ${pkgs.coreutils}/bin/head -n 3 \
          | while IFS= read -r _pod; do
              [ -z "$_pod" ] && continue
              log "[wp11-roster-diag] scheduler on ''${_pod}: $(kc -n "''${_pod%%/*}" get pod "''${_pod#*/}" -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].message}' 2>&1)"
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
        ROSTER_POD_TOTAL="-"
        ROSTER_POD_RUNNING="-"
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
              # The FIRST time the API stops answering: capture why, once.
              if [ "$PRESSURE_UNREACHABLE_STATE" = "did-not-run" ]; then
                zeta_wp11_pressure_diag "api-unreachable"
                PRESSURE_UNREACHABLE_STATE="$PRESSURE_LAST_STATE"
                PRESSURE_UNREACHABLE_DETAIL="$PRESSURE_LAST_DETAIL"
              fi
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

            # POD COUNTS, PER SAMPLE. 081M3BSXAD6087G0R001XQ0WNY.
            #
            # This is one line of kubectl and its absence cost a real answer.
            # When the first live run (36097310492) showed Applications
            # regressing -- 25/35 Synced+Healthy at t=1214s down to 13/35 at
            # t=3007s -- two mechanisms predicted that fall:
            #
            #   EVICTION       the node is under memory pressure, the kubelet
            #                  evicts BestEffort pods, and Applications that had
            #                  converged lose their workloads. Predicts the POD
            #                  count falling with the Application count.
            #   RENDER FAILURE ArgoCD's repo-server cannot re-render inside its
            #                  timeout, so Applications flip to sync=Unknown
            #                  while their pods KEEP RUNNING. Predicts the pod
            #                  count HOLDING while the Application count falls.
            #
            # They were separated, but only by INFERENCE -- from ArgoCD's health
            # field (47 of 102 unconverged rows read health=Healthy, and the
            # eviction signature `sync=Synced health=Missing` occurred ZERO
            # times) plus a grep for eviction/OOM/memory-pressure that found
            # nothing. That is good evidence and it is not a measurement.
            # Verdict 6 counted pods exactly ONCE, at t=152s, and nothing looked
            # again for the next hour.
            #
            # Two numbers, because they answer different halves: TOTAL pods
            # (eviction takes pods away) and RUNNING pods (a pod can persist in
            # a terminal phase and still be gone as far as a workload is
            # concerned). Failures are non-fatal to the sample and report `-`
            # rather than `0` -- a probe that did not answer must never look
            # like a cluster with no pods, which is the defect this verdict has
            # now been bitten by twice at this very layer.
            #
            # THE SECOND TIME WAS THIS GUARD ITSELF. The first version wrote
            #
            #     ROSTER_POD_TOTAL="$(kc get pods -A --no-headers | $WC -l | $TR -d ' ')"
            #     if [ -z "$ROSTER_POD_TOTAL" ]; then ROSTER_POD_TOTAL="-"; fi
            #
            # and the emptiness test CAN NEVER BE TRUE: a kubectl that fails
            # prints nothing, `wc -l` counts nothing and prints `0`, and `0` is
            # not empty. So the guard against "a failed probe must not read as
            # zero" itself reported zero on a failed probe -- a check that
            # cannot fail, guarding against checks that cannot fail. MEASURED
            # run 36114004943: two samples printed `pods 0/0` and NOT ONE ever
            # printed `pods -/-`, on a cluster carrying ~148 pods.
            #
            # The exit STATUS is the only thing that distinguishes them, so
            # that is what is tested now. `grep -c .` rather than `wc -l`
            # because command substitution strips the trailing newline and
            # `wc -l` would undercount the last row by one.
            _pods_all="$(kc get pods -A --no-headers 2>/dev/null)"; _pods_all_rc=$?
            ROSTER_POD_TOTAL="$(zeta_wp11_count_or_unknown "$_pods_all_rc" "$_pods_all")"
            _pods_run="$(kc get pods -A --no-headers --field-selector=status.phase=Running 2>/dev/null)"; _pods_run_rc=$?
            ROSTER_POD_RUNNING="$(zeta_wp11_count_or_unknown "$_pods_run_rc" "$_pods_run")"
            # A pod listing that did not answer (`pods -/-`) is the API going
            # away too -- run 36364782876 showed it before any roster probe failed.
            if { [ "$_pods_all_rc" -ne 0 ] || [ "$_pods_run_rc" -ne 0 ]; } && [ "$PRESSURE_UNREACHABLE_STATE" = "did-not-run" ]; then
              zeta_wp11_pressure_diag "api-unreachable"
              PRESSURE_UNREACHABLE_STATE="$PRESSURE_LAST_STATE"
              PRESSURE_UNREACHABLE_DETAIL="$PRESSURE_LAST_DETAIL"
            fi

            # Requirement: report progress WHILE waiting. Sixty-seven minutes of
            # silence on a serial log is indistinguishable from a hang.
            log "[wp11-k3s-verify] roster progress t=$(elapsed)s sample=''${ROSTER_SAMPLES}: ''${ROSTER_CONVERGED}/''${ROSTER_APP_COUNT} Synced+Healthy, ''${ROSTER_UNCONVERGED} progressing, ''${ROSTER_EXCLUDED} excluded, ''${ROSTER_UNDECIDABLE} undecidable, ''${ROSTER_UNATTRIBUTED} unattributed pod(s), pods ''${ROSTER_POD_RUNNING}/''${ROSTER_POD_TOTAL} Running/total (zeta-root sync=''${ROOT_SYNC_STATUS})"
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
            # ONE mid-run capture, while the API still answers (see the CLUSTER
            # diagnostics block above for why the end-of-run one is not enough).
            if [ "$CLUSTER_DIAG_MID_DONE" = "false" ] && [ "$(elapsed)" -ge "$CLUSTER_DIAG_MID_AT_SECONDS" ]; then
              CLUSTER_DIAG_MID_DONE=true
              _mid_t0=$(now_ts)
              zeta_wp11_cluster_diag "mid" "$CLASS_FILE" || true
              CLUSTER_DIAG_MID_STATE="$CLUSTER_DIAG_LAST_STATE"
              CLUSTER_DIAG_MID_DETAIL="$CLUSTER_DIAG_LAST_DETAIL"
              # The capture's own wall time comes OUT of the roster budget, not
              # on top of it: the verdict JSON has to land inside the harness's
              # window (see ROSTER_DEADLINE_SECONDS), and a verdict that never
              # arrives is worse than a roster that was polled five minutes less.
              roster_deadline=$(( roster_deadline - ( $(now_ts) - _mid_t0 ) ))
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
        # Verdict 7 FAILED with k3s up: the per-pod, capacity and per-Application
        # capture. It waits (bounded) for the API first -- on run 36832486494 the
        # API was mid-restart when the old capture below fired. Best-effort by
        # construction: it cannot change the verdict.
        if [ "$ROSTER_OK" != "true" ] && [ "$K3S_ACTIVE" = "true" ]; then
          zeta_wp11_cluster_diag "end" "$CLASS_FILE" || true
          CLUSTER_DIAG_END_STATE="$CLUSTER_DIAG_LAST_STATE"
          CLUSTER_DIAG_END_DETAIL="$CLUSTER_DIAG_LAST_DETAIL"
        fi
        if [ "$ROSTER_OK" != "true" ] && [ "$K3S_ACTIVE" = "true" ] && [ "$ROSTER_UNCONVERGED" -gt 0 ]; then
          roster_app_diag "$CLASS_FILE"
        fi

        # What this guest was told NOT to deploy, every boot. An exclusion
        # nobody can see is how a verdict becomes decorative, so a missing state
        # file is its own answer (did-not-run), never "nothing excluded".
        CI_ENVELOPE_STATE=did-not-run
        CI_ENVELOPE_EXCLUDE="-"
        CI_ENVELOPE_DETAIL="no /run/zeta-wp11-ci-envelope/state: zeta-wp11-ci-envelope.service did not run"
        if [ -r /run/zeta-wp11-ci-envelope/state ]; then
          IFS="$(printf '\t')" read -r CI_ENVELOPE_STATE CI_ENVELOPE_EXCLUDE CI_ENVELOPE_DETAIL < /run/zeta-wp11-ci-envelope/state || true
        fi
        log "[wp11-k3s-verify] ci envelope: state=$CI_ENVELOPE_STATE excluded-from-this-guest=$CI_ENVELOPE_EXCLUDE ($CI_ENVELOPE_DETAIL) -- a real install deploys these"

        # Always, at the end: the node's state when the verdict was taken.
        zeta_wp11_pressure_diag "end"
        PRESSURE_END_STATE="$PRESSURE_LAST_STATE"
        PRESSURE_END_DETAIL="$PRESSURE_LAST_DETAIL"
        log "[wp11-k3s-verify] pressure diagnostics: api-unreachable=''${PRESSURE_UNREACHABLE_STATE}''${PRESSURE_UNREACHABLE_DETAIL} end=''${PRESSURE_END_STATE}''${PRESSURE_END_DETAIL}"

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
          --arg rosterPodTotal "$ROSTER_POD_TOTAL" \
          --arg rosterPodRunning "$ROSTER_POD_RUNNING" \
          --arg rootSyncStatus "$ROOT_SYNC_STATUS" \
          --argjson k3sActiveForRoster "$K3S_ACTIVE" \
          --arg pressureOnApiUnreachable "$PRESSURE_UNREACHABLE_STATE" \
          --arg pressureOnApiUnreachableFailed "$PRESSURE_UNREACHABLE_DETAIL" \
          --arg pressureAtEnd "$PRESSURE_END_STATE" \
          --arg pressureAtEndFailed "$PRESSURE_END_DETAIL" \
          --arg clusterDiagMid "$CLUSTER_DIAG_MID_STATE" \
          --arg clusterDiagMidFailed "$CLUSTER_DIAG_MID_DETAIL" \
          --arg clusterDiagEnd "$CLUSTER_DIAG_END_STATE" \
          --arg clusterDiagEndFailed "$CLUSTER_DIAG_END_DETAIL" \
          --arg ciEnvelopeState "$CI_ENVELOPE_STATE" \
          --arg ciEnvelopeExclude "$CI_ENVELOPE_EXCLUDE" \
          --arg ciEnvelopeDetail "$CI_ENVELOPE_DETAIL" \
          '{
            ciEnvelope: {state: $ciEnvelopeState, excludeGlob: $ciEnvelopeExclude, detail: $ciEnvelopeDetail},
            pressureDiagnostics: {
              onApiUnreachable: {state: $pressureOnApiUnreachable, failedSections: $pressureOnApiUnreachableFailed},
              atEnd: {state: $pressureAtEnd, failedSections: $pressureAtEndFailed}
            },
            clusterDiagnostics: {
              mid: {state: $clusterDiagMid, failedSections: $clusterDiagMidFailed},
              atEnd: {state: $clusterDiagEnd, failedSections: $clusterDiagEndFailed}
            },
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
              podTotalAtLastSample: $rosterPodTotal,
              podRunningAtLastSample: $rosterPodRunning,
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
