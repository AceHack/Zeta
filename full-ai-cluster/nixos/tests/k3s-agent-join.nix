# full-ai-cluster/nixos/tests/k3s-agent-join.nix
#
# TWO-NODE integration test: a k3s AGENT configured by our own
# `nixos/modules/k3s-agent.nix` joins a k3s SERVER configured by our own
# `nixos/modules/k3s-server.nix`, on one shared virtual segment — and
# `nixos/modules/k3s-join-observer.nix` announces it on the serial console
# in the exact strings 081KSNY2Z0008QG0R0008PN7RQ scenario 5 asserts.
#
# WHY THIS EXISTS, AND WHY IT IS NOT THE DOCKER COMPOSE TEST
# ----------------------------------------------------------
# PR #10493 asked whether a two-container Compose test could carry the
# protocol half of scenario 5, and answered "not today" on the premise that
# Zeta owns no join. Aaron's decision — "k3s's join is the join, don't invent
# our own" — removes that premise, so the question had to be re-asked
# honestly: CAN a container test of `k3s agent joins k3s server` fail in a way
# that is OUR fault?
#
# It can — our server flags, our token handling, our TLS SANs, our firewall
# are all ours to get wrong. But a Compose file cannot CONSUME our
# configuration. Our configuration is NixOS module attributes
# (`services.k3s.extraFlags`, `networking.firewall.allowedTCPPorts`,
# `networking.firewall.checkReversePath = false`, `networking.hosts`), and a
# container `command:` would have to TRANSCRIBE them. A transcription can
# drift from its source with nothing failing, so what such a test verifies is
# the transcription — and a check that can pass while the shipped artefact is
# broken is the vacuity class this repository already refuses.
#
# `pkgs.testers.nixosTest` has no such gap: it IMPORTS the module files that
# ship. Delete `--tls-san=control-plane` from `k3s-server.nix` and this test
# goes red on certificate verification. Close 6443 in the server firewall and
# it goes red. Break the observer's marker strings and it goes red. That is
# the property Compose was wanted for, obtained without the drift surface —
# so the container layer is not vacuous in principle, it is DOMINATED here.
#
# HERMETIC SCOPE (deliberate, and the same line the sibling test draws)
# ---------------------------------------------------------------------
# No internet in the nix build sandbox, so no Cilium image, so the joined
# node stays `NotReady`. We assert MEMBERSHIP, never READINESS — see the
# header of `k3s-join-observer.nix` for why conflating the two would silently
# widen the claim. Cluster health is `k3s-cluster-online.nix`'s job.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-agent-join -L
#
# Per `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` the
# test asserts and fails; there is no skip path.

{ pkgs }:

