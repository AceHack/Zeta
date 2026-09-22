# full-ai-cluster/nixos/modules/k3s-registry-mirrors.nix
#
# A DOCKER HUB PULL-THROUGH MIRROR FOR K3S'S EMBEDDED CONTAINERD — WP9
# (081M33STPKN087G0R0004B5CAK).
#
# -- THE FAILURE THIS EXISTS FOR --------------------------------------------
# First boot pulls ~137 distinct images across the bootstrap roster
# (k3s-server.nix `manifests`) + the ArgoCD Application catalog it hands off
# to. 50 of them resolve to `registry-1.docker.io` (measured by
# `src/Core.TypeScript/cluster/image-resolvability.ts` against
# `k8s/image-resolvability.json`, 2026-09-22 — the PR that added that tool,
# #17475, cited 51; the count moves by one image as the catalog does, and
# either number is well past the limit below).
#
# Docker Hub caps ANONYMOUS pulls at 100 per 6 hours per source IP
# (https://docs.docker.com/docker-hub/usage/pulls/, "Pull rate limits").
# One node pulling 50+ distinct docker.io images, PLUS every retry
# ImagePullBackOff generates, PLUS a second node behind the SAME home NAT,
# PLUS the manifest HEAD requests helm/containerd issue while resolving tags,
# can clear that ceiling on the very first boot — with no operator watching a
# CI log to notice, no rollback, and (today) nothing in this tree that even
# names the risk. The failure mode is `ImagePullBackOff` for hours on a box
# nobody is SSH'd into.
#
# -- WHY mirror.gcr.io ------------------------------------------------------
# Google's Artifact Registry ships a public, authentication-free pull-through
# cache for Docker Hub at `mirror.gcr.io`
# (https://docs.cloud.google.com/artifact-registry/docs/pull-cached-dockerhub-images):
# "mirror.gcr.io is a pull-through cache... pulling cached images does not
# count against Docker Hub rate limits." It caches only images that are
# ALREADY commonly requested — a cold, obscure tag can still miss and fall
# through to the real registry. That is fine (see the fallback section below)
# and is exactly why `registry-mirror-coverage.ts` measures hit/miss rather
# than assuming 100%.
#
# -- THE ONE-SOURCE DISCIPLINE ----------------------------------------------
# `k8s/registry-mirrors.json` is the only place the mirror list is written.
# This file reads it with `builtins.fromJSON` (the same pattern
# `cluster-network.nix` uses for `cluster-identity.json`) and
# `src/Core.TypeScript/cluster/registry-mirror-coverage.ts` reads the SAME
# file on the TypeScript side. Edit the JSON once; both consumers move.
#
# -- WHY THE YAML IS HAND-RENDERED, NOT `pkgs.formats.yaml` -----------------
# `pkgs.formats.yaml{}.generate` shells out to `remarshal`/`json2yaml` as a
# BUILD-TIME derivation (`pkgs/pkgs-lib/formats.nix`, nixpkgs
# c25784012c9982bca5b3e0de87e90bbdac8927d3) — a real dependency for a file
# whose shape never varies: one registry name, one `endpoint:` list, both
# already-safe plain YAML scalars. Rendering it as a pure Nix string keeps
# this an EVAL-TIME artifact (`environment.etc.*.text`, not `.source` off a
# derivation), which is what lets `nixos/tests/k3s-registry-mirrors-eval-test.nix`
# assert its exact content under `nix flake check --no-build` with no build at
# all. The `assertions` below are what keep hand-rendering safe: every
# registry key must match `^[a-z0-9.-]+$` (a bare hostname, never a string
# that could break out of a YAML block-mapping key) and every endpoint must be
# an `https://` URL (so nothing containing a literal `"` or newline ever
# reaches the template).
#
# -- WHERE K3S READS THIS -----------------------------------------------
# k3s (like RKE2) reads `/etc/rancher/k3s/registries.yaml` on EVERY node —
# server and agent alike — at containerd startup
# (https://docs.k3s.io/installation/private-registry). There is no
# `services.k3s.registries` / `registriesFile` option in the pinned nixpkgs
# k3s module (checked directly against the flake-locked rev via
# `nixos/modules/services/cluster/rancher/{k3s,default}.nix` at
# c25784012c9982bca5b3e0de87e90bbdac8927d3 — neither file mentions
# "registr" at all), so `environment.etc` is the documented workaround and
# the one this module uses.
#
# -- FALLBACK SEMANTICS, CONFIRMED (this is the property that makes a mirror
# safe to add at all) --------------------------------------------------
# Per the same k3s docs: "The default endpoint is always tried as a last
# resort, even if there are other endpoints listed for that registry in
# registries.yaml. Rewrites are not applied to pulls against the default
# endpoint." The default endpoint for docker.io is
# `https://index.docker.io/v2` (i.e. the real upstream registry). That
# fallback is disabled ONLY by the k3s server/agent flag
# `--disable-default-registry-endpoint`
# (https://docs.k3s.io/installation/private-registry,
# "Disabling Default Endpoint Fallback") — a flag this module does not set
# and which does not appear in `k3s-server.nix` or `k3s-agent.nix`. So a
# `mirror.gcr.io` outage or a cache miss on an image it has never cached
# falls through to Docker Hub directly — exactly the pull that would have
# happened with no mirror configured. A mirror miss can therefore never make
# a pull FAIL that would otherwise have succeeded; it can only, in the
# common case, keep that pull off Docker Hub's metered path entirely.
#
# -- IMPORTED BY -----------------------------------------------------------
# `k3s-server.nix` and `k3s-agent.nix` both import this file directly (every
# node needs the mirror, not just the control plane) — same "the file that
# owns an option's value owns its import" discipline those two files already
# state for their other shared imports.

