# full-ai-cluster/nixos/tests/k3s-cluster-online.nix
#
# ONLINE end-to-end test: boot the real control-plane k3s config in QEMU
# *with internet*, let Cilium actually install, and prove the cluster
# comes ALL THE WAY UP — node `Ready`, Cilium + CoreDNS pods `Running`.
#
# This is the gate that catches the whole bring-up chain — the bugs that
# previously only surfaced on hardware:
#   - k3s --cluster-init token deadlock (#6684)
#   - Cilium HelmChart missing `bootstrap: true` (install pod stuck Pending
#     on the not-ready:NoSchedule taint -> CNI never installs)
#   - control-plane API endpoint unresolvable (`control-plane.zeta.local`)
#     -> now `control-plane` -> 127.0.0.1 via /etc/hosts + --tls-san.
# If any of those regress, the node never reaches Ready and this fails.
#
# REQUIRES INTERNET. nixosTest VMs are sandboxed (no network) by default,
# so this test must be built with the sandbox OFF so the qemu user-mode
# NIC can reach the internet to pull images:
#
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-cluster-online -L --option sandbox false
#
# (`networking.useDHCP = true` below gives the VM a NAT lease.) Run in CI
# on a KVM-capable runner; budget ~10-20 min for the image pulls + Cilium
# bring-up.
#
# SCOPE: this proves the cluster + CNI come up (the "does Kubernetes
# work" floor). It deploys ONLY the Cilium bootstrap manifest, not the
# full Vault/SPIRE/ArgoCD app stack (those are workloads ON a working
# cluster + much heavier/flakier to pull) — that belongs in a separate
# app-reconcile lane.

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-cluster-online";

  nodes.server = { config, pkgs, lib, ... }: {
    imports = [ ../modules/k3s-server.nix ];

    # NAT internet via the qemu user-mode NIC (needs `--option sandbox
    # false` at build time). Cilium + the helm-install image pulls need it.
    networking.useDHCP = lib.mkForce true;

    # Deploy ONLY the Cilium bootstrap manifest — Cilium is the CNI whose
    # absence kept the node NotReady. Drop the heavier app stack
    # (cert-manager/Vault/SPIRE/trust-manager/external-secrets/ArgoCD) so
    # this test is about "cluster + CNI come up", not app reconciliation.
    services.k3s.manifests = lib.mkForce {
      cilium-namespace.source = ../../k8s/bootstrap/cilium-namespace.yaml;
      cilium-install.source = ../../k8s/bootstrap/cilium-install.yaml;
    };

    virtualisation.memorySize = 6144; # Cilium agent+operator+envoy+hubble
    virtualisation.cores = 4;
    virtualisation.diskSize = 12288; # container images
  };

  testScript = ''
    start_all()

    # Control plane up (token-deadlock regression gate).
    server.wait_for_unit("k3s.service", timeout=300)
    server.wait_for_file("/etc/rancher/k3s/k3s.yaml", timeout=180)

    kc = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl"

    # `control-plane` must resolve (to 127.0.0.1 here) — the addressing fix.
    server.succeed("getent hosts control-plane")

    # Cilium must actually INSTALL. With bootstrap:true the helm-install
    # pod tolerates the not-ready taint, schedules, pulls + runs helm.
    # (pre-fix it sat Pending forever). Generous timeout: image pulls.
    server.wait_until_succeeds(
        f"{kc} -n kube-system get pods -l k8s-app=cilium "
        f"--no-headers 2>/dev/null | grep -q ' Running '",
        timeout=1200,
    )

    # THE PROOF: the node reaches Ready (CNI established by Cilium).
    server.wait_until_succeeds(
        f"{kc} wait --for=condition=Ready node --all --timeout=30s",
        timeout=1200,
    )

    # Pods can actually schedule on the CNI: CoreDNS (a k3s built-in
    # Deployment) goes Running. Proves end-to-end pod networking exists.
    server.wait_until_succeeds(
        f"{kc} -n kube-system get pods -l k8s-app=kube-dns "
        f"--no-headers 2>/dev/null | grep -q ' Running '",
        timeout=600,
    )

    # Surface final state into the build log.
    print(server.succeed(f"{kc} get nodes -o wide"))
    print(server.succeed(f"{kc} get pods -A"))
  '';
}
