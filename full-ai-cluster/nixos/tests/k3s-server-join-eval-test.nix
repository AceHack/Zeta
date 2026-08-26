# full-ai-cluster/nixos/tests/k3s-server-join-eval-test.nix
#
# Drives `nixos/modules/injected-server-join.nix` through EVERY branch and pins
# the option values each one produces.
#
# NOT a VM test and NOT a boot test. It proves things about Nix values: that a
# control plane with a join endpoint and a token stops calling `--cluster-init`
# and starts calling `--server`, that one without either is byte-identical to
# today's founding behaviour, that a HALF-provisioned one is refused at
# evaluation rather than booted into a state nobody asked for, and that the
# module contributes nothing on an agent. It cannot say whether k3s actually
# joins — `nixos/tests/k3s-agent-join.nix` is the VM test that watches a real
# handshake, and `k3s-join-observer.nix` is the witness on hardware.
#
# WHY THIS IS THE TEST THAT MATTERS FOR MULTI-NODE. `clusterInit = mkDefault
# true` plus a sibling module that guards itself to agents meant every machine
# built from the `control-plane` config founded its OWN cluster whatever the
# medium said. The signature of that defect is two k3s CAs on one LAN with
# founding epochs twelve days apart, and nothing in the tree could have caught
# it -- because nothing evaluated what `clusterInit` came out as.
#
# HOW IT DRIVES THE MODULE. `lib.evalModules` with a minimal stub of the four
# `services.k3s` options the module touches. Stubbing rather than importing the
# real nixpkgs k3s module is deliberate: it keeps the check free of nixpkgs
# (runs under `nix flake check --no-build` on every system, no VM, no fetch)
# and it exercises the PRIORITY merge that is the actual mechanism --
# `mkOverride 50` beating `k3s-server.nix`'s `mkDefault`. A stub that dropped
# priorities would make every assertion below pass for the wrong reason.
#
# PROVEN CAPABLE OF FAILING: changing `lib.mkOverride 50` to `lib.mkOverride
# 2000` in the module makes `joining-server` report `clusterInit = true`, and
# the first assertion throws naming both values.

{ lib }:

