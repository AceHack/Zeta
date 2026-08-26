# full-ai-cluster/nixos/lib/cluster-cidr.nix
#
# PURE derivation: cluster name -> { clusterId, podCidr, serviceCidr }.
#
# Factored out of `nixos/modules/cluster-network.nix` so the SAME code the
# module runs can be replayed by `nixos/tests/cluster-cidr-eval-test.nix`
# against the golden vectors. A test that reimplements the thing it checks
# proves only that two copies agree; this one runs the shipped function.
#
# The byte-locked twin is `src/Core.TypeScript/cluster/cluster-cidr.ts`, whose
# docstring carries the full reasoning: the address-space choice, the reserved
# ranges, the 8-bit Cilium cluster-id ceiling, and the birthday bound that
# makes this collision-RESISTANT and never collision-free.
#
# No `config`, no `pkgs`, no imports beyond `lib` — a value in, a value out.

{ lib }:

let
  minClusterId = 1;
  slotCount = 255;

  podSpaceFirstSecondOctet = 128;    # 10.128.0.0/9 carved into /17s
  podPrefixLength = 17;
  serviceSpaceFirstSecondOctet = 96; # 10.96.0.0/11 carved into /19s
  servicePrefixLength = 19;

  hexDigitValue = {
    "0" = 0; "1" = 1; "2" = 2; "3" = 3; "4" = 4; "5" = 5; "6" = 6; "7" = 7;
    "8" = 8; "9" = 9; "a" = 10; "b" = 11; "c" = 12; "d" = 13; "e" = 14; "f" = 15;
  };
in
rec {
  inherit minClusterId slotCount podPrefixLength servicePrefixLength;

  # A cluster name is a lowercase RFC-1123 label of at most 32 characters —
  # Cilium's constraint, because it embeds the name in ClusterMesh identities.
  nameRegex = "[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?";

  isValidName = name: builtins.match nameRegex name != null;

  # First four hex digits of sha256(name) as an integer, 0..65535. Sixteen bits
  # rather than eight because 65536 = 255*257 + 1, so the modulo bias is one
  # extra preimage on one residue (~0.4%); an 8-bit draw would put two residues
  # on a single slot.
  hash16 = name:
    lib.foldl'
      (acc: c: acc * 16 + hexDigitValue.${c})
      0
      (lib.take 4 (lib.stringToCharacters (builtins.hashString "sha256" name)));

  clusterId = name: minClusterId + (lib.mod (hash16 name) slotCount);

  # 0..254. Kept separate from `clusterId` on purpose: Cilium wants the id,
  # the address arithmetic wants the slot, and conflating them is how an
  # off-by-one silently shifts every cluster's network by one block.
  slot = name: (clusterId name) - minClusterId;

  # A /17 is half a /16: two blocks per second-octet step, third octet 0 or 128.
  podCidr = name:
    let s = slot name; in
    "10.${toString (podSpaceFirstSecondOctet + (builtins.div s 2))}"
    + ".${toString ((lib.mod s 2) * 128)}.0/${toString podPrefixLength}";

  # A /19 is an eighth of a /16: eight blocks per second-octet step, third
  # octet stepping by 32.
  serviceCidr = name:
    let s = slot name; in
    "10.${toString (serviceSpaceFirstSecondOctet + (builtins.div s 8))}"
    + ".${toString ((lib.mod s 8) * 32)}.0/${toString servicePrefixLength}";

  network = name: {
    clusterName = name;
    clusterId = clusterId name;
    podCidr = podCidr name;
    serviceCidr = serviceCidr name;
  };
}
