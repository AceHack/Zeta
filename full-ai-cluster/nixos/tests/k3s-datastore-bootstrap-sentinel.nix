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
#   2. A HAS-SERVED DATASTORE SURVIVES A WRONG TOKEN. This target was added
#      to MEASURE a claim the module asserted in prose in five files and had
#      never checked: that k3s's message is "ambiguous by construction", so
#      that the identical text appears when a GOOD datastore meets a WRONG
#      TOKEN. THE MEASUREMENT REFUTED IT, which is the best thing this test
#      has done so far.
#
#      MEASURED, run 36095623765. A real, already-served datastore given a
#      well-formed wrong token does NOT print the stillborn message. Over 151s
#      of polling, every restart printed:
#
#        level=fatal msg="... failed to reconcile with local datastore:
#        bootstrap data already found and encrypted with different token"
#
#      So k3s distinguishes the two cases. The corrected reasoning lives in
#      `../modules/k3s-datastore-bootstrap-recovery.nix`'s header; the short
#      form is that FATAL_SIGNATURE matches only the stillborn message, so the
#      wrong-token case is filtered one step BEFORE the sentinel is consulted,
#      and the sentinel is the second of two independent guards.
#
#      TARGET 2 IS THEREFORE OBSERVED, NOT REQUIRED (target 1 is required),
#      AND THAT IS WHY WE LEARNED THIS. On run 36095623765 it printed
#      "NOT REPRODUCED within 150s on this substrate" -- loudly, on a GREEN
#      run. A required assertion would have gone red and been read as a test
#      bug, which is exactly what happened the first time round (36093540290,
#      where a malformed token died at normalisation instead). An observation
#      that announces its own absence is the opposite of the defect class this
#      whole module was written inside of.
#
#      The datastore-survival assertions are unconditional and bind on every
#      run, on both branches -- they are what the module actually promises,
#      and they do not depend on which fatal appeared.
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
    # NEVER `wait_for_unit` ON EITHER OF THESE TWO UNITS. MEASURED on this
    # test's own first wired run (36089766331): both are `Type=simple` with
    # `Restart=always` / `RestartSec=10s`, so they run for ~80ms, exit 0
    # ("Deactivated successfully" in that run's journal), and start again 10s
    # later. They are INACTIVE for roughly 99% of wall-clock, and
    # `wait_for_unit` waits for ACTIVE -- so against a poll loop it is a coin
    # flip. That run won the flip for the sentinel unit and lost it for the
    # recovery unit, timing out after 121.02s on a node where BOTH were
    # working perfectly. Winning by luck was the worse half of that outcome:
    # a green from this predicate would have meant nothing.
    #
    # Assert the observable EFFECT instead -- the file that got written, the
    # verdict that got printed. That is what the module promises; unit
    # activeness at an arbitrary instant is not.
    machine.wait_until_succeeds(f"test -s {sentinel}", timeout=180)
    machine.succeed(
        "journalctl -u zeta-k3s-datastore-bootstrap-sentinel.service -o cat"
        " | grep -q 'this datastore has now served'"
    )

    # ── The recovery unit is RUNNING and SAYING something on a healthy node.
    #    A unit that decided "nothing to do" must never be indistinguishable
    #    on the console from a unit that never started -- so assert the
    #    steady-state verdict by name, not merely that some verdict appeared.
    #    Run 36089766331 measured this exact line at t=44s on a real boot. ──
    machine.wait_until_succeeds(
        "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
        " | grep -q 'VERDICT served:'",
        timeout=180,
    )
    # And the boot's earlier state, before the sentinel existed, was reported
    # too -- the two are different facts and arrived as different lines
    # (measured at t=34s and t=44s respectively on that same run).
    machine.succeed(
        "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
        " | grep -q 'VERDICT unbootstrapped-watching:'"
    )

    # ── TARGET 2: present a good, already-served datastore with a WRONG
    #    TOKEN, and see what k3s actually says. This was written to measure
    #    the module's claim that k3s emits the IDENTICAL message it emits for
    #    a stillborn datastore. The measurement REFUTED that claim (run
    #    36095623765 -- see this file's header); what is asserted below is
    #    what the module actually promises, which is that the datastore and
    #    its sentinel survive. ───────────────────────────────────────────
    machine.systemctl("stop k3s.service")
    # Prove the fixture is real before trusting the assertion that follows:
    # the datastore must be present and non-trivial going in, or the
    # "it survived" assertion below would pass for the wrong reason.
    machine.succeed(f"test -d {datastore}")
    machine.succeed(f"test \"$(find {datastore} -type f | wc -l)\" -gt 0")
    machine.succeed(f"test -e {sentinel}")

    machine.succeed("cp /var/lib/rancher/k3s/server/token /root/token.good")
    # THE WRONG TOKEN MUST STILL BE A WELL-FORMED ONE. MEASURED, run
    # 36093540290: a hand-written 'K10deadbeef::server:0000...' never reached
    # the datastore comparison at all -- k3s rejected it 25 times at token
    # NORMALISATION, "failed to normalize server token; must be in format
    # K10<CA hash>::<username>:<password>", which is a different fatal with a
    # different cause. The fixture was wrong, not the claim: a malformed
    # token tests k3s's parser, and this test is about its datastore
    # reconcile. So derive the bad token FROM THE REAL ONE, replacing only
    # the password field after the final colon -- the K10<real CA hash> and
    # the username survive, normalisation passes, and the mismatch lands
    # where it is supposed to.
    machine.succeed(
        "sed 's/:[^:]*$/:wrongpasswordwrongpasswordwrong/' /root/token.good"
        " > /var/lib/rancher/k3s/server/token"
    )
    # The recovery unit latches one verdict per boot on /run; clear it so the
    # refusal it is about to reach is printed rather than suppressed as a
    # repeat of the healthy verdict it already emitted above.
    machine.succeed("rm -f /run/zeta-k3s-datastore-bootstrap-recovery.verdict")

    machine.systemctl("start k3s.service")

    # ── TARGET 2 IS OBSERVED, NOT REQUIRED -- same disposition, and for the
    #    same kind of reason, as target 3 in k3s-agent-tls-self-heal.nix.
    #
    #    What this test can GUARANTEE is target 1 above, and that is already
    #    asserted unconditionally. Whether a wrong token reproduces the
    #    *stillborn* fatal specifically is a fact about k3s's internals on
    #    THIS substrate (single-node, embedded etcd, --cluster-init), and run
    #    36093540290 showed it is easy to get a DIFFERENT fatal instead. A
    #    bounded poll decides which happened, and BOTH BRANCHES PRINT, so a
    #    green run's own log says which one it took. An observation that was
    #    skipped must never look identical to one that passed.
    stillborn_fatal_seen = machine.succeed(
        "for i in $(seq 1 30); do "
        "journalctl -u k3s.service -o cat"
        " | grep -q 'no bootstrap data found in datastore'"
        " && { echo yes; exit 0; }; sleep 5; done; echo no"
    ).strip() == "yes"
    print(
        "[k3s-datastore-bootstrap-sentinel] TARGET 2 (does a WRONG TOKEN produce the "
        "STILLBORN fatal?): "
        + (
            "YES on this run -- the two cases are NOT distinguishable by message here, "
            "which CONTRADICTS the measurement of run 36095623765 and means k3s's "
            "behaviour or wording has changed. Read this file's header before trusting "
            "either result: the corrected reasoning assumes these are two distinct "
            "messages. The refusal path below is exercised."
            if stillborn_fatal_seen
            else "NO -- not reproduced within 150s, which MATCHES run 36095623765: a "
            "wrong token reports 'bootstrap data already found and encrypted with "
            "different token' instead, a different message, so it never matches "
            "FATAL_SIGNATURE and is filtered one step before the sentinel is consulted. "
            "The refusal path is not exercised on this run; it is pinned over fixtures "
            "in k3s-datastore-bootstrap-recovery.test.ts. The datastore-survival "
            "assertions below still run and still bind."
        )
    )

    if stillborn_fatal_seen:
        # ── THE ASSERTION THIS TEST EXISTS FOR: the recovery unit saw the
        #    exact fatal it knows how to act on, on a node crash-looped past
        #    its threshold -- and did NOT delete the datastore, because the
        #    sentinel says it has served. ────────────────────────────────
        machine.wait_until_succeeds(
            "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
            " | grep -q 'VERDICT served-refused'",
            timeout=300,
        )
        machine.succeed(
            "journalctl -u zeta-k3s-datastore-bootstrap-recovery.service -o cat"
            " | grep -q 'NOTHING HAS BEEN DELETED'"
        )

    # UNCONDITIONAL, both branches: whatever k3s was failing with, and however
    # many times, the datastore and its sentinel are still here. This is the
    # property the module promises, and it does not depend on which fatal was
    # reproduced.
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
