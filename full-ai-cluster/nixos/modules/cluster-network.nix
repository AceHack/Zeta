# full-ai-cluster/nixos/modules/cluster-network.nix
#
# THE CLUSTER'S POD AND SERVICE CIDRs, DERIVED FROM ITS IDENTITY.
#
# THE DEFECT
# ----------
# `k3s-server.nix` shipped `--cluster-cidr=10.42.0.0/16` and
# `--service-cidr=10.43.0.0/16` as literals, and `k8s/bootstrap/cilium-install.yaml`
# plus `k8s/applications/cilium/Application.yaml` restated `10.42.0.0/16` twice
# more. Every machine flashed from this tree therefore claimed the SAME pod and
# service space as every other.
#
# That is NOT what blocks a multi-node cluster — nodes joining ONE cluster are
# supposed to share its CIDRs, and the blocker there is the join path
# (`injected-server-join.nix`). What it blocks is two DISTINCT clusters ever
# federating: Cilium ClusterMesh requires disjoint pod/service CIDRs and
# distinct cluster ids, and identical literals make that impossible by
# construction.
#
# NO ALLOCATOR (manifesto §1)
# ---------------------------
# The derivation is a pure function of the cluster NAME. There is no registry
# to ask, no node that hands out ranges, and nothing to be captured. A second
# federatable cluster is a second checkout of this tree with a different
# `clusterName` in `full-ai-cluster/cluster-identity.json`.
#
# COLLISION-RESISTANT, NOT COLLISION-FREE — and the ceiling is Cilium's, not
# ours: ClusterMesh's cluster-id is EIGHT BITS (1..255, 0 = unset), so no
# allocator-free scheme can be collision-free. ~50% chance of some collision at
# 19 federated clusters; ~3.9% at four. The mitigation is DETECTION (two
# clusters that federate exchange identity anyway, and each can compute the
# other's values from its name alone) plus RENAMING. Full reasoning, the
# reserved-range list, and the birthday-bound arithmetic live in the
# TypeScript twin's docstring.
#
# THIS IS THE NIX HALF OF A TWO-LANGUAGE DERIVATION.
# `src/Core.TypeScript/cluster/cluster-cidr.ts` is the other half. Nix cannot
# import TypeScript, so the two are held together by
# `nixos/tests/cluster-cidr-golden-vectors.json` — text, diffable, replayable
# (`.claude/rules/no-binary-in-proof-lineage.md`). `nixos/tests/cluster-cidr-eval-test.nix`
# replays every vector through THIS file; the TypeScript suite replays the same
# vectors through the other. Edit one alone and one of them goes red.
#
# WHY IT IS NOT INJECTABLE FROM THE FLASH MEDIUM, unlike the hostname and the
# join endpoint. The Cilium values live in checked-in YAML that ArgoCD
# reconciles FROM GIT; a per-USB cluster name could not move them. An injected
# name would put the CNI on `10.42.0.0/16` and the control plane on the derived
# range, with nothing in the boot output to say so — the silent-divergence
# class this repo keeps paying for. Changing cluster identity is a repo edit,
# and `src/Core.TypeScript/hygiene/lint-cluster-cidr-agreement.ts` re-checks
# every surface that restates the value.

{ config, lib, ... }:

let
  cfg = config.zeta.cluster;

  identity = builtins.fromJSON (builtins.readFile ../../cluster-identity.json);

  # The derivation itself lives in `nixos/lib/cluster-cidr.nix` so that
  # `nixos/tests/cluster-cidr-eval-test.nix` replays the SHIPPED function
  # against the golden vectors rather than a copy of it.
  derive = import ../lib/cluster-cidr.nix { inherit lib; };
in
{
  options.zeta.cluster = {
    name = lib.mkOption {
      type = lib.types.str;
      default = identity.clusterName;
      description = ''
        The cluster's identity. Every value below is a pure function of it.
        Defaults to `clusterName` in `full-ai-cluster/cluster-identity.json`,
        which is the single place an operator changes to build a second,
        federatable cluster.
      '';
    };

    id = lib.mkOption {
      type = lib.types.ints.between 1 255;
      readOnly = true;
      default = derive.clusterId cfg.name;
      description = "Cilium ClusterMesh `cluster.id`, derived from `name`.";
    };

    podCidr = lib.mkOption {
      type = lib.types.str;
      readOnly = true;
      default = derive.podCidr cfg.name;
      description = "k3s `--cluster-cidr`, derived from `name`. A /17 in `10.128.0.0/9`.";
    };

    serviceCidr = lib.mkOption {
      type = lib.types.str;
      readOnly = true;
      default = derive.serviceCidr cfg.name;
      description = "k3s `--service-cidr`, derived from `name`. A /19 in `10.96.0.0/11`.";
    };
  };

  config = {
    # Two assertions, and they fail on different facts.
    #
    # The first refuses a name the derivation is not total over — Cilium
    # embeds the cluster name in ClusterMesh identities and rejects anything
    # that is not a <=32-char RFC-1123 label, so a name that would be refused
    # at mesh time is refused here, where it costs an eval instead of a
    # cluster.
    #
    # The second is the one that earns its place: it reads the CILIUM MANIFESTS
    # and refuses to build a node whose CNI has been told a different pod CIDR
    # than its own control plane. Those files are the second and third copies
    # of this value, one of them reconciled by ArgoCD from git where no Nix
    # module can reach it. Without this, changing `clusterName` produces a
    # cluster whose kubelet and whose CNI disagree about where pods live — and
    # the symptom is "pods have addresses and nothing routes", which reads as a
    # network fault rather than as a config edit. It fails LOUDLY at eval, and
    # it names both files.
    assertions = [
      {
        assertion = derive.isValidName cfg.name;
        message =
          "zeta.cluster.name = ${builtins.toJSON cfg.name} is not a lowercase RFC-1123 label of "
          + "at most 32 characters. Cilium embeds the cluster name in ClusterMesh identities and "
          + "refuses anything else. Edit clusterName in full-ai-cluster/cluster-identity.json.";
      }
      {
        assertion =
          let ciliumBootstrap = builtins.readFile ../../k8s/bootstrap/cilium-install.yaml;
          in lib.hasInfix cfg.podCidr ciliumBootstrap;
        message =
          "k8s/bootstrap/cilium-install.yaml does not mention the derived pod CIDR "
          + "${cfg.podCidr} for cluster ${builtins.toJSON cfg.name}. Cilium's "
          + "clusterPoolIPv4PodCIDRList and ipv4NativeRoutingCIDR must equal k3s' "
          + "--cluster-cidr or pods get addresses nothing routes. Run "
          + "`bun src/Core.TypeScript/hygiene/lint-cluster-cidr-agreement.ts` for every "
          + "surface that restates this value.";
      }
      {
        assertion =
          let ciliumApp = builtins.readFile ../../k8s/applications/cilium/Application.yaml;
          in lib.hasInfix cfg.podCidr ciliumApp;
        message =
          "k8s/applications/cilium/Application.yaml does not mention the derived pod CIDR "
          + "${cfg.podCidr} for cluster ${builtins.toJSON cfg.name}. ArgoCD reconciles that "
          + "file FROM GIT with selfHeal, so a stale value there does not merely disagree — "
          + "it is re-applied over the bootstrap manifest on every sync. Run "
          + "`bun src/Core.TypeScript/hygiene/lint-cluster-cidr-agreement.ts`.";
      }
    ];
  };
}
