# full-ai-cluster/nixos/tests/k3s-server-join.nix
#
# TWO CONTROL PLANES, ONE CLUSTER — the boot-path proof for
# `nixos/modules/injected-server-join.nix`.
#
# WHY THIS IS NOT `k3s-agent-join.nix`
# ------------------------------------
# The sibling test boots a SERVER and an AGENT. An agent has no datastore, no
# etcd, and no CA of its own; it presents a token and becomes a kubelet. That
# test proves the agent path and says nothing about the one that actually broke.
#
# The defect `injected-server-join.nix` exists for is a CONTROL PLANE that was
# told to join and founded instead — `clusterInit = mkDefault true` with no
# `serverAddr`, so a machine flashed as a control plane came up with a brand-new
# CA whatever the medium said. Two such machines are sitting on the maintainer's
# LAN with CA founding epochs twelve days apart. `--server` on a role=server node
# is a genuinely different code path from `--server` on a role=agent node: it
# joins an ETCD cluster, not just an API server.
#
# So this test boots TWO role=server nodes and asserts the thing that
# distinguishes the good outcome from the bad one, which is NOT "both nodes are
# up" — both nodes were up on the LAN too, and there were two clusters.
#
# THE ASSERTION THAT MATTERS: ONE CA, NOT TWO
# -------------------------------------------
# Membership can be faked by coincidence; a shared cluster CA cannot. Two nodes
# that founded separately have different `server-ca.crt`; two nodes in one
# cluster have the same bytes. That is precisely the check that identified the
# two LAN machines as two foundings rather than one cluster, and it is the
# check this test makes mechanical. Node count alone would pass on a tree where
# the join silently no-ops and each node reports itself.
#
# HERMETIC SCOPE — MEMBERSHIP, NOT READINESS
# ------------------------------------------
# Same line the two sibling tests draw. No internet in the nix build sandbox,
# so no Cilium image, so neither node reaches `Ready`. We assert MEMBERSHIP and
# CA IDENTITY, never readiness; `k3s-cluster-online.nix` is the lane that owns
# readiness, and conflating them would widen the claim silently.
#
# WHAT THIS TEST CANNOT SEE (stated so nobody reads it as broader than it is)
# --------------------------------------------------------------------------
# `injected-server-join.nix` reads its inputs at NIX EVALUATION time. On
# hardware that evaluation happens ON THE TARGET, inside `zeta-install.sh`'s
# `nixos-install --impure`, against `/etc/zeta/*` symlinks the installer just
# staged. In a nixosTest, evaluation happens on the BUILD MACHINE, where
# `/etc/zeta` does not exist and never will. So this test drives the module
# through its `joinServerUrlFile` / `tokenFile` OPTIONS pointed at the committed
# fixtures — which is exactly why #15668 made them options rather than hardcoded
# paths.
#
# The consequence is honest and worth naming: this test proves the JOIN
# BEHAVIOUR (a role=server node given an endpoint and a token joins an existing
# cluster instead of founding one). It does NOT prove that `/etc/zeta` is
# visible to Nix evaluation during `nixos-install` — that is a property of the
# INSTALLER ENVIRONMENT, it belongs to the installer lanes, and no booted-guest
# test can speak to it. See the "irreducible" doc for where that one lives.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.k3s-server-join -L
#
# Per `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` this
# test asserts and fails; there is no skip path.

{ pkgs }:

