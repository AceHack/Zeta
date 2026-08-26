# full-ai-cluster/nixos/tests/cluster-cidr-eval-test.nix
#
# Replays every golden vector through the SHIPPED Nix derivation
# (`nixos/lib/cluster-cidr.nix`) — the same file `nixos/modules/cluster-network.nix`
# calls, not a copy of it.
#
# NOT a VM test and NOT a boot test. It proves things about Nix values only:
# that the Nix half of the cluster-CIDR derivation reproduces, byte for byte,
# what `src/Core.TypeScript/cluster/cluster-cidr.ts` produced when the vectors
# were minted. It cannot say whether a node boots, whether Cilium accepts the
# range, or whether two clusters can actually mesh.
#
# WHAT MAKES IT A FALSIFIER RATHER THAN A CEREMONY. Three separate facts are
# pinned per vector — `hash16`, `clusterId`, and the two CIDR strings — and
# they fail independently. A hash disagreement reads as a hash disagreement
# instead of as a mysterious CIDR difference; an off-by-one in the slot
# arithmetic moves the CIDRs while leaving the hash intact. Proven capable of
# failing: perturbing `serviceSpaceFirstSecondOctet` from 96 to 64 in
# `nixos/lib/cluster-cidr.nix` makes it throw on the first vector.
#
# Costs no VM, runs on every system, and its assertions fire during EVALUATION
# — so `nix flake check --no-build` already runs it. NOTE, because it changes
# what this check is worth: no workflow in this repository runs
# `nix flake check` on `full-ai-cluster/flake.nix` today. The CI-side falsifier
# for the same derivation is
# `src/Core.TypeScript/hygiene/lint-cluster-cidr-agreement.test.ts`, which the
# gate DOES run via `bun test src/Core.TypeScript/hygiene/`.

{ lib }:

let
  derive = import ../lib/cluster-cidr.nix { inherit lib; };

  golden = builtins.fromJSON (builtins.readFile ./cluster-cidr-golden-vectors.json);

  checkOne = vector:
    let
      gotHash = derive.hash16 vector.clusterName;
      gotId = derive.clusterId vector.clusterName;
      gotPod = derive.podCidr vector.clusterName;
      gotService = derive.serviceCidr vector.clusterName;
      fail = field: got: want:
        throw ("cluster-cidr golden vector MISMATCH for ${builtins.toJSON vector.clusterName}: "
          + "${field} = ${builtins.toJSON got}, golden vector says ${builtins.toJSON want}. "
          + "The Nix derivation (nixos/lib/cluster-cidr.nix) and the TypeScript twin "
          + "(src/Core.TypeScript/cluster/cluster-cidr.ts) have diverged, or the vectors "
          + "were regenerated from only one of them.");
    in
    if gotHash != vector.hash16 then fail "hash16" gotHash vector.hash16
    else if gotId != vector.clusterId then fail "clusterId" gotId vector.clusterId
    else if gotPod != vector.podCidr then fail "podCidr" gotPod vector.podCidr
    else if gotService != vector.serviceCidr then fail "serviceCidr" gotService vector.serviceCidr
    else true;

  # A vector list that could be empty would make every check above vacuous —
  # zero rows walked is not zero disagreements found.
  vectorCount = builtins.length golden.vectors;
  nonEmpty =
    if vectorCount >= 4 then true
    else throw "cluster-cidr-golden-vectors.json carries ${toString vectorCount} vectors; a near-empty vector set makes this check vacuous";

  allMatch = nonEmpty && lib.all (v: checkOne v) golden.vectors;

  # Every name in the vector set must also pass the module's own name gate,
  # otherwise the vectors would be pinning behaviour the module refuses.
  namesValid =
    lib.all
      (v: if derive.isValidName v.clusterName then true
          else throw "golden vector name ${builtins.toJSON v.clusterName} fails nixos/lib/cluster-cidr.nix isValidName")
      golden.vectors;
in
{
  status =
    if allMatch && namesValid
    then "cluster-cidr derivation: ${toString vectorCount} golden vectors reproduced (hash16 + clusterId + podCidr + serviceCidr)"
    else throw "unreachable: every mismatch above throws";
}
