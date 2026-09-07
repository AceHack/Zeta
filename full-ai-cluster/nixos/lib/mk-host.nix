# mk-host.nix — assemble a host from a ROLE and CAPABILITIES, instead of hand-listing modules.
#
# WHY THIS EXISTS
# ---------------
# Aaron 2026-09-07: "control-plane and worker-gpu are distinctions, almost placeholders, and we
# want to be able to support more than one on a machine at the same time — control plane AND gpu,
# not just one or the other."
#
# Measured before writing this, by evaluating a probe host rather than by reading the modules:
# k3s-server + gpu + gpu-device-plugin composes cleanly and yields role = "server". Nothing
# technical prevented it. The obstacle was that every host hand-assembled its own module list, so
# "control plane and gpu" existed only if someone wrote a third bundle by hand.
#
# THE MODEL, and the split in it is not cosmetic
# ----------------------------------------------
#   role                  EXCLUSIVE. server | agent. Both k3s role modules assign
#                         `services.k3s.role` outright, so importing two is a conflict — which
#                         is correct: a k3s node is one or the other.
#
#   nodeCapabilities      COMPOSABLE, valid under EITHER role. Hardware and host-local concerns:
#                         drivers, container runtime, disks, credentials.
#
#   clusterCapabilities   COMPOSABLE, valid ONLY on a server, and REFUSED elsewhere.
#
# That third category is the whole point. `services.k3s.manifests` writes into
# /var/lib/rancher/k3s/server/manifests and the k3s deploy controller submits them — on a SERVER.
# Declared on an agent the files are written and nothing reads them: no error, no warning, no
# applied resource. That is exactly how the NVIDIA device plugin came to be declared only on
# worker-gpu (role = "agent") and therefore never installed, so GPUs were never advertised to the
# scheduler (081M1XXA0FC087G0R002F92ZQC).
#
# `audit-k3s-manifests-reach-a-server.ts` DETECTS that class. This makes it UNREPRESENTABLE: a
# cluster capability on a non-server host fails at evaluation, with the reason, before anything
# is built. A detector you can silence is weaker than a shape you cannot express.
{ lib }:

let
  modules = ../modules;

  roleModules = {
    server = [ (modules + "/k3s-server.nix") ];
    agent = [ (modules + "/k3s-agent.nix") ];
  };

  # Valid under either role.
  nodeCapabilityModules = {
    gpu = [ (modules + "/gpu.nix") (modules + "/gpu-passthrough.nix") ];
    docker = [ (modules + "/docker.nix") ];
    operator-credentials = [ (modules + "/initial-password.nix") (modules + "/operator-ssh-keys.nix") ];
    longhorn-disks = [ (modules + "/longhorn-disks.nix") (modules + "/disko-shapes/longhorn-node.nix") ];
  };

  # Applied by the k3s deploy controller, which runs on a SERVER. Refused on an agent.
  clusterCapabilityModules = {
    gpu-device-plugin = [ (modules + "/gpu-device-plugin.nix") ];
    local-storage = [ (modules + "/local-storage.nix") ];
  };

  known = attrs: lib.concatStringsSep ", " (lib.attrNames attrs);
in
{
  inherit roleModules nodeCapabilityModules clusterCapabilityModules;

  /* Assemble a host's module list.

     mkHostModules {
       role = "server";
       nodeCapabilities = [ "docker" ];
       clusterCapabilities = [ "local-storage" "gpu-device-plugin" ];
       hardware = ./hardware-configuration.nix;
       extra = [ ({ networking.hostName = "control-plane"; }) ];
     }
  */
  mkHostModules =
    { role
    , hardware
    , nodeCapabilities ? [ ]
    , clusterCapabilities ? [ ]
    , extra ? [ ]
    }:
    let
      badRole = !(builtins.hasAttr role roleModules);
      unknownNode = lib.subtractLists (lib.attrNames nodeCapabilityModules) nodeCapabilities;
      unknownCluster = lib.subtractLists (lib.attrNames clusterCapabilityModules) clusterCapabilities;
      # THE REFUSAL. A cluster capability on an agent is the defect this model exists to prevent.
      misplacedCluster = if role == "server" then [ ] else clusterCapabilities;
    in
    assert lib.assertMsg (!badRole)
      "mkHostModules: unknown role ${role}. Known roles: ${known roleModules}.";
    assert lib.assertMsg (unknownNode == [ ])
      ("mkHostModules: unknown nodeCapabilities: ${lib.concatStringsSep ", " unknownNode}. "
        + "Known: ${known nodeCapabilityModules}. If it belongs only on a server it is a "
        + "clusterCapability, not a nodeCapability.");
    assert lib.assertMsg (unknownCluster == [ ])
      ("mkHostModules: unknown clusterCapabilities: ${lib.concatStringsSep ", " unknownCluster}. "
        + "Known: ${known clusterCapabilityModules}.");
    assert lib.assertMsg (misplacedCluster == [ ])
      ("mkHostModules: clusterCapabilities ${lib.concatStringsSep ", " misplacedCluster} were "
        + "requested on a role=\"${role}\" host. Those modules install through "
        + "services.k3s.manifests, which the k3s deploy controller applies ON A SERVER — on an "
        + "agent the files are written and NOTHING reads them, silently. Declare them on the "
        + "control plane; a DaemonSet's nodeSelector is what places it on this node's hardware. "
        + "See 081M1XXA0FC087G0R002F92ZQC.");
    [ hardware (modules + "/common.nix") ]
    ++ roleModules.${role}
    ++ lib.concatMap (c: nodeCapabilityModules.${c}) nodeCapabilities
    ++ lib.concatMap (c: clusterCapabilityModules.${c}) clusterCapabilities
    ++ extra;
}