let
  # THE EVAL-TIME PATHS MUST CARRY NO STRING CONTEXT. This is the whole trick,
  # and both obvious spellings get it wrong in opposite directions.
  #
  # `injected-server-join.nix` calls `builtins.pathExists` on whatever these
  # options hold. When the argument is a string WITH context, Nix must
  # **realise that context** before it can answer — and `nix flake check
  # --no-build`, the command the `build-iso` lane runs, realises nothing. So a
  # context-carrying path fails there with:
  #
  #     … while realising the context of path '/nix/store/…'
  #     error: path '/nix/store/…' is not valid
  #
  # Measured twice on CI, and the second time is the instructive one:
  #   run 33013286101  `"${./fixtures/…}"`      — interpolation copies the file
  #                    to a fresh store path and attaches context. Red.
  #   run 33014165993  `builtins.toFile "…" "…"` — ALSO attaches context, and is
  #                    red for exactly the same reason. `toFile` genuinely does
  #                    write during evaluation, which is why this looked right;
  #                    the context is the problem, not the writing.
  #
  # Both of those passed on my machine before they failed on CI, because my
  # store already held the objects from earlier evaluations — realising an
  # already-valid path is a no-op. That is a check passing for the wrong
  # reason, and it is why the local reproduction below deletes the paths first.
  #
  # `toString` on a source path yields a plain string with NO context, pointing
  # inside the flake's own source store path — which is valid by construction,
  # since Nix copied the flake there to evaluate it. `pathExists` then just
  # stats a file. This is the spelling `k3s-server-join-eval-test.nix` already
  # uses, and it is correct here for the same reason.
  #
  # The cost of context-free is that nothing depends on these paths, so they do
  # NOT enter the VM closure. That is fine, because neither needs to:

  # Read at EVALUATION time for its CONTENT (the module parses the URL out of
  # it). Never opened at runtime by anything.
  joinServerUrlFile = toString ./fixtures/server-join/cluster-join-server-url;

  # Read at EVALUATION time for its PRESENCE ONLY — `injected-server-join.nix`
  # deliberately never reads a token's contents, because a NixOS module
  # evaluates into the world-readable store. That design choice is exactly what
  # lets this be the committed empty placeholder rather than a credential.
  tokenPresenceMarker = toString ./fixtures/server-join/token-present-marker;

  # The token k3s actually authenticates with is a RUNTIME concern, so it is
  # materialised into each guest at the real production path
  # (`/etc/zeta/k3s-join-token`) via `environment.etc` below, and
  # `services.k3s.tokenFile` is pointed there.
  #
  # This is a TEST-LOCAL substitution and worth naming as one: on hardware the
  # eval-time path and the runtime path are the SAME file, because
  # `zeta-install.sh` runs `nixos-install --impure` on the target where
  # `/etc/zeta` already exists. In a nixosTest, evaluation happens on the build
  # machine where `/etc/zeta` never exists, so the two roles have to be split.
  # What stays under test is the module's DECISION (clusterInit := false,
  # serverAddr := the endpoint); the exact `tokenFile` VALUE it emits is pinned
  # separately by `k3s-server-join-model`, and the assertions below read the
  # running process's cmdline to confirm `--token-file` actually reached k3s.
  #
  # A fixed, public, test-only k3s `--token`, so nothing committed here is a
  # credential. Its whole blast radius is one hermetic QEMU pair in the Nix
  # build sandbox, which has no network and is destroyed with the derivation.
  sharedClusterToken = "zeta-vm-test-shared-cluster-token-not-a-credential\n";

  runtimeTokenPath = "/etc/zeta/k3s-join-token";

  # ETCD MEMBERSHIP PORTS — HARNESS ONLY.
  #
  # `k3s-server.nix` allows 6443/9345/10250 and INTENTIONALLY omits 2379/2380
  # ("embedded etcd binds 127.0.0.1 by default"). A role=server JOIN is etcd
  # membership, not kubelet-only. After #15746 @ c1f0aff9 pinned `--node-ip`
  # to the vlan, etcd advertises distinct peer URLs — and the joiner must then
  # reach founder:2379 (MemberAdd client API) and founder:2380 (peer). The
  # product firewall still rejects that. Measured, run 33035015161 step 13,
  # not inferred:
  #
  #   Adding member joiner-6aba2ae3=https://192.168.1.2:2380
  #          to etcd cluster [founder-dce5ce45=https://192.168.1.1:2380]
  #   refused connection: IN=eth1 SRC=192.168.1.2 DST=192.168.1.1 DPT=2379
  #   Retrying etcd cluster join: MemberAdd request timed out
  #
  # Same shape on 33020639794 after the SLIRP collision, and the reason
  # #15746 @ c1f0aff9 did not green the lane.
  # Agent-join stays green because an agent never joins etcd.
  #
  # Opened here with mkAfter so the shipped module's list stays the source
  # of the API/supervisor/kubelet ports. Do NOT silently add 2379/2380 to
  # the product firewall: that comment refuses a LAN-wide open, and the
  # multi-homed `--node-ip` question stays with injected-cluster-address.nix.
  etcdMembershipPorts = [ 2379 2380 ];
in

