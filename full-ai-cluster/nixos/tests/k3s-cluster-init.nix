# full-ai-cluster/nixos/tests/k3s-cluster-init.nix
#
# NixOS VM integration test: the K3S control-plane (`--cluster-init`
# founding node) must boot all the way to a working Kubernetes API.
#
# This is the regression test for the first-boot token deadlock fixed in
# `../modules/k3s-server.nix`: that module used to set
#   tokenFile = "/var/lib/rancher/k3s/server/token"
# alongside `clusterInit = true`, so k3s sat forever
#   "Waiting for /var/lib/rancher/k3s/server/token to be available"
# → "Timeout while trying to read the file" → crash-loop, and the API
# server / kubeconfig never came up. Empirically caught on node-115f93
# first-boot install (2026-06-05).
#
# `pkgs.nixosTest` boots the actual `k3s-server.nix` module in QEMU and
# the build SUCCEEDS only if every assertion in `testScript` passes. The
# single line `server.wait_for_unit("k3s.service")` is the precise inverse
# of the bug — pre-fix it would time out (unit never reaches "active");
# post-fix it reaches active because `--cluster-init` generates the token.
#
# OFFLINE SANDBOX SCOPE
# ---------------------
# nixosTest VMs run inside the Nix build sandbox with no internet, so the
# bootstrap manifests (Cilium / cert-manager / Vault / ArgoCD) cannot pull
# their images. We therefore:
#   - override `services.k3s.manifests = {}` so no image-pull auto-deploy
#     is attempted, and
#   - assert everything the deadlock actually broke, all of which is
#     local-only: k3s.service active, the cluster token GENERATED, the
#     kubeconfig written, the API server healthy (/readyz), and the node
#     object registering with the API.
#
# We deliberately do NOT assert the node reaches `Ready` or that pods are
# `Running` — both require the Cilium CNI image, which needs internet.
# That belongs in an online cluster-integration lane (B-0831 Slice 2+),
# not this hermetic regression test.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-control-plane-cluster-init -L
#
# Per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md:
# the assertions exercise the real failure surface; the test fails (does
# not skip) if k3s does not reach a working API.

{ pkgs }:

# nixpkgs 25.11 removed the top-level `pkgs.nixosTest` alias (throw added
# 2025-10-27); the entry point is `pkgs.testers.nixosTest` — same
# { name; nodes; testScript; } signature.
pkgs.testers.nixosTest {
  name = "k3s-control-plane-cluster-init";

  nodes.server = { config, pkgs, lib, ... }: {
    # Test the REAL control-plane k3s module (the file the fix touched).
    imports = [ ../modules/k3s-server.nix ];

    # Hermetic sandbox: drop the internet-dependent bootstrap manifests so
    # the deploy controller does not thrash trying to pull Cilium/Vault/etc.
    # k3s.service reaching `active` does not depend on these — they apply
    # asynchronously after the API is up — but removing them keeps the test
    # fast and the logs clean.
    services.k3s.manifests = lib.mkForce { };

    # k3s + embedded etcd want headroom; give the VM enough to come up.
    virtualisation.memorySize = 2560; # MB
    virtualisation.cores = 2;
    virtualisation.diskSize = 6144; # MB — data dir + container images
  };

  testScript = ''
    start_all()

    # ── REGRESSION GATE ────────────────────────────────────────────────
    # With the tokenFile↔cluster-init deadlock this unit NEVER reaches
    # "active" (perpetual auto-restart on the token-read timeout). This is
    # the single most important line in the test.
    server.wait_for_unit("k3s.service", timeout=300)

    # ── --cluster-init must GENERATE the cluster token ──────────────────
    # The deadlock was precisely k3s waiting to READ this file instead of
    # writing it. Post-fix, cluster-init generates it at the default path
    # (which is what workers copy into /var/lib/rancher/k3s/agent/token).
    server.wait_for_file("/var/lib/rancher/k3s/server/token", timeout=120)
    server.succeed("test -s /var/lib/rancher/k3s/server/token")
    server.succeed("test -s /var/lib/rancher/k3s/server/node-token")

    # ── API server up + kubeconfig written ──────────────────────────────
    # The buggy node never reached this stage (no /etc/rancher/k3s/k3s.yaml,
    # kubectl fell back to localhost:8080 refused).
    server.wait_for_file("/etc/rancher/k3s/k3s.yaml", timeout=120)
    server.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=180,
    )

    # ── Node object registers with the API ──────────────────────────────
    # (Node stays NotReady offline because Cilium CNI cannot be pulled in
    # the sandbox — that is expected; we assert registration, not Ready.)
    server.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes",
        timeout=120,
    )
    server.succeed(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes "
        "-o jsonpath='{.items[0].metadata.name}' | grep -q server"
    )

    # Surface a bit of state into the build log for post-mortem.
    print(server.succeed("systemctl --no-pager status k3s.service | head -n 5 || true"))
    print(server.succeed(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes -o wide || true"
    ))
  '';
}
