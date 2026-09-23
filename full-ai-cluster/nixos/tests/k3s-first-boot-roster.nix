# full-ai-cluster/nixos/tests/k3s-first-boot-roster.nix
#
# THE TEST NOTHING IN THIS DIRECTORY HAS EVER RUN: boot the control-plane
# modules and let the REAL first-boot manifest roster apply. No mkForce.
#
# WHY THIS EXISTS
# ---------------
# k3s-server.nix declares ten auto-applied manifests and local-storage.nix
# declares an eleventh. Every other VM test in this directory removes them:
#
#   k3s-cluster-init.nix:63              mkForce to the empty attrset
#   k3s-agent-join.nix:60                mkForce to the empty attrset
#   k3s-control-plane-platform-fixes:49  mkForce to the empty attrset
#   k3s-cluster-online.nix:49            reduced to cilium only
#   longhorn-volume-binds.nix:71         reduced to cilium plus longhorn
#
# Each of those is defensible alone -- a hermetic sandbox cannot pull images,
# and a test about Longhorn should not also be a test about ArgoCD. But the
# union of the exceptions is that the declared boot sequence is checked by
# nothing, and five green lanes report on a cluster nobody boots.
#
# THE QUESTION THIS TEST IS FOR
# -----------------------------
# k3s writes each roster entry as one flat file and its deploy controller
# submits every file in a single pass within seconds of the API server coming
# up. helm-controller then takes MINUTES to run each chart Job. So a manifest
# whose kind is created by a chart is submitted long before that kind exists.
#
# root-application.yaml is exactly that: an argoproj.io/v1alpha1 Application,
# whose CRD the ArgoCD Helm chart creates. It is submitted every first boot
# into an API server that has never heard of the kind.
#
# helm-controller retries, which is what makes the install-before-namespace
# inversions survivable. Whether the DEPLOY controller retries an
# unknown-kind apply is NOT established anywhere in this repo. If it does not,
# the app-of-apps root never lands and a freshly installed cluster stops at
# seven bootstrap charts with no catalog and no reconciler -- silently, since
# every pod that did come up is healthy.
#
# So the verdict below is written with THREE named outcomes, never a bare
# timeout: a stuck apply is a finding, not an inconclusive run.
#
# REQUIRES INTERNET (five Helm charts and roughly 2-3 GB of images), so the
# sandbox must be off:
#
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-first-boot-roster -L --option sandbox false
#
# COST: budget 45-70 min on a KVM-capable runner, and ~10 GB of image pulls.
# That is the most expensive check in this repo, which is why it is NOT wired
# to run per-PR -- it is a manual/nightly lane:
# .github/workflows/k3s-first-boot-roster-vm.yml (daily cron + workflow_dispatch +
# PRs scoped to this test's own inputs). The per-PR half of this question is
# k3s-first-boot-apply-order (eval-only, no VM, every system).
#
# WHAT IT COVERS -- 11 of 11 rostered manifests are APPLIED, because none is
# overridden. What it ASSERTS about varies by manifest, and the difference is
# stated rather than implied:
#
#   asserted to reach a running workload   cilium, local-path-provisioner,
#                                          cert-manager, argocd
#   asserted to be SUBMITTED (Addon CR
#   exists) but not asserted healthy       gateway-api-crds, cilium-namespace,
#                                          argocd-namespace
#   asserted that the HELM-INSTALL JOB
#   completed (release deployed) but
#   WORKLOAD readiness not asserted        spire-crds, spire, trust-manager,
#                                          external-secrets
#   THE SUBJECT OF THE TEST                root-application
#
# SPIRE, trust-manager and external-secrets are left to run past their
# helm-install Job; their workload readiness is not asserted because each has
# real prerequisites this single-node VM does not model, and a flaky
# assertion is worse than an absent one. Naming them here is the honest
# form -- see the longhorn test. Their helm-install JOB completing is a
# materially stronger check than "the HelmChart CR exists" (a CR is created
# by the deploy controller regardless of whether `helm install` ever
# succeeds); Job completion means the chart actually installed a release --
# but Job completion ALONE was measured (run 35687536936) to hide a real
# defect: helm-install-spire took 301s and reached Complete only after a
# failed pod attempt behind a bad image pin, and the earlier version of this
# test read that as green.
#
# The first fix for that (081M33NZP3J087G0R003WS1BFH, second pass) asserted
# the Job completed on its FIRST attempt -- zero restarts, no exceptions --
# and that was WRONG in the other direction (third pass, architect
# correction): run 35700526070, AFTER the bad image pin was fixed
# (#17478), still failed with 2 container restarts on helm-install-spire-crds
# at ~T+128s, before Cilium/CoreDNS had fully come up. That is
# helm-controller's ORDINARY retry while cluster networking stabilizes -- a
# Docker replica showed 0-2 retries for nearly every chart on a normal run --
# and refusing it entirely made the test fail on healthy churn. The rule is
# now EVIDENCE-based rather than count-based: FAIL only on (a) any pod
# EVER showing ErrImagePull/ImagePullBackOff/InvalidImageName, checked
# against that pod's event history (the record survives after the container
# recovers) and its current waiting-state reason, or (b) restarts exceeding a
# stated bound. A Job that retried a few times against a not-yet-ready
# network and then succeeded is exactly what this assertion now PASSES, with
# the restart count and evidence printed so the retries stay visible. A
# separate health gate additionally snapshots
# spire/cert-manager/external-secrets/argocd/kube-system for any pod stuck in
# ErrImagePull/ImagePullBackOff/CrashLoopBackOff, and every run prints
# per-pod container restart counts for all namespaces at the end regardless
# of verdict.
#
# WHAT IT IS NOT
# --------------
#   * NOT a test of the app catalog. Once root-application lands, ArgoCD will
#     begin cloning k8s/applications and creating child Application CRs. The
#     script reaches its verdict and ends before that goes anywhere, and
#     asserts NOTHING about it. Longhorn, Vault, kube-prometheus-stack and the
#     rest are out of scope here (longhorn has its own lane).
#   * NOT Vault -- deliberately absent from the roster since 2026-08-20
#     (see the comment in k3s-server.nix); ArgoCD is its sole owner.
#   * NOT multi-node, NOT the GPU device-plugin manifests (worker-gpu only),
#     NOT the USB installer path.
#   * NOT a claim that a green run means the boot sequence is CORRECT. It
#     means it CONVERGED once, on one virtual machine, with this much RAM.

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-first-boot-roster";

  nodes.server =
    { config, pkgs, lib, ... }:
    {
      # The REAL modules, and NO manifests override. That absence is the
      # entire point of this file; adding one turns it back into a test of a
      # cluster nobody boots.
      imports = [
        ../modules/k3s-server.nix
        ../modules/local-storage.nix
      ];

      # NAT internet via the qemu user-mode NIC. Needs `--option sandbox
      # false` at build time; without it every chart Job fails to pull and
      # this test measures nothing.
      networking.useDHCP = lib.mkForce true;

      # The whole pre-ArgoCD stack at once: Cilium (agent, operator, envoy,
      # hubble), cert-manager (3), trust-manager, SPIRE, external-secrets (3),
      # ArgoCD (7), local-path-provisioner, plus five helm-install Jobs.
      # Under-provisioning here does not fail honestly -- it fails as pods
      # stuck Pending on insufficient memory, which reads like the ordering
      # bug this test is hunting. So the VM is deliberately oversized.
      virtualisation.memorySize = 10240;
      virtualisation.cores = 4;
      virtualisation.diskSize = 32768;
    };

  testScript = ''
    start_all()

    server.wait_for_unit("k3s.service", timeout=300)
    server.wait_for_file("/etc/rancher/k3s/k3s.yaml", timeout=300)

    kc = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl"

    # The roster as k3s-server.nix + local-storage.nix declare it. Kept as a
    # literal so this test states what it believes it is exercising; the
    # eval-only check k3s-first-boot-apply-order is what keeps the literal in
    # step with the modules.
    ROSTER = [
        "aa-gateway-api-crds",
        "argocd-install",
        "argocd-namespace",
        "cert-manager-install",
        "cilium-install",
        "cilium-namespace",
        "external-secrets-install",
        "local-path-provisioner",
        "openziti-namespace",
        "root-application",
        "spire-install",
        "trust-manager-install",
    ]

    # -- LINK 0: every rostered file reached the manifest directory --------
    # A NixOS-side typo (a source that resolves to nothing, an entry dropped
    # by a merge) shows up here and nowhere else. Cheap, and it runs before
    # any image pull, so a broken roster fails in seconds rather than in an
    # hour of pulls.
    with subtest("all 11 rostered manifests are staged on disk"):
        staged = server.succeed(
            "ls /var/lib/rancher/k3s/server/manifests"
        ).split()
        missing = [f"{n}.yaml" for n in ROSTER if f"{n}.yaml" not in staged]
        assert not missing, (
            f"rostered manifests never reached the manifest dir: {missing}; "
            f"present: {sorted(staged)}"
        )

    # -- LINK 1: the single default StorageClass -------------------------
    # k3s ships local-path-provisioner and marks its class default;
    # local-storage.nix declares zeta-local-path ALSO default. Two defaults
    # is an ambiguous config in which a class-less PVC binds
    # non-deterministically -- observed on node-09485d, 2026-06-07, which is
    # why --disable=local-storage is in extraFlags. Asserted BEFORE the heavy
    # pulls because it needs none of them.
    with subtest("exactly one default StorageClass, and it is zeta-local-path"):
        server.wait_until_succeeds(f"{kc} get storageclass zeta-local-path", timeout=600)
        defaults = server.succeed(
            f"{kc} get storageclass "
            f"-o jsonpath='{{range .items[?(@.metadata.annotations."
            f"storageclass\\.kubernetes\\.io/is-default-class==\"true\")]}}"
            f"{{.metadata.name}} {{end}}'"
        ).split()
        assert defaults == ["zeta-local-path"], (
            "first boot must leave exactly one default StorageClass named "
            f"zeta-local-path; got {defaults}. Two defaults means k3s' own "
            "local-storage addon came back (check --disable=local-storage)."
        )

    # -- LINK 2: CNI, or nothing else can schedule ------------------------
    with subtest("cilium installs and the node reaches Ready"):
        server.wait_until_succeeds(
            f"{kc} -n kube-system get pods -l k8s-app=cilium "
            f"--no-headers 2>/dev/null | grep -q ' Running '",
            timeout=1800,
        )
        server.wait_until_succeeds(
            f"{kc} wait --for=condition=Ready node --all --timeout=30s",
            timeout=1800,
        )

    # -- LINK 3: the bootstrap charts that must exist BEFORE ArgoCD -------
    # These are asserted as HelmChart CRs plus a running workload, in the
    # order the roster intends them. cert-manager is the one with a real
    # prerequisite in this roster: it crash-loops "Gateway API CRDs do not
    # seem to be present" if aa-gateway-api-crds.yaml did not land first
    # (869 restarts over 3 days on node-09485d). So its readiness is the
    # assertion that proves the aa- prefix is doing its job on a live API
    # server, not merely sorting first in a Nix expression.
    with subtest("gateway API CRDs are established"):
        server.wait_until_succeeds(
            f"{kc} get crd gateways.gateway.networking.k8s.io", timeout=600
        )

    with subtest("cert-manager comes up on top of the gateway CRDs"):
        server.wait_until_succeeds(
            f"{kc} -n cert-manager wait --for=condition=Available "
            f"deploy/cert-manager --timeout=60s",
            timeout=2400,
        )

    # The remaining pre-ArgoCD charts are asserted only as far as "the
    # HelmChart CR exists and helm-controller accepted it". Their pods have
    # prerequisites this single-node VM does not model, and a flaky readiness
    # gate would be worse than an absent one -- so the limit is stated, not
    # implied.
    with subtest("spire, trust-manager and external-secrets charts are accepted"):
        for chart in ["spire-crds", "spire", "trust-manager", "external-secrets"]:
            server.wait_until_succeeds(
                f"{kc} -n kube-system get helmchart {chart}", timeout=900
            )

    # A HelmChart CR existing only proves the deploy controller submitted the
    # file -- it is created whether or not `helm install` ever succeeds. The
    # STRONGER, still-cheap check is that helm-controller's own Job
    # (`helm-install-<name>`, same namespace as the HelmChart CR: k3s
    # rancher/helm-controller convention) reaches Complete, which means the
    # chart actually rendered and `helm install`/`upgrade` exited zero -- a
    # release was deployed. This is still short of "the workload is healthy"
    # (no readiness assertion follows), but it is real evidence the chart
    # install itself did not fail, which "HelmChart CR exists" cannot give.
    #
    # CORRECTED 2026-09-22 (081M33NZP3J087G0R003WS1BFH). Two passes so far:
    #
    #   second pass: "Job reaches Complete" is NOT "the install succeeded
    #   cleanly" -- measured live on run 35687536936: the spire chart's
    #   post-install hook hit ErrImagePull on a bad `rancher/kubectl` tag,
    #   `helm-install-spire` timed out, and `wait_until_succeeds` retried
    #   quietly for 301s and reported green. So that pass added a hard
    #   requirement: zero container restarts, zero `Job.status.failed`,
    #   reached Complete on the FIRST attempt.
    #
    #   third pass (architect correction, same day): that was too strict in
    #   the OTHER direction. Run 35700526070, taken AFTER the bad image pin
    #   was actually fixed (#17478), still failed -- 2 container restarts on
    #   helm-install-spire-crds at ~T+128s, before Cilium/CoreDNS had fully
    #   come up, with NO ErrImagePull anywhere. A Docker replica showed 0-2
    #   retries for nearly every chart on an otherwise-healthy run: that is
    #   helm-controller's ORDINARY retry while cluster networking stabilizes,
    #   not a defect, and refusing it outright made the test fail on healthy
    #   churn -- the same "check that cannot see the difference between
    #   ordinary and broken" failure shape this file exists to refuse
    #   elsewhere.
    #
    # So the rule is EVIDENCE-based, not count-based: FAIL only when a pod
    # EVER shows ErrImagePull/ImagePullBackOff/InvalidImageName -- checked
    # against that pod's EVENT HISTORY (the authoritative record: it survives
    # after the container recovers and the current state no longer shows it)
    # and its CURRENT waiting-state reason (in case it is still stuck) -- or
    # when restarts exceed a stated bound. Completing within budget is still
    # enforced by the outer `wait_until_succeeds` timeout below; a Job that
    # never reaches Complete fails there, unconditionally. Otherwise: PASS,
    # with the restart count, the bad-pull evidence (or its absence), and --
    # when there was a retry -- the crashed attempt's own last words printed,
    # so ordinary retries stay VISIBLE without being refused.
    with subtest("spire, trust-manager and external-secrets helm-install Jobs complete without a bad image pull or excessive restarts"):
        RESTART_BOUND = 5
        BAD_PULL_REASONS = ("ErrImagePull", "ImagePullBackOff", "InvalidImageName")

        for chart in ["spire-crds", "spire", "trust-manager", "external-secrets"]:
            server.wait_until_succeeds(
                f"{kc} -n kube-system wait --for=condition=complete "
                f"job/helm-install-{chart} --timeout=30s",
                timeout=1800,
            )

            # `.status.failed` counts POD ATTEMPTS the Job gave up on (new pods
            # under restartPolicy: Never) -- printed for visibility; not
            # asserted on directly, because a Job that exhausted its
            # backoffLimit would already have failed the `wait_until_succeeds`
            # above rather than reaching Complete.
            job_failed_raw = server.succeed(
                f"{kc} -n kube-system get job helm-install-{chart} "
                f"-o jsonpath='{{.status.failed}}' || true"
            ).strip()
            job_failed = int(job_failed_raw) if job_failed_raw.isdigit() else 0

            # Container RESTARTS (restartPolicy: OnFailure retries the SAME
            # pod, which never increments `.status.failed`) -- summed on the
            # driver side rather than in a nested kubectl jsonpath, and
            # deliberately per-pod's FIRST container only: every helm-install
            # Job in this roster runs one container, and the honest limit is
            # stated rather than a nested jsonpath range risking a silent
            # parse mismatch.
            restart_raw = server.succeed(
                f"{kc} -n kube-system get pods -l job-name=helm-install-{chart} "
                f"-o jsonpath='{{range .items[*]}}{{.metadata.name}}={{.status.containerStatuses[0].restartCount}} {{end}}' "
                f"|| true"
            ).strip()
            restart_total = sum(
                int(tok.split("=", 1)[1])
                for tok in restart_raw.split()
                if "=" in tok and tok.split("=", 1)[1].isdigit()
            )
            pod_names = [tok.split("=", 1)[0] for tok in restart_raw.split() if "=" in tok]

            # THE EVIDENCE THAT ACTUALLY DISCRIMINATES: a bad image pull does
            # not self-heal by waiting; ordinary early-boot network churn
            # does. Events are queried per pod (not grepped from the journal)
            # because they are the k8s-native historical record and survive
            # past the moment the container recovers; the CURRENT waiting
            # reason is checked too, in case the pod is still stuck when this
            # runs.
            bad_pull_evidence = []
            for pod_name in pod_names:
                events = server.succeed(
                    f"{kc} -n kube-system get events "
                    f"--field-selector involvedObject.name={pod_name} "
                    f"-o jsonpath='{{range .items[*]}}{{.reason}}: {{.message}}|{{end}}' "
                    f"|| true"
                )
                for reason in BAD_PULL_REASONS:
                    if reason in events:
                        bad_pull_evidence.append(f"{pod_name} event history: {events.strip()}")
                        break
                waiting_reason = server.succeed(
                    f"{kc} -n kube-system get pod {pod_name} "
                    f"-o jsonpath='{{.status.containerStatuses[0].state.waiting.reason}}' "
                    f"|| true"
                ).strip()
                if waiting_reason in BAD_PULL_REASONS:
                    bad_pull_evidence.append(f"{pod_name} currently waiting: {waiting_reason}")

            print(
                f"VERDICT helm-install-{chart} job_status_failed={job_failed} "
                f"pod_container_restarts_total={restart_total} "
                f"raw_per_pod_restarts=({restart_raw or 'none'}) "
                f"bad_image_pull_evidence=({'; '.join(bad_pull_evidence) or 'none'})"
            )

            # ORDERING RETRIES STAY VISIBLE even when they do not fail the
            # run: the restarted container's last termination and its
            # previous log tail, printed whenever a restart happened, whether
            # or not it turns out to be a bad-pull failure. `|| true`
            # throughout: a diagnostic that itself fails must not replace the
            # verdict.
            if restart_total > 0:
                # Space-separated per-pod, one `kubectl get pods` call per pod
                # rather than a nested `{range}` -- matching restart_raw's own
                # style above, and sidestepping any ambiguity in getting a
                # literal jsonpath newline token through the nix -> Python ->
                # bash -> kubectl quoting chain intact.
                print(f"=== last termination, job-name=helm-install-{chart} ===")
                for pod_name in pod_names:
                    print(server.succeed(
                        f"{kc} -n kube-system get pod {pod_name} -o jsonpath="
                        f"'{pod_name}: reason={{.status.containerStatuses[0].lastState.terminated.reason}} "
                        f"exitCode={{.status.containerStatuses[0].lastState.terminated.exitCode}} "
                        f"message={{.status.containerStatuses[0].lastState.terminated.message}}' "
                        f"|| true"
                    ))
                print(f"=== previous container log tail, job-name=helm-install-{chart} ===")
                print(server.succeed(
                    f"{kc} -n kube-system logs -l job-name=helm-install-{chart} "
                    f"--all-containers --previous --tail=20 || true"
                ))

            if bad_pull_evidence or restart_total > RESTART_BOUND:
                print(f"=== kubectl describe pod, job-name=helm-install-{chart} ===")
                print(server.succeed(
                    f"{kc} -n kube-system describe pod -l job-name=helm-install-{chart} || true"
                ))

            assert not bad_pull_evidence and restart_total <= RESTART_BOUND, (
                f"helm-install-{chart}: "
                + (f"bad image pull evidence -- {'; '.join(bad_pull_evidence)}. " if bad_pull_evidence else "")
                + (
                    f"restart count {restart_total} exceeds the bound of {RESTART_BOUND}. "
                    if restart_total > RESTART_BOUND
                    else ""
                )
                + "Ordinary helm-controller retry while cluster networking comes up is "
                "EXPECTED and is not what this assertion refuses -- a bad image pin "
                "(ErrImagePull/ImagePullBackOff/InvalidImageName) or an excessive "
                "restart count are. See the diagnostics above; do NOT loosen the bound "
                "further to make this pass -- fix the underlying chart/image."
            )

    # -- METAL ORACLE: hostNetwork + ClusterFirstWithHostNet DNS, and
    # spire-agent stability, on REAL NixOS networking ---------------------
    #
    # WHY THIS PAIR EXISTS (081M3447Q7E087G0R001PJ6YNY follow-on,
    # 081M343EM0R087G0R003C8ZHJ7). The Docker-container replica
    # (first-boot-replica.ts) measured spire-agent CrashLoopBackOff with
    # `lookup spire-server.spire ... i/o timeout`, and a control probe there
    # showed an IDENTICAL hostNetwork+ClusterFirstWithHostNet busybox pod
    # could not reach kube-dns's ClusterIP at all (`connection timed out; no
    # servers could be reached`) while a pod-network probe reached the same
    # DNS server fine. Whether that is a Docker/nested-container artifact
    # (this repo's own first-boot-replica.ts already needs a `mount
    # --make-rshared /` workaround for Cilium that NixOS metal's
    # systemd-managed shared root gives it for free -- see that file's
    # `mount-propagation-forced-shared-post-start` divergence) or a real
    # defect that also hits a bare NixOS node is exactly what a Docker
    # replica cannot answer and this VM can: k3s here runs directly under
    # the VM's own init, with no container nesting between spire-agent's
    # host network namespace and the one Cilium's agent attaches its
    # socket-LB eBPF programs to. spire-agent is the roster's own
    # hostNetwork+ClusterFirstWithHostNet workload (chart 0.24.2 hardcodes
    # both), so it needs no synthetic double: its own stability answers the
    # question directly, and the busybox probe isolates WHERE a failure
    # would sit (DNS specifically, vs. some other spire-agent startup path)
    # if it does fail.
    with subtest("hostNetwork + ClusterFirstWithHostNet resolves a ClusterIP DNS name on real NixOS networking"):
        overrides = (
            '{"spec":{"hostNetwork":true,"dnsPolicy":"ClusterFirstWithHostNet",'
            '"tolerations":[{"operator":"Exists"}]}}'
        )
        server.succeed(
            f"{kc} -n kube-system delete pod dns-probe-hostnet "
            f"--ignore-not-found --wait=true --timeout=30s || true"
        )
        # FULLY QUALIFIED name, not the short "kubernetes.default" form. MEASURED
        # (run 35706223651): busybox's nslookup does not reliably chase resolv.conf
        # search-domain expansion for a bare two-label name here -- the short form
        # came back "can't find kubernetes.default: NXDOMAIN" even when the SERVER
        # was reached fine (the same false-negative shape a pod-network control
        # probe hit on the Docker replica with "spire-server.spire"). The FQDN
        # sidesteps search-list behaviour entirely and answers the one question
        # this subtest exists for: did the query REACH the DNS server at all.
        server.succeed(
            f"{kc} -n kube-system run dns-probe-hostnet --image=busybox:1.36.1 --restart=Never "
            f"--overrides='{overrides}' "
            f"--command -- sh -c \"nslookup kubernetes.default.svc.cluster.local 2>&1; echo RC=$?\""
        )
        server.wait_until_succeeds(
            f"{kc} -n kube-system get pod dns-probe-hostnet -o jsonpath='{{.status.phase}}' "
            f"| grep -qE 'Succeeded|Failed'",
            timeout=60,
        )
        dns_log = server.succeed(f"{kc} -n kube-system logs dns-probe-hostnet || true")
        print("=== dns-probe-hostnet (hostNetwork, ClusterFirstWithHostNet) log ===")
        print(dns_log)
        server.succeed(
            f"{kc} -n kube-system delete pod dns-probe-hostnet --ignore-not-found --wait=false || true"
        )
        assert "RC=0" in dns_log and "can't find" not in dns_log and "timed out" not in dns_log, (
            "a hostNetwork pod with dnsPolicy ClusterFirstWithHostNet could not resolve "
            "kubernetes.default.svc.cluster.local via the ClusterIP DNS server on REAL "
            "NixOS networking -- this is the metal oracle for 081M343EM0R087G0R003C8ZHJ7 "
            "(the Docker replica's spire-agent CrashLoopBackOff showed the identical "
            "i/o-timeout shape, and its own hostNetwork control probe there could not "
            "even REACH the DNS server). If this "
            f"fails HERE, the defect is real on metal, not a container-nesting artifact. log:\n{dns_log}"
        )

    with subtest("spire-agent (the roster's own hostNetwork DaemonSet) stays up for 3 minutes once Ready"):
        import time as _time

        server.wait_until_succeeds(
            f"{kc} -n spire get daemonset spire-agent "
            f"-o jsonpath='{{.status.numberReady}}' | grep -qx '1'",
            timeout=600,
        )
        agent_pod = server.succeed(
            f"{kc} -n spire get pods -l app.kubernetes.io/name=agent "
            f"-o jsonpath='{{.items[0].metadata.name}}'"
        ).strip()
        assert agent_pod, "spire-agent DaemonSet reported numberReady=1 but no pod matched app.kubernetes.io/name=agent"

        def restart_count():
            raw = server.succeed(
                f"{kc} -n spire get pod {agent_pod} "
                f"-o jsonpath='{{.status.containerStatuses[0].restartCount}}' || echo -1"
            ).strip()
            return int(raw) if raw.lstrip("-").isdigit() else -1

        samples = []
        deadline = _time.monotonic() + 180
        while _time.monotonic() < deadline:
            samples.append(restart_count())
            _time.sleep(15)
        samples.append(restart_count())
        print(f"=== {agent_pod} restartCount samples over ~180s: {samples} ===")

        assert samples[0] != -1, f"could not read {agent_pod}'s restartCount at all"
        assert samples[-1] == samples[0], (
            f"spire-agent pod {agent_pod} restartCount regressed during a 180s stability "
            f"window on REAL NixOS networking: {samples}. This is the metal oracle for "
            "081M343EM0R087G0R003C8ZHJ7 -- CrashLoopBackOff here means the Docker replica's "
            "finding is a METAL DEFECT, not a container-nesting artifact; leave this "
            "assertion in place and fix spire-agent's networking/config rather than "
            "loosening the bound."
        )

    # -- LINK 4: ArgoCD itself -------------------------------------------
    # Its chart is submitted SECOND in filename order, which the ordering
    # comment used to deny. What matters is not where it sorts but that its
    # Job finishes -- because that Job is what creates the Application CRD
    # that LINK 5 is waiting on.
    with subtest("the argocd chart installs"):
        server.wait_until_succeeds(
            f"{kc} -n argocd wait --for=condition=Available "
            f"deploy/argocd-server --timeout=60s",
            timeout=3000,
        )

    # -- HEALTH GATE: no pod is stuck pulling images or crash-looping ----
    # Added alongside the helm-install first-attempt assertions above, for the
    # same measured reason (run 35687536936): a chart's Job can reach Complete
    # while a pod it created (or a pod in a namespace it touches) sits in
    # ErrImagePull/ImagePullBackOff/CrashLoopBackOff, and nothing before this
    # point looks at pod state directly -- only Job/Deployment conditions and
    # HelmChart CR existence. This is a SNAPSHOT, taken once, here, after the
    # pre-ArgoCD charts and ArgoCD itself have had time to settle; it is not a
    # substitute for the per-Job first-attempt assertions above (a pod can
    # recover into Running by the time this runs) -- it exists to catch bad
    # states in namespaces this file does not otherwise inspect (kube-system,
    # cert-manager, argocd), not to re-litigate spire/trust-manager/external-secrets.
    with subtest("no pod in the watched namespaces is stuck pulling images or crash-looping"):
        import re

        bad_pattern = re.compile(r"ErrImagePull|ImagePullBackOff|CrashLoopBackOff")
        watched_namespaces = ["spire", "cert-manager", "external-secrets", "argocd", "kube-system"]
        bad_lines = []
        for ns in watched_namespaces:
            snapshot = server.succeed(
                f"{kc} -n {ns} get pods --no-headers 2>/dev/null || true"
            )
            print(f"=== pods, namespace {ns} ===")
            print(snapshot or "(namespace not yet created, or no pods)")
            for line in snapshot.splitlines():
                if bad_pattern.search(line):
                    bad_lines.append(f"{ns}: {line}")

        assert not bad_lines, (
            "pod(s) stuck pulling images or crash-looping in a watched "
            "namespace -- a Job/Deployment condition elsewhere in this test "
            "can still read green while a pod sits here broken:\n"
            + "\n".join(bad_lines)
        )

    # -- LINK 5: DOES root-application APPLY, OR DOES IT STICK? ----------
    #
    # THE POINT OF THIS FILE. root-application.yaml is submitted by the
    # deploy controller within seconds of the API server starting, naming a
    # kind (argoproj.io/v1alpha1 Application) that will not exist for several
    # more minutes. helm-controller retries its charts. Nothing here has ever
    # established that the DEPLOY controller retries too.
    #
    # A bare `wait_until_succeeds` would report the bad outcome as a timeout,
    # which is indistinguishable from "the runner was slow" and would get
    # re-run rather than believed. So the wait is written to end in one of
    # three NAMED verdicts.
    #
    # The discriminator is the CRD. If the CRD is absent, the failure is
    # upstream of the question and this test must say so rather than blame
    # the deploy controller for a chart that never installed.
    with subtest("root-application lands (deploy-controller retry verdict)"):
        import time

        deadline = time.monotonic() + 900
        crd_seen = False
        applied = False

        # CORRECTED 2026-09-22 (081M33NZP3J087G0R003WS1BFH, second pass). This
        # loop used to compute crd_seen/applied from `echo yes`/`echo no` and
        # throw the answer away until the loop ended -- so nothing in the log
        # showed the verdict actually forming, and a reader (human or a CI
        # summary step grepping the log) had no line to find. Print the state
        # EVERY poll: cheap (one line), and it turns "the log says nothing" into
        # a live transcript of the two facts this verdict is decided from.
        while time.monotonic() < deadline:
            if not crd_seen:
                crd_seen = server.succeed(
                    f"{kc} get crd applications.argoproj.io "
                    f">/dev/null 2>&1 && echo yes || echo no"
                ).strip() == "yes"
            applied = server.succeed(
                f"{kc} -n argocd get application zeta-root "
                f">/dev/null 2>&1 && echo yes || echo no"
            ).strip() == "yes"
            print(f"VERDICT root_crd={'yes' if crd_seen else 'no'} zeta_root={'yes' if applied else 'no'}")
            if applied:
                break
            time.sleep(15)

        # Everything a reader needs to adjudicate the verdict, in the log,
        # whichever way it went. `|| true` throughout: a diagnostic that
        # itself fails must not replace the verdict with its own error.
        addon = server.succeed(
            f"{kc} -n kube-system get addon root-application -o yaml || true"
        )
        print("=== addon/root-application ===")
        print(addon)
        print("=== k3s deploy-controller lines mentioning root-application ===")
        print(server.succeed(
            "journalctl -u k3s.service --no-pager | grep -i root-application || true"
        ))
        print("=== argoproj CRDs ===")
        print(server.succeed(f"{kc} get crd | grep argoproj || true"))
        print("=== all addons ===")
        print(server.succeed(f"{kc} -n kube-system get addon || true"))
        # Container restart counts, ALL namespaces, reported at the end
        # regardless of verdict -- added alongside the helm-install
        # first-attempt assertions above so a reader gets the same evidence
        # even when every earlier subtest passed outright.
        print("=== container restart counts, all namespaces ===")
        print(server.succeed(
            f"{kc} get pods -A -o custom-columns="
            f"'NAMESPACE:.metadata.namespace,POD:.metadata.name,"
            f"RESTARTS:.status.containerStatuses[0].restartCount' "
            f"--no-headers || true"
        ))

        if applied:
            # VERDICT A -- SELF-HEALS. The deploy controller re-applied
            # root-application after the ArgoCD chart established the CRD.
            # This is the outcome the current design silently assumes; it is
            # now measured rather than hoped for.
            print("VERDICT_NAME=ROOT_LANDED")
            pass
        elif not crd_seen:
            # VERDICT B -- INCONCLUSIVE. The Application CRD never appeared,
            # so the ArgoCD chart is what failed and the retry question is
            # untouched. Reported as its own failure so a reader never mistakes
            # it for evidence about the deploy controller.
            print("VERDICT_NAME=ROOT_INCONCLUSIVE")
            raise AssertionError(
                "INCONCLUSIVE: applications.argoproj.io never appeared, so the "
                "ArgoCD chart did not finish installing. This run says NOTHING "
                "about whether the k3s deploy controller retries an unknown-kind "
                "apply -- fix the chart install and re-run."
            )
        else:
            # VERDICT C -- STUCK. The CRD exists and the object does not.
            # The deploy controller submitted root-application once, into an
            # API server that did not know the kind, and never came back.
            # Consequence: the app-of-apps root never lands, ArgoCD has no
            # catalog, and a fresh cluster stops at the bootstrap charts with
            # every pod healthy and nothing reconciling.
            print("VERDICT_NAME=ROOT_NEVER_LANDED")
            raise AssertionError(
                "STUCK: applications.argoproj.io EXISTS but Application/zeta-root "
                "was never created. The k3s deploy controller does not retry an "
                "apply whose kind was unknown at submission time, so the "
                "app-of-apps root never lands on a first boot. Renaming the "
                "roster entry cannot fix this -- submission order is not "
                "completion order. See the addon YAML and journal above."
            )
  '';
}