let
  fixtureUrl = toString ../tests/fixtures/server-join/cluster-join-server-url;
  fixtureToken = toString ../tests/fixtures/server-join/token-present-marker;
  absentPath = "/definitely/not/a/path/zeta-eval-test-absent";

  # The four options the module under test writes, declared with the same
  # types and the same `mkDefault` starting points `k3s-server.nix` uses. This
  # is a STUB of nixpkgs' k3s module, and it is honest about being one: it
  # models the option surface, not k3s.
  k3sStub = { lib, ... }: {
    # `assertions` is a NixOS-module-system option, not a k3s one. Declared
    # here with the same shape nixos/modules/misc/assertions.nix uses, because
    # `lib.evalModules` on its own does not carry it — and a module whose
    # assertions land nowhere is a module whose refusals do not exist.
    options.assertions = lib.mkOption {
      type = lib.types.listOf (lib.types.submodule {
        options.assertion = lib.mkOption { type = lib.types.bool; };
        options.message = lib.mkOption { type = lib.types.str; };
      });
      default = [ ];
    };
    options.services.k3s = {
      role = lib.mkOption { type = lib.types.str; default = "server"; };
      clusterInit = lib.mkOption { type = lib.types.bool; default = false; };
      serverAddr = lib.mkOption { type = lib.types.str; default = ""; };
      tokenFile = lib.mkOption { type = lib.types.nullOr lib.types.str; default = null; };
    };
  };

  # What `k3s-server.nix` contributes, reduced to the part that interacts:
  # `clusterInit = lib.mkDefault true`. The module under test must beat it.
  serverDefaults = { lib, ... }: {
    services.k3s.clusterInit = lib.mkDefault true;
  };

  evalWith = { role, urlFile, tokenFile }:
    (lib.evalModules {
      modules = [
        k3sStub
        serverDefaults
        ../modules/injected-server-join.nix
        {
          services.k3s.role = lib.mkForce role;
          zeta.k3sServerJoin.joinServerUrlFile = urlFile;
          zeta.k3sServerJoin.tokenFile = tokenFile;
        }
      ];
      # `config` is threaded by evalModules; nothing else is needed.
    }).config;

  # An assertion in NixOS-module land is a value, not an effect: nothing checks
  # it unless something looks. This is the looking.
  failedAssertions = c: map (a: a.message) (lib.filter (a: !a.assertion) c.assertions);

  expect = label: got: want:
    if got == want then true
    else throw "k3s-server-join eval test: ${label} = ${builtins.toJSON got}, expected ${builtins.toJSON want}";

  # ── scenario 1: nothing injected. Founding, unchanged. ────────────────────
  founding = evalWith { role = "server"; urlFile = absentPath; tokenFile = absentPath; };
  foundingOk =
    expect "founding/clusterInit" founding.services.k3s.clusterInit true
    && expect "founding/serverAddr" founding.services.k3s.serverAddr ""
    && expect "founding/tokenFile" founding.services.k3s.tokenFile null
    && expect "founding/assertions" (failedAssertions founding) [ ];

  # ── scenario 2: endpoint + token. Joining. ───────────────────────────────
  joining = evalWith { role = "server"; urlFile = fixtureUrl; tokenFile = fixtureToken; };
  joiningOk =
    expect "joining/clusterInit" joining.services.k3s.clusterInit false
    && expect "joining/serverAddr" joining.services.k3s.serverAddr "https://control-plane:6443"
    && expect "joining/tokenFile" joining.services.k3s.tokenFile fixtureToken
    && expect "joining/assertions" (failedAssertions joining) [ ];

  # ── scenario 3+4: half-provisioned. Refused, both ways round. ────────────
  urlOnly = evalWith { role = "server"; urlFile = fixtureUrl; tokenFile = absentPath; };
  tokenOnly = evalWith { role = "server"; urlFile = absentPath; tokenFile = fixtureToken; };
  halfOk =
    expect "urlOnly/assertionCount" (builtins.length (failedAssertions urlOnly)) 1
    && expect "tokenOnly/assertionCount" (builtins.length (failedAssertions tokenOnly)) 1
    # The two messages must DIFFER. One message for two different broken states
    # is a diagnosis that cannot distinguish them, which is most of why the
    # original defect went unnoticed for twelve days.
    && expect "half/messagesDiffer" (builtins.head (failedAssertions urlOnly) != builtins.head (failedAssertions tokenOnly)) true
    # ...and neither may have flipped clusterInit. A refused node must not also
    # be half-reconfigured.
    && expect "urlOnly/clusterInit" urlOnly.services.k3s.clusterInit true
    && expect "tokenOnly/clusterInit" tokenOnly.services.k3s.clusterInit true;

  # ── scenario 5: an AGENT. This module contributes nothing. ───────────────
  # `injected-join-server.nix` owns the agent path; two modules writing
  # `serverAddr` for the same node is the double-owner shape this tree has
  # already paid for once (see the Vault note in k3s-server.nix).
  agent = evalWith { role = "agent"; urlFile = fixtureUrl; tokenFile = fixtureToken; };
  agentOk =
    expect "agent/clusterInit" agent.services.k3s.clusterInit true
    && expect "agent/serverAddr" agent.services.k3s.serverAddr ""
    && expect "agent/tokenFile" agent.services.k3s.tokenFile null
    && expect "agent/assertions" (failedAssertions agent) [ ];
in
{
  status =
    if foundingOk && joiningOk && halfOk && agentOk
    then "injected-server-join: 5 scenarios pinned (found / join / url-only refused / token-only refused / agent no-op)"
    else throw "unreachable: every mismatch above throws";
}
