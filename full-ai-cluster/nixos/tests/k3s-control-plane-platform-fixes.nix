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
#   5. iscsiadm resolvable on the CONTAINER PATH that longhorn-manager's
#      nsenter uses — not merely on a login shell's PATH. Assertion 2 above
#      was green on node-5b2dfa while longhorn-manager crash-looped 16495
#      times over 62 days and every `longhorn` PVC sat Pending; `command -v`
#      resolved via /run/current-system/sw/bin, which Longhorn never sees.
#      (2026-08-16 — see modules/longhorn-prereqs.nix FHS shim.)
#   6. The NODE ITSELF says whether all of the above actually worked:
#      zeta-longhorn-preflight.service (modules/longhorn-node-preflight.nix)
#      runs at boot on every node and refuses on the console when a declared
#      Longhorn filesystem is not mounted, iscsid is not ACTIVE, iscsi_tcp is
#      not loaded, or a shim is missing. Asserting the unit SUCCEEDED here is
#      what makes that guard a thing CI executes, not merely a thing CI reads:
#      nixos/tests/longhorn-node-preflight-eval-test.nix proves it is wired in
#      and non-vacuous, and this lane proves it can go green on a real boot.
#   7. The kernel can create a WIREGUARD device. Cilium is the CNI, and both of
#      its value surfaces (k8s/bootstrap/cilium-install.yaml at first boot,
#      k8s/applications/cilium/Application.yaml at sync-wave -80) set
#      encryption.type=wireguard + nodeEncryption=true. cilium-agent turns that
#      into a netlink LinkAdd and, on EOPNOTSUPP, returns an error from
#      newDaemon rather than degrading to plaintext -- so a kernel that cannot
#      do WireGuard is a node with NO CNI at all. Nothing under nixos/ named
#      WireGuard before 2026-08-21; it worked implicitly, via nixpkgs
#      autoModules (CONFIG_WIREGUARD=m) plus the kernel's rtnl-link auto-load.
#      This lane is where that stops being an assumption.
#      (modules/cilium-wireguard-prereqs.nix)
#   8. That node's OWN WireGuard preflight ran and passed
#      (zeta-cilium-wg-preflight.service) -- the same
#      eval-proves-wiring / boot-proves-green split as 6.
#
# Hermetic: runs in the Nix build sandbox with no internet, so (like
# k3s-cluster-init.nix) we drop the image-pull bootstrap manifests. All eight
# assertion groups are local-only and need no network.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-control-plane-platform-fixes -L

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-control-plane-platform-fixes";

  nodes.server = { config, pkgs, lib, ... }: {
    # The REAL modules that carry the fixes (control-plane uses all three).
    imports = [
      ../modules/k3s-server.nix       # rpfilter off + --disable=local-storage
      ../modules/longhorn-prereqs.nix # open-iscsi + iscsi_tcp + /var/lib/longhorn
      # wireguard kernel module + wg + the boot-time preflight. Imported here
      # rather than inherited, because this test imports the modules DIRECTLY
      # and never goes through common.nix -- so a module wired only into
      # common.nix would be invisible to the one lane that boots a kernel.
      ../modules/cilium-wireguard-prereqs.nix
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
    # `systemctl cat iscsid.service` used to stand here. It proves a unit FILE
    # exists and passes on a dead daemon -- the same shape as assertion 5's
    # `command -v`, and unable to distinguish a working iSCSI stack from the
    # node-5b2dfa one. Longhorn needs the DAEMON, so ask about the daemon.
    server.wait_for_unit("iscsid.service", timeout=120)
    server.succeed("systemctl is-active --quiet iscsid.service")
    server.succeed("test -d /var/lib/longhorn")           # data path exists
    # iscsi_tcp is requested via boot.kernelModules; it must be loadable.
    server.succeed("modinfo iscsi_tcp >/dev/null 2>&1 || lsmod | grep -q iscsi_tcp")

    # ── FIX 5: iscsiadm reachable on LONGHORN'S path, not just a shell ───
    # The `command -v iscsiadm` assertion above is NOT evidence that Longhorn
    # works: it resolves through /run/current-system/sw/bin, which is on a
    # login shell's PATH and on NOTHING else. longhorn-manager nsenters into
    # the host PID-1 namespace and execs iscsiadm with the CONTAINER's PATH,
    # where NixOS provides nothing — so it crash-looped 16495 times over 62
    # days on node-5b2dfa while this test stayed green and every `longhorn`
    # PVC sat Pending ("storageclass longhorn not found").
    #
    # Reproduce Longhorn's exact resolution: empty env, container PATH only.
    # Pre-shim this fails; post-shim it resolves via /usr/local/bin.
    longhorn_path = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    server.succeed("test -x /usr/local/bin/iscsiadm")
    server.succeed(f"env -i PATH={longhorn_path} iscsiadm --version")

    # RWX (NFSv4) volumes cross the same nsenter boundary.
    for helper in ["mount.nfs", "mount.nfs4", "umount.nfs", "umount.nfs4"]:
        server.succeed(f"test -x /usr/local/bin/{helper}")

    # ── FIX 3: exactly the k3s flags that fix the dup default class +CNI ─
    flags = server.succeed("systemctl cat k3s.service")
    assert "--disable=local-storage" in flags, "k3s missing --disable=local-storage"
    assert "--flannel-backend=none" in flags, "k3s missing --flannel-backend=none"
    assert "--disable-kube-proxy" in flags, "k3s missing --disable-kube-proxy"

    # ── FIX 6: the node's OWN preflight ran and passed ───────────────────
    # Diagnostics BEFORE the assertion. A wait_for_unit that times out prints
    # nothing about why, and anything after it is unreachable once it fails --
    # so surface the unit's own journal here, where it stays readable in the
    # build log whichever way this goes.
    print(server.succeed("systemctl status zeta-longhorn-preflight.service --no-pager || true"))
    print(server.succeed(
        "journalctl -u zeta-longhorn-preflight.service --no-pager | tail -n 40 || true"))

    server.wait_for_unit("zeta-longhorn-preflight.service", timeout=180)
    # The unit reaching `active` is the machine-readable verdict; the marker is
    # the operator-readable one, and asserting BOTH is what stops a future
    # edit that keeps the unit green while gutting what it checks.
    server.succeed(
        "journalctl -u zeta-longhorn-preflight.service --no-pager "
        "| grep -q ZETA_LONGHORN_PREFLIGHT_OK")
    server.fail(
        "journalctl -u zeta-longhorn-preflight.service --no-pager "
        "| grep -q ZETA_LONGHORN_PREFLIGHT_FAILED")

    # ── FIX 7: the kernel can make the WireGuard device Cilium demands ──
    # Cilium is the CNI here, and BOTH of its value surfaces
    # (k8s/bootstrap/cilium-install.yaml at first boot, and
    # k8s/applications/cilium/Application.yaml at sync-wave -80) set
    # encryption.type=wireguard + nodeEncryption=true. cilium-agent turns that
    # into a netlink LinkAdd for a WireGuard device and, on EOPNOTSUPP, returns
    # an error from newDaemon rather than degrading to plaintext -- so a kernel
    # that cannot do WireGuard is a node with NO CNI.
    #
    # Before this, nothing under nixos/ named WireGuard: boot.kernelModules had
    # kvm-intel/kvm-amd/iscsi_tcp, boot.extraModulePackages was empty, and
    # wireguard-tools existed only on the installer ISO. It worked anyway,
    # implicitly, via nixpkgs autoModules (CONFIG_WIREGUARD=m) plus the kernel's
    # rtnl-link auto-load. This lane is where that stops being an assumption:
    # it boots the pinned nixos-25.11 kernel and asks.
    server.succeed("test -d /sys/module/wireguard")        # declared, and loaded
    server.succeed("test -x /run/current-system/sw/bin/wg")  # diagnosable on console

    # The exact call cilium-agent makes. `test -d /sys/module` alone would pass
    # on a kernel whose netlink refused the kind; this is the operation itself.
    server.succeed("ip link add dev zeta-wgprobe-ci type wireguard")
    server.succeed("ip link del dev zeta-wgprobe-ci")

    # ── FIX 8: the node's OWN WireGuard preflight ran and passed ─────────
    print(server.succeed("systemctl status zeta-cilium-wg-preflight.service --no-pager || true"))
    print(server.succeed(
        "journalctl -u zeta-cilium-wg-preflight.service --no-pager | tail -n 40 || true"))

    server.wait_for_unit("zeta-cilium-wg-preflight.service", timeout=180)
    # Unit active is the machine-readable verdict; the marker is the
    # operator-readable one. Assert BOTH, so an edit that keeps the unit green
    # while gutting what it checks goes red here.
    server.succeed(
        "journalctl -u zeta-cilium-wg-preflight.service --no-pager "
        "| grep -q ZETA_CILIUM_WG_PREFLIGHT_OK")
    server.fail(
        "journalctl -u zeta-cilium-wg-preflight.service --no-pager "
        "| grep -q ZETA_CILIUM_WG_PREFLIGHT_FAILED")
    # NOT_REQUIRED passing would mean the derivation stopped seeing the demand
    # the manifests still make -- green for the wrong reason.
    server.fail(
        "journalctl -u zeta-cilium-wg-preflight.service --no-pager "
        "| grep -q ZETA_CILIUM_WG_PREFLIGHT_NOT_REQUIRED")

    # Post-mortem surface into the build log.
    print(server.succeed("iptables -t mangle -S | head -n 20 || true"))
    print(server.succeed("systemctl is-enabled iscsid.service || true"))
    print(server.succeed("ls -la /var/lib/longhorn || true"))
  '';
}
