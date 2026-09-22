# full-ai-cluster/nixos/tests/k3s-registry-mirrors-eval-test.nix
#
# Properties of `nixos/modules/k3s-registry-mirrors.nix` — the Docker Hub
# pull-through mirror module (WP9, 081M33STPKN087G0R0004B5CAK).
#
# NOT a VM test and NOT a boot test, like its siblings in this directory
# (`k3s-server-join-eval-test.nix`, `k3s-first-boot-apply-order-eval-test.nix`).
# It proves things about Nix VALUES and file TEXT: that the module renders
# `/etc/rancher/k3s/registries.yaml` with the docker.io mirror present, that
# BOTH `k3s-server.nix` and `k3s-agent.nix` import the module (a mirror only
# the control plane has does not help a worker pull its own images), and that
# neither file sets `--disable-default-registry-endpoint` — the one flag that
# would turn "mirror miss falls through to Docker Hub" into "mirror miss
# fails the pull outright". `flake.nix` forces `status`, which
# `nix flake check --no-build` evaluates on every PR.
#
# CANNOT TELL YOU: whether mirror.gcr.io actually serves these images (that is
# `src/Core.TypeScript/cluster/registry-mirror-coverage.ts`, a report-only
# measurement, not a gate) or whether containerd's real fallback behaviour
# matches the docs.k3s.io citation in the module header (no VM here pulls
# anything). Both are out of scope for a pure-eval check by construction.

{ lib, pkgs }:

let
  modulesDir = ../modules;

  moduleArgs = {
    config = { };
    inherit lib pkgs;
  };

  registryMirrorsModule = import (modulesDir + "/k3s-registry-mirrors.nix") moduleArgs;

  etcEntry = registryMirrorsModule.environment.etc."rancher/k3s/registries.yaml";
  renderedText = etcEntry.text;

  # -- An INDEPENDENT re-render of the expectation, from the same JSON ------
  #
  # Deliberately not a copy-paste of the module's renderRegistry/renderEndpoint
  # -- if it were, a bug shared by both would pass. This walks the same
  # `mirrors` attrset with plain `lib.concatMapStringsSep` instead, so the two
  # implementations only agree if the RENDERED SHAPE actually matches, not
  # because they share code.
  mirrorConfig = builtins.fromJSON (builtins.readFile (../../k8s/registry-mirrors.json));
  mirrors = mirrorConfig.mirrors;
  expectedLines =
    [ "mirrors:" ]
    ++ lib.concatLists (
      lib.mapAttrsToList (
        name: cfg:
        [ "  ${name}:" "    endpoint:" ]
        ++ map (e: "      - \"${e}\"") cfg.endpoint
      ) mirrors
    );
  expectedBody = lib.concatStringsSep "\n" expectedLines + "\n";

  # -- Import + flag-absence checks on the two role modules -----------------
  serverText = builtins.readFile (modulesDir + "/k3s-server.nix");
  agentText = builtins.readFile (modulesDir + "/k3s-agent.nix");

  check = name: cond: { inherit name; ok = cond; };

  results = [
    (check "module declares docker.io as a mirrored registry" (mirrors ? "docker.io"))
    (check "docker.io mirror endpoint list includes mirror.gcr.io" (
      builtins.elem "https://mirror.gcr.io" mirrors."docker.io".endpoint
    ))
    (check "rendered registries.yaml contains the expected mirrors: body" (
      lib.hasInfix expectedBody renderedText
    ))
    (check "rendered registries.yaml is written as .text (eval-time, no build)" (
      !(etcEntry ? source)
    ))
    (check "exactly two assertions guard hand-rendering (bare hostname + https URL)" (
      builtins.length registryMirrorsModule.assertions == 2
    ))
    (check "both of the module's own assertions currently hold" (
      lib.all (a: a.assertion) registryMirrorsModule.assertions
    ))
    (check "k3s-server.nix imports k3s-registry-mirrors.nix" (
      lib.hasInfix "./k3s-registry-mirrors.nix" serverText
    ))
    (check "k3s-agent.nix imports k3s-registry-mirrors.nix" (
      lib.hasInfix "./k3s-registry-mirrors.nix" agentText
    ))
    (check "k3s-server.nix does not disable the default registry endpoint fallback" (
      !(lib.hasInfix "--disable-default-registry-endpoint" serverText)
    ))
    (check "k3s-agent.nix does not disable the default registry endpoint fallback" (
      !(lib.hasInfix "--disable-default-registry-endpoint" agentText)
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures renderedText;

  status =
    if failures == [ ] then
      "k3s registry mirrors: ${toString (builtins.length results)} properties held "
      + "(docker.io -> mirror.gcr.io, imported on server+agent, default endpoint fallback intact)"
    else
      throw "k3s registry mirrors FAILED: ${lib.concatStringsSep "; " (map (r: r.name) failures)}";
}