pkgs.testers.nixosTest {
  name = "k3s-server-join";

  nodes = {
    # ── THE FOUNDER ────────────────────────────────────────────────────────
    # No join files, so `injected-server-join.nix` sets nothing and
    # `k3s-server.nix`'s `clusterInit = mkDefault true` stands. This is the
    # "endpoint absent -> byte-identical to today's founding behaviour" branch
    # of that module, exercised by being left alone rather than by assertion.
    founder = { lib, nodes, ... }: {
      imports = [ ../modules/k3s-server.nix ];

      services.k3s.manifests = lib.mkForce { };

      # PIN THE NODE IP TO THE TEST VLAN. See the `--node-ip` note on the joiner
      # for the full reason; in short, every nixosTest guest also holds QEMU's
      # SLIRP address `10.0.2.15` on eth0, that interface carries the default
      # route, and k3s therefore advertises its etcd peer there — an address
      # that means "me" on BOTH machines.
      #
      # `extraFlags` is a list option, so a second assignment MERGES with
      # k3s-server.nix rather than replacing it (measured: #15746 @ c1f0aff9
      # — `--cluster-cidr` and `--tls-san` survive). `mkAfter` makes that
      # additive intent explicit.
      services.k3s.extraFlags = lib.mkAfter [
        "--node-ip=${nodes.founder.networking.primaryIPAddress}"
      ];

      # See `etcdMembershipPorts` in the let-block. Founder must accept
      # MemberAdd on :2379 and peer traffic on :2380 from the joiner.
      networking.firewall.allowedTCPPorts = lib.mkAfter etcdMembershipPorts;

      # A PRE-SHARED cluster secret, so the joiner can present a token that is
      # known at evaluation time. This is k3s's documented HA setup (`--token`
      # shared across servers), and it is NOT the token-deadlock this module
      # family was born from: that bug set `tokenFile` to
      # `/var/lib/rancher/k3s/server/token`, the path k3s WRITES, so k3s waited
      # forever to read a file it was itself responsible for creating. This
      # points at a store path that already exists and is non-empty, which k3s
      # reads once at startup.
      # The cluster secret, materialised in the guest at the real production
      # path. `k3s-server.nix` sets no `tokenFile` at all (removing it was the
      # fix for the founding-node token deadlock), so this is a plain addition
      # rather than an override — and it is NOT that deadlock: that bug pointed
      # `tokenFile` at `/var/lib/rancher/k3s/server/token`, the path k3s itself
      # WRITES, so k3s waited forever for a file it was responsible for
      # creating. This points at a file that already exists when the unit
      # starts, which is k3s's documented HA setup (`--token` shared across
      # servers).
      environment.etc."zeta/k3s-join-token".text = sharedClusterToken;
      services.k3s.tokenFile = runtimeTokenPath;

      virtualisation.memorySize = 2560; # MB
      virtualisation.cores = 2;
      virtualisation.diskSize = 6144; # MB
    };

    # ── THE JOINER ─────────────────────────────────────────────────────────
    # role=server (from k3s-server.nix) PLUS an injected endpoint and token, so
    # `injected-server-join.nix` flips clusterInit to false and points
    # serverAddr at the founder. This is the branch that did not exist before
    # #15668 and the reason that PR was written.
    joiner = { lib, nodes, ... }: {
      # `injected-server-join.nix` is imported EXPLICITLY rather than picked up
      # via `common.nix`: it is the module under test, and importing it here
      # keeps this test's subject a single named file instead of whatever the
      # host aggregate happens to pull in.
      imports = [
        ../modules/k3s-server.nix
        ../modules/injected-server-join.nix
      ];

      services.k3s.manifests = lib.mkForce { };

      # PIN THE NODE IP TO THE TEST VLAN — the etcd half of the same defect the
      # `control-plane` alias was the DNS half of, and the reason this test's
      # first green run still ended red.
      #
      # A nixosTest guest has TWO interfaces: eth0 is QEMU's SLIRP NAT, which
      # hands EVERY guest the identical address `10.0.2.15` and carries the
      # default route; eth1 is the test vlan, where the guests are actually
      # distinct (192.168.1.1 / 192.168.1.2) and can actually reach each other.
      # k3s picks its node IP off the default route, so both nodes advertised
      #
      #     etcd peer = https://10.0.2.15:2380
      #
      # and measured it (run 33020639794, step 13):
      #
      #     Adding member joiner-639dff20=https://10.0.2.15:2380
      #            to etcd cluster [founder-e8c381a4=https://10.0.2.15:2380]
      #     ...
      #     etcd cluster join failed: dial tcp 127.0.0.1:2379: connection refused
      #
      # The joiner dialled the founder's advertised peer, arrived at ITSELF, found
      # no etcd serving there yet, and crash-looped until the 420 s timeout. Same
      # shape as the loopback alias: an address that means "me" on every node used
      # as the cluster-wide identity of ONE node.
      #
      # This is a HARNESS artifact and is fixed in the harness. Real hardware has
      # no shared 10.0.2.15 — each machine's default route carries its own LAN
      # address. What real hardware DOES have is more than one NIC, and
      # `k3s-server.nix` pins no `--node-ip`, so a multi-homed control plane can
      # still advertise etcd on an interface its peers do not share. That is a
      # product question about which interface the cluster segment owns, it
      # belongs with `injected-cluster-address.nix`, and it is NOT decided here —
      # naming it rather than quietly fixing it in a test that cannot see it.
      #
      # `k3s-agent-join.nix` is unaffected and always passed: an agent joins the
      # API server by NAME over the vlan and never joins etcd at all.
      #
      # `mkAfter`: list-merge, not replace. See the founder extraFlags note.
      services.k3s.extraFlags = lib.mkAfter [
        "--node-ip=${nodes.joiner.networking.primaryIPAddress}"
      ];

      # Joiner must accept the founder's etcd peer/client replies on the
      # same two ports. Same harness-only mkAfter as the founder.
      networking.firewall.allowedTCPPorts = lib.mkAfter etcdMembershipPorts;

      # Drive the shipped module over committed fixtures. `builtins.pathExists`
      # must be true for BOTH at evaluation time or the module's all-or-none
      # assertion fires — which is itself a property the eval test already pins.
      # Context-free strings (see the `let` block for why that matters).
      zeta.k3sServerJoin.joinServerUrlFile = joinServerUrlFile;
      zeta.k3sServerJoin.tokenFile = tokenPresenceMarker;

      # Same secret as the founder, at the same real path. `mkOverride 10`
      # beats the module's own `mkOverride 50` on this ONE attribute; the two
      # attributes that carry the module's actual decision — `clusterInit` and
      # `serverAddr` — are left exactly as it set them, and the cmdline
      # assertions below check that they reached the process.
      environment.etc."zeta/k3s-join-token".text = sharedClusterToken;
      services.k3s.tokenFile = lib.mkOverride 10 runtimeTokenPath;

      # The fixture endpoint is `https://control-plane:6443` — a NAME, because
      # that is what `--tls-san=control-plane` in k3s-server.nix makes the API
      # certificate valid for. Map it to the founder here, taken from
      # `nodes.founder` rather than hardcoded, so the test stays correct if the
      # driver renumbers the vlan.
      #
      # THIS TEST FOUND A DEFECT HERE ON ITS FIRST CI RUN, and the collision it
      # refused to paper over is what found it. `k3s-server.nix` USED TO set
      # `networking.hosts."127.0.0.1" = [ "control-plane" ]` unconditionally, so
      # on a JOINING control plane both entries landed in /etc/hosts, the
      # loopback one sorted first, glibc answered with it, and the joiner's
      # endpoint pointed at the joiner. Measured: run 33020639794 resolved
      # `control-plane` to `127.0.0.1`, not to the founder.
      #
      # That entry is now conditioned on `services.k3s.serverAddr == ""` — true
      # on a founder, false on anything `injected-server-join.nix` has pointed
      # elsewhere. The mapping below is therefore the ONLY definition of the
      # name on this node, and the assertion downstream stays as the regression
      # guard: restore the unconditional alias and it goes red again.
      networking.hosts = {
        "${nodes.founder.networking.primaryIPAddress}" = [ "control-plane" ];
      };

      # Hold k3s back so the test script performs the hand-off in a controlled
      # order: the founder's API must be up before the joiner dials it. Same
      # TEST-LOCAL sequencing override as k3s-agent-join.nix — the shipped unit
      # starts at boot as normal.
      systemd.services.k3s.wantedBy = lib.mkForce [ ];

      virtualisation.memorySize = 2560; # MB
      virtualisation.cores = 2;
      virtualisation.diskSize = 6144; # MB
    };
  };

  # A FUNCTION of `nodes`, not a bare string, so the founder's driver-assigned
  # address can be interpolated into the assertions instead of hardcoded.
  testScript = { nodes, ... }: ''
    FOUNDER_IP = "${nodes.founder.networking.primaryIPAddress}"
    JOINER_IP = "${nodes.joiner.networking.primaryIPAddress}"

    # Two DISTINCT vlan addresses. #15746 @ c1f0aff9 pinned `--node-ip` to
    # primaryIPAddress; if that were still QEMU SLIRP 10.0.2.15 on both guests,
    # the pin would be a no-op and FOUNDER_IP == JOINER_IP would make the
    # getent assertion vacuous.
    # Measured on run 33035015161: primaryIP IS the vlan (192.168.1.1 / .2)
    # and etcd advertised those URLs. Keep the check so a driver renumber
    # that collapses them cannot look like a passing join.
    assert FOUNDER_IP != JOINER_IP, (
        f"founder and joiner share primaryIP {FOUNDER_IP!r}; --node-ip cannot "
        "distinguish the etcd peers"
    )
    assert FOUNDER_IP != "10.0.2.15" and JOINER_IP != "10.0.2.15", (
        f"primaryIP is still QEMU SLIRP: founder={FOUNDER_IP!r} "
        f"joiner={JOINER_IP!r}"
    )

    start_all()

    # ── The founder must be a working cluster before anyone joins it ───────
    founder.wait_for_unit("k3s.service", timeout=300)
    founder.wait_for_file("/var/lib/rancher/k3s/server/node-token", timeout=180)
    founder.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=240,
    )

    # ── JOINBLOCKER 1: the preflight really is ordered before k3s ──────────
    # Asserted from the RUNNING SYSTEM, not by reading the unit file. The unit
    # file already has a reader (lint-k3s-datastore-preflight.test.ts); what had
    # no check at all was whether systemd HONOURS `before` + `requiredBy` on a
    # real boot. `systemd-analyze` and the monotonic timestamps are the boot's
    # own record of what happened.
    founder.succeed("systemctl is-active zeta-k3s-datastore-preflight.service")

    preflight_done = int(founder.succeed(
        "systemctl show -p ExecMainExitTimestampMonotonic --value "
        "zeta-k3s-datastore-preflight.service"
    ).strip())
    k3s_started = int(founder.succeed(
        "systemctl show -p ExecMainStartTimestampMonotonic --value k3s.service"
    ).strip())

    # Both must be real measurements. A unit that never ran reports 0, and
    # `0 < anything` would make this assertion pass while proving nothing —
    # the vacuity class in timestamp form.
    assert preflight_done > 0, (
        "preflight ExecMainExitTimestampMonotonic is 0: the unit never ran, so "
        "the ordering assertion below would be vacuous"
    )
    assert k3s_started > 0, (
        "k3s ExecMainStartTimestampMonotonic is 0: k3s never started, so there "
        "is nothing to be ordered against"
    )
    assert preflight_done < k3s_started, (
        f"ordering violated: preflight exited at {preflight_done}us but k3s "
        f"started at {k3s_started}us — `before = [k3s.service]` did not hold"
    )

    # The founder is NOT provisioned to join, so the preflight must take its
    # clear-and-do-nothing branch. Asserting the specific marker keeps this
    # from passing on a unit that succeeded for some other reason.
    founder.succeed(
        "journalctl -u zeta-k3s-datastore-preflight.service --no-pager "
        "| grep -q 'clear: no conflicting datastore'"
    )

    # ── ETCD MEMBERSHIP PORTS ARE REACHABLE, NOT MERELY DECLARED ──────────
    # `ss` alone would pass with a closed firewall (listen + REJECT). The
    # joiner probing founder:2379 / :2380 is the check that fails if someone
    # re-closes the harness ports — the exact failure of run 33035015161
    # (`refused connection … DPT=2379` then `MemberAdd request timed out`).
    # A closed product firewall must not be able to look like a passing join.
    founder.succeed("ss -lnt 'sport = :2380' | grep -q LISTEN")
    joiner.succeed(
        f"timeout 5 bash -c 'echo >/dev/tcp/{FOUNDER_IP}/2379'"
    )
    joiner.succeed(
        f"timeout 5 bash -c 'echo >/dev/tcp/{FOUNDER_IP}/2380'"
    )

    # ── JOINBLOCKER 3: the joiner reaches the founder and JOINS ────────────
    # Name resolution first, so a resolution failure reads as one rather than
    # as a mysterious join timeout.
    joiner.succeed("getent hosts control-plane")

    # The endpoint must resolve to the FOUNDER, not to this node. This is the
    # assertion that caught the loopback alias, and it stays as the regression
    # guard for the fix: `k3s-server.nix` now maps control-plane -> 127.0.0.1
    # only when `services.k3s.serverAddr == ""`. Make that unconditional again
    # and this goes red, because the loopback entry sorts ahead of any LAN
    # address and glibc answers with the first match.
    resolved = joiner.succeed(
        "getent hosts control-plane | head -n1 | awk '{print $1}'"
    ).strip()
    assert resolved == FOUNDER_IP, (
        f"the join endpoint resolves to {resolved!r}, not to the founder "
        f"({FOUNDER_IP!r}). On a JOINING control plane the endpoint must point "
        "at the cluster it is joining; pointing it at this node joins nothing "
        "and founds a second cluster. Check that k3s-server.nix still guards "
        "networking.hosts.\"127.0.0.1\" = [ \"control-plane\" ] on "
        "services.k3s.serverAddr == \"\"."
    )

    joiner.systemctl("start k3s.service")
    joiner.wait_for_unit("k3s.service", timeout=420)

    # ── ONE CLUSTER, NOT TWO: the founder's API must see BOTH nodes ────────
    # Asked of the FOUNDER's API on purpose. Asking each node about itself is
    # what two sovereign clusters also answer successfully.
    joiner.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw='/readyz'",
        timeout=300,
    )
    founder.wait_until_succeeds(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes "
        "-o jsonpath='{.items[*].metadata.name}' | grep -q joiner",
        timeout=300,
    )

    node_names = founder.succeed(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes "
        "-o jsonpath='{.items[*].metadata.name}'"
    ).split()
    assert sorted(node_names) == ["founder", "joiner"], (
        f"expected exactly the two nodes in ONE cluster, got {node_names!r}"
    )

    # ── THE DISCRIMINATOR: one cluster CA, not two ─────────────────────────
    # Two nodes that each founded have different CAs and would still both be
    # "up". This is the check that identified the two LAN machines as two
    # foundings, made mechanical.
    founder_ca = founder.succeed(
        "sha256sum /var/lib/rancher/k3s/server/tls/server-ca.crt | cut -d' ' -f1"
    ).strip()
    joiner_ca = joiner.succeed(
        "sha256sum /var/lib/rancher/k3s/server/tls/server-ca.crt | cut -d' ' -f1"
    ).strip()

    assert len(founder_ca) == 64 and len(joiner_ca) == 64, (
        f"CA digests are not sha256 hex: {founder_ca!r} / {joiner_ca!r} — the "
        "comparison below would be comparing two error strings"
    )
    assert founder_ca == joiner_ca, (
        "SPLIT-BRAIN: the two control planes hold DIFFERENT cluster CAs "
        f"({founder_ca} vs {joiner_ca}). The joiner FOUNDED its own cluster "
        "instead of joining — this is the exact defect injected-server-join.nix "
        "was written to prevent, and the signature of the two machines on the "
        "maintainer's LAN."
    )

    # ── The joiner really is a MEMBER of the etcd cluster, not a bystander ──
    # A node can appear in `kubectl get nodes` as an agent. This asserts it is
    # a control-plane member, which is what `--server` on a role=server node is
    # supposed to produce.
    founder.succeed(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get node joiner "
        "-o jsonpath='{.metadata.labels}' "
        "| grep -q 'node-role.kubernetes.io/control-plane'"
    )

    # ── JOINBLOCKER 2 (the half a booted guest CAN see) ────────────────────
    # The install-eval visibility of /etc/zeta is an installer-environment
    # property and is out of scope here (see the header). What IS in scope: the
    # token the joining unit was pointed at must be READABLE by the k3s unit at
    # the moment it starts. A store path is not automatically the same thing as
    # a readable one under a hardened unit.
    # `test -r <store path>` would be very close to vacuous — a store path is
    # readable essentially by construction, so it could not fail for the reason
    # we care about. Assert the FLAGS instead: the eval-time overrides in
    # injected-server-join.nix must have reached the actual k3s invocation, and
    # k3s must have got far enough to authenticate with the token behind
    # `--token-file`. A successful join already implies the token was read; this
    # pins WHICH flags produced it, so a join that happened for some other
    # reason cannot be mistaken for this module working.
    #
    # ── WHY THIS DOES NOT READ /proc/<pid>/cmdline ─────────────────────────
    # K3S ERASES ITS OWN ARGV, and it has done so since v1.19.1+k3s1 (2020).
    # `pkg/cli/server/server.go` opens `run()` with
    #
    #     // hide process arguments from ps output, since they may contain
    #     // database credentials or other secrets.
    #     proctitle.SetProcTitle(os.Args[0] + " server")
    #
    # which reaches `github.com/erikdubbelboer/gspt`, a cgo port of BSD
    # setproctitle: it `memset`s the WHOLE argv region to zero and writes the
    # short title back in place. Blanket, not per-secret — `--node-ip` and
    # `--cluster-cidr` are destroyed alongside `--token-file`. (k3s-io/k3s
    # PR #2072, commit 1eec7348, for issue #2014 "Database password written to
    # process list"; `pkg/cli/agent/agent.go` does the same for agents.)
    #
    # MEASURED, not inferred — run 33040848262 step 13: the joiner's
    # /proc/<MainPID>/cmdline is a 445-byte region whose first 74 bytes are
    # `/nix/store/...-k3s-1.34.5+k3s1/bin/k3s server` and whose remaining 371
    # bytes are NUL. The region keeps the length systemd exec'd it with, so the
    # flags were overwritten AFTER exec rather than never passed; `tr` turned
    # those 371 NULs into 371 spaces and the assertion read a command line with
    # no flags on it at all.
    #
    # That run is the one where the join itself WORKED: `kubectl get nodes` on
    # the founder returned exactly [founder, joiner], the two cluster CAs were
    # IDENTICAL, the joiner carried the control-plane label, and the joiner's
    # own journal recorded it adding itself to an etcd cluster that already
    # held the founder. The assertion nonetheless said "injected-server-join.nix
    # did not take effect". Every other signal in the same run says it did: the
    # ORACLE was wrong, not the module. So the oracle is what changes here and
    # every assertion it carried is kept, unweakened.
    #
    # systemd's record of the argv it exec'd is not scrubbed, and it is still a
    # statement about the RUNNING SYSTEM rather than about a file on disk: it is
    # read out of the unit systemd actually started, and it names the PID it
    # started — bound to the live MainPID below, so a stale or earlier
    # invocation cannot answer for this one. State the honest limit: what /proc
    # could have caught, and this cannot, is a process that re-execs itself with
    # different arguments. k3s does not; if it ever did, this would not see it.
    import re

    def k3s_exec_argv(machine, who):
        # ONE call, so MainPID and the exec record cannot straddle a restart
        # (the unit is Restart=always).
        blob = machine.succeed("systemctl show -p MainPID -p ExecStart k3s.service")

        pid_prop = re.search(r"^MainPID=(\d+)$", blob, re.M)
        assert pid_prop is not None and int(pid_prop.group(1)) > 0, (
            f"{who}: k3s.service reports no running MainPID ({blob!r}); there "
            "is no live process for these flags to be attributed to"
        )
        main_pid = pid_prop.group(1)

        # `systemctl show -p ExecStart` dumps
        #   { path=... ; argv[]=... ; ignore_errors=... ; ... ; pid=N ; ... }
        # Bind the record to the live PID before reading a single flag out of
        # it: unbound, this is the argv of whatever ran last, which is exactly
        # the "looks checked, checks nothing" shape the flags exist to refuse.
        bound = re.search(r"[\s;]pid=(\d+)", blob)
        assert bound is not None and bound.group(1) == main_pid, (
            f"{who}: systemd's ExecStart record does not name the running "
            f"MainPID {main_pid} — got {bound.group(1) if bound else None!r} "
            f"({blob!r})"
        )

        argv_field = re.search(r"argv\[\]=(.*?) ; ", blob)
        assert argv_field is not None, (
            f"{who}: could not parse argv[] out of systemd's ExecStart record "
            f"({blob!r}). Fail closed: asserting flags over a string that may "
            "not contain the argv at all is how a check stops being one."
        )
        argv = argv_field.group(1)
        assert "/bin/k3s " in argv, (
            f"{who}: the parsed argv does not invoke k3s ({argv!r}); every "
            "flag assertion below would be checking the wrong string"
        )
        return argv

    joiner_cmdline = k3s_exec_argv(joiner, "joiner")
    assert "--server" in joiner_cmdline, (
        f"k3s on the joiner has no --server flag: {joiner_cmdline!r}. "
        "injected-server-join.nix did not take effect, so whatever made this "
        "node appear in the cluster was not the module under test."
    )
    assert "--token-file" in joiner_cmdline, (
        f"k3s on the joiner has no --token-file flag: {joiner_cmdline!r}"
    )
    assert "--cluster-init" not in joiner_cmdline, (
        f"the joiner still carries --cluster-init: {joiner_cmdline!r}. "
        "clusterInit was not overridden to false, which is the founding "
        "behaviour this module exists to replace."
    )
    assert f"--node-ip={JOINER_IP}" in joiner_cmdline, (
        f"the joiner lost --node-ip={JOINER_IP}: {joiner_cmdline!r}. "
        "extraFlags must MERGE with k3s-server.nix; a replace would drop "
        "the vlan pin and re-advertise QEMU SLIRP."
    )
    assert "--cluster-cidr=" in joiner_cmdline, (
        f"the joiner lost --cluster-cidr: {joiner_cmdline!r}. "
        "the harness --node-ip assignment replaced k3s-server.nix extraFlags "
        "instead of concatenating"
    )
    assert "--tls-san=control-plane" in joiner_cmdline, (
        f"the joiner lost --tls-san=control-plane: {joiner_cmdline!r}"
    )

    # The founder must still be the founder — the mkOverride only fires on a
    # node with injected files, and asserting the negative keeps this test
    # honest about which node got which branch.
    founder_cmdline = k3s_exec_argv(founder, "founder")
    assert "--cluster-init" in founder_cmdline, (
        f"the founder lost --cluster-init: {founder_cmdline!r}"
    )
    assert "--server" not in founder_cmdline, (
        f"the founder acquired a --server flag: {founder_cmdline!r}"
    )
    assert f"--node-ip={FOUNDER_IP}" in founder_cmdline, (
        f"the founder lost --node-ip={FOUNDER_IP}: {founder_cmdline!r}"
    )
    assert "--cluster-cidr=" in founder_cmdline, (
        f"the founder lost --cluster-cidr: {founder_cmdline!r}. "
        "the harness --node-ip assignment replaced k3s-server.nix extraFlags "
        "instead of concatenating"
    )

    # ── PROVENANCE FROM THE PROCESS ITSELF, which /proc can no longer give ─
    # The flag assertions above read systemd's record of what it exec'd. This
    # reads what k3s DID, out of the joining process's own journal, and it is
    # the one signal in this test that distinguishes "joined an existing etcd
    # cluster" from "founded one" without trusting any flag string:
    #
    #   Adding member joiner-2dc3b09f=https://192.168.1.2:2380
    #          to etcd cluster [founder-851fe68a=https://192.168.1.1:2380]
    #
    # The bracketed list is the membership the joiner found ALREADY THERE. A
    # node that founded its own cluster never emits this line at all — it logs
    # "Starting etcd for new cluster", which is what the founder logs. So the
    # two halves are asserted as a pair, positive and negative, on the two
    # machines: neither alone excludes the split-brain the step is named for.
    #
    # Matched loosely (the words that carry the meaning) rather than on the full
    # sentence, because the member ids are random per boot and the exact
    # phrasing is upstream's to change. If upstream does change it this goes red
    # rather than quietly passing — the right direction to fail.
    #
    # THE NEGATIVE HALF NEEDS THE JOURNAL PROVED READABLE FIRST. "founder never
    # logged joining" and "nothing could read the founder's journal" produce the
    # identical empty result, and only one of them is evidence. So the unit's
    # journal is measured non-trivial on both machines before a single absence
    # is read as meaning anything.
    def k3s_journal(machine, who, pattern):
        lines = int(machine.succeed(
            "journalctl -u k3s.service --no-pager | wc -l"
        ).strip())
        assert lines > 100, (
            f"{who}: journalctl -u k3s.service returned {lines} lines. k3s "
            "logs thousands during bring-up, so this is an unreadable or "
            "empty journal — every absence checked against it would be "
            "vacuous, including the negative half of this discriminator."
        )
        # `|| true` keeps a non-matching grep an empty RESULT rather than a
        # failed command; the line count above is what stops empty from
        # meaning two different things. Greps in the guest so a multi-MB
        # journal never crosses the test driver.
        return machine.succeed(
            f"journalctl -u k3s.service --no-pager | grep -F '{pattern}' || true"
        ).strip()

    joiner_joined = k3s_journal(joiner, "joiner", "to etcd cluster [")
    assert joiner_joined != "", (
        "the joiner never logged adding itself to an EXISTING etcd cluster. A "
        "control plane that joins emits `Adding member <self> to etcd cluster "
        "[<existing members>]`; one that founds does not. Without this line "
        "the node's membership was produced by something other than an etcd "
        "join."
    )
    assert f"https://{FOUNDER_IP}:2380" in joiner_joined, (
        f"the joiner joined an etcd cluster that does not contain the founder "
        f"({FOUNDER_IP}). Joining SOME cluster is not joining THIS one. Got: "
        f"{joiner_joined!r}"
    )

    founder_founded = k3s_journal(founder, "founder", "Starting etcd for new cluster")
    assert founder_founded != "", (
        "the founder did not log founding a new etcd cluster, so the negative "
        "half of this discriminator is vacuous: if neither node founds, the "
        "assertion above cannot be telling founding from joining."
    )
    founder_joined = k3s_journal(founder, "founder", "to etcd cluster [")
    assert founder_joined == "", (
        "the FOUNDER logged joining an existing etcd cluster. The two roles "
        f"are inverted or both nodes joined something else. Got: "
        f"{founder_joined!r}"
    )

    # Post-mortem state into the build log.
    print(founder.succeed(
        "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get nodes -o wide || true"
    ))
    print(joiner.succeed("systemctl --no-pager status k3s.service | head -n 5 || true"))
  '';
}
