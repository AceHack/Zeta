# full-ai-cluster/nixos/tests/k8s-node-tunables-eval-test.nix
#
# Properties of nixos/modules/k8s-node-tunables.nix — the module that raises
# vm.max_map_count and the fs.inotify.* limits for the ~150-pod Argo CD
# catalog. NOT a VM test and NOT a boot test: pure evaluation, forcing
# `status` runs every property below. `flake.nix` forces it inside
# `checks.<system>.k8s-node-tunables-model`, which `nix flake check --no-build`
# evaluates on every PR — it costs a PR nothing.
#
# It reads the REAL `nixosConfigurations.control-plane`, not a stub, so what
# it checks is what that host actually ships — the same discipline
# gpu-node-label-preflight-eval-test.nix already applies one file over.
#
# WHAT IT CAN TELL YOU
#   - every key named in ../../k8s/node-tunables.json reaches
#     `config.boot.kernel.sysctl` on the real control-plane host, with the
#     EXACT value the JSON declares (int-vs-string mismatches fail loud);
#   - the JSON is not empty and not malformed — an empty "sysctls" array
#     would make every other property here vacuously true, so it is checked
#     first and separately;
#   - worker-gpu (the other real host that imports common.nix) carries the
#     SAME three keys with the SAME values — a per-host drift here would
#     reproduce the crash-loop on whichever host lost the import;
#   - the three keys this repo's problem statement named explicitly
#     (vm.max_map_count, fs.inotify.max_user_instances,
#     fs.inotify.max_user_watches) are all present, so a JSON edit that
#     silently drops one of them is caught by name, not only by count.
#
# WHAT IT CANNOT TELL YOU
#   Nothing here boots a node or runs `sysctl` against a live kernel. It
#   proves the declared values are the SHIPPED values on both real hosts;
#   only a boot proves the kernel actually accepted them.

{ pkgs, nixosConfig, secondHostConfig }:

let
  inherit (pkgs) lib;

  tunablesFile = ../../k8s/node-tunables.json;
  golden = builtins.fromJSON (builtins.readFile tunablesFile);

  goldenEntries =
    if !(golden ? sysctls) then
      throw "node-tunables.json carries no top-level \"sysctls\" key"
    else
      golden.sysctls;

  nonEmpty =
    if builtins.length goldenEntries >= 1 then true
    else throw "node-tunables.json \"sysctls\" is empty — every property below would be vacuous";

  # The three keys this repo's problem statement named explicitly. Checked by
  # NAME so dropping one silently (while keeping the array non-empty) is
  # still caught.
  requiredKeys = [
    "vm.max_map_count"
    "fs.inotify.max_user_instances"
    "fs.inotify.max_user_watches"
  ];

  goldenKeys = map (e: e.key) goldenEntries;

  missingRequired = lib.subtractLists goldenKeys requiredKeys;

  allRequiredPresent =
    if missingRequired == [ ] then true
    else throw "node-tunables.json is missing required key(s): ${toString missingRequired}";

  # Does a host's shipped `boot.kernel.sysctl` reproduce every golden entry,
  # exactly (value, not just presence)?
  checkHost = hostLabel: hostCfg:
    let
      shipped = hostCfg.config.boot.kernel.sysctl;
      checkOne = entry:
        if !(shipped ? ${entry.key}) then
          throw "${hostLabel}: boot.kernel.sysctl is missing \"${entry.key}\" (declared in node-tunables.json)"
        else if shipped.${entry.key} != entry.value then
          throw "${hostLabel}: boot.kernel.sysctl.\"${entry.key}\" = ${builtins.toJSON shipped.${entry.key}}, node-tunables.json says ${builtins.toJSON entry.value}"
        else
          true;
    in
    lib.all checkOne goldenEntries;

  controlPlaneOk = checkHost "control-plane" nixosConfig;
  secondHostOk = checkHost "worker-gpu" secondHostConfig;
in
{
  status =
    if nonEmpty && allRequiredPresent && controlPlaneOk && secondHostOk
    then "k8s-node-tunables: ${toString (builtins.length goldenEntries)} declared sysctl(s), all ${toString (builtins.length requiredKeys)} required keys present, control-plane and worker-gpu both reproduce every value"
    else throw "unreachable: every mismatch above throws";
}