pkgs.testers.nixosTest {
  name = "k3s-agent-join";

  nodes = {
    server = { config, pkgs, lib, ... }: {
      # The REAL control-plane module.
      imports = [ ../modules/k3s-server.nix ];

      # Hermetic: no image-pull bootstrap manifests in the sandbox.
      services.k3s.manifests = lib.mkForce { };

      virtualisation.memorySize = 2560; # MB
      virtualisation.cores = 2;
      virtualisation.diskSize = 6144; # MB
    };

    agent = { config, pkgs, lib, nodes, ... }: {
      # The REAL worker module — which also pulls in k3s-join-observer.nix
      # and enables it, exactly as a shipped worker does.
      imports = [ ../modules/k3s-agent.nix ];

      # `k3s-agent.nix` points at https://control-plane:6443 and
      # `k3s-server.nix` SANs the API certificate for exactly that name. On
      # hardware the mapping comes from an installer-injected /etc/hosts entry
      # (still open — see the MULTI-NODE note in k3s-server.nix); here it is
      # supplied EXPLICITLY rather than pretended solved.
      #
      # It must be declarative: on NixOS /etc/hosts is a symlink into the
      # read-only store, so appending to it at runtime does not work. Taking
      # the address from `nodes.server` rather than hardcoding 192.168.1.x
      # also keeps the test correct if the driver ever renumbers the vlan.
      #
      # The TLS verification this enables is real: remove `--tls-san=control-plane`
      # from k3s-server.nix and the join fails on certificate verification.
      networking.hosts = {
        "${nodes.server.networking.primaryIPAddress}" = [ "control-plane" ];
      };

      # The agent cannot start before the server's token exists, and the
      # token only exists after the server has come up. So hold k3s back and
      # let the test script perform the hand-off in a controlled order —
      # this is a TEST-LOCAL sequencing override, not a change to the
      # shipped unit (which starts at boot as normal).
      systemd.services.k3s.wantedBy = lib.mkForce [ ];

      # Same reason for the witness: it must observe the join we trigger,
      # not race a k3s that has not been started yet.
      systemd.services.zeta-k3s-join-observer.wantedBy = lib.mkForce [ ];

      # Keep the per-attempt deadline well inside the driver's own timeouts
      # so a failure surfaces as an explicit `join-not-observed` line rather
      # than as an opaque driver timeout.
      zeta.k3sJoinObserver.timeoutSec = 240;

      # Same headroom as the server: the agent runs containerd + kubelet, and
      # an OOM here would look like a join failure.
      virtualisation.memorySize = 2560; # MB
      virtualisation.cores = 2;
      virtualisation.diskSize = 6144; # MB
    };
  };

  testScript = ''
    import re

    # Byte-identical to serial-markers.ts B0891_CLUSTER_JOIN_SERIAL_MARKERS
    # and to the literals in modules/k3s-join-observer.nix. If these three
    # ever disagree, this test is the thing that says so.
    MARKER_JOINED = (
        "[081KSNY2Z0008QG0R0008PN7RQ-joining]     cluster join successful"
    )
    MARKER_IN_CLUSTER = (
        "[081KSNY2Z0008QG0R0008PN7RQ-joining]     "
        "joining-node added to the cluster state"
    )

    start_all()

    # ── Server side: API up, cluster token generated ────────────────────
    server.wait_for_unit("k3s.service", timeout=300)
    server.wait_for_file("/var/lib/rancher/k3s/server/node-token", timeout=180)
    server.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=240,
    )

    # ── Name resolution the shipped agent config depends on ─────────────
    # Supplied DECLARATIVELY on the agent node (networking.hosts, from
    # nodes.server.networking.primaryIPAddress) — /etc/hosts on NixOS is a
    # symlink into the read-only store, so a runtime append does not work.
    # Assert it resolved before relying on it, so a name-resolution failure
    # reads as a name-resolution failure and not as a mysterious join timeout.
    agent.succeed("getent hosts control-plane")

    # ── The join hand-off: k3s's own token, nothing invented ────────────
    token = server.succeed("cat /var/lib/rancher/k3s/server/node-token").strip()
    assert token, "server generated no node-token"
    agent.succeed("mkdir -p /var/lib/rancher/k3s/agent")
    agent.succeed(
        f"install -m 0600 /dev/null /var/lib/rancher/k3s/agent/token "
        f"&& printf '%s' '{token}' > /var/lib/rancher/k3s/agent/token"
    )

    agent.systemctl("start k3s.service")
    agent.wait_for_unit("k3s.service", timeout=300)

    # ── The witness, watched on the SAME channel the zflash harness uses ─
    # `--no-block` first so the console watcher cannot miss a line that was
    # already written; the markers are matched as literal text (escaped),
    # so a single changed space fails the test.
    agent.systemctl("start --no-block zeta-k3s-join-observer.service")
    agent.wait_for_console_text(re.escape(MARKER_JOINED))
    agent.wait_for_console_text(re.escape(MARKER_IN_CLUSTER))

    # The unit itself must have SUCCEEDED, not merely printed. A oneshot
    # that emitted a marker and then failed would be a false green.
    agent.wait_for_unit("zeta-k3s-join-observer.service", timeout=300)

    # ── Independent confirmation from the server's own view ─────────────
    # The markers are the agent's claim; this is the server's record. If the
    # observer ever announced a join that did not happen, these two would
    # disagree and this line is what catches it.
    agent_node = agent.succeed(
        "tr '[:upper:]' '[:lower:]' < /proc/sys/kernel/hostname"
    ).strip()
    server.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get node "
        f"{agent_node} -o name",
        timeout=180,
    )

    # Readiness is NOT asserted: no CNI image in the sandbox, so the joined
    # node is legitimately NotReady. Membership is the claim.
    print(server.succeed(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes -o wide || true"
    ))
    print(agent.succeed(
        "journalctl -u zeta-k3s-join-observer.service --no-pager || true"
    ))
  '';
}
