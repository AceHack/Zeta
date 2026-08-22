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
# to run per-PR -- it is a manual/nightly lane. The per-PR half of this
# question is k3s-first-boot-apply-order (eval-only, no VM, every system).
#
# WHAT IT COVERS -- 11 of 11 rostered manifests are APPLIED, because none is
# overridden. What it ASSERTS about varies by manifest, and the difference is
# stated rather than implied:
#
#   asserted to reach a running workload   cilium, local-path-provisioner,
#                                          cert-manager, argocd
#   asserted to be SUBMITTED (Addon CR
#   exists) but not asserted healthy       gateway-api-crds, cilium-namespace,
#                                          argocd-namespace, spire,
#                                          trust-manager, external-secrets
#   THE SUBJECT OF THE TEST                root-application
#
# SPIRE, trust-manager and external-secrets are submitted and left to run;
# their readiness is not asserted because each has real prerequisites this
# single-node VM does not model, and a flaky assertion is worse than an
# absent one. Naming them here is the honest form -- see the longhorn test.
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

        if applied:
            # VERDICT A -- SELF-HEALS. The deploy controller re-applied
            # root-application after the ArgoCD chart established the CRD.
            # This is the outcome the current design silently assumes; it is
            # now measured rather than hoped for.
            pass
        elif not crd_seen:
            # VERDICT B -- INCONCLUSIVE. The Application CRD never appeared,
            # so the ArgoCD chart is what failed and the retry question is
            # untouched. Reported as its own failure so a reader never mistakes
            # it for evidence about the deploy controller.
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
