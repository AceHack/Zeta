# full-ai-cluster/nixos/modules/cilium-wireguard-sources.nix
#
# The ROSTER of Cilium value surfaces whose encryption settings create a
# node-level kernel requirement, read as text so the requirement can be
# DERIVED rather than restated.
#
# One file, three consumers -- cilium-wireguard-prereqs.nix (which declares
# `boot.kernelModules`), cilium-wireguard-node-preflight.nix (which checks it),
# and nixos/tests/cilium-wireguard-preflight-eval-test.nix (which pins that the
# real manifests still make the demand). A roster copied into three places
# drifts; a roster read from one cannot.
#
# Both paths are already reached from this directory by k3s-server.nix
# (`../../k8s/bootstrap/cilium-install.yaml` at its `manifests` block), so they
# are inside the flake root and readable at evaluation.
#
# ADDING A SURFACE: any new file that can set `encryption.type` for Cilium
# belongs here. Leaving one out does not fail loudly -- it just means the
# preflight stops seeing a demand that exists -- which is why this list is
# short, and why both entries carry the reason they matter.

[
  {
    # k3s HelmChart, `bootstrap: true` -- Cilium at FIRST BOOT, installed
    # before the node is Ready. This is the earliest possible place for the
    # requirement to bite, and the one with no cluster available to ask why.
    name = "k8s/bootstrap/cilium-install.yaml";
    text = builtins.readFile ../../k8s/bootstrap/cilium-install.yaml;
  }
  {
    # The ArgoCD Application that adopts the bootstrap install, at
    # `argocd.argoproj.io/sync-wave: "-80"` -- ahead of essentially everything
    # else in the cluster.
    name = "k8s/applications/cilium/Application.yaml";
    text = builtins.readFile ../../k8s/applications/cilium/Application.yaml;
  }
]
