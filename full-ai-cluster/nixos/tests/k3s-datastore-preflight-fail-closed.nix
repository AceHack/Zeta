# full-ai-cluster/nixos/tests/k3s-datastore-preflight-fail-closed.nix
#
# THE DIRTY-DISK REFUSAL, ON A REAL BOOT.
#
# k3s, verbatim from its own documentation:
#
#   "If an etcd datastore is found on disk ... the datastore arguments
#    (--cluster-init, --server, --datastore-endpoint, etc) are IGNORED."
#
# Every option `injected-server-join.nix` sets is a datastore argument. So on a
# node that already holds a datastore, a declarative join is a SILENT NO-OP:
# the unit starts, the flags parse, the disk wins, and the node quietly resumes
# being the cluster it already was, with `systemctl status k3s` green
# throughout. That is the single failure mode in this subsystem that produces
# NO SYMPTOM AT ALL, which is why it is the one most worth pinning.
#
# WHAT WAS ALREADY CHECKED, AND WHAT WAS NOT
# ------------------------------------------
# `src/Core.TypeScript/hygiene/lint-k3s-datastore-preflight.test.ts` executes
# `k3s-datastore-preflight.sh` over fixture directories and asserts every exit
# status, plus the property that it deletes nothing. That is real coverage of
# the REFUSAL LOGIC and this test does not duplicate it.
#
# What that test cannot do — and says so in its own header — is answer whether
# SYSTEMD HONOURS THE WIRING. `before` + `requiredBy` is a claim about a boot,
# not about a script. A unit wired `wantedBy` instead of `requiredBy` would let
# k3s start anyway; the script would still exit 1, every existing assertion
# would still pass, and the node would still silently found a second cluster.
# That is the vacuity class in unit-file form, and only a booted guest can
# refute it.
#
# THE ASSERTION THAT MATTERS: k3s DID NOT START
# ---------------------------------------------
# Not "the preflight failed" — the preflight failing while k3s starts anyway is
# precisely the bug. The load-bearing line is that `k3s.service` never reaches
# active, i.e. the boot FAILED CLOSED.
#
# It also asserts the refusal is LOUD (the marker reached the journal) and that
# NOTHING WAS DELETED. A boot-path `rm -rf` would "fix" this in one line and
# would be confiscation we introduced — irreversible destruction of the one
# thing on the machine that cannot be regenerated (manifesto §5). The canary
# file below is how that promise stops being prose.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-datastore-preflight-fail-closed -L
#
# Per `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` this
# test asserts and fails; there is no skip path.

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-datastore-preflight-fail-closed";

  nodes.node = { lib, ... }: {
    imports = [ ../modules/k3s-server.nix ];

    services.k3s.manifests = lib.mkForce { };

    # ── "PROVISIONED TO JOIN", the RUNTIME way ───────────────────────────
    # The preflight reads this path at RUNTIME (it is a systemd unit), which is
    # why `environment.etc` is sufficient here and no fixture indirection is
    # needed — unlike `injected-server-join.nix`, which reads at EVALUATION
    # time. That difference is deliberate in the module family and this test
    # exercises the runtime half.
    #
    # Note what this means for the node's Nix-level config: because evaluation
    # happens on the build machine where /etc/zeta does not exist,
    # `injected-server-join.nix` does NOT fire and the node is still configured
    # to found. That is exactly the dangerous real-world shape — a disk that
    # holds a cluster, a medium that says "join" — and it is the shape the
    # preflight has to catch.
    environment.etc."zeta/cluster-join-server-url".text =
      "https://control-plane:6443\n";

    # ── THE DIRTY DISK ───────────────────────────────────────────────────
    # Pre-seed the embedded-etcd datastore directory before k3s starts.
    # systemd-tmpfiles runs in sysinit.target, well ahead of both the preflight
    # and k3s, so the datastore is present at the moment the preflight looks.
    #
    # The canary file inside it is the no-deletion probe: it has no meaning to
    # k3s or to the preflight, and its survival is the evidence that the
    # refusal path destroyed nothing.
    systemd.tmpfiles.rules = [
      "d /var/lib/rancher/k3s/server/db/etcd 0700 root root -"
      "f /var/lib/rancher/k3s/server/db/etcd/zeta-no-delete-canary 0600 root root -"
    ];
  };

  testScript = ''
    node.start()

    # Wait for the boot to settle. `wait_for_unit` is NOT usable here: the unit
    # under test is SUPPOSED to fail, and the whole point is that k3s never
    # comes up — so we wait for a target that still completes and then inspect.
    node.wait_for_unit("multi-user.target", timeout=300)

    # ── The precondition really did hold ──────────────────────────────────
    # If the datastore were absent the preflight would take its clear branch
    # and every assertion below would pass while testing nothing.
    node.succeed("test -d /var/lib/rancher/k3s/server/db/etcd")
    node.succeed("test -f /etc/zeta/cluster-join-server-url")

    # ── The preflight RAN and REFUSED ─────────────────────────────────────
    node.fail("systemctl is-active zeta-k3s-datastore-preflight.service")

    result = node.succeed(
        "systemctl show -p Result --value zeta-k3s-datastore-preflight.service"
    ).strip()
    assert result == "exit-code", (
        f"preflight Result is {result!r}, expected 'exit-code'. The unit must "
        "refuse by EXITING NON-ZERO; any other result means it did not reach "
        "its refusal path and this test is measuring something else."
    )

    # ── THE LOAD-BEARING ASSERTION: k3s FAILED CLOSED ─────────────────────
    # `requiredBy = [ "k3s.service" ]` is what makes k3s fail with the
    # preflight. Change it to `wantedBy` and k3s starts anyway — the script
    # still exits 1, the TypeScript test still passes, and the node silently
    # becomes a second cluster. THIS is the line that refutes that mutation.
    node.fail("systemctl is-active k3s.service")

    k3s_started = int(node.succeed(
        "systemctl show -p ExecMainStartTimestampMonotonic --value k3s.service"
    ).strip())
    assert k3s_started == 0, (
        f"k3s.service STARTED (ExecMainStartTimestampMonotonic={k3s_started}) "
        "despite the preflight refusing. The boot did not fail closed: k3s "
        "would now ignore --server/--cluster-init and silently resume the "
        "cluster already on this disk."
    )

    # ── The refusal was LOUD ──────────────────────────────────────────────
    # A silent fail-closed is better than a silent no-op but still leaves an
    # operator guessing. Assert the exact marker an operator would grep for.
    node.succeed(
        "journalctl -u zeta-k3s-datastore-preflight.service --no-pager "
        "| grep -q 'REFUSED: provisioned to JOIN but a k3s datastore already exists'"
    )
    node.succeed(
        "journalctl -u zeta-k3s-datastore-preflight.service --no-pager "
        "| grep -q 'NOTHING HAS BEEN DELETED'"
    )

    # ── NOTHING WAS DELETED (the promise, mechanised) ─────────────────────
    node.succeed("test -f /var/lib/rancher/k3s/server/db/etcd/zeta-no-delete-canary")
    node.succeed("test -d /var/lib/rancher/k3s/server/db/etcd")

    print(node.succeed(
        "journalctl -u zeta-k3s-datastore-preflight.service --no-pager || true"
    ))
  '';
}