{ config, lib, pkgs, ... }:

let
  mirrorConfigPath = ../../k8s/registry-mirrors.json;
  mirrorConfig = builtins.fromJSON (builtins.readFile mirrorConfigPath);
  mirrors = mirrorConfig.mirrors;

  isBareHostname = name: builtins.match "[a-z0-9.-]+" name != null;
  isHttpsUrl = url: builtins.match "https://.+" url != null;

  renderEndpoint = endpoint: "      - \"${endpoint}\"";

  renderRegistry =
    name: cfg:
    "  ${name}:\n    endpoint:\n"
    + lib.concatStringsSep "\n" (map renderEndpoint cfg.endpoint)
    + "\n";

  registriesYamlText =
    "# GENERATED from full-ai-cluster/k8s/registry-mirrors.json by\n"
    + "# nixos/modules/k3s-registry-mirrors.nix - do not hand-edit; edit the JSON.\n"
    + "mirrors:\n"
    + lib.concatStringsSep "" (lib.mapAttrsToList renderRegistry mirrors);
in
{
  assertions = [
    {
      assertion = lib.all isBareHostname (builtins.attrNames mirrors);
      message =
        "k8s/registry-mirrors.json: every `mirrors` key must be a bare registry "
        + "hostname matching ^[a-z0-9.-]+$ — this module hand-renders YAML with no "
        + "escaping, so an unchecked key could corrupt /etc/rancher/k3s/registries.yaml.";
    }
    {
      assertion = lib.all (
        cfg: builtins.isList cfg.endpoint && cfg.endpoint != [ ] && lib.all isHttpsUrl cfg.endpoint
      ) (lib.attrValues mirrors);
      message =
        "k8s/registry-mirrors.json: every registry's `endpoint` must be a "
        + "non-empty list of https:// URLs.";
    }
  ];

  # `.text`, not `.source` off a derivation — see the header. This is an
  # eval-time string, so nothing needs to BUILD before a node with this
  # module can be evaluated, and `k3s-registry-mirrors-eval-test.nix` can
  # assert its exact content with no build at all.
  environment.etc."rancher/k3s/registries.yaml".text = registriesYamlText;
}
