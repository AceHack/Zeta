# full-ai-cluster/nixos/tests/k3s-datastore-bootstrap-sentinel.nix
#
# 081M39CR74D087G0R002BEG2G4. END-TO-END proof, against a REAL k3s, of the
# two things `k3s-datastore-bootstrap-recovery.test.ts` structurally cannot
# reach with fixture directories and fake commands.
#
# WHAT THE FIXTURE TEST ALREADY PROVES, and is not re-proven here: the
# DECISION logic -- which branch is taken for which combination of sentinel,
# restart count and journal signature, that a has-served datastore is never
# removed, and that the three outcomes emit distinct verdict codes. That
# suite injects every external dependency as a command string, so it proves
# the logic and says nothing about the DEFAULTS those strings hold.
#
# WHAT ONLY A BOOTED NODE CAN PROVE, and is this test's whole job:
#
#   1. THE DEFAULT READYZ COMMAND ACTUALLY WORKS. `ZETA_K3S_READYZ_CMD`
#      defaults to `KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get
#      --raw=/readyz`. A fixture test passes `true` or `false` and can never
#      tell you whether that real string succeeds against a real k3s, from
#      inside a systemd unit whose `path` is what the .nix module declares.
#      THIS IS THE CATASTROPHIC FAILURE MODE OF THE WHOLE MODULE: if that
#      command never succeeds -- a typo, k3s missing from the unit's path, a
#      moved kubeconfig -- the sentinel is NEVER written, and then every
#      healthy datastore on every node looks STILLBORN to the recovery
#      script forever. The guard would be inverted into the exact
#      data-destroying behaviour it exists to prevent, and nothing in the
#      fixture suite would go red. So: boot a real server, and assert the
#      sentinel file genuinely appears.
#
#   2. A HAS-SERVED DATASTORE SURVIVES THE REAL AMBIGUOUS FATAL. The module
#      header's whole justification is that k3s's message ("no bootstrap
#      data found in datastore - check server token value and verify
#      datastore integrity") is ambiguous BY CONSTRUCTION: the identical
#      text appears when a GOOD datastore meets a WRONG TOKEN. That claim is
#      asserted in prose everywhere in this module and is nowhere MEASURED.
#      This test measures it -- it produces the fatal the honest way, by
#      presenting a real, already-served cluster with a wrong token, and
#      then asserts the datastore is still there afterwards. Without the
#      sentinel guard, that is a destroyed cluster.
#
# WHY WRONG-TOKEN AND NOT A REAL POWER CUT: the stillborn case needs the
# machine stopped inside a ~20 second window on its first boot, which is a
# race this harness cannot land deterministically. The wrong-token case
# reaches the SAME fatal signature on demand, and it is the more important
# half to pin anyway -- the stillborn path merely deletes a datastore that
# never held anything, while this path is the one where a wrong answer
# costs a real cluster. The stillborn branch's own logic is exercised
# exhaustively over fixtures in the .test.ts.
#
# HERMETIC, same line as the sibling tests: no internet in the nix build
# sandbox, so no CNI and the node never reaches k8s Ready. This test asserts
# k3s.service and its `/readyz` endpoint, which is the exact layer the
# measured defect broke.
#
# networking.enableIPv6 = false, for the reason measured by
# k3s-agent-tls-self-heal.nix (PR run 35972134922): a live
# stop/start of an embedded-etcd server without a full reboot makes etcd's
# persisted member address ambiguous when QEMU's slirp backend advertises
# both address families. This test does the same live restart, so it
# inherits the same fix.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-datastore-bootstrap-sentinel -L

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-datastore-bootstrap-sentinel";

  nodes.machine = { config, pkgs, lib, ... }: {
    # The REAL control-plane module, unmodified -- it is what imports
    # k3s-datastore-bootstrap-recovery.nix, so importing it here is also the
    # proof that the wiring is live rather than merely present in a file.
    imports = [ ../modules/k3s-server.nix ];

    # Hermetic: no image-pull bootstrap manifests in the sandbox.
    services.k3s.manifests = lib.mkForce { };

    networking.enableIPv6 = false;

    # The recovery unit's default restart threshold is 6, and k3s's own
    # RestartSec makes reaching 6 real restarts a multi-minute wait inside an
    # already-budgeted VM test. Lowering the THRESHOLD (a declared knob with
    # a real-world default, not a behaviour change) shortens that wait
    # without weakening what is asserted: the property under test is "a
    # served datastore is not deleted", and a LOWER threshold makes the
    # recovery path EASIER to reach, not harder. The threshold logic itself
    # is pinned over fixtures in the .test.ts.
    systemd.services.zeta-k3s-datastore-bootstrap-recovery.environment.ZETA_RESTART_THRESHOLD = "2";

    virtualisation.memorySize = 2560; # MB
    virtualisation.cores = 2;
    virtualisation.diskSize = 6144; # MB
  };

  testScript = ''
    sentinel = "/var/lib/rancher/k3s/server/db/.zeta-datastore-has-served"
    datastore = "/var/lib/rancher/k3s/server/db"

    start_all()

    # ── First boot: a real k3s, all the way to its own readyz ────────────
    machine.wait_for_unit("k3s.service", timeout=300)
    machine.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=240,
    )

    # ── TARGET 1: the sentinel unit's DEFAULT readyz command actually
    #    works against a real k3s, from inside its real systemd unit.
    #    If this fails, the module is inverted: no sentinel is ever
    #    written and every healthy datastore becomes eligible for
    #    deletion. Nothing in the fixture suite can catch that. ──────────
    machine.wait_for_unit("zeta-k3s-datastore-bootstrap-sentinel.service", timeout=120)
    machine.wait_until_succeeds(f"test -s {sentinel}", timeout=180)
    machine.succeed(
        "journalctl -u zeta-k3s-datastore-bootstrap-sentinel.service -o cat"
        " | grep -q 'this datastore has now served'"
    )

    # ── The recovery unit is alive and SAYING something on a healthy node.
    #    A unit that decided "nothing to do" must never be indistinguishable
    #    on the console from a unit that never started. ──────────────────
    machine.wait_for_unit("zeta-k3s-datastore-bootstrap-recovery.service", timeout=120)
    machine.wait_until_succeeds(
        "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
        " | grep -q 'VERDICT '",
        timeout=180,
    )

    # ── TARGET 2: reproduce the REAL ambiguous fatal, the honest way.
    #    A good, already-served datastore presented with a WRONG TOKEN
    #    makes k3s emit the identical message a stillborn datastore does.
    #    This is the claim the whole module rests on, measured here rather
    #    than asserted in a comment. ─────────────────────────────────────
    machine.systemctl("stop k3s.service")
    # Prove the fixture is real before trusting the assertion that follows:
    # the datastore must be present and non-trivial going in, or the
    # "it survived" assertion below would pass for the wrong reason.
    machine.succeed(f"test -d {datastore}")
    machine.succeed(f"test \"$(find {datastore} -type f | wc -l)\" -gt 0")
    machine.succeed(f"test -e {sentinel}")

    machine.succeed("cp /var/lib/rancher/k3s/server/token /root/token.good")
    machine.succeed(
        "printf '%s\\n' 'K10deadbeef::server:0000000000000000000000000000000000000000000000000000000000000000'"
        " > /var/lib/rancher/k3s/server/token"
    )
    # The recovery unit latches one verdict per boot on /run; clear it so the
    # refusal it is about to reach is printed rather than suppressed as a
    # repeat of the healthy verdict it already emitted above.
    machine.succeed("rm -f /run/zeta-k3s-datastore-bootstrap-recovery.verdict")

    machine.systemctl("start k3s.service")

    # k3s now crash-loops on the ambiguous fatal. Confirm the message we
    # claim is ambiguous is the message k3s actually prints -- if k3s ever
    # changes this text, FATAL_SIGNATURE in the script stops matching and
    # this test is where that is discovered.
    machine.wait_until_succeeds(
        "journalctl -u k3s.service -o cat"
        " | grep -q 'no bootstrap data found in datastore'",
        timeout=300,
    )

    # ── THE ASSERTION THIS TEST EXISTS FOR: the recovery unit saw the exact
    #    fatal it knows how to act on, on a node that has crash-looped past
    #    its threshold -- and did NOT delete the datastore, because the
    #    sentinel says it has served. ────────────────────────────────────
    machine.wait_until_succeeds(
        "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
        " | grep -q 'VERDICT served-refused'",
        timeout=300,
    )
    machine.succeed(
        "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
        " | grep -q 'NOTHING HAS BEEN DELETED'"
    )
    machine.succeed(f"test -d {datastore}")
    machine.succeed(f"test \"$(find {datastore} -type f | wc -l)\" -gt 0")
    machine.succeed(f"test -e {sentinel}")

    # ── And the cluster is recoverable by the remedy the refusal PRINTS:
    #    restore the token, restart, and the same datastore serves again.
    #    This is what makes the refusal a correct answer rather than merely
    #    a cautious one -- the data was still there to come back to. ─────
    machine.systemctl("stop k3s.service")
    machine.succeed("cp /root/token.good /var/lib/rancher/k3s/server/token")
    machine.systemctl("start k3s.service")
    machine.wait_for_unit("k3s.service", timeout=300)
    machine.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=300,
    )
  '';
}
