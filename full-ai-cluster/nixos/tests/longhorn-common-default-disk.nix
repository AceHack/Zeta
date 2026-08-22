# full-ai-cluster/nixos/tests/longhorn-common-default-disk.nix
#
# Hermetic NixOS VM: a host that only imports common.nix (plus k3s-server
# so the extraFlags the disks module writes have a real k3s to land on)
# and does NOT set zeta.longhorn.dataDisks, does NOT import
# longhorn-disks.nix, and does NOT add extra disks.
#
# This is the shipping control-plane Longhorn shape: the disks module
# arrives only through common.nix, and dataDisks stays at the default
# [ "/var/lib/longhorn" ]. The labelled multi-disk path stays in
# longhorn-volume-binds.nix.
#
# Hermetic: no chart, no images, no internet. Assertions are module-graph
# + unit-on-disk, not Longhorn Node CR registration. Physical 2-NVMe is
# out of scope.
#
# Run:
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.longhorn-common-default-disk -L

{ pkgs }:

pkgs.testers.nixosTest {
  name = "longhorn-common-default-disk";

  nodes.server = { config, lib, ... }: {
    # common.nix takes `stateVersion` from flake specialArgs. nixosTest
    # does not pass those, and the function default is ignored once the
    # module system queries `_module.args`.
    _module.args.stateVersion = "25.11";

    imports = [
      ../modules/common.nix
      ../modules/k3s-server.nix
    ];

    # The test is the default path. Setting dataDisks here would make it
    # another labelled-explicit case and hide a common.nix regression.
    services.k3s.manifests = lib.mkForce { };

    # common.nix default-on services that need install-time substrate.
    # Off here so a hermetic VM can boot; the disks module does not
    # depend on them. The REAL control-plane values are asserted by
    # longhorn-common-default-disk-eval-test.nix.
    zeta.credsRestore.enable = false;
    zeta.selfRegister.enable = false;
    zeta.firstSession.enable = false;

    assertions =
      let
        flags = config.services.k3s.extraFlags;
        flagsText = if builtins.isList flags then lib.concatStringsSep " " flags else toString flags;
      in
      [
        {
          assertion = config.zeta.longhorn.dataDisks == [ "/var/lib/longhorn" ];
          message = ''
            A host that only imports common.nix must keep the default
            single-disk list [ "/var/lib/longhorn" ]. Got: ${toString config.zeta.longhorn.dataDisks}
          '';
        }
        {
          assertion = lib.hasInfix "node.longhorn.io/create-default-disk=config" flagsText;
          message = "common.nix default path must set node.longhorn.io/create-default-disk=config";
        }
        {
          assertion = lib.hasInfix "zeta.io/longhorn-disks=1" flagsText;
          message = "common.nix default path must set zeta.io/longhorn-disks=1";
        }
        {
          assertion = config.systemd.services ? zeta-longhorn-node-disks;
          message = "common.nix default path must fire mkIf (annotator oneshot missing)";
        }
      ];

    virtualisation.memorySize = 2048;
    virtualisation.cores = 2;
  };

  testScript = ''
    start_all()
    server.wait_for_unit("multi-user.target", timeout=300)

    # mkIf fired on the default list: the annotator unit is on disk and
    # names the default path. A bind-mount or a comment would not produce
    # this unit.
    server.succeed("systemctl cat zeta-longhorn-node-disks.service")
    server.succeed(
        "systemctl cat zeta-longhorn-node-disks.service | grep -F '/var/lib/longhorn'"
    )
    server.succeed(
        "systemctl cat zeta-longhorn-node-disks.service | grep -F 'default-disks-config'"
    )

    # The label is on the k3s command line, not only in the Nix eval.
    server.succeed(
        "tr '\\0' ' ' < /proc/$(systemctl show -p MainPID --value k3s)/cmdline "
        "| grep -F 'node.longhorn.io/create-default-disk=config'"
    )
  '';
}
