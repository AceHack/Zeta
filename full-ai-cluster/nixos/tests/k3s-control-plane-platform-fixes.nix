# full-ai-cluster/nixos/tests/k3s-control-plane-platform-fixes.nix
#
# NixOS VM integration test: boot the control-plane node-level modules and
# assert EVERY node fix from the 2026-06-07 platform-bring-up debugging is
# actually live. These are the exact things that broke a fresh install; the
# build SUCCEEDS only if all assertions pass (assert, don't skip — per
# .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md).
#
# Regression surface (each maps to a real failure we root-caused):
#   1. checkReversePath = false  — the iptables `rpfilter` DROP in mangle
#      PREROUTING black-holed all pod->host traffic, killing DNS and every
#      chart. Assert the `nixos-fw-rpfilter` chain is ABSENT.  (PR #6938)
#   2. open-iscsi present + iscsi_tcp + /var/lib/longhorn — without these
#      Longhorn can't attach a single volume; every stateful PVC sits
#      Pending forever. Assert the prereqs exist.                (PR #6966)
#   3. k3s `--disable=local-storage` — k3s' built-in local-path-provisioner
#      AND zeta-local-path were BOTH marked default (invalid, ambiguous
#      binding). Assert the flag is on the k3s command line.     (PR #6966)
#   4. rp_filter sysctl is not strict (1) — the loose value Cilium requires.
#
# Hermetic: runs in the Nix build sandbox with no internet, so (like
# k3s-cluster-init.nix) we drop the image-pull bootstrap manifests. All four
# assertions are local-only and need no network.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-control-plane-platform-fixes -L

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-control-plane-platform-fixes";

  nodes.server = { config, pkgs, lib, ... }: {
    # The REAL modules that carry the fixes (control-plane uses both).
    imports = [
      ../modules/k3s-server.nix       # rpfilter off + --disable=local-storage
      ../modules/longhorn-prereqs.nix # open-iscsi + iscsi_tcp + /var/lib/longhorn
    ];

    # Hermetic sandbox: no internet -> no image pulls. k3s reaching active
    # (and writing its flags + applying the firewall) does not need these.
    services.k3s.manifests = lib.mkForce { };

    # The firewall must be ON for the rpfilter assertion to be meaningful
    # (it is NixOS-default-on; assert explicitly so the test is self-evident).
    networking.firewall.enable = true;

    virtualisation.memorySize = 2560; # MB
    virtualisation.cores = 2;
    virtualisation.diskSize = 6144;   # MB
  };

  testScript = ''
    start_all()

    # ── It boots: k3s reaches a working API ─────────────────────────────
    server.wait_for_unit("k3s.service", timeout=300)
    server.wait_for_file("/etc/rancher/k3s/k3s.yaml", timeout=120)
    server.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=180,
    )

    # ── FIX 1: rpfilter is OFF (the pod->host black-hole) ───────────────
    # checkReversePath=false => NixOS must NOT create the nixos-fw-rpfilter
    # DROP chain in the mangle table. Pre-fix this chain dropped pod->host
    # traffic before conntrack. Assert it is absent.
    server.succeed("nft list ruleset > /tmp/nft.txt 2>/dev/null || true")
    server.succeed("iptables -t mangle -S > /tmp/mangle.txt 2>/dev/null || true")
    server.fail("grep -q 'nixos-fw-rpfilter' /tmp/mangle.txt")
    server.fail("grep -qi 'rpfilter' /tmp/nft.txt")

    # ── FIX 4: rp_filter sysctl is not strict ───────────────────────────
    server.succeed("test \"$(cat /proc/sys/net/ipv4/conf/all/rp_filter)\" != \"1\"")

    # ── FIX 2: open-iscsi prerequisites for Longhorn ────────────────────
    server.succeed("command -v iscsiadm")                 # iscsi userspace
    server.succeed("systemctl cat iscsid.service")        # unit configured
    server.succeed("test -d /var/lib/longhorn")           # data path exists
    # iscsi_tcp is requested via boot.kernelModules; it must be loadable.
    server.succeed("modinfo iscsi_tcp >/dev/null 2>&1 || lsmod | grep -q iscsi_tcp")

    # ── FIX 3: exactly the k3s flags that fix the dup default class +CNI ─
    flags = server.succeed("systemctl cat k3s.service")
    assert "--disable=local-storage" in flags, "k3s missing --disable=local-storage"
    assert "--flannel-backend=none" in flags, "k3s missing --flannel-backend=none"
    assert "--disable-kube-proxy" in flags, "k3s missing --disable-kube-proxy"

    # Post-mortem surface into the build log.
    print(server.succeed("iptables -t mangle -S | head -n 20 || true"))
    print(server.succeed("systemctl is-enabled iscsid.service || true"))
    print(server.succeed("ls -la /var/lib/longhorn || true"))
  '';
}
